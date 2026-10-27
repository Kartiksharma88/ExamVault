import { Controller, Get, Post, Delete, Param, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../auth/auth.guard';
import { ConflictsService } from './conflicts.service';
import { ConflictDeclarationSchema } from '@examvault/shared';

@ApiTags('Conflicts')
@Controller('conflicts')
export class ConflictsController {
  constructor(private conflictsService: ConflictsService) {}

  @Get()
  @Roles('EXAMINER', 'REVIEWER', 'MODERATOR')
  @ApiOperation({ summary: 'List current user conflict declarations' })
  async getMyConflicts(@Req() req: Request) {
    const list = await this.conflictsService.listUserConflicts(req.userId!);
    return { success: true, data: list };
  }

  @Post()
  @Roles('EXAMINER', 'REVIEWER', 'MODERATOR')
  @ApiOperation({ summary: 'Declare a conflict of interest (institution, coaching centre, person)' })
  async declareConflict(@Body() body: any, @Req() req: Request) {
    const parsed = ConflictDeclarationSchema.parse(body);
    const result = await this.conflictsService.declareConflict(parsed, req.userId!);
    return { success: true, data: result };
  }

  @Delete(':id')
  @Roles('EXAMINER', 'REVIEWER', 'MODERATOR')
  @ApiOperation({ summary: 'Delete a conflict of interest declaration' })
  async deleteConflict(@Param('id') id: string, @Req() req: Request) {
    const result = await this.conflictsService.deleteConflict(id, req.userId!);
    return { success: true, data: result };
  }
}
