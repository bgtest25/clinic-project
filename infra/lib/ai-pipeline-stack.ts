import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNode from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';

export interface ClinicAiPipelineStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  mediaBucket: s3.Bucket;
  dbSecurityGroup: ec2.SecurityGroup;
  dbSecret: secretsmanager.ISecret;
  bedrockModelId: string;
  mockSoapNote: boolean;
}

export class ClinicAiPipelineStack extends cdk.Stack {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, props: ClinicAiPipelineStackProps) {
    super(scope, id, props);
    const { vpc, mediaBucket, dbSecurityGroup, dbSecret, bedrockModelId, mockSoapNote } = props;

    const lambdaSg = new ec2.SecurityGroup(this, 'ProcessTranscriptSg', {
      vpc,
      description: 'AI pipeline Lambda (process-transcript)',
      allowAllOutbound: true,
    });

    // Scoped to `this` for the same reason as ComputeStack's DB ingress rule —
    // avoids a reverse cross-stack dependency edge back onto ClinicDatabaseStack.
    new ec2.CfnSecurityGroupIngress(this, 'DbIngressFromPipeline', {
      groupId: dbSecurityGroup.securityGroupId,
      ipProtocol: 'tcp',
      fromPort: 5432,
      toPort: 5432,
      sourceSecurityGroupId: lambdaSg.securityGroupId,
      description: 'Allow AI pipeline Lambda to reach Postgres',
    });

