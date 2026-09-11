import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategory, PaymentMethod } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ExpenseQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'বাড়ি আইডি' })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({ enum: ExpenseCategory, description: 'ক্যাটাগরি' })
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @ApiPropertyOptional({ enum: PaymentMethod, description: 'পেমেন্ট মেথড' })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'তারিখ থেকে' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'তারিখ পর্যন্ত' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
