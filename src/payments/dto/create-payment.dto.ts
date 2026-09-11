import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
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

export class CreatePaymentDto {
  @ApiProperty({ example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb', description: 'মাসিক ভাড়ার আইডি (UUID)' })
  @IsUUID('4', { message: 'মাসিক ভাড়ার আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  @IsNotEmpty({ message: 'মাসিক ভাড়া নির্বাচন আবশ্যক' })
  monthlyRentId: string;

  @ApiProperty({ example: 20000, description: 'পরিশোধিত টাকার পরিমাণ (০ এর বেশি)' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive({ message: 'পেমেন্টের পরিমাণ ০ এর বেশি হতে হবে' })
  amount: number;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CASH, description: 'পেমেন্ট মেথড' })
  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'সঠিক পেমেন্ট মেথড নির্বাচন করুন' })
  paymentMethod?: PaymentMethod = PaymentMethod.CASH;

  @ApiPropertyOptional({ example: 'BKASH-TX-987654321', description: 'ট্রানজেকশন আইডি (ঐচ্ছিক)' })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({ example: '2026-09-05T10:00:00.000Z', description: 'পেমেন্টের তারিখ' })
  @IsOptional()
  @IsDateString({}, { message: 'সঠিক পেমেন্টের তারিখ দিন' })
  paymentDate?: string;

  @ApiPropertyOptional({ example: 'সেপ্টেম্বর মাসের আংশিক ভাড়া', description: 'নোট বা মন্তব্য' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 'ম্যানেজার', description: 'পেমেন্ট গ্রহণকারীর নাম' })
  @IsOptional()
  @IsString()
  receivedBy?: string;
}
