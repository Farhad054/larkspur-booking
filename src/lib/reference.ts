import { randomBytes } from "node:crypto";

// Unambiguous alphabet (no 0/O/1/I/L), 8 chars ≈ 40 bits — enough that a reference can't be guessed.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newReference(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}
