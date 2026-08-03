import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { createReadStream, createWriteStream, existsSync, mkdirSync } from "fs";
import { access } from "fs/promises";
import { constants } from "fs";
import { join, normalize, sep } from "path";
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

  /** Normalize stored paths to forward slashes (portable across OS). */
  toStorageKey(relativePath: string): string {
    return relativePath.replace(/\\/g, "/");
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
    const relativePath = this.toStorageKey(join(params.tenantId, `${id}-${safeName}`));
    const absolutePath = join(this.root, ...relativePath.split("/"));

    try {
      await pipeline(Readable.from(params.buffer), createWriteStream(absolutePath));
    } catch {
      throw new InternalServerErrorException("Failed to persist file");
    }

    return { id, relativePath, size: params.buffer.length };
  }

  resolveAbsolutePath(tenantId: string, relativePath: string): string {
    const key = this.toStorageKey(relativePath.trim());
    if (!key || key.includes("..") || key.startsWith("/")) {
      throw new NotFoundException("Fișierul nu a fost găsit.");
    }
    if (!key.startsWith(`${tenantId}/`)) {
      throw new NotFoundException("Fișierul nu a fost găsit.");
    }
    const absolutePath = normalize(join(this.root, ...key.split("/")));
    const rootNormalized = normalize(this.root + sep);
    if (!absolutePath.startsWith(rootNormalized) && absolutePath !== normalize(this.root)) {
      throw new NotFoundException("Fișierul nu a fost găsit.");
    }
    return absolutePath;
  }

  async openTenantFile(
    tenantId: string,
    relativePath: string
  ): Promise<{ stream: Readable; absolutePath: string; fileName: string }> {
    const absolutePath = this.resolveAbsolutePath(tenantId, relativePath);
    try {
      await access(absolutePath, constants.R_OK);
    } catch {
      throw new NotFoundException("Fișierul nu a fost găsit.");
    }
    const fileName = relativePath.split("/").pop() ?? "file";
    return {
      stream: createReadStream(absolutePath),
      absolutePath,
      fileName
    };
  }
}
