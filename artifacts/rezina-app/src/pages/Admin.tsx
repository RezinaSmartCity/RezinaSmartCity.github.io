import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  BarChart3, Inbox, LogOut, CheckCircle, Clock, Trash2,
  Eye, RefreshCw, ChevronDown, AlertCircle, Download,
} from 'lucide-react';
import { supabase, isSupabaseConfigured, type Report } from '@/lib/supabase';
import { CATEGORY_CONFIG } from './Home';

type NavTab = 'dashboard' | 'reports';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD as string | undefined;

// ─── Login ───────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ADMIN_PASSWORD) {
      setError('VITE_ADMIN_PASSWORD nu este configurat.');
      return;
    }
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_ok', '1');
      onLogin();
    } else {
      setError('Parolă incorectă.');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary">🏙️ Rezina Smart City</h1>
          <p className="text-muted-foreground text-sm mt-1">Panou de administrare</p>
        </div>
        <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="space-y-1.5">
            <Label htmlFor="pw">Parolă administrator</Label>
            <Input
              id="pw"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Introduceți parola…"
              autoFocus
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg p-2.5 border border-destructive/20">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <Button type="submit" className="w-full">Conectare</Button>
        </form>
        {!ADMIN_PASSWORD && (
          <p className="text-center text-xs text-muted-foreground mt-4">
            Setați <code className="bg-muted px-1 rounded">VITE_ADMIN_PASSWORD</code> în Secrets
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: {
  label: string; value: number; color: string; icon: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ resolved }: { resolved: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
      resolved
        ? 'bg-green-500/15 text-green-400 border border-green-500/20'
        : 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
    )}>
      {resolved ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {resolved ? 'Remediat' : 'În așteptare'}
    </span>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCsv(reports: Report[]) {
  const headers = ['ID', 'Titlu', 'Categorie', 'Descriere', 'Status', 'Voturi', 'Adresă', 'Lat', 'Lng', 'Raportat de', 'Email', 'Data'];
  const rows = reports.map((r) => [
    r.id,
    `"${r.title.replace(/"/g, '""')}"`,
    r.category,
    `"${r.description.replace(/"/g, '""')}"`,
    r.resolved ? 'remediat' : 'în așteptare',
    r.votes,
    `"${(r.address ?? '').replace(/"/g, '""')}"`,
    r.latitude,
    r.longitude,
    r.reporter_name ?? '',
    r.reporter_email ?? '',
    new Date(r.created_at).toLocaleDateString('ro-MD'),
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rezina-civic-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────

function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<NavTab>('dashboard');
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });
      setReports((data as Report[]) || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, resolved: boolean) => {
    await supabase
      .from('reports')
      .update({ resolved, status: resolved ? 'resolved' : 'pending' })
      .eq('id', id);
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, resolved, status: resolved ? 'resolved' : 'pending' } : r));
    if (expandedReport === id) setExpandedReport(null);
  };

  const deleteReport = async (id: string) => {
    if (!confirm('Sigur doriți să ștergeți această sesizare?')) return;
    await supabase.from('reports').delete().eq('id', id);
    setReports((prev) => prev.filter((r) => r.id !== id));
    if (expandedReport === id) setExpandedReport(null);
  };

  const filteredReports = reports.filter((r) => {
    if (filterStatus === 'pending' && r.resolved) return false;
    if (filterStatus === 'resolved' && !r.resolved) return false;
    if (filterCategory !== 'all' && r.category !== filterCategory) return false;
    return true;
  });

  // Stats
  const total = reports.length;
  const resolved = reports.filter((r) => r.resolved).length;
  const pending = total - resolved;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recent = reports.filter((r) => r.created_at >= thirtyDaysAgo).length;
  const byCategory: Record<string, number> = {};
  reports.forEach((r) => { byCategory[r.category] = (byCategory[r.category] ?? 0) + 1; });

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm flex-shrink-0 z-50">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base sm:text-lg font-bold text-primary truncate">🏙️ Rezina</span>
            <span className="hidden sm:inline text-muted-foreground text-sm flex-shrink-0">Smart City / Admin</span>
            <span className="sm:hidden text-muted-foreground text-xs flex-shrink-0">Admin</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!isSupabaseConfigured && (
              <span className="text-amber-400 text-xs hidden sm:inline">⚠ Supabase neconfigurat</span>
            )}
            <Button variant="ghost" size="sm" onClick={load} disabled={loading} className="px-2">
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
            <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground px-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-1">Ieșire</span>
            </Button>
          </div>
        </div>
        {/* Tab bar */}
        <div
          className="max-w-6xl mx-auto px-3 sm:px-4 flex gap-0 overflow-x-auto"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {([
            ['dashboard', 'Dashboard', BarChart3],
            ['reports', 'Sesizări', Inbox],
          ] as [NavTab, string, React.ElementType][]).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm border-b-2 transition-colors whitespace-nowrap flex-shrink-0',
                tab === id
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        <div className="max-w-6xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6">

          {/* ─── Dashboard ─── */}
          {tab === 'dashboard' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Sumar general</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total sesizări" value={total} color="bg-primary/10 text-primary" icon={<Inbox className="w-5 h-5" />} />
                <StatCard label="În așteptare" value={pending} color="bg-amber-500/10 text-amber-400" icon={<Clock className="w-5 h-5" />} />
                <StatCard label="Remediate" value={resolved} color="bg-green-500/10 text-green-400" icon={<CheckCircle className="w-5 h-5" />} />
                <StatCard label="Ultimele 30 zile" value={recent} color="bg-purple-500/10 text-purple-400" icon={<BarChart3 className="w-5 h-5" />} />
              </div>

              {Object.keys(byCategory).length > 0 && (
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-semibold mb-4 text-sm text-muted-foreground uppercase tracking-wider">Sesizări per categorie</h3>
                  <div className="space-y-2">
                    {Object.entries(byCategory)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, count]) => {
                        const cfg = CATEGORY_CONFIG[cat];
                        const pct = total ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={cat} className="flex items-center gap-3">
                            <span className="text-base w-6">{cfg?.icon ?? '📋'}</span>
                            <span className="text-sm flex-1 truncate">{cfg?.label ?? cat}</span>
                            <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Top voted */}
              {total > 0 && (
                <div className="bg-card border border-border rounded-xl p-4">
                  <h3 className="font-semibold mb-3 text-sm text-muted-foreground uppercase tracking-wider">Cele mai votate sesizări</h3>
                  <div className="space-y-2">
                    {[...reports]
                      .sort((a, b) => b.votes - a.votes)
                      .slice(0, 5)
                      .map((r) => (
                        <div key={r.id} className="flex items-center gap-3 text-sm">
                          <span className="text-base">{CATEGORY_CONFIG[r.category]?.icon ?? '📋'}</span>
                          <span className="flex-1 truncate">{r.title}</span>
                          <span className="text-xs text-muted-foreground">{r.votes}/3 voturi</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {total === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Inbox className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nicio sesizare înregistrată încă.</p>
                </div>
              )}
            </div>
          )}

          {/* ─── Reports ─── */}
          {tab === 'reports' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <h2 className="text-xl font-bold flex-1">Sesizări ({filteredReports.length})</h2>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="text-sm bg-card border border-border rounded-lg px-3 py-1.5 text-foreground"
                  >
                    <option value="all">Toate statusurile</option>
                    <option value="pending">În așteptare</option>
                    <option value="resolved">Remediate</option>
                  </select>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="text-sm bg-card border border-border rounded-lg px-3 py-1.5 text-foreground"
                  >
                    <option value="all">Toate categoriile</option>
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.icon} {cfg.label}</option>
                    ))}
                  </select>
                  <Button size="sm" variant="outline" onClick={() => exportCsv(filteredReports)} className="gap-1.5">
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {filteredReports.length === 0 && (
                  <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
                    <Inbox className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>Nicio sesizare găsită.</p>
                  </div>
                )}
                {filteredReports.map((r) => {
                  const cfg = CATEGORY_CONFIG[r.category];
                  const isExpanded = expandedReport === r.id;
                  return (
                    <div key={r.id} className="bg-card border border-border rounded-xl overflow-hidden">
                      <div
                        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-accent/5 transition-colors"
                        onClick={() => setExpandedReport(isExpanded ? null : r.id)}
                      >
                        <span className="text-xl mt-0.5">{cfg?.icon ?? '📋'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">{r.title}</span>
                            <StatusBadge resolved={r.resolved} />
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span>{cfg?.label ?? r.category}</span>
                            <span>{new Date(r.created_at).toLocaleDateString('ro-MD')}</span>
                            {r.reporter_name && <span>{r.reporter_name}</span>}
                          </div>
                        </div>
                        <ChevronDown className={cn('w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform mt-1', isExpanded && 'rotate-180')} />
                      </div>

                      {isExpanded && (
                        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                          <p className="text-sm leading-relaxed bg-accent/5 rounded-lg p-3 border border-border">{r.description}</p>

                          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <div><span className="font-medium text-foreground">GPS:</span> {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}</div>
                            {r.address && <div><span className="font-medium text-foreground">Adresă:</span> {r.address}</div>}
                            {r.reporter_email && <div><span className="font-medium text-foreground">Email:</span> {r.reporter_email}</div>}
                            <div><span className="font-medium text-foreground">Voturi:</span> {r.votes}/3</div>
                          </div>

                          {r.photo_url && (
                            <img src={r.photo_url} alt="Poză" className="w-full max-h-48 object-contain rounded-lg border border-border bg-black/20" />
                          )}

                          <a
                            href={`https://www.google.com/maps?q=${r.latitude},${r.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Vizualizează pe Google Maps
                          </a>

                          <div className="flex gap-2 pt-1 flex-wrap">
                            {!r.resolved ? (
                              <Button size="sm" variant="outline" className="text-green-400 border-green-500/30 hover:bg-green-500/10"
                                onClick={() => updateStatus(r.id, true)}>
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                Marchează remediat
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                                onClick={() => updateStatus(r.id, false)}>
                                <Clock className="w-3.5 h-3.5 mr-1" />
                                Redeschide sesizarea
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => deleteReport(r.id)}>
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Șterge
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </main>

      <footer className="border-t border-border py-2 text-center text-xs text-muted-foreground flex-shrink-0">
        Rezina Smart City · Admin · <strong>Pavel Dordea</strong>
      </footer>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Admin() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin_ok') === '1');

  const handleLogout = () => {
    sessionStorage.removeItem('admin_ok');
    setAuthed(false);
  };

  if (!authed) return <LoginScreen onLogin={() => setAuthed(true)} />;
  return <AdminPanel onLogout={handleLogout} />;
}
