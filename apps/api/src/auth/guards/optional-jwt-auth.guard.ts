import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { SESSION_COOKIE_NAME } from '../constants';
import type { SessionPayload } from './jwt-auth.guard';

// Like JwtAuthGuard, but never rejects — attaches request.user if a
// valid session cookie is present, otherwise leaves it undefined and
// lets the request through anyway. For routes that are public but
// behave differently for an authenticated owner (GET /jobs/:id must
// show draft/closed jobs to the owning employer, 404 to everyone else).
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token: unknown = request.cookies?.[SESSION_COOKIE_NAME];

    if (typeof token === 'string' && token) {
      try {
        const payload = this.jwtService.verify<SessionPayload>(token);
        (request as Request & { user?: SessionPayload }).user = payload;
      } catch {
        // Invalid/expired token on a public route — proceed as anonymous
        // rather than rejecting; the route itself is public either way.
      }
    }

    return true;
  }
}
