import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/constants/error-codes';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: { sub: string; role: string; tokenVersion: number }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        tokenVersion: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_UNAUTHORIZED,
        message: 'ব্যবহারকারী পাওয়া যায়নি অথবা অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে।',
      });
    }

    // Token version check — reject tokens issued before a password change
    if (payload.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException({
        errorCode: ErrorCode.AUTH_UNAUTHORIZED,
        message: 'আপনার সেশন মেয়াদোত্তীর্ণ হয়েছে। অনুগ্রহ করে পুনরায় লগইন করুন।',
      });
    }

    return user;
  }
}
