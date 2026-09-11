import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategory, PaymentMethod } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ExpenseQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'বাড়ি আইডি (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'বাড়ির আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  propertyId?: string;

  @ApiPropertyOptional({ enum: ExpenseCategory, description: 'ক্যাটাগরি' })
  @IsOptional()
  @IsEnum(ExpenseCategory, { message: 'সঠিক খরচের ক্যাটাগরি দিন' })
  category?: ExpenseCategory;

  @ApiPropertyOptional({ enum: PaymentMethod, description: 'পেমেন্ট মেথড' })
  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'সঠিক পেমেন্ট মেথড নির্বাচন করুন' })
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ description: 'তারিখ থেকে' })
  @IsOptional()
  @IsDateString({}, { message: 'সঠিক তারিখ দিন' })
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'তারিখ পর্যন্ত' })
  @IsOptional()
  @IsDateString({}, { message: 'সঠিক তারিখ দিন' })
  dateTo?: string;
}
