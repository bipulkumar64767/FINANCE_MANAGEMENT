import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDB } from './db.js';
import {
  Profile,
  AssetCategory,
  Asset,
  FinanceApplication,
  Approval,
  Document,
  EMISchedule,
  Payment,
  Notification,
  AuditLog,
  Counter,
} from './models/index.js';
import { generateSchedule } from './utils/emi.js';

const demoUsers = [
  { email: 'admin@demo.com', password: 'demo1234', fullName: 'System Admin', role: 'SUPER_ADMIN', phone: '+91 90000 00001' },
  { email: 'manager@demo.com', password: 'demo1234', fullName: 'Finance Manager', role: 'ADMIN', phone: '+91 90000 00002' },
  { email: 'retailer@demo.com', password: 'demo1234', fullName: 'Vijay Electronics', role: 'RETAILER', phone: '+91 90000 00003' },
  { email: 'customer@demo.com', password: 'demo1234', fullName: 'Rajesh Kumar', role: 'CUSTOMER', phone: '+91 90000 00004' },
];

async function ensureUsers() {
  const users = {};
  for (const u of demoUsers) {
    let profile = await Profile.findOne({ email: u.email });
    if (!profile) {
      profile = await Profile.create({
        email: u.email,
        password: await bcrypt.hash(u.password, 10),
        full_name: u.fullName,
        role: u.role,
        phone: u.phone,
        status: 'ACTIVE',
      });
      if (u.role === 'RETAILER') {
        profile.retailer_id = profile._id;
        await profile.save();
      }
      console.log(`Created user: ${u.email}`);
    } else {
      console.log(`User exists: ${u.email}`);
    }
    users[u.role] = profile;
  }

  // Extra customers for richer data
  const extraCustomers = [
    { email: 'priya@demo.com', fullName: 'Priya Sharma', phone: '+91 90000 00005' },
    { email: 'amit@demo.com', fullName: 'Amit Patel', phone: '+91 90000 00006' },
  ];
  for (const c of extraCustomers) {
    let profile = await Profile.findOne({ email: c.email });
    if (!profile) {
      profile = await Profile.create({
        email: c.email,
        password: await bcrypt.hash('demo1234', 10),
        full_name: c.fullName,
        role: 'CUSTOMER',
        phone: c.phone,
        status: 'ACTIVE',
      });
      console.log(`Created customer: ${c.email}`);
    }
    users[c.email] = profile;
  }

  return users;
}

