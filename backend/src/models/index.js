import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    full_name: { type: String, required: true },
    role: {
      type: String,
      enum: ['SUPER_ADMIN', 'ADMIN', 'RETAILER', 'CUSTOMER'],
      default: 'CUSTOMER',
    },
    phone: { type: String, default: null },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
    },
    retailer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const assetCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: null },
    icon: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const assetSchema = new mongoose.Schema(
  {
    // owner retailer for the asset (if any)
    retailer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'AssetCategory', default: null },
    name: { type: String, required: true },
    brand: { type: String, required: true },
    model: { type: String, default: null },
    description: { type: String, default: null },
    price: { type: Number, default: 0 },
    finance_min: { type: Number, default: 0 },
    finance_max: { type: Number, default: 0 },
    interest_rate: { type: Number, default: 12 },
    max_tenure_months: { type: Number, default: 24 },
    image_url: { type: String, default: null },
    status: { type: String, enum: ['AVAILABLE', 'DISCONTINUED'], default: 'AVAILABLE' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const financeApplicationSchema = new mongoose.Schema(
  {
    application_number: { type: String, required: true, unique: true },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
    retailer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    asset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Asset', default: null },
    asset_name: { type: String, default: null },
    asset_price: { type: Number, default: 0 },
    finance_amount: { type: Number, default: 0 },
    down_payment: { type: Number, default: 0 },
    interest_rate: { type: Number, default: 12 },
    tenure_months: { type: Number, default: 12 },
    monthly_emi: { type: Number, default: 0 },
    total_payable: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSED', 'CLOSED'],
      default: 'DRAFT',
    },
    employment_type: { type: String, default: null },
    monthly_income: { type: Number, default: null },
    rejection_reason: { type: String, default: null },
    submitted_at: { type: Date, default: null },
    approved_at: { type: Date, default: null },
    disbursed_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const approvalSchema = new mongoose.Schema(
  {
    application_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FinanceApplication', required: true },
    approver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    approver_name: { type: String, default: null },
    action: {
      type: String,
      enum: ['SUBMIT', 'REVIEW', 'APPROVE', 'REJECT', 'DISBURSE'],
      required: true,
    },
    comments: { type: String, default: null },
    previous_status: { type: String, default: null },
    new_status: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const guarantorSchema = new mongoose.Schema(
  {
    application_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FinanceApplication', required: true },
    full_name: { type: String, required: true },
    relationship: { type: String, default: null },
    phone: { type: String, default: null },
    email: { type: String, default: null },
    aadhaar_number: { type: String, default: null },
    monthly_income: { type: Number, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const documentSchema = new mongoose.Schema(
  {
    application_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FinanceApplication', default: null },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    document_type: {
      type: String,
      enum: ['KYC_AADHAAR', 'KYC_PAN', 'INCOME_PROOF', 'ADDRESS_PROOF', 'PHOTO', 'BANK_STATEMENT', 'OTHER'],
      required: true,
    },
    file_name: { type: String, required: true },
    file_size: { type: Number, default: 0 },
    mime_type: { type: String, required: true },
    object_key: { type: String, required: true },
    bucket_name: { type: String, default: 'demo-finance-docs' },
    storage_url: { type: String, default: null },
    checksum: { type: String, default: null },
    uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    status: { type: String, enum: ['UPLOADED', 'VERIFIED', 'REJECTED'], default: 'UPLOADED' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const emiScheduleSchema = new mongoose.Schema(
  {
    application_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FinanceApplication', required: true },
    installment_number: { type: Number, required: true },
    due_date: { type: String, required: true },
    amount: { type: Number, required: true },
    principal: { type: Number, required: true },
    interest: { type: Number, required: true },
    balance: { type: Number, required: true },
    status: { type: String, enum: ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'], default: 'PENDING' },
    paid_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const paymentSchema = new mongoose.Schema(
  {
    emi_id: { type: mongoose.Schema.Types.ObjectId, ref: 'EMISchedule', required: true },
    application_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FinanceApplication', required: true },
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    amount: { type: Number, required: true },
    payment_method: {
      type: String,
      enum: ['UPI', 'BANK_TRANSFER', 'CASH', 'CARD', 'CHEQUE'],
      default: 'UPI',
    },
    transaction_id: { type: String, default: null },
    status: { type: String, enum: ['SUCCESS', 'FAILED', 'PENDING', 'REFUNDED'], default: 'SUCCESS' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const notificationSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['INFO', 'SUCCESS', 'WARNING', 'ERROR'], default: 'INFO' },
    read: { type: Boolean, default: false },
    link: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const auditLogSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    user_email: { type: String, default: null },
    user_role: { type: String, default: null },
    action: { type: String, required: true },
    entity_type: { type: String, default: null },
    entity_id: { type: mongoose.Schema.Types.ObjectId, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
    ip_address: { type: String, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const deleteRequestSchema = new mongoose.Schema(
  {
    requester_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
    target_profile_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
    retailer_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    message: { type: String, default: null },
    status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
    resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', default: null },
    resolved_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

export const Profile = mongoose.model('Profile', profileSchema);
export const AssetCategory = mongoose.model('AssetCategory', assetCategorySchema);
export const Asset = mongoose.model('Asset', assetSchema);
export const FinanceApplication = mongoose.model('FinanceApplication', financeApplicationSchema);
export const Approval = mongoose.model('Approval', approvalSchema);
export const Guarantor = mongoose.model('Guarantor', guarantorSchema);
export const Document = mongoose.model('Document', documentSchema);
export const EMISchedule = mongoose.model('EMISchedule', emiScheduleSchema);
export const Payment = mongoose.model('Payment', paymentSchema);
export const Notification = mongoose.model('Notification', notificationSchema);
export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export const Counter = mongoose.model('Counter', counterSchema);
export const DeleteRequest = mongoose.model('DeleteRequest', deleteRequestSchema);

export async function generateApplicationNumber() {
  const year = new Date().getFullYear();
  const counter = await Counter.findByIdAndUpdate(
    'app_number',
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `APP-${year}-${String(counter.seq).padStart(6, '0')}`;
}
