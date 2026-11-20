// Keep listening separate from app construction so route tests can use app.inject() without
// opening a socket.
import { HOST, PORT } from './config.js';
import { app } from './app.js';

try {
  await app.listen({ port: PORT, host: HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
