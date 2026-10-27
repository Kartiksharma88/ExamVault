import { Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CryptoModule } from '../crypto/crypto.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ServerSigningProvider } from '../crypto/server-signing-provider';

@Module({
  imports: [PrismaModule, CryptoModule, AuditModule, AuthModule],
  controllers: [ModerationController],
  providers: [ModerationService, ServerSigningProvider],
  exports: [ModerationService],
})
export class ModerationModule {}
