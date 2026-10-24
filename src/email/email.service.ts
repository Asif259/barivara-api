import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface SendOtpEmailOptions {
  to: string;
  name?: string;
  otp: string;
  expiresInMinutes?: number;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly provider: 'smtp' | 'none' = 'none';

  constructor(private readonly configService: ConfigService) {
    const smtpUser =
      this.configService.get<string>('SMTP_USER') ||
      this.configService.get<string>('smtp.user');
    const smtpPass =
      this.configService.get<string>('SMTP_PASS') ||
      this.configService.get<string>('smtp.pass');
    const smtpHost =
      this.configService.get<string>('SMTP_HOST') ||
      this.configService.get<string>('smtp.host') ||
      'smtp.gmail.com';
    const smtpPort = Number(
      this.configService.get<number>('SMTP_PORT') ||
        this.configService.get<number>('smtp.port') ||
        465,
    );
    const smtpSecure =
      this.configService.get<boolean>('smtp.secure') ?? (smtpPort === 465);

    if (smtpUser && smtpPass) {
      try {
        this.transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpSecure,
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
          connectionTimeout: 10000, // 10s connection timeout
          greetingTimeout: 10000,
          socketTimeout: 15000,
        });
        this.provider = 'smtp';
        this.logger.log(`Email provider initialized: Gmail SMTP (${smtpHost}:${smtpPort})`);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to initialize SMTP transporter: ${errMsg}`);
      }
    } else {
      this.logger.warn(
        'SMTP credentials not configured. Outgoing emails (OTPs) will be logged to console in dev mode.',
      );
    }
  }

  async sendPasswordResetOtp(options: SendOtpEmailOptions): Promise<boolean> {
    const { to, name, otp, expiresInMinutes = 5 } = options;
    const smtpUser =
      this.configService.get<string>('SMTP_USER') ||
      this.configService.get<string>('smtp.user');

    const fromAddress =
      this.configService.get<string>('SMTP_FROM') ||
      this.configService.get<string>('smtp.from') ||
      (smtpUser ? `BariVara <${smtpUser}>` : 'BariVara <noreply@gmail.com>');

    const subject = 'বাড়িভাড়া পাসওয়ার্ড রিসেট ওটিপি কোড / BariVara Password Reset OTP';
    const textContent = `হ্যালো ${name || 'ব্যবহারকারী'},\n\nআপনার বাড়িভাড়া অ্যাকাউন্টের পাসওয়ার্ড রিসেটের জন্য ওটিপি কোড:\n\n${otp}\n\nএই কোডটির মেয়াদ ${expiresInMinutes} মিনিট।\n\nনিরাপত্তা সতর্কতা: এই ওটিপি কোডটি কারো সাথে শেয়ার করবেন না। বাড়িভাড়া কর্তৃপক্ষ কখনোই আপনার নিকট থেকে ওটিপি কোড জানতে চাইবে না।\n\nআপনি যদি পাসওয়ার্ড পরিবর্তনের অনুরোধ না করে থাকেন, তবে এই বার্তাটি নিরাপদে উপেক্ষা করুন। আপনার অ্যাকাউন্ট সুরক্ষিত রয়েছে।\n\nধন্যবাদ,\nবাড়িভাড়া টিম`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #12664F; margin: 0; font-size: 26px; font-weight: bold;">বাড়িভাড়া / BariVara</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">স্মার্ট বাড়ি ও ভাড়া ব্যবস্থাপনা</p>
        </div>
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
          <p style="color: #334155; font-size: 15px; margin-bottom: 12px;">হ্যালো ${name || 'ব্যবহারকারী'}, আপনার পাসওয়ার্ড রিসেট ওটিপি কোড হলো:</p>
          <div style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #12664F; padding: 12px 0; font-family: monospace;">
            ${otp}
          </div>
          <p style="color: #64748b; font-size: 13px; margin-top: 8px;">এই কোডটির মেয়াদ <strong>${expiresInMinutes} মিনিট</strong>।</p>
        </div>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 12px; margin-bottom: 20px;">
          <p style="color: #991b1b; font-size: 12px; margin: 0; line-height: 1.5;">
            <strong>নিরাপত্তা সতর্কতা:</strong> এই ওটিপি কোডটি কারো সাথে শেয়ার করবেন না। বাড়িভাড়া কর্তৃপক্ষ কখনোই আপনার নিকট থেকে কোড চাইবে না।
          </p>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
          আপনি যদি পাসওয়ার্ড পরিবর্তনের জন্য কোনো অনুরোধ না করে থাকেন, তবে নির্দ্বিধায় এই বার্তাটি উপেক্ষা করুন। আপনার অ্যাকাউন্ট সুরক্ষিত আছে।
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
          © ${new Date().getFullYear()} BariVara. সর্বস্বত্ব সংরক্ষিত।
        </p>
      </div>
    `;

    if (this.provider === 'smtp' && this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: fromAddress,
          to,
          subject,
          text: textContent,
          html: htmlContent,
        });

        this.logger.log(
          `Password reset OTP email accepted by SMTP server for ${to} (messageId: ${info.messageId})`,
        );
        return true;
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to send email via SMTP to ${to}: ${errMsg}`);
        return false;
      }
    }

    // In development / local testing without SMTP, log the OTP cleanly
    this.logger.log(`[DEV EMAIL SIMULATION] To: ${to} | OTP: ${otp} | Expires in: ${expiresInMinutes}m`);
    return true;
  }
}
