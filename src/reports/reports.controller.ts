import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { StandardSuccessResponseDto } from '../common/dto/api-response.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('monthly')
  @ApiOperation({ summary: 'মাসিক সমন্বিত প্রতিবেদন দেখুন (আয়, ব্যয়, বকেয়া)' })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'propertyId', required: false })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  getMonthlyReport(
    @CurrentUser() user: CurrentUserPayload,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('propertyId') propertyId?: string,
  ) {
    return this.reportsService.getMonthlyReport(
      user.id,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
      propertyId,
    );
  }

  @Get('monthly/export')
  @ApiOperation({ summary: 'মাসিক প্রতিবেদন CSV ফাইল আকারে ডাউনলোড করুন' })
  @ApiQuery({ name: 'year', required: false })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'propertyId', required: false })
  async exportMonthlyReport(
    @CurrentUser() user: CurrentUserPayload,
    @Res() res: Response,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('propertyId') propertyId?: string,
  ) {
    const csvContent = await this.reportsService.exportMonthlyReportCsv(
      user.id,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
      propertyId,
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="barivara_monthly_report_${year || 'current'}_${month || 'current'}.csv"`,
    );
    return res.send(csvContent);
  }

  @Get('tenants/:tenantId/statement')
  @ApiOperation({ summary: 'নির্দিষ্ট ভাড়াটিয়ার সম্পূর্ণ পেমেন্ট স্টেটমেন্ট দেখুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  getTenantStatement(
    @CurrentUser() user: CurrentUserPayload,
    @Param('tenantId') tenantId: string,
  ) {
    return this.reportsService.getTenantStatement(user.id, tenantId);
  }

  @Get('properties/:propertyId/financial')
  @ApiOperation({ summary: 'নির্দিষ্ট বাড়ির সামগ্রিক আর্থিক প্রতিবেদন দেখুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  getPropertyFinancial(
    @CurrentUser() user: CurrentUserPayload,
    @Param('propertyId') propertyId: string,
  ) {
    return this.reportsService.getPropertyFinancial(user.id, propertyId);
  }
}
