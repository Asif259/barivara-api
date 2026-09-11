import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ErrorCode } from '../constants/error-codes';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    // Distinguish token-expired from invalid/missing token so the client
    // knows whether to attempt a refresh or redirect to login.
    if (err || !user) {
      const isExpired =
        info?.name === 'TokenExpiredError' ||
        (err instanceof UnauthorizedException &&
          (err.getResponse?.() as Record<string, unknown>)?.errorCode === ErrorCode.AUTH_TOKEN_EXPIRED);

      if (isExpired) {
        throw new UnauthorizedException({
          errorCode: ErrorCode.AUTH_TOKEN_EXPIRED,
          message: 'আপনার সেশন মেয়াদোত্তীর্ণ হয়েছে। অনুগ্রহ করে পুনরায় লগইন করুন।',
        });
      }

      throw err || new UnauthorizedException({
        errorCode: ErrorCode.AUTH_UNAUTHORIZED,
        message: 'অনুমোদনহীন অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।',
      });
    }
    return user;
  }
}
