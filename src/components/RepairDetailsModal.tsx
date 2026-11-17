import { ArrowLeft, Crosshair, ExternalLink, Loader2, MapPin, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useRef, useState, type FormEvent, type MouseEvent } from 'react';
import { QUICK_ISSUES, type VehicleOption } from '../constants/vehicles';
import type { CreateRepairPayload } from '../types/repair';

interface RepairDetailsModalProps {
  vehicle: VehicleOption;
  onBack: () => void;
  onClose: () => void;
  onSubmit: (payload: CreateRepairPayload) => Promise<void>;
}

const DEFAULT_CENTER = { lat: 13.7563, lng: 100.5018 };

export function RepairDetailsModal({
  vehicle,
  onBack,
  onClose,
  onSubmit,
}: RepairDetailsModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [issue, setIssue] = useState('');
  const [addressNote, setAddressNote] = useState('');

  const [lat, setLat] = useState(DEFAULT_CENTER.lat);
  const [lng, setLng] = useState(DEFAULT_CENTER.lng);
  const [pinSource, setPinSource] = useState<'gps' | 'manual'>('manual');
  const [pinOffset, setPinOffset] = useState({ x: 50, y: 50 });
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('แตะบนแผนที่จำลองหรือกดดึงพิกัด GPS');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState('');
  const submitLockRef = useRef(false);

  const handleGetCurrentGps = () => {
    if (!navigator.geolocation) {
      setLocationMessage('เบราว์เซอร์ไม่รองรับ GPS กรุณาแตะปักหมุดบนช่องด้านล่าง');
      return;
    }
    setLocating(true);
    setLocationMessage('กำลังค้นหาตำแหน่ง GPS ปัจจุบัน...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(6)));
        setLng(Number(pos.coords.longitude.toFixed(6)));
        setPinSource('gps');
        setPinOffset({ x: 50, y: 50 });
        setLocating(false);
        setLocationMessage('ปักหมุดจากตำแหน่ง GPS ปัจจุบันเรียบร้อย');
      },
      () => {
        setLocating(false);
        setLocationMessage('ไม่สามารถเข้าถึง GPS ได้ แตะที่ช่องแผนที่เพื่อปักหมุดแทนได้');
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleMapPadClick = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = Math.max(8, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(12, Math.min(88, ((e.clientY - rect.top) / rect.height) * 100));
    setPinOffset({ x: xPct, y: yPct });

    const deltaLat = ((50 - yPct) / 100) * 0.02;
    const deltaLng = ((xPct - 50) / 100) * 0.02;
    setLat(Number((DEFAULT_CENTER.lat + deltaLat).toFixed(6)));
    setLng(Number((DEFAULT_CENTER.lng + deltaLng).toFixed(6)));
    setPinSource('manual');
    setLocationMessage('ปักหมุดตำแหน่งที่เลือกเรียบร้อย');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || isSubmitting) return;
    setErrorText('');

    if (!customerName.trim()) {
      setErrorText('กรุณากรอกชื่อผู้แจ้ง');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 9) {
      setErrorText('กรุณากรอกเบอร์โทรศัพท์ที่ติดต่อได้');
      return;
    }
    if (!issue.trim()) {
      setErrorText('กรุณาระบุอาการเสียคร่าวๆ');
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      await onSubmit({
        vehicleType: vehicle.id,
        vehicleLabel: vehicle.label,
        customerName: customerName.trim(),
        phone: phone.trim(),
        issue: issue.trim(),
        location: {
          lat,
          lng,
          addressNote: addressNote.trim(),
          source: pinSource,
        },
      });
    } catch (err) {
      submitLockRef.current = false;
      setErrorText(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการส่งข้อมูล');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/55 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="repair-form-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="w-full sm:max-w-lg max-h-[92dvh] flex flex-col bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              disabled={isSubmitting}
              aria-label="กลับไปเลือกรถ"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <img
              src={vehicle.imageUrl}
              alt={vehicle.label}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-xl object-contain bg-slate-50 border border-slate-200 p-0.5 shrink-0"
            />
            <div className="min-w-0">
              <h2 id="repair-form-title" className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                รายละเอียดแจ้งซ่อม · {vehicle.label}
              </h2>
              <p className="text-xs text-slate-500 truncate">กรอกข้อมูลและปักหมุดจุดรับซ่อม</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="ปิดหน้าต่าง"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="customer-name" className="block text-xs font-medium text-slate-700 mb-1">
                ชื่อผู้แจ้ง *
              </label>
              <input
                id="customer-name"
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="เช่น คุณสมชาย"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>

            <div>
              <label htmlFor="customer-phone" className="block text-xs font-medium text-slate-700 mb-1">
                เบอร์โทรศัพท์ *
              </label>
              <input
                id="customer-phone"
                type="tel"
                inputMode="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08X-XXX-XXXX"
                className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 font-mono-tabular focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="repair-issue" className="block text-xs font-medium text-slate-700 mb-1">
              อาการคร่าวๆ *
            </label>
            <textarea
              id="repair-issue"
              rows={2}
              required
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
              placeholder="อธิบายอาการเสีย เช่น แบตหมดไว, บิดไม่ไป, ไฟหน้าไม่ติด"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-none"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {QUICK_ISSUES.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    setIssue((prev) => (prev.trim() ? `${prev.trim()}, ${preset}` : preset))
                  }
                  className="px-2.5 py-1.5 text-[11px] font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-300 hover:bg-sky-50 active:scale-95 transition-all"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Pin Location Section */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-2.5 sm:p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                ปักหมุดตำแหน่ง
              </span>
              <button
                type="button"
                onClick={handleGetCurrentGps}
                disabled={locating}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[36px] rounded-lg bg-sky-600 text-white text-[11px] sm:text-xs font-medium hover:bg-sky-700 active:scale-95 transition-all disabled:opacity-60 whitespace-nowrap"
              >
                {locating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Crosshair className="w-3.5 h-3.5" />
                )}
                ดึงพิกัด GPS ปัจจุบัน
              </button>
            </div>

            {/* Interactive Map Pin Canvas */}
            <div
              onClick={handleMapPadClick}
              role="button"
              tabIndex={0}
              aria-label="พื้นที่ปักหมุดตำแหน่ง แตะเพื่อเลือกจุด"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleGetCurrentGps();
                }
              }}
              className="relative h-24 sm:h-28 w-full rounded-xl border border-slate-200 bg-white overflow-hidden cursor-crosshair select-none"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(14,165,233,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(14,165,233,0.08) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            >
              {/* Stylized roads */}
              <div className="absolute inset-x-0 top-1/2 h-2 bg-slate-100 -translate-y-1/2" />
              <div className="absolute inset-y-0 left-1/3 w-2 bg-slate-100" />
              <div className="absolute inset-y-0 right-1/4 w-1.5 bg-slate-100 rotate-12" />

              {/* Pinned Marker */}
              <div
                className="absolute -translate-x-1/2 -translate-y-full transition-all duration-150 pointer-events-none"
                style={{ left: `${pinOffset.x}%`, top: `${pinOffset.y}%` }}
              >
                <div className="relative flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-b from-amber-400 to-sky-600 p-1 shadow-lg border-2 border-white flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-white fill-white/30" />
                  </div>
                  <div className="w-2 h-1 rounded-full bg-slate-900/30 mt-0.5 blur-[1px]" />
                </div>
              </div>

              <div className="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[10px] text-slate-600 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-md border border-slate-200/80">
                <span className="truncate">{locationMessage}</span>
                <span className="font-mono-tabular shrink-0 ml-2 text-sky-700">
                  {lat.toFixed(4)}, {lng.toFixed(4)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 min-w-0">
              <input
                type="text"
                value={addressNote}
                onChange={(e) => setAddressNote(e.target.value)}
                placeholder="จุดสังเกต / บ้านเลขที่ / ซอย (ถ้ามี)"
                className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <a
                href={`https://maps.google.com/?q=${lat},${lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-2.5 sm:px-3 inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white text-xs font-medium text-sky-700 hover:bg-sky-50 shrink-0 whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                ดูแผนที่
              </a>
            </div>
          </div>

          {errorText && (
            <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              {errorText}
            </p>
          )}

          {/* Yellow + Blue Electric Wire Circular Submit Button */}
          <div className="pt-1 pb-2 flex flex-col items-center">
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              aria-label={isSubmitting ? 'กำลังส่งข้อมูลแจ้งซ่อม' : 'แจ้งซ่อม'}
              className={`btn-electric-submit relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex flex-col items-center justify-center p-1.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-400 transition-opacity ${
                isSubmitting ? 'opacity-75 cursor-not-allowed pointer-events-none' : ''
              }`}
            >
              {/* Inner sculpted electric core */}
              <span className="w-full h-full rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-sky-500 border-2 border-white/80 shadow-inner flex flex-col items-center justify-center px-2">
                {isSubmitting ? (
                  <Loader2 className="w-9 h-9 text-slate-900 animate-spin" strokeWidth={2.6} />
                ) : (
                  /* Custom Electric Cable + Plug + Lightning Vector */
                  <svg
                    viewBox="0 0 64 64"
                    className="w-11 h-11 drop-shadow-sm"
                    fill="none"
                    aria-hidden="true"
                  >
                    {/* Blue insulated cable loop */}
                    <path
                      d="M14 44 C10 34, 18 22, 28 24 C36 26, 36 38, 44 38 C50 38, 53 31, 50 24"
                      stroke="#0369A1"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                    <path
                      d="M14 44 C10 34, 18 22, 28 24 C36 26, 36 38, 44 38 C50 38, 53 31, 50 24"
                      stroke="#38BDF8"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                    {/* Yellow copper wire accent & plug head */}
                    <rect x="44" y="13" width="12" height="12" rx="3" fill="#0284C7" stroke="#FFFFFF" strokeWidth="1.5" />
                    <path d="M48 13V8M52 13V8" stroke="#FEF08A" strokeWidth="2.4" strokeLinecap="round" />
                    {/* Central electric spark */}
                    <path
                      d="M33 10 L24 27 H32 L28 42 L40 23 H31.5 L33 10 Z"
                      fill="#FEF08A"
                      stroke="#0C4A6E"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <span className="mt-0.5 text-sm font-bold text-slate-950 tracking-tight leading-none drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
                  {isSubmitting ? 'กำลังส่ง...' : 'แจ้งซ่อม'}
                </span>
              </span>
            </button>
            <span className="mt-2 text-[11px] text-slate-500">
              {isSubmitting
                ? 'กำลังส่งคำขอแจ้งซ่อม กรุณารอสักครู่...'
                : 'กดปุ่มสายไฟฟ้าเพื่อส่งข้อมูลถึงช่างทันที'}
            </span>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
