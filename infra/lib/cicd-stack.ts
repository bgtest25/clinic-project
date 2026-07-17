import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface ClinicCicdStackProps extends cdk.StackProps {
  githubOrg: string;
  githubRepo: string;
  apiRepository: ecr.IRepository;
  cluster: ecs.Cluster;
  taskDefinition: ecs.TaskDefinition;
}

export class ClinicCicdStack extends cdk.Stack {
  public readonly deployRole: iam.Role;

  constructor(scope: Construct, id: string, props: ClinicCicdStackProps) {
    super(scope, id, props);
    const { githubOrg, githubRepo, apiRepository, cluster, taskDefinition } = props;

    const provider = new iam.OpenIdConnectProvider(this, 'GithubOidcProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    this.deployRole = new iam.Role(this, 'GithubActionsDeployRole', {
      roleName: 'clinic-project-github-actions-deploy',
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        // Wildcarded around org/repo: GitHub's actual sub claim appends immutable
        // numeric IDs (repo:org@12345/repo@67890:ref:...), not the classic
        // repo:org/repo:ref:... form — confirmed via the CloudTrail-logged principalId
        // on a real denied AssumeRoleWithWebIdentity call. This still requires an
        // exact match on org/repo name prefix and the branch ref.
        StringLike: {
          'token.actions.githubusercontent.com:sub': `repo:${githubOrg}*/${githubRepo}*:ref:refs/heads/main`,
        },
      }),
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // Lets `cdk deploy` work from CI by delegating to the roles `cdk bootstrap` already created.
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [
          `arn:aws:iam::${this.account}:role/cdk-hnb659fds-deploy-role-${this.account}-${this.region}`,
          `arn:aws:iam::${this.account}:role/cdk-hnb659fds-file-publishing-role-${this.account}-${this.region}`,
          `arn:aws:iam::${this.account}:role/cdk-hnb659fds-image-publishing-role-${this.account}-${this.region}`,
          `arn:aws:iam::${this.account}:role/cdk-hnb659fds-lookup-role-${this.account}-${this.region}`,
        ],
      }),
    );

    apiRepository.grantPullPush(this.deployRole);
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({ actions: ['ecr:GetAuthorizationToken'], resources: ['*'] }),
    );

    // For the one-off `prisma migrate deploy` task run directly via the AWS CLI (not through CDK).
    // Wildcarded on revision number, not `taskDefinition.taskDefinitionArn` — that
    // token snapshots whatever revision existed when THIS stack last deployed, and
    // every ComputeStack deploy creates a new revision, silently going stale.
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecs:RunTask'],
        resources: [`arn:aws:ecs:${this.region}:${this.account}:task-definition/${taskDefinition.family}:*`],
        conditions: { ArnEquals: { 'ecs:cluster': cluster.clusterArn } },
      }),
    );
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({ actions: ['ecs:DescribeTasks', 'ecs:DescribeTaskDefinition'], resources: ['*'] }),
    );

    const passRoleArns = [taskDefinition.taskRole.roleArn];
    if (taskDefinition.executionRole) passRoleArns.push(taskDefinition.executionRole.roleArn);
    this.deployRole.addToPolicy(new iam.PolicyStatement({ actions: ['iam:PassRole'], resources: passRoleArns }));

    // So the workflow can look up cluster/subnet/security-group details by stack output instead of hardcoding them.
    this.deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudformation:DescribeStacks'],
        resources: [`arn:aws:cloudformation:${this.region}:${this.account}:stack/Clinic*/*`],
      }),
    );
  }
}
