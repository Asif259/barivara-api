import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreatePropertyDto {
  @ApiProperty({ example: 'গ্রিন ভিউ ভিলা', description: 'বাড়ির নাম' })
  @IsString()
  @IsNotEmpty({ message: 'বাড়ির নাম আবশ্যক' })
  name: string;

  @ApiProperty({ example: 'বাড়ি # ১২, রোড # ৪, ধানমন্ডি, ঢাকা', description: 'ঠিকানা' })
  @IsString()
  @IsNotEmpty({ message: 'ঠিকানা আবশ্যক' })
  address: string;

  @ApiPropertyOptional({ example: 'ঢাকা', description: 'শহর' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'ঢাকা', description: 'জেলা' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: '১২০৫', description: 'পোস্টাল কোড' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: '৬ তলা বিশিষ্ট আবাসিক ভবন', description: 'বিবরণ' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 6, default: 1, description: 'মোট তলা সংখ্যা' })
  @IsOptional()
  @IsInt({ message: 'তলা সংখ্যা অবশ্যই পূর্ণসংখ্যা হতে হবে' })
  @Min(1, { message: 'তলা সংখ্যা কমপক্ষে ১ হতে হবে' })
  totalFloors?: number = 1;
}

export class UpdatePropertyDto {
  @ApiPropertyOptional({ example: 'গ্রিন ভিউ ভিলা' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'বাড়ি # ১২, রোড # ৪, ধানমন্ডি, ঢাকা' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'ঢাকা' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'ঢাকা' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ example: '১২০৫' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: '৬ তলা বিশিষ্ট আবাসিক ভবন' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalFloors?: number;
}
