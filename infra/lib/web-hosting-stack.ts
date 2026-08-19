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
// before (the frontend had only ever been run locally). Now deployed by
// .github/workflows/deploy-web.yml, which builds web/dist before running
// `cdk deploy ClinicWebHostingStack` — see the existsSync guard below for why
// that ordering matters.
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
    // targeted — deploy-api.yml's `cdk deploy ClinicComputeStack` run
    // synthesizes this stack too, and that workflow never builds the
    // frontend, so web/dist doesn't exist there. Skip the deployment
    // construct entirely rather than crash synth on every API deploy.
    // deploy-web.yml (and manual deploys) always build web/dist first.
    if (existsSync(WEB_DIST_PATH)) {
      // Split in two, with explicit Cache-Control, after a real incident
      // (2026-08-19): a single undifferentiated deployment left every file
      // with no cache metadata at all, so a browser (or CloudFront's default
      // TTL) could hold a stale index.html referencing a content-hashed
      // asset filename that a later deploy's default pruning had already
      // deleted — the browser got CloudFront's SPA-fallback index.html back
      // in place of the JS bundle it asked for, which fails to parse as a
      // module, so the app never mounts. Blank/black screen, no console
      // error a typical user would notice.
      //
      // Hashed assets: safe to cache forever (a content change always means
      // a new filename) and, critically, never pruned — an old index.html
      // still out there in a cache somewhere must always find the file it's
      // looking for. The tiny amount of storage this leaves behind across
      // many deploys isn't worth the risk of repeating this incident.
      const hashedAssets = new s3deploy.BucketDeployment(this, 'DeployWebAssetsHashed', {
        sources: [s3deploy.Source.asset(WEB_DIST_PATH)],
        destinationBucket: siteBucket,
        exclude: ['index.html'],
        cacheControl: [s3deploy.CacheControl.fromString('public, max-age=31536000, immutable')],
        prune: false,
      });

      // index.html is the one file that changes in place on every deploy —
      // must never be served stale, so no-cache forces both the browser and
      // CloudFront to revalidate on every request. Deployed after (and
      // depending on) the hashed assets above, so it can never go live
      // pointing at a filename that doesn't exist in the bucket yet.
      const indexHtml = new s3deploy.BucketDeployment(this, 'DeployWebIndexHtml', {
        sources: [s3deploy.Source.asset(WEB_DIST_PATH)],
        destinationBucket: siteBucket,
        exclude: ['*'],
        include: ['index.html'],
        cacheControl: [s3deploy.CacheControl.fromString('no-cache, must-revalidate')],
        prune: false,
        distribution,
        distributionPaths: ['/index.html'],
      });
      indexHtml.node.addDependency(hashedAssets);
    }

    new cdk.CfnOutput(this, 'SiteUrl', { value: 'https://havenote.health (also https://app.havenote.health)' });
    new cdk.CfnOutput(this, 'DistributionDomainName', { value: distribution.distributionDomainName });
  }
}
