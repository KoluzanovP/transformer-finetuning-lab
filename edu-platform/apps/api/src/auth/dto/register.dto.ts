import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { ALL_ROLES, type Role } from "@edu/shared";

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: "Пароль должен быть не короче 8 символов" })
  password!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsOptional()
  @IsIn(ALL_ROLES)
  role?: Role;
}
