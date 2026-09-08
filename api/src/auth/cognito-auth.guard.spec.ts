import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { CognitoAuthGuard } from './cognito-auth.guard';

const mockVerify = jest.fn();
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: () => ({ verify: mockVerify }),
  },
}));

describe('CognitoAuthGuard', () => {
  let guard: CognitoAuthGuard;

  const createMockContext = (authHeader?: string): ExecutionContext => {
    const request = { headers: { authorization: authHeader }, user: undefined };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    guard = new CognitoAuthGuard();
    mockVerify.mockReset();
  });

  it('throws UnauthorizedException when auth header is missing', async () => {
    const context = createMockContext(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Missing bearer token');
  });

  it('throws UnauthorizedException when auth header does not start with Bearer', async () => {
    const context = createMockContext('Basic abc123');
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Missing bearer token');
  });

  it('throws UnauthorizedException when token verification fails', async () => {
    mockVerify.mockRejectedValue(new Error('Token expired'));
    const context = createMockContext('Bearer invalid-token');
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Invalid token');
  });

  it('sets req.user and returns true when token is valid', async () => {
    const mockPayload = { sub: 'user-123', 'cognito:groups': ['clinician'] };
    mockVerify.mockResolvedValue(mockPayload);

    const request = { headers: { authorization: 'Bearer valid-token' }, user: undefined };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toEqual(mockPayload);
    expect(mockVerify).toHaveBeenCalledWith('valid-token');
  });
});
