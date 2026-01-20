import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly apiUrl = 'https://api.brevo.com/v3/smtp/email';

  constructor() {
    this.apiKey = process.env.BREVO_API_KEY || process.env.SMTP_PASS || '';
    this.fromEmail = process.env.SMTP_FROM_EMAIL || 'alraiyanxyz@gmail.com'; // Your verified Brevo sender
    this.fromName = process.env.SMTP_FROM_NAME || 'UniFlow';

    this.logger.log(`Mail service initialized with Brevo HTTP API (300 emails/day limit)`);
  }

  async verifyConnection() {
    try {
      if (!this.apiKey) {
        throw new Error('BREVO_API_KEY not configured');
      }

      // Test API key by calling account endpoint
      await axios.get('https://api.brevo.com/v3/account', {
        headers: {
          'api-key': this.apiKey,
        },
      });

      return {
        success: true,
        message: 'Brevo API connected successfully',
        provider: 'Brevo HTTP API',
        limit: '300 emails/day'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Brevo API connection failed',
        error: error instanceof Error ? error.message : String(error),
        hint: 'Check BREVO_API_KEY environment variable'
      };
    }
  }

  async sendSeatAvailableEmail(
    to: string,
    courseCode: string,
    sectionNumber: string,
    availableSeats: number,
  ) {
    try {
      await axios.post(
        this.apiUrl,
        {
          sender: { name: this.fromName, email: this.fromEmail },
          to: [{ email: to }],
          subject: `🚨 Seat Available! ${courseCode} Section ${sectionNumber}`,
          htmlContent: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #6366f1;">Seat Alert!</h2>
              <p>Good news! A seat has just opened up in the course you're tracking.</p>
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Course:</strong> ${courseCode}</p>
                <p style="margin: 5px 0;"><strong>Section:</strong> ${sectionNumber}</p>
                <p style="margin: 5px 0;"><strong>Available Now:</strong> <span style="color: #22c55e; font-weight: bold;">${availableSeats} ${availableSeats === 1 ? 'seat' : 'seats'}</span></p>
              </div>
              <p>Go to <strong>Connect</strong> right now to grab it before someone else does!</p>
              <a href="https://connect.bracu.ac.bd/" style="display: inline-block; background-color: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Login to Connect</a>
              <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;" />
              <p style="font-size: 12px; color: #94a3b8;">This is an automated notification from UniFlow. You are receiving this because you tracked this section.</p>
            </div>
          `,
        },
        {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Email sent to ${to} via Brevo API`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${to}: ${errorMessage}`);
      throw error;
    }
  }

  async sendPasswordResetEmail(to: string, otp: string) {
    try {
      await axios.post(
        this.apiUrl,
        {
          sender: { name: 'UniFlow Security', email: this.fromEmail },
          to: [{ email: to }],
          subject: `Password Reset Request - UniFlow`,
          htmlContent: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
              <h2 style="color: #6366f1;">Reset Your Password</h2>
              <p>We received a request to reset your password. Use the OTP below to complete the process.</p>
              <div style="background-color: #ede9fe; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4f46e5;">${otp}</span>
              </div>
              <p>This code will expire in 15 minutes.</p>
              <p>If you didn't request this, you can safely ignore this email.</p>
              <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;" />
              <p style="font-size: 12px; color: #94a3b8;">UniFlow Security Team</p>
            </div>
          `,
        },
        {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Password reset email sent to ${to} via Brevo API`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send password reset email to ${to}: ${errorMessage}`);
      throw error;
    }
  }
}
