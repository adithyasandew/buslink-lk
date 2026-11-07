import { EventEmitter } from 'node:events';
import Notification from '../models/Notification.js';

/** In-process event bus; the Socket.IO layer subscribes to these events. */
export const events = new EventEmitter();

export async function notify(userId, type, message, relatedId) {
  const n = await Notification.create({ userId, type, message, relatedId });
  events.emit('notification', n);
  return n;
}
