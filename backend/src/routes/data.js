import { Router } from 'express';
import bcrypt from 'bcryptjs';
import {
  Profile,
  AssetCategory,
  Asset,
  FinanceApplication,
  Approval,
  Guarantor,
  Document,
  DeleteRequest,
  EMISchedule,
  Payment,
  Notification,
  AuditLog,
  generateApplicationNumber,
} from '../models/index.js';
import { authMiddleware, requireRoles } from '../middleware/auth.js';
import { toId, toIds } from '../utils/serialize.js';
import { generateSchedule } from '../utils/emi.js';

const router = Router();

router.use(authMiddleware);

router.post('/profiles', requireRoles('SUPER_ADMIN', 'ADMIN', 'RETAILER'), async (req, res) => {
  try {
    const { email, password, fullName, phone, role, retailer_id } = req.body;
    if (!email || !fullName) {
      return res.status(400).json({ error: 'Email and full name are required' });
    }

    const normalizedEmail = email.toLowerCase();
    const existing = await Profile.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    let targetRole = role || 'CUSTOMER';
    if (req.user.role === 'RETAILER') {
      targetRole = 'CUSTOMER';
    }

    // ADMIN can only create RETAILER accounts (not CUSTOMER or SUPER_ADMIN)
    if (req.user.role === 'ADMIN') {
      if (targetRole !== 'RETAILER') {
        return res.status(403).json({ error: 'Admin can only create Retailer accounts' });
      }
    }

    if (req.user.role === 'ADMIN' && targetRole === 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Not authorized to create Super Admin accounts' });
    }

    const hashed = await bcrypt.hash(password || 'demo1234', 10);
    const profile = await Profile.create({
      email: normalizedEmail,
      password: hashed,
      full_name: fullName,
      phone: phone || null,
      role: targetRole,
      status: 'ACTIVE',
      retailer_id: null,
    });

    if (targetRole === 'CUSTOMER') {
      profile.retailer_id = req.user.role === 'RETAILER' ? req.user.id : retailer_id || null;
    }
    if (targetRole === 'RETAILER') {
      profile.retailer_id = profile._id;
    }

    await profile.save();
    res.status(201).json(toId(profile));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function pickProfile(p) {
  if (!p) return null;
  return {
    id: p._id?.toString() || p.id,
    full_name: p.full_name,
    email: p.email,
    phone: p.phone ?? null,
  };
}

function pickAsset(a) {
  if (!a) return null;
  const obj = toId(a);
  if (a.category_id && typeof a.category_id === 'object') {
    obj.category = toId(a.category_id);
  }
  return obj;
}

async function enrichApplication(app) {
  const obj = toId(app);
  const [customer, retailer, asset] = await Promise.all([
    Profile.findById(app.customer_id).select('full_name email phone'),
    app.retailer_id ? Profile.findById(app.retailer_id).select('full_name email phone') : null,
    app.asset_id ? Asset.findById(app.asset_id) : null,
  ]);
  obj.customer = customer ? pickProfile(customer) : null;
  obj.retailer = retailer ? { full_name: retailer.full_name } : null;
  obj.asset = asset
    ? {
        id: asset._id.toString(),
        name: asset.name,
        brand: asset.brand,
        model: asset.model,
        description: asset.description,
        price: asset.price,
        image_url: asset.image_url,
        ...toId(asset),
      }
    : null;
  return obj;
}

// ----- Profiles -----
router.get('/profiles', async (req, res) => {
  try {
    const { role, search, count } = req.query;
    const filter = {};

    if (role) filter.role = role;
    if (req.user.role === 'RETAILER') {
      // retailers see customers they created or customers tied to their applications
      const apps = await FinanceApplication.find({ retailer_id: req.user.id }).select('customer_id');
      const customerIds = [...new Set(apps.map((a) => a.customer_id.toString()))];
      filter.role = 'CUSTOMER';
      const or = [{ retailer_id: req.user.id }];
      if (customerIds.length) {
        or.push({ _id: { $in: customerIds } });
      }
      filter.$or = or;
    } else if (!['SUPER_ADMIN', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (search) {
      filter.$or = [
        { full_name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (count === 'true') {
      const total = await Profile.countDocuments(filter);
      return res.json({ count: total });
    }

    const profiles = await Profile.find(filter).sort({ created_at: -1 });
    res.json(toIds(profiles));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/profiles/:id', async (req, res) => {
  try {
    const isSelf = req.params.id === req.user.id;
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(req.user.role);

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updates = {};
    if (req.body.full_name !== undefined) updates.full_name = req.body.full_name;
    if (req.body.phone !== undefined) updates.phone = req.body.phone;
    if (isAdmin && req.body.role !== undefined) updates.role = req.body.role;
    if (isAdmin && req.body.status !== undefined) updates.status = req.body.status;

    const profile = await Profile.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(toId(profile));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Retailer can request deletion of a customer profile
router.post('/profiles/:id/request-delete', requireRoles('RETAILER'), async (req, res) => {
  try {
    const targetId = req.params.id;
    const target = await Profile.findById(targetId);
    if (!target) return res.status(404).json({ error: 'Profile not found' });

    // retailer may only request delete for their own customers
    if (target.role !== 'CUSTOMER') return res.status(400).json({ error: 'Target must be a customer' });
    if (target.retailer_id?.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to request delete for this customer' });
    }

    const dr = await DeleteRequest.create({
      requester_id: req.user.id,
      target_profile_id: targetId,
      retailer_id: req.user.id,
      message: req.body.message || null,
      status: 'PENDING',
    });

    await AuditLog.create({
      user_id: req.user.id,
      user_email: req.user.email,
      user_role: req.user.role,
      action: 'REQUEST_DELETE_PROFILE',
      entity_type: 'profile',
      entity_id: targetId,
      details: { delete_request_id: dr._id, message: req.body.message || null },
    });

    res.status(201).json({ success: true, id: dr._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin views pending delete requests
router.get('/delete-requests', requireRoles('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const requests = await DeleteRequest.find().sort({ created_at: -1 });
    res.json(toIds(requests));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin resolve delete request (approve -> delete profile, reject -> mark rejected)
router.put('/delete-requests/:id/resolve', requireRoles('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const dr = await DeleteRequest.findById(req.params.id);
    if (!dr) return res.status(404).json({ error: 'Delete request not found' });
    if (dr.status !== 'PENDING') return res.status(400).json({ error: 'Request already resolved' });

    const action = req.body.action; // 'APPROVE' or 'REJECT'
    if (!['APPROVE', 'REJECT'].includes(action)) return res.status(400).json({ error: 'Invalid action' });

    if (action === 'APPROVE') {
      // delete the profile permanently
      await Profile.findByIdAndDelete(dr.target_profile_id);
      dr.status = 'APPROVED';
    } else {
      dr.status = 'REJECTED';
    }

    dr.resolved_by = req.user.id;
    dr.resolved_at = new Date();
    await dr.save();

    await AuditLog.create({
      user_id: req.user.id,
      user_email: req.user.email,
      user_role: req.user.role,
      action: `DELETE_REQUEST_${action}`,
      entity_type: 'delete_request',
      entity_id: dr._id,
      details: { target_profile_id: dr.target_profile_id, message: dr.message },
    });

    res.json({ success: true, status: dr.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----- Asset Categories -----
router.get('/asset-categories', async (req, res) => {
  try {
    const categories = await AssetCategory.find().sort({ name: 1 });
    res.json(toIds(categories));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----- Assets -----
router.get('/assets', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    // retailers should only see their own uploaded assets
    if (req.user.role === 'RETAILER') {
      filter.retailer_id = req.user.id;
    }

    const assets = await Asset.find(filter)
      .populate('category_id')
      .sort({ created_at: -1 });

    const result = assets.map((a) => {
      const obj = toId(a);
      if (a.category_id) {
        obj.category = toId(a.category_id);
        obj.category_id = obj.category.id;
      }
      return obj;
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/assets/:id', async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id).populate('category_id');
    if (!asset) return res.status(404).json({ error: 'Asset not found' });
    // ensure retailers can't view others' private assets
    if (req.user.role === 'RETAILER' && asset.retailer_id?.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const obj = toId(asset);
    if (asset.category_id) {
      obj.category = toId(asset.category_id);
      obj.category_id = obj.category.id;
    }
    res.json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create asset (retailers and admins)
router.post('/assets', requireRoles('SUPER_ADMIN', 'ADMIN', 'RETAILER'), async (req, res) => {
  try {
    const payload = {
      category_id: req.body.category_id || null,
      name: req.body.name,
      brand: req.body.brand,
      model: req.body.model || null,
      description: req.body.description || null,
      price: req.body.price || 0,
      finance_min: req.body.finance_min || 0,
      finance_max: req.body.finance_max || 0,
      interest_rate: req.body.interest_rate || 12,
      max_tenure_months: req.body.max_tenure_months || 24,
      image_url: req.body.image_url || null,
      status: req.body.status || 'AVAILABLE',
    };

    if (req.user.role === 'RETAILER') payload.retailer_id = req.user.id;
    else if (req.body.retailer_id) payload.retailer_id = req.body.retailer_id;

    const asset = await Asset.create(payload);
    res.status(201).json(toId(asset));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----- Applications -----
router.get('/applications', async (req, res) => {
  try {
    const filter = {};
    const { status, statuses, customer_id, retailer_id, limit, application_ids } = req.query;

    if (req.user.role === 'CUSTOMER') {
      filter.customer_id = req.user.id;
    } else if (req.user.role === 'RETAILER') {
      filter.retailer_id = req.user.id;
    }

    if (status) filter.status = status;
    if (statuses) filter.status = { $in: statuses.split(',') };
    if (customer_id) filter.customer_id = customer_id;
    if (retailer_id) filter.retailer_id = retailer_id;
    if (application_ids) filter._id = { $in: application_ids.split(',') };

    let query = FinanceApplication.find(filter).sort({ created_at: -1 });
    if (limit) query = query.limit(parseInt(limit, 10));

    const apps = await query;
    const enriched = await Promise.all(apps.map(enrichApplication));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/applications/:id', async (req, res) => {
  try {
    const app = await FinanceApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });

    if (
      req.user.role === 'CUSTOMER' &&
      app.customer_id.toString() !== req.user.id
    ) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (
      req.user.role === 'RETAILER' &&
      app.retailer_id?.toString() !== req.user.id
    ) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(await enrichApplication(app));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/applications', async (req, res) => {
  try {
    const appNumber = await generateApplicationNumber();
    const customerId = req.body.customer_id || req.user.id;
    const retailerId =
      req.body.retailer_id ||
      (req.user.role === 'RETAILER' ? req.user.id : null);

    const app = await FinanceApplication.create({
      application_number: appNumber,
      customer_id: customerId,
      retailer_id: retailerId,
      asset_id: req.body.asset_id,
      asset_name: req.body.asset_name,
      asset_price: req.body.asset_price,
      finance_amount: req.body.finance_amount,
      down_payment: req.body.down_payment,
      interest_rate: req.body.interest_rate,
      tenure_months: req.body.tenure_months,
      monthly_emi: req.body.monthly_emi,
      total_payable: req.body.total_payable,
      status: req.body.status || 'DRAFT',
      employment_type: req.body.employment_type,
      monthly_income: req.body.monthly_income,
    });

    // optional guarantor data
    if (req.body.guarantor && typeof req.body.guarantor === 'object') {
      try {
        const g = req.body.guarantor;
        await Guarantor.create({
          application_id: app._id,
          full_name: g.full_name,
          relationship: g.relationship || null,
          phone: g.phone || null,
          email: g.email || null,
          aadhaar_number: g.aadhaar_number || null,
          monthly_income: g.monthly_income || null,
        });
      } catch (e) {
        // ignore guarantor creation failure but log
        console.warn('Failed to create guarantor', e.message);
      }
    }

    res.status(201).json(await enrichApplication(app));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/applications/:id/emi-schedule', async (req, res) => {
  try {
    const schedule = await EMISchedule.find({ application_id: req.params.id }).sort({
      installment_number: 1,
    });
    res.json(toIds(schedule));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/applications/:id/approvals', async (req, res) => {
  try {
    const approvals = await Approval.find({ application_id: req.params.id }).sort({
      created_at: 1,
    });
    res.json(toIds(approvals));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/applications/:id/documents', async (req, res) => {
  try {
    const docs = await Document.find({ application_id: req.params.id }).sort({ created_at: 1 });
    res.json(toIds(docs));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----- Documents -----
router.get('/documents', async (req, res) => {
  try {
    const filter = {};
    const { customer_id, retailer_id } = req.query;

    // If a specific customer_id is requested, enforce authorization rules
    if (customer_id) {
      // CUSTOMER may only request their own documents
      if (req.user.role === 'CUSTOMER' && customer_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // RETAILER may only request documents for customers that belong to them
      if (req.user.role === 'RETAILER') {
        const customerProfile = await Profile.findById(customer_id).select('role retailer_id');
        if (!customerProfile) return res.status(404).json({ error: 'Customer not found' });
        if (customerProfile.role !== 'CUSTOMER') return res.status(400).json({ error: 'Target must be a customer' });
        if (customerProfile.retailer_id?.toString() !== req.user.id) {
          return res.status(403).json({ error: 'Not authorized to view this customer documents' });
        }
      }

      // Admins and super admins can request any customer's documents
      filter.customer_id = customer_id;
    } else if (retailer_id) {
      // If retailer_id is provided, admins can query any retailer; retailers can query only their own
      if (req.user.role === 'RETAILER' && retailer_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      const apps = await FinanceApplication.find({ retailer_id }).select('_id');
      filter.application_id = { $in: apps.map((a) => a._id) };
    } else {
      if (req.user.role === 'CUSTOMER') {
        filter.customer_id = req.user.id;
      } else if (req.user.role === 'RETAILER') {
        const apps = await FinanceApplication.find({ retailer_id: req.user.id }).select('_id');
        filter.application_id = { $in: apps.map((a) => a._id) };
      }
    }

    const docs = await Document.find(filter).sort({ created_at: -1 });
    const result = await Promise.all(
      docs.map(async (doc) => {
        const obj = toId(doc);
        if (doc.application_id) {
          const app = await FinanceApplication.findById(doc.application_id).select(
            'application_number'
          );
          obj.application = app ? { application_number: app.application_number } : null;
        }
        return obj;
      })
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/documents', async (req, res) => {
  try {
    const doc = await Document.create({
      application_id: req.body.application_id || null,
      customer_id: req.user.id,
      document_type: req.body.document_type,
      file_name: req.body.file_name,
      file_size: req.body.file_size || 0,
      mime_type: req.body.mime_type,
      object_key: req.body.object_key || `mock-${Date.now()}`,
      uploaded_by: req.user.id,
      status: 'UPLOADED',
    });

    const obj = toId(doc);
    if (doc.application_id) {
      const app = await FinanceApplication.findById(doc.application_id).select('application_number');
      obj.application = app ? { application_number: app.application_number } : null;
    }
    res.status(201).json(obj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/documents/:id/status', requireRoles('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const doc = await Document.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(toId(doc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----- Notifications -----
router.get('/notifications', async (req, res) => {
  try {
    const notifs = await Notification.find({ user_id: req.user.id }).sort({ created_at: -1 });
    res.json(toIds(notifs));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/notifications/mark-read', async (req, res) => {
  try {
    const { id, all } = req.body;
    if (all) {
      await Notification.updateMany({ user_id: req.user.id, read: false }, { read: true });
    } else if (id) {
      await Notification.findByIdAndUpdate(id, { read: true });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----- Audit Logs -----
router.get('/audit-logs', requireRoles('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const logs = await AuditLog.find().sort({ created_at: -1 }).limit(200);
    res.json(toIds(logs));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----- Payments & EMI (reports) -----
router.get('/payments', requireRoles('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const payments = await Payment.find().select('amount status created_at');
    res.json(toIds(payments));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/emi-schedules', requireRoles('SUPER_ADMIN', 'ADMIN'), async (req, res) => {
  try {
    const schedules = await EMISchedule.find().select('status amount');
    res.json(toIds(schedules));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----- Application number RPC equivalent -----
router.get('/generate-application-number', async (req, res) => {
  try {
    const num = await generateApplicationNumber();
    res.json(num);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export async function generateEmiScheduleForApp(appId) {
  const app = await FinanceApplication.findById(appId);
  if (!app) return;

  await EMISchedule.deleteMany({ application_id: appId });
  const schedule = generateSchedule(app.finance_amount, app.interest_rate, app.tenure_months);
  const totalPayable = schedule.reduce((s, e) => s + e.amount, 0);

  await EMISchedule.insertMany(
    schedule.map((s) => ({ ...s, application_id: appId }))
  );

  app.monthly_emi = schedule[0]?.amount || 0;
  app.total_payable = Math.round(totalPayable * 100) / 100;
  await app.save();
}

export default router;
