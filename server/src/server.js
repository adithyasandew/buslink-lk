import 'dotenv/config';
import http from 'node:http';
import { createApp } from './app.js';
import { attachRealtime } from './realtime.js';
import { connectDatabase, disconnectDatabase } from './db.js';
import { getJwtSecret } from './config.js';

const port = Number(process.env.PORT) || 5000;

async function main() {
  getJwtSecret(); // fail fast on a missing or default secret in production
  const conn = await connectDatabase(process.env.MONGODB_URI);
  console.log(`MongoDB connected (${conn.name}); indexes ready`);

  const app = createApp({ clientOrigin: process.env.CLIENT_ORIGIN });
  const server = http.createServer(app);
  const io = attachRealtime(server, { clientOrigin: process.env.CLIENT_ORIGIN });
  server.listen(port, () => console.log(`API listening on port ${port}`));

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    setTimeout(() => process.exit(1), 10000).unref();
    io.close(async () => { // also closes the HTTP server
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(`Startup failed: ${err.message}`);
  process.exit(1);
});
