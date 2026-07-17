import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class ClinicStorageStack extends cdk.Stack {
  public readonly mediaBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // SSE-S3, not a customer-managed KMS key: this bucket is read/written by both
    // ComputeStack's ECS task role (presigned upload URLs) and the AI pipeline
    // Lambda's role, in two different stacks. A customer key's resource policy
    // would need to reference both, in both directions — the same cross-stack
    // cycle already hit and fixed for the RDS secret in Phase 1. SSE-S3 still
    // encrypts at rest; consumers just need a plain IAM grant, no KMS policy edit.
    this.mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: `clinic-project-media-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      lifecycleRules: [
        {
          id: 'expire-raw-audio',
          prefix: 'audio/',
          // Placeholder retention — raw audio should be deleted once its note is
          // signed off; revisit alongside the Phase 4 retention policy.
          expiration: cdk.Duration.days(90),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }
}
