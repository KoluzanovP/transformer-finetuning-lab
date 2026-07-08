import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@edu/shared";
import { RolesGuard } from "./roles.guard";

function contextWith(user: unknown, required: Role[] | undefined): ExecutionContext {
  const reflector = new Reflector();
  jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(required);
  const ctx = {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => null,
    getClass: () => null,
  } as unknown as ExecutionContext;
  return Object.assign(ctx, { __reflector: reflector });
}

describe("RolesGuard", () => {
  const build = (user: unknown, required: Role[] | undefined) => {
    const reflector = new Reflector();
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(required);
    const guard = new RolesGuard(reflector);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => null,
      getClass: () => null,
    } as unknown as ExecutionContext;
    return { guard, ctx };
  };

  it("пропускает, если роли не требуются", () => {
    const { guard, ctx } = build(undefined, undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("пропускает пользователя с нужной ролью", () => {
    const { guard, ctx } = build({ id: "1", roles: [Role.AUTHOR] }, [Role.AUTHOR]);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("блокирует пользователя без нужной роли", () => {
    const { guard, ctx } = build({ id: "1", roles: [Role.STUDENT] }, [Role.AUTHOR]);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it("блокирует анонимного пользователя", () => {
    const { guard, ctx } = build(undefined, [Role.TEACHER]);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});

// silence unused helper warning (kept for reference)
void contextWith;
