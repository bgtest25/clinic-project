import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const createMockContext = (userGroups?: string[]): ExecutionContext => {
    const request = {
      user: userGroups ? { 'cognito:groups': userGroups } : undefined,
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('returns true when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext(['clinician']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('returns true when user has a matching role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const context = createMockContext(['clinician', 'admin']);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('returns false when user lacks the required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const context = createMockContext(['clinician']);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('returns false when user has no groups', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const context = createMockContext([]);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('returns false when user object is undefined', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin']);
    const context = createMockContext(undefined);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('returns true when user has any one of multiple required roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['admin', 'superuser']);
    const context = createMockContext(['superuser']);
    expect(guard.canActivate(context)).toBe(true);
  });
});
