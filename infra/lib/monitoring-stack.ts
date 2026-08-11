import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';

export interface ClinicMonitoringStackProps extends cdk.StackProps {
  dbInstance: rds.DatabaseInstance;
  apiService: ecsPatterns.ApplicationLoadBalancedFargateService;
  processTranscriptFn: lambdaNode.NodejsFunction;
  pipelineStateMachine: sfn.StateMachine;
  alertEmail: string;
}

// Baseline operational alarm set — first automated alerting this account has
// had (found via an AWS resource audit 2026-08-11 that zero alarms existed).
// Deliberately not exhaustive: covers the failure modes that would otherwise
// go unnoticed entirely (service down, DB nearly full, pipeline erroring),
// not every metric CloudWatch offers.
export class ClinicMonitoringStack extends cdk.Stack {
  public readonly alarmTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: ClinicMonitoringStackProps) {
    super(scope, id, props);
    const { dbInstance, apiService, processTranscriptFn, pipelineStateMachine, alertEmail } = props;

    this.alarmTopic = new sns.Topic(this, 'AlarmTopic', {
      topicName: 'clinic-project-alerts',
    });
    this.alarmTopic.addSubscription(new subscriptions.EmailSubscription(alertEmail));

    const notify = new cwActions.SnsAction(this.alarmTopic);
    const alarm = (
      alarmId: string,
      alarmProps: Omit<cloudwatch.AlarmProps, 'actionsEnabled'>,
    ): cloudwatch.Alarm => {
      const a = new cloudwatch.Alarm(this, alarmId, alarmProps);
      a.addAlarmAction(notify);
      a.addOkAction(notify);
      return a;
    };

    // --- RDS ---
    alarm('DbCpuHigh', {
      alarmDescription: 'RDS CPU utilization sustained above 80%',
      metric: dbInstance.metricCPUUtilization({ period: cdk.Duration.minutes(5) }),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    alarm('DbFreeStorageLow', {
      alarmDescription: 'RDS free storage below 4 GiB (20 GiB allocated)',
      metric: dbInstance.metricFreeStorageSpace({ period: cdk.Duration.minutes(5) }),
      threshold: 4 * 1024 * 1024 * 1024,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    alarm('DbFreeableMemoryLow', {
      alarmDescription: 'RDS freeable memory below 100 MiB (db.t4g.micro has 1 GiB total)',
      metric: dbInstance.metricFreeableMemory({ period: cdk.Duration.minutes(5) }),
      threshold: 100 * 1024 * 1024,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // --- ECS / ALB (API service) ---
    alarm('ApiUnhealthyHosts', {
      alarmDescription: 'API target group has an unhealthy host',
      metric: apiService.targetGroup.metrics.unhealthyHostCount({ period: cdk.Duration.minutes(1) }),
      threshold: 0,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    alarm('ApiTarget5xxHigh', {
      alarmDescription: 'API returning 5xx responses',
      metric: apiService.targetGroup.metrics.httpCodeTarget(
        elbv2.HttpCodeTarget.TARGET_5XX_COUNT,
        { period: cdk.Duration.minutes(5), statistic: 'Sum' },
      ),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    alarm('ApiServiceCpuHigh', {
      alarmDescription: 'ECS API service CPU sustained above 85% (single task, no autoscaling)',
      metric: apiService.service.metricCpuUtilization({ period: cdk.Duration.minutes(5) }),
      threshold: 85,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // --- AI pipeline Lambda ---
    alarm('ProcessTranscriptErrors', {
      alarmDescription: 'process-transcript Lambda has errored',
      metric: processTranscriptFn.metricErrors({ period: cdk.Duration.minutes(5), statistic: 'Sum' }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    alarm('ProcessTranscriptThrottles', {
      alarmDescription: 'process-transcript Lambda is being throttled',
      metric: processTranscriptFn.metricThrottles({ period: cdk.Duration.minutes(5), statistic: 'Sum' }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // --- AI pipeline Step Functions state machine ---
    alarm('PipelineExecutionsFailed', {
      alarmDescription: 'Scribe pipeline state machine execution failed',
      metric: pipelineStateMachine.metricFailed({ period: cdk.Duration.minutes(5), statistic: 'Sum' }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    alarm('PipelineExecutionsTimedOut', {
      alarmDescription: 'Scribe pipeline state machine execution timed out',
      metric: pipelineStateMachine.metricTimedOut({ period: cdk.Duration.minutes(5), statistic: 'Sum' }),
      threshold: 0,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    new cdk.CfnOutput(this, 'AlarmTopicArn', { value: this.alarmTopic.topicArn });
  }
}
