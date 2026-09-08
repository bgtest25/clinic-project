import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { TranscriptionStreamService } from './transcription-stream.service';
import { WsAuthGuard } from './ws-auth.guard';

interface StartStreamPayload {
  encounterId: string;
  token: string;
}

@WebSocketGateway({
  namespace: '/transcription',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['https://havenote.health', 'https://app.havenote.health'],
    credentials: true,
  },
})
export class TranscriptionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TranscriptionGateway.name);
  private readonly socketToSession = new Map<string, string>();

  constructor(private readonly streamService: TranscriptionStreamService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    const sessionId = this.socketToSession.get(client.id);
    if (sessionId) {
      this.streamService.cancelSession(sessionId);
      this.socketToSession.delete(client.id);
    }
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage('start-stream')
  async handleStartStream(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: StartStreamPayload,
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    try {
      const sessionId = `${payload.encounterId}-${Date.now()}`;
      await this.streamService.startSession(sessionId);
      this.socketToSession.set(client.id, sessionId);

      this.logger.log(`Started streaming session ${sessionId} for encounter ${payload.encounterId}`);
      return { success: true, sessionId };
    } catch (err) {
      this.logger.error(`Failed to start stream: ${err}`);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  @SubscribeMessage('audio-chunk')
  handleAudioChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ArrayBuffer,
  ): void {
    const sessionId = this.socketToSession.get(client.id);
    if (!sessionId) {
      client.emit('error', { message: 'No active session' });
      return;
    }

    try {
      const buffer = Buffer.from(data);
      this.streamService.pushAudioChunk(sessionId, buffer);
    } catch (err) {
      this.logger.error(`Error pushing audio chunk: ${err}`);
      client.emit('error', { message: 'Failed to process audio chunk' });
    }
  }

  @SubscribeMessage('end-stream')
  async handleEndStream(
    @ConnectedSocket() client: Socket,
  ): Promise<{ success: boolean; transcript?: string; segments?: any[]; error?: string }> {
    const sessionId = this.socketToSession.get(client.id);
    if (!sessionId) {
      return { success: false, error: 'No active session' };
    }

    try {
      const session = await this.streamService.endSession(sessionId);
      this.socketToSession.delete(client.id);

      if (session.error) {
        return { success: false, error: session.error };
      }

      return {
        success: true,
        transcript: session.finalTranscript,
        segments: session.transcriptSegments,
      };
    } catch (err) {
      this.logger.error(`Error ending stream: ${err}`);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  @SubscribeMessage('get-status')
  handleGetStatus(@ConnectedSocket() client: Socket): { hasSession: boolean; transcript?: string } {
    const sessionId = this.socketToSession.get(client.id);
    if (!sessionId) {
      return { hasSession: false };
    }

    const session = this.streamService.getSession(sessionId);
    return {
      hasSession: true,
      transcript: session?.finalTranscript,
    };
  }
}
