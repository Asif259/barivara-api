import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderChannel, ReminderStatus, ReminderType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ReminderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'ভাড়াটিয়া আইডি' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'মাসিক ভাড়া আইডি' })
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
