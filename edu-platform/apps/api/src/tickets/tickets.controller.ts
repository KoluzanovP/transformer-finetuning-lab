import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import { IsIn, IsString } from "class-validator";
import { Role, TicketStatus } from "@edu/shared";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { TicketsService } from "./tickets.service";

class CreateTicketDto {
  @IsString() subject!: string;
  @IsString() body!: string;
}

class ReplyDto {
  @IsString() body!: string;
}

class StatusDto {
  @IsIn(Object.values(TicketStatus)) status!: TicketStatus;
}

@Controller("tickets")
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  /** Создать обращение в поддержку. */
  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthUser) {
    return this.tickets.create(user.id, dto);
  }

  /** Мои обращения. */
  @Get("mine")
  listMine(@CurrentUser() user: AuthUser) {
    return this.tickets.listMine(user.id);
  }

  /** Очередь обращений для наставника. */
  @Get("queue")
  @Roles(Role.MENTOR, Role.AUTHOR)
  listQueue() {
    return this.tickets.listQueue();
  }

  /** Открыть обращение. */
  @Get(":id")
  get(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.tickets.get(id, user);
  }

  /** Ответить в обращении. */
  @Post(":id/messages")
  reply(
    @Param("id") id: string,
    @Body() dto: ReplyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.reply(id, user, dto.body);
  }

  /** Сменить статус обращения. */
  @Put(":id/status")
  @Roles(Role.MENTOR, Role.AUTHOR)
  setStatus(
    @Param("id") id: string,
    @Body() dto: StatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tickets.setStatus(id, user, dto.status);
  }
}
