import { io, Socket } from 'socket.io-client';
import config from '@/config';
import { getToken } from '@/lib/api';

/**
 * Lightweight Socket.IO client wrapper.
 * Connect once and reuse. Events are exposed via on()/off()/emit().
 */
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(config.socketUrl, {
      auth: { token: getToken() },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
  }
  return socket;
}

export function connectSocket(interviewId?: string) {
  const s = getSocket();
  if (interviewId) s.emit('join-room', { interviewId });
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export default getSocket;