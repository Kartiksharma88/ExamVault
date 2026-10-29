import { Module } from '@nestjs/common';
import { CustodiansController } from './custodians.controller';
import { CustodiansService } from './custodians.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuditModule, AuthModule],
  controllers: [CustodiansController],
  providers: [CustodiansService],
  exports: [CustodiansService],
})
export class CustodiansModule {}

