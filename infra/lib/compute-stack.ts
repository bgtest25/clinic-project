import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export interface ClinicComputeStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbSecurityGroup: ec2.SecurityGroup;
  dbSecret: secretsmanager.ISecret;
  apiRepository: ecr.IRepository;
  apiImageTag: string;
  userPool: cognito.IUserPool;
  userPoolClient: cognito.IUserPoolClient;
}

export class ClinicComputeStack extends cdk.Stack {
  public readonly service: ecsPatterns.ApplicationLoadBalancedFargateService;
  public readonly cluster: ecs.Cluster;
  public readonly taskDefinition: ecs.TaskDefinition;

  constructor(scope: Construct, id: string, props: ClinicComputeStackProps) {
    super(scope, id, props);
    const { vpc, dbSecurityGroup, dbSecret, apiRepository, apiImageTag, userPool, userPoolClient } = props;

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: 'clinic-project-cluster',
    });

    const logGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: '/clinic-project/api',
      retention: logs.RetentionDays.ONE_YEAR,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.service = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'ApiService', {
      cluster: this.cluster,
      taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      cpu: 256,
      memoryLimitMiB: 512,
      desiredCount: 1,
      publicLoadBalancer: true,
      // HTTP only for now — no domain/ACM cert yet. Add an HTTPS listener once
      // the domain from Phase 1's Route53 step exists.
      listenerPort: 80,
      circuitBreaker: { rollback: true },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      taskImageOptions: {
        image: ecs.ContainerImage.fromEcrRepository(apiRepository, apiImageTag),
        containerPort: 3000,
        logDriver: ecs.LogDrivers.awsLogs({ streamPrefix: 'api', logGroup }),
        environment: {
          AWS_REGION: this.region,
          COGNITO_USER_POOL_ID: userPool.userPoolId,
          COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
        },
        secrets: {
          DB_HOST: ecs.Secret.fromSecretsManager(dbSecret, 'host'),
          DB_PORT: ecs.Secret.fromSecretsManager(dbSecret, 'port'),
          DB_NAME: ecs.Secret.fromSecretsManager(dbSecret, 'dbname'),
          DB_USERNAME: ecs.Secret.fromSecretsManager(dbSecret, 'username'),
          DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
        },
      },
    });

    this.taskDefinition = this.service.taskDefinition;

    this.service.targetGroup.configureHealthCheck({
      path: '/health',
      healthyHttpCodes: '200',
    });

    // Scoped to `this` (ComputeStack) rather than `dbSecurityGroup.addIngressRule(...)`,
    // which would parent the rule to DatabaseStack and force it to reference this
    // stack's security group — a reverse edge that creates a cycle, since this stack
    // already depends on DatabaseStack for the security group and secret.
    new ec2.CfnSecurityGroupIngress(this, 'DbIngressFromApp', {
      groupId: dbSecurityGroup.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      sourceSecurityGroupId: this.service.service.connections.securityGroups[0].securityGroupId,
      description: 'Allow ECS app tier to reach Postgres',
    });

    // Consumed by the GitHub Actions workflow (run-task for migrations, force-deploy)
    // so it can look these up by stack output instead of hardcoding them.
    new cdk.CfnOutput(this, 'ClusterName', { value: this.cluster.clusterName });
    new cdk.CfnOutput(this, 'ServiceName', { value: this.service.service.serviceName });
    new cdk.CfnOutput(this, 'TaskDefinitionFamily', { value: this.taskDefinition.family });
    new cdk.CfnOutput(this, 'AppSecurityGroupId', {
      value: this.service.service.connections.securityGroups[0].securityGroupId,
    });
    new cdk.CfnOutput(this, 'AppSubnetIds', {
      value: cdk.Fn.join(',', vpc.selectSubnets({ subnetGroupName: 'private-app' }).subnetIds),
    });
  }
}
