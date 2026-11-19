/**
 * The server itself: the port, and nothing else.
 *
 * What it serves is `app.ts`, which builds the application and hangs the
 * routes on it without opening anything. The two are apart so that the routes
 * can be asked questions from a test —`app.inject()`— without a socket: a
 * file that listens as it loads cannot be imported (§11.60).
 */
import { HOST, PORT } from './config.js';
import { app } from './app.js';

try {
  await app.listen({ port: PORT, host: HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
