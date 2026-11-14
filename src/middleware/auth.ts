import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { ensureBaselineDataSeeded } from '../db/seed.ts';
import { getOrCreateUser, type UserWithRole } from '../db/users.ts';

export interface AuthRequest extends Request {
  user?: UserWithRole;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing authentication token.' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Empty authentication token.' });
    return;
  }

  try {
    await ensureBaselineDataSeeded();
    const decoded = await adminAuth.verifyIdToken(token);
    const dbUser = await getOrCreateUser(
      decoded.uid,
      decoded.email || `${decoded.uid}@paperpulse.local`,
      decoded.name,
      decoded.picture ?? null
    );

    if (!dbUser.isActive) {
      res.status(403).json({ error: 'Account is deactivated. Contact your Administrator.' });
      return;
    }

    req.user = dbUser;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token.' });
  }
};

export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (
      req.user.roleName === 'Administrator' ||
      req.user.permissions.includes(permission)
    ) {
      next();
      return;
    }
    res.status(403).json({
      error: `Forbidden: Role '${req.user.roleName}' lacks required permission '${permission}'.`,
    });
  };
};
