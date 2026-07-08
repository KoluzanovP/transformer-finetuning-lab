import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from "class-validator";
import { SELF_SIGNUP_ROLES, type Role as RoleT } from "@edu/shared";

export { SELF_SIGNUP_ROLES };

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8, { message: "Пароль должен быть не короче 8 символов" })
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: "Пароль должен содержать буквы и цифры",
  })
  password!: string;

  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  // Через публичную регистрацию можно стать только учеником или родителем.
  // Учителей/наставников/авторов заводит автор платформы.
  @IsOptional()
  @IsIn(SELF_SIGNUP_ROLES, { message: "Недопустимая роль для регистрации" })
  role?: RoleT;
}
