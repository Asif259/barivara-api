import { ApiPropertyOptional } from '@nestjs/swagger';
import { AgreementStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class RentalAgreementQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'বাড়ি আইডি' })
  @IsOptional()
  @IsUUID('4', { message: 'বাড়ির আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  propertyId?: string;

  @ApiPropertyOptional({ description: 'ইউনিট আইডি' })
  @IsOptional()
  @IsUUID('4', { message: 'ইউনিটের আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  unitId?: string;

  @ApiPropertyOptional({ description: 'ভাড়াটিয়া আইডি' })
  @IsOptional()
  @IsUUID('4', { message: 'ভাড়াটিয়ার আইডি অবশ্যই একটি সঠিক UUID হতে হবে' })
  tenantId?: string;

  @ApiPropertyOptional({ enum: AgreementStatus, description: 'চুক্তির অবস্থা' })
  @IsOptional()
  @IsEnum(AgreementStatus, { message: 'সঠিক চুক্তির অবস্থা নির্বাচন করুন' })
  status?: AgreementStatus;
}
