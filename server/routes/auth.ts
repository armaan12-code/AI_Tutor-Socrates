import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userQueries } from '../db.js';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'socrates-super-secret-jwt-key-change-in-production';

function signToken(userId: number) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

// POST /api/auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body as { name: string; email: string; password: string };

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const existing = userQueries.findByEmail.get(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const result = userQueries.insert.run(name.trim(), email.toLowerCase().trim(), hash);
    const userId = Number(result.lastInsertRowid);

    const user = userQueries.findById.get(userId)!;
    const token = signToken(userId);

    return res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = userQueries.findByEmail.get(email.toLowerCase().trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signToken(user.id);
    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/me
authRouter.get('/me', (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided.' });

    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    const user = userQueries.findById.get(payload.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    return res.json({ id: user.id, name: user.name, email: user.email });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
});

export { JWT_SECRET };
