import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategory, PaymentMethod } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateExpenseDto {
  @ApiProperty({ example: 'property-uuid', description: 'বাড়ি আইডি' })
  @IsString()
  @IsNotEmpty({ message: 'বাড়ি নির্বাচন আবশ্যক' })
  propertyId: string;

  @ApiProperty({ enum: ExpenseCategory, example: ExpenseCategory.ELECTRICITY, description: 'খরচের খাত' })
  @IsEnum(ExpenseCategory, { message: 'সঠিক খরচের ক্যাটাগরি দিন' })
  category: ExpenseCategory;

  @ApiProperty({ example: 4500, description: 'খরচের পরিমাণ (টাকা)' })
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'খরচের পরিমাণ ০ এর বেশি হতে হবে' })
  amount: number;

  @ApiPropertyOptional({ example: '2026-09-02T10:00:00.000Z', description: 'খরচের তারিখ' })
  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @ApiPropertyOptional({ example: 'আগস্ট মাসের কমন বিদ্যুৎ বিল', description: 'বিবরণ' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH, description: 'পেমেন্ট মেথড' })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod = PaymentMethod.CASH;

  @ApiPropertyOptional({ example: 'DESCO-BILL-88271', description: 'ভাউচার বা রেফারেন্স নম্বর' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ example: 'ম্যানেজার করিম', description: 'খরচকারীর নাম' })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiPropertyOptional({ example: 'file-uuid', description: 'ভাউচার বা রশিদের ফাইল আইডি' })
  @IsOptional()
  @IsString()
  receiptFileId?: string;
}

export class UpdateExpenseDto {
  @ApiPropertyOptional({ enum: ExpenseCategory })
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount?: number;

  @ApiPropertyOptional({ example: '2026-09-02T10:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @ApiPropertyOptional({ example: 'বিদ্যুৎ বিল সংশোধিত' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: 'BILL-REF-123' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ example: 'file-uuid' })
  @IsOptional()
  @IsString()
  receiptFileId?: string;
}

export class ExpenseQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'বাড়ি আইডি' })
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
