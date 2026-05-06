import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { Injectable } from "@nestjs/common";

@Injectable()
export class DataEncryptionService {
  private readonly algorithm = "aes-256-gcm";
  private readonly key = scryptSync(
    process.env.DATA_ENCRYPTION_KEY ?? "dev-only-change-me",
    "employee-platform-salt",
    32
  );

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted.toString("hex")}`;
  }

  decrypt(payload: string): string {
    const [ivHex, tagHex, dataHex] = payload.split(".");
    const decipher = createDecipheriv(this.algorithm, this.key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final()
    ]);
    return plain.toString("utf8");
  }
}
