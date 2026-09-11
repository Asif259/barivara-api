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
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ExpensesService } from './expenses.service';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  ExpenseQueryDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import {
  StandardSuccessResponseDto,
  StandardErrorResponseDto,
} from '../common/dto/api-response.dto';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @ApiOperation({ summary: 'নতুন খরচ যুক্ত করুন' })
  @ApiResponse({ status: 201, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 400, type: StandardErrorResponseDto })
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() createExpenseDto: CreateExpenseDto,
  ) {
    return this.expensesService.create(user.id, createExpenseDto);
  }

  @Get()
  @ApiOperation({ summary: 'খরচের তালিকা ও মোট হিসাব দেখুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ExpenseQueryDto,
  ) {
    return this.expensesService.findAll(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'নির্দিষ্ট খরচের বিস্তারিত দেখুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.expensesService.findOne(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'খরচের তথ্য হালনাগাদ করুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateExpenseDto: UpdateExpenseDto,
  ) {
    return this.expensesService.update(user.id, id, updateExpenseDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'খরচের রেকর্ড মুছে ফেলুন (সফট ডিলিট)' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 404, type: StandardErrorResponseDto })
  remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.expensesService.remove(user.id, id);
  }
}
