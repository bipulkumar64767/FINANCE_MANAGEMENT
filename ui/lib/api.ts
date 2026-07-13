import type { Profile, UserRole } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'eafms_token';

export interface AuthSession {
  access_token: string;
  user: { id: string; email: string };
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getStoredSession(): AuthSession | null {
  const token = getToken();
  const userJson = localStorage.getItem('eafms_user');
  if (!token || !userJson) return null;
  try {
    return { access_token: token, user: JSON.parse(userJson) };
  } catch {
    return null;
  }
}

export function setStoredSession(session: AuthSession | null) {
  if (session) {
    setToken(session.access_token);
    localStorage.setItem('eafms_user', JSON.stringify(session.user));
  } else {
    setToken(null);
    localStorage.removeItem('eafms_user');
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `Request failed (${response.status})`;
    try {
      const json = JSON.parse(text);
      message = json.error || message;
    } catch {
      /* use default */
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

// ----- Auth -----
export async function login(email: string, password: string) {
  const data = await request<{
    access_token: string;
    user: { id: string; email: string };
    profile: import('../types').Profile;
  }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }, false);
  setStoredSession({ access_token: data.access_token, user: data.user });
  return data;
}

export async function register(
  email: string,
  password: string,
  fullName: string,
  phone: string,
  role: UserRole
) {
  const data = await request<{
    access_token: string;
    user: { id: string; email: string };
    profile: Profile;
  }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, fullName, phone, role }),
  }, false);
  setStoredSession({ access_token: data.access_token, user: data.user });
  return data;
}

export async function createProfile(
  email: string,
  password: string | undefined,
  fullName: string,
  phone: string | undefined,
  role: UserRole,
  retailerId?: string
) {
  return request<Profile>('/profiles', {
    method: 'POST',
    body: JSON.stringify({ email, password, fullName, phone, role, retailer_id: retailerId }),
  });
}

export async function getMe() {
  return request<{ profile: import('../types').Profile }>('/auth/me');
}

export async function updatePassword(newPassword: string) {
  return request('/auth/password', {
    method: 'PUT',
    body: JSON.stringify({ newPassword }),
  });
}

export function logout() {
  setStoredSession(null);
}

// ----- Edge function equivalents -----
export async function getDashboardStats() {
  return request<{ success: boolean; role: string; stats: import('../types').DashboardStats }>(
    '/dashboard-stats'
  );
}

export async function calculateEmi(principal: number, annualRate: number, tenureMonths: number) {
  return request<import('../types').EMIResult>('/calculate-emi', {
    method: 'POST',
    body: JSON.stringify({ principal, annualRate, tenureMonths }),
  });
}

