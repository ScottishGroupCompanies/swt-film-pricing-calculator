import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

export interface EncryptedZohoToken {
  ciphertext: string;
  iv: string;
  tag: string;
}

function encryptionKey(secret: string): Buffer {
  return scryptSync(secret, "swt-zoho-refresh-token", 32);
}

export function zohoTokenSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env.ZOHO_TOKEN_ENCRYPTION_KEY?.trim() || env.SESSION_SECRET?.trim();
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return secret;
}

/** AES-256-GCM. The plaintext token is not returned to the browser. */
export function encryptRefreshToken(token: string, secret: string): EncryptedZohoToken {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptRefreshToken(encrypted: EncryptedZohoToken, secret: string): string {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), Buffer.from(encrypted.iv, "base64"));
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}
