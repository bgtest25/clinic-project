#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ClinicNetworkStack } from '../lib/network-stack';
import { ClinicDatabaseStack } from '../lib/database-stack';
import { ClinicStorageStack } from '../lib/storage-stack';
import { ClinicAuthStack } from '../lib/auth-stack';
import { ClinicComputeStack } from '../lib/compute-stack';

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const network = new ClinicNetworkStack(app, 'ClinicNetworkStack', { env });
const database = new ClinicDatabaseStack(app, 'ClinicDatabaseStack', { env, vpc: network.vpc });

new ClinicStorageStack(app, 'ClinicStorageStack', { env });
new ClinicAuthStack(app, 'ClinicAuthStack', { env });
new ClinicComputeStack(app, 'ClinicComputeStack', {
  env,
  vpc: network.vpc,
  dbSecurityGroup: database.dbSecurityGroup,
});
