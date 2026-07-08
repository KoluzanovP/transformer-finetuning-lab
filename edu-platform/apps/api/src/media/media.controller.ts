import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IsIn, IsInt, IsOptional, IsString } from "class-validator";
import type { MediaKind } from "@prisma/client";
import { Role } from "@edu/shared";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { MediaService, type UploadedFile as MulterFile } from "./media.service";

/** Допустимые виды медиа (совместимы с Prisma enum MediaKind). */
const MEDIA_KINDS = ["IMAGE", "VIDEO", "AUDIO", "FILE"] as const;

class RegisterMediaDto {
  @IsIn(MEDIA_KINDS) kind!: MediaKind;
  @IsString() url!: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsInt() sizeBytes?: number;
  @IsOptional() @IsString() storageKey?: string;
}

class UploadTargetDto {
  @IsString() filename!: string;
  @IsIn(MEDIA_KINDS) kind!: MediaKind;
  @IsOptional() @IsString() mimeType?: string;
}

@Controller("media")
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /** Регистрирует уже загруженный файл (URL известен). */
  @Post()
  @Roles(Role.AUTHOR, Role.TEACHER)
  register(@Body() dto: RegisterMediaDto, @CurrentUser() user: AuthUser) {
    return this.media.register(user.id, dto);
  }

  /** Возвращает цель для загрузки: presigned URL (S3) или эндпоинт (LOCAL). */
  @Post("upload-target")
  @Roles(Role.AUTHOR, Role.TEACHER)
  createUploadTarget(@Body() dto: UploadTargetDto, @CurrentUser() user: AuthUser) {
    return this.media.createUploadTarget(user.id, dto);
  }

  /** Прямая multipart-загрузка файла (driver=LOCAL). Поле формы: file. */
  @Post("upload")
  @Roles(Role.AUTHOR, Role.TEACHER)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 200 * 1024 * 1024 } }))
  async upload(
    @UploadedFile() file: MulterFile | undefined,
    @Query("kind") kind: MediaKind = "FILE",
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException("Файл не передан (поле form-data: file)");
    return this.media.saveLocalFile(user.id, kind, file);
  }

  /** Медиа-файлы текущего пользователя. */
  @Get("mine")
  listMine(@CurrentUser() user: AuthUser) {
    return this.media.listMine(user.id);
  }

  /** Удаляет медиа (владелец или автор платформы). */
  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.media.remove(id, user);
  }
}
