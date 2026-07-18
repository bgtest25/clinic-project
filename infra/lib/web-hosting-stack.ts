import { existsSync } from 'fs';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

const WEB_DIST_PATH = '../web/dist';

export interface ClinicWebHostingStackProps extends cdk.StackProps {
  hostedZone: route53.IHostedZone;
}

// Static hosting for web/ at app.havenote.health — this didn't exist at all
// before (the frontend had only ever been run locally). Not wired into CI:
// this deploys whatever is currently built in web/dist at `cdk deploy` time,
// a one-time snapshot like the other stacks GitHub Actions doesn't touch —
// a real frontend CI/CD pipeline is a separate, future piece of work.
export class ClinicWebHostingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ClinicWebHostingStackProps) {
    super(scope, id, props);
    const { hostedZone } = props;

    const siteBucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: `clinic-project-web-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Covers both the apex (what most people will actually type) and the
    // app. subdomain with one cert/distribution — same content either way,
    // no separate redirect stack needed.
    const certificate = new acm.Certificate(this, 'WebCertificate', {
      domainName: 'app.havenote.health',
      subjectAlternativeNames: ['havenote.health'],
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    const distribution = new cloudfront.Distribution(this, 'WebDistribution', {
      defaultRootObject: 'index.html',
      domainNames: ['app.havenote.health', 'havenote.health'],
      certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      // This app doesn't use client-side routing today, but a SPA served from
      // S3 404s on a hard refresh of any non-root path the moment it does —
      // cheap to cover now rather than debug later.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    new route53.ARecord(this, 'WebAliasRecord', {
      zone: hostedZone,
      recordName: 'app',
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    // Apex record — no recordName means the zone root (havenote.health itself).
    new route53.ARecord(this, 'ApexAliasRecord', {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    // `cdk synth` builds every stack in the app regardless of which one is
    // targeted — CI's `cdk deploy ClinicComputeStack` run synthesizes this
    // stack too, and CI never builds the frontend, so web/dist doesn't exist
    // there. Skip the deployment construct entirely rather than crash synth
    // for every future API deploy; CI never deploys this stack anyway.
    // Manual deploys (`cdk deploy ClinicWebHostingStack`) always build first.
    if (existsSync(WEB_DIST_PATH)) {
      new s3deploy.BucketDeployment(this, 'DeployWebAssets', {
        sources: [s3deploy.Source.asset(WEB_DIST_PATH)],
        destinationBucket: siteBucket,
        distribution,
        distributionPaths: ['/*'],
      });
    }

    new cdk.CfnOutput(this, 'SiteUrl', { value: 'https://havenote.health (also https://app.havenote.health)' });
    new cdk.CfnOutput(this, 'DistributionDomainName', { value: distribution.distributionDomainName });
  }
}
