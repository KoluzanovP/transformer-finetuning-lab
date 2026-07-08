import { Injectable, UnauthorizedException } from "@nestjs/common";
import { Role, type AuthResponse, type UserPublic } from "@edu/shared";
import type { User } from "@prisma/client";
import { UsersService } from "../users/users.service";
import { TokensService } from "./tokens.service";
import { AuditService } from "../common/audit/audit.service";
import type { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokensService,
    private readonly audit: AuditService,
  ) {}

  private async buildResponse(user: User): Promise<AuthResponse> {
    const tokens = await this.tokens.issue({
      id: user.id,
      email: user.email,
      roles: user.roles as Role[],
    });
    return { user: UsersService.toPublic(user), tokens };
  }

  async register(dto: RegisterDto, ip?: string): Promise<AuthResponse> {
    const user = await this.users.create({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      roles: [dto.role ?? Role.STUDENT],
    });
    await this.audit.log({ actorId: user.id, action: "auth.register", entityType: "User", entityId: user.id, ip });
    return this.buildResponse(user);
  }

  async login(email: string, password: string, ip?: string): Promise<AuthResponse> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Неверный email или пароль");
    }
    const ok = await this.users.verifyPassword(user, password);
    if (!ok) throw new UnauthorizedException("Неверный email или пароль");

    await this.audit.log({ actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id, ip });
    return this.buildResponse(user);
  }

  async refresh(rawRefresh: string): Promise<AuthResponse> {
    let publicUser: UserPublic | null = null;
    const tokens = await this.tokens.rotate(rawRefresh, async (id) => {
      const user = await this.users.findById(id);
      publicUser = UsersService.toPublic(user);
      return { id: user.id, email: user.email, roles: user.roles as Role[] };
    });
    return { user: publicUser!, tokens };
  }

  async logout(rawRefresh: string): Promise<{ success: true }> {
    await this.tokens.revoke(rawRefresh);
    return { success: true };
  }

  async me(userId: string): Promise<UserPublic> {
    const user = await this.users.findById(userId);
    return UsersService.toPublic(user);
  }
}
