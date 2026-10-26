import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from './auth.service';

// Decorator to mark routes as public (no auth required)
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Decorator for required roles
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

// Decorator to skip MFA check (for MFA setup/verify routes)
export const SKIP_MFA_KEY = 'skipMfa';
export const SkipMfa = () => SetMetadata(SKIP_MFA_KEY, true);

// Decorator to skip CSRF check (for GET routes)
export const SKIP_CSRF_KEY = 'skipCsrf';
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);

// Extend Express Request with user info
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userRole?: string;
      sessionId?: string;
    }
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();

    // Extract session from cookie
    const sessionId = request.cookies?.examvault_session;
    if (!sessionId) {
      throw new UnauthorizedException('No session cookie');
    }

    // Validate session
    const session = await this.authService.validateSession(sessionId);
    if (!session) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // Check MFA
    const skipMfa = this.reflector.getAllAndOverride<boolean>(SKIP_MFA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!skipMfa && !session.mfaVerified) {
      throw new ForbiddenException('MFA verification required');
    }

    // CSRF check for state-changing methods
    const skipCsrf = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!skipCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const csrfToken = request.headers['x-csrf-token'] as string;
      if (!csrfToken || csrfToken !== session.csrfToken) {
        throw new ForbiddenException('Invalid CSRF token');
      }
    }

    // Role check
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles && !requiredRoles.includes(session.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    // Attach user info to request
    request.userId = session.userId;
    request.userRole = session.role;
    request.sessionId = sessionId;

    return true;
  }
}
