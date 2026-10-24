import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import * as nodemailer from 'nodemailer';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('nodemailer');

describe('EmailService', () => {
  let service: EmailService;
  let mockSendMail: jest.Mock<any>;
  let mockConfig: Record<string, any>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockSendMail = jest.fn<any>().mockResolvedValue({ messageId: 'mock-msg-123' });
    (nodemailer.createTransport as jest.Mock<any>).mockReturnValue({
      sendMail: mockSendMail,
    });

    mockConfig = {
      SMTP_USER: 'sender@gmail.com',
      SMTP_PASS: 'app-password-16chars',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: 465,
      'smtp.secure': true,
      SMTP_FROM: 'BariVara <sender@gmail.com>',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('initializes Nodemailer transport with Gmail SMTP configuration', () => {
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: 'sender@gmail.com',
          pass: 'app-password-16chars',
        },
      }),
    );
  });

  it('sends password reset OTP email with valid HTML and text containing the 6-digit OTP', async () => {
    const success = await service.sendPasswordResetOtp({
      to: 'recipient@example.com',
      name: 'হাসান আহমেদ',
      otp: '789123',
      expiresInMinutes: 5,
    });

    expect(success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const callArgs = mockSendMail.mock.calls[0][0] as any;
    expect(callArgs.to).toBe('recipient@example.com');
    expect(callArgs.from).toBe('BariVara <sender@gmail.com>');
    expect(callArgs.subject).toContain('পাসওয়ার্ড রিসেট ওটিপি কোড');
    expect(callArgs.text).toContain('789123');
    expect(callArgs.text).toContain('মিনিট');
    expect(callArgs.html).toContain('789123');
    expect(callArgs.html).toContain('#12664F');
  });

  it('handles SMTP send failure safely and returns false without throwing', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('Invalid login: 535-5.7.8 Username and Password not accepted'));

    const success = await service.sendPasswordResetOtp({
      to: 'recipient@example.com',
      name: 'রহিম',
      otp: '654321',
      expiresInMinutes: 5,
    });

    expect(success).toBe(false);
  });

  it('falls back to simulation mode when SMTP credentials are not configured', async () => {
    const unconfiguredModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => undefined),
          },
        },
      ],
    }).compile();

    const devService = unconfiguredModule.get<EmailService>(EmailService);

    const result = await devService.sendPasswordResetOtp({
      to: 'dev@example.com',
      otp: '123456',
    });

    expect(result).toBe(true);
  });
});
