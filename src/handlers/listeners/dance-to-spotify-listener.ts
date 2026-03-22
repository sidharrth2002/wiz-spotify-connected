import { EventEmitter } from 'node:events';
import { Bulb, ColorSpace, Mode } from '../../classes/type-definitions.js';
import { setRoom } from '../../services/wiz/lights-service.js';
import { container } from '../../utils/inversify-orchestrator.js';
import { TYPES } from '../../utils/types.js';

export const listenToDanceToSpotifyEvent = async (roomIds: Array<string>, mode?: Mode) => {
  const eventBus = container.get<EventEmitter>(TYPES.EventBus);

  eventBus.removeAllListeners('changeLights');
  eventBus.removeAllListeners('changeLightsSurround');

  eventBus.on('changeLights', async (brightness: number, colorSpace: ColorSpace) => {
    const bulb: Bulb = {
      state: true,
      brightness
    };

    const promises = roomIds.map(roomId => setRoom(roomId, bulb, colorSpace));

    await Promise.all(promises);
  });

  if (mode !== Mode.surround) return;

  const leftRooms = roomIds.length ? [roomIds[0]] : [];
  const rightRooms = roomIds.slice(1).length ? roomIds.slice(1) : leftRooms;

  eventBus.on('changeLightsSurround', async (payload: { side: 'left' | 'right'; brightness: number; colorSpace: ColorSpace }) => {
    const primaryRooms = payload.side === 'left' ? leftRooms : rightRooms;
    const secondaryRooms = payload.side === 'left' ? rightRooms : leftRooms;

    if (!primaryRooms.length) return;

    const leadBulb: Bulb = { state: true, brightness: payload.brightness };
    const trailBulb: Bulb = { state: true, brightness: Math.max(8, Math.round(payload.brightness * 0.35)) };

    const updates = [
      ...primaryRooms.map(roomId => setRoom(roomId, leadBulb, payload.colorSpace)),
      ...secondaryRooms.map(roomId => setRoom(roomId, trailBulb, payload.colorSpace))
    ];

    await Promise.all(updates);
  });
};
