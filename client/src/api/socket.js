import { io } from 'socket.io-client'
import { tokenStore } from './client'

/** One authenticated Socket.IO connection (same origin; the dev server proxies /socket.io to the API). */
export function connectSocket() {
  return io({ auth: { token: tokenStore.get() }, transports: ['websocket'] })
}
