import { Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecordingsService {
  private readonly s3 = new S3Client({});
  private readonly sfn = new SFNClient({});

  constructor(private readonly prisma: PrismaService) {}

  async createUploadUrl(encounterId: string) {
    const s3Key = `audio/${encounterId}/${randomUUID()}.webm`;
    const command = new PutObjectCommand({
      Bucket: process.env.MEDIA_BUCKET_NAME,
      Key: s3Key,
      ContentType: 'audio/webm',
    });
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 900 });

    await this.prisma.audioRecording.upsert({
      where: { encounterId },
      create: { encounterId, s3Key },
      update: { s3Key },
    });

    return { uploadUrl, s3Key };
  }

  async completeUpload(encounterId: string) {
    const recording = await this.prisma.audioRecording.findUniqueOrThrow({ where: { encounterId } });

    await this.prisma.$transaction([
      this.prisma.audioRecording.update({ where: { encounterId }, data: { uploadedAt: new Date() } }),
      this.prisma.encounter.update({ where: { id: encounterId }, data: { status: 'TRANSCRIBING' } }),
    ]);

    const execution = await this.sfn.send(
      new StartExecutionCommand({
        stateMachineArn: process.env.PIPELINE_STATE_MACHINE_ARN,
        name: `encounter-${encounterId}-${Date.now()}`,
        input: JSON.stringify({
          encounterId,
          bucket: process.env.MEDIA_BUCKET_NAME,
          audioKey: recording.s3Key,
        }),
      }),
    );

    return { executionArn: execution.executionArn };
  }
}
