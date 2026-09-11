import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { StandardSuccessResponseDto } from '../common/dto/api-response.dto';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'ড্যাশবোর্ড ওভারভিউ পরিসংখ্যান দেখুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  getOverview(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: DashboardOverviewQueryDto,
  ) {
    return this.dashboardService.getOverview(
      user.id,
      query.propertyId,
      query.year,
      query.month,
    );
  }
}
