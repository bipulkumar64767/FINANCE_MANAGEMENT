import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Profile } from '../models/index.js';
import { toId } from '../utils/serialize.js';
import { seedDatabase } from '../seed.js';

const router = Router();

const demoUsers = [
  { email: 'admin@demo.com', password: 'demo1234', fullName: 'System Admin', role: 'SUPER_ADMIN', phone: '+91 90000 00001' },
  { email: 'manager@demo.com', password: 'demo1234', fullName: 'Finance Manager', role: 'ADMIN', phone: '+91 90000 00002' },
  { email: 'retailer@demo.com', password: 'demo1234', fullName: 'Vijay Electronics', role: 'RETAILER', phone: '+91 90000 00003' },
  { email: 'customer@demo.com', password: 'demo1234', fullName: 'Rajesh Kumar', role: 'CUSTOMER', phone: '+91 90000 00004' },
];

router.post('/seed-demo-users', async (req, res) => {
  try {
    const results = [];

    for (const user of demoUsers) {
      const existing = await Profile.findOne({ email: user.email });
      if (existing) {
        results.push({
          email: user.email,
          status: 'already_exists',
          userId: existing._id.toString(),
        });
        continue;
      }

      const hashed = await bcrypt.hash(user.password, 10);
      const profile = await Profile.create({
        email: user.email,
        password: hashed,
        full_name: user.fullName,
        role: user.role,
        phone: user.phone,
        status: 'ACTIVE',
      });

      if (user.role === 'RETAILER') {
        profile.retailer_id = profile._id;
        await profile.save();
      }

      results.push({
        email: user.email,
        status: 'created',
        userId: profile._id.toString(),
      });
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/seed-database', async (req, res) => {
  try {
    const result = await seedDatabase({ force: req.body?.force === true });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
