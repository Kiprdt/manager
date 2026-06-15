import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import websocket from '@fastify/websocket';

const websocketPlugin: FastifyPluginAsync = fp(async (server) => {
  server.register(websocket, {
    options: { maxPayload: 1048576 },
  });
});

export default websocketPlugin;
