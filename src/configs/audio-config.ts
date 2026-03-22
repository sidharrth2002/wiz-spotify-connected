import * as dotenv from 'dotenv';

dotenv.config();

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toFloat = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const systemAudioConfig = {
  sampleRate: toInt(process.env.SYSTEM_AUDIO_SAMPLE_RATE, 44100),
  chunkDurationMs: toInt(process.env.SYSTEM_AUDIO_CHUNK_DURATION_MS, 150),
  silenceThreshold: toFloat(process.env.SYSTEM_AUDIO_SILENCE_THRESHOLD, 0.01),
  sensitivity: toFloat(process.env.SYSTEM_AUDIO_SENSITIVITY, 1.35),
  minBeatIntervalMs: toInt(process.env.SYSTEM_AUDIO_MIN_BEAT_INTERVAL_MS, 90),
  smoothingFactor: toFloat(process.env.SYSTEM_AUDIO_SMOOTHING, 0.1)
};
