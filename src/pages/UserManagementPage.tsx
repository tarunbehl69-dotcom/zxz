import { useEffect, useState } from 'react';
import { useToast } from '../components/Shell';
import { apiRequest } from '../lib/api';
import type { RoleItem } from '../types';

interface ManagedUser {
  id: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName: string;
  department: string;
  regionScope: string;
  isActive: boolean;
  lastLoginAt: string;
}

interface AuditLogEntry {
  id: string;
  userEmail: string;
  action: string;
  entityType: string;
  createdAt: string;
  details: Record<string, unknown>;
}

export function UserManagementPage() {
  const { addToast } = useToast();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userRes, logRes] = await Promise.all([
        apiRequest<{ users: ManagedUser[]; roles: RoleItem[] }>('/api/users'),
        apiRequest<{ logs: AuditLogEntry[] }>('/api/audit-logs'),
      ]);
      setUsers(userRes.users);
      setRoles(userRes.roles);
      setLogs(logRes.logs);
    } catch (err) {
      addToast({ type: 'error', title: 'Access Error', message: err instanceof Error ? err.message : '' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateUser = async (id: string, patch: { roleId?: string; isActive?: boolean; regionScope?: string }) => {
    try {
      await apiRequest(`/api/users/${id}`, { method: 'PATCH', body: patch });
      addToast({ type: 'success', title: 'User Permissions Updated' });
      await loadData();
    } catch (err) {
      addToast({ type: 'error', title: 'Update Failed', message: err instanceof Error ? err.message : '' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#173650]">User Management & RBAC Governance</h1>
        <p className="text-sm text-slate-600">
          Assign corporate marketing roles, regional scopes, account status, and review security audit logs.
        </p>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-5 overflow-x-auto">
        <h2 className="text-base font-semibold text-[#173650] mb-4">Authorized Users ({users.length})</h2>
        {loading ? (
          <div className="h-32 animate-pulse bg-slate-50 rounded" />
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-3 font-medium">User</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                <th className="py-2 pr-3 font-medium">Region Scope</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 text-right font-medium">Last Login</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-3 pr-3">
                    <div className="font-semibold text-[#173650]">{u.fullName}</div>
                    <div className="text-[11px] text-slate-500">{u.email}</div>
                  </td>
                  <td className="py-3 pr-3">
                    <select
                      value={u.roleId}
                      onChange={(e) => updateUser(u.id, { roleId: e.target.value })}
                      className="px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-white"
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 pr-3">
                    <select
                      value={u.regionScope}
                      onChange={(e) => updateUser(u.id, { regionScope: e.target.value })}
                      className="px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-white"
                    >
                      <option>All India</option>
                      <option>West</option>
                      <option>North</option>
                      <option>South</option>
                      <option>East</option>
                    </select>
                  </td>
                  <td className="py-3 pr-3">
                    <button
                      type="button"
                      onClick={() => updateUser(u.id, { isActive: !u.isActive })}
                      className={`px-2.5 py-1 rounded border text-xs font-medium cursor-pointer ${
                        u.isActive
                          ? 'border-emerald-300 text-emerald-700 bg-emerald-50/50'
                          : 'border-red-300 text-red-700 bg-red-50/50'
                      }`}
                    >
                      {u.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="py-3 text-right font-mono text-[11px] text-slate-500">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-white border border-slate-200 rounded-lg p-5 overflow-x-auto">
        <h2 className="text-base font-semibold text-[#173650] mb-3">Enterprise Audit Log</h2>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 pr-3 font-medium">Timestamp</th>
              <th className="py-2 pr-3 font-medium">Actor</th>
              <th className="py-2 pr-3 font-medium">Action</th>
              <th className="py-2 font-medium">Entity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="py-2 pr-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                  {new Date(l.createdAt).toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-[#173650]">{l.userEmail}</td>
                <td className="py-2 pr-3 font-mono font-medium text-[#249B91]">{l.action}</td>
                <td className="py-2 text-slate-600">{l.entityType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
