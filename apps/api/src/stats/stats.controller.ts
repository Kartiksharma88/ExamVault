import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipCsrf } from '../auth/auth.guard';
import { StatsService } from './stats.service';

@ApiTags('Statistics')
@Controller('stats')
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Get('bank')
  @SkipCsrf()
  @ApiOperation({ summary: 'Get question bank statistics (metadata only)' })
  async getBankStatistics() {
    const stats = await this.statsService.getBankStatistics();
    return { success: true, data: stats };
  }
}
