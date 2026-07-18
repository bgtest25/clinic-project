#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ClinicNetworkStack } from '../lib/network-stack';
import { ClinicDatabaseStack } from '../lib/database-stack';
import { ClinicStorageStack } from '../lib/storage-stack';
import { ClinicAuthStack } from '../lib/auth-stack';
import { ClinicRegistryStack } from '../lib/registry-stack';
import { ClinicAiPipelineStack } from '../lib/ai-pipeline-stack';
import { ClinicComputeStack } from '../lib/compute-stack';
import { ClinicCicdStack } from '../lib/cicd-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// Passed by the GitHub Actions workflow at deploy time (`-c apiImageTag=<git-sha>`);
// defaults to 'latest' for local/manual synth.
const apiImageTag = app.node.tryGetContext('apiImageTag') ?? 'latest';
const bedrockModelId = app.node.tryGetContext('bedrockModelId') ?? 'anthropic.claude-sonnet-5';
// Default true until the Bedrock model-access support case (AWS account
// 501264525435) is resolved — the pipeline runs end-to-end with a canned
// placeholder note instead of a real Bedrock InvokeModel call. Flip the
// default to 'false' (or pass `-c mockSoapNote=false`) once access is granted.
const mockSoapNote = (app.node.tryGetContext('mockSoapNote') ?? 'true') === 'true';

const network = new ClinicNetworkStack(app, 'ClinicNetworkStack', { env });
const database = new ClinicDatabaseStack(app, 'ClinicDatabaseStack', { env, vpc: network.vpc });
const auth = new ClinicAuthStack(app, 'ClinicAuthStack', { env });
const registry = new ClinicRegistryStack(app, 'ClinicRegistryStack', { env });
const storage = new ClinicStorageStack(app, 'ClinicStorageStack', { env });

const aiPipeline = new ClinicAiPipelineStack(app, 'ClinicAiPipelineStack', {
  env,
  vpc: network.vpc,
  mediaBucket: storage.mediaBucket,
  mediaBucketKey: storage.mediaBucketKey,
  dbSecurityGroup: database.dbSecurityGroup,
  dbSecret: database.instance.secret!,
  bedrockModelId,
  mockSoapNote,
});

const compute = new ClinicComputeStack(app, 'ClinicComputeStack', {
  env,
  vpc: network.vpc,
  dbSecurityGroup: database.dbSecurityGroup,
  dbSecret: database.instance.secret!,
  apiRepository: registry.apiRepository,
  apiImageTag,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
  mediaBucket: storage.mediaBucket,
  mediaBucketKey: storage.mediaBucketKey,
  pipelineStateMachine: aiPipeline.stateMachine,
});

new ClinicCicdStack(app, 'ClinicCicdStack', {
  env,
  githubOrg: 'bgtest25',
  githubRepo: 'clinic-project',
  apiRepository: registry.apiRepository,
  cluster: compute.cluster,
  taskDefinition: compute.taskDefinition,
});
