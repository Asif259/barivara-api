import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

const trimEmptyToUndefined = ({ value }: { value: any }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class CreateTenantDto {
  @ApiProperty({ example: 'কামাল হোসেন', description: 'ভাড়াটিয়ার পুরো নাম' })
  @IsString()
  @IsNotEmpty({ message: 'ভাড়াটিয়ার নাম আবশ্যক' })
  name: string;

  @ApiPropertyOptional({ example: '01812345678', description: 'মোবাইল নম্বর' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  @Matches(/^(?:\+8801|01)[3-9]\d{8}$/, { message: 'সঠিক মোবাইল নম্বর দিন (যেমন: 018XXXXXXXX)' })
  phone?: string;

  @ApiPropertyOptional({ example: 'kamal@example.com', description: 'ইমেইল' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsEmail({}, { message: 'সঠিক ইমেইল দিন' })
  email?: string;

  @ApiPropertyOptional({ example: '1987654321098', description: 'জাতীয় পরিচয়পত্র নম্বর (NID)' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  nid?: string;

  @ApiPropertyOptional({ example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb', description: 'NID কার্ডের ছবির ফাইল আইডি (UUID)' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  nidImageId?: string;

  @ApiPropertyOptional({ example: 'গ্রাম: কৃষ্ণপুর, থানা: সদর, জেলা: বগুড়া', description: 'স্থায়ী ঠিকানা' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  permanentAddress?: string;

  @ApiPropertyOptional({ example: 'রহিমা বেগম', description: 'জরুরি যোগাযোগের ব্যক্তির নাম' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '01799887766', description: 'জরুরি যোগাযোগের ফোন নম্বর' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ example: 'ব্যবসায়ী / সরকারি কর্মকর্তা / বেসরকারি চাকরি', description: 'পেশা' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  occupation?: string;

  @ApiPropertyOptional({ example: 'ফ্যামিলি ৪ জন সদস্য', description: 'অন্যান্য তথ্য বা নোট' })
  @IsOptional()
  @Transform(trimEmptyToUndefined)
  @IsString()
  notes?: string;
}

export { UpdateTenantDto } from './update-tenant.dto';

