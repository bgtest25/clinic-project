import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CognitoAuthGuard } from '../auth/cognito-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { EncountersService } from '../encounters/encounters.service';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { randomUUID } from 'crypto';
import { IsArray, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class TranscriptSegmentDto {
  @IsString()
  speaker: string;

  @IsString()
  text: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;
}

class CompleteStreamDto {
  @IsString()
  transcript: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TranscriptSegmentDto)
  segments: TranscriptSegmentDto[];
}

@UseGuards(CognitoAuthGuard)
@Controller('encounters/:encounterId/transcription')
export class TranscriptionController {
  private readonly lambda = new LambdaClient({});

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly encountersService: EncountersService,
  ) {}

  @Post('complete-stream')
  async completeStream(
    @Param('encounterId') encounterId: string,
    @Body() dto: CompleteStreamDto,
    @Req() req: any,
  ) {
    const actor = await this.usersService.findByCognitoSub(req.user.sub);
    await this.encountersService.assertClinicOwnsEncounter(encounterId, actor.clinicId);

    // Save the streamed transcript directly to the database
    await this.prisma.transcript.upsert({
      where: { encounterId },
      create: {
        id: randomUUID(),
        encounterId,
        rawText: dto.transcript,
        diarizedSegments: JSON.stringify(dto.segments),
        sttProvider: 'aws-transcribe-medical-streaming',
      },
      update: {
        rawText: dto.transcript,
        diarizedSegments: JSON.stringify(dto.segments),
        sttProvider: 'aws-transcribe-medical-streaming',
      },
    });

    // Update encounter status to DRAFTING (skipping TRANSCRIBING since it's already done)
    await this.prisma.encounter.update({
      where: { id: encounterId },
      data: { status: 'DRAFTING' },
    });

    // Invoke Lambda directly in processStreamed mode (skip transcription, just generate SOAP)
    // Fire-and-forget: the Lambda will update the encounter status to IN_REVIEW when done
    this.lambda
      .send(
        new InvokeCommand({
          FunctionName: process.env.PROCESS_TRANSCRIPT_FUNCTION_NAME,
          InvocationType: 'Event', // Async invocation
          Payload: Buffer.from(
            JSON.stringify({
              mode: 'processStreamed',
              encounterId,
            }),
          ),
        }),
      )
      .catch((err) => {
        console.error(`Failed to invoke process-transcript Lambda: ${err}`);
      });

    return { status: 'DRAFTING' };
  }
}
