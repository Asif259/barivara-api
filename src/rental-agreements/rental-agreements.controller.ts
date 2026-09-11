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
import { RentalAgreementsService } from './rental-agreements.service';
import {
  CreateRentalAgreementDto,
  UpdateRentalAgreementDto,
  RentalAgreementQueryDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import {
  StandardSuccessResponseDto,
  StandardErrorResponseDto,
} from '../common/dto/api-response.dto';

@ApiTags('Rental Agreements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rental-agreements')
export class RentalAgreementsController {
  constructor(
    private readonly rentalAgreementsService: RentalAgreementsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'নতুন ভাড়া চুক্তি তৈরি করুন' })
  @ApiResponse({ status: 201, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 400, type: StandardErrorResponseDto })
  @ApiResponse({ status: 409, type: StandardErrorResponseDto })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createRentalAgreementDto: CreateRentalAgreementDto,
  ) {
    return this.rentalAgreementsService.create(user.id, createRentalAgreementDto);
  }

  @Get()
  @ApiOperation({ summary: 'চুক্তিসমূহের তালিকা দেখুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: RentalAgreementQueryDto,
  ) {
    return this.rentalAgreementsService.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'নির্দিষ্ট চুক্তির বিস্তারিত তথ্য দেখুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.rentalAgreementsService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'চুক্তির শর্তাবলী বা তথ্য পরিবর্তন করুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRentalAgreementDto: UpdateRentalAgreementDto,
  ) {
    return this.rentalAgreementsService.update(
      user.id,
      id,
      updateRentalAgreementDto,
    );
  }

  @Post(':id/end')
  @ApiOperation({ summary: 'চুক্তি সমাপ্ত করুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  end(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('endDate') endDate?: string,
  ) {
    return this.rentalAgreementsService.end(user.id, id, endDate);
  }
}
