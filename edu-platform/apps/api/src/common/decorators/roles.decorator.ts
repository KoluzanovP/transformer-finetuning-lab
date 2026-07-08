import { SetMetadata } from "@nestjs/common";
import type { Role } from "@edu/shared";

export const ROLES_KEY = "roles";
/** Ограничивает маршрут указанными ролями (достаточно одной из них). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
