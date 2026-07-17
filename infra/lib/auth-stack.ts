import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';

export class ClinicAuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, 'ClinicianUserPool', {
      userPoolName: 'clinic-project-clinicians',
      // Clinicians are provisioned by clinic admins, not public self-signup.
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { otp: true, sms: false },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'admin',
    });

    new cognito.CfnUserPoolGroup(this, 'ClinicianGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'clinician',
    });

    this.userPoolClient = this.userPool.addClient('ApiClient', {
      authFlows: { userPassword: true, userSrp: true },
      generateSecret: false,
    });
  }
}
