import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export class TokenVault {
  private readonly key?: Buffer;

  constructor(base64Key?: string) {
    this.key = base64Key ? Buffer.from(base64Key, "base64") : undefined;
    if (this.key && this.key.byteLength !== 32) {
      throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes.");
    }
  }

  encrypt(value: string): string {
    if (!this.key) return value;
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]).toString("base64");
  }

  decrypt(value: string): string {
    if (!this.key) return value;
    const payload = Buffer.from(value, "base64");
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const ciphertext = payload.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  }
}
