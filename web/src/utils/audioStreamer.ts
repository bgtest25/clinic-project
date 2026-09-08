import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL;

export interface StreamingTranscript {
  transcript: string;
  segments: Array<{
    speaker: string;
    text: string;
    startTime: string;
    endTime: string;
  }>;
}

export class AudioStreamer {
  private socket: Socket | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private sessionId: string | null = null;

  async connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Extract base URL without /api/v1
      const baseUrl = API_URL.replace(/\/api\/v1$/, '');

      this.socket = io(`${baseUrl}/transcription`, {
        auth: { token },
        transports: ['websocket'],
      });

      this.socket.on('connect', () => resolve());
      this.socket.on('connect_error', (err) => reject(err));
      this.socket.on('error', (data) => console.error('Socket error:', data));
    });
  }

  async startStreaming(encounterId: string, token: string): Promise<string> {
    if (!this.socket?.connected) {
      throw new Error('Socket not connected');
    }

    // Start the transcription session on the server
    return new Promise((resolve, reject) => {
      this.socket!.emit(
        'start-stream',
        { encounterId, token },
        (response: { success: boolean; sessionId?: string; error?: string }) => {
          if (response.success && response.sessionId) {
            this.sessionId = response.sessionId;
            resolve(response.sessionId);
          } else {
            reject(new Error(response.error || 'Failed to start stream'));
          }
        },
      );
    });
  }

  async captureAudio(): Promise<MediaStream> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Use ScriptProcessorNode to capture raw PCM
    // Buffer size of 4096 gives us ~256ms of audio at 16kHz
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      if (!this.socket?.connected) return;

      const inputData = event.inputBuffer.getChannelData(0);
      // Convert Float32 to Int16 PCM
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      this.socket.emit('audio-chunk', pcmData.buffer);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    return this.mediaStream;
  }

  async stopStreaming(): Promise<StreamingTranscript> {
    // Stop audio capture
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    // End the streaming session and get the final transcript
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit(
        'end-stream',
        (response: { success: boolean; transcript?: string; segments?: any[]; error?: string }) => {
          if (response.success) {
            resolve({
              transcript: response.transcript || '',
              segments: response.segments || [],
            });
          } else {
            reject(new Error(response.error || 'Failed to end stream'));
          }
        },
      );
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.sessionId = null;
  }

  getMediaStream(): MediaStream | null {
    return this.mediaStream;
  }
}
