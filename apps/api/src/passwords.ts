import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";
// OWASP's 32 MiB / p=3 scrypt profile. Bound concurrent work and queue length.
let active = 0;
const waiting: Array<() => void> = [];
async function derive(
  password: string,
  salt: string,
  legacy = false,
): Promise<Buffer> {
  if (active >= 2) {
    if (waiting.length >= 16)
      throw new ServiceUnavailableException(
        "Authentication is busy. Retry shortly.",
      );
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else active++;
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      scrypt(
        password,
        salt,
        64,
        {
          N: legacy ? 16384 : 32768,
          r: 8,
          p: legacy ? 1 : 3,
          maxmem: 64 * 1024 * 1024,
        },
        (error, key) => (error ? reject(error) : resolve(key)),
      ),
    );
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt);
  return `scrypt$v1$${salt}$${hash.toString("hex")}`;
}
export async function passwordMatches(password: string, stored?: string) {
  const current = stored?.match(
    /^scrypt\$v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/,
  );
  const legacy = stored?.match(/^([a-f0-9]{32}):([a-f0-9]{128})$/);
  const parts = current || legacy;
  const hash = await derive(
    password,
    parts?.[1] || "backinit-dummy-password-salt",
    Boolean(legacy),
  );
  const expected = parts ? Buffer.from(parts[2]!, "hex") : Buffer.alloc(64);
  return Boolean(parts) && timingSafeEqual(hash, expected);
}
