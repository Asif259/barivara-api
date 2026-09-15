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
  hash: jest.fn<() => Promise<string>>().mockResolvedValue('$hashed$password'),
  verify: jest.fn(),
}));

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn<(args: any) => Promise<any>>(),
  },
  auditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
};

const mockJwt = {
  signAsync: jest.fn<() => Promise<string>>().mockResolvedValue('mock.jwt.token'),
  verifyAsync: jest.fn(),
};

const mockConfig = {
  getOrThrow: jest.fn((key: string) => {
    const map: Record<string, string> = {
      'jwt.accessSecret': 'access-secret',
      'jwt.refreshSecret': 'refresh-secret',
      'jwt.accessExpiresIn': '15m',
      'jwt.refreshExpiresIn': '7d',
    };
    return map[key];
  }),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      mockPrisma as any,
      mockJwt as unknown as JwtService,
      mockConfig as unknown as ConfigService,
    );
  });

  // =========================================================================
  // register
  // =========================================================================
  describe('register', () => {
    const baseDto = {
      name: 'টেস্ট ইউজার',
      email: 'test@example.com',
      password: 'password123',
    };

    it('creates a user and returns tokens on success', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null); // no duplicate
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        name: 'টেস্ট ইউজার',
        email: 'test@example.com',
        phone: null,
        role: 'OWNER',
        isActive: true,
        signatureFileId: null,
        createdAt: new Date(),
      });

      const result = await service.register(baseDto);
      expect(result.data.accessToken).toBe('mock.jwt.token');
      expect(result.data.user.email).toBe('test@example.com');
    });

    it('normalises email to lowercase before saving', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1', name: 'Test', email: 'upper@example.com',
        phone: null, role: 'OWNER', isActive: true, signatureFileId: null, createdAt: new Date(),
      });

      await service.register({ ...baseDto, email: 'UPPER@EXAMPLE.COM' });
      // findUnique should be called with lowercased email
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'upper@example.com' } }),
      );
    });

    it('throws ConflictException when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register(baseDto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when phone already exists', async () => {
      mockPrisma.user.findUnique
         // email check passes
        .mockResolvedValueOnce({ id: 'existing-phone-user' }); // phone exists

      await expect(
        service.register({ name: 'Test', phone: '01812345678', password: 'pass123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when neither email nor phone is provided', async () => {
      await expect(
        service.register({ name: 'Test', password: 'pass123' } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // login
  // =========================================================================
  describe('login', () => {
    const mockUser = {
      id: 'user-1',
      name: 'টেস্ট ইউজার',
      email: 'test@example.com',
      phone: null,
      role: 'OWNER',
      isActive: true,
      deletedAt: null,
      passwordHash: '$hashed$password',
    };

    it('returns tokens on valid email + password', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ identifier: 'test@example.com', password: 'password123' });
      expect(result.data.accessToken).toBe('mock.jwt.token');
      expect(result.data.user.id).toBe('user-1');
    });

    it('returns tokens on valid phone login', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, email: null, phone: '01812345678' });
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      const result = await service.login({ identifier: '01812345678', password: 'password123' });
      expect(result.data.accessToken).toBe('mock.jwt.token');
    });

    it('throws UnauthorizedException when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.login({ identifier: 'notfound@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on wrong password', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ identifier: 'test@example.com', password: 'wrongpass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when account is inactive', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, isActive: false });
      (argon2.verify as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ identifier: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('uses identical error message for wrong user and wrong password (no enumeration)', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      let notFoundError: any;
      try {
        await service.login({ identifier: 'ghost@example.com', password: 'pass' });
      } catch (e) {
        notFoundError = e;
      }

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      (argon2.verify as jest.Mock).mockResolvedValue(false);
      let wrongPassError: any;
      try {
        await service.login({ identifier: 'test@example.com', password: 'wrong' });
      } catch (e) {
        wrongPassError = e;
      }

      // Both errors must use the same errorCode (prevents account enumeration)
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
});
