import { Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import { IsArray, IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { ALL_ROLES, Role, type Role as RoleT } from "@edu/shared";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { UsersService } from "./users.service";
import { AuditService } from "../common/audit/audit.service";

class CreateUserDto {
  @IsEmail() email!: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
  @IsString() firstName!: string;
  @IsString() lastName!: string;
  @IsArray() @IsIn(ALL_ROLES, { each: true }) roles!: RoleT[];
}

class SetRolesDto {
  @IsArray() @IsIn(ALL_ROLES, { each: true }) roles!: RoleT[];
}

class LinkParentDto {
  @IsString() parentId!: string;
  @IsString() studentId!: string;
}

@Controller("users")
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly audit: AuditService,
  ) {}

  /** Список пользователей (для автора платформы), опционально фильтр по роли. */
  @Get()
  @Roles(Role.AUTHOR)
  list(@Query("role") role?: RoleT) {
    return this.users.list(role ? { role } : undefined);
  }

  /** Автор создаёт учителя/наставника/ученика/родителя (инвайт). */
  @Post()
  @Roles(Role.AUTHOR)
  async create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser) {
    const user = await this.users.create(dto);
    await this.audit.log({
      actorId: actor.id,
      action: "user.create",
      entityType: "User",
      entityId: user.id,
      metadata: { roles: dto.roles },
    });
    return UsersService.toPublic(user);
  }

  @Put(":id/roles")
  @Roles(Role.AUTHOR)
  async setRoles(
    @Param("id") id: string,
    @Body() dto: SetRolesDto,
    @CurrentUser() actor: AuthUser,
  ) {
    const res = await this.users.setRoles(id, dto.roles);
    await this.audit.log({ actorId: actor.id, action: "user.setRoles", entityType: "User", entityId: id, metadata: { roles: dto.roles } });
    return res;
  }

  @Post("link-parent")
  @Roles(Role.AUTHOR)
  async linkParent(@Body() dto: LinkParentDto, @CurrentUser() actor: AuthUser) {
    await this.users.linkParent(dto.parentId, dto.studentId);
    await this.audit.log({ actorId: actor.id, action: "user.linkParent", entityType: "ParentLink", metadata: dto as unknown as Record<string, unknown> });
    return { success: true };
  }

  /** Родитель смотрит своих детей. */
  @Get("me/children")
  @Roles(Role.PARENT)
  children(@CurrentUser() user: AuthUser) {
    return this.users.childrenOf(user.id);
  }
}
