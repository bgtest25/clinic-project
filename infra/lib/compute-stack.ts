import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';

export interface ClinicComputeStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  dbSecurityGroup: ec2.SecurityGroup;
  dbSecret: secretsmanager.ISecret;
  apiRepository: ecr.IRepository;
  apiImageTag: string;
  userPool: cognito.IUserPool;
  userPoolClient: cognito.IUserPoolClient;
  mediaBucket: s3.Bucket;
  mediaBucketKey: kms.Key;
  pipelineStateMachine: sfn.StateMachine;
  hostedZone: route53.IHostedZone;
}

export class ClinicComputeStack extends cdk.Stack {
  public readonly service: ecsPatterns.ApplicationLoadBalancedFargateService;
  public readonly cluster: ecs.Cluster;
  public readonly taskDefinition: ecs.TaskDefinition;

  constructor(scope: Construct, id: string, props: ClinicComputeStackProps) {
    super(scope, id, props);
    const {
      vpc,
      dbSecurityGroup,
      dbSecret,
      apiRepository,
      apiImageTag,
      userPool,
      userPoolClient,
      mediaBucket,
      mediaBucketKey,
      pipelineStateMachine,
      hostedZone,
    } = props;

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
      // HTTPS via api.havenote.health — the construct auto-creates the ACM
      // cert (DNS-validated against hostedZone), the HTTPS listener, an
      // HTTP->HTTPS redirect listener, and the Route53 alias record, all from
      // just these three props. Cert validation (and DNS resolution of the
      // domain at all) stays pending until the registrar's nameservers point
      // to this hosted zone — see dns-stack.ts.
      domainName: 'api.havenote.health',
      domainZone: hostedZone,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      redirectHTTP: true,
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
          MEDIA_BUCKET_NAME: mediaBucket.bucketName,
          PIPELINE_STATE_MACHINE_ARN: pipelineStateMachine.stateMachineArn,
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

    // Needed for presigned upload URLs to be valid (SigV4 signing uses the task
    // role's own credentials) and for NotesService's audio purge on sign-off.
    // Manual statements on this role, not `mediaBucket.grantReadWrite(...)` —
    // that method auto-grants the bucket's KMS key too, which would touch
    // MediaBucketKey's resource policy from this stack and recreate the
    // cross-stack cycle the key's default (unmodified) policy is designed to
    // avoid. See storage-stack.ts.
    this.taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['s3:PutObject', 's3:DeleteObject'],
        resources: [mediaBucket.arnForObjects('*')],
      }),
    );
    this.taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['kms:Encrypt', 'kms:GenerateDataKey*', 'kms:DescribeKey'],
        resources: [mediaBucketKey.keyArn],
      }),
    );
    pipelineStateMachine.grantStartExecution(this.taskDefinition.taskRole);

    // For UsersService.invite() — admin-provisioning a clinician's Cognito
    // account and assigning them to the admin/clinician group.
    this.taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:AdminAddUserToGroup', 'cognito-idp:AdminDeleteUser'],
        resources: [userPool.userPoolArn],
      }),
    );

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
