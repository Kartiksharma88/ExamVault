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
import { PoliciesModule } from './policies/policies.module';
import { OriginalityModule } from './originality/originality.module';
import { ReviewModule } from './review/review.module';
import { ModerationModule } from './moderation/moderation.module';
import { CorpusModule } from './corpus/corpus.module';
import { ConflictsModule } from './conflicts/conflicts.module';
import { InternalModule } from './internal/internal.module';
import { BlueprintsModule } from './blueprints/blueprints.module';
import { CustodiansModule } from './custodians/custodians.module';
import { GenerationModule } from './generation/generation.module';
import { ReleaseModule } from './release/release.module';
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
    PoliciesModule,
    OriginalityModule,
    ReviewModule,
    ModerationModule,
    CorpusModule,
    ConflictsModule,
    InternalModule,
    BlueprintsModule,
    CustodiansModule,
    GenerationModule,
    ReleaseModule,
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

