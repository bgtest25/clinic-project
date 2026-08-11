import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as config from 'aws-cdk-lib/aws-config';
import * as events from 'aws-cdk-lib/aws-events';
import * as eventsTargets from 'aws-cdk-lib/aws-events-targets';
import * as sns from 'aws-cdk-lib/aws-sns';

export interface ClinicConfigRulesStackProps extends cdk.StackProps {
  alarmTopic: sns.ITopic;
}

// Baseline AWS Config rule pack — the Config recorder itself was already
// enabled account-wide (baseline, not CDK-managed) but had zero rules
// attached, so nothing was actually being evaluated. Found in the same
// 2026-08-11 resource audit that turned up the missing CloudWatch alarms.
// Scoped to what this account actually runs (S3/RDS/IAM/VPC/Lambda), plus a
// couple of regression checks on baseline services (CloudTrail/GuardDuty)
// that are already on but weren't being watched for drift.
export class ClinicConfigRulesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ClinicConfigRulesStackProps) {
    super(scope, id, props);
    const { alarmTopic } = props;

    // --- S3 ---
    new config.ManagedRule(this, 'S3PublicReadProhibited', {
      identifier: config.ManagedRuleIdentifiers.S3_BUCKET_PUBLIC_READ_PROHIBITED,
    });
    new config.ManagedRule(this, 'S3PublicWriteProhibited', {
      identifier: config.ManagedRuleIdentifiers.S3_BUCKET_PUBLIC_WRITE_PROHIBITED,
    });
    new config.ManagedRule(this, 'S3ServerSideEncryptionEnabled', {
      identifier: config.ManagedRuleIdentifiers.S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED,
    });
    new config.ManagedRule(this, 'S3SslRequestsOnly', {
      identifier: config.ManagedRuleIdentifiers.S3_BUCKET_SSL_REQUESTS_ONLY,
    });

    // --- RDS ---
    new config.ManagedRule(this, 'RdsStorageEncrypted', {
      identifier: config.ManagedRuleIdentifiers.RDS_STORAGE_ENCRYPTED,
    });
    new config.ManagedRule(this, 'RdsInstancePublicAccessCheck', {
      identifier: config.ManagedRuleIdentifiers.RDS_INSTANCE_PUBLIC_ACCESS_CHECK,
    });
    new config.ManagedRule(this, 'RdsMultiAzSupport', {
      identifier: config.ManagedRuleIdentifiers.RDS_MULTI_AZ_SUPPORT,
    });

    // --- IAM / credential hygiene (the root-usage GuardDuty finding lives here) ---
    new config.ManagedRule(this, 'RootAccountMfaEnabled', {
      identifier: config.ManagedRuleIdentifiers.ROOT_ACCOUNT_MFA_ENABLED,
    });
    new config.ManagedRule(this, 'IamUserMfaEnabled', {
      identifier: config.ManagedRuleIdentifiers.IAM_USER_MFA_ENABLED,
    });
    new config.ManagedRule(this, 'IamRootAccessKeyCheck', {
      identifier: config.ManagedRuleIdentifiers.IAM_ROOT_ACCESS_KEY_CHECK,
    });
    // maxAge has a documented 90-day default, but this CDK version doesn't actually
    // pass it through to CloudFormation unless set explicitly — omitting it fails
    // deploy with "required parameter [maxAccessKeyAge] is not present".
    new config.AccessKeysRotated(this, 'AccessKeysRotated', {
      maxAge: cdk.Duration.days(90),
    });

    // --- Network exposure ---
    new config.ManagedRule(this, 'VpcDefaultSecurityGroupClosed', {
      identifier: config.ManagedRuleIdentifiers.VPC_DEFAULT_SECURITY_GROUP_CLOSED,
    });
    new config.ManagedRule(this, 'RestrictedIncomingTraffic', {
      identifier: config.ManagedRuleIdentifiers.EC2_SECURITY_GROUPS_RESTRICTED_INCOMING_TRAFFIC,
      // Postgres, RDP, SSH — none of these should ever be open to 0.0.0.0/0 in this
      // account (the RDS SG only allows ingress from the ECS app-tier SG), so this
      // is a defense-in-depth regression check, not expected to ever fire today.
      inputParameters: {
        blockedPort1: '5432',
        blockedPort2: '3389',
        blockedPort3: '22',
      },
    });

    // --- Lambda ---
    new config.ManagedRule(this, 'LambdaFunctionPublicAccessProhibited', {
      identifier: config.ManagedRuleIdentifiers.LAMBDA_FUNCTION_PUBLIC_ACCESS_PROHIBITED,
    });

    // --- Baseline logging/detection regression checks ---
    new config.ManagedRule(this, 'CloudTrailEnabled', {
      identifier: config.ManagedRuleIdentifiers.CLOUD_TRAIL_ENABLED,
    });
    new config.ManagedRule(this, 'GuardDutyEnabledCentralized', {
      identifier: config.ManagedRuleIdentifiers.GUARDDUTY_ENABLED_CENTRALIZED,
    });

    // Config rules only record compliance state on their own — nothing paged
    // anyone without this. Route NON_COMPLIANT transitions into the same
    // alarm topic the CloudWatch alarms use, so this is one inbox, not two.
    new events.Rule(this, 'NonCompliantNotifier', {
      description: 'Notify clinic-project-alerts on any Config rule going NON_COMPLIANT',
      eventPattern: {
        source: ['aws.config'],
        detailType: ['Config Rules Compliance Change'],
        detail: {
          messageType: ['ComplianceChangeNotification'],
          newEvaluationResult: {
            complianceType: ['NON_COMPLIANT'],
          },
        },
      },
      targets: [new eventsTargets.SnsTopic(alarmTopic)],
    });
  }
}
