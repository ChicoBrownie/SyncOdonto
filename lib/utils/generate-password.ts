import crypto from "node:crypto"

export function generateTempPassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%"
  return Array.from(crypto.randomFillSync(new Uint8Array(length)))
    .map((byte) => chars[byte % chars.length])
    .join("")
}