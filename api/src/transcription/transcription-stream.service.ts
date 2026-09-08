import { Injectable, Logger } from '@nestjs/common';
import {
  TranscribeStreamingClient,
  StartMedicalStreamTranscriptionCommand,
  AudioStream,
} from '@aws-sdk/client-transcribe-streaming';
import { PassThrough } from 'stream';

export interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: string;
  endTime: string;
  isPartial: boolean;
}

export interface StreamSession {
  audioStream: PassThrough;
  transcriptSegments: TranscriptSegment[];
  finalTranscript: string;
  isComplete: boolean;
  error?: string;
}

@Injectable()
export class TranscriptionStreamService {
  private readonly logger = new Logger(TranscriptionStreamService.name);
  private readonly client = new TranscribeStreamingClient({});
  private readonly sessions = new Map<string, StreamSession>();

  async startSession(sessionId: string): Promise<void> {
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    const audioStream = new PassThrough();
    const session: StreamSession = {
      audioStream,
      transcriptSegments: [],
      finalTranscript: '',
      isComplete: false,
    };
    this.sessions.set(sessionId, session);

    this.startTranscription(sessionId, audioStream, session).catch((err) => {
      this.logger.error(`Transcription error for ${sessionId}: ${err.message}`);
      session.error = err.message;
      session.isComplete = true;
    });
  }

  private async *audioGenerator(stream: PassThrough): AsyncGenerator<AudioStream> {
    for await (const chunk of stream) {
      yield { AudioEvent: { AudioChunk: chunk as Uint8Array } };
    }
  }

  private async startTranscription(
    sessionId: string,
    audioStream: PassThrough,
    session: StreamSession,
  ): Promise<void> {
    try {
      const command = new StartMedicalStreamTranscriptionCommand({
        LanguageCode: 'en-US',
        MediaEncoding: 'pcm',
        MediaSampleRateHertz: 16000,
        Specialty: 'PRIMARYCARE',
        Type: 'CONVERSATION',
        EnableChannelIdentification: false,
        NumberOfChannels: 1,
        ShowSpeakerLabel: true,
        AudioStream: this.audioGenerator(audioStream),
      });

      const response = await this.client.send(command);

      if (!response.TranscriptResultStream) {
        throw new Error('No transcript result stream');
      }

      // Process the streaming response
      for await (const event of response.TranscriptResultStream) {
        if ('TranscriptEvent' in event && event.TranscriptEvent?.Transcript?.Results) {
          for (const result of event.TranscriptEvent.Transcript.Results) {
            if (!result.Alternatives?.[0]) continue;

            const alt = result.Alternatives[0];
            const isPartial = result.IsPartial ?? true;

            if (!isPartial && alt.Transcript) {
              session.finalTranscript += (session.finalTranscript ? ' ' : '') + alt.Transcript;
            }
          }
        }
      }

      session.isComplete = true;
      this.logger.log(`Transcription complete for ${sessionId}`);
    } catch (err) {
      this.logger.error(`Transcription stream error: ${err}`);
      session.error = err instanceof Error ? err.message : String(err);
      session.isComplete = true;
    }
  }

  pushAudioChunk(sessionId: string, chunk: Buffer): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    session.audioStream.write(chunk);
  }

  async endSession(sessionId: string): Promise<StreamSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.audioStream.end();

    // Wait for transcription to complete (with timeout)
    const timeout = 30000;
    const start = Date.now();
    while (!session.isComplete && Date.now() - start < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.sessions.delete(sessionId);
    return session;
  }

  getSession(sessionId: string): StreamSession | undefined {
    return this.sessions.get(sessionId);
  }

  cancelSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.audioStream.destroy();
      this.sessions.delete(sessionId);
    }
  }
}
