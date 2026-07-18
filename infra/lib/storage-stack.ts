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
          id: 'expire-raw-audio-backstop',
          prefix: 'audio/',
          // The real retention mechanism is event-driven: NotesService.sign()
          // deletes an encounter's raw audio object the moment its note is
          // signed, since the transcript + note are the record of the visit
          // from then on. This is just the backstop for anything that never
          // reaches SIGNED (abandoned recordings, stuck/failed pipelines) so
          // raw audio doesn't live forever regardless of workflow outcome.
          expiration: cdk.Duration.days(90),
        },
        {
          id: 'expire-raw-transcripts-backstop',
          prefix: 'transcripts/',
          // Transcribe's raw JSON output here is a redundant intermediate —
          // process-transcript copies the text into the `transcripts` table,
          // which is the actual source of truth from then on. Shorter window
          // than audio since nothing ever needs to re-read this copy.
          expiration: cdk.Duration.days(30),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }
}
