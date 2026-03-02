import crypto from "node:crypto";

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function buildContentHash(payload: string): string {
  return crypto.createHash("sha256").update(payload).digest("hex");
}
