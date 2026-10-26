import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public, SkipMfa, SkipCsrf } from './auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @SkipCsrf()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful, session cookie set' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account locked' })
  async login(
    @Body() body: { email: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      body.email,
      body.password,
      req.headers['user-agent'],
      req.ip,
    );

    // Set httpOnly, Secure, SameSite=Strict session cookie
    res.cookie('examvault_session', result.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: parseInt(process.env.SESSION_MAX_AGE_MS || '3600000', 10),
      path: '/',
    });

    return {
      success: true,
      data: {
        csrfToken: result.csrfToken,
        requireMfa: result.requireMfa,
        mustSetupMfa: result.mustSetupMfa,
      },
    };
  }

  @SkipMfa()
  @SkipCsrf()
  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Setup TOTP MFA — returns QR code' })
  async setupMfa(@Req() req: Request) {
    const result = await this.authService.setupMfa(req.userId!);
    return {
      success: true,
      data: {
        qrCodeUrl: result.qrCodeUrl,
        otpauthUrl: result.otpauthUrl,
        // secret is intentionally returned for manual entry
        secret: result.secret,
      },
    };
  }

  @SkipMfa()
  @SkipCsrf()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify TOTP token' })
  async verifyMfa(
    @Body() body: { token: string },
    @Req() req: Request,
  ) {
    const result = await this.authService.verifyMfa(req.sessionId!, body.token);
    return { success: true, data: result };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout — destroy session' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.sessionId!, req.userId!);
    res.clearCookie('examvault_session', { path: '/' });
    return { success: true };
  }

  @SkipMfa()
  @SkipCsrf()
  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Req() req: Request) {
    const user = await this.authService.getProfile(req.userId!);
    return { success: true, data: user };
  }
}
