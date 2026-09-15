import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ThrottlerGuard } from '@nestjs/throttler';

// ---------------------------------------------------------------------------
// Mock AuthService — only the return shapes matter at the controller layer
// ---------------------------------------------------------------------------
const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  getProfile: jest.fn(),
  changePassword: jest.fn(),
  forgotPassword: jest.fn(),
  verifyPasswordResetOtp: jest.fn(),
  resetPassword: jest.fn(),
  resetPasswordDirect: jest.fn(),
};

// Fake request object
const mockReq = { ip: '127.0.0.1', socket: { remoteAddress: '127.0.0.1' }, headers: {} };

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      // Override guards — we test auth service in auth.service.spec.ts
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  // =========================================================================
  // register
  // =========================================================================
  describe('POST /auth/register', () => {
    it('delegates to authService.register and returns its result', async () => {
      const dto = { name: 'টেস্ট', email: 'test@example.com', password: 'pass123' };
      const expected = { message: 'অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে', data: { user: {}, accessToken: 'token' } };
      mockAuthService.register.mockResolvedValue(expected as never);

      const result = await controller.register(dto as any, mockReq as any);
      expect(result).toBe(expected);
      expect(mockAuthService.register).toHaveBeenCalledWith(
        dto,
        expect.any(String), // ipAddress
        undefined,          // userAgent from headers
      );
    });
  });

  // =========================================================================
  // login
  // =========================================================================
  describe('POST /auth/login', () => {
    it('delegates to authService.login with IP and user-agent', async () => {
      const dto = { identifier: 'test@example.com', password: 'pass123' };
      const expected = { message: 'লগইন সফল হয়েছে', data: { accessToken: 'token' } };
      mockAuthService.login.mockResolvedValue(expected as never);

      const result = await controller.login(dto as any, mockReq as any);
      expect(result).toBe(expected);
      expect(mockAuthService.login).toHaveBeenCalledWith(dto, '127.0.0.1', undefined);
    });
  });

  // =========================================================================
  // refresh
  // =========================================================================
  describe('POST /auth/refresh', () => {
    it('delegates to authService.refresh', async () => {
      const dto = { refreshToken: 'refresh.token.here' };
      const expected = { message: 'টোকেন নবায়ন', data: { accessToken: 'new.token' } };
      mockAuthService.refresh.mockResolvedValue(expected as never);

      const result = await controller.refresh(dto);
      expect(result).toBe(expected);
      expect(mockAuthService.refresh).toHaveBeenCalledWith(dto);
    });
  });

  // =========================================================================
  // logout
  // =========================================================================
  describe('POST /auth/logout', () => {
    it('delegates to authService.logout with current user id', async () => {
      const user = { id: 'user-1', role: 'OWNER' };
      mockAuthService.logout.mockResolvedValue({ message: 'লগআউট সফল', data: null } as never);

      const result = await controller.logout(user as any, mockReq as any);
      expect(mockAuthService.logout).toHaveBeenCalledWith('user-1', expect.any(String), undefined);
      expect(result.message).toBe('লগআউট সফল');
    });
  });

  // =========================================================================
  // GET /auth/me
  // =========================================================================
  describe('GET /auth/me', () => {
    it('delegates to authService.getProfile with current user id', async () => {
      const user = { id: 'user-1', role: 'OWNER' };
      const expected = { message: 'প্রোফাইল তথ্য', data: { id: 'user-1' } };
      mockAuthService.getProfile.mockResolvedValue(expected as never);

      const result = await controller.getMe(user as any);
      expect(result).toBe(expected);
      expect(mockAuthService.getProfile).toHaveBeenCalledWith('user-1');
    });
  });

  // =========================================================================
  // POST /auth/change-password
  // =========================================================================
  describe('POST /auth/change-password', () => {
    it('delegates to authService.changePassword with current user id and dto', async () => {
      const user = { id: 'user-1', role: 'OWNER' };
      const dto = {
        currentPassword: 'OldPassword123',
        newPassword: 'NewPassword123',
        confirmPassword: 'NewPassword123',
      };
      const expected = { message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে', data: null };
      mockAuthService.changePassword.mockResolvedValue(expected as never);

      const result = await controller.changePassword(user as any, dto);
      expect(result).toBe(expected);
      expect(mockAuthService.changePassword).toHaveBeenCalledWith('user-1', dto);
    });
  });

  // =========================================================================
  // POST /auth/forgot-password
  // =========================================================================
  describe('POST /auth/forgot-password', () => {
    it('delegates to authService.forgotPassword', async () => {
      const dto = { identifier: 'user@example.com' };
      const expected = { message: 'ওটিপি পাঠানো হয়েছে', data: { identifier: 'user@example.com' } };
      mockAuthService.forgotPassword.mockResolvedValue(expected as never);

      const result = await controller.forgotPassword(dto, mockReq as any);
      expect(result).toBe(expected);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith(dto, '127.0.0.1', undefined);
    });
  });

  // =========================================================================
  // POST /auth/verify-password-reset-otp
  // =========================================================================
  describe('POST /auth/verify-password-reset-otp', () => {
    it('delegates to authService.verifyPasswordResetOtp', async () => {
      const dto = { identifier: 'user@example.com', otp: '123456' };
      const expected = { message: 'যাচাই হয়েছে', data: { resetToken: 'token123' } };
      mockAuthService.verifyPasswordResetOtp.mockResolvedValue(expected as never);

      const result = await controller.verifyPasswordResetOtp(dto, mockReq as any);
      expect(result).toBe(expected);
      expect(mockAuthService.verifyPasswordResetOtp).toHaveBeenCalledWith(dto, '127.0.0.1', undefined);
    });
  });

  // =========================================================================
  // POST /auth/reset-password
  // =========================================================================
  describe('POST /auth/reset-password', () => {
    it('delegates to authService.resetPassword', async () => {
      const dto = {
        identifier: 'user@example.com',
        resetToken: 'token123',
        newPassword: 'NewPassword123',
        confirmPassword: 'NewPassword123',
      };
      const expected = { message: 'পাসওয়ার্ড রিসেট সফল হয়েছে', data: null };
      mockAuthService.resetPassword.mockResolvedValue(expected as never);

      const result = await controller.resetPassword(dto, mockReq as any);
      expect(result).toBe(expected);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(dto, '127.0.0.1', undefined);
    });
  });

  // =========================================================================
  // POST /auth/reset-password-direct
  // =========================================================================
  describe('POST /auth/reset-password-direct', () => {
    it('delegates to authService.resetPasswordDirect', async () => {
      const dto = {
        identifier: 'user@example.com',
        currentPassword: 'OldPassword123',
        newPassword: 'NewPassword123',
        confirmPassword: 'NewPassword123',
      };
      const expected = { message: 'পাসওয়ার্ড পরিবর্তন সফল হয়েছে', data: null };
      mockAuthService.resetPasswordDirect.mockResolvedValue(expected as never);

      const result = await controller.resetPasswordDirect(dto, mockReq as any);
      expect(result).toBe(expected);
      expect(mockAuthService.resetPasswordDirect).toHaveBeenCalledWith(dto, '127.0.0.1', undefined);
    });
  });
});
