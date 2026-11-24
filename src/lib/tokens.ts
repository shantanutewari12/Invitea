import "server-only";
import { nanoid } from "nanoid";

import { TOKEN_LENGTH } from "@/config/plans";

/** Cryptographically random, URL-safe, unguessable (nanoid uses the platform CSPRNG). */
export function generateToken(): string {
  return nanoid(TOKEN_LENGTH);
}
