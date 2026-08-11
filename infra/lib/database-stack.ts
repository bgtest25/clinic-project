import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export interface ClinicDatabaseStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class ClinicDatabaseStack extends cdk.Stack {
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly instance: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props: ClinicDatabaseStackProps) {
    super(scope, id, props);
    const { vpc } = props;

    const dbKey = new kms.Key(this, 'DatabaseKey', {
      alias: 'clinic-project/rds',
      enableKeyRotation: true,
    });

    // Only the app tier (ECS tasks, added later) will be granted ingress to this group.
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc,
      description: 'Access to the Clinic Project RDS instance',
      allowAllOutbound: false,
    });

    // A standalone secret (default Secrets Manager key, NOT `dbKey`) rather than
    // `rds.Credentials.fromGeneratedSecret(...)` — that helper silently ties the
    // generated secret's encryption to `storageEncryptionKey`, which would force
    // granting the ECS execution role decrypt access on `dbKey`'s policy — a
    // cross-stack cycle, since ComputeStack already depends on this stack for the
    // security group. Owning the secret directly keeps its encryption on the
    // default key, so consumers only need a plain IAM grant, one direction only.
    const masterSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      secretName: 'clinic-project/main/rds/master-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'clinic_admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
      },
    });

    this.instance = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16_4 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.dbSecurityGroup],
      // Reverted to single-AZ 2026-08-11 — pilot is still blocked on the Bedrock/
      // CloudFront AWS cases with zero real traffic, so the Multi-AZ standby (~half
      // of the RDS bill) isn't buying anything yet. Flip back to true again once the
      // pilot is actually about to go live.
      multiAz: false,
      allocatedStorage: 20,
      storageEncrypted: true,
      storageEncryptionKey: dbKey,
      // Passing the username explicitly (matching what's already deployed) keeps
      // MasterUsername a literal instead of a dynamic secret reference — the dynamic
      // form reads as a property change CloudFormation can only apply via replacement.
      credentials: rds.Credentials.fromSecret(masterSecret, 'clinic_admin'),
      databaseName: 'clinic',
      backupRetention: cdk.Duration.days(7),
      // PHI will eventually live here — protect against accidental teardown.
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }
}
