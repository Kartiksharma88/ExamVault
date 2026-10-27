import { Module } from '@nestjs/common';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { CryptoModule } from '../crypto/crypto.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PoliciesModule } from '../policies/policies.module';
import { ServerSigningProvider } from '../crypto/server-signing-provider';

@Module({
  imports: [PrismaModule, CryptoModule, AuditModule, AuthModule, PoliciesModule],
  controllers: [ReviewController],
  providers: [ReviewService, ServerSigningProvider],
  exports: [ReviewService],
})
export class ReviewModule {}
