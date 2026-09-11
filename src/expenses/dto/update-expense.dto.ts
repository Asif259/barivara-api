import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategory, PaymentMethod } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateExpenseDto {
  @ApiPropertyOptional({ enum: ExpenseCategory })
  @IsOptional()
  @IsEnum(ExpenseCategory, { message: 'সঠিক খরচের ক্যাটাগরি দিন' })
  category?: ExpenseCategory;

  @ApiPropertyOptional({ example: 5000, description: 'খরচের পরিমাণ (টাকা, ০ এর বেশি)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: 'খরচের পরিমাণ ০ এর বেশি হতে হবে' })
  amount?: number;

  @ApiPropertyOptional({ example: '2026-09-02T10:00:00.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'সঠিক খরচের তারিখ দিন' })
  expenseDate?: string;

  @ApiPropertyOptional({ example: 'বিদ্যুৎ বিল সংশোধিত' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'সঠিক পেমেন্ট মেথড নির্বাচন করুন' })
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ example: 'BILL-REF-123' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb', description: 'রশিদের ফাইল আইডি (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'রশিদের ফাইল আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  receiptFileId?: string;
}
