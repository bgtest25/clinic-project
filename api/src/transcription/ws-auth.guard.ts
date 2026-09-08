import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { CognitoJwtVerifier, CognitoJwtVerifierSingleUserPool } from 'aws-jwt-verify';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);
  private verifier: CognitoJwtVerifierSingleUserPool<{ userPoolId: string; clientId: string; tokenUse: 'access' }> | null = null;

  private getVerifier() {
    if (!this.verifier) {
      const userPoolId = process.env.COGNITO_USER_POOL_ID;
      const clientId = process.env.COGNITO_CLIENT_ID;
      if (!userPoolId || !clientId) {
        throw new Error('COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set');
      }
      this.verifier = CognitoJwtVerifier.create({
        userPoolId,
        clientId,
        tokenUse: 'access',
      });
    }
    return this.verifier;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const data = context.switchToWs().getData();

    const token = data?.token || client.handshake.auth?.token;
    if (!token) {
      this.logger.warn('No token provided');
      return false;
    }

    try {
      const payload = await this.getVerifier().verify(token);
      (client as any).user = { sub: payload.sub };
      return true;
    } catch (err) {
      this.logger.warn(`Invalid token: ${err}`);
      return false;
    }
  }
}
