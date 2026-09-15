import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email or phone number registered with BariVara',
  })
  @IsString()
  @IsNotEmpty({ message: 'ইমেইল অথবা মোবাইল নম্বর প্রদান করুন' })
  identifier!: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP received via email',
  })
  @IsString()
  @Length(6, 6, { message: 'ওটিপি কোড অবশ্যই ৬ ডিজিটের হতে হবে' })
  @IsNotEmpty({ message: 'ওটিপি কোড প্রদান করুন' })
  otp!: string;
}
