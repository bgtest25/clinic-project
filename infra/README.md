# Havenote Infra

AWS CDK (TypeScript) stacks: VPC, RDS Postgres Multi-AZ + KMS, S3 (SSE-KMS), Cognito with
mandatory MFA, ECS Fargate, Step Functions/Transcribe Medical/Bedrock pipeline, CloudTrail,
GuardDuty, and Config. See the [root README](../README.md) for the full architecture.

## Commands

```bash
npm install
npx cdk synth <StackName>    # emit the CloudFormation template
npx cdk diff <StackName>     # compare against what's deployed
npx cdk deploy <StackName>   # deploy
npm run test                 # Jest tests for the CDK constructs
```

Requires AWS credentials for the target account/region (`CDK_DEFAULT_ACCOUNT`,
`CDK_DEFAULT_REGION`, or an AWS CLI profile).
