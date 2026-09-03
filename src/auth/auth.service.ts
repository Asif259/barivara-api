import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/login.dto';
import { ErrorCode } from '../common/constants/error-codes';
import { AuditAction } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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

    const tokens = await this.generateTokens(user.id, user.role, user.email, user.phone);

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.CREATE,
        entityType: 'User',
        entityId: user.id,
        ipAddress,
        userAgent,
        metadata: { action: 'REGISTER', email: user.email, phone: user.phone },
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

    const tokens = await this.generateTokens(user.id, user.role, user.email, user.phone);

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
      const refreshSecret =
        this.configService.get<string>('jwt.refreshSecret') ||
        'barivara-jwt-refresh-secret-key-super-secure-2026';

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

      const tokens = await this.generateTokens(user.id, user.role, user.email, user.phone);

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

  private async generateTokens(
    userId: string,
    role: string,
    email?: string | null,
    phone?: string | null,
  ) {
    const payload = { sub: userId, role, email, phone };

    const accessSecret =
      this.configService.get<string>('jwt.accessSecret') ||
      'barivara-jwt-access-secret-key-super-secure-2026';
    const refreshSecret =
      this.configService.get<string>('jwt.refreshSecret') ||
      'barivara-jwt-refresh-secret-key-super-secure-2026';

    const accessExpiresIn =
      this.configService.get<string>('jwt.accessExpiresIn') || '15m';
    const refreshExpiresIn =
      this.configService.get<string>('jwt.refreshExpiresIn') || '30d';

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
}
