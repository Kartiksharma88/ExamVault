"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthGuard = exports.SkipCsrf = exports.SKIP_CSRF_KEY = exports.SkipMfa = exports.SKIP_MFA_KEY = exports.Roles = exports.ROLES_KEY = exports.Public = exports.IS_PUBLIC_KEY = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const auth_service_1 = require("./auth.service");
// Decorator to mark routes as public (no auth required)
exports.IS_PUBLIC_KEY = 'isPublic';
const Public = () => (0, common_1.SetMetadata)(exports.IS_PUBLIC_KEY, true);
exports.Public = Public;
// Decorator for required roles
exports.ROLES_KEY = 'roles';
const Roles = (...roles) => (0, common_1.SetMetadata)(exports.ROLES_KEY, roles);
exports.Roles = Roles;
// Decorator to skip MFA check (for MFA setup/verify routes)
exports.SKIP_MFA_KEY = 'skipMfa';
const SkipMfa = () => (0, common_1.SetMetadata)(exports.SKIP_MFA_KEY, true);
exports.SkipMfa = SkipMfa;
// Decorator to skip CSRF check (for GET routes)
exports.SKIP_CSRF_KEY = 'skipCsrf';
const SkipCsrf = () => (0, common_1.SetMetadata)(exports.SKIP_CSRF_KEY, true);
exports.SkipCsrf = SkipCsrf;
let AuthGuard = class AuthGuard {
    authService;
    reflector;
    constructor(authService, reflector) {
        this.authService = authService;
        this.reflector = reflector;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(exports.IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic)
            return true;
        const request = context.switchToHttp().getRequest();
        // Extract session from cookie
        const sessionId = request.cookies?.examvault_session;
        if (!sessionId) {
            throw new common_1.UnauthorizedException('No session cookie');
        }
        // Validate session
        const session = await this.authService.validateSession(sessionId);
        if (!session) {
            throw new common_1.UnauthorizedException('Invalid or expired session');
        }
        // Check MFA
        const skipMfa = this.reflector.getAllAndOverride(exports.SKIP_MFA_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!skipMfa && !session.mfaVerified) {
            throw new common_1.ForbiddenException('MFA verification required');
        }
        // CSRF check for state-changing methods
        const skipCsrf = this.reflector.getAllAndOverride(exports.SKIP_CSRF_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!skipCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
            const csrfToken = request.headers['x-csrf-token'];
            if (!csrfToken || csrfToken !== session.csrfToken) {
                throw new common_1.ForbiddenException('Invalid CSRF token');
            }
        }
        // Role check
        const requiredRoles = this.reflector.getAllAndOverride(exports.ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (requiredRoles && !requiredRoles.includes(session.role)) {
            throw new common_1.ForbiddenException('Insufficient permissions');
        }
        // Attach user info to request
        request.userId = session.userId;
        request.userRole = session.role;
        request.sessionId = sessionId;
        request.csrfToken = session.csrfToken;
        return true;
    }
};
exports.AuthGuard = AuthGuard;
exports.AuthGuard = AuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        core_1.Reflector])
], AuthGuard);
//# sourceMappingURL=auth.guard.js.map