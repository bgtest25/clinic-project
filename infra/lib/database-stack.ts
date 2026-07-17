import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as rds from 'aws-cdk-lib/aws-rds';

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

    this.instance = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16_4 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [this.dbSecurityGroup],
      // Single-AZ during build/pilot-prep to control cost — flip to true before
      // the real clinic pilot goes live (Phase 5). Online change, no rearchitecture.
      multiAz: false,
      allocatedStorage: 20,
      storageEncrypted: true,
      storageEncryptionKey: dbKey,
      credentials: rds.Credentials.fromGeneratedSecret('clinic_admin', {
        secretName: 'clinic-project/main/rds/master-credentials',
        encryptionKey: dbKey,
      }),
      databaseName: 'clinic',
      backupRetention: cdk.Duration.days(7),
      // PHI will eventually live here — protect against accidental teardown.
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }
}
