import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { projectQueries, sessionQueries, messageQueries } from '../db.js';
import { JWT_SECRET } from './auth.js';

export const projectsRouter = Router();
export const sessionsRouter = Router();

// ─── Auth Middleware ─────────────────────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    (req as any).userId = payload.userId;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// ─── Projects ────────────────────────────────────────────────────────────────

// GET /api/projects
projectsRouter.get('/', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const projects = projectQueries.listByUser.all(userId);
  return res.json(projects);
});

// POST /api/projects
projectsRouter.post('/', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const { name } = req.body as { name: string };
  if (!name?.trim()) return res.status(400).json({ error: 'Project name is required.' });
  const id = Date.now().toString();
  projectQueries.insert.run(id, userId, name.trim(), Date.now());
  return res.status(201).json(projectQueries.findById.get(id));
});

// PATCH /api/projects/:id
projectsRouter.patch('/:id', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const project = projectQueries.findById.get(req.params.id);
  if (!project || project.user_id !== userId) return res.status(404).json({ error: 'Project not found.' });
  const { name } = req.body as { name: string };
  if (!name?.trim()) return res.status(400).json({ error: 'Project name is required.' });
  projectQueries.update.run(name.trim(), req.params.id);
  return res.json(projectQueries.findById.get(req.params.id));
});

// DELETE /api/projects/:id
projectsRouter.delete('/:id', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const project = projectQueries.findById.get(req.params.id);
  if (!project || project.user_id !== userId) return res.status(404).json({ error: 'Project not found.' });
  projectQueries.delete.run(req.params.id);
  return res.status(204).send();
});

// ─── Sessions ────────────────────────────────────────────────────────────────

// GET /api/sessions  — returns sessions with their messages
sessionsRouter.get('/', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const sessions = sessionQueries.listByUser.all(userId);
  const result = sessions.map(s => ({
    ...s,
    messages: messageQueries.listBySession.all(s.id),
  }));
  return res.json(result);
});

// POST /api/sessions
sessionsRouter.post('/', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const { id, title, project_id, messages, updated_at } = req.body as {
    id: string; title: string; project_id?: string | null;
    messages: any[]; updated_at: number;
  };
  sessionQueries.insert.run(id, userId, project_id ?? null, title, updated_at ?? Date.now());
  if (messages?.length) {
    for (const m of messages) {
      messageQueries.insert.run(m.id, id, m.role, m.content, m.image ?? null, m.timestamp);
    }
  }
  return res.status(201).json({ id, title, project_id: project_id ?? null, updated_at });
});

// PATCH /api/sessions/:id — update title, project_id, or append new messages
sessionsRouter.patch('/:id', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const session = sessionQueries.findById.get(req.params.id);
  if (!session || session.user_id !== userId) return res.status(404).json({ error: 'Session not found.' });

  const { title, project_id, messages, updated_at } = req.body as {
    title?: string; project_id?: string | null;
    messages?: any[]; updated_at?: number;
  };

  sessionQueries.update.run(
    title ?? session.title,
    project_id !== undefined ? project_id : session.project_id,
    updated_at ?? Date.now(),
    req.params.id
  );

  // Replace messages if provided
  if (messages) {
    messageQueries.deleteBySession.run(req.params.id);
    for (const m of messages) {
      messageQueries.insert.run(m.id, req.params.id, m.role, m.content, m.image ?? null, m.timestamp);
    }
  }

  return res.json(sessionQueries.findById.get(req.params.id));
});

// DELETE /api/sessions/:id
sessionsRouter.delete('/:id', requireAuth, (req: Request, res: Response) => {
  const userId = (req as any).userId as number;
  const session = sessionQueries.findById.get(req.params.id);
  if (!session || session.user_id !== userId) return res.status(404).json({ error: 'Session not found.' });
  sessionQueries.delete.run(req.params.id);
  return res.status(204).send();
});
