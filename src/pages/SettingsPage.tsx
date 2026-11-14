import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useToast } from '../components/Shell';
import { apiRequest } from '../lib/api';
import { useAuth } from '../lib/auth-context';

export function SettingsPage() {
  const { profile, hasPermission } = useAuth();
  const { addToast } = useToast();
  const [industries, setIndustries] = useState<string[]>([]);
  const [newIndustry, setNewIndustry] = useState('');
  const [productCategories, setProductCategories] = useState<Array<{ id: string; name: string; code: string; description: string }>>([]);

  const load = async () => {
    try {
      const tax = await apiRequest<{
        industries: string[];
        productCategories: Array<{ id: string; name: string; code: string; description: string }>;
      }>('/api/market/taxonomy');
      setIndustries(tax.industries);
      setProductCategories(tax.productCategories);
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to load settings', message: err instanceof Error ? err.message : '' });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addIndustry = async () => {
    if (!newIndustry.trim()) return;
    const updated = Array.from(new Set([...industries, newIndustry.trim()]));
    try {
      await apiRequest('/api/settings/industry_categories', {
        method: 'PUT',
        body: { items: updated },
      });
      setIndustries(updated);
      setNewIndustry('');
      addToast({ type: 'success', title: 'Industry Segment Added' });
    } catch (err) {
      addToast({ type: 'error', title: 'Update Failed', message: err instanceof Error ? err.message : '' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#173650]">Platform Settings & Taxonomy</h1>
        <p className="text-sm text-slate-600">
          Review your account profile, RBAC permissions, and administrator-configurable paper & industry taxonomies.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <h2 className="text-base font-semibold text-[#173650]">Account & Role Summary</h2>
          <div className="text-xs space-y-2 text-slate-700">
            <div><span className="text-slate-500">Name:</span> <span className="font-medium text-[#173650]">{profile?.fullName}</span></div>
            <div><span className="text-slate-500">Email:</span> <span className="font-mono">{profile?.email}</span></div>
            <div><span className="text-slate-500">Assigned Role:</span> <span className="font-semibold text-[#249B91]">{profile?.roleName}</span></div>
            <div><span className="text-slate-500">Region Scope:</span> {profile?.regionScope}</div>
            <div>
              <span className="text-slate-500 block mb-1">Active Permissions:</span>
              <div className="text-[11px] font-mono text-slate-600 leading-relaxed">
                {profile?.roleName === 'Administrator' ? 'Full Administrative Access (*)' : profile?.permissions.join(' · ')}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
          <h2 className="text-base font-semibold text-[#173650]">Customer Industry Segments</h2>
          <ul className="divide-y divide-slate-100 text-xs">
            {industries.map((ind) => (
              <li key={ind} className="py-2 text-slate-700">{ind}</li>
            ))}
          </ul>
          {hasPermission('settings:manage') && (
            <div className="flex gap-2 pt-2">
              <input
                value={newIndustry}
                onChange={(e) => setNewIndustry(e.target.value)}
                placeholder="Add industry segment..."
                className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-md"
              />
              <button
                type="button"
                onClick={addIndustry}
                className="px-3 py-1.5 rounded-md bg-[#173650] text-white text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          )}
        </section>
      </div>

      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold text-[#173650]">Configured Product Categories</h2>
          {hasPermission('settings:manage') && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await apiRequest<{ message: string }>('/api/settings/seed-sample', { method: 'POST' });
                  addToast({ type: 'success', title: 'Sample Dataset Ready', message: res.message });
                  await load();
                } catch (err) {
                  addToast({ type: 'error', title: 'Seed Failed', message: err instanceof Error ? err.message : '' });
                }
              }}
              className="px-3.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-xs font-medium text-[#173650] cursor-pointer"
            >
              Load / Verify Sample Dataset
            </button>
          )}
        </div>
        <div className="divide-y divide-slate-100 text-xs">
          {productCategories.map((c) => (
            <div key={c.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-[#173650]">{c.name}</span>
                <span className="text-slate-500 ml-2 font-mono">[{c.code}]</span>
              </div>
              <span className="text-slate-600">{c.description}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
