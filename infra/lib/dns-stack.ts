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

    // Interim Vercel substitute removed 2026-08-19: the CloudFront account-
    // verification case cleared (approved 2026-08-18), and this CNAME was
    // also the actual root cause of repeated ACM certificate validation
    // failures on app.havenote.health — cname.vercel-dns.com carries a CAA
    // record that doesn't authorize Amazon as an issuer, and CAA checks
    // follow CNAME chains. ClinicWebHostingStack's alias records take over
    // below.
  }
}
