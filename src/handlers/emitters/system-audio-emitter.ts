import NodeCache from 'node-cache';
import { EventEmitter } from 'node:events';
import { ColorSpace, Mode } from '../../classes/type-definitions.js';
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
  let leftTurn = true;
  let lastIdlePulseAt = 0;

  await audioService.start(async (frame) => {
    if (cacheManager.get('instance') !== 'running') return;

    const currentMode = cacheManager.get<Mode>('activeMode') ?? mode;

    const lights = audioEngine.processFrame(frame, currentMode);

    if (!lights) return;

    lastBeatTimestamp = frame.timestamp;
    lastIdlePulseAt = 0;
    if (currentMode === Mode.surround) {
      eventBus.emit('changeLightsSurround', {
        side: leftTurn ? 'left' : 'right',
        brightness: lights.brightness,
        colorSpace: lights.colorSpace
      });
      // Fallback: also broadcast a standard changeLights so rooms always get updates
      // even if surround splitting is off or layout is invalid.
      eventBus.emit('changeLights', lights.brightness, lights.colorSpace);
      leftTurn = !leftTurn;
    } else {
      eventBus.emit('changeLights', lights.brightness, lights.colorSpace);
    }

    await sleep(lights.delayMs);
  });

  while (cacheManager.get('instance') === 'running') {
    await sleep(250);

    const silenceMs = Date.now() - lastBeatTimestamp;

    if (silenceMs > 4500 && Date.now() - lastIdlePulseAt > 2000) {
      const pulseBrightness = 30 + Math.round(Math.random() * 20);
      const colorSpace = Math.random() > 0.5 ? ColorSpace.blue : ColorSpace.purple;

      // Reuse same emit path to ensure rooms get a pulse
      const currentMode = cacheManager.get<Mode>('activeMode') ?? mode;

      if (currentMode === Mode.surround) {
        eventBus.emit('changeLightsSurround', {
          side: leftTurn ? 'left' : 'right',
          brightness: pulseBrightness,
          colorSpace
        });
        eventBus.emit('changeLights', pulseBrightness, colorSpace);
        leftTurn = !leftTurn;
      } else {
        eventBus.emit('changeLights', pulseBrightness, colorSpace);
      }

      lastIdlePulseAt = Date.now();
      lastBeatTimestamp = Date.now();
    }

    if (silenceMs > 30000) {
      logger.warn('No audible signal detected for 30 seconds. Stopping system audio session.');
      cacheManager.set('instance', 'stopped');
      break;
    }
  }

  await audioService.stop();
};
