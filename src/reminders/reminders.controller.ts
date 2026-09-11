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
import { RemindersService } from './reminders.service';
import {
  CreateReminderDto,
  UpdateReminderDto,
  ReminderQueryDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import {
  StandardSuccessResponseDto,
  StandardErrorResponseDto,
} from '../common/dto/api-response.dto';

@ApiTags('Reminders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post()
  @ApiOperation({ summary: 'নতুন রিমাইন্ডার তৈরি করুন' })
  @ApiResponse({ status: 201, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 400, type: StandardErrorResponseDto })
  @ApiResponse({ status: 409, type: StandardErrorResponseDto })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createReminderDto: CreateReminderDto,
  ) {
    return this.remindersService.create(user.id, createReminderDto);
  }

  @Get()
  @ApiOperation({ summary: 'রিমাইন্ডারের তালিকা দেখুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ReminderQueryDto,
  ) {
    return this.remindersService.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'নির্দিষ্ট রিমাইন্ডারের তথ্য দেখুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.remindersService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'রিমাইন্ডারের তথ্য হালনাগাদ করুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReminderDto: UpdateReminderDto,
  ) {
    return this.remindersService.update(user.id, id, updateReminderDto);
  }

  @Post(':id/send')
  @ApiOperation({ summary: 'রিমাইন্ডার পাঠানোর অবস্থা চিহ্নিত করুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  send(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.remindersService.send(user.id, id);
  }
}
