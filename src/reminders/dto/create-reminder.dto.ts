import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderChannel, ReminderType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateReminderDto {
  @ApiProperty({ example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb', description: 'ভাড়াটিয়া আইডি (UUID)' })
  @IsUUID('4', { message: 'ভাড়াটিয়ার আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  @IsNotEmpty({ message: 'ভাড়াটিয়া আবশ্যক' })
  tenantId: string;

  @ApiPropertyOptional({ example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb', description: 'মাসিক ভাড়া আইডি (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'মাসিক ভাড়ার আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  monthlyRentId?: string;

  @ApiPropertyOptional({ enum: ReminderType, default: ReminderType.UPCOMING_DUE, description: 'রিমাইন্ডারের ধরন' })
  @IsOptional()
  @IsEnum(ReminderType, { message: 'সঠিক রিমাইন্ডারের ধরন নির্বাচন করুন' })
  type?: ReminderType = ReminderType.UPCOMING_DUE;

  @ApiPropertyOptional({ enum: ReminderChannel, default: ReminderChannel.IN_APP, description: 'রিমাইন্ডার পাঠানোর মাধ্যম' })
  @IsOptional()
  @IsEnum(ReminderChannel, { message: 'সঠিক রিমাইন্ডার চ্যানেল নির্বাচন করুন' })
  channel?: ReminderChannel = ReminderChannel.IN_APP;

  @ApiProperty({ example: '2026-09-03T09:00:00.000Z', description: 'রিমাইন্ডার পাঠানোর নির্ধারিত সময়' })
  @IsDateString({}, { message: 'সঠিক তারিখ/সময় দিন' })
  scheduledAt: string;

  @ApiProperty({ example: 'আপনার চলতি সেপ্টেম্বর মাসের ভাড়া প্রদানের শেষ সময় আগামী ৫ সেপ্টেম্বর।', description: 'বার্তা' })
  @IsString()
  @IsNotEmpty({ message: 'মেসেজ টেক্সট আবশ্যক' })
  message: string;
}
