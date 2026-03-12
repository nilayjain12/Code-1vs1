import { io } from 'socket.io-client';

let socket = null;
let currentToken = null;

export function getSocket() {
  return socket;
}

export function connectSocket(token) {
  if (socket?.connected && currentToken === token) return socket;

  if (socket) {
    socket.disconnect();
  }
  
  currentToken = token;

  const socketUrl = import.meta.env.VITE_SOCKET_URL || '/';
  socket = io(socketUrl, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('⚡ Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('💤 Socket disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
