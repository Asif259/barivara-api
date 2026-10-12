import { IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email or phone number registered with BariVara',
  })
  @IsString()
  @IsNotEmpty({ message: 'ইমেইল অথবা মোবাইল নম্বর প্রদান করুন' })
  identifier!: string;

  @ApiProperty({
    example: 'reset_token_xyz',
    description: 'Temporary reset authorization token returned from OTP verification',
  })
  @IsString({ message: 'রিসেট টোকেন একটি স্ট্রিং হতে হবে' })
  @IsNotEmpty({ message: 'রিসেট টোকেন প্রদান করুন' })
  resetToken!: string;

  @ApiProperty({ example: 'NewSecurePassword123' })
  @IsString()
  @IsNotEmpty({ message: 'নতুন পাসওয়ার্ড প্রদান করুন' })
  @MinLength(8, { message: 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'Password must contain uppercase, lowercase, and numbers/special characters',
  })
  newPassword!: string;

  @ApiProperty({ example: 'NewSecurePassword123' })
  @IsString()
  @IsNotEmpty({ message: 'নিশ্চিতকরণ পাসওয়ার্ড প্রদান করুন' })
  confirmPassword!: string;
}
