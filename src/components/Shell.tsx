import React, { createContext, useCallback, useContext, useState } from 'react';
import {
  Bell,
  BookOpen,
  Bot,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileBarChart2,
  Globe2,
  LayoutDashboard,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import type { NavModuleId, ToastMessage } from '../types';

interface ToastContextValue {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} });
export const useToast = () => useContext(ToastContext);

export const NAV_ITEMS: Array<{
  id: NavModuleId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: string;
}> = [
  { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, permission: 'dashboard:read' },
  { id: 'market', label: 'Market Intelligence', icon: TrendingUp, permission: 'market:read' },
  { id: 'customers', label: 'Customer Intelligence', icon: Users, permission: 'customer:read' },
  { id: 'competitors', label: 'Competitor Intelligence', icon: Building2, permission: 'competitor:read' },
  { id: 'regional', label: 'Regional Opportunity Finder', icon: MapPin, permission: 'regional:read' },
  { id: 'campaigns', label: 'AI Campaign Studio', icon: Megaphone, permission: 'campaign:read' },
  { id: 'reports', label: 'Marketing Report Generator', icon: FileBarChart2, permission: 'report:read' },
  { id: 'knowledge', label: 'Knowledge Hub', icon: BookOpen, permission: 'knowledge:read' },
  { id: 'assistant', label: 'AI Marketing Assistant', icon: Bot, permission: 'assistant:use' },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'users', label: 'User Management', icon: ShieldCheck, permission: 'users:manage' },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Shell({
  activeModule,
  onNavigate,
  unreadNotifications,
  children,
}: {
  activeModule: NavModuleId;
  onNavigate: (id: NavModuleId) => void;
  unreadNotifications: number;
  children: React.ReactNode;
}) {
  const { profile, loading, authError, signInWithGoogle, logout, hasPermission } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F7FA] flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-lg p-8 w-full max-w-sm text-center">
          <div className="w-9 h-9 border-2 border-[#173650] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-[#173650]">Verifying PaperPulse AI session...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#F4F7FA] flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-[#173650] flex items-center justify-center text-white font-display font-bold text-lg">
              P
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#173650] leading-tight">PaperPulse AI</h1>
              <p className="text-xs text-slate-500">Paper & Packaging Marketing Intelligence</p>
            </div>
          </div>

          <h2 className="text-lg font-semibold text-[#1A2530] mb-2">
            Enterprise Intelligence Sign-In
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Turning Paper Market Intelligence into Smarter Marketing Decisions. Sign in with your
            authorized corporate Google account to access market analytics, RAG document search,
            regional opportunity scoring, and campaign planning.
          </p>

          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={signInWithGoogle}
            className="w-full py-2.5 px-4 rounded-lg bg-[#173650] hover:bg-[#1E4566] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Globe2 className="w-4 h-4" />
            <span>Sign in with Google Workspace</span>
          </button>

          <p className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
            Protected by Firebase Authentication, Cloud SQL RBAC, and enterprise audit logging.
          </p>
        </div>
      </div>
    );
  }

  const activeNav = NAV_ITEMS.find((n) => n.id === activeModule) || NAV_ITEMS[0];

  return (
    <ToastContext.Provider value={{ addToast }}>
      <div className="min-h-screen bg-[#F4F7FA] flex">
        {/* Mobile Backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Fixed Collapsible Left Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 bg-[#173650] text-white flex flex-col transition-all duration-200 ${
            collapsed ? 'w-[68px]' : 'w-[252px]'
          } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        >
          <div className="h-16 px-4 flex items-center justify-between border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-md bg-[#249B91] flex items-center justify-center font-display font-bold text-white shrink-0">
                P
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <div className="font-display font-bold text-sm tracking-tight text-white truncate">
                    PaperPulse AI
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">Market Intelligence</div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden lg:flex p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="lg:hidden p-1.5 rounded hover:bg-white/10 text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const allowed = !item.permission || hasPermission(item.permission);
              if (!allowed) return null;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileOpen(false);
                  }}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#249B91] text-white'
                      : 'text-slate-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
                  {!collapsed && item.id === 'notifications' && unreadNotifications > 0 && (
                    <span className="text-[11px] font-mono tabular-nums text-white/90">
                      {unreadNotifications}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="p-3 border-t border-white/10 shrink-0">
            {!collapsed ? (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white truncate">{profile.fullName}</div>
                  <div className="text-[11px] text-slate-300 truncate">{profile.roleName}</div>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  title="Sign out"
                  className="p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer shrink-0"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={logout}
                title="Sign out"
                className="w-full flex justify-center p-1.5 rounded hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </aside>

        {/* Main Workspace Container */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
            collapsed ? 'lg:pl-[68px]' : 'lg:pl-[252px]'
          }`}
        >
          {/* Top Navigation Header */}
          <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
                className="lg:hidden p-2 rounded-md border border-slate-200 text-slate-600 hover:text-[#173650]"
              >
                <Menu className="w-4 h-4" />
              </button>
              <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
                <button
                  type="button"
                  onClick={() => onNavigate('dashboard')}
                  className="text-slate-500 hover:text-[#173650] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  PaperPulse AI
                </button>
                <span className="text-slate-300" aria-hidden="true">/</span>
                <span className="font-semibold text-[#173650] truncate">{activeNav.label}</span>
              </nav>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden sm:inline text-xs text-slate-500 whitespace-nowrap">
                {profile.roleName} · {profile.regionScope}
              </span>
              {activeModule !== 'assistant' && hasPermission('assistant:use') && (
                <button
                  type="button"
                  onClick={() => onNavigate('assistant')}
                  className="px-3 py-1.5 rounded-md bg-[#173650] hover:bg-[#1E4566] text-white text-xs font-medium whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>Ask AI Assistant</span>
                </button>
              )}
            </div>
          </header>

          {/* Main Content Viewport */}
          <main className="flex-1 p-4 lg:p-8 max-w-[1440px] w-full mx-auto">{children}</main>
        </div>

        {/* Toast Notifications */}
        {toasts.length > 0 && (
          <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`pointer-events-auto bg-white border rounded-lg p-3.5 shadow-sm flex items-start justify-between gap-3 ${
                  t.type === 'error'
                    ? 'border-red-300'
                    : t.type === 'success'
                      ? 'border-emerald-300'
                      : 'border-slate-200'
                }`}
              >
                <div className="min-w-0">
                  <div
                    className={`text-xs font-semibold ${
                      t.type === 'error'
                        ? 'text-red-700'
                        : t.type === 'success'
                          ? 'text-emerald-700'
                          : 'text-[#173650]'
                    }`}
                  >
                    {t.title}
                  </div>
                  {t.message && <p className="text-xs text-slate-600 mt-0.5">{t.message}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
