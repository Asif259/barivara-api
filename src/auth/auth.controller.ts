import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto, RefreshTokenDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResetPasswordDirectDto } from './dto/reset-password-direct.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  StandardSuccessResponseDto,
  StandardErrorResponseDto,
} from '../common/dto/api-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  // Stricter limit: 10 requests/min to deter registration abuse
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'নতুন অ্যাকাউন্ট তৈরি করুন' })
  @ApiResponse({ status: 201, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 400, type: StandardErrorResponseDto })
  @ApiResponse({ status: 409, type: StandardErrorResponseDto })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.register(dto, ipAddress, userAgent);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  // Stricter limit: 10 requests/min to deter brute-force
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'লগইন করুন (ইমেইল অথবা ফোন নম্বর)' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 401, type: StandardErrorResponseDto })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.login(dto, ipAddress, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  // Stricter limit: 20 requests/min (refresh is more frequent than login)
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @ApiOperation({ summary: 'রিফ্রেশ টোকেন দিয়ে নতুন অ্যাক্সেস টোকেন নিন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 401, type: StandardErrorResponseDto })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'লগআউট করুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  async logout(@CurrentUser() user: CurrentUserPayload, @Req() req: Request) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.logout(user?.id, ipAddress, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'বর্তমান লগইনকৃত ব্যবহারকারীর তথ্য দেখুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 401, type: StandardErrorResponseDto })
  async getMe(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getProfile(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'পাসওয়ার্ড পরিবর্তন করুন (লগইন থাকা অবস্থায়)' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 400, type: StandardErrorResponseDto })
  @ApiResponse({ status: 401, type: StandardErrorResponseDto })
  async changePassword(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  // Strict rate limit: 5 requests/min for password reset requests
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'পাসওয়ার্ড ভুলে গেলে ইমেইল ওটিপি অনুরোধ করুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.forgotPassword(dto, ipAddress, userAgent);
  }

  @Public()
  @Post('verify-password-reset-otp')
  @HttpCode(HttpStatus.OK)
  // Strict rate limit: 10 requests/min
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'পাসওয়ার্ড রিসেট ওটিপি কোড যাচাই করুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 400, type: StandardErrorResponseDto })
  async verifyPasswordResetOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.verifyPasswordResetOtp(dto, ipAddress, userAgent);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  // Strict rate limit: 5 requests/min
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'ওটিপি যাচাইয়ের পর নতুন পাসওয়ার্ড সেট করুন' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 400, type: StandardErrorResponseDto })
  @ApiResponse({ status: 401, type: StandardErrorResponseDto })
  async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.resetPassword(dto, ipAddress, userAgent);
  }

  @Public()
  @Post('reset-password-direct')
  @HttpCode(HttpStatus.OK)
  // Strict rate limit: 5 requests/min
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'বর্তমান পাসওয়ার্ড জানা থাকলে সরাসরি পাসওয়ার্ড পরিবর্তন করুন (Option A)' })
  @ApiResponse({ status: 200, type: StandardSuccessResponseDto })
  @ApiResponse({ status: 400, type: StandardErrorResponseDto })
  @ApiResponse({ status: 401, type: StandardErrorResponseDto })
  async resetPasswordDirect(@Body() dto: ResetPasswordDirectDto, @Req() req: Request) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.authService.resetPasswordDirect(dto, ipAddress, userAgent);
  }
}

