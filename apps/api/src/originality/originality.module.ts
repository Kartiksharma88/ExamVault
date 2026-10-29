import { Module, forwardRef } from '@nestjs/common';
import { OriginalityService } from './originality.service';
import { OriginalityController } from './originality.controller';
import { ScreeningQueue } from './screening.queue';
import { PrismaModule } from '../prisma/prisma.module';
import { CryptoModule } from '../crypto/crypto.module';
import { AuditModule } from '../audit/audit.module';
import { PoliciesModule } from '../policies/policies.module';
import { ReviewModule } from '../review/review.module';

@Module({
  imports: [
    PrismaModule,
    CryptoModule,
    AuditModule,
    PoliciesModule,
    forwardRef(() => ReviewModule),
  ],
  controllers: [OriginalityController],
  providers: [OriginalityService, ScreeningQueue],
  exports: [OriginalityService, ScreeningQueue],
})
export class OriginalityModule {}
