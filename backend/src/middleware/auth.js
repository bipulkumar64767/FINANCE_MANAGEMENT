import jwt from 'jsonwebtoken';
import { Profile } from '../models/index.js';
import { toId } from '../utils/serialize.js';

export function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const profile = await Profile.findById(payload.userId);
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    if (profile.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Account suspended by admin' });
    }
    if (profile.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account deleted by admin' });
    }
    req.user = toId(profile);
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();

  jwt.verify(token, process.env.JWT_SECRET, async (err, payload) => {
    if (!err && payload?.userId) {
      const profile = await Profile.findById(payload.userId);
      if (profile) req.user = toId(profile);
    }
    next();
  });
}

export function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized for this action' });
    }
    next();
  };
}
