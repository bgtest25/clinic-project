import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class ClinicStorageStack extends cdk.Stack {
  public readonly mediaBucket: s3.Bucket;
  public readonly mediaBucketKey: kms.Key;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Customer-managed key, left on CDK's default policy (full account-root
    // trust) rather than adding per-consumer statements via `.grant*()` —
    // that would touch this key's resource policy from ComputeStack/
    // AiPipelineStack, recreating the exact cross-stack cycle already hit
    // and avoided for the RDS secret in Phase 1. Consumers instead get plain
    // IAM policy statements on their own roles (see compute-stack.ts,
    // ai-pipeline-stack.ts), authorized against this key purely via the
    // default root-trust statement — this key's own policy never needs to
    // change when a new consumer is added in another stack.
    //
    // SSE-KMS over SSE-S3 specifically for the CloudTrail-logged audit trail
    // of every key use (who decrypted what, when) — meaningful for PHI, and
    // SSE-S3 provides none. S3 itself is HIPAA-eligible either way; this is
    // the stronger, auditable choice now that CloudTrail/Config/GuardDuty
    // are documented as part of this account's baseline.
    this.mediaBucketKey = new kms.Key(this, 'MediaBucketKey', {
      alias: 'clinic-project/media-bucket',
      enableKeyRotation: true,
    });

    this.mediaBucket = new s3.Bucket(this, 'MediaBucket', {
      bucketName: `clinic-project-media-${this.account}`,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: this.mediaBucketKey,
      // Reduces KMS API call volume/cost by reusing a bucket-level data key
      // instead of calling KMS per-object; still fully compatible with
      // CloudTrail logging of key usage.
      bucketKeyEnabled: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      // Recording.tsx uploads audio directly to S3 via a presigned PUT URL
      // (see recordings.service.ts) — without this, the browser blocks the
      // upload as cross-origin before it ever reaches S3, surfacing as a
      // generic "Load failed"/"Failed to fetch" with no server-side trace.
      // Same origin list as the API's CORS allowlist in api/src/main.ts.
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ['https://havenote.health', 'https://app.havenote.health', 'http://localhost:5173'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
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
