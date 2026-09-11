import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ErrorCode } from '../constants/error-codes';

describe('JwtAuthGuard.handleRequest', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    // Reflector not needed for handleRequest unit tests
    guard = new JwtAuthGuard({} as any);
  });

  it('should return user when no error and user exists', () => {
    const user = { id: 'user-1', role: 'OWNER' };
    const result = guard.handleRequest(null, user, null);
    expect(result).toBe(user);
  });

  it('should throw AUTH_TOKEN_EXPIRED for TokenExpiredError info', () => {
    const expiredInfo = { name: 'TokenExpiredError', message: 'jwt expired' };
    expect(() => guard.handleRequest(null, null, expiredInfo)).toThrow(UnauthorizedException);

    try {
      guard.handleRequest(null, null, expiredInfo);
    } catch (err: any) {
      expect(err.getResponse().errorCode).toBe(ErrorCode.AUTH_TOKEN_EXPIRED);
    }
  });

  it('should throw AUTH_UNAUTHORIZED for JsonWebTokenError (invalid token)', () => {
    const invalidInfo = { name: 'JsonWebTokenError', message: 'invalid signature' };
    expect(() => guard.handleRequest(null, null, invalidInfo)).toThrow(UnauthorizedException);

    try {
      guard.handleRequest(null, null, invalidInfo);
    } catch (err: any) {
      expect(err.getResponse().errorCode).toBe(ErrorCode.AUTH_UNAUTHORIZED);
    }
  });

  it('should throw AUTH_UNAUTHORIZED when user is null and no specific info', () => {
    expect(() => guard.handleRequest(null, null, null)).toThrow(UnauthorizedException);

    try {
      guard.handleRequest(null, null, null);
    } catch (err: any) {
      expect(err.getResponse().errorCode).toBe(ErrorCode.AUTH_UNAUTHORIZED);
    }
  });

  it('should re-throw passed-in error when err is provided', () => {
    const existingErr = new UnauthorizedException({
      errorCode: ErrorCode.AUTH_UNAUTHORIZED,
      message: 'already thrown',
    });
    expect(() => guard.handleRequest(existingErr, null, null)).toThrow(existingErr);
  });
});
