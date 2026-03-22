import { injectable } from 'inversify';
import { AudioFrame, ColorSpace, Lights, Mode } from '../classes/type-definitions.js';
import { systemAudioConfig } from '../configs/audio-config.js';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

@injectable()
export class SystemAudioEngine {
  private runningEnergy = 0;
  private lastBeatAt = 0;
  private lastIntervalMs = 150;
  private alternateBrightness = true;
  private sensitivity = systemAudioConfig.sensitivity;

  public configure(options?: { sensitivity?: number }): void {
    if (options?.sensitivity) {
      this.sensitivity = options.sensitivity;
    }
  }

  public reset(): void {
    this.runningEnergy = 0;
    this.lastBeatAt = 0;
    this.lastIntervalMs = 150;
    this.alternateBrightness = true;
    this.sensitivity = systemAudioConfig.sensitivity;
  }

  public processFrame(frame: AudioFrame, mode: Mode): Lights | null {
    if (frame.rms < systemAudioConfig.silenceThreshold) return null;

    if (!this.detectBeat(frame)) return null;

    const colorSpace = this.mapFrequencyToColorSpace(frame.dominantFrequency);
    const brightness = this.calculateBrightness(frame.rms, mode);
    const delayMs = this.calculateDelay(mode);

    return { brightness, colorSpace, delayMs };
  }

  private detectBeat(frame: AudioFrame): boolean {
    const now = frame.timestamp;
    if (this.runningEnergy === 0) {
      this.runningEnergy = frame.rms;
      this.lastBeatAt = now;
      return false;
    }

    const energyRatio = frame.rms / (this.runningEnergy || 0.0001);
    const beatDetected = energyRatio > this.sensitivity && (now - this.lastBeatAt) > systemAudioConfig.minBeatIntervalMs;

    this.runningEnergy = (1 - systemAudioConfig.smoothingFactor) * this.runningEnergy + systemAudioConfig.smoothingFactor * frame.rms;

    if (beatDetected) {
      if (this.lastBeatAt > 0) {
        this.lastIntervalMs = now - this.lastBeatAt;
      }
      this.lastBeatAt = now;
    }

    return beatDetected;
  }

  private calculateBrightness(rms: number, mode: Mode): number {
    let brightness = clamp(Math.round(rms * 140), 10, 100);

    if (mode === Mode.calm) {
      brightness = Math.round(brightness * 0.6);
      return clamp(brightness, 8, 80);
    }

    if (mode === Mode.party) {
      const value = this.alternateBrightness ? 100 : 12;
      this.alternateBrightness = !this.alternateBrightness;
      return value;
    }

    const adjusted = this.alternateBrightness ? brightness : Math.round(brightness * 0.75);
    this.alternateBrightness = !this.alternateBrightness;
    return clamp(adjusted, 10, 100);
  }

  private calculateDelay(mode: Mode): number {
    let delay = this.lastIntervalMs || 120;

    if (mode === Mode.calm) {
      delay *= 1.5;
    } else if (mode === Mode.party) {
      delay *= 0.75;
    }

    return clamp(Math.round(delay), 60, 800);
  }

  private mapFrequencyToColorSpace(freq: number): ColorSpace {
    if (!Number.isFinite(freq) || freq <= 0) {
      return ColorSpace.blue;
    }

    if (freq < 120) return ColorSpace.red;
    if (freq < 250) return ColorSpace.orange;
    if (freq < 400) return ColorSpace.yellow;
    if (freq < 800) return ColorSpace.green;
    if (freq < 2000) return ColorSpace.blue;
    return freq < 4000 ? ColorSpace.purple : ColorSpace.pink;
  }
}
