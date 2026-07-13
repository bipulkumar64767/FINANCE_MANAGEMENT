import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Package, FileText, Users, Store, UserCog,
  CheckSquare, FolderOpen, Bell, ScrollText, BarChart3, User,
  LogOut, Menu, X, Building2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types';
import { roleColors } from '../lib/utils';

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'RETAILER', 'CUSTOMER'] },
  { path: '/catalog', label: 'Asset Catalog', icon: <Package className="w-5 h-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'RETAILER', 'CUSTOMER'] },
  { path: '/applications', label: 'Applications', icon: <FileText className="w-5 h-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'RETAILER', 'CUSTOMER'] },
  { path: '/approvals', label: 'Approvals', icon: <CheckSquare className="w-5 h-5" />, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { path: '/customers', label: 'Customers', icon: <Users className="w-5 h-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'RETAILER'] },
  { path: '/retailers', label: 'Retailers', icon: <Store className="w-5 h-5" />, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { path: '/users', label: 'User Management', icon: <UserCog className="w-5 h-5" />, roles: ['SUPER_ADMIN'] },
  { path: '/documents', label: 'Documents', icon: <FolderOpen className="w-5 h-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'RETAILER', 'CUSTOMER'] },
  { path: '/notifications', label: 'Notifications', icon: <Bell className="w-5 h-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'RETAILER', 'CUSTOMER'] },
  { path: '/audit', label: 'Audit Logs', icon: <ScrollText className="w-5 h-5" />, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { path: '/reports', label: 'Reports', icon: <BarChart3 className="w-5 h-5" />, roles: ['SUPER_ADMIN', 'ADMIN'] },
  { path: '/profile', label: 'Profile', icon: <User className="w-5 h-5" />, roles: ['SUPER_ADMIN', 'ADMIN', 'RETAILER', 'CUSTOMER'] },
];

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!profile) return null;

  const filteredNav = navItems.filter(item => item.roles.includes(profile.role));
  const roleColor = roleColors[profile.role];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-200">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight">AssetFinance</p>
            <p className="text-xs text-slate-500">Management System</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {filteredNav.map(item => {
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{profile.full_name}</p>
              <span className={`inline-block text-xs px-1.5 py-0.5 rounded-full font-medium ${roleColor.bg} ${roleColor.text}`}>
                {roleColor.label}
              </span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-2 w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-20">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-slate-100">
            <Menu className="w-5 h-5 text-slate-700" />
          </button>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-slate-900" />
            <span className="text-sm font-bold text-slate-900">AssetFinance</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5 text-slate-700" />
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
