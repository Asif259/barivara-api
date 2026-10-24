import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResetPasswordDirectDto } from './dto/reset-password-direct.dto';
import { ErrorCode } from '../common/constants/error-codes';
import { AuditAction } from '@prisma/client';

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_MAX_ATTEMPTS = 3;
const RESET_TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: 'ইমেইল অথবা ফোন নম্বরের অন্তত একটি প্রদান করতে হবে।',
      });
    }

    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() },
        select: { id: true },
      });
      if (existingEmail) {
        throw new ConflictException({
          errorCode: ErrorCode.DUPLICATE_RESOURCE,
          message: 'এই ইমেইল দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট তৈরি করা হয়েছে।',
        });
      }
    }

    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
        select: { id: true },
      });
      if (existingPhone) {
        throw new ConflictException({
          errorCode: ErrorCode.DUPLICATE_RESOURCE,
          message: 'এই ফোন নম্বর দিয়ে ইতিমধ্যে একটি অ্যাকাউন্ট তৈরি করা হয়েছে।',
        });
      }
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email ? dto.email.toLowerCase() : null,
        phone: dto.phone || null,
        passwordHash,
        role: dto.role || 'OWNER',
        tokenVersion: 0,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        signatureFileId: true,
        createdAt: true,
      },
    });

    const tokens = await this.generateTokens(user.id, user.role, 0);

    // Audit log — no PII (email/phone) in metadata to minimise data in audit trail
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.CREATE,
        entityType: 'User',
        entityId: user.id,
        ipAddress,
        userAgent,
        metadata: { action: 'REGISTER' },
      },
    });

    return {
      message: 'অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে',
      data: {
        user,
        ...tokens,
      },
    };
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const identifier = dto.identifier || dto.email || dto.phone;

    if (!identifier) {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: 'ইমেইল অথবা ফোন নম্বর প্রদান করুন।',
      });
    }

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { phone: identifier },
        ],
        deletedAt: null,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'ভুল ইমেইল/ফোন অথবা পাসওয়ার্ড।',
      });
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'ভুল ইমেইল/ফোন অথবা পাসওয়ার্ড।',
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_UNAUTHORIZED,
        message: 'আপনার অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে।',
      });
    }

    const tokens = await this.generateTokens(user.id, user.role, user.tokenVersion);

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.LOGIN,
        entityType: 'User',
        entityId: user.id,
        ipAddress,
        userAgent,
        metadata: { loginAt: new Date().toISOString() },
      },
    });

    return {
      message: 'লগইন সফল হয়েছে',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        ...tokens,
      },
    };
  }

  async refresh(dto: RefreshTokenDto) {
    try {
      const refreshSecret = this.configService.getOrThrow<string>('jwt.refreshSecret');

      const payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: refreshSecret,
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive || user.deletedAt) {
        throw new UnauthorizedException({
          errorCode: ErrorCode.AUTH_UNAUTHORIZED,
          message: 'টোকেন অবৈধ বা মেয়াদোত্তীর্ণ।',
        });
      }

      // Check tokenVersion — reject if the token was issued before a version bump
      if (payload.tokenVersion !== user.tokenVersion) {
        throw new UnauthorizedException({
          errorCode: ErrorCode.AUTH_UNAUTHORIZED,
          message: 'টোকেন অবৈধ বা মেয়াদোত্তীর্ণ।',
        });
      }

      const tokens = await this.generateTokens(user.id, user.role, user.tokenVersion);

      return {
        message: 'টোকেন সফলভাবে নবায়ন করা হয়েছে',
        data: tokens,
      };
    } catch {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_UNAUTHORIZED,
        message: 'টোকেন অবৈধ বা মেয়াদোত্তীর্ণ।',
      });
    }
  }

  async logout(userId: string, ipAddress?: string, userAgent?: string) {
    if (userId) {
      // Invalidate active tokens by incrementing tokenVersion
      await this.prisma.user.update({
        where: { id: userId },
        data: { tokenVersion: { increment: 1 } },
      });

      await this.prisma.auditLog.create({
        data: {
          userId,
          action: AuditAction.LOGOUT,
          entityType: 'User',
          entityId: userId,
          ipAddress,
          userAgent,
        },
      });
    }
    return {
      message: 'লগআউট সফল হয়েছে',
      data: null,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        signatureFileId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_UNAUTHORIZED,
        message: 'ব্যবহারকারী পাওয়া যায়নি।',
      });
    }

    return {
      message: 'প্রোফাইল তথ্য',
      data: user,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: 'নতুন পাসওয়ার্ড এবং নিশ্চিতকরণ পাসওয়ার্ড মিলছে না।',
      });
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: 'নতুন পাসওয়ার্ড বর্তমান পাসওয়ার্ডের সমান হতে পারবে না।',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_UNAUTHORIZED,
        message: 'ব্যবহারকারী পাওয়া যায়নি।',
      });
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!passwordValid) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'বর্তমান পাসওয়ার্ড ভুল।',
      });
    }

    const newPasswordHash = await argon2.hash(dto.newPassword);

    // Increment tokenVersion to invalidate all existing sessions
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newPasswordHash,
        tokenVersion: { increment: 1 },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: userId,
        metadata: { field: 'password', updatedAt: new Date().toISOString() },
      },
    });

    return {
      message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে',
      data: null,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto, ipAddress?: string, userAgent?: string) {
    const rawIdentifier = dto.identifier.trim();
    const isEmail = rawIdentifier.includes('@');
    const normalizedIdentifier = isEmail ? rawIdentifier.toLowerCase() : rawIdentifier;

    // Search user by email or phone
    const user = await this.prisma.user.findFirst({
      where: isEmail
        ? { email: normalizedIdentifier, isActive: true, deletedAt: null }
        : { phone: normalizedIdentifier, isActive: true, deletedAt: null },
    });

    // Security practice: Always return a generic success message to prevent user enumeration
    const genericResponse = {
      message: 'যদি এই তথ্যের সাথে কোনো সক্রিয় অ্যাকাউন্ট মিলে যায়, তবে পাসওয়ার্ড রিসেটের ওটিপি ইমেইলে পাঠানো হয়েছে।',
      data: {
        identifier: normalizedIdentifier,
      },
    };

    if (!user || !user.email) {
      return genericResponse;
    }

    // Generate secure 6-digit numeric OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = this.hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

    // Store OTP hash in the database (survives restarts, works across instances)
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        identifier: normalizedIdentifier,
        otpHash,
        expiresAt,
        attempts: 0,
      },
    });

    // Send OTP email
    const sent = await this.emailService.sendPasswordResetOtp({
      to: user.email,
      name: user.name,
      otp,
      expiresInMinutes: 10,
    });

    if (!sent) {
      // Clean up the OTP record on send failure
      await this.prisma.passwordResetToken.deleteMany({
        where: { identifier: normalizedIdentifier, otpHash, completedAt: null },
      });
      throw new InternalServerErrorException({
        errorCode: ErrorCode.INTERNAL_ERROR,
        message: 'ওটিপি ইমেইল পাঠাতে ব্যর্থ হয়েছে। অনুগ্রহ করে আপনার ইমেইল সেটিং বা সংযোগ যাচাই করুন।',
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: user.id,
        ipAddress,
        userAgent,
        metadata: { action: 'FORGOT_PASSWORD_REQUEST' },
      },
    });

    return genericResponse;
  }

  async verifyPasswordResetOtp(dto: VerifyOtpDto, ipAddress?: string, userAgent?: string) {
    const rawIdentifier = dto.identifier.trim();
    const isEmail = rawIdentifier.includes('@');
    const normalizedIdentifier = isEmail ? rawIdentifier.toLowerCase() : rawIdentifier;

    // Find the latest uncompleted OTP record for this identifier
    const record = await this.prisma.passwordResetToken.findFirst({
      where: {
        identifier: normalizedIdentifier,
        completedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new BadRequestException({
        errorCode: ErrorCode.OTP_EXPIRED,
        message: 'ওটিপির মেয়াদ শেষ হয়ে গেছে বা অনুরোধ পাওয়া যায়নি। নতুন ওটিপি অনুরোধ করুন।',
      });
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      await this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { completedAt: new Date() },
      });
      throw new BadRequestException({
        errorCode: ErrorCode.OTP_LIMIT_EXCEEDED,
        message: 'অতিরিক্ত ভুল চেষ্টার কারণে ওটিপি বাতিল হয়েছে। পুনরায় ওটিপি পাঠান।',
      });
    }

    // Hash the provided OTP and compare
    const providedOtpHash = this.hashOtp(dto.otp.trim());
    if (record.otpHash !== providedOtpHash) {
      await this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException({
        errorCode: ErrorCode.INVALID_OTP,
        message: `ভুল ওটিপি কোড। বাকি সুযোগ: ${OTP_MAX_ATTEMPTS - record.attempts - 1} বার।`,
      });
    }

    // OTP matched successfully! Issue a 10-minute temporary reset authorization token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = this.hashOtp(resetToken);
    const resetTokenExpiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

    // Store reset token hash in the record
    await this.prisma.passwordResetToken.update({
      where: { id: record.id },
      data: {
        resetTokenHash,
        resetTokenExpiresAt,
        otpHash: '', // Clear OTP hash — no longer needed
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: record.userId,
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: record.userId,
        ipAddress,
        userAgent,
        metadata: { action: 'OTP_VERIFIED' },
      },
    });

    return {
      message: 'ওটিপি সফলভাবে যাচাই করা হয়েছে।',
      data: {
        identifier: normalizedIdentifier,
        resetToken,
      },
    };
  }

  async resetPassword(dto: ResetPasswordDto, ipAddress?: string, userAgent?: string) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: 'নতুন পাসওয়ার্ড এবং নিশ্চিতকরণ পাসওয়ার্ড মিলছে না।',
      });
    }

    const rawIdentifier = dto.identifier.trim();
    const isEmail = rawIdentifier.includes('@');
    const normalizedIdentifier = isEmail ? rawIdentifier.toLowerCase() : rawIdentifier;

    // Find valid reset session by hashed reset token
    const resetTokenHash = this.hashOtp(dto.resetToken.trim());

    const record = await this.prisma.passwordResetToken.findFirst({
      where: {
        identifier: normalizedIdentifier,
        resetTokenHash,
        completedAt: null,
        resetTokenExpiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.RESET_TOKEN_INVALID,
        message: 'পাসওয়ার্ড রিসেট সেশনটি মেয়াদোত্তীর্ণ বা অবৈধ। অনুগ্রহ করে পুনরায় ওটিপি যাচাই করুন।',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: record.userId },
    });

    if (!user || !user.isActive || user.deletedAt) {
      throw new BadRequestException({
        errorCode: ErrorCode.AUTH_UNAUTHORIZED,
        message: 'ব্যবহারকারী পাওয়া যায়নি বা নিষ্ক্রিয়।',
      });
    }

    // Check if new password matches old password
    const isSamePassword = await argon2.verify(user.passwordHash, dto.newPassword);
    if (isSamePassword) {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: 'নতুন পাসওয়ার্ড পূর্বের পাসওয়ার্ডের সমান হতে পারবে না।',
      });
    }

    const newPasswordHash = await argon2.hash(dto.newPassword);

    // Update password AND increment tokenVersion to invalidate all existing sessions
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        tokenVersion: { increment: 1 },
      },
    });

    // Mark the reset session as completed
    await this.prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { completedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: user.id,
        ipAddress,
        userAgent,
        metadata: { action: 'PASSWORD_RESET_COMPLETED' },
      },
    });

    return {
      message: 'পাসওয়ার্ড সফলভাবে রিসেট করা হয়েছে। অনুগ্রহ করে নতুন পাসওয়ার্ড দিয়ে লগইন করুন।',
      data: null,
    };
  }

  async resetPasswordDirect(dto: ResetPasswordDirectDto, ipAddress?: string, userAgent?: string) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: 'নতুন পাসওয়ার্ড এবং নিশ্চিতকরণ পাসওয়ার্ড মিলছে না।',
      });
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException({
        errorCode: ErrorCode.VALIDATION_ERROR,
        message: 'নতুন পাসওয়ার্ড বর্তমান পাসওয়ার্ডের সমান হতে পারবে না।',
      });
    }

    const rawIdentifier = dto.identifier.trim();
    const isEmail = rawIdentifier.includes('@');
    const normalizedIdentifier = isEmail ? rawIdentifier.toLowerCase() : rawIdentifier;

    const user = await this.prisma.user.findFirst({
      where: isEmail
        ? { email: normalizedIdentifier, isActive: true, deletedAt: null }
        : { phone: normalizedIdentifier, isActive: true, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'বর্তমান ব্যবহারকারী বা পাসওয়ার্ড ভুল।',
      });
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!passwordValid) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_INVALID_CREDENTIALS,
        message: 'বর্তমান পাসওয়ার্ড ভুল।',
      });
    }

    const newPasswordHash = await argon2.hash(dto.newPassword);

    // Update password AND increment tokenVersion to invalidate all existing sessions
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        tokenVersion: { increment: 1 },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: user.id,
        ipAddress,
        userAgent,
        metadata: { action: 'DIRECT_PASSWORD_CHANGE' },
      },
    });

    return {
      message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।',
      data: null,
    };
  }

  private async generateTokens(
    userId: string,
    role: string,
    tokenVersion: number,
  ) {
    const payload = { sub: userId, role, tokenVersion };

    const accessSecret = this.configService.getOrThrow<string>('jwt.accessSecret');
    const refreshSecret = this.configService.getOrThrow<string>('jwt.refreshSecret');
    const accessExpiresIn = this.configService.getOrThrow<string>('jwt.accessExpiresIn');
    const refreshExpiresIn = this.configService.getOrThrow<string>('jwt.refreshExpiresIn');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: accessExpiresIn,
    };
  }

  /**
   * Hash an OTP or reset token for secure DB storage.
   * Uses SHA-256 with a secret prefix to prevent rainbow-table attacks on 6-digit OTPs.
   */
  private hashOtp(value: string): string {
    const secret = this.configService.get<string>('jwt.accessSecret') || 'barivara-otp-pepper';
    return crypto.createHash('sha256').update(secret + value).digest('hex');
  }
}