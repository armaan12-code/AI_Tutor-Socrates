import express from 'express';
import cors from 'cors';
import { authRouter } from './routes/auth.js';
import { projectsRouter, sessionsRouter } from './routes/data.js';

const app = express();
const PORT = 3001;

app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use(express.json({ limit: '10mb' })); // Allow image data in requests

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/sessions', sessionsRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: Date.now() }));

app.listen(PORT, () => {
  console.log(`\n🏛️  Socrates API server running at http://localhost:${PORT}\n`);
});
