import { FastifyPluginAsync } from 'fastify';
import { WebSocket } from '@fastify/websocket';
import { hub } from './hub';

const wsRoutes: FastifyPluginAsync = async (server) => {
  server.get('/ws', { websocket: true }, (socket: WebSocket) => {
    hub.add(socket);

    // Подтверждение подключения
    socket.send(JSON.stringify({ type: 'connected', clientCount: hub.size }));
  });
};

export default wsRoutes;
