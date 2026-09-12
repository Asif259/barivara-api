import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseCategory, PaymentMethod } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpenseDto {
  @ApiProperty({ example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb', description: 'বাড়ি আইডি (UUID)' })
  @IsUUID('4', { message: 'বাড়ির আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  @IsNotEmpty({ message: 'বাড়ি নির্বাচন আবশ্যক' })
  propertyId: string;

  @ApiProperty({ enum: ExpenseCategory, example: ExpenseCategory.ELECTRICITY, description: 'খরচের খাত' })
  @IsEnum(ExpenseCategory, { message: 'সঠিক খরচের ক্যাটাগরি দিন' })
  category: ExpenseCategory;

  @ApiProperty({ example: 4500, description: 'খরচের পরিমাণ (টাকা, ০ এর বেশি)' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: 'খরচের পরিমাণ ০ এর বেশি হতে হবে' })
  amount: number;

  @ApiPropertyOptional({ example: '2026-09-02T10:00:00.000Z', description: 'খরচের তারিখ' })
  @IsOptional()
  @IsDateString({}, { message: 'সঠিক খরচের তারিখ দিন' })
  expenseDate?: string;

  @ApiPropertyOptional({ example: 'আগস্ট মাসের কমন বিদ্যুৎ বিল', description: 'বিবরণ' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH, description: 'পেমেন্ট মেথড' })
  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'সঠিক পেমেন্ট মেথড নির্বাচন করুন' })
  paymentMethod?: PaymentMethod = PaymentMethod.CASH;

  @ApiPropertyOptional({ example: 'DESCO-BILL-88271', description: 'ভাউচার বা রেফারেন্স নম্বর' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ example: 'ম্যানেজার করিম', description: 'খরচকারীর নাম' })
  @IsOptional()
  @IsString()
  createdBy?: string;

  @ApiPropertyOptional({ example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb', description: 'ভাউচার বা রসিদের ফাইল আইডি (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'রসিদের ফাইল আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  receiptFileId?: string;
}
