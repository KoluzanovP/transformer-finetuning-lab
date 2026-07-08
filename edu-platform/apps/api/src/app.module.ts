import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import configuration from "./config/configuration";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AuditModule } from "./common/audit/audit.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { CoursesModule } from "./courses/courses.module";
import { LessonsModule } from "./lessons/lessons.module";
import { HomeworkModule } from "./homework/homework.module";
import { EnrollmentsModule } from "./enrollments/enrollments.module";
import { SubmissionsModule } from "./submissions/submissions.module";
import { CommentsModule } from "./comments/comments.module";
import { ChatModule } from "./chat/chat.module";
import { SchedulingModule } from "./scheduling/scheduling.module";
import { TicketsModule } from "./tickets/tickets.module";
import { MediaModule } from "./media/media.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { HealthModule } from "./health/health.module";
import { BootstrapModule } from "./bootstrap/bootstrap.module";
import { AdminModule } from "./admin/admin.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // Rate-limiting: 200 запросов/мин на IP (в тестах отключено).
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 200 }],
      skipIf: () => process.env.NODE_ENV === "test",
    }),
    PrismaModule,
    AuditModule,
    NotificationsModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    LessonsModule,
    HomeworkModule,
    EnrollmentsModule,
    SubmissionsModule,
    CommentsModule,
    ChatModule,
    SchedulingModule,
    TicketsModule,
    MediaModule,
    AnalyticsModule,
    HealthModule,
    BootstrapModule,
    AdminModule,
  ],
  providers: [
    // Глобально: rate-limit → аутентификация (JWT) → проверка ролей.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
