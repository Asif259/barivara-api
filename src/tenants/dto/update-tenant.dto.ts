import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

const trimEmptyToUndefined = ({ value }: { value: any }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'কামাল হোসেন' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '01812345678' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  @Matches(/^(?:\+8801|01)[3-9]\d{8}$/, { message: 'সঠিক মোবাইল নম্বর দিন' })
  phone?: string;

  @ApiPropertyOptional({ example: 'kamal@example.com' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsEmail({}, { message: 'সঠিক ইমেইল দিন' })
  email?: string;

  @ApiPropertyOptional({ example: '1987654321098' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  nid?: string;

  @ApiPropertyOptional({ example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  nidImageId?: string;

  @ApiPropertyOptional({ example: 'গ্রাম: কৃষ্ণপুর, থানা: সদর, জেলা: বগুড়া' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  permanentAddress?: string;

  @ApiPropertyOptional({ example: 'রহিমা বেগম' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '01799887766' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ example: 'ব্যবসায়ী' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  occupation?: string;

  @ApiPropertyOptional({ example: 'নোট' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  notes?: string;
}
