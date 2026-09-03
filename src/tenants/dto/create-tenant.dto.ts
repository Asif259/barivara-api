import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'কামাল হোসেন', description: 'ভাড়াটিয়ার পুরো নাম' })
  @IsString()
  @IsNotEmpty({ message: 'ভাড়াটিয়ার নাম আবশ্যক' })
  name: string;

  @ApiProperty({ example: '01812345678', description: 'মোবাইল নম্বর' })
  @IsString()
  @IsNotEmpty({ message: 'মোবাইল নম্বর আবশ্যক' })
  @Matches(/^(?:\+8801|01)[3-9]\d{8}$/, { message: 'সঠিক মোবাইল নম্বর দিন (যেমন: 018XXXXXXXX)' })
  phone: string;

  @ApiPropertyOptional({ example: 'kamal@example.com', description: 'ইমেইল' })
  @IsOptional()
  @IsEmail({}, { message: 'সঠিক ইমেইল দিন' })
  email?: string;

  @ApiPropertyOptional({ example: '1987654321098', description: 'জাতীয় পরিচয়পত্র নম্বর (NID)' })
  @IsOptional()
  @IsString()
  nid?: string;

  @ApiPropertyOptional({ example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb', description: 'NID কার্ডের ছবির ফাইল আইডি (UUID)' })
  @IsOptional()
  @IsString()
  nidImageId?: string;

  @ApiPropertyOptional({ example: 'গ্রাম: কৃষ্ণপুর, থানা: সদর, জেলা: বগুড়া', description: 'স্থায়ী ঠিকানা' })
  @IsOptional()
  @IsString()
  permanentAddress?: string;

  @ApiPropertyOptional({ example: 'রহিমা বেগম', description: 'জরুরি যোগাযোগের ব্যক্তির নাম' })
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '01799887766', description: 'জরুরি যোগাযোগের ফোন নম্বর' })
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ example: 'ব্যবসায়ী / সরকারি কর্মকর্তা / বেসরকারি চাকরি', description: 'পেশা' })
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional({ example: 'ফ্যামিলি ৪ জন সদস্য', description: 'অন্যান্য তথ্য বা নোট' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'কামাল হোসেন' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '01812345678' })
  @IsOptional()
  @IsString()
  @Matches(/^(?:\+8801|01)[3-9]\d{8}$/, { message: 'সঠিক মোবাইল নম্বর দিন' })
  phone?: string;

  @ApiPropertyOptional({ example: 'kamal@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '1987654321098' })
  @IsOptional()
  @IsString()
  nid?: string;

  @ApiPropertyOptional({ example: 'a7043104-5dce-4969-a8bc-c33ff894bbbb' })
  @IsOptional()
  @IsString()
  nidImageId?: string;

  @ApiPropertyOptional({ example: 'গ্রাম: কৃষ্ণপুর, থানা: সদর, জেলা: বগুড়া' })
  @IsOptional()
  @IsString()
  permanentAddress?: string;

  @ApiPropertyOptional({ example: 'রহিমা বেগম' })
  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: '01799887766' })
  @IsOptional()
  @IsString()
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ example: 'ব্যবসায়ী' })
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional({ example: 'নোট' })
  @IsOptional()
  @IsString()
  notes?: string;
}
