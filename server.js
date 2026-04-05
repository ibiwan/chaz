// Basic Express server with Postgres and Socket.IO
import express from 'express';
import { createServer } from 'http';
import { createSocketServer } from './service/notify.js';
import { Client } from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = createSocketServer(httpServer);

// Postgres client setup
const pgClient = new Client({
  connectionString: process.env.DATABASE_URL || 'postgres://user:password@localhost:5432/mydb',
});
pgClient.connect().then(() => console.log('Connected to Postgres')).catch(console.error);

// Middleware
app.use(express.json());
app.use('/api', apiRouter);
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export { io };
