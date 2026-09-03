import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UnitsService } from './units.service';
import { BulkCreateUnitsDto, CreateUnitDto, UpdateUnitDto } from './dto/create-unit.dto';
import { UnitFilterDto } from './dto/unit-filter.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import {
  StandardSuccessResponseDto,
  StandardErrorResponseDto,
} from '../common/dto/api-response.dto';

@ApiTags('Units')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @Post('properties/:propertyId/units')
  @ApiOperation({ summary: 'নির্দিষ্ট বাড়িতে নতুন ইউনিট যোগ করুন' })
  @ApiResponse({ status: 201, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 400, type: StandardErrorResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param('propertyId') propertyId: string,
    @Body() createUnitDto: CreateUnitDto,
  ) {
    return this.unitsService.create(user.id, propertyId, createUnitDto);
  }

  @Post('properties/:propertyId/units/bulk')
  @ApiOperation({ summary: 'একটি তলায় একসাথে একাধিক ইউনিট যোগ করুন' })
  @ApiResponse({ status: 201, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 400, type: StandardErrorResponseDto })
  @ApiResponse({ status: 403, type: StandardErrorResponseDto })
  bulkCreate(
    @CurrentUser() user: CurrentUserPayload,
    @Param('propertyId') propertyId: string,
    @Body() dto: BulkCreateUnitsDto,
  ) {
    return this.unitsService.bulkCreate(user.id, propertyId, dto);
  }

  @Get('properties/:propertyId/units')
  @ApiOperation({ summary: 'নির্দিষ্ট বাড়ির ইউনিটসমূহের তালিকা দেখুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  findByProperty(
    @CurrentUser() user: CurrentUserPayload,
    @Param('propertyId') propertyId: string,
    @Query() query: UnitFilterDto,
  ) {
    return this.unitsService.findByProperty(user.id, propertyId, query);
  }

  @Get('units/:id')
  @ApiOperation({ summary: 'নির্দিষ্ট ইউনিটের বিস্তারিত তথ্য দেখুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.unitsService.findOne(user.id, id);
  }

  @Patch('units/:id')
  @ApiOperation({ summary: 'ইউনিটের তথ্য হালনাগাদ করুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() updateUnitDto: UpdateUnitDto,
  ) {
    return this.unitsService.update(user.id, id, updateUnitDto);
  }

  @Delete('units/:id')
  @ApiOperation({ summary: 'ইউনিট মুছে ফেলুন (সফট ডিলিট)' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.unitsService.remove(user.id, id);
  }
}
