import { ApiPropertyOptional } from '@nestjs/swagger';
import { AgreementStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class RentalAgreementQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'বাড়ি আইডি' })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'ইউনিট আইডি' })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional({ description: 'ভাড়াটিয়া আইডি' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ enum: AgreementStatus, description: 'চুক্তির অবস্থা' })
  @IsOptional()
  @IsEnum(AgreementStatus)
  status?: AgreementStatus;
}
