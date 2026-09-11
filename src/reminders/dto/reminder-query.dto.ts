import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderChannel, ReminderStatus, ReminderType } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ReminderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'ভাড়াটিয়া আইডি (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'ভাড়াটিয়ার আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  tenantId?: string;

  @ApiPropertyOptional({ description: 'মাসিক ভাড়া আইডি (UUID)' })
  @IsOptional()
  @IsUUID('4', { message: 'মাসিক ভাড়ার আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  monthlyRentId?: string;

  @ApiPropertyOptional({ enum: ReminderType, description: 'রিমাইন্ডারের ধরন' })
  @IsOptional()
  @IsEnum(ReminderType, { message: 'সঠিক রিমাইন্ডারের ধরন নির্বাচন করুন' })
  type?: ReminderType;

  @ApiPropertyOptional({ enum: ReminderStatus, description: 'রিমাইন্ডারের অবস্থা' })
  @IsOptional()
  @IsEnum(ReminderStatus, { message: 'সঠিক রিমাইন্ডারের অবস্থা নির্বাচন করুন' })
  status?: ReminderStatus;

  @ApiPropertyOptional({ enum: ReminderChannel, description: 'রিমাইন্ডার চ্যানেল' })
  @IsOptional()
  @IsEnum(ReminderChannel, { message: 'সঠিক রিমাইন্ডার চ্যানেল নির্বাচন করুন' })
  channel?: ReminderChannel;
}
