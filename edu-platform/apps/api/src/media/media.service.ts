import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { MediaAsset, MediaKind } from "@prisma/client";
import { Role } from "@edu/shared";
import { PrismaService } from "../common/prisma/prisma.service";
import type { AuthUser } from "../common/decorators/current-user.decorator";

/** Данные для регистрации уже загруженного медиа-файла. */
export interface RegisterMediaInput {
  kind: MediaKind;
  url: string;
  mimeType?: string;
  sizeBytes?: number;
  storageKey?: string;
}

/** Данные для получения цели загрузки (presign-style). */
export interface UploadTargetInput {
  filename: string;
  kind: MediaKind;
  mimeType?: string;
}

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Регистрирует запись о медиа-файле (LOCAL: уже известный URL). */
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

  /** Медиа-файлы текущего пользователя, новые сверху. */
  listMine(uploaderId: string): Promise<MediaAsset[]> {
    return this.prisma.mediaAsset.findMany({
      where: { uploaderId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Возвращает цель для загрузки файла.
   * Для LOCAL — путь на диск/публичный URL, для S3 — presigned URL (заглушка).
   */
  createUploadTarget(uploaderId: string, dto: UploadTargetInput) {
    const driver = this.config.get<"LOCAL" | "S3">("storage.driver");

    if (driver === "S3") {
      // TODO: сгенерировать presigned URL через S3/R2 (aws-sdk пока не установлен).
      return {
        driver: "S3" as const,
        uploadUrl: "",
        publicUrl: "",
        note: "TODO: сгенерировать presigned URL через S3/R2",
      };
    }

    const publicBaseUrl = this.config.get<string>("storage.publicBaseUrl");
    const target = `${publicBaseUrl}/${uploaderId}/${dto.filename}`;
    return {
      driver: "LOCAL" as const,
      uploadUrl: target,
      publicUrl: target,
      method: "PUT" as const,
    };
  }

  /** Удаляет медиа: разрешено владельцу или автору платформы. */
  async remove(id: string, user: AuthUser): Promise<{ success: true }> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) {
      throw new NotFoundException("Медиа не найдено");
    }
    const isOwner = asset.uploaderId === user.id;
    const isAuthor = user.roles.includes(Role.AUTHOR);
    if (!isOwner && !isAuthor) {
      throw new ForbiddenException("Недостаточно прав для удаления");
    }
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { success: true };
  }
}
