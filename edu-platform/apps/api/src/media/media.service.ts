import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { promises as fs } from "fs";
import { join, resolve, extname } from "path";
import { randomBytes } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { MediaAsset, MediaKind } from "@prisma/client";
import { Role } from "@edu/shared";
import { PrismaService } from "../common/prisma/prisma.service";
import type { AuthUser } from "../common/decorators/current-user.decorator";

export interface RegisterMediaInput {
  kind: MediaKind;
  url: string;
  mimeType?: string;
  sizeBytes?: number;
  storageKey?: string;
}

export interface UploadTargetInput {
  filename: string;
  kind: MediaKind;
  mimeType?: string;
}

export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Корень локального хранилища файлов (dev). */
export const UPLOADS_DIR = resolve(process.cwd(), "uploads");

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private key(uploaderId: string, filename: string): string {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `${uploaderId}/${randomBytes(6).toString("hex")}${extname(safe) || ""}`.replace(/\/+/g, "/");
  }

  register(uploaderId: string, dto: RegisterMediaInput): Promise<MediaAsset> {
    return this.prisma.mediaAsset.create({
      data: {
        uploaderId,
        kind: dto.kind,
        url: dto.url,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        storageKey: dto.storageKey,
      },
    });
  }

  /** Реальная загрузка файла на локальный диск (driver=LOCAL). */
  async saveLocalFile(uploaderId: string, kind: MediaKind, file: UploadedFile): Promise<MediaAsset> {
    const storageKey = this.key(uploaderId, file.originalname);
    const absPath = join(UPLOADS_DIR, storageKey);
    await fs.mkdir(join(absPath, ".."), { recursive: true });
    await fs.writeFile(absPath, file.buffer);
    const publicBaseUrl = this.config.get<string>("storage.publicBaseUrl") ?? "/uploads";
    return this.register(uploaderId, {
      kind,
      url: `${publicBaseUrl}/${storageKey}`,
      storageKey,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });
  }

  listMine(uploaderId: string): Promise<MediaAsset[]> {
    return this.prisma.mediaAsset.findMany({
      where: { uploaderId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Цель загрузки. Для S3/R2 — реальный presigned PUT URL (генерируется
   * локально, без обращения к сети). Для LOCAL — эндпоинт прямой загрузки.
   */
  async createUploadTarget(uploaderId: string, dto: UploadTargetInput) {
    const driver = this.config.get<"LOCAL" | "S3">("storage.driver");
    const storageKey = this.key(uploaderId, dto.filename);

    if (driver === "S3") {
      const bucket = process.env.S3_BUCKET ?? "edu-media";
      const client = new S3Client({
        region: process.env.S3_REGION ?? "auto",
        endpoint: process.env.S3_ENDPOINT || undefined,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
        },
      });
      const uploadUrl = await getSignedUrl(
        client,
        new PutObjectCommand({ Bucket: bucket, Key: storageKey, ContentType: dto.mimeType }),
        { expiresIn: 900 },
      );
      const publicBase = process.env.S3_PUBLIC_BASE_URL ?? "";
      return {
        driver: "S3" as const,
        method: "PUT" as const,
        uploadUrl,
        storageKey,
        publicUrl: publicBase ? `${publicBase}/${storageKey}` : storageKey,
      };
    }

    // LOCAL — загрузка идёт multipart-запросом на POST /media/upload.
    return {
      driver: "LOCAL" as const,
      method: "POST_MULTIPART" as const,
      uploadUrl: "/api/media/upload",
      storageKey,
      publicUrl: `${this.config.get<string>("storage.publicBaseUrl")}/${storageKey}`,
    };
  }

  async remove(id: string, user: AuthUser): Promise<{ success: true }> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException("Медиа не найдено");
    const isOwner = asset.uploaderId === user.id;
    const isAuthor = user.roles.includes(Role.AUTHOR);
    if (!isOwner && !isAuthor) throw new ForbiddenException("Недостаточно прав для удаления");

    // Пытаемся удалить локальный файл (best-effort).
    if (asset.storageKey && this.config.get("storage.driver") === "LOCAL") {
      await fs.rm(join(UPLOADS_DIR, asset.storageKey), { force: true }).catch(() => undefined);
    }
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { success: true };
  }
}
