import { KeyRound, Loader2, Phone, Save, User, Volume2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { PublicShopInfo } from '../types/repair';
import { apiUpdateTechSettings } from '../utils/apiClient';
import { speakThai } from '../utils/voice';

interface TechnicianSettingsPanelProps {
  shopInfo: PublicShopInfo;
  authHeaders: Record<string, string>;
  onUpdated: (shop: PublicShopInfo) => void;
}

export function TechnicianSettingsPanel({
  shopInfo,
  authHeaders,
  onUpdated,
}: TechnicianSettingsPanelProps) {
  const [technicianName, setTechnicianName] = useState(shopInfo.technicianName);
  const [technicianPhone, setTechnicianPhone] = useState(shopInfo.technicianPhone);
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handlePreviewVoice = () => {
    const name = technicianName.trim() || 'สมชาย';
    speakThai(`ช่าง${name} ขอบคุณคับ จะรีบติดต่อกลับโดยเร็ว`);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!technicianName.trim()) {
      setMessage({ type: 'err', text: 'กรุณากรอกชื่อช่าง' });
      return;
    }
    if (!technicianPhone.trim()) {
      setMessage({ type: 'err', text: 'กรุณากรอกเบอร์โทรช่าง' });
      return;
    }
    if (newPasscode) {
      if (newPasscode.length < 4) {
        setMessage({ type: 'err', text: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร' });
        return;
      }
      if (newPasscode !== confirmPasscode) {
        setMessage({ type: 'err', text: 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน' });
        return;
      }
    }

    setSaving(true);
    try {
      const updatedShop = await apiUpdateTechSettings(
        {
          branchCode: shopInfo.branchCode,
          technicianName: technicianName.trim(),
          technicianPhone: technicianPhone.trim(),
          newPasscode: newPasscode.trim() || undefined,
        },
        authHeaders,
      );

      onUpdated(updatedShop);
      setNewPasscode('');
      setConfirmPasscode('');
      setMessage({
        type: 'ok',
        text: 'บันทึกการตั้งค่าช่างเรียบร้อย ข้อมูลแสดงผลบนหน้าลูกค้าและเสียงขอบคุณถูกอัปเดตทันที',
      });
    } catch (err) {
      setMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'บันทึกการตั้งค่าไม่สำเร็จ',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 max-w-2xl">
      <div className="pb-4 border-b border-slate-100">
        <h2 className="text-base sm:text-lg font-bold text-slate-900">
          ตั้งค่าข้อมูลช่างและรหัสเข้าใช้งาน ({shopInfo.branchName})
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          ชื่อและเบอร์โทรช่างจะแสดงในหน้าติดตามสถานะของลูกค้า และใช้ในเสียงพูดขอบคุณหลังลูกค้ากดแจ้งซ่อม
        </p>
      </div>

      <form onSubmit={handleSubmit} className="pt-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="set-tech-name" className="block text-xs font-semibold text-slate-700 mb-1">
              ชื่อช่าง (ใช้ในเสียงแจ้งซ่อม & หน้าลูกค้า)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="set-tech-name"
                type="text"
                required
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
                placeholder="เช่น สมชาย"
                className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="set-tech-phone" className="block text-xs font-semibold text-slate-700 mb-1">
              เบอร์โทรช่าง (สำหรับปุ่มโทรออกหน้าลูกค้า)
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="set-tech-phone"
                type="tel"
                inputMode="tel"
                required
                value={technicianPhone}
                onChange={(e) => setTechnicianPhone(e.target.value)}
                placeholder="08X-XXX-XXXX"
                className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono-tabular text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Voice Thank-you Preview */}
        <div className="rounded-xl bg-sky-50/70 border border-sky-200 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-sky-900">ตัวอย่างเสียงหลังลูกค้ากดแจ้งซ่อม</p>
            <p className="text-xs sm:text-sm text-slate-700 mt-0.5">
              “ช่าง{technicianName.trim() || 'สมชาย'} ขอบคุณคับ จะรีบติดต่อกลับโดยเร็ว”
            </p>
          </div>
          <button
            type="button"
            onClick={handlePreviewVoice}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-sky-200 text-sky-700 text-xs font-semibold hover:bg-sky-100 inline-flex items-center justify-center gap-1.5 shrink-0"
          >
            <Volume2 className="w-4 h-4" />
            ทดสอบเสียง
          </button>
        </div>

        {/* Password Change */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-slate-500" />
            เปลี่ยนรหัสผ่านเข้าหน้าสำหรับช่าง (เว้นว่างไว้หากไม่เปลี่ยน)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="password"
              autoComplete="new-password"
              value={newPasscode}
              onChange={(e) => setNewPasscode(e.target.value)}
              placeholder="รหัสผ่านใหม่ (อย่างน้อย 4 ตัว)"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPasscode}
              onChange={(e) => setConfirmPasscode(e.target.value)}
              placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง"
              className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {message && (
          <div
            className={`rounded-xl px-3.5 py-2.5 text-xs font-medium border ${
              message.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:scale-[0.98] transition-all inline-flex items-center gap-2 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          บันทึกการตั้งค่าช่าง
        </button>
      </form>
    </section>
  );
}
