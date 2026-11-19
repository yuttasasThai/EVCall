import {
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Phone,
  PhoneCall,
  PlusCircle,
  User,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { VEHICLE_OPTIONS } from '../constants/vehicles';
import { REPAIR_STATUS_STEPS, type PublicShopInfo, type RepairTicket } from '../types/repair';
import { formatThaiDateTime } from '../utils/notifications';
import { RippleButton } from './InkRipple';
import { Status3DIcon } from './Status3DIcon';

interface ActiveTicketStatusProps {
  ticket: RepairTicket;
  branchRepairs?: RepairTicket[];
  shopInfo: PublicShopInfo;
  isConnected: boolean;
  onNewRequest: () => void;
  onBackHome: () => void;
}

const DEFAULT_AVG_REPAIR_MINUTES = 45;

function getStatusRemainingWeight(status: RepairTicket['status']): number {
  if (status === 'repairing') return 0.5;
  if (status === 'inspecting') return 0.75;
  return 1;
}

function formatDurationThai(minutes: number): string {
  if (minutes < 60) return `${minutes} นาที`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hrs} ชม.`;
  return `${hrs} ชม. ${mins} นาที`;
}

function formatEstimatedFinishTime(nowMs: number, addMinutes: number): string {
  const nowDate = new Date(nowMs);
  const finishDate = new Date(nowMs + addMinutes * 60_000);
  const timeStr = new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(finishDate);
  const isSameDay =
    nowDate.getFullYear() === finishDate.getFullYear() &&
    nowDate.getMonth() === finishDate.getMonth() &&
    nowDate.getDate() === finishDate.getDate();
  if (isSameDay) return `~${timeStr} น.`;

  const startOfToday = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate(),
  ).getTime();
  const startOfFinishDay = new Date(
    finishDate.getFullYear(),
    finishDate.getMonth(),
    finishDate.getDate(),
  ).getTime();
  const dayDiff = Math.round((startOfFinishDay - startOfToday) / 86_400_000);
  if (dayDiff === 1) return `พรุ่งนี้ ~${timeStr} น.`;

  const dateStr = new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
  }).format(finishDate);
  return `${dateStr} ~${timeStr} น.`;
}

export function ActiveTicketStatus({
  ticket,
  branchRepairs,
  shopInfo,
  isConnected,
  onNewRequest,
  onBackHome,
}: ActiveTicketStatusProps) {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const currentStepIndex = Math.max(
    0,
    REPAIR_STATUS_STEPS.findIndex((s) => s.id === ticket.status),
  );
  const currentStepMeta = REPAIR_STATUS_STEPS[currentStepIndex];
  const vehicleMeta = VEHICLE_OPTIONS.find((v) => v.id === ticket.vehicleType);
  const cleanTechPhone = shopInfo.technicianPhone.replace(/[^\d+]/g, '');

  const scopedRepairs = branchRepairs && branchRepairs.length > 0 ? branchRepairs : [ticket];
  const completedDurations = scopedRepairs
    .filter((r) => r.status === 'completed')
    .map((r) => (new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime()) / 60_000)
    .filter((mins) => Number.isFinite(mins) && mins >= 5 && mins <= 720);

  const hasHistoricalAvg = completedDurations.length > 0;
  const avgRepairMinutes = hasHistoricalAvg
    ? Math.min(
        480,
        Math.max(
          15,
          Math.round(
            completedDurations.reduce((sum, mins) => sum + mins, 0) / completedDurations.length,
          ),
        ),
      )
    : DEFAULT_AVG_REPAIR_MINUTES;

  const activeQueue = scopedRepairs
    .filter((r) => r.status !== 'completed')
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const isCompleted = ticket.status === 'completed';
  const myQueueIndex = activeQueue.findIndex((r) => r.id === ticket.id);
  const queueAhead = isCompleted
    ? 0
    : myQueueIndex >= 0
      ? myQueueIndex
      : Math.max(0, activeQueue.length - 1);
  const remainingQueueCount = isCompleted ? 0 : queueAhead + 1;

  const aheadWeight =
    !isCompleted && myQueueIndex >= 0
      ? activeQueue
          .slice(0, myQueueIndex)
          .reduce((sum, item) => sum + getStatusRemainingWeight(item.status), 0)
      : queueAhead;

  const totalRemainingUnits = isCompleted
    ? 0
    : aheadWeight + getStatusRemainingWeight(ticket.status);
  const estimatedMinutes = isCompleted
    ? 0
    : Math.max(10, Math.round((totalRemainingUnits * avgRepairMinutes) / 5) * 5);
  const progressPercent = Math.round(((currentStepIndex + 1) / REPAIR_STATUS_STEPS.length) * 100);

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-5">
      {/* Live Status Hero Card */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-7">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono-tabular font-semibold text-slate-800">{ticket.code}</span>
              <span aria-hidden="true">·</span>
              <span>{ticket.vehicleLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                {isConnected ? 'เชื่อมต่อเรียลไทม์' : 'กำลังซิงค์...'}
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 mt-1">
              ติดตามสถานะการซ่อมรถไฟฟ้า
            </h1>
          </div>
          {vehicleMeta && (
            <img
              src={vehicleMeta.imageUrl}
              alt={ticket.vehicleLabel}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-2xl object-contain bg-slate-50 border border-slate-200 p-1 shrink-0"
            />
          )}
        </div>

        {/* Hero 3D Circular Status Icon */}
        <div className="py-6 flex flex-col items-center text-center">
          <Status3DIcon status={ticket.status} active size="lg" />
          <h2 className="mt-4 text-xl font-bold text-slate-900">{currentStepMeta.label}</h2>
          <p className="mt-1 text-sm text-slate-600 max-w-md">{currentStepMeta.description}</p>
          <p className="mt-2 text-xs text-slate-400 font-mono-tabular">
            อัปเดตล่าสุด: {formatThaiDateTime(ticket.updatedAt)}
          </p>
        </div>

        {/* Visual Step Progress Bar & 5-Step 3D Indicator */}
        <div className="pt-2 pb-4 space-y-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700">ความคืบหน้าขั้นตอนการซ่อม</span>
            <span className="font-mono-tabular font-semibold text-sky-700">
              ขั้นที่ {currentStepIndex + 1}/{REPAIR_STATUS_STEPS.length} · {progressPercent}%
            </span>
          </div>

          <div
            role="progressbar"
            aria-label="ความคืบหน้าการซ่อม"
            aria-valuemin={1}
            aria-valuemax={REPAIR_STATUS_STEPS.length}
            aria-valuenow={currentStepIndex + 1}
            aria-valuetext={`${currentStepMeta.label} (${progressPercent}%)`}
            className="relative"
          >
            {/* Horizontal connecting track aligned through step icon centers */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-[10%] right-[10%] top-5 sm:top-[22px] -translate-y-1/2 h-1.5 rounded-full bg-slate-200 overflow-hidden z-0"
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  isCompleted
                    ? 'bg-emerald-500'
                    : 'bg-gradient-to-r from-sky-500 via-sky-600 to-indigo-500'
                }`}
                style={{
                  width: `${
                    REPAIR_STATUS_STEPS.length > 1
                      ? (currentStepIndex / (REPAIR_STATUS_STEPS.length - 1)) * 100
                      : 100
                  }%`,
                }}
              />
            </div>

            <ol className="relative z-10 grid grid-cols-5 gap-1 sm:gap-2 items-start">
              {REPAIR_STATUS_STEPS.map((step, idx) => {
                const isStepActive = idx === currentStepIndex;
                const isStepCompleted = idx < currentStepIndex;
                return (
                  <li
                    key={step.id}
                    aria-current={isStepActive ? 'step' : undefined}
                    className="flex flex-col items-center"
                  >
                    <Status3DIcon
                      status={step.id}
                      active={isStepActive}
                      completed={isStepCompleted}
                      size="sm"
                      label={step.shortLabel}
                    />
                    <span
                      className={`mt-0.5 text-[9px] sm:text-[10px] font-mono-tabular ${
                        isStepActive
                          ? isCompleted
                            ? 'text-emerald-700 font-semibold'
                            : 'text-sky-700 font-semibold'
                          : isStepCompleted
                            ? 'text-emerald-600'
                            : 'text-slate-400'
                      }`}
                    >
                      {isStepCompleted
                        ? 'ผ่านแล้ว'
                        : isStepActive
                          ? isCompleted
                            ? 'เสร็จสิ้น'
                            : 'ขั้นปัจจุบัน'
                          : `ขั้น ${idx + 1}`}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {/* Estimated Completion Time Bar */}
        <div
          aria-live="polite"
          className={`mt-2 rounded-2xl border p-3.5 sm:p-4 space-y-2.5 ${
            isCompleted
              ? 'border-emerald-200 bg-emerald-50/70'
              : 'border-sky-200/90 bg-sky-50/60'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4.5 h-4.5" />
                ) : (
                  <Clock className="w-4.5 h-4.5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight">
                  {isCompleted ? 'เวลาซ่อมเสร็จสิ้น' : 'เวลาที่คาดว่าจะเสร็จ'}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-600 mt-0.5 break-words">
                  {isCompleted ? (
                    <>
                      ซ่อมเสร็จเรียบร้อย
                      <span aria-hidden="true"> · </span>
                      เฉลี่ย {avgRepairMinutes} นาที/คัน
                      {hasHistoricalAvg ? ` (จาก ${completedDurations.length} งาน)` : ''}
                    </>
                  ) : (
                    <>
                      {queueAhead === 0
                        ? `คิวที่เหลือ ${remainingQueueCount} คัน (ถึงคิวของคุณแล้ว)`
                        : `คิวที่เหลือ ${remainingQueueCount} คัน (รออีก ${queueAhead} คิว)`}
                      <span aria-hidden="true"> · </span>
                      เฉลี่ย {avgRepairMinutes} นาที/คัน
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="sm:text-right shrink-0 sm:pl-3 sm:border-l border-sky-200/70 flex sm:block items-baseline justify-between gap-2">
              <p
                className={`text-base sm:text-lg font-bold font-mono-tabular whitespace-nowrap ${
                  isCompleted ? 'text-emerald-700' : 'text-sky-800'
                }`}
              >
                {isCompleted
                  ? 'เสร็จแล้ว'
                  : formatEstimatedFinishTime(nowMs, estimatedMinutes)}
              </p>
              <p className="text-[11px] text-slate-500 font-mono-tabular whitespace-nowrap">
                {isCompleted
                  ? formatThaiDateTime(ticket.updatedAt)
                  : `อีกประมาณ ${formatDurationThai(estimatedMinutes)}`}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="h-1.5 w-full rounded-full bg-white/80 border border-slate-200/60 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isCompleted ? 'bg-emerald-500' : 'bg-sky-600'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Technician Contact & Call Out Box (Requirement 2) */}
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
              <User className="w-3.5 h-3.5 text-emerald-700" />
              ช่างผู้ดูแล: ช่าง{shopInfo.technicianName} ({shopInfo.branchName})
            </div>
            <p className="text-sm font-mono-tabular font-bold text-slate-900">
              เบอร์ช่าง: {shopInfo.technicianPhone || '-'}
            </p>
            <p className="text-[11px] text-emerald-800">
              หากยังไม่มีการแจ้งกลับ สามารถกดโทรติดต่อช่างได้ทันที
            </p>
          </div>
          {cleanTechPhone && (
            <a
              href={`tel:${cleanTechPhone}`}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 shadow-sm shrink-0 whitespace-nowrap"
            >
              <PhoneCall className="w-4 h-4" />
              โทรออกติดต่อช่าง
            </a>
          )}
        </div>

        {/* Technician Real-time Note */}
        {(ticket.technicianNote || ticket.estimatedCost) && (
          <div className="mt-3 rounded-2xl bg-sky-50/70 border border-sky-200/80 p-4 space-y-1.5">
            <p className="text-xs font-semibold text-sky-900">ข้อความอัปเดตจากช่าง</p>
            {ticket.technicianNote && (
              <p className="text-sm text-slate-800">{ticket.technicianNote}</p>
            )}
            {ticket.estimatedCost && (
              <p className="text-xs font-medium text-sky-800 font-mono-tabular">
                ค่าซ่อมประเมิน: {ticket.estimatedCost} บาท
              </p>
            )}
          </div>
        )}
      </section>

      {/* Ticket Details + Timeline */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-xs text-slate-500 block">ผู้แจ้งซ่อม</span>
            <span className="font-semibold text-slate-900">{ticket.customerName}</span>
          </div>
          <div>
            <span className="text-xs text-slate-500 block">เบอร์โทรศัพท์ลูกค้า</span>
            <span className="font-mono-tabular font-medium text-slate-900 inline-flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              {ticket.phone}
            </span>
          </div>
          <div className="sm:col-span-2">
            <span className="text-xs text-slate-500 block">อาการที่แจ้ง</span>
            <span className="text-slate-800">{ticket.issue}</span>
          </div>
          <div className="sm:col-span-2 flex items-center justify-between gap-2 pt-1">
            <div className="min-w-0">
              <span className="text-xs text-slate-500 block">พิกัดปักหมุด</span>
              <span className="text-xs text-slate-700 inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span className="truncate">
                  {ticket.location.addressNote || 'จุดปักหมุดแผนที่'} ({ticket.location.lat},{' '}
                  {ticket.location.lng})
                </span>
              </span>
            </div>
            <a
              href={`https://maps.google.com/?q=${ticket.location.lat},${ticket.location.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-sky-700 hover:bg-sky-50 inline-flex items-center gap-1 shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              แผนที่
            </a>
          </div>
        </div>

        {/* History Timeline */}
        <div className="pt-3 border-t border-slate-100">
          <h3 className="text-xs font-semibold text-slate-700 mb-2.5">ประวัติการอัปเดตสถานะ</h3>
          <ol className="space-y-2">
            {[...ticket.statusHistory].reverse().map((entry, i) => (
              <li
                key={`${entry.status}-${entry.timestamp}-${i}`}
                className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-slate-50 last:border-none"
              >
                <span className="text-slate-800 font-medium">{entry.note || entry.status}</span>
                <span className="text-slate-400 font-mono-tabular shrink-0">
                  {formatThaiDateTime(entry.timestamp)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pb-6">
        <RippleButton
          rippleTone="light"
          onClick={onNewRequest}
          className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold hover:bg-sky-700 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          แจ้งซ่อมรถคันอื่นเพิ่มเติม
        </RippleButton>
        <RippleButton
          onClick={onBackHome}
          className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          กลับหน้าปุ่มแจ้งซ่อมหลัก
        </RippleButton>
      </div>
    </div>
  );
}
