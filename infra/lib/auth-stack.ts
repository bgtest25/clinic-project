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
      // Cognito's built-in fallback is a single unstyled line ("Your username
      // is {username} and temporary password is {####}.") — this is the
      // actual invite email a clinic admin's invitee sees, so it's worth
      // looking like the product rather than a raw system message. {username}
      // and {####} are required placeholders Cognito substitutes at send time.
      userInvitation: {
        emailSubject: "You're invited to Havenote",
        emailBody: `
          <div style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a;">
            <div style="background:#0f5132;padding:24px 32px;border-radius:8px 8px 0 0;">
              <span style="color:#ffffff;font-size:20px;font-weight:600;">Havenote</span>
            </div>
            <div style="border:1px solid #e2e2e2;border-top:none;border-radius:0 0 8px 8px;padding:32px;">
              <h1 style="font-size:18px;margin:0 0 12px;">You've been invited to Havenote</h1>
              <p style="font-size:14px;line-height:1.5;color:#444;margin:0 0 20px;">
                A clinic administrator has set up an account for you on Havenote, a clinical
                documentation platform.
              </p>
              <div style="background:#f6f6f6;border-radius:6px;padding:16px 20px;margin:0 0 20px;">
                <p style="margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.03em;">Sign-in email</p>
                <p style="margin:0 0 16px;font-size:15px;font-weight:600;">{username}</p>
                <p style="margin:0 0 4px;font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.03em;">Temporary password</p>
                <p style="margin:0;font-size:15px;font-weight:600;font-family:'SFMono-Regular',Consolas,monospace;">{####}</p>
              </div>
              <p style="font-size:14px;line-height:1.5;color:#444;margin:0 0 20px;">
                Go to <a href="https://havenote.health" style="color:#0f5132;">havenote.health</a>
                and sign in with the details above. You'll be asked to set a permanent password and
                set up two-factor authentication with an authenticator app before you can continue —
                it only takes a minute.
              </p>
              <p style="font-size:12px;color:#999;margin:28px 0 0;">
                If you weren't expecting this invitation, you can safely ignore this email.
              </p>
            </div>
          </div>
        `.trim(),
      },
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
