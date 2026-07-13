import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Profile } from '../models/index.js';
import { authMiddleware, signToken } from '../middleware/auth.js';
import { toId } from '../utils/serialize.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const profile = await Profile.findOne({ email: email.toLowerCase() });
    if (!profile) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (profile.status === 'SUSPENDED') {
      return res.status(403).json({ error: 'Account suspended by admin' });
    }
    if (profile.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Account deleted by admin' });
    }

    const valid = await bcrypt.compare(password, profile.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(profile._id.toString());
    const user = toId(profile);

    res.json({
      access_token: token,
      user: { id: user.id, email: user.email },
      profile: user,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, fullName, phone, role } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }

    const existing = await Profile.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const profile = await Profile.create({
      email: email.toLowerCase(),
      password: hashed,
      full_name: fullName,
      phone: phone || null,
      role: role || 'CUSTOMER',
      status: 'ACTIVE',
      retailer_id: role === 'RETAILER' ? null : null,
    });

    if (role === 'RETAILER') {
      profile.retailer_id = profile._id;
      await profile.save();
    }

    const token = signToken(profile._id.toString());
    const user = toId(profile);

    res.status(201).json({
      access_token: token,
      user: { id: user.id, email: user.email },
      profile: user,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ profile: req.user });
});

router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const profile = await Profile.findById(req.user.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    profile.password = await bcrypt.hash(newPassword, 10);
    await profile.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
