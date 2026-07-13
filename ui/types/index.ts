export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'RETAILER' | 'CUSTOMER';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type ApplicationStatus =
  | 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'DISBURSED' | 'CLOSED';
export type ApprovalAction = 'SUBMIT' | 'REVIEW' | 'APPROVE' | 'REJECT' | 'DISBURSE';
export type EMIStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type PaymentStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'REFUNDED';
export type PaymentMethod = 'UPI' | 'BANK_TRANSFER' | 'CASH' | 'CARD' | 'CHEQUE';
export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
export type DocumentType =
  | 'KYC_AADHAAR' | 'KYC_PAN' | 'INCOME_PROOF' | 'ADDRESS_PROOF' | 'PHOTO' | 'BANK_STATEMENT' | 'OTHER';
export type DocumentStatus = 'UPLOADED' | 'VERIFIED' | 'REJECTED';
export type AssetStatus = 'AVAILABLE' | 'DISCONTINUED';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  status: UserStatus;
  retailer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  created_at: string;
}

export interface Asset {
  id: string;
  category_id: string | null;
  name: string;
  brand: string;
  model: string | null;
  description: string | null;
  price: number;
  finance_min: number;
  finance_max: number;
  interest_rate: number;
  max_tenure_months: number;
  image_url: string | null;
  status: AssetStatus;
  created_at: string;
  updated_at: string;
  category?: AssetCategory;
}

export interface FinanceApplication {
  id: string;
  application_number: string;
  customer_id: string;
  retailer_id: string | null;
  asset_id: string | null;
  asset_name: string | null;
  asset_price: number;
  finance_amount: number;
  down_payment: number;
  interest_rate: number;
  tenure_months: number;
  monthly_emi: number;
  total_payable: number;
  status: ApplicationStatus;
  employment_type: string | null;
  monthly_income: number | null;
  rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  disbursed_at: string | null;
  created_at: string;
  updated_at: string;
  customer?: Profile;
  retailer?: Profile;
  asset?: Asset;
}

export interface Approval {
  id: string;
  application_id: string;
  approver_id: string | null;
  approver_name: string | null;
  action: ApprovalAction;
  comments: string | null;
  previous_status: string | null;
  new_status: string | null;
  created_at: string;
}

export interface Guarantor {
  id: string;
  application_id: string;
  full_name: string;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  aadhaar_number: string | null;
  monthly_income: number | null;
  created_at: string;
}

export interface Document {
  id: string;
  application_id: string | null;
  customer_id: string | null;
  document_type: DocumentType;
  file_name: string;
  file_size: number;
  mime_type: string;
  object_key: string;
  bucket_name: string;
  storage_url: string | null;
  checksum: string | null;
  uploaded_by: string | null;
  status: DocumentStatus;
  created_at: string;
}

export interface EMISchedule {
  id: string;
  application_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  principal: number;
  interest: number;
  balance: number;
  status: EMIStatus;
  paid_at: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  emi_id: string;
  application_id: string;
  customer_id: string | null;
  amount: number;
  payment_method: PaymentMethod;
  transaction_id: string | null;
  status: PaymentStatus;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  link: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_role: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface DashboardStats {
  totalApplications?: number;
  pendingApprovals?: number;
  totalCustomers?: number;
  totalRetailers?: number;
  totalAssets?: number;
  totalDisbursed?: number;
  totalReceivable?: number;
  approvedApplications?: number;
  totalFinanceAmount?: number;
  activeLoans?: number;
  pendingApplications?: number;
  totalBorrowed?: number;
  monthlyEMI?: number;
  nextEMIDue?: { amount: number; dueDate: string } | null;
  applicationsByStatus?: Record<string, number>;
}

export interface EMIResult {
  emi: number;
  totalPayable: number;
  totalInterest: number;
  principal: number;
  schedule: Array<{
    installmentNumber: number;
    dueDate: string;
    amount: number;
    principal: number;
    interest: number;
    balance: number;
  }>;
}
