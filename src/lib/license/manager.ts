/**
 * LicenseManager — singleton for local license enforcement.
 *
 * Mirrors the budget-guardrails.ts pattern: process-memory cache for
 * synchronous access, daily cloud validation, offline grace period.
 *
 * Usage:
 *   import { licenseManager } from "@/lib/license/manager";
 *   const tier = licenseManager.getTier();
 *   if (!licenseManager.isFeatureAllowed("cloud-sync")) { ... }
 */

import { db } from "@/lib/db";
import { license as licenseTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { type LicenseTier, TIER_LIMITS, type LimitResource } from "./tier-limits";
import { canAccessFeature, type LicenseFeature } from "./features";

const LICENSE_ROW_ID = "default";
const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const VALIDATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedLicense {
  tier: LicenseTier;
  status: "active" | "inactive" | "grace";
  email: string | null;
  activatedAt: Date | null;
  expiresAt: Date | null;
  lastValidatedAt: Date | null;
  gracePeriodExpiresAt: Date | null;
}

class LicenseManager {
  private cache: CachedLicense | null = null;
  private validationTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize from DB. Call once at app boot (instrumentation.ts).
   * Creates the default license row if it doesn't exist.
   */
  initialize(): void {
    const rows = db
      .select()
      .from(licenseTable)
      .where(eq(licenseTable.id, LICENSE_ROW_ID))
      .all();

    if (rows.length === 0) {
      const now = new Date();
      db.insert(licenseTable)
        .values({
          id: LICENSE_ROW_ID,
          tier: "community",
          status: "active",
          createdAt: now,
          updatedAt: now,
        })
        .run();

      this.cache = {
        tier: "community",
        status: "active",
        email: null,
        activatedAt: null,
        expiresAt: null,
        lastValidatedAt: null,
        gracePeriodExpiresAt: null,
      };
    } else {
      const row = rows[0];
      this.cache = this.rowToCache(row);
    }

    // Check grace period expiry
    this.checkGracePeriod();
  }

  /**
   * Start the daily validation timer.
   * Separated from initialize() so tests can skip the timer.
   */
  startValidationTimer(): void {
    if (this.validationTimer) return;
    this.validationTimer = setInterval(() => {
      this.validateAndRefresh();
    }, VALIDATION_INTERVAL_MS);
  }

  stopValidationTimer(): void {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
    }
  }

  /** Current tier — synchronous, zero-latency (reads from cache) */
  getTier(): LicenseTier {
    return this.cache?.tier ?? "community";
  }

  /**
   * Read tier directly from DB — bypasses in-memory cache.
   * Use this in Server Components where the singleton cache may be stale
   * due to Turbopack module instance separation.
   */
  getTierFromDb(): LicenseTier {
    const row = db
      .select({ tier: licenseTable.tier })
      .from(licenseTable)
      .where(eq(licenseTable.id, LICENSE_ROW_ID))
      .get();
    return (row?.tier as LicenseTier) ?? "community";
  }

  /** True if tier is solo or above */
  isPremium(): boolean {
    const tier = this.getTier();
    return tier !== "community";
  }

  /** Check if a specific feature is allowed for the current tier */
  isFeatureAllowed(feature: LicenseFeature): boolean {
    return canAccessFeature(this.getTier(), feature);
  }

  /** Get the limit value for a resource at the current tier */
  getLimit(resource: LimitResource): number {
    return TIER_LIMITS[this.getTier()][resource];
  }

  /** Get the full cached license state */
  getStatus(): CachedLicense & { tier: LicenseTier } {
    return {
      tier: this.getTier(),
      status: this.cache?.status ?? "inactive",
      email: this.cache?.email ?? null,
      activatedAt: this.cache?.activatedAt ?? null,
      expiresAt: this.cache?.expiresAt ?? null,
      lastValidatedAt: this.cache?.lastValidatedAt ?? null,
      gracePeriodExpiresAt: this.cache?.gracePeriodExpiresAt ?? null,
    };
  }

  /**
   * Activate a license locally. Called after successful cloud validation.
   */
  activate(params: {
    tier: LicenseTier;
    email: string;
    expiresAt?: Date;
    encryptedToken?: string;
  }): void {
    const now = new Date();

    // Ensure the license row exists (may be missing if initialize() hasn't run)
    const existing = db
      .select({ id: licenseTable.id })
      .from(licenseTable)
      .where(eq(licenseTable.id, LICENSE_ROW_ID))
      .get();

    if (existing) {
      db.update(licenseTable)
        .set({
          tier: params.tier,
          status: "active",
          email: params.email,
          activatedAt: now,
          expiresAt: params.expiresAt ?? null,
          lastValidatedAt: now,
          gracePeriodExpiresAt: null,
          encryptedToken: params.encryptedToken ?? null,
          updatedAt: now,
        })
        .where(eq(licenseTable.id, LICENSE_ROW_ID))
        .run();
    } else {
      db.insert(licenseTable)
        .values({
          id: LICENSE_ROW_ID,
          tier: params.tier,
          status: "active",
          email: params.email,
          activatedAt: now,
          expiresAt: params.expiresAt ?? null,
          lastValidatedAt: now,
          gracePeriodExpiresAt: null,
          encryptedToken: params.encryptedToken ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }

    this.refreshCache();
  }

  /**
   * Deactivate — revert to community tier.
   */
  deactivate(): void {
    const now = new Date();
    db.update(licenseTable)
      .set({
        tier: "community",
        status: "inactive",
        email: null,
        activatedAt: null,
        expiresAt: null,
        lastValidatedAt: null,
        gracePeriodExpiresAt: null,
        encryptedToken: null,
        updatedAt: now,
      })
      .where(eq(licenseTable.id, LICENSE_ROW_ID))
      .run();

    this.refreshCache();
  }

  /**
   * Daily validation against cloud.
   * On success: update lastValidatedAt, clear grace period.
   * On failure: enter grace period if not already in one.
   * Never throws — silently uses cached state on error.
   */
  async validateAndRefresh(): Promise<void> {
    try {
      // Skip validation for community tier — no license to validate
      if (this.getTier() === "community") return;

      // Dynamic import to avoid circular deps and allow Supabase to be optional
      const { validateLicenseWithCloud } = await import("./cloud-validation");
      const result = await validateLicenseWithCloud(this.cache?.email ?? "");

      if (result.valid) {
        const now = new Date();
        db.update(licenseTable)
          .set({
            tier: result.tier,
            status: "active",
            lastValidatedAt: now,
            gracePeriodExpiresAt: null,
            expiresAt: result.expiresAt ?? null,
            updatedAt: now,
          })
          .where(eq(licenseTable.id, LICENSE_ROW_ID))
          .run();
      } else {
        this.enterGracePeriod();
      }
    } catch {
      // Network failure — enter grace period if not already in one
      if (this.cache?.status === "active" && this.cache?.lastValidatedAt) {
        this.enterGracePeriod();
      }
    }

    this.refreshCache();
  }

  private enterGracePeriod(): void {
    if (this.cache?.status === "grace") return; // Already in grace

    const now = new Date();
    const graceExpiry = new Date(now.getTime() + GRACE_PERIOD_MS);

    db.update(licenseTable)
      .set({
        status: "grace",
        gracePeriodExpiresAt: graceExpiry,
        updatedAt: now,
      })
      .where(eq(licenseTable.id, LICENSE_ROW_ID))
      .run();
  }

  private checkGracePeriod(): void {
    if (this.cache?.status !== "grace") return;
    if (!this.cache.gracePeriodExpiresAt) return;

    if (new Date() > this.cache.gracePeriodExpiresAt) {
      // Grace period expired — degrade to community
      this.deactivate();
    }
  }

  private refreshCache(): void {
    const rows = db
      .select()
      .from(licenseTable)
      .where(eq(licenseTable.id, LICENSE_ROW_ID))
      .all();

    if (rows.length > 0) {
      this.cache = this.rowToCache(rows[0]);
      this.checkGracePeriod();
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private rowToCache(row: any): CachedLicense {
    return {
      tier: row.tier as LicenseTier,
      status: row.status as CachedLicense["status"],
      email: row.email,
      activatedAt: row.activatedAt,
      expiresAt: row.expiresAt,
      lastValidatedAt: row.lastValidatedAt,
      gracePeriodExpiresAt: row.gracePeriodExpiresAt,
    };
  }
}

/** Singleton instance */
export const licenseManager = new LicenseManager();
