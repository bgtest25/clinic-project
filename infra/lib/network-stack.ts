import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';

export class ClinicNetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const flowLogKey = new kms.Key(this, 'FlowLogsKey', {
      alias: 'clinic-project/vpc-flow-logs',
      enableKeyRotation: true,
    });

    // CloudWatch Logs needs an explicit grant on the key, scoped to log groups in this account/region
    flowLogKey.addToResourcePolicy(
      new iam.PolicyStatement({
        principals: [new iam.ServicePrincipal(`logs.${this.region}.amazonaws.com`)],
        actions: ['kms:Encrypt*', 'kms:Decrypt*', 'kms:ReEncrypt*', 'kms:GenerateDataKey*', 'kms:Describe*'],
        resources: ['*'],
        conditions: {
          ArnLike: { 'kms:EncryptionContext:aws:logs:arn': `arn:aws:logs:${this.region}:${this.account}:*` },
        },
      }),
    );

    const flowLogGroup = new logs.LogGroup(this, 'VpcFlowLogGroup', {
      logGroupName: '/clinic-project/vpc-flow-logs',
      retention: logs.RetentionDays.ONE_YEAR,
      encryptionKey: flowLogKey,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.vpc = new ec2.Vpc(this, 'ClinicVpc', {
      vpcName: 'clinic-project-vpc',
      maxAzs: 2,
      // Single NAT gateway to control cost at pilot stage; bump to one-per-AZ once
      // traffic/revenue justifies the added availability.
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'private-app', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
        // No route to the internet at all for the data tier (RDS lives here).
        { name: 'private-data', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
      flowLogs: {
        'all-traffic': {
          destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup),
          trafficType: ec2.FlowLogTrafficType.ALL,
        },
      },
    });
  }
}
