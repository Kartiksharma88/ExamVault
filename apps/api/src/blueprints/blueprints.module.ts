import { Module, forwardRef } from '@nestjs/common';
import { BlueprintsController } from './blueprints.controller';
import { BlueprintsService } from './blueprints.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CryptoModule } from '../crypto/crypto.module';
import { ServerSigningProvider } from '../crypto/server-signing-provider';
import { GenerationModule } from '../generation/generation.module';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule, CryptoModule, forwardRef(() => GenerationModule)],
  controllers: [BlueprintsController],
  providers: [BlueprintsService, ServerSigningProvider],
  exports: [BlueprintsService],
})
export class BlueprintsModule {}

