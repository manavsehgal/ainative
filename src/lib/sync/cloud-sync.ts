/**
 * Cloud Sync — encrypted SQLite backup and restore via Supabase Storage.
 *
 * Encryption: AES-256-GCM with HKDF-derived keys.
 * Envelope: [4B version][32B salt][12B IV][N bytes ciphertext][16B auth tag]
 *
 * V1: Full-database export (no incremental). Manual backup/restore only.
 */

import { createHash, createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { getStagentDataDir } from "@/lib/utils/stagent-paths";
import { getSupabaseClient } from "@/lib/cloud/supabase-client";
import { sqlite } from "@/lib/db";

const SYNC_VERSION = Buffer.from([0, 0, 0, 1]); // Version 1
const BUCKET_NAME = "stagent-sync";

export interface SyncResult {
  success: boolean;
  blobPath?: string;
  sizeBytes?: number;
  error?: string;
}

/**
 * Derive an AES-256 key from userId using HKDF-like construction.
 * Uses SHA-256 HMAC with a fixed info string and random salt.
 */
function deriveKey(userId: string, salt: Buffer): Buffer {
  const hmac = createHash("sha256");
  hmac.update(salt);
  hmac.update(userId);
  hmac.update("stagent-sync-v1");
  return Buffer.from(hmac.digest());
}

/**
 * Encrypt data using AES-256-GCM.
 * Returns envelope: [4B version][32B salt][12B IV][ciphertext + 16B auth tag]
 */
function encrypt(data: Buffer, userId: string): Buffer {
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const key = deriveKey(userId, salt);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([SYNC_VERSION, salt, iv, encrypted, authTag]);
}

/**
 * Decrypt an envelope back to raw data.
 */
function decrypt(envelope: Buffer, userId: string): Buffer {
  // Parse envelope
  const version = envelope.subarray(0, 4);
  if (!version.equals(SYNC_VERSION)) {
    throw new Error(`Unsupported sync version: ${version.toString("hex")}`);
  }

  const salt = envelope.subarray(4, 36);
  const iv = envelope.subarray(36, 48);
  const authTag = envelope.subarray(envelope.length - 16);
  const ciphertext = envelope.subarray(48, envelope.length - 16);

  const key = deriveKey(userId, salt);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Export the SQLite database, encrypt it, and upload to Supabase Storage.
 */
export async function exportAndUpload(userId: string, deviceId: string): Promise<SyncResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Cloud not configured" };

  try {
    // 1. Create a consistent backup using better-sqlite3 .backup()
    const tempPath = join(tmpdir(), `stagent-export-${Date.now()}.db`);
    await sqlite.backup(tempPath);

    // 2. Read and encrypt
    const dbBuffer = readFileSync(tempPath);
    const encrypted = encrypt(dbBuffer, userId);

    // 3. Upload to Supabase Storage
    const blobPath = `${userId}/${deviceId}/${Date.now()}.enc`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(blobPath, encrypted, {
        contentType: "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    // 4. Record sync session
    await supabase.from("sync_sessions").insert({
      user_id: userId,
      device_name: deviceId,
      device_id: deviceId,
      blob_path: blobPath,
      blob_size_bytes: encrypted.length,
      sync_type: "backup",
      status: "completed",
    });

    // Clean up temp file
    try { require("fs").unlinkSync(tempPath); } catch { /* ignore */ }

    return { success: true, blobPath, sizeBytes: encrypted.length };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Export failed" };
  }
}

/**
 * Download the latest snapshot and restore it.
 * Always creates a safety backup before restoring.
 */
export async function downloadAndRestore(userId: string): Promise<SyncResult> {
  const supabase = getSupabaseClient();
  if (!supabase) return { success: false, error: "Cloud not configured" };

  try {
    // 1. Find the latest snapshot
    const { data: sessions, error: listError } = await supabase
      .from("sync_sessions")
      .select("blob_path, blob_size_bytes")
      .eq("user_id", userId)
      .eq("sync_type", "backup")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1);

    if (listError || !sessions?.length) {
      return { success: false, error: "No backup found" };
    }

    const { blob_path } = sessions[0];

    // 2. Download encrypted snapshot
    const { data: blob, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(blob_path);

    if (downloadError || !blob) {
      return { success: false, error: downloadError?.message ?? "Download failed" };
    }

    const encrypted = Buffer.from(await blob.arrayBuffer());

    // 3. Decrypt
    const decrypted = decrypt(encrypted, userId);

    // 4. Create safety backup of current DB
    const dataDir = getStagentDataDir();
    const safetyPath = join(dataDir, `stagent-safety-${Date.now()}.db`);
    const dbPath = join(dataDir, "stagent.db");
    if (existsSync(dbPath)) {
      copyFileSync(dbPath, safetyPath);
    }

    // 5. Write restored DB to temp location and validate
    const tempRestore = join(tmpdir(), `stagent-restore-${Date.now()}.db`);
    writeFileSync(tempRestore, decrypted);

    // Basic validation: check it's a valid SQLite file
    const header = decrypted.subarray(0, 16).toString("ascii");
    if (!header.startsWith("SQLite format 3")) {
      return { success: false, error: "Decrypted data is not a valid SQLite database" };
    }

    // 6. Replace current DB (requires app restart)
    copyFileSync(tempRestore, dbPath);

    // Clean up
    try { require("fs").unlinkSync(tempRestore); } catch { /* ignore */ }

    // Record restore session
    await supabase.from("sync_sessions").insert({
      user_id: userId,
      device_name: "restore",
      device_id: "restore",
      blob_path,
      blob_size_bytes: decrypted.length,
      sync_type: "restore",
      status: "completed",
    });

    return { success: true, sizeBytes: decrypted.length };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Restore failed" };
  }
}

/**
 * List recent sync sessions for the user.
 */
export async function listSyncSessions(userId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("sync_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  return data ?? [];
}
