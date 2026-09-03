import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderChannel, ReminderStatus, ReminderType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class CreateReminderDto {
  @ApiProperty({ example: 'tenant-uuid', description: 'ভাড়াটিয়া আইডি' })
  @IsString()
  @IsNotEmpty({ message: 'ভাড়াটিয়া আবশ্যক' })
  tenantId: string;

  @ApiPropertyOptional({ example: 'rent-uuid', description: 'মাসিক ভাড়া আইডি' })
  @IsOptional()
  @IsString()
  monthlyRentId?: string;

  @ApiPropertyOptional({ enum: ReminderType, default: ReminderType.UPCOMING_DUE, description: 'রিমাইন্ডারের ধরন' })
  @IsOptional()
  @IsEnum(ReminderType)
  type?: ReminderType = ReminderType.UPCOMING_DUE;

  @ApiPropertyOptional({ enum: ReminderChannel, default: ReminderChannel.IN_APP, description: 'রিমাইন্ডার পাঠানোর মাধ্যম' })
  @IsOptional()
  @IsEnum(ReminderChannel)
  channel?: ReminderChannel = ReminderChannel.IN_APP;

  @ApiProperty({ example: '2026-09-03T09:00:00.000Z', description: 'রিমাইন্ডার পাঠানোর নির্ধারিত সময়' })
  @IsDateString({}, { message: 'সঠিক তারিখ/সময় দিন' })
  scheduledAt: string;

  @ApiProperty({ example: 'আপনার চলতি সেপ্টেম্বর মাসের ভাড়া প্রদানের শেষ সময় আগামী ৫ সেপ্টেম্বর।', description: 'বার্তা' })
  @IsString()
  @IsNotEmpty({ message: 'মেসেজ টেক্সট আবশ্যক' })
  message: string;
}

export class UpdateReminderDto {
  @ApiPropertyOptional({ enum: ReminderStatus })
  @IsOptional()
  @IsEnum(ReminderStatus)
  status?: ReminderStatus;

  @ApiPropertyOptional({ example: '2026-09-03T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ example: 'হালনাগাদ করা বার্তা' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class ReminderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'ভাড়াটিয়া আইডি' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'মাসিক ভাড়া আইডি' })
  @IsOptional()
  @IsString()
  monthlyRentId?: string;

  @ApiPropertyOptional({ enum: ReminderType })
  @IsOptional()
  @IsEnum(ReminderType)
  type?: ReminderType;

  @ApiPropertyOptional({ enum: ReminderStatus })
  @IsOptional()
  @IsEnum(ReminderStatus)
  status?: ReminderStatus;

  @ApiPropertyOptional({ enum: ReminderChannel })
  @IsOptional()
  @IsEnum(ReminderChannel)
  channel?: ReminderChannel;
}
