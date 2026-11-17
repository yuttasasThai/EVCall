import { KeyRound, Loader2, ShieldCheck, Wrench, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import type { PublicShopInfo } from '../types/repair';
import { apiAdminLogin, apiTechnicianLogin } from '../utils/apiClient';

interface AuthGateModalProps {
  mode: 'technician' | 'admin';
  branchCode: string;
  branchName: string;
  onSuccessAdmin: (token: string) => void;
  onSuccessTechnician: (token: string, shop: PublicShopInfo) => void;
  onClose: () => void;
}

export function AuthGateModal({
  mode,
  branchCode,
  branchName,
  onSuccessAdmin,
  onSuccessTechnician,
  onClose,
}: AuthGateModalProps) {
  const isBranchTech = mode === 'technician' && branchCode !== 'main';
  const [username, setUsername] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorText('');
    if (isBranchTech && !username.trim()) {
      setErrorText('กรุณากรอก User ของสาขา');
      return;
    }
    if (!passcode.trim()) {
      setErrorText('กรุณากรอกรหัสผ่าน');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'admin') {
        const token = await apiAdminLogin(passcode);
        onSuccessAdmin(token);
      } else {
        const result = await apiTechnicianLogin({
          branchCode,
          username: isBranchTech ? username.trim() : undefined,
          passcode,
        });
        onSuccessTechnician(result.token, result.shop);
      }
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'รหัสผ่านไม่ถูกต้อง');
      setPasscode('');
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 ${
                mode === 'admin' ? 'bg-slate-900' : 'bg-sky-600'
              }`}
            >
              {mode === 'admin' ? (
                <ShieldCheck className="w-4 h-4" />
              ) : (
                <Wrench className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <h2 id="auth-modal-title" className="text-base font-bold text-slate-900 truncate">
                {mode === 'admin' ? 'เข้าสู่ระบบ Admin' : `เข้าสู่ระบบช่าง · ${branchName}`}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === 'admin'
                  ? 'กรุณาใส่รหัสผ่านผู้ดูแลระบบ'
                  : isBranchTech
                    ? 'ใส่ User และรหัสผ่านของสาขา'
                    : 'ใส่รหัสผ่านสำหรับช่างเพื่อจัดการงานซ่อม'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4" autoComplete="off">
          {isBranchTech && (
            <div>
              <label htmlFor="branch-username" className="block text-xs font-medium text-slate-700 mb-1">
                User สาขา
              </label>
              <input
                id="branch-username"
                type="text"
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="กรอกชื่อผู้ใช้สาขา"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-passcode" className="block text-xs font-medium text-slate-700 mb-1">
              รหัสผ่าน
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="auth-passcode"
                type="password"
                autoComplete="new-password"
                autoFocus={!isBranchTech}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                aria-label="กรอกรหัสผ่าน"
                className="w-full h-11 pl-10 pr-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {errorText && (
            <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {errorText}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full h-11 rounded-xl text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all disabled:opacity-60 ${
              mode === 'admin'
                ? 'bg-slate-900 hover:bg-slate-800'
                : 'bg-sky-600 hover:bg-sky-700'
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            เข้าสู่ระบบ
          </button>
        </form>
      </motion.div>
    </div>
  );
}
