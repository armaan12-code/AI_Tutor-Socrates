import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { authRouter } from './routes/auth.js';
import { projectsRouter, sessionsRouter } from './routes/data.js';
import { tutorRouter } from './routes/tutor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = 3001;

app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use(express.json({ limit: '10mb' })); // Allow image data in requests

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/tutor', tutorRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: Date.now() }));
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n🏛️  Socrates API server running at http://localhost:${PORT}\n`);
  });
}

export default app;