async function seedCategoriesAndAssets() {
  const categoriesData = [
    { name: 'Mobile', description: 'Smartphones and mobile devices', icon: 'smartphone' },
    { name: 'Laptop', description: 'Laptops and notebooks', icon: 'laptop' },
    { name: 'TV', description: 'Televisions and displays', icon: 'tv' },
    { name: 'Home Appliance', description: 'Refrigerators, ACs, washing machines', icon: 'home' },
  ];

  const categories = {};
  for (const cat of categoriesData) {
    let c = await AssetCategory.findOne({ name: cat.name });
    if (!c) c = await AssetCategory.create(cat);
    categories[cat.name] = c;
  }

  const assetsData = [
    { category: 'Mobile', name: 'iPhone 15', brand: 'Apple', model: '128GB', price: 79900, finance_min: 50000, finance_max: 75000, interest_rate: 12, max_tenure_months: 18, image_url: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=400' },
    { category: 'Mobile', name: 'Samsung Galaxy S24', brand: 'Samsung', model: '256GB', price: 74999, finance_min: 40000, finance_max: 70000, interest_rate: 11.5, max_tenure_months: 18, image_url: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400' },
    { category: 'Laptop', name: 'MacBook Air M3', brand: 'Apple', model: '13-inch', price: 114900, finance_min: 70000, finance_max: 100000, interest_rate: 12, max_tenure_months: 24, image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400' },
    { category: 'Laptop', name: 'Dell XPS 15', brand: 'Dell', model: 'i7 16GB', price: 149999, finance_min: 80000, finance_max: 130000, interest_rate: 12.5, max_tenure_months: 24, image_url: 'https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=400' },
    { category: 'TV', name: 'Samsung 55" QLED', brand: 'Samsung', model: 'QA55Q60C', price: 64990, finance_min: 35000, finance_max: 60000, interest_rate: 11, max_tenure_months: 12, image_url: 'https://images.unsplash.com/photo-1593359673509-e6f4fd6f3e24?w=400' },
    { category: 'TV', name: 'LG 65" OLED', brand: 'LG', model: 'C3 Series', price: 139990, finance_min: 70000, finance_max: 120000, interest_rate: 12, max_tenure_months: 18, image_url: 'https://images.unsplash.com/photo-1574945019785-5fec42aa8d65?w=400' },
    { category: 'Home Appliance', name: 'LG Double Door Fridge', brand: 'LG', model: 'GL-T372', price: 42990, finance_min: 25000, finance_max: 40000, interest_rate: 10.5, max_tenure_months: 12, image_url: 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?w=400' },
    { category: 'Home Appliance', name: 'Daikin 1.5 Ton AC', brand: 'Daikin', model: 'FTKF50', price: 45990, finance_min: 30000, finance_max: 42000, interest_rate: 11, max_tenure_months: 12, image_url: 'https://images.unsplash.com/photo-1631545806609-95d7c25c7a52?w=400' },
  ];

  const assets = [];
  for (const a of assetsData) {
    let asset = await Asset.findOne({ name: a.name, brand: a.brand });
    if (!asset) {
      asset = await Asset.create({
        category_id: categories[a.category]._id,
        name: a.name,
        brand: a.brand,
        model: a.model,
        description: `${a.brand} ${a.name} - premium electronics financing available`,
        price: a.price,
        finance_min: a.finance_min,
        finance_max: a.finance_max,
        interest_rate: a.interest_rate,
        max_tenure_months: a.max_tenure_months,
        image_url: a.image_url,
        status: 'AVAILABLE',
      });
      console.log(`Created asset: ${a.name}`);
    }
    assets.push(asset);
  }

  return { categories, assets };
}

async function createApplication(data, users, assets) {
  const existing = await FinanceApplication.findOne({ application_number: data.application_number });
  if (existing) return existing;

  const asset = assets[data.assetIndex];
  const schedule = generateSchedule(data.finance_amount, data.interest_rate, data.tenure_months);
  const monthlyEmi = schedule[0]?.amount || 0;
  const totalPayable = schedule.reduce((s, e) => s + e.amount, 0);

  const app = await FinanceApplication.create({
    application_number: data.application_number,
    customer_id: data.customer._id,
    retailer_id: data.retailer?._id || null,
    asset_id: asset._id,
    asset_name: asset.name,
    asset_price: asset.price,
    finance_amount: data.finance_amount,
    down_payment: asset.price - data.finance_amount,
    interest_rate: data.interest_rate,
    tenure_months: data.tenure_months,
    monthly_emi: monthlyEmi,
    total_payable: Math.round(totalPayable * 100) / 100,
    status: data.status,
    employment_type: data.employment_type || 'Salaried',
    monthly_income: data.monthly_income || 45000,
    rejection_reason: data.rejection_reason || null,
    submitted_at: data.submitted_at || null,
    approved_at: data.approved_at || null,
    disbursed_at: data.disbursed_at || null,
  });

  // Create approval history based on status
  const history = data.approvalHistory || [];
  for (const h of history) {
    await Approval.create({
      application_id: app._id,
      approver_id: h.approver._id,
      approver_name: h.approver.full_name,
      action: h.action,
      comments: h.comments || null,
      previous_status: h.previous_status,
      new_status: h.new_status,
      created_at: h.created_at || new Date(),
    });
  }

  if (['APPROVED', 'DISBURSED'].includes(data.status)) {
    await EMISchedule.insertMany(
      schedule.map((s, idx) => ({
        ...s,
        application_id: app._id,
        status: data.status === 'DISBURSED' && idx === 0 ? 'PAID' : s.status,
        paid_at: data.status === 'DISBURSED' && idx === 0 ? new Date() : null,
      }))
    );

    if (data.status === 'DISBURSED') {
      const firstEmi = await EMISchedule.findOne({ application_id: app._id, installment_number: 1 });
      if (firstEmi) {
        await Payment.create({
          emi_id: firstEmi._id,
          application_id: app._id,
          customer_id: data.customer._id,
          amount: firstEmi.amount,
          payment_method: 'UPI',
          transaction_id: `TXN${Date.now()}`,
          status: 'SUCCESS',
        });
      }
    }
  }

  if (data.notification) {
    await Notification.create({
      user_id: data.customer._id,
      title: data.notification.title,
      message: data.notification.message,
      type: data.notification.type,
      read: data.notification.read || false,
      link: `/applications/${app._id}`,
    });
  }

  console.log(`Created application: ${data.application_number} (${data.status})`);
  return app;
}

async function seedDatabase({ force = false } = {}) {
  await connectDB();

  const appCount = await FinanceApplication.countDocuments();
  if (appCount > 0 && !force) {
    console.log('Database already has data. Skipping full seed. Use force=true to reset.');
    return { skipped: true, message: 'Database already seeded' };
  }

  if (force) {
    console.log('Force seed — clearing collections...');
    await Promise.all([
      Payment.deleteMany({}),
      EMISchedule.deleteMany({}),
      Approval.deleteMany({}),
      Document.deleteMany({}),
      Notification.deleteMany({}),
      AuditLog.deleteMany({}),
      FinanceApplication.deleteMany({}),
      Asset.deleteMany({}),
      AssetCategory.deleteMany({}),
      Counter.deleteMany({}),
    ]);
  }

  const users = await ensureUsers();
  const { assets } = await seedCategoriesAndAssets();

  const admin = users.SUPER_ADMIN;
  const manager = users.ADMIN;
  const retailer = users.RETAILER;
  const customer = users.CUSTOMER;
  const priya = users['priya@demo.com'];
  const amit = users['amit@demo.com'];

  await Counter.findByIdAndUpdate('app_number', { seq: 6 }, { upsert: true });

  const now = new Date();
  const daysAgo = (d) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

  const applications = [
    {
      application_number: 'APP-2026-000001',
      customer,
      retailer,
      assetIndex: 0,
      finance_amount: 65000,
      interest_rate: 12,
      tenure_months: 12,
      status: 'DISBURSED',
      submitted_at: daysAgo(30),
      approved_at: daysAgo(25),
      disbursed_at: daysAgo(20),
      approvalHistory: [
        { action: 'SUBMIT', approver: customer, previous_status: 'DRAFT', new_status: 'SUBMITTED', created_at: daysAgo(30) },
        { action: 'REVIEW', approver: manager, previous_status: 'SUBMITTED', new_status: 'UNDER_REVIEW', created_at: daysAgo(28) },
        { action: 'APPROVE', approver: manager, previous_status: 'UNDER_REVIEW', new_status: 'APPROVED', comments: 'KYC verified', created_at: daysAgo(25) },
        { action: 'DISBURSE', approver: manager, previous_status: 'APPROVED', new_status: 'DISBURSED', created_at: daysAgo(20) },
      ],
      notification: { title: 'Loan Disbursed', message: 'Your loan for application APP-2026-000001 has been disbursed.', type: 'SUCCESS', read: true },
    },
    {
      application_number: 'APP-2026-000002',
      customer,
      retailer,
      assetIndex: 2,
      finance_amount: 90000,
      interest_rate: 12,
      tenure_months: 18,
      status: 'UNDER_REVIEW',
      submitted_at: daysAgo(5),
      approvalHistory: [
        { action: 'SUBMIT', approver: customer, previous_status: 'DRAFT', new_status: 'SUBMITTED', created_at: daysAgo(5) },
        { action: 'REVIEW', approver: manager, previous_status: 'SUBMITTED', new_status: 'UNDER_REVIEW', created_at: daysAgo(3) },
      ],
      notification: { title: 'Application Under Review', message: 'Your application APP-2026-000002 is now under review.', type: 'INFO', read: false },
    },
    {
      application_number: 'APP-2026-000003',
      customer: priya,
      retailer,
      assetIndex: 4,
      finance_amount: 50000,
      interest_rate: 11,
      tenure_months: 12,
      status: 'SUBMITTED',
      submitted_at: daysAgo(2),
      approvalHistory: [
        { action: 'SUBMIT', approver: priya, previous_status: 'DRAFT', new_status: 'SUBMITTED', created_at: daysAgo(2) },
      ],
      notification: { title: 'Application Submitted', message: 'Your application APP-2026-000003 has been submitted.', type: 'SUCCESS', read: false },
    },
    {
      application_number: 'APP-2026-000004',
      customer: amit,
      retailer,
      assetIndex: 1,
      finance_amount: 60000,
      interest_rate: 11.5,
      tenure_months: 12,
      status: 'REJECTED',
      submitted_at: daysAgo(10),
      rejection_reason: 'Income proof insufficient for requested finance amount.',
      approvalHistory: [
        { action: 'SUBMIT', approver: amit, previous_status: 'DRAFT', new_status: 'SUBMITTED', created_at: daysAgo(10) },
        { action: 'REVIEW', approver: manager, previous_status: 'SUBMITTED', new_status: 'UNDER_REVIEW', created_at: daysAgo(8) },
        { action: 'REJECT', approver: manager, previous_status: 'UNDER_REVIEW', new_status: 'REJECTED', comments: 'Income proof insufficient', created_at: daysAgo(7) },
      ],
      notification: { title: 'Application Rejected', message: 'Your application APP-2026-000004 has been rejected.', type: 'ERROR', read: true },
    },
    {
      application_number: 'APP-2026-000005',
      customer,
      assetIndex: 6,
      finance_amount: 35000,
      interest_rate: 10.5,
      tenure_months: 12,
      status: 'DRAFT',
    },
    {
      application_number: 'APP-2026-000006',
      customer: priya,
      assetIndex: 7,
      finance_amount: 38000,
      interest_rate: 11,
      tenure_months: 12,
      status: 'APPROVED',
      submitted_at: daysAgo(15),
      approved_at: daysAgo(12),
      approvalHistory: [
        { action: 'SUBMIT', approver: priya, previous_status: 'DRAFT', new_status: 'SUBMITTED', created_at: daysAgo(15) },
        { action: 'REVIEW', approver: admin, previous_status: 'SUBMITTED', new_status: 'UNDER_REVIEW', created_at: daysAgo(14) },
        { action: 'APPROVE', approver: admin, previous_status: 'UNDER_REVIEW', new_status: 'APPROVED', comments: 'All documents verified', created_at: daysAgo(12) },
      ],
      notification: { title: 'Application Approved!', message: 'Congratulations! Application APP-2026-000006 has been approved.', type: 'SUCCESS', read: false },
    },
  ];

  const createdApps = [];
  for (const appData of applications) {
    createdApps.push(await createApplication(appData, users, assets));
  }

  // Documents
  const disbursedApp = createdApps[0];
  const docs = [
    { application_id: disbursedApp._id, customer_id: customer._id, document_type: 'KYC_AADHAAR', file_name: 'aadhaar_rajesh.pdf', file_size: 245000, mime_type: 'application/pdf', status: 'VERIFIED' },
    { application_id: disbursedApp._id, customer_id: customer._id, document_type: 'KYC_PAN', file_name: 'pan_rajesh.pdf', file_size: 180000, mime_type: 'application/pdf', status: 'VERIFIED' },
    { application_id: disbursedApp._id, customer_id: customer._id, document_type: 'INCOME_PROOF', file_name: 'salary_slip_march.pdf', file_size: 320000, mime_type: 'application/pdf', status: 'VERIFIED' },
    { application_id: createdApps[1]._id, customer_id: customer._id, document_type: 'KYC_AADHAAR', file_name: 'aadhaar_copy.pdf', file_size: 210000, mime_type: 'application/pdf', status: 'UPLOADED' },
    { application_id: createdApps[2]._id, customer_id: priya._id, document_type: 'ADDRESS_PROOF', file_name: 'utility_bill.pdf', file_size: 156000, mime_type: 'application/pdf', status: 'UPLOADED' },
  ];

  for (const d of docs) {
    const exists = await Document.findOne({ file_name: d.file_name });
    if (!exists) {
      await Document.create({
        ...d,
        object_key: `docs/${d.file_name}`,
        uploaded_by: d.customer_id,
        storage_url: null,
      });
    }
  }

  // Audit logs
  const auditEntries = [
    { user_id: manager._id, user_email: manager.email, user_role: manager.role, action: 'APPLICATION_APPROVE', entity_type: 'finance_application', entity_id: disbursedApp._id, details: { application_number: 'APP-2026-000001' } },
    { user_id: manager._id, user_email: manager.email, user_role: manager.role, action: 'APPLICATION_DISBURSE', entity_type: 'finance_application', entity_id: disbursedApp._id, details: { application_number: 'APP-2026-000001' } },
    { user_id: admin._id, user_email: admin.email, user_role: admin.role, action: 'APPLICATION_APPROVE', entity_type: 'finance_application', entity_id: createdApps[5]._id, details: { application_number: 'APP-2026-000006' } },
  ];

  for (const entry of auditEntries) {
    const exists = await AuditLog.findOne({ action: entry.action, entity_id: entry.entity_id });
    if (!exists) await AuditLog.create(entry);
  }

  // Extra notifications for admin dashboard
  await Notification.create({
    user_id: customer._id,
    title: 'EMI Reminder',
    message: 'Your next EMI of ₹5,776.37 is due soon for APP-2026-000001.',
    type: 'WARNING',
    read: false,
    link: `/applications/${disbursedApp._id}`,
  });

  console.log('\n✅ Seed completed successfully!');
  console.log('\nDemo login credentials (password: demo1234):');
  console.log('  admin@demo.com     - SUPER_ADMIN');
  console.log('  manager@demo.com   - ADMIN');
  console.log('  retailer@demo.com  - RETAILER');
  console.log('  customer@demo.com  - CUSTOMER');

  return { skipped: false, message: 'Seed completed successfully' };
}

export { seedDatabase };

const isDirectRun = process.argv[1]?.endsWith('seed.js');
if (isDirectRun) {
  seedDatabase({ force: process.argv.includes('--force') || process.env.FORCE_SEED === '1' })
    .then((result) => {
      if (result.skipped) process.exit(0);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
