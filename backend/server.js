import './src/config/timezone.js';
import http from 'http';
import app from './src/app.js';
import { env } from './src/config/env.js';
import { initSocket } from './src/services/socket.js';

const server = http.createServer(app);
initSocket(server);

server.listen(env.port, () => {
  console.log(`Urban Services API listening on port ${env.port}`);
});
