import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(MailService.name);

  constructor() {
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port,
      secure: port === 465, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      return { success: true, message: 'SMTP Connection established successfully' };
    } catch (error) {
      return {
        success: false,
        message: 'SMTP Connection failed',
        error: error instanceof Error ? error.message : String(error),
        config: {
          host: (this.transporter.options as any).host,
          port: (this.transporter.options as any).port,
          user: (this.transporter.options as any).auth?.user ? 'Has Value' : 'MISSING',
        }
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
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"UniFlow Notifications" <noreply@uniflow.com>',
        to,
        subject: `🚨 Seat Available! ${courseCode} Section ${sectionNumber}`,
        html: `
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
      });
      this.logger.log(`Email sent to ${to}: ${info.messageId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${to}: ${errorMessage}`);
    }
  }

  async sendPasswordResetEmail(to: string, otp: string) {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"UniFlow Security" <security@uniflow.com>',
        to,
        subject: `Password Reset Request - UniFlow`,
        html: `
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
      });
      this.logger.log(`Password reset email sent to ${to}: ${info.messageId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send password reset email to ${to}: ${errorMessage}`);
    }
  }
}
