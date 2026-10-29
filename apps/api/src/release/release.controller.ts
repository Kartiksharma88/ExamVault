import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthGuard, Roles } from '../auth/auth.guard';
import { ReleaseService } from './release.service';

@ApiTags('Release & Custodian Portal (Step 5)')
@Controller('release')
@UseGuards(AuthGuard)
export class ReleaseController {
  constructor(private readonly releaseService: ReleaseService) {}

  @Post('submit-share')
  @Roles('CUSTODIAN')
  @ApiOperation({ summary: 'Custodian submits unsealed plaintext key share (Time-Gated)' })
  async submitShare(
    @Body()
    body: {
      paperId: string;
      artifactType: 'PAPER' | 'ANSWER_KEY';
      sharePlaintext: string;
    },
    @Req() req: Request,
  ) {
    return this.releaseService.submitShare({
      paperId: body.paperId,
      custodianId: req.userId!,
      artifactType: body.artifactType,
      sharePlaintext: body.sharePlaintext,
    });
  }

  @Post('papers/:id/shares')
  @Roles('CUSTODIAN')
  @ApiOperation({ summary: 'Custodian submits unsealed plaintext key share for a paper' })
  async submitShareForPaper(
    @Param('id') paperId: string,
    @Body()
    body: {
      artifactType: 'PAPER' | 'ANSWER_KEY';
      sharePlaintext: string;
    },
    @Req() req: Request,
  ) {
    return this.releaseService.submitShare({
      paperId,
      custodianId: req.userId!,
      artifactType: body.artifactType,
      sharePlaintext: body.sharePlaintext,
    });
  }

  @Post('papers/:id/download-token')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Issue one-time download token (Authorizing Admins only, while RELEASED)' })
  async issueDownloadToken(
    @Param('id') paperId: string,
    @Body() body: { fileType: string },
    @Req() req: Request,
  ) {
    return this.releaseService.issueDownloadToken(paperId, req.userId!, body.fileType || 'PAPER_CSV');
  }

  @Get('papers/:id/download')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Stream released paper files using one-time token' })
  async downloadPaper(
    @Param('id') paperId: string,
    @Query('token') token: string,
    @Query('fileName') fileName: string,
    @Res() res: Response,
  ) {
    const file = await this.releaseService.getDownloadFile(paperId, token, fileName);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.send(file.content);
  }

  @Post('papers/:id/wipe')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Manually trigger retention wiping of plaintext paper cache' })
  async wipePaper(@Param('id') paperId: string) {
    return this.releaseService.wipePaper(paperId);
  }
}

