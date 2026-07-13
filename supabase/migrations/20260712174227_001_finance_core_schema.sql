/*
# Electronic Asset Finance Management System - Core Schema (fix)

## Overview
Creates the complete database schema for an Electronic Asset Finance Management System
with role-based access control (Super Admin, Admin, Retailer, Customer).

## New Tables
1. profiles - Extended user info linked to auth.users, stores role and organization
2. asset_categories - Catalog categories (e.g., Mobile, Laptop, TV)
3. assets - Individual asset models with pricing and finance limits
4. finance_applications - Customer loan applications for assets
5. approvals - Approval workflow records for applications
6. guarantors - Guarantor records tied to applications
7. documents - Metadata for uploaded documents (KYC, income proof, etc.)
8. emi_schedules - Generated EMI installment schedules per application
9. payments - Payment records against EMI installments
10. notifications - User notification messages
11. audit_logs - Audit trail of user actions

## Security
- RLS enabled on all tables
- Owner-scoped policies where applicable
- All policies scoped to authenticated users
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'CUSTOMER' CHECK (role IN ('SUPER_ADMIN','ADMIN','RETAILER','CUSTOMER')),
  phone text,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED')),
  retailer_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN','RETAILER')));

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============ ASSET CATEGORIES ============
CREATE TABLE IF NOT EXISTS asset_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  icon text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE asset_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_all" ON asset_categories;
CREATE POLICY "categories_select_all" ON asset_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "categories_modify_staff" ON asset_categories;
CREATE POLICY "categories_modify_staff" ON asset_categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN')));

-- ============ ASSETS ============
CREATE TABLE IF NOT EXISTS assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES asset_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  brand text NOT NULL,
  model text,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  finance_min numeric(12,2) NOT NULL DEFAULT 0,
  finance_max numeric(12,2) NOT NULL DEFAULT 0,
  interest_rate numeric(5,2) NOT NULL DEFAULT 12.0,
  max_tenure_months int NOT NULL DEFAULT 24,
  image_url text,
  status text NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','DISCONTINUED')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets_select_all" ON assets;
CREATE POLICY "assets_select_all" ON assets FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "assets_modify_staff" ON assets;
CREATE POLICY "assets_modify_staff" ON assets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN','RETAILER')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN','RETAILER')));

-- ============ FINANCE APPLICATIONS ============
CREATE TABLE IF NOT EXISTS finance_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number text UNIQUE NOT NULL,
  customer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  retailer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  asset_id uuid REFERENCES assets(id) ON DELETE SET NULL,
  asset_name text,
  asset_price numeric(12,2) NOT NULL DEFAULT 0,
  finance_amount numeric(12,2) NOT NULL DEFAULT 0,
  down_payment numeric(12,2) NOT NULL DEFAULT 0,
  interest_rate numeric(5,2) NOT NULL DEFAULT 12.0,
  tenure_months int NOT NULL DEFAULT 12,
  monthly_emi numeric(12,2) NOT NULL DEFAULT 0,
  total_payable numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','DISBURSED','CLOSED')),
  employment_type text,
  monthly_income numeric(12,2),
  rejection_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  disbursed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE finance_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "apps_select_own_or_staff" ON finance_applications;
CREATE POLICY "apps_select_own_or_staff" ON finance_applications FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid() OR
    retailer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN'))
  );

DROP POLICY IF EXISTS "apps_insert_own" ON finance_applications;
CREATE POLICY "apps_insert_own" ON finance_applications FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN','RETAILER'))
  );

DROP POLICY IF EXISTS "apps_update_own_or_staff" ON finance_applications;
CREATE POLICY "apps_update_own_or_staff" ON finance_applications FOR UPDATE TO authenticated
  USING (
    customer_id = auth.uid() OR
    retailer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN'))
  )
  WITH CHECK (
    customer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN','RETAILER'))
  );

-- ============ GUARANTORS ============
CREATE TABLE IF NOT EXISTS guarantors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES finance_applications(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text,
  phone text,
  email text,
  aadhaar_number text,
  monthly_income numeric(12,2),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE guarantors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guarantors_select_via_app" ON guarantors;
CREATE POLICY "guarantors_select_via_app" ON guarantors FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM finance_applications fa WHERE fa.id = guarantors.application_id AND (fa.customer_id = auth.uid() OR fa.retailer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN'))))
  );

DROP POLICY IF EXISTS "guarantors_modify_via_app" ON guarantors;
CREATE POLICY "guarantors_modify_via_app" ON guarantors FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM finance_applications fa WHERE fa.id = guarantors.application_id AND (fa.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN','RETAILER'))))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM finance_applications fa WHERE fa.id = guarantors.application_id AND (fa.customer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN','RETAILER'))))
  );

-- ============ APPROVALS ============
CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES finance_applications(id) ON DELETE CASCADE,
  approver_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approver_name text,
  action text NOT NULL CHECK (action IN ('SUBMIT','REVIEW','APPROVE','REJECT','DISBURSE')),
  comments text,
  previous_status text,
  new_status text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "approvals_select_via_app" ON approvals;
CREATE POLICY "approvals_select_via_app" ON approvals FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM finance_applications fa WHERE fa.id = approvals.application_id AND (fa.customer_id = auth.uid() OR fa.retailer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN'))))
  );

DROP POLICY IF EXISTS "approvals_insert_staff" ON approvals;
CREATE POLICY "approvals_insert_staff" ON approvals FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid()) AND
    EXISTS (SELECT 1 FROM finance_applications fa WHERE fa.id = approvals.application_id AND (fa.customer_id = auth.uid() OR fa.retailer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN'))))
  );

-- ============ DOCUMENTS ============
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES finance_applications(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('KYC_AADHAAR','KYC_PAN','INCOME_PROOF','ADDRESS_PROOF','PHOTO','BANK_STATEMENT','OTHER')),
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  mime_type text NOT NULL,
  object_key text NOT NULL,
  bucket_name text NOT NULL DEFAULT 'demo-finance-docs',
  storage_url text,
  checksum text,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'UPLOADED' CHECK (status IN ('UPLOADED','VERIFIED','REJECTED')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "docs_select_own_or_staff" ON documents;
CREATE POLICY "docs_select_own_or_staff" ON documents FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM finance_applications fa WHERE fa.id = documents.application_id AND (fa.retailer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN'))))
  );

DROP POLICY IF EXISTS "docs_insert_own" ON documents;
CREATE POLICY "docs_insert_own" ON documents FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN','RETAILER'))
  );

DROP POLICY IF EXISTS "docs_update_staff" ON documents;
CREATE POLICY "docs_update_staff" ON documents FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN')));

-- ============ EMI SCHEDULES ============
CREATE TABLE IF NOT EXISTS emi_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES finance_applications(id) ON DELETE CASCADE,
  installment_number int NOT NULL,
  due_date date NOT NULL,
  amount numeric(12,2) NOT NULL,
  principal numeric(12,2) NOT NULL,
  interest numeric(12,2) NOT NULL,
  balance numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','OVERDUE','CANCELLED')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE emi_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emi_select_via_app" ON emi_schedules;
CREATE POLICY "emi_select_via_app" ON emi_schedules FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM finance_applications fa WHERE fa.id = emi_schedules.application_id AND (fa.customer_id = auth.uid() OR fa.retailer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN'))))
  );

DROP POLICY IF EXISTS "emi_update_staff" ON emi_schedules;
CREATE POLICY "emi_update_staff" ON emi_schedules FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN')));

-- ============ PAYMENTS ============
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emi_id uuid NOT NULL REFERENCES emi_schedules(id) ON DELETE CASCADE,
  application_id uuid NOT NULL REFERENCES finance_applications(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'UPI' CHECK (payment_method IN ('UPI','BANK_TRANSFER','CASH','CARD','CHEQUE')),
  transaction_id text,
  status text NOT NULL DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS','FAILED','PENDING','REFUNDED')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_via_app" ON payments;
CREATE POLICY "payments_select_via_app" ON payments FOR SELECT TO authenticated
  USING (
    customer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM finance_applications fa WHERE fa.id = payments.application_id AND (fa.retailer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN'))))
  );

DROP POLICY IF EXISTS "payments_insert_own_or_staff" ON payments;
CREATE POLICY "payments_insert_own_or_staff" ON payments FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN','RETAILER'))
  );

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'INFO' CHECK (type IN ('INFO','SUCCESS','WARNING','ERROR')),
  read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_insert_own_or_staff" ON notifications;
CREATE POLICY "notifications_insert_own_or_staff" ON notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN','RETAILER')));

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============ AUDIT LOGS ============
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  user_email text,
  user_role text,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_staff" ON audit_logs;
CREATE POLICY "audit_select_staff" ON audit_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('SUPER_ADMIN','ADMIN')));

DROP POLICY IF EXISTS "audit_insert_any" ON audit_logs;
CREATE POLICY "audit_insert_any" ON audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category_id);
CREATE INDEX IF NOT EXISTS idx_apps_customer ON finance_applications(customer_id);
CREATE INDEX IF NOT EXISTS idx_apps_status ON finance_applications(status);
CREATE INDEX IF NOT EXISTS idx_guarantors_app ON guarantors(application_id);
CREATE INDEX IF NOT EXISTS idx_approvals_app ON approvals(application_id);
CREATE INDEX IF NOT EXISTS idx_docs_app ON documents(application_id);
CREATE INDEX IF NOT EXISTS idx_emi_app ON emi_schedules(application_id);
CREATE INDEX IF NOT EXISTS idx_payments_emi ON payments(emi_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);

-- ============ UPDATED_AT TRIGGER ============
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated ON profiles;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS assets_updated ON assets;
CREATE TRIGGER assets_updated BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS apps_updated ON finance_applications;
CREATE TRIGGER apps_updated BEFORE UPDATE ON finance_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at();
