import 'dotenv/config';
import mongoose from 'mongoose';
import http from 'node:http';
import { createApp } from './app.js';
import { attachRealtime } from './realtime.js';

const port = process.env.PORT || 5000;
const app = createApp({ clientOrigin: process.env.CLIENT_ORIGIN });

if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.error('MongoDB connection failed:', err.message));
}

const server = http.createServer(app);
attachRealtime(server, { clientOrigin: process.env.CLIENT_ORIGIN });
server.listen(port, () => console.log(`API listening on port ${port}`));
