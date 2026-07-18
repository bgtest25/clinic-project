import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  private readonly cognito = new CognitoIdentityProviderClient({});

  constructor(private readonly prisma: PrismaService) {}

  findByCognitoSub(cognitoSub: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { cognitoSub } });
  }

  // Admin-provisioned only (selfSignUpEnabled: false on the pool) — creates
  // the Cognito account first (temp password + invite email are Cognito's
  // own default behavior, no email infra of our own needed), then mirrors it
  // into Postgres. Cognito user pool groups are the actual authorization
  // source (see RolesGuard) — this User.role column is a display/query
  // convenience kept in sync with the group, not itself authoritative.
  async invite(dto: CreateUserDto) {
    const userPoolId = process.env.COGNITO_USER_POOL_ID;

    const created = await this.cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: dto.email,
        UserAttributes: [
          { Name: 'email', Value: dto.email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: dto.name },
        ],
        DesiredDeliveryMediums: ['EMAIL'],
      }),
    );

    const cognitoSub = created.User?.Attributes?.find((attr) => attr.Name === 'sub')?.Value;
    if (!cognitoSub) {
      throw new InternalServerErrorException('Cognito did not return a sub for the new user');
    }

    await this.cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: dto.email,
        GroupName: dto.role === 'ADMIN' ? 'admin' : 'clinician',
      }),
    );

    try {
      return await this.prisma.user.create({
        data: {
          cognitoSub,
          email: dto.email,
          name: dto.name,
          role: dto.role,
          clinicId: dto.clinicId,
        },
      });
    } catch (err) {
      // Don't leave a Cognito account with no matching User row (e.g. a
      // duplicate email or bad clinicId failing the DB write) — undo the
      // Cognito side rather than leaving an orphaned, unusable invite.
      await this.cognito
        .send(new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: dto.email }))
        .catch(() => {});
      throw err;
    }
  }
}
