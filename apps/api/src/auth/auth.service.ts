import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AuthService {
  private readonly sessionMaxAge: number;
  private readonly idleTimeout: number;
  private readonly maxLoginAttempts = 5;
  private readonly lockoutDuration = 15 * 60 * 1000; // 15 minutes

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private audit: AuditService,
  ) {
    this.sessionMaxAge = parseInt(this.config.get('SESSION_MAX_AGE_MS') || '3600000', 10);
    this.idleTimeout = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Hash a password with Argon2id
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,  // 64MB
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verify a password against Argon2id hash
   */
  async verifyPassword(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  /**
   * Login — Step 1: Verify credentials, return pending-MFA session
   */
  async login(
    email: string,
    password: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<{ sessionId: string; csrfToken: string; requireMfa: boolean; mustSetupMfa: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      await this.audit.log({
        action: 'LOGIN_FAILURE',
        targetType: 'user',
        targetId: email,
        metadata: { reason: 'invalid_credentials' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILURE',
        targetType: 'user',
        targetId: user.id,
        metadata: { reason: 'account_locked' },
      });
      throw new ForbiddenException('Account is temporarily locked. Try again later.');
    }

    // Verify password
    const valid = await this.verifyPassword(user.passwordHash, password);
    if (!valid) {
      const attempts = user.loginAttempts + 1;
      const updateData: any = { loginAttempts: attempts };
      if (attempts >= this.maxLoginAttempts) {
        updateData.lockedUntil = new Date(Date.now() + this.lockoutDuration);
      }
      await this.prisma.user.update({ where: { id: user.id }, data: updateData });

      await this.audit.log({
        actorId: user.id,
        action: 'LOGIN_FAILURE',
        targetType: 'user',
        targetId: user.id,
        metadata: { reason: 'wrong_password', attempts },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset login attempts on successful password verification
    await this.prisma.user.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    });

    // Create session
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        csrfToken,
        mfaVerified: !user.mfaEnabled, // If MFA not set up yet, mark as verified
        expiresAt: new Date(Date.now() + this.sessionMaxAge),
        userAgent,
        ipAddress,
      },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'LOGIN_SUCCESS',
      targetType: 'session',
      targetId: session.id,
      metadata: { mfaRequired: user.mfaEnabled },
    });

    return {
      sessionId: session.id,
      csrfToken,
      requireMfa: user.mfaEnabled,
      mustSetupMfa: user.mustSetupMfa,
    };
  }

  /**
   * Setup MFA — Generate TOTP secret and QR code
   */
  async setupMfa(userId: string): Promise<{ secret: string; qrCodeUrl: string; otpauthUrl: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: 'ExamVault',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    const otpauthUrl = totp.toString();
    const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

    // Store secret (in production, this should also be encrypted)
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaSecret: secret.base32 },
    });

    await this.audit.log({
      actorId: userId,
      action: 'MFA_SETUP',
      targetType: 'user',
      targetId: userId,
    });

    return { secret: secret.base32, qrCodeUrl, otpauthUrl };
  }

  /**
   * Verify MFA token and enable MFA if first time
   */
  async verifyMfa(sessionId: string, token: string): Promise<{ verified: boolean }> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    const user = session.user;
    if (!user.mfaSecret) {
      throw new BadRequestException('MFA not set up. Call /auth/mfa/setup first.');
    }

    const totp = new OTPAuth.TOTP({
      issuer: 'ExamVault',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(user.mfaSecret),
    });

    const delta = totp.validate({ token, window: 1 });
    if (delta === null) {
      await this.audit.log({
        actorId: user.id,
        action: 'MFA_FAILURE',
        targetType: 'session',
        targetId: sessionId,
      });
      throw new UnauthorizedException('Invalid MFA token');
    }

    // Enable MFA if first verification
    if (!user.mfaEnabled) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { mfaEnabled: true, mustSetupMfa: false },
      });
    }

    // Mark session as MFA verified
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { mfaVerified: true },
    });

    await this.audit.log({
      actorId: user.id,
      action: 'MFA_VERIFY',
      targetType: 'session',
      targetId: sessionId,
    });

    return { verified: true };
  }

  /**
   * Validate session and return user — used by auth guard
   */
  async validateSession(sessionId: string): Promise<{
    userId: string;
    role: string;
    mfaVerified: boolean;
    mustSetupMfa: boolean;
    csrfToken: string;
  } | null> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session) return null;

    // Check expiry
    if (session.expiresAt < new Date()) {
      await this.prisma.session.delete({ where: { id: sessionId } });
      return null;
    }

    // Check idle timeout
    const idleTime = Date.now() - session.lastActive.getTime();
    if (idleTime > this.idleTimeout) {
      await this.prisma.session.delete({ where: { id: sessionId } });
      return null;
    }

    // Update last active
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastActive: new Date() },
    });

    return {
      userId: session.userId,
      role: session.user.role,
      mfaVerified: session.mfaVerified,
      mustSetupMfa: session.user.mustSetupMfa,
      csrfToken: session.csrfToken,
    };
  }

  /**
   * Logout — destroy session
   */
  async logout(sessionId: string, userId: string): Promise<void> {
    await this.prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    await this.audit.log({
      actorId: userId,
      action: 'LOGOUT',
      targetType: 'session',
      targetId: sessionId,
    });
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        mfaEnabled: true,
        mustSetupMfa: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return user;
  }
}
