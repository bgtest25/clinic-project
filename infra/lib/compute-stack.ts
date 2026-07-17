import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as logs from 'aws-cdk-lib/aws-logs';

export interface ClinicComputeStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbSecurityGroup: ec2.SecurityGroup;
}

export class ClinicComputeStack extends cdk.Stack {
  public readonly service: ecsPatterns.ApplicationLoadBalancedFargateService;

  constructor(scope: Construct, id: string, props: ClinicComputeStackProps) {
    super(scope, id, props);
    const { vpc, dbSecurityGroup } = props;

    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: 'clinic-project-cluster',
    });

    const logGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: '/clinic-project/api',
      retention: logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'ApiService', {
      cluster,
      taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      publicLoadBalancer: true,
      circuitBreaker: { rollback: true },
      // Spin up the new task before killing the old one during deploys, so a
      // single-task service doesn't drop to zero capacity mid-rollout.
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      // HTTP only for now — no domain/ACM cert yet. Add an HTTPS listener once
      // the domain from Phase 1's Route53 step exists.
      listenerPort: 80,
      taskImageOptions: {
        // Placeholder image to validate ALB -> Fargate -> health check end-to-end.
        // Swapped for the real NestJS API image once it exists and CI/CD pushes to ECR.
        image: ecs.ContainerImage.fromRegistry('public.ecr.aws/nginx/nginx:latest'),
        containerPort: 80,
        logDriver: ecs.LogDrivers.awsLogs({ streamPrefix: 'api', logGroup }),
      },
    });

    dbSecurityGroup.addIngressRule(
      this.service.service.connections.securityGroups[0],
      ec2.Port.tcp(5432),
      'Allow ECS app tier to reach Postgres',
    );
  }
}
