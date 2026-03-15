import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socket = null;

export function useSocket() {
  if (!socket) {
    socket = io('http://localhost:5001', { transports: ['websocket'] });
  }
  return socket;
}

export function useSocketEvent(event, handler) {
  const socket = useSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const fn = (...args) => handlerRef.current(...args);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [event, socket]);
}
