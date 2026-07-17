import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;

    // Cognito's user pool groups are the source of truth for authorization,
    // not our own User.role column, so this reads the verified JWT directly.
    const { user } = context.switchToHttp().getRequest();
    const groups: string[] = user?.['cognito:groups'] ?? [];
    return requiredRoles.some((role) => groups.includes(role));
  }
}
