import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { createWriteStream, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { randomUUID } from "crypto";

@Injectable()
export class LocalFileStorageService {
  private readonly root: string;

  constructor() {
    this.root = process.env.STORAGE_ROOT ?? join(process.cwd(), "storage");
    if (!existsSync(this.root)) {
      mkdirSync(this.root, { recursive: true });
    }
  }

  getRoot() {
    return this.root;
  }

  async saveUploadedFile(params: {
    tenantId: string;
    originalName: string;
    buffer: Buffer;
    mimeType?: string;
  }): Promise<{ id: string; relativePath: string; size: number }> {
    const id = randomUUID();
    const safeName = params.originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const dir = join(this.root, params.tenantId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const relativePath = join(params.tenantId, `${id}-${safeName}`);
    const absolutePath = join(this.root, relativePath);

    try {
      await pipeline(Readable.from(params.buffer), createWriteStream(absolutePath));
    } catch {
      throw new InternalServerErrorException("Failed to persist file");
    }

    return { id, relativePath, size: params.buffer.length };
  }
}
