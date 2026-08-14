#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ClinicNetworkStack } from '../lib/network-stack';
import { ClinicDatabaseStack } from '../lib/database-stack';
import { ClinicDnsStack } from '../lib/dns-stack';
import { ClinicStorageStack } from '../lib/storage-stack';
import { ClinicAuthStack } from '../lib/auth-stack';
import { ClinicRegistryStack } from '../lib/registry-stack';
import { ClinicAiPipelineStack } from '../lib/ai-pipeline-stack';
import { ClinicComputeStack } from '../lib/compute-stack';
import { ClinicCicdStack } from '../lib/cicd-stack';
import { ClinicWebHostingStack } from '../lib/web-hosting-stack';
import { ClinicMonitoringStack } from '../lib/monitoring-stack';
import { ClinicConfigRulesStack } from '../lib/config-rules-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// Passed by the GitHub Actions workflow at deploy time (`-c apiImageTag=<git-sha>`);
// defaults to 'latest' for local/manual synth.
const apiImageTag = app.node.tryGetContext('apiImageTag') ?? 'latest';
// Interim substitute for Bedrock (blocked on AWS account verification, see
// STATUS.md) — this is a direct Anthropic API model id, not a Bedrock one.
// Revert to bedrockModelId/'anthropic.claude-sonnet-5' once Bedrock clears.
const anthropicModelId = app.node.tryGetContext('anthropicModelId') ?? 'claude-sonnet-5';
// Default true until a real model is wired up (either Bedrock once its case
// resolves, or the Anthropic API key secret once it's created) — the pipeline
// runs end-to-end with a canned placeholder note instead of a real model call.
// Flip the default to 'false' (or pass `-c mockSoapNote=false`) once ready.
const mockSoapNote = (app.node.tryGetContext('mockSoapNote') ?? 'true') === 'true';
const alertEmail = app.node.tryGetContext('alertEmail') ?? 'barsehgbor2026@outlook.com';

const network = new ClinicNetworkStack(app, 'ClinicNetworkStack', { env });
const dns = new ClinicDnsStack(app, 'ClinicDnsStack', { env });
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
  anthropicModelId,
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
  hostedZone: dns.hostedZone,
});

new ClinicCicdStack(app, 'ClinicCicdStack', {
  env,
  githubOrg: 'bgtest25',
  githubRepo: 'clinic-project',
  apiRepository: registry.apiRepository,
  cluster: compute.cluster,
  taskDefinition: compute.taskDefinition,
});

new ClinicWebHostingStack(app, 'ClinicWebHostingStack', {
  env,
  hostedZone: dns.hostedZone,
});

const monitoring = new ClinicMonitoringStack(app, 'ClinicMonitoringStack', {
  env,
  dbInstance: database.instance,
  apiService: compute.service,
  processTranscriptFn: aiPipeline.processTranscriptFn,
  pipelineStateMachine: aiPipeline.stateMachine,
  alertEmail,
});

new ClinicConfigRulesStack(app, 'ClinicConfigRulesStack', {
  env,
  alarmTopic: monitoring.alarmTopic,
});
