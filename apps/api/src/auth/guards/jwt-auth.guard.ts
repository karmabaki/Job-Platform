import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { SESSION_COOKIE_NAME } from '../constants';

export interface SessionPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token: unknown = request.cookies?.[SESSION_COOKIE_NAME];

    if (typeof token !== 'string' || !token) {
      throw new UnauthorizedException('Not authenticated.');
    }

    try {
      const payload = this.jwtService.verify<SessionPayload>(token);
      (request as Request & { user: SessionPayload }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Not authenticated.');
    }
  }
}
