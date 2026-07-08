import type { Role } from "./roles";

/** Публичное представление пользователя (без секретов). */
export interface UserPublic {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  avatarUrl?: string | null;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: UserPublic;
  tokens: AuthTokens;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  /** По умолчанию STUDENT, если не указано и открытая регистрация разрешена. */
  role?: Role;
}

/** Универсальный конверт пагинации. */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
