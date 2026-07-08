import { Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import {
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { Role } from "@edu/shared";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { SchedulingService } from "./scheduling.service";
import { AuditService } from "../common/audit/audit.service";

class RuleDto {
  @IsInt() @Min(0) @Max(6) weekday!: number;
  @IsInt() @Min(0) @Max(1440) startMinute!: number;
  @IsInt() @Min(0) @Max(1440) endMinute!: number;
}

class SetAvailabilityDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => RuleDto) rules!: RuleDto[];
}

class CreateSlotDto {
  @IsISO8601() startsAt!: string;
  @IsOptional() @IsInt() @Min(5) durationMinutes?: number;
  @IsOptional() @IsString() courseId?: string;
}

class BookDto {
  @IsString() courseId!: string;
}

class CompleteDto {
  @IsOptional() @IsString() notes?: string;
}

@Controller()
export class SchedulingController {
  constructor(
    private readonly scheduling: SchedulingService,
    private readonly audit: AuditService,
  ) {}

  /** Автор настраивает доступность преподавателя/наставника. */
  @Put("staff/:staffId/availability")
  @Roles(Role.AUTHOR)
  async setAvailability(@Param("staffId") staffId: string, @Body() dto: SetAvailabilityDto, @CurrentUser() user: AuthUser) {
    const res = await this.scheduling.setAvailability(staffId, dto.rules);
    await this.audit.log({ actorId: user.id, action: "schedule.setAvailability", entityType: "User", entityId: staffId });
    return res;
  }

  @Get("staff/:staffId/availability")
  @Roles(Role.AUTHOR, Role.TEACHER, Role.MENTOR)
  getAvailability(@Param("staffId") staffId: string) {
    return this.scheduling.listAvailability(staffId);
  }

  /** Создание слота: автор — для любого преподавателя, учитель — для себя. */
  @Post("calls")
  @Roles(Role.AUTHOR, Role.TEACHER)
  async createSlot(@Body() dto: CreateSlotDto & { teacherId?: string }, @CurrentUser() user: AuthUser) {
    const teacherId = user.roles.includes(Role.AUTHOR) && dto.teacherId ? dto.teacherId : user.id;
    const call = await this.scheduling.createSlot(teacherId, dto);
    await this.audit.log({ actorId: user.id, action: "call.createSlot", entityType: "Call", entityId: call.id });
    return call;
  }

  @Get("calls/teaching")
  @Roles(Role.TEACHER, Role.MENTOR)
  teaching(@CurrentUser() user: AuthUser) {
    return this.scheduling.listForTeacher(user.id);
  }

  @Get("calls/mine")
  @Roles(Role.STUDENT)
  mine(@CurrentUser() user: AuthUser) {
    return this.scheduling.listForStudent(user.id);
  }

  @Get("calls/available")
  @Roles(Role.STUDENT, Role.AUTHOR)
  available(@Query("teacherId") teacherId: string) {
    return this.scheduling.availableForTeacher(teacherId);
  }

  @Post("calls/:id/book")
  @Roles(Role.STUDENT)
  async book(@Param("id") id: string, @Body() dto: BookDto, @CurrentUser() user: AuthUser) {
    const call = await this.scheduling.book(user.id, id, dto.courseId);
    await this.audit.log({ actorId: user.id, action: "call.book", entityType: "Call", entityId: id });
    return call;
  }

  @Post("calls/:id/cancel")
  @Roles(Role.STUDENT, Role.TEACHER, Role.AUTHOR)
  cancel(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.scheduling.cancel(id, user);
  }

  @Post("calls/:id/complete")
  @Roles(Role.TEACHER)
  complete(@Param("id") id: string, @Body() dto: CompleteDto, @CurrentUser() user: AuthUser) {
    return this.scheduling.complete(id, user.id, dto.notes);
  }
}
