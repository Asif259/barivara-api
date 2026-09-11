import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MonthlyRentsService } from './monthly-rents.service';
import {
  CreateMonthlyRentDto,
  GenerateMonthlyRentDto,
  UpdateMonthlyRentDto,
  MonthlyRentQueryDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import {
  StandardSuccessResponseDto,
  StandardErrorResponseDto,
} from '../common/dto/api-response.dto';

@ApiTags('Monthly Rents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('monthly-rents')
export class MonthlyRentsController {
  constructor(private readonly monthlyRentsService: MonthlyRentsService) {}

  @Post('generate')
  @ApiOperation({ summary: 'নির্দিষ্ট মাস ও সালের জন্য স্বয়ংক্রিয় ভাড়া জেনারেট করুন' })
  @ApiResponse({ status: 201, type: StandardSuccessResponseDto })
  generate(
    @CurrentUser() user: CurrentUserPayload,
    @Body() generateDto: GenerateMonthlyRentDto,
  ) {
    return this.monthlyRentsService.generate(user.id, generateDto);
  }

  @Post()
  @ApiOperation({ summary: 'নির্দিষ্ট চুক্তির জন্য ম্যানুয়ালি মাসিক ভাড়ার বিল তৈরি করুন' })
  @ApiResponse({ status: 201, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 400, type: StandardErrorResponseDto })
  @ApiResponse({ status: 409, type: StandardErrorResponseDto })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createDto: CreateMonthlyRentDto,
  ) {
    return this.monthlyRentsService.create(user.id, createDto);
  }

  @Get('outstanding')
  @ApiOperation({ summary: 'সকল বকেয়া ও মেয়াদোত্তীর্ণ ভাড়ার তালিকা দেখুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  findOutstanding(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: MonthlyRentQueryDto,
  ) {
    return this.monthlyRentsService.findOutstanding(user.id, query);
  }

  @Get()
  @ApiOperation({ summary: 'মাসিক ভাড়ার তালিকা ফিল্টার ও সার্চ করুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: MonthlyRentQueryDto,
  ) {
    return this.monthlyRentsService.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'নির্দিষ্ট মাসিক ভাড়ার বিস্তারিত তথ্য ও পেমেন্ট হিস্ট্রি দেখুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.monthlyRentsService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'মাসিক ভাড়ার পরিমাণ বা চার্জ হালনাগাদ করুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateMonthlyRentDto,
  ) {
    return this.monthlyRentsService.update(user.id, id, updateDto);
  }

  @Post(':id/calculate-status')
  @ApiOperation({ summary: 'মাসিক ভাড়ার স্ট্যাটাস পুনঃগণনা করুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  recalculateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.monthlyRentsService.recalculateStatus(user.id, id);
  }
}
