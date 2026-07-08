import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { IsIn, IsInt, IsOptional, IsString } from "class-validator";
import type { MediaKind } from "@prisma/client";
import { Role } from "@edu/shared";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { MediaService } from "./media.service";

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

  /** Возвращает цель для загрузки (presign-style). */
  @Post("upload-target")
  @Roles(Role.AUTHOR, Role.TEACHER)
  createUploadTarget(@Body() dto: UploadTargetDto, @CurrentUser() user: AuthUser) {
    return this.media.createUploadTarget(user.id, dto);
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
