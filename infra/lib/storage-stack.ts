import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class ClinicStorageStack extends cdk.Stack {
  public readonly mediaBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const mediaKey = new kms.Key(this, 'MediaKey', {
      alias: 'clinic-project/media',
      enableKeyRotation: true,
    });

    this.mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: `clinic-project-media-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: mediaKey,
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
