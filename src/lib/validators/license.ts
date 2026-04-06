import { z } from "zod";
import { TIERS } from "@/lib/license/tier-limits";

export const activateLicenseSchema = z.object({
  key: z
    .string()
    .min(1, "License key is required")
    .regex(
      /^STAG-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/,
      "Invalid license key format (expected STAG-XXXX-XXXX-XXXX-XXXX)"
    )
    .optional(),
  email: z.string().email("Invalid email address").optional(),
  tier: z.enum(TIERS).optional(),
  token: z.string().optional(),
});

export type ActivateLicenseInput = z.infer<typeof activateLicenseSchema>;

export const licenseStatusSchema = z.object({
  tier: z.enum(TIERS),
  status: z.enum(["active", "inactive", "grace"]),
  email: z.string().nullable(),
  activatedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  lastValidatedAt: z.string().nullable(),
  gracePeriodExpiresAt: z.string().nullable(),
  isPremium: z.boolean(),
  features: z.record(z.string(), z.boolean()),
  limits: z.record(z.string(), z.number()),
});

export type LicenseStatusResponse = z.infer<typeof licenseStatusSchema>;
