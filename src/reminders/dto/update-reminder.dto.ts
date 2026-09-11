import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

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
