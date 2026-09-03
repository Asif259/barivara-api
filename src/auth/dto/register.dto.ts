import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Asif Chowdhury', description: 'ব্যবহারকারীর পুরো নাম' })
  @IsString()
  @IsNotEmpty({ message: 'নাম আবশ্যক' })
  @Length(2, 100, { message: 'নাম ২ থেকে ১০০ অক্ষরের মধ্যে হতে হবে' })
  name: string;

  @ApiPropertyOptional({ example: 'user@example.com', description: 'ইমেইল ঠিকানা' })
  @IsOptional()
  @IsEmail({}, { message: 'সঠিক ইমেইল ঠিকানা দিন' })
  email?: string;

  @ApiPropertyOptional({ example: '01712345678', description: 'বাংলাদেশী মোবাইল নম্বর' })
  @IsOptional()
  @IsString()
  @Matches(/^(?:\+8801|01)[3-9]\d{8}$/, { message: 'সঠিক বাংলাদেশী মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)' })
  phone?: string;

  @ApiProperty({ example: 'StrongPassword123', description: 'পাসওয়ার্ড (কমপক্ষে ৮ অক্ষর)' })
  @IsString()
  @IsNotEmpty({ message: 'পাসওয়ার্ড আবশ্যক' })
  @MinLength(8, { message: 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে' })
  password: string;

  @ApiPropertyOptional({ enum: Role, default: Role.OWNER, description: 'ব্যবহারকারীর ভূমিকা' })
  @IsOptional()
  @IsEnum(Role, { message: 'সঠিক ভূমিকা নির্বাচন করুন (OWNER, MANAGER, STAFF)' })
  role?: Role = Role.OWNER;
}
