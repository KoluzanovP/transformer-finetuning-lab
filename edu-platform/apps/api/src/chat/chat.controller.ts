import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { IsOptional, IsString, MinLength } from "class-validator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { ChatService } from "./chat.service";

class OpenThreadDto {
  @IsOptional() @IsString() teacherId?: string;
  @IsOptional() @IsString() studentId?: string;
  @IsOptional() @IsString() courseId?: string;
}

class SendMessageDto {
  @IsString() @MinLength(1) body!: string;
}

@Controller("chat")
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /** Открыть (или найти) личный диалог ученик — учитель. */
  @Post("threads")
  openThread(@Body() dto: OpenThreadDto, @CurrentUser() user: AuthUser) {
    return this.chat.openThread(user, dto);
  }

  /** Список диалогов текущего пользователя. */
  @Get("threads")
  listThreads(@CurrentUser() user: AuthUser) {
    return this.chat.listThreads(user);
  }

  /** Сообщения диалога. */
  @Get("threads/:id/messages")
  getMessages(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.chat.getMessages(id, user);
  }

  /** Отправить сообщение в диалог. */
  @Post("threads/:id/messages")
  sendMessage(
    @Param("id") id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.chat.sendMessage(id, user, dto.body);
  }

  /** Отметить входящие сообщения прочитанными. */
  @Post("threads/:id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.chat.markRead(id, user);
  }
}