    const processTranscriptLogGroup = new logs.LogGroup(this, 'ProcessTranscriptLogGroup', {
      logGroupName: '/aws/lambda/clinic-project-process-transcript',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const processTranscriptFn = new lambdaNode.NodejsFunction(this, 'ProcessTranscriptFn', {
      functionName: 'clinic-project-process-transcript',
      entry: 'lambda/process-transcript/index.ts',
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      logGroup: processTranscriptLogGroup,
      environment: {
        BEDROCK_MODEL_ID: bedrockModelId,
        MOCK_SOAP_NOTE: mockSoapNote ? 'true' : 'false',
        // Dynamic CloudFormation references, resolved server-side at deploy time —
        // never appear as plaintext in the template, same effect as ECS's `secrets:`
        // mapping but Lambda has no native equivalent, so this is the standard way.
        DB_HOST: dbSecret.secretValueFromJson('host').unsafeUnwrap(),
        DB_PORT: dbSecret.secretValueFromJson('port').unsafeUnwrap(),
        DB_NAME: dbSecret.secretValueFromJson('dbname').unsafeUnwrap(),
        DB_USERNAME: dbSecret.secretValueFromJson('username').unsafeUnwrap(),
        DB_PASSWORD: dbSecret.secretValueFromJson('password').unsafeUnwrap(),
      },
    });

    mediaBucket.grantRead(processTranscriptFn);

    processTranscriptFn.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [`arn:aws:bedrock:${this.region}::foundation-model/${bedrockModelId}`],
      }),
    );

    const transcriptionFailed = new sfn.Fail(this, 'TranscriptionFailed', {
      cause: 'Transcribe Medical job failed',
    });

    // Reused for both failure entry points below: a Transcribe job that reports
    // TranscriptionJobStatus=FAILED (a normal outcome, not an exception), and an
    // actual exception from the Transcribe API calls (throttling exhausted,
    // invalid input, etc.) caught via .addCatch(). The success-path Lambda
    // (ProcessTranscript) marks failure on its own already — see its try/catch —
    // so it doesn't need this same treatment.
    const markFailedFromJobStatus = new tasks.LambdaInvoke(this, 'MarkFailedFromJobStatus', {
      lambdaFunction: processTranscriptFn,
      payload: sfn.TaskInput.fromObject({
        mode: 'markFailed',
        encounterId: sfn.JsonPath.stringAt('$.encounterId'),
        reason: sfn.JsonPath.stringAt('$.transcriptionStatus.MedicalTranscriptionJob.FailureReason'),
      }),
      resultPath: sfn.JsonPath.DISCARD,
    }).next(transcriptionFailed);

    const markFailedFromException = new tasks.LambdaInvoke(this, 'MarkFailedFromException', {
      lambdaFunction: processTranscriptFn,
      payload: sfn.TaskInput.fromObject({
        mode: 'markFailed',
        encounterId: sfn.JsonPath.stringAt('$.encounterId'),
        reason: sfn.JsonPath.stringAt('$.errorInfo.Cause'),
      }),
      resultPath: sfn.JsonPath.DISCARD,
    }).next(transcriptionFailed);

    const startTranscription = new tasks.CallAwsService(this, 'StartMedicalTranscription', {
      service: 'transcribe',
      action: 'startMedicalTranscriptionJob',
      iamResources: ['*'],
      parameters: {
        'MedicalTranscriptionJobName.$': '$$.Execution.Name',
        LanguageCode: 'en-US',
        Media: {
          'MediaFileUri.$': "States.Format('s3://{}/{}', $.bucket, $.audioKey)",
        },
        OutputBucketName: mediaBucket.bucketName,
        'OutputKey.$': "States.Format('transcripts/{}.json', $$.Execution.Name)",
        Specialty: 'PRIMARYCARE',
        Type: 'CONVERSATION',
        Settings: {
          ShowSpeakerLabels: true,
          MaxSpeakerLabels: 2,
        },
      },
      resultPath: sfn.JsonPath.DISCARD,
    });
    startTranscription.addCatch(markFailedFromException, { resultPath: '$.errorInfo' });

    const waitForTranscription = new sfn.Wait(this, 'WaitForTranscription', {
      time: sfn.WaitTime.duration(cdk.Duration.seconds(30)),
    });

    const getTranscriptionStatus = new tasks.CallAwsService(this, 'GetTranscriptionStatus', {
      service: 'transcribe',
      action: 'getMedicalTranscriptionJob',
      iamResources: ['*'],
      parameters: {
        'MedicalTranscriptionJobName.$': '$$.Execution.Name',
      },
      resultPath: '$.transcriptionStatus',
    });
    getTranscriptionStatus.addCatch(markFailedFromException, { resultPath: '$.errorInfo' });

    const processTranscriptTask = new tasks.LambdaInvoke(this, 'ProcessTranscript', {
      lambdaFunction: processTranscriptFn,
      payload: sfn.TaskInput.fromObject({
        encounterId: sfn.JsonPath.stringAt('$.encounterId'),
        bucket: mediaBucket.bucketName,
        transcriptKey: sfn.JsonPath.format('transcripts/{}.json', sfn.JsonPath.stringAt('$$.Execution.Name')),
      }),
      resultPath: '$.processResult',
    });

    waitForTranscription.next(getTranscriptionStatus);

    const checkTranscriptionStatus = new sfn.Choice(this, 'IsTranscriptionComplete')
      .when(
        sfn.Condition.stringEquals('$.transcriptionStatus.MedicalTranscriptionJob.TranscriptionJobStatus', 'COMPLETED'),
        processTranscriptTask,
      )
      .when(
        sfn.Condition.stringEquals('$.transcriptionStatus.MedicalTranscriptionJob.TranscriptionJobStatus', 'FAILED'),
        markFailedFromJobStatus,
      )
      .otherwise(waitForTranscription);

    getTranscriptionStatus.next(checkTranscriptionStatus);

    const definition = startTranscription.next(waitForTranscription);

    const pipelineLogGroup = new logs.LogGroup(this, 'PipelineLogGroup', {
      logGroupName: '/clinic-project/ai-pipeline',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.stateMachine = new sfn.StateMachine(this, 'ScribePipeline', {
      stateMachineName: 'clinic-project-scribe-pipeline',
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.minutes(30),
      logs: {
        destination: pipelineLogGroup,
        level: sfn.LogLevel.ALL,
      },
    });

    // Transcribe's exact S3 access model (calling-role vs. service-role) isn't
    // fully certain without a live test — granting this defensively covers the
    // "evaluates the calling role's permissions" case; if the live test still
    // fails with an S3 access error, a bucket policy for transcribe.amazonaws.com
    // (or a DataAccessRoleArn param) is the next thing to check, not a guess.
    mediaBucket.grantReadWrite(this.stateMachine);

    new cdk.CfnOutput(this, 'StateMachineArn', { value: this.stateMachine.stateMachineArn });
  }
}
