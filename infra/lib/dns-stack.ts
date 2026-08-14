import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as route53 from 'aws-cdk-lib/aws-route53';

export class ClinicDnsStack extends cdk.Stack {
  public readonly hostedZone: route53.HostedZone;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.hostedZone = new route53.HostedZone(this, 'HostedZone', {
      zoneName: 'havenote.health',
    });

    // havenote.health was registered outside AWS — this zone won't actually
    // serve anything until the domain's nameservers at the registrar are
    // updated to these. Everything downstream (ACM DNS validation, the
    // api./app. records) sits pending until that delegation happens; it
    // finishes automatically once it does, no redeploy needed.
    new cdk.CfnOutput(this, 'NameServers', {
      value: cdk.Fn.join(', ', this.hostedZone.hostedZoneNameServers!),
      description: 'Update these as the NS records at the havenote.health registrar',
    });

    // Interim substitute for CloudFront (blocked on AWS account verification,
    // see STATUS.md) — points the frontend at Vercel instead of the
    // CloudFront distribution in web-hosting-stack.ts, which is left in place
    // but undeployed in the meantime. Remove these two records and let
    // ClinicWebHostingStack's alias records take over again once the
    // CloudFront case clears.
    new route53.ARecord(this, 'VercelApexRecord', {
      zone: this.hostedZone,
      target: route53.RecordTarget.fromIpAddresses('76.76.21.21'),
    });
    new route53.CnameRecord(this, 'VercelAppRecord', {
      zone: this.hostedZone,
      recordName: 'app',
      domainName: 'cname.vercel-dns.com',
    });
  }
}
