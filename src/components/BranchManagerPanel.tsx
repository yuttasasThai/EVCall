import {
  AlertTriangle,
  Calendar,
  CalendarPlus,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Link2,
  Loader2,
  Minus,
  Plus,
  Power,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { BranchLink } from '../types/repair';
import {
  apiCreateBranch,
  apiDeleteBranch,
  apiListBranches,
  apiUpdateBranch,
} from '../utils/apiClient';
import { exportBranchesToExcelCsv, formatThaiDateTime } from '../utils/notifications';

interface BranchManagerPanelProps {
  adminToken: string;
}

type DurationPreset = '1m' | '3m' | '6m' | '9m' | '1y' | 'custom';

const DURATION_PRESETS: Array<{ id: DurationPreset; label: string; months?: number }> = [
  { id: '1m', label: '1 เดือน', months: 1 },
  { id: '3m', label: '3 เดือน', months: 3 },
  { id: '6m', label: '6 เดือน', months: 6 },
  { id: '9m', label: '9 เดือน', months: 9 },
  { id: '1y', label: '1 ปี', months: 12 },
  { id: 'custom', label: 'กำหนดเอง' },
];

function computeExpiryIso(months: number, baseTimeMs = Date.now()): string {
  const d = new Date(baseTimeMs);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

function toLocalDateTimeInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getRemainingLabel(branch: BranchLink): { expired: boolean; text: string } {
  if (!branch.isActive) {
    return { expired: true, text: 'ปิดใช้งานชั่วคราว' };
  }
  const diff = Date.parse(branch.expiresAt) - Date.now();
  if (Number.isNaN(diff) || diff <= 0) {
    return { expired: true, text: 'หมดอายุแล้ว' };
  }
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return { expired: false, text: `เหลือ ${days} วัน` };
}

export function BranchManagerPanel({ adminToken }: BranchManagerPanelProps) {
  const [branches, setBranches] = useState<BranchLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [branchName, setBranchName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [technicianPhone, setTechnicianPhone] = useState('');
  const [preset, setPreset] = useState<DurationPreset>('1m');
  const [customExpiresAt, setCustomExpiresAt] = useState(() =>
    toLocalDateTimeInput(computeExpiryIso(1)),
  );

  const [formError, setFormError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [compactMobile, setCompactMobile] = useState(true);
  const [editingBranch, setEditingBranch] = useState<BranchLink | null>(null);
  const [editExpiresInput, setEditExpiresInput] = useState('');
  const [dismissedExpiredPopup, setDismissedExpiredPopup] = useState(false);

  const fetchBranches = useCallback(async () => {
    try {
      const list = await apiListBranches(adminToken);
      setBranches(list);
    } finally {
      setLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    void fetchBranches();
    const timer = window.setInterval(() => {
      void fetchBranches();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [fetchBranches]);

  const expiredBranches = useMemo(
    () =>
      branches.filter((b) => {
        const exp = Date.parse(b.expiresAt);
        return Number.isNaN(exp) || Date.now() > exp;
      }),
    [branches],
  );

  const handleSelectPreset = (next: DurationPreset, months?: number) => {
    setPreset(next);
    if (months) {
      setCustomExpiresAt(toLocalDateTimeInput(computeExpiryIso(months)));
    }
  };

  const handleCreateBranch = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!branchName.trim() || !username.trim() || !password.trim()) {
      setFormError('กรุณากรอกชื่อสาขา User และรหัสผ่านให้ครบถ้วน');
      return;
    }

    const expDate =
      preset === 'custom'
        ? new Date(customExpiresAt)
        : new Date(
            computeExpiryIso(
              DURATION_PRESETS.find((p) => p.id === preset)?.months || 1,
            ),
          );

    if (Number.isNaN(expDate.getTime())) {
      setFormError('กรุณาเลือกวันหมดอายุให้ถูกต้อง');
      return;
    }

    setCreating(true);
    try {
      const created = await apiCreateBranch(
        {
          branchName: branchName.trim(),
          username: username.trim(),
          password: password.trim(),
          technicianName: technicianName.trim() || branchName.trim(),
          technicianPhone: technicianPhone.trim() || '080-000-0000',
          expiresAt: expDate.toISOString(),
        },
        adminToken,
      );

      setBranches((prev) => [created, ...prev]);
      setBranchName('');
      setUsername('');
      setPassword('');
      setTechnicianName('');
      setTechnicianPhone('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'ไม่สามารถสร้างลิงก์สาขาได้');
    } finally {
      setCreating(false);
    }
  };

  const handleAdjustExpiry = async (branch: BranchLink, deltaDays: number, deltaMonths = 0) => {
    const baseMs = Math.max(Date.now(), Date.parse(branch.expiresAt) || Date.now());
    const d = new Date(baseMs);
    if (deltaMonths !== 0) {
      d.setMonth(d.getMonth() + deltaMonths);
    }
    if (deltaDays !== 0) {
      d.setDate(d.getDate() + deltaDays);
    }

    const updated = await apiUpdateBranch(
      branch.id,
      {
        expiresAt: d.toISOString(),
        isActive: true,
      },
      adminToken,
    );
    setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const handleSaveCustomExpiry = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingBranch || !editExpiresInput) return;
    const parsed = new Date(editExpiresInput);
    if (Number.isNaN(parsed.getTime())) return;

    const updated = await apiUpdateBranch(
      editingBranch.id,
      { expiresAt: parsed.toISOString(), isActive: true },
      adminToken,
    );
    setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    setEditingBranch(null);
  };

  const handleToggleActive = async (branch: BranchLink) => {
    const updated = await apiUpdateBranch(
      branch.id,
      { isActive: !branch.isActive },
      adminToken,
    );
    setBranches((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const handleDeleteBranch = async (id: string) => {
    await apiDeleteBranch(id, adminToken);
    setBranches((prev) => prev.filter((b) => b.id !== id));
  };

  const handleCopyUrl = async (branch: BranchLink) => {
    const url = `${window.location.origin}/?branch=${branch.code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(branch.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="space-y-5">
      {/* Popup Alert for Expired Branch Links */}
      {expiredBranches.length > 0 && !dismissedExpiredPopup && (
        <div
          role="alertdialog"
          aria-labelledby="expired-branches-title"
          className="rounded-2xl border-2 border-rose-400 bg-rose-50 p-4 shadow-md space-y-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-10 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="expired-branches-title" className="text-sm font-bold text-rose-950">
                  แจ้งเตือนลิงก์สาขาหมดอายุ ({expiredBranches.length} สาขา)
                </h3>
                <p className="text-xs text-rose-800 mt-0.5">
                  สาขาที่หมดอายุจะไม่สามารถแจ้งซ่อมหรือเข้าหน้าช่างได้ จนกว่า Admin จะกดต่ออายุ
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDismissedExpiredPopup(true)}
              aria-label="ปิดการแจ้งเตือนลิงก์หมดอายุ"
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-rose-700 hover:bg-rose-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {expiredBranches.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl border border-rose-200 px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900">{b.branchName}</span>{' '}
                  <span className="font-mono-tabular text-slate-500">({b.code})</span> · หมดอายุเมื่อ{' '}
                  <span className="font-mono-tabular text-rose-700">
                    {formatThaiDateTime(b.expiresAt)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAdjustExpiry(b, 0, 1)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 whitespace-nowrap"
                >
                  + ต่ออายุ 1 เดือน
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create New Branch Link Form */}
      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6">
        <div className="pb-3 border-b border-slate-100">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-sky-600" />
            สร้างลิงก์สำหรับสาขา (เฉพาะ Admin)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ลิงก์สาขาจะใช้งานได้เฉพาะหน้าแจ้งซ่อมลูกค้าและหน้าสำหรับช่าง พร้อมกำหนดวันหมดอายุและ User/รหัสผ่าน
          </p>
        </div>

        <form onSubmit={handleCreateBranch} className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="br-name" className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อสาขา *
              </label>
              <input
                id="br-name"
                type="text"
                required
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="เช่น สาขาบางนา"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label htmlFor="br-user" className="block text-xs font-semibold text-slate-700 mb-1">
                User เข้าระบบสาขา *
              </label>
              <input
                id="br-user"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="เช่น bangna01"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label htmlFor="br-pass" className="block text-xs font-semibold text-slate-700 mb-1">
                รหัสผ่านสาขา *
              </label>
              <input
                id="br-pass"
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="ตั้งรหัสผ่านให้สาขา"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono-tabular focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="br-tech-name" className="block text-xs font-semibold text-slate-700 mb-1">
                ชื่อช่างประจำสาขา
              </label>
              <input
                id="br-tech-name"
                type="text"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="เช่น ช่างเอก"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label htmlFor="br-tech-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                เบอร์โทรช่างสาขา
              </label>
              <input
                id="br-tech-phone"
                type="tel"
                inputMode="tel"
                value={technicianPhone}
                onChange={(e) => setTechnicianPhone(e.target.value)}
                placeholder="08X-XXX-XXXX"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono-tabular focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* Duration Icon Selector (1M, 3M, 6M, 9M, 1Y, Custom) */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-slate-700">
              กำหนดอายุการใช้งานลิงก์สาขา
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {DURATION_PRESETS.map((opt) => {
                const selected = preset === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectPreset(opt.id, opt.months)}
                    className={`min-h-[56px] rounded-2xl border p-2 flex flex-col items-center justify-center gap-1 transition-all ${
                      selected
                        ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-sm ring-2 ring-sky-200'
                        : 'border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    {opt.id === 'custom' ? (
                      <Calendar className="w-4 h-4 text-sky-600" />
                    ) : (
                      <CalendarPlus className="w-4 h-4 text-sky-600" />
                    )}
                    <span className="text-xs font-semibold whitespace-nowrap">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            {preset === 'custom' && (
              <div className="pt-1">
                <label htmlFor="br-custom-exp" className="block text-xs text-slate-600 mb-1">
                  ระบุวันและเวลาหมดอายุเอง
                </label>
                <input
                  id="br-custom-exp"
                  type="datetime-local"
                  value={customExpiresAt}
                  onChange={(e) => setCustomExpiresAt(e.target.value)}
                  className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm font-mono-tabular text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            )}
          </div>

          {formError && (
            <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={creating}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 active:scale-[0.98] transition-all inline-flex items-center gap-2 disabled:opacity-60"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            สร้างลิงก์สาขาใหม่
          </button>
        </form>
      </section>

      {/* Excel Branch Directory Table */}
      <section className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
        <div className="bg-[#15803D] text-white px-3 sm:px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold leading-tight">
                ตาราง Excel บันทึกรายชื่อลิงก์สาขา
              </h3>
              <p className="text-[11px] text-emerald-100 tabular-nums">
                ทั้งหมด {branches.length} สาขา · หมดอายุ {expiredBranches.length} สาขา
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCompactMobile((v) => !v)}
              className="sm:hidden px-2.5 py-1.5 min-h-[36px] rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-medium whitespace-nowrap"
            >
              {compactMobile ? 'ตารางกว้าง' : 'พอดีจอมือถือ'}
            </button>
            <button
              type="button"
              onClick={() => exportBranchesToExcelCsv(branches, window.location.origin)}
              disabled={branches.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg bg-white text-[#15803D] hover:bg-emerald-50 text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              ดาวน์โหลด Excel
            </button>
          </div>
        </div>

        {/* Custom Expiry Modal */}
        {editingBranch && (
          <form
            onSubmit={handleSaveCustomExpiry}
            className="bg-sky-50 border-b border-sky-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="text-xs font-semibold text-sky-950">
              ปรับวันหมดอายุแบบกำหนดเอง: {editingBranch.branchName} ({editingBranch.code})
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={editExpiresInput}
                onChange={(e) => setEditExpiresInput(e.target.value)}
                className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono-tabular"
              />
              <button
                type="submit"
                className="h-9 px-3 rounded-lg bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700"
              >
                บันทึกวันหมดอายุ
              </button>
              <button
                type="button"
                onClick={() => setEditingBranch(null)}
                className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-700"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        )}

        {/* Mobile Compact Excel View */}
        {compactMobile && (
          <div className="sm:hidden overflow-x-auto">
            <table className="w-full border-collapse text-[11px] leading-tight">
              <thead>
                <tr className="bg-slate-200 text-slate-600 font-mono-tabular text-[10px]">
                  <th className="border border-slate-300 px-1 py-1 w-6">#</th>
                  <th className="border border-slate-300 px-1.5 py-1">A · สาขา/รหัส</th>
                  <th className="border border-slate-300 px-1.5 py-1">B · User/Pass</th>
                  <th className="border border-slate-300 px-1.5 py-1">C · หมดอายุ/ต่ออายุ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="border border-slate-300 py-8 text-center text-slate-500">
                      กำลังโหลดรายชื่อสาขา...
                    </td>
                  </tr>
                ) : branches.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="border border-slate-300 py-8 text-center text-slate-500">
                      ยังไม่มีลิงก์สาขาที่สร้างไว้
                    </td>
                  </tr>
                ) : (
                  branches.map((b, idx) => {
                    const rem = getRemainingLabel(b);
                    return (
                      <tr key={b.id} className="align-top">
                        <td className="border border-slate-300 bg-slate-100 text-center py-2 px-1 font-mono-tabular">
                          {idx + 1}
                        </td>
                        <td className="border border-slate-300 p-1.5">
                          <div className="font-bold text-slate-900">{b.branchName}</div>
                          <div className="font-mono-tabular text-[10px] text-slate-500">{b.code}</div>
                          <button
                            type="button"
                            onClick={() => void handleCopyUrl(b)}
                            className="mt-1 inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-50 text-sky-700 border border-sky-200 font-semibold"
                          >
                            {copiedId === b.id ? (
                              <>
                                <Check className="w-3 h-3" /> คัดลอกแล้ว
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" /> คัดลอกลิงก์
                              </>
                            )}
                          </button>
                        </td>
                        <td className="border border-slate-300 p-1.5 font-mono-tabular">
                          <div className="text-slate-900">U: {b.username}</div>
                          <div className="text-slate-700">P: {b.password}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{b.technicianName}</div>
                        </td>
                        <td className="border border-slate-300 p-1.5 space-y-1">
                          <div
                            className={`font-semibold ${
                              rem.expired ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            {rem.text}
                          </div>
                          <div className="font-mono-tabular text-[10px] text-slate-500">
                            {formatThaiDateTime(b.expiresAt)}
                          </div>
                          <div className="flex flex-wrap gap-1 pt-0.5">
                            <button
                              type="button"
                              onClick={() => void handleAdjustExpiry(b, 0, 1)}
                              className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-semibold"
                            >
                              +1ด
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAdjustExpiry(b, -7)}
                              className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 text-[10px] font-semibold"
                            >
                              -7ว
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBranch(b);
                                setEditExpiresInput(toLocalDateTimeInput(b.expiresAt));
                              }}
                              className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-semibold"
                            >
                              ตั้งวัน
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteBranch(b.id)}
                              aria-label={`ลบสาขา ${b.branchName}`}
                              className="px-1 py-0.5 text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Full Excel Grid */}
        <div className={`${compactMobile ? 'hidden sm:block' : 'block'} overflow-x-auto`}>
          <table className="w-full min-w-[960px] border-collapse text-xs">
            <thead>
              <tr className="bg-slate-200/90 text-slate-600 font-mono-tabular text-[11px]">
                <th className="border border-slate-300 w-10 py-1 text-center bg-slate-200" />
                <th className="border border-slate-300 py-1 px-2 text-center">A</th>
                <th className="border border-slate-300 py-1 px-2 text-center">B</th>
                <th className="border border-slate-300 py-1 px-2 text-center">C</th>
                <th className="border border-slate-300 py-1 px-2 text-center">D</th>
                <th className="border border-slate-300 py-1 px-2 text-center">E</th>
                <th className="border border-slate-300 py-1 px-2 text-center">F</th>
                <th className="border border-slate-300 py-1 px-2 text-center">G</th>
                <th className="border border-slate-300 py-1 px-2 text-center">H</th>
              </tr>
              <tr className="bg-emerald-50/90 text-slate-900 font-semibold">
                <th className="border border-slate-300 w-10 py-2 text-center bg-slate-100 font-mono-tabular text-slate-500">
                  #
                </th>
                <th className="border border-slate-300 py-2 px-2.5 text-left">รหัสสาขา</th>
                <th className="border border-slate-300 py-2 px-2.5 text-left">ชื่อสาขา</th>
                <th className="border border-slate-300 py-2 px-2.5 text-left">User</th>
                <th className="border border-slate-300 py-2 px-2.5 text-left">รหัสผ่าน</th>
                <th className="border border-slate-300 py-2 px-2.5 text-left">ลิงก์สาขา</th>
                <th className="border border-slate-300 py-2 px-2.5 text-left">วันหมดอายุ</th>
                <th className="border border-slate-300 py-2 px-2.5 text-left">เพิ่ม/ลด วันหมดอายุ</th>
                <th className="border border-slate-300 py-2 px-2.5 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="border border-slate-300 py-10 text-center text-slate-500">
                    กำลังโหลดรายชื่อลิงก์สาขา...
                  </td>
                </tr>
              ) : branches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="border border-slate-300 py-10 text-center text-slate-500">
                    ยังไม่มีลิงก์สาขาในตาราง Excel
                  </td>
                </tr>
              ) : (
                branches.map((b, idx) => {
                  const rem = getRemainingLabel(b);
                  return (
                    <tr key={b.id} className="hover:bg-emerald-50/35">
                      <td className="border border-slate-300 bg-slate-100 text-slate-500 font-mono-tabular text-center py-2 px-1">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 font-mono-tabular font-semibold text-slate-800 whitespace-nowrap">
                        {b.code}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 font-semibold text-slate-900">
                        {b.branchName}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 font-mono-tabular text-slate-800">
                        {b.username}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 font-mono-tabular text-slate-800">
                        {b.password}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => void handleCopyUrl(b)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 font-medium"
                        >
                          {copiedId === b.id ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> คัดลอกแล้ว
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> คัดลอกลิงก์
                            </>
                          )}
                        </button>
                      </td>
                      <td className="border border-slate-300 px-2.5 py-2 whitespace-nowrap">
                        <div className="font-mono-tabular text-slate-800">
                          {formatThaiDateTime(b.expiresAt)}
                        </div>
                        <div
                          className={`text-[11px] font-semibold ${
                            rem.expired ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {rem.text}
                        </div>
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleAdjustExpiry(b, -7)}
                            title="ลด 7 วัน"
                            className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center gap-0.5 font-mono-tabular"
                          >
                            <Minus className="w-3 h-3" />
                            7ว
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleAdjustExpiry(b, 7)}
                            title="เพิ่ม 7 วัน"
                            className="px-2 py-1 rounded border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 inline-flex items-center gap-0.5 font-mono-tabular font-semibold"
                          >
                            <Plus className="w-3 h-3" />
                            7ว
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleAdjustExpiry(b, 0, 1)}
                            title="ต่ออายุ 1 เดือน"
                            className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          >
                            +1ด
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBranch(b);
                              setEditExpiresInput(toLocalDateTimeInput(b.expiresAt));
                            }}
                            className="px-2 py-1 rounded bg-sky-100 hover:bg-sky-200 text-sky-800 font-semibold"
                          >
                            กำหนดเอง
                          </button>
                        </div>
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(b)}
                            title={b.isActive ? 'ปิดชั่วคราว' : 'เปิดใช้งาน'}
                            className={`p-1.5 rounded ${
                              b.isActive
                                ? 'text-emerald-700 hover:bg-emerald-50'
                                : 'text-slate-400 hover:bg-slate-100'
                            }`}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteBranch(b.id)}
                            aria-label={`ลบสาขา ${b.branchName}`}
                            className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
