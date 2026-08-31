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
// Bedrock model access confirmed live 2026-08-31 (AWS support case
// 178433501800988) — a cross-region inference profile id, not a bare
// foundation-model id; this model family doesn't support on-demand
// throughput on the raw model id (see ai-pipeline-stack.ts).
const bedrockModelId =
  app.node.tryGetContext('bedrockModelId') ?? 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';
// The real model has been wired up (direct Anthropic API, see STATUS.md) since
// 2026-08-14, so 'false' is now the actual default — not a CLI flag someone
// has to remember to repeat. A prior version of this line defaulted to 'true'
// and relied on `-c mockSoapNote=false` being passed on every single deploy of
// this stack; the very next deploy that day (the content[0] parsing fix)
// omitted it and silently put the live pipeline back into mock mode for over
// a day without anyone noticing. `-c mockSoapNote=true` still works as an
// explicit override if mock mode is ever needed again on purpose.
const mockSoapNote = (app.node.tryGetContext('mockSoapNote') ?? 'false') === 'true';
// The previous outlook.com subscription's confirmation was never clicked and
// SNS auto-expired the pending subscription after a few days — CloudFormation
// had no visibility into that, so it kept reporting the subscription as
// healthy while the topic actually had zero subscribers. Switched to the same
// address used for the incident-response runbook contacts, 2026-08-16.
const alertEmail = app.node.tryGetContext('alertEmail') ?? 'barsehgbor@gmail.com';

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
