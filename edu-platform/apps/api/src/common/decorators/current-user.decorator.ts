import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Role } from "@edu/shared";

export interface AuthUser {
  id: string;
  email: string;
  roles: Role[];
}

/** Достаёт текущего пользователя (из JWT) из запроса. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | AuthUser[keyof AuthUser] => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;
    return data ? user?.[data] : user;
  },
);
