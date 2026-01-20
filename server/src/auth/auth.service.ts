import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) { }

  async register(dto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create the user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        // role defaults to STUDENT from schema
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    // Generate JWT token
    const token = this.generateToken(user.id, user.email, user.role);

    return {
      user,
      access_token: token,
    };
  }

  async login(dto: LoginDto) {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate JWT token
    const token = this.generateToken(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      access_token: token,
    };
  }

  async validateGoogleUser(details: {
    email: string;
    firstName: string;
    lastName: string;
    picture: string;
    googleId: string;
  }) {
    const { email, firstName, lastName, googleId } = details;

    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      // If user exists but googleId is missing (e.g. registered via email), update it
      if (!user.googleId) {
        user = await this.prisma.user.update({
          where: { email },
          data: { googleId, provider: 'google' },
        });
      }
    } else {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email,
          name: `${firstName} ${lastName}`,
          googleId,
          provider: 'google',
          role: 'STUDENT',
        },
      });
    }

    const token = this.generateToken(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      access_token: token,
    };
  }

  private generateToken(userId: string, email: string, role: string): string {
    const payload = {
      sub: userId,
      email,
      role,
    };

    return this.jwtService.sign(payload);
  }

  async validateUser(userId: string) {
    const result = await this.prisma.$queryRaw<Array<{
      id: string;
      email: string;
      name: string | null;
      role: string;
      profilePicture: string | null;
    }>>`
      SELECT "id", "email", "name", "role", "profilePicture"
      FROM "User" 
      WHERE "id" = ${userId}
    `;

    return result[0] || null;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) {
      throw new ConflictException('User not found or uses social login');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Incorrect current password');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password updated successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      return { message: 'If this email exists, an OTP has been sent.' };
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + 15); // 15 mins expiry

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetOtp: otp,
        resetOtpExpires: expires,
      },
    });

    // Send email (async)
    this.mailService.sendPasswordResetEmail(user.email, otp).catch(err => {
      console.error('Failed to send reset email', err);
    });

    return { message: 'If this email exists, an OTP has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.resetOtp || !user.resetOtpExpires) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    if (new Date() > user.resetOtpExpires) {
      throw new UnauthorizedException('OTP has expired');
    }

    if (user.resetOtp !== dto.otp) {
      throw new UnauthorizedException('Invalid OTP');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetOtp: null,
        resetOtpExpires: null,
      },
    });

    return { message: 'Password reset successfully' };
  }

  async updateProfilePicture(userId: string, profilePicture: string) {
    console.log('[AuthService] updateProfilePicture called');
    console.log('[AuthService] userId:', userId);
    console.log('[AuthService] profilePicture length:', profilePicture?.length);

    try {
      // Use raw SQL to bypass Prisma type checking issues
      const result = await this.prisma.$executeRaw`
        UPDATE "User"
        SET "profilePicture" = ${profilePicture}
        WHERE "id" = ${userId}
      `;

      console.log('[AuthService] SQL execution result - rows affected:', result);

      //Verify it was saved
      const savedUser = await this.prisma.$queryRaw`
        SELECT "id", "profilePicture" FROM "User" WHERE "id" = ${userId}
      `;
      console.log('[AuthService] Verification query result:', savedUser);

      console.log('[AuthService] Update successful via raw SQL');
      return { message: 'Profile picture updated successfully' };
    } catch (error) {
      console.error('[AuthService] Update failed:', error);
      throw error;
    }
  }
}