export async function manageApplication(body: {
  action: string;
  applicationId: string;
  comments?: string;
  rejectionReason?: string;
}) {
  return request<{ success: boolean; newStatus: string }>('/manage-application', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function seedDemoUsers() {
  return request('/seed-demo-users', { method: 'POST' }, false);
}

// ----- Profiles -----
export async function getProfiles(params?: { role?: string; search?: string }) {
  const qs = new URLSearchParams();
  if (params?.role) qs.set('role', params.role);
  if (params?.search) qs.set('search', params.search);
  const q = qs.toString();
  return request<import('../types').Profile[]>(`/profiles${q ? `?${q}` : ''}`);
}

export async function getProfileCount() {
  const data = await request<{ count: number }>('/profiles?count=true');
  return data.count;
}

export async function updateProfile(id: string, updates: Partial<import('../types').Profile>) {
  return request<import('../types').Profile>(`/profiles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

// ----- Assets -----
export async function getAssetCategories() {
  return request<import('../types').AssetCategory[]>('/asset-categories');
}

export async function getAssets(status?: string) {
  const q = status ? `?status=${status}` : '';
  return request<import('../types').Asset[]>(`/assets${q}`);
}

export async function getAsset(id: string) {
  return request<import('../types').Asset>(`/assets/${id}`);
}

export async function createAsset(data: Record<string, unknown>) {
  return request<import('../types').Asset>('/assets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ----- Applications -----
export async function getApplications(params?: {
  status?: string;
  statuses?: string[];
  limit?: number;
  customer_id?: string;
  retailer_id?: string;
  application_ids?: string[];
}) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.statuses) qs.set('statuses', params.statuses.join(','));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.customer_id) qs.set('customer_id', params.customer_id);
  if (params?.retailer_id) qs.set('retailer_id', params.retailer_id);
  if (params?.application_ids) qs.set('application_ids', params.application_ids.join(','));
  const q = qs.toString();
  return request<import('../types').FinanceApplication[]>(`/applications${q ? `?${q}` : ''}`);
}

export async function getApplicationCount() {
  const apps = await getApplications();
  return apps.length;
}

export async function getApplication(id: string) {
  return request<import('../types').FinanceApplication>(`/applications/${id}`);
}

export async function createApplication(data: Record<string, unknown>) {
  return request<import('../types').FinanceApplication>('/applications', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function generateApplicationNumber() {
  return request<string>('/generate-application-number');
}

export async function getEmiSchedule(applicationId: string) {
  return request<import('../types').EMISchedule[]>(`/applications/${applicationId}/emi-schedule`);
}

export async function getApprovals(applicationId: string) {
  return request<import('../types').Approval[]>(`/applications/${applicationId}/approvals`);
}

export async function getApplicationDocuments(applicationId: string) {
  return request<import('../types').Document[]>(`/applications/${applicationId}/documents`);
}

// ----- Documents -----
export async function getDocuments(params?: { customer_id?: string; retailer_id?: string }) {
  const qs = new URLSearchParams();
  if (params?.customer_id) qs.set('customer_id', params.customer_id);
  if (params?.retailer_id) qs.set('retailer_id', params.retailer_id);
  const q = qs.toString();
  return request<(import('../types').Document & { application?: { application_number: string } })[]>(
    `/documents${q ? `?${q}` : ''}`
  );
}

export async function uploadDocument(data: Record<string, unknown>) {
  return request<import('../types').Document>('/documents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDocumentStatus(id: string, status: string) {
  return request(`/documents/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

// ----- Notifications -----
export async function getNotifications() {
  return request<import('../types').Notification[]>('/notifications');
}

export async function markNotificationRead(id: string) {
  return request('/notifications/mark-read', {
    method: 'PUT',
    body: JSON.stringify({ id }),
  });
}

export async function markAllNotificationsRead() {
  return request('/notifications/mark-read', {
    method: 'PUT',
    body: JSON.stringify({ all: true }),
  });
}

// ----- Audit & Reports -----
export async function getAuditLogs() {
  return request<import('../types').AuditLog[]>('/audit-logs');
}

export async function getPayments() {
  return request<import('../types').Payment[]>('/payments');
}

export async function getEmiSchedules() {
  return request<import('../types').EMISchedule[]>('/emi-schedules');
}

// Legacy alias for pages that used callEdgeFunction
export async function callEdgeFunction<T>(
  name: string,
  body?: unknown,
  method: 'POST' | 'GET' = 'POST'
): Promise<T> {
  if (name === 'dashboard-stats') {
    const data = await getDashboardStats();
    return data as T;
  }
  if (name === 'calculate-emi' && body) {
    const b = body as { principal: number; annualRate: number; tenureMonths: number };
    return calculateEmi(b.principal, b.annualRate, b.tenureMonths) as Promise<T>;
  }
  if (name === 'manage-application' && body) {
    return manageApplication(body as Parameters<typeof manageApplication>[0]) as Promise<T>;
  }
  if (name === 'seed-demo-users') {
    return seedDemoUsers() as Promise<T>;
  }
  throw new Error(`Unknown function: ${name}`);
}
