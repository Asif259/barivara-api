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

export class CreateExpenseDto {
  @ApiProperty({ example: 'property-uuid', description: 'বাড়ি আইডি' })
  @IsString()
  @IsNotEmpty({ message: 'বাড়ি নির্বাচন আবশ্যক' })
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

// Backward-compatible re-exports — these classes now live in dedicated files
// but any existing import from this path continues to work unchanged.
export { UpdateExpenseDto } from './update-expense.dto';
export { ExpenseQueryDto } from './expense-query.dto';
