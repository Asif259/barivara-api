import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { StandardSuccessResponseDto } from '../common/dto/api-response.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'ড্যাশবোর্ড ওভারভিউ পরিসংখ্যান দেখুন' })
  @ApiQuery({ name: 'propertyId', required: false, description: 'বাড়ি আইডি (ঐচ্ছিক)' })
  @ApiQuery({ name: 'year', required: false, description: 'সাল (ডিফল্ট বর্তমান সাল)' })
  @ApiQuery({ name: 'month', required: false, description: 'মাস (ডিফল্ট বর্তমান মাস)' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  getOverview(
    @CurrentUser() user: CurrentUserPayload,
    @Query('propertyId') propertyId?: string,
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    return this.dashboardService.getOverview(
      user.id,
      propertyId,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }
}
