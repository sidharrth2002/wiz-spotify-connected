import { inject, injectable } from 'inversify';
import fftPkg from 'fft-js';
import { AudioTee } from 'audiotee';
import { AudioFrame } from '../../classes/type-definitions.js';
import { systemAudioConfig } from '../../configs/audio-config.js';
import { Logger } from '../../utils/logger.js';
import { TYPES } from '../../utils/types.js';

export type FrameHandler = (frame: AudioFrame) => Promise<void> | void;
export type AudioStartOptions = {
  sampleRate?: number;
  chunkDurationMs?: number;
};

@injectable()
export class SystemAudioService {
  private audioCapture?: AudioTee;
  private processing = Promise.resolve();
  private isRunning = false;

  constructor(@inject(TYPES.Logger) private readonly logger: Logger) { }

  public async start(onFrame: FrameHandler, options?: AudioStartOptions): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('System audio capture already running. Restarting with new configuration.');
      await this.stop();
    }

    const sampleRate = options?.sampleRate ?? systemAudioConfig.sampleRate;
    const chunkDurationMs = options?.chunkDurationMs ?? systemAudioConfig.chunkDurationMs;

    this.audioCapture = new AudioTee({
      sampleRate,
      chunkDurationMs
    });

    this.isRunning = true;

    this.audioCapture.on('data', (chunk) => {
      if (!this.isRunning) return;

      const frame = this.buildFrame(chunk.data, sampleRate);
      this.processing = this.processing.then(() => onFrame(frame)).catch((err: Error) => {
        this.logger.error('Failed to process system audio frame', err.message);
      });
    });

    this.audioCapture.on('error', (err: Error) => {
      this.logger.error('System audio capture error', err.message);
      void this.stop();
    });

    this.audioCapture.on('log', (level, message) => {
      this.logger.debug(`[AudioTee:${level}] ${message.message}`, message.context);
    });

    await this.audioCapture.start();
    this.logger.info(`System audio capture started (sampleRate=${sampleRate}, chunkDurationMs=${chunkDurationMs})`);
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    await this.processing;

    await this.audioCapture?.stop().catch((err: Error) => {
      this.logger.error('Error while stopping system audio capture', err.message);
    });

    this.audioCapture?.removeAllListeners();
    this.audioCapture = undefined;

    this.logger.info('System audio capture stopped');
  }

  private buildFrame(chunk: Buffer, sampleRate: number): AudioFrame {
    const bytesPerSample = 2;
    const totalSamples = chunk.length / bytesPerSample;
    if (!Number.isFinite(totalSamples) || totalSamples <= 0) {
      return {
        rms: 0,
        peak: 0,
        dominantFrequency: 0,
        sampleRate,
        timestamp: Date.now()
      };
    }

    const fftInputSize = this.nextPowerOfTwo(totalSamples);
    const mono = new Array<number>(fftInputSize).fill(0);

    let peak = 0;
    let sumSquares = 0;

    for (let byteIndex = 0, monoIndex = 0; monoIndex < totalSamples; monoIndex++, byteIndex += bytesPerSample) {
      const sample = chunk.readInt16LE(byteIndex) / 32768;

      mono[monoIndex] = sample;
      peak = Math.max(peak, Math.abs(sample));
      sumSquares += sample * sample;
    }

    const rms = Math.sqrt(sumSquares / totalSamples);
    const { fft, util } = fftPkg;
    const phasors = fft(mono);
    const magnitudes = util.fftMag(phasors).slice(0, fftInputSize);

    let dominantIndex = 0;
    let dominantMagnitude = 0;

    for (let i = 1; i < magnitudes.length; i++) {
      if (magnitudes[i] > dominantMagnitude) {
        dominantMagnitude = magnitudes[i];
        dominantIndex = i;
      }
    }

    const dominantFrequency = dominantIndex * (sampleRate / fftInputSize);

    return {
      rms,
      peak,
      dominantFrequency,
      sampleRate,
      timestamp: Date.now()
    };
  }

  private nextPowerOfTwo(value: number): number {
    let power = 1;
    while (power < value) {
      power <<= 1;
    }
    return power;
  }
}
