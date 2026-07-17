import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecr from 'aws-cdk-lib/aws-ecr';

export class ClinicRegistryStack extends cdk.Stack {
  public readonly apiRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.apiRepository = new ecr.Repository(this, 'ApiRepository', {
      repositoryName: 'clinic-project-api',
      imageScanOnPush: true,
      lifecycleRules: [
        {
          description: 'Keep the most recent 20 images',
          maxImageCount: 20,
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }
}
