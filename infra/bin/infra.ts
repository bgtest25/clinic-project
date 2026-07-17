#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ClinicNetworkStack } from '../lib/network-stack';
import { ClinicDatabaseStack } from '../lib/database-stack';
import { ClinicStorageStack } from '../lib/storage-stack';
import { ClinicAuthStack } from '../lib/auth-stack';
import { ClinicRegistryStack } from '../lib/registry-stack';
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

const network = new ClinicNetworkStack(app, 'ClinicNetworkStack', { env });
const database = new ClinicDatabaseStack(app, 'ClinicDatabaseStack', { env, vpc: network.vpc });
const auth = new ClinicAuthStack(app, 'ClinicAuthStack', { env });
const registry = new ClinicRegistryStack(app, 'ClinicRegistryStack', { env });

new ClinicStorageStack(app, 'ClinicStorageStack', { env });

const compute = new ClinicComputeStack(app, 'ClinicComputeStack', {
  env,
  vpc: network.vpc,
  dbSecurityGroup: database.dbSecurityGroup,
  dbSecret: database.instance.secret!,
  apiRepository: registry.apiRepository,
  apiImageTag,
  userPool: auth.userPool,
  userPoolClient: auth.userPoolClient,
});

new ClinicCicdStack(app, 'ClinicCicdStack', {
  env,
  githubOrg: 'bgtest25',
  githubRepo: 'clinic-project',
  apiRepository: registry.apiRepository,
  cluster: compute.cluster,
  taskDefinition: compute.taskDefinition,
});
