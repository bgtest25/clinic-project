import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);
  private readonly verifier = CognitoJwtVerifier.create({
    userPoolId: process.env.COGNITO_USER_POOL_ID!,
    clientId: process.env.COGNITO_CLIENT_ID!,
    tokenUse: 'access',
  });

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const data = context.switchToWs().getData();

    const token = data?.token || client.handshake.auth?.token;
    if (!token) {
      this.logger.warn('No token provided');
      return false;
    }

    try {
      const payload = await this.verifier.verify(token);
      (client as any).user = { sub: payload.sub };
      return true;
    } catch (err) {
      this.logger.warn(`Invalid token: ${err}`);
      return false;
    }
  }
}
