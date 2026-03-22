import NodeCache from 'node-cache';
import { EventEmitter } from 'node:events';
import { Mode } from '../../classes/type-definitions.js';
import { container } from '../../utils/inversify-orchestrator.js';
import { Logger } from '../../utils/logger.js';
import { TYPES } from '../../utils/types.js';
import { SystemAudioEngine } from '../../utils/system-audio-engine.js';
import { SystemAudioService } from '../../services/audio/system-audio-service.js';

const sleep = async (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type SystemAudioOptions = {
  sensitivity?: number;
};

export const emitDanceToSystemAudioEvent = async (mode: Mode, options?: SystemAudioOptions): Promise<void> => {
  const cacheManager = container.get<NodeCache>(TYPES.CacheManager);
  const logger = container.get<Logger>(TYPES.Logger);
  const eventBus = container.get<EventEmitter>(TYPES.EventBus);
  const audioEngine = container.get<SystemAudioEngine>(TYPES.SystemAudioEngine);
  const audioService = container.get<SystemAudioService>(TYPES.SystemAudioService);

  audioEngine.reset();
  audioEngine.configure({ sensitivity: options?.sensitivity });

  let lastBeatTimestamp = Date.now();

  await audioService.start(async (frame) => {
    if (cacheManager.get('instance') !== 'running') return;

    const lights = audioEngine.processFrame(frame, mode);

    if (!lights) return;

    lastBeatTimestamp = frame.timestamp;
    eventBus.emit('changeLights', lights.brightness, lights.colorSpace);

    await sleep(lights.delayMs);
  });

  while (cacheManager.get('instance') === 'running') {
    await sleep(250);

    if (Date.now() - lastBeatTimestamp > 30000) {
      logger.warn('No audible signal detected for 30 seconds. Stopping system audio session.');
      cacheManager.set('instance', 'stopped');
      break;
    }
  }

  await audioService.stop();
};
