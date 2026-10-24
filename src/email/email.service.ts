import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Resend } from 'resend';

export interface SendOtpEmailOptions {
  to: string;
  name?: string;
  otp: string;
  expiresInMinutes?: number;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly provider: 'resend' | 'none' = 'none';

  constructor(private readonly configService: ConfigService) {
    const resendApiKey =
      this.configService.get<string>('RESEND_API_KEY');

    if (resendApiKey) {
      try {
        this.resend = new Resend(resendApiKey);
        this.provider = 'resend';
        this.logger.log('Email provider initialized: Resend (HTTPS API)');
        return;
      } catch (err) {
        this.logger.error('Failed to initialize Resend client', err);
      }
    } else {
      this.logger.warn('Resend credentials not configured. Outgoing emails (OTPs) will be logged to console in dev mode.');
    }
  }

  async sendPasswordResetOtp(options: SendOtpEmailOptions): Promise<boolean> {
    const { to, name, otp, expiresInMinutes = 5 } = options;
    const fromAddress =
      this.configService.get<string>('RESEND_FROM') ||
      this.configService.get<string>('RESEND_FROM_EMAIL') ||
      'BariVara <onboarding@resend.dev>';

    const subject = 'বাড়িভাড়া পাসওয়ার্ড রিসেট ওটিপি কোড / BariVara Password Reset OTP';
    const textContent = `হ্যালো ${name || 'ব্যবহারকারী'},\n\nআপনার বাড়িভাড়া অ্যাকাউন্টের পাসওয়ার্ড রিসেটের জন্য ওটিপি কোড:\n\n${otp}\n\nএই কোডটির মেয়াদ ${expiresInMinutes} মিনিট।\n\nনিরাপত্তা সতর্কতা: এই ওটিপি কোডটি কারো সাথে শেয়ার করবেন না। বাড়িভাড়া কর্তৃপক্ষ কখনোই আপনার নিকট থেকে ওটিপি কোড জানতে চাইবে না।\n\nআপনি যদি পাসওয়ার্ড পরিবর্তনের অনুরোধ না করে থাকেন, তবে এই বার্তাটি নিরাপদে উপেক্ষা করুন। আপনার অ্যাকাউন্ট সুরক্ষিত রয়েছে।\n\nধন্যবাদ,\nবাড়িভাড়া টিম`;

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #12664F; margin: 0; font-size: 26px; font-weight: bold;">বাড়িভাড়া / BariVara</h1>
          <p style="color: #64748b; font-size: 14px; margin-top: 4px;">স্মارت বাড়ি ও ভাড়া ব্যবস্থাপনা</p>
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

    if (this.provider === 'resend' && this.resend) {
      try {
        const { data, error } = await this.resend.emails.send({
          from: fromAddress,
          to: [to],
          subject,
          text: textContent,
          html: htmlContent,
        });

        if (error) {
          this.logger.error(`Resend API error sending email to ${to}: ${error.message}`);
          return false;
        }

        this.logger.log(`Password reset OTP email sent via Resend to ${to} (id: ${data?.id})`);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send email via Resend to ${to}:`, error);
        return false;
      }
    }

    // In development / local testing without Resend, log the OTP cleanly
    this.logger.log(`[DEV EMAIL SIMULATION] To: ${to} | OTP: ${otp} | Expires in: ${expiresInMinutes}m`);
    return true;
  }
}
