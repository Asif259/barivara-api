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
  private readonly isConfigured: boolean = false;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('smtp.host') || process.env.SMTP_HOST;
    const port = parseInt(this.configService.get<string>('smtp.port') || process.env.SMTP_PORT || '587', 10);
    const user = this.configService.get<string>('smtp.user') || process.env.SMTP_USER;
    const pass = this.configService.get<string>('smtp.pass') || process.env.SMTP_PASS;
    const secure = (this.configService.get<string>('smtp.secure') || process.env.SMTP_SECURE) === 'true' || port === 465;

    if (host && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
          // Force IPv4 to prevent ENETUNREACH / connection timeouts on cloud container platforms
          // like Render where outbound IPv6 routes are unavailable
          family: 4,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        } as nodemailer.TransportOptions);
        this.isConfigured = true;
        this.logger.log(`SMTP configured with host: ${host}:${port} (IPv4 enforced)`);
      } catch (err) {
        this.logger.error('Failed to initialize SMTP transporter', err);
      }
    } else {
      this.logger.warn('SMTP credentials not configured. Outgoing emails (OTPs) will be logged to console in dev mode.');
    }
  }

  async sendPasswordResetOtp(options: SendOtpEmailOptions): Promise<boolean> {
    const { to, name, otp, expiresInMinutes = 10 } = options;
    const fromAddress =
      this.configService.get<string>('smtp.from') ||
      process.env.SMTP_FROM ||
      'BariVara <no-reply@barivara.app>';

    const subject = 'বাড়িভাড়া পাসওয়ার্ড রিসেট ওটিপি কোড / BariVara Password Reset OTP';
    const textContent = `হ্যালো ${name || 'ব্যবহারকারী'},\n\nআপনার বাড়িভাড়া অ্যাকাউন্টের পাসওয়ার্ড পরিবর্তনের জন্য ওটিপি কোড:\n\n${otp}\n\nএই কোডটি আগামী ${expiresInMinutes} মিনিটের জন্য কার্যকর থাকবে।\nআপনি যদি পাসওয়ার্ড পরিবর্তনের অনুরোধ না করে থাকেন, তবে এই ইমেইলটি উপেক্ষা করুন।\n\nধন্যবাদ,\nবাড়িভাড়া টিম`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #059669; margin: 0; font-size: 24px; font-weight: bold;">বাড়িভাড়া / BariVara</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">স্মার্ট বাড়ি ও ভাড়া ব্যবস্থাপনা</p>
        </div>
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
          <p style="color: #334155; font-size: 15px; margin-bottom: 12px;">হ্যালো ${name || 'ব্যবহারকারী'}, আপনার পাসওয়ার্ড রিসেট ওটিপি কোড হলো:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #059669; padding: 12px 0;">
            ${otp}
          </div>
          <p style="color: #64748b; font-size: 13px; margin-top: 8px;">এই কোডটির মেয়াদ <strong>${expiresInMinutes} মিনিট</strong>।</p>
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

    if (this.isConfigured && this.transporter) {
      try {
        await this.transporter.sendMail({
          from: fromAddress,
          to,
          subject,
          text: textContent,
          html: htmlContent,
        });
        this.logger.log(`Password reset OTP email sent successfully to ${to}`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send email to ${to}:`, error);
        return false;
      }
    } else {
      // In development / local testing without SMTP, log the OTP cleanly
      this.logger.log(`[DEV EMAIL SIMULATION] To: ${to} | OTP: ${otp} | Expires in: ${expiresInMinutes}m`);
      return true;
    }
  }
}
