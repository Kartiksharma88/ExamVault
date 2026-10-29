import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../auth/auth.guard';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@Roles('ADMIN')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user (ADMIN only)' })
  async create(
    @Body() body: { email: string; name: string; role: string; password: string; subjectIds?: string[] },
    @Req() req: Request,
  ) {
    const user = await this.usersService.create(body, req.userId!);
    return { success: true, data: user };
  }

  @Patch(':id/subjects')
  @ApiOperation({ summary: 'Assign subjects to user (ADMIN only)' })
  async assignSubjects(
    @Param('id') id: string,
    @Body() body: { subjectIds: string[] },
    @Req() req: Request,
  ) {
    const user = await this.usersService.assignSubjects(id, body.subjectIds || [], req.userId!);
    return { success: true, data: user };
  }

  @Get()
  @ApiOperation({ summary: 'List all users (ADMIN only)' })
  async findAll() {
    const users = await this.usersService.findAll();
    return { success: true, data: users };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (ADMIN only)' })
  async findById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return { success: true, data: user };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user (ADMIN only)' })
  async update(
    @Param('id') id: string,
    @Body() body: { name?: string; role?: string },
    @Req() req: Request,
  ) {
    const user = await this.usersService.update(id, body, req.userId!);
    return { success: true, data: user };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate user (ADMIN only)' })
  async deactivate(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.usersService.deactivate(id, req.userId!);
  }
}
