import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

type Verifier = ReturnType<typeof CognitoJwtVerifier.create>;
let verifier: Verifier | undefined;

// Built lazily, on first use, so the app can still boot (e.g. for /health) when
// Cognito env vars aren't configured yet, instead of crashing at import time.
function getVerifier(): Verifier {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID!,
      tokenUse: 'access',
      clientId: process.env.COGNITO_CLIENT_ID!,
    });
  }
  return verifier;
}

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      request.user = await getVerifier().verify(authHeader.slice('Bearer '.length));
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
