import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { CustodiansService } from './custodians.service';

@ApiTags('Custodians & Key Distribution')
@Controller('custodians')
@UseGuards(AuthGuard)
export class CustodiansController {
  constructor(private readonly custodiansService: CustodiansService) {}

  @Post('groups')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a new custodian group (Admin)' })
  async createGroup(
    @Body()
    body: {
      name: string;
      description?: string;
      n: number;
      k: number;
      custodianIds: string[];
    },
    @Req() req: Request,
  ) {
    return this.custodiansService.createGroup({
      ...body,
      actorId: req.userId!,
    });
  }

  @Post('enroll')
  @Roles('CUSTODIAN')
  @ApiOperation({ summary: 'Enroll custodian browser-generated public key' })
  async enrollKey(
    @Body() body: { publicKey: string; fingerprint: string },
    @Req() req: Request,
  ) {
    return this.custodiansService.enrollKey({
      userId: req.userId!,
      publicKey: body.publicKey,
      fingerprint: body.fingerprint,
    });
  }

  @Post('enroll-key')
  @Roles('CUSTODIAN')
  @ApiOperation({ summary: 'Enroll custodian browser-generated public key (alias)' })
  async enrollKeyAlias(
    @Body() body: { publicKey: string; fingerprint: string },
    @Req() req: Request,
  ) {
    return this.custodiansService.enrollKey({
      userId: req.userId!,
      publicKey: body.publicKey,
      fingerprint: body.fingerprint,
    });
  }

  @Get('groups')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List custodian groups' })
  async listGroups() {
    return this.custodiansService.listGroups();
  }

  @Get('assigned-papers')
  @Roles('CUSTODIAN')
  @ApiOperation({ summary: 'Get papers assigned to authenticated custodian' })
  async getAssignedPapers(@Req() req: Request) {
    return this.custodiansService.getAssignedPapers(req.userId!);
  }

  @Get('me/shares')
  @Roles('CUSTODIAN')
  @ApiOperation({ summary: 'Get key share records assigned to authenticated custodian' })
  async getMyShares(@Req() req: Request) {
    return this.custodiansService.getMyShares(req.userId!);
  }
}

