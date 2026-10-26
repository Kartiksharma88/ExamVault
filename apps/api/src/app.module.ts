import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SyllabusModule } from './syllabus/syllabus.module';
import { CryptoModule } from './crypto/crypto.module';
import { QuestionsModule } from './questions/questions.module';
import { AuditModule } from './audit/audit.module';
import { ImportModule } from './import/import.module';
import { StatsModule } from './stats/stats.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    ThrottlerModule.forRoot([
      {
        name: 'general',
        ttl: 60000,
        limit: parseInt(process.env.RATE_LIMIT_GENERAL || '100', 10),
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    SyllabusModule,
    CryptoModule,
    QuestionsModule,
    AuditModule,
    ImportModule,
    StatsModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
