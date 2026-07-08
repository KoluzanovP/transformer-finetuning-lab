import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { IsEmail, IsIn, IsOptional, IsString } from "class-validator";
import { Public } from "../common/decorators/public.decorator";
import { OAuthService, type OAuthProfile } from "./oauth.service";

const WEB_URL = process.env.OAUTH_SUCCESS_REDIRECT ?? "http://localhost:3000/oauth/callback";
const CALLBACK_BASE = process.env.OAUTH_CALLBACK_BASE ?? "http://localhost:4000";

interface ProviderConfig {
  authUrl: string;
  tokenUrl: string;
  scope: string;
  clientId?: string;
  clientSecret?: string;
}

function providerConfig(provider: string): ProviderConfig | null {
  if (provider === "google") {
    return {
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scope: "openid email profile",
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (provider === "vk") {
    return {
      authUrl: "https://oauth.vk.com/authorize",
      tokenUrl: "https://oauth.vk.com/access_token",
      scope: "email",
      clientId: process.env.VK_CLIENT_ID,
      clientSecret: process.env.VK_CLIENT_SECRET,
    };
  }
  return null;
}

class MockOAuthDto {
  @IsIn(["google", "vk"]) provider!: "google" | "vk";
  @IsString() providerId!: string;
  @IsEmail() email!: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
}

@Controller("auth")
export class OAuthController {
  constructor(private readonly oauth: OAuthService) {}

  /** Начало OAuth: редирект на страницу согласия провайдера. */
  @Public()
  @Get(":provider/start")
  start(@Param("provider") provider: string, @Res() res: Response) {
    const cfg = providerConfig(provider);
    if (!cfg) throw new NotFoundException("Неизвестный провайдер");
    if (!cfg.clientId) {
      throw new BadRequestException(`OAuth ${provider} не настроен (нет CLIENT_ID)`);
    }
    const redirectUri = `${CALLBACK_BASE}/api/auth/${provider}/callback`;
    const url =
      `${cfg.authUrl}?response_type=code&client_id=${encodeURIComponent(cfg.clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(cfg.scope)}`;
    return res.redirect(url);
  }

  /** Callback: обмен кода на профиль, выдача токенов, редирект в веб. */
  @Public()
  @Get(":provider/callback")
  async callback(@Param("provider") provider: string, @Query() query: Record<string, string>, @Res() res: Response) {
    const cfg = providerConfig(provider);
    if (!cfg || !cfg.clientId || !cfg.clientSecret) {
      throw new BadRequestException(`OAuth ${provider} не настроен`);
    }
    const code = query.code;
    if (!code) throw new BadRequestException("Отсутствует code");

    const profile = await this.exchange(provider, cfg, code);
    const auth = await this.oauth.loginWithProfile(profile);
    const hash = `#access=${auth.tokens.accessToken}&refresh=${auth.tokens.refreshToken}`;
    return res.redirect(`${WEB_URL}${hash}`);
  }

  private async exchange(provider: string, cfg: ProviderConfig, code: string): Promise<OAuthProfile> {
    const redirectUri = `${CALLBACK_BASE}/api/auth/${provider}/callback`;
    const body = new URLSearchParams({
      client_id: cfg.clientId!,
      client_secret: cfg.clientSecret!,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const tokenRes = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const token = (await tokenRes.json()) as Record<string, unknown>;

    if (provider === "google") {
      const info = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${token.access_token as string}` },
      });
      const p = (await info.json()) as { sub: string; email: string; given_name?: string; family_name?: string; picture?: string };
      return { provider: "google", providerId: p.sub, email: p.email, firstName: p.given_name ?? "", lastName: p.family_name ?? "", avatarUrl: p.picture };
    }
    // VK возвращает email и user_id прямо в ответе токена.
    return {
      provider: "vk",
      providerId: String(token.user_id ?? ""),
      email: String(token.email ?? ""),
      firstName: "",
      lastName: "",
    };
  }

  /**
   * DEV-only: имитация OAuth-входа для тестов и локальной отладки, когда
   * реальные ключи провайдера недоступны. Отключено в production.
   */
  @Public()
  @Post("oauth/mock")
  async mock(@Body() dto: MockOAuthDto) {
    if (process.env.NODE_ENV === "production") {
      throw new NotFoundException("Недоступно");
    }
    return this.oauth.loginWithProfile({
      provider: dto.provider,
      providerId: dto.providerId,
      email: dto.email,
      firstName: dto.firstName ?? "OAuth",
      lastName: dto.lastName ?? "Пользователь",
    });
  }
}
