import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { StandardSuccessResponseDto } from '../common/dto/api-response.dto';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('monthly')
  @ApiOperation({ summary: 'মাসিক সমন্বিত প্রতিবেদন দেখুন (আয়, ব্যয়, বকেয়া)' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  getMonthlyReport(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: MonthlyReportQueryDto,
  ) {
    return this.reportsService.getMonthlyReport(
      user.id,
      query.year,
      query.month,
      query.propertyId,
    );
  }

  @Get('monthly/export')
  @ApiOperation({ summary: 'মাসিক প্রতিবেদন CSV ফাইল আকারে ডাউনলোড করুন' })
  async exportMonthlyReport(
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
    @Query() query: MonthlyReportQueryDto,
  ) {
    const csvContent = await this.reportsService.exportMonthlyReportCsv(
      user.id,
      query.year,
      query.month,
      query.propertyId,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="barivara_monthly_report_${query.year || 'current'}_${query.month || 'current'}.csv"`,
    );
    return res.send(csvContent);
  }

  @Get('tenants/:tenantId/statement')
  @ApiOperation({ summary: 'নির্দিষ্ট ভাড়াটিয়ার সম্পূর্ণ পেমেন্ট স্টেটমেন্ট দেখুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  getTenantStatement(
    @CurrentUser() user: CurrentUserPayload,
    @Param('tenantId') tenantId: string,
  ) {
    return this.reportsService.getTenantStatement(user.id, tenantId);
  }

  @Get('properties/:propertyId/financial')
  @ApiOperation({ summary: 'নির্দিষ্ট বাড়ির সামগ্রিক আর্থিক প্রতিবেদন দেখুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  getPropertyFinancial(
    @CurrentUser() user: CurrentUserPayload,
    @Param('propertyId') propertyId: string,
  ) {
    return this.reportsService.getPropertyFinancial(user.id, propertyId);
  }
}
