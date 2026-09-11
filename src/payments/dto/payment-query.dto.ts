import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class PaymentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'মাসিক ভাড়া আইডি' })
  @IsOptional()
  @IsString()
  monthlyRentId?: string;

  @ApiPropertyOptional({ description: 'বাড়ি আইডি' })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'ভাড়াটিয়া আইডি' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ enum: PaymentMethod, description: 'পেমেন্ট মেথড' })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ enum: PaymentStatus, description: 'পেমেন্টের অবস্থা (COMPLETED, REVERSED)' })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({ description: 'তারিখ থেকে' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'তারিখ পর্যন্ত' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
