import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { ErrorCode } from '../common/constants/error-codes';
import * as argon2 from 'argon2';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// Mock argon2 so tests don't pay bcrypt/argon2 CPU cost
jest.mock('argon2', () => ({
  hash: jest.fn<any>().mockResolvedValue('$hashed$password'),
  verify: jest.fn<any>(),
}));

const mockPrisma = {
  user: {
    findUnique: jest.fn<any>(),
    findFirst: jest.fn<any>(),
    create: jest.fn<any>(),
    update: jest.fn<any>(),
  },
  auditLog: {
    create: jest.fn<any>().mockResolvedValue({}),
  },
};

const mockJwt = {
  signAsync: jest.fn<any>().mockResolvedValue('mock.jwt.token'),
  verifyAsync: jest.fn<any>(),
};

const mockConfig = {
  getOrThrow: jest.fn<any>((key: string) => {
    const map: Record<string, string> = {
      'jwt.accessSecret': 'access-secret',
      'jwt.refreshSecret': 'refresh-secret',
      'jwt.accessExpiresIn': '15m',
      'jwt.refreshExpiresIn': '7d',
    };
    return map[key];
  }),
  get: jest.fn<any>(() => undefined),
};

const mockEmailService = {
  sendPasswordResetOtp: jest.fn<any>().mockResolvedValue(true),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJwt.signAsync.mockResolvedValue('mock.jwt.token');
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockEmailService.sendPasswordResetOtp.mockResolvedValue(true);
    service = new AuthService(
      mockPrisma as any,
      mockJwt as unknown as JwtService,
      mockConfig as unknown as ConfigService,
      mockEmailService as any,
    );
  });

  // =========================================================================
  // register
  // =========================================================================
  describe('register', () => {
    it('throws BadRequestException if neither email nor phone is provided', async () => {
      await expect(
        service.register({ name: 'টেস্ট', password: 'Password123' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a user when valid email is provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        name: 'টেস্ট',
        email: 'test@example.com',
        phone: null,
        role: 'OWNER',
      });

      const result = await service.register({
        name: 'টেস্ট',
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(result.data.user.id).toBe('user-1');
      expect(result.data.accessToken).toBe('mock.jwt.token');
      expect(result.data.refreshToken).toBe('mock.jwt.token');
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });

    it('throws ConflictException if email is already taken', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.register({
          name: 'টেস্ট',
          email: 'duplicate@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if phone is already taken', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-phone-user' });

      await expect(
        service.register({
          name: 'টেস্ট',
          phone: '01712345678',
          password: 'Password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // =========================================================================
  // login
  // =========================================================================
  describe('login', () => {
    const mockUser = {
      id: 'user-1',
      name: 'টেস্ট',
      email: 'user@example.com',
      phone: null,
      role: 'OWNER',
      isActive: true,
      deletedAt: null,
      passwordHash: '$hashed$password',
    };

    it('authenticates with valid email and password', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock<any>).mockResolvedValue(true);

      const result = await service.login({
        identifier: 'user@example.com',
        password: 'Password123',
      });

      expect(result.data.user.email).toBe('user@example.com');
      expect(result.data.accessToken).toBe('mock.jwt.token');
    });

    it('authenticates with valid phone and password', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, email: null, phone: '01812345678' });
      (argon2.verify as jest.Mock<any>).mockResolvedValue(true);

      const result = await service.login({
        identifier: '01812345678',
        password: 'Password123',
      });

      expect(result.data.user.id).toBe('user-1');
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ identifier: 'ghost@example.com', password: 'Password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on incorrect password', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock<any>).mockResolvedValue(false);

      await expect(
        service.login({ identifier: 'user@example.com', password: 'WrongPassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user is inactive', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, isActive: false });
      (argon2.verify as jest.Mock<any>).mockResolvedValue(true);

      await expect(
        service.login({ identifier: 'user@example.com', password: 'Password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('returns the SAME error code for wrong email and wrong password to prevent user enumeration', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      let notFoundError: any;
      try {
        await service.login({ identifier: 'notfound@example.com', password: 'Pass' });
      } catch (err) {
        notFoundError = err;
      }

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock<any>).mockResolvedValue(false);
      let wrongPassError: any;
      try {
        await service.login({ identifier: 'user@example.com', password: 'Wrong' });
      } catch (err) {
        wrongPassError = err;
      }

      expect(notFoundError.getResponse().errorCode).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
      expect(wrongPassError.getResponse().errorCode).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
    });
  });

  // =========================================================================
  // refresh
  // =========================================================================
  describe('refresh', () => {
    it('returns new tokens for a valid refresh token', async () => {
      mockJwt.verifyAsync.mockResolvedValue({ sub: 'user-1', role: 'OWNER' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', role: 'OWNER', email: 'test@example.com',
        phone: null, isActive: true, deletedAt: null,
      });

      const result = await service.refresh({ refreshToken: 'valid.refresh.token' });
      expect(result.data.accessToken).toBe('mock.jwt.token');
    });

    it('throws UnauthorizedException for an invalid/expired refresh token', async () => {
      mockJwt.verifyAsync.mockRejectedValue(new Error('TokenExpiredError'));

      await expect(
        service.refresh({ refreshToken: 'expired.token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user is deleted', async () => {
      mockJwt.verifyAsync.mockResolvedValue({ sub: 'user-1' });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', isActive: true, deletedAt: new Date(),
      });

      await expect(
        service.refresh({ refreshToken: 'valid.token' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // =========================================================================
  // getProfile
  // =========================================================================
  describe('getProfile', () => {
    it('returns user profile for valid userId', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', name: 'টেস্ট', email: 'test@example.com', phone: null,
        role: 'OWNER', isActive: true, signatureFileId: null, createdAt: new Date(), updatedAt: new Date(),
      });

      const result = await service.getProfile('user-1');
      expect(result.data.id).toBe('user-1');
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile('ghost-id')).rejects.toThrow(UnauthorizedException);
    });
  });

  // =========================================================================
  // changePassword
  // =========================================================================
  describe('changePassword', () => {
    it('rejects if newPassword does not match confirmPassword', async () => {
      await expect(
        service.changePassword('user-1', {
          currentPassword: 'OldPassword123',
          newPassword: 'NewPassword123',
          confirmPassword: 'MismatchPassword',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects if newPassword is identical to currentPassword', async () => {
      await expect(
        service.changePassword('user-1', {
          currentPassword: 'SamePassword123',
          newPassword: 'SamePassword123',
          confirmPassword: 'SamePassword123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects if current password is wrong', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: '$old$hash',
      });
      (argon2.verify as jest.Mock<any>).mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', {
          currentPassword: 'WrongOldPassword',
          newPassword: 'NewSecurePassword123',
          confirmPassword: 'NewSecurePassword123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('successfully changes password and creates audit log', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        passwordHash: '$old$hash',
      });
      (argon2.verify as jest.Mock<any>).mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

      const result = await service.changePassword('user-1', {
        currentPassword: 'CorrectOldPassword123',
        newPassword: 'NewSecurePassword123',
        confirmPassword: 'NewSecurePassword123',
      });

      expect(result.data).toBeNull();
      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockPrisma.auditLog.create).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // forgotPassword, verifyOtp, resetPassword
  // =========================================================================
  describe('forgotPassword, verifyOtp, resetPassword workflow', () => {
    it('forgotPassword sends OTP email when user exists with email', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        name: 'ল্যান্ডলর্ড',
        email: 'landlord@example.com',
        isActive: true,
      });

      const res = await service.forgotPassword({ identifier: 'landlord@example.com' });
      expect(res.data.identifier).toBe('landlord@example.com');
      expect(mockEmailService.sendPasswordResetOtp).toHaveBeenCalled();
    });

    it('forgotPassword returns generic success even if user not found (security enumeration protection)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const res = await service.forgotPassword({ identifier: 'notfound@example.com' });
      expect(res.data.identifier).toBe('notfound@example.com');
      expect(mockEmailService.sendPasswordResetOtp).not.toHaveBeenCalled();
    });

    it('verifyOtp and resetPassword work together', async () => {
      // 1. Forgot password
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        name: 'ল্যান্ডলর্ড',
        email: 'landlord@example.com',
        isActive: true,
      });
      await service.forgotPassword({ identifier: 'landlord@example.com' });

      // Capture generated OTP from email call
      const emailCallArgs = mockEmailService.sendPasswordResetOtp.mock.calls[0][0] as any;
      const sentOtp = emailCallArgs.otp;

      // 2. Verify OTP with correct code
      const verifyRes = await service.verifyPasswordResetOtp({
        identifier: 'landlord@example.com',
        otp: sentOtp,
      });
      expect(verifyRes.data.resetToken).toBeDefined();

      // 3. Reset password
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        isActive: true,
        deletedAt: null,
        passwordHash: '$old$hash',
      });
      (argon2.verify as jest.Mock<any>).mockResolvedValue(false); // not same password
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

      const resetRes = await service.resetPassword({
        identifier: 'landlord@example.com',
        resetToken: verifyRes.data.resetToken,
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      });

      expect(resetRes.data).toBeNull();
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('verifyOtp rejects invalid OTP and limits attempts', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        name: 'ল্যান্ডলর্ড',
        email: 'landlord@example.com',
        isActive: true,
      });
      await service.forgotPassword({ identifier: 'landlord@example.com' });

      // 3 wrong attempts
      await expect(
        service.verifyPasswordResetOtp({ identifier: 'landlord@example.com', otp: '000000' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.verifyPasswordResetOtp({ identifier: 'landlord@example.com', otp: '000000' }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.verifyPasswordResetOtp({ identifier: 'landlord@example.com', otp: '000000' }),
      ).rejects.toThrow(BadRequestException);

      // Next attempt fails with limit exceeded
      await expect(
        service.verifyPasswordResetOtp({ identifier: 'landlord@example.com', otp: '000000' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // resetPasswordDirect (Option A)
  // =========================================================================
  describe('resetPasswordDirect', () => {
    it('resets password directly when current password is valid', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: '$old$hash',
        isActive: true,
        deletedAt: null,
      });
      (argon2.verify as jest.Mock<any>).mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });

      const res = await service.resetPasswordDirect({
        identifier: 'user@example.com',
        currentPassword: 'ValidCurrentPassword',
        newPassword: 'NewSecurePassword123',
        confirmPassword: 'NewSecurePassword123',
      });

      expect(res.data).toBeNull();
      expect(mockPrisma.user.update).toHaveBeenCalled();
    });

    it('rejects if current password is wrong', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        passwordHash: '$old$hash',
        isActive: true,
        deletedAt: null,
      });
      (argon2.verify as jest.Mock<any>).mockResolvedValue(false);

      await expect(
        service.resetPasswordDirect({
          identifier: 'user@example.com',
          currentPassword: 'WrongPassword',
          newPassword: 'NewSecurePassword123',
          confirmPassword: 'NewSecurePassword123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
