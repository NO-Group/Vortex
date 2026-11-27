import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';

interface BillingPlan {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  interval: string;
  interval_count: number;
  features: Record<string, unknown> | null;
  is_active: boolean;
  is_public: boolean;
}

interface BillingStatus {
  enabled: boolean;
  gateway: string | null;
  default_currency: string;
}

interface BillingTransaction {
  id: string;
  gateway: string;
  plan_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  reference: string;
  created_at: string;
}

interface UserBilling {
  plan: string | null;
  credits: number;
  plan_expires_at: string | null;
  has_active_subscription: boolean;
  subscription: {
    id: string;
    plan_id: string;
    gateway: string;
    status: string;
    current_period_end: string | null;
  } | null;
}

export function BillingPage({ isAdmin }: { isAdmin: boolean }) {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [transactions, setTransactions] = useState<BillingTransaction[]>([]);
  const [me, setMe] = useState<UserBilling | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreatePlan, setShowCreatePlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statusRes, plansRes, txRes, meRes] = await Promise.all([
        api.get<BillingStatus>('/v1/billing/status'),
        api.get<BillingPlan[]>('/v1/billing/plans'),
        api.get<BillingTransaction[]>('/v1/billing/transactions'),
        api.get<UserBilling>('/v1/billing/me'),
      ]);
      setStatus(statusRes);
      setPlans(plansRes);
      setTransactions(txRes);
      setMe(meRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const formatPrice = (cents: number, currency: string) => {
    const amount = (cents / 100).toFixed(2);
    const symbols: Record<string, string> = { ngn: '₦', usd: '$', ghs: '₵', kes: 'KSh', zar: 'R' };
    return `${symbols[currency] ?? ''}${amount}/${'month'}`;
  };

  const handleCreatePlan = async () => {
    if (!newPlanName.trim() || !newPlanPrice) return;
    try {
      await api.post('/v1/billing/plans', {
        name: newPlanName.trim(),
        displayName: newPlanName.trim(),
        priceCents: parseInt(newPlanPrice) * 100,
        currency: status?.default_currency ?? 'ngn',
        interval: 'month',
        isPublic: true,
      });
      setNewPlanName('');
      setNewPlanPrice('');
      setShowCreatePlan(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create plan');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        Loading billing...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing & Payments</h1>
        <p className="mt-1 text-sm text-slate-400">
          {status?.enabled
            ? `${status.gateway?.toUpperCase() ?? 'Gateway'} gateway active · ${status.default_currency.toUpperCase()}`
            : 'Billing not configured'}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Current plan summary */}
      {me && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">Current Plan</div>
              <div className="mt-1 text-2xl font-bold text-white">
                {me.plan ? me.plan.charAt(0).toUpperCase() + me.plan.slice(1) : 'Free'}
              </div>
            </div>
            <div className="flex gap-8">
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Credits</div>
                <div className="mt-1 text-lg font-semibold text-white">{me.credits.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Expires</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {me.plan_expires_at ? new Date(me.plan_expires_at).toLocaleDateString() : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-slate-500">Subscription</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {me.has_active_subscription ? 'Active' : 'None'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Plans */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Plans</h2>
          {isAdmin && (
            <button
              onClick={() => setShowCreatePlan(!showCreatePlan)}
              className="rounded-lg border border-interactive-focus/40 bg-interactive-focus/10 px-3 py-1.5 text-sm font-medium text-interactive-focus transition hover:bg-interactive-focus/20"
            >
              {showCreatePlan ? 'Cancel' : '+ New Plan'}
            </button>
          )}
        </div>

        {showCreatePlan && (
          <div className="mb-4 flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <input
              type="text"
              placeholder="Plan name"
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
              className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-interactive-focus/60 focus:outline-none"
            />
            <input
              type="number"
              placeholder="Price"
              value={newPlanPrice}
              onChange={(e) => setNewPlanPrice(e.target.value)}
              className="w-32 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-interactive-focus/60 focus:outline-none"
            />
            <button
              onClick={handleCreatePlan}
              className="rounded-lg bg-interactive-focus px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
            >
              Create
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">{plan.display_name}</h3>
                {plan.is_active ? (
                  <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-400">Active</span>
                ) : (
                  <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-xs font-medium text-slate-400">Inactive</span>
                )}
              </div>
              <div className="mt-2 text-2xl font-bold text-white">
                {formatPrice(plan.price_cents, plan.currency)}
              </div>
              {plan.description && (
                <p className="mt-2 text-sm text-slate-400">{plan.description}</p>
              )}
              {plan.features && (
                <div className="mt-3 space-y-1">
                  {Object.entries(plan.features).map(([key, val]) => (
                    <div key={key} className="flex justify-between text-xs text-slate-500">
                      <span>{key}</span>
                      <span className="text-slate-300">{String(val)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">Transactions</h2>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 font-medium">Reference</th>
                <th className="px-4 py-3 font-medium">Gateway</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No transactions yet</td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-white/5">
                    <td className="px-4 py-3 text-slate-300">{tx.reference}</td>
                    <td className="px-4 py-3 text-slate-400">{tx.gateway}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {(tx.amount_cents / 100).toFixed(2)} {tx.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          tx.status === 'success'
                            ? 'bg-green-500/15 text-green-400'
                            : tx.status === 'failed'
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-slate-500/15 text-slate-400'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
