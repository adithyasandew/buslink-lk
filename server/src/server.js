import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './app.js';

const port = process.env.PORT || 5000;
const app = createApp({ clientOrigin: process.env.CLIENT_ORIGIN });

if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.error('MongoDB connection failed:', err.message));
}

app.listen(port, () => console.log(`API listening on port ${port}`));
