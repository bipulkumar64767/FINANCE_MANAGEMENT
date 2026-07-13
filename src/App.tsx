import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@ui/context/AuthContext';
import { AppLayout } from '@ui/components/AppLayout';
import { Spinner } from '@ui/components/ui';
import type { ReactNode } from 'react';

import LoginPage from '@ui/pages/auth/LoginPage';
import RegisterPage from '@ui/pages/auth/RegisterPage';

import DashboardPage from '@ui/pages/dashboard/DashboardPage';
import CatalogPage from '@ui/pages/catalog/CatalogPage';
import AssetDetailPage from '@ui/pages/catalog/AssetDetailPage';
import ApplicationsPage from '@ui/pages/applications/ApplicationsPage';
import ApplicationDetailPage from '@ui/pages/applications/ApplicationDetailPage';
import NewApplicationPage from '@ui/pages/applications/NewApplicationPage';
import ApprovalsPage from '@ui/pages/approvals/ApprovalsPage';
import CustomersPage from '@ui/pages/customers/CustomersPage';
import RetailersPage from '@ui/pages/retailers/RetailersPage';
import OnboardRetailerPage from '@ui/pages/retailers/OnboardRetailerPage';
import UsersPage from '@ui/pages/users/UsersPage';
import DocumentsPage from '@ui/pages/documents/DocumentsPage';
import NotificationsPage from '@ui/pages/notifications/NotificationsPage';
import AuditLogsPage from '@ui/pages/audit/AuditLogsPage';
import ReportsPage from '@ui/pages/reports/ReportsPage';
import ProfilePage from '@ui/pages/profile/ProfilePage';

function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!session || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <AppLayout>{children}</AppLayout>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }
  if (session) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'RETAILER']}><RegisterPage /></ProtectedRoute>} />

      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/catalog" element={<ProtectedRoute><CatalogPage /></ProtectedRoute>} />
      <Route path="/catalog/:id" element={<ProtectedRoute><AssetDetailPage /></ProtectedRoute>} />
      <Route path="/applications" element={<ProtectedRoute><ApplicationsPage /></ProtectedRoute>} />
      <Route path="/applications/new" element={<ProtectedRoute><NewApplicationPage /></ProtectedRoute>} />
      <Route path="/applications/:id" element={<ProtectedRoute><ApplicationDetailPage /></ProtectedRoute>} />
      <Route path="/approvals" element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}><ApprovalsPage /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN', 'RETAILER']}><CustomersPage /></ProtectedRoute>} />
      <Route path="/retailers" element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}><RetailersPage /></ProtectedRoute>} />
      <Route path="/retailers/onboard" element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}><OnboardRetailerPage /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute roles={['SUPER_ADMIN']}><UsersPage /></ProtectedRoute>} />
      <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
      <Route path="/audit" element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}><AuditLogsPage /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute roles={['SUPER_ADMIN', 'ADMIN']}><ReportsPage /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
