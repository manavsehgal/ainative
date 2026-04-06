/**
 * License key format: STAG-XXXX-XXXX-XXXX-XXXX
 *
 * - 16 characters from an unambiguous alphabet (no 0/O, 1/I/L)
 * - Last 2 characters are a CRC-16 checksum
 * - Keys are always uppercase
 */

// Unambiguous character set (no 0, O, 1, I, L)
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Compute a simple CRC-16 checksum for a string.
 */
function crc16(input: string): number {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc;
}

/**
 * Generate a license key: STAG-XXXX-XXXX-XXXX-XXXX
 * The last 2 characters encode the CRC-16 checksum.
 */
export function generateLicenseKey(): string {
  const chars: string[] = [];
  for (let i = 0; i < 14; i++) {
    chars.push(ALPHABET[Math.floor(Math.random() * ALPHABET.length)]);
  }

  const payload = chars.join("");
  const checksum = crc16(payload);

  // Encode checksum as 2 characters from alphabet
  const c1 = ALPHABET[checksum % ALPHABET.length];
  const c2 = ALPHABET[Math.floor(checksum / ALPHABET.length) % ALPHABET.length];
  chars.push(c1, c2);

  // Format as STAG-XXXX-XXXX-XXXX-XXXX
  const raw = chars.join("");
  return `STAG-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

/**
 * Validate a license key format and checksum.
 * Returns true if the key is well-formed and the checksum matches.
 */
export function validateLicenseKey(key: string): { valid: boolean; error?: string } {
  const normalized = key.toUpperCase().trim();

  // Check format
  const pattern = /^STAG-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;
  if (!pattern.test(normalized)) {
    return { valid: false, error: "Invalid format (expected STAG-XXXX-XXXX-XXXX-XXXX)" };
  }

  // Extract raw characters (remove STAG- prefix and dashes)
  const raw = normalized.replace(/^STAG-/, "").replace(/-/g, "");
  if (raw.length !== 16) {
    return { valid: false, error: "Invalid key length" };
  }

  // Verify checksum
  const payload = raw.slice(0, 14);
  const checksum = crc16(payload);
  const c1 = ALPHABET[checksum % ALPHABET.length];
  const c2 = ALPHABET[Math.floor(checksum / ALPHABET.length) % ALPHABET.length];

  if (raw[14] !== c1 || raw[15] !== c2) {
    return { valid: false, error: "Invalid checksum" };
  }

  return { valid: true };
}

/**
 * Auto-format a partial key input with dashes.
 * Converts lowercase and strips invalid characters.
 */
export function formatKeyInput(input: string): string {
  // Strip everything except alphanumeric
  const clean = input.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "");

  // Add STAG- prefix if not present
  const parts: string[] = [];
  for (let i = 0; i < clean.length && i < 16; i += 4) {
    parts.push(clean.slice(i, i + 4));
  }

  if (parts.length === 0) return "";
  return "STAG-" + parts.join("-");
}
