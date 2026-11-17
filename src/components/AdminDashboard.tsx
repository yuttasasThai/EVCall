import {
  Bell,
  BellRing,
  CheckCircle2,
  ExternalLink,
  LogOut,
  MapPin,
  Phone,
  Save,
  Volume2,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { VEHICLE_OPTIONS } from '../constants/vehicles';
import {
  REPAIR_STATUS_STEPS,
  type PublicShopInfo,
  type RepairStatus,
  type RepairTicket,
} from '../types/repair';
import {
  formatThaiDateTime,
  getChromeNotificationState,
  playAlertChime,
  requestChromeNotificationPermission,
  triggerChromeNotification,
} from '../utils/notifications';
import { BranchManagerPanel } from './BranchManagerPanel';
import { ExcelHistoryTable } from './ExcelHistoryTable';
import { SourceExportPanel } from './SourceExportPanel';
import { Status3DIcon } from './Status3DIcon';
import { TechnicianSettingsPanel } from './TechnicianSettingsPanel';

interface AdminDashboardProps {
  role: 'technician' | 'admin';
  adminToken: string | null;
  techToken: string | null;
  shopInfo: PublicShopInfo;
  repairs: RepairTicket[];
  isLoading: boolean;
  isConnected: boolean;
  incomingAlert: RepairTicket | null;
  onDismissAlert: () => void;
  onShopInfoUpdated: (shop: PublicShopInfo) => void;
  onUpdateRepair: (
    id: string,
    payload: { status?: RepairStatus; technicianNote?: string; estimatedCost?: string },
    authHeaders: Record<string, string>,
  ) => Promise<RepairTicket>;
  onDeleteRepair: (id: string, authHeaders: Record<string, string>) => Promise<void>;
  onLogout: () => void;
}

export function AdminDashboard({
  role,
  adminToken,
  techToken,
  shopInfo,
  repairs,
  isLoading,
  isConnected,
  incomingAlert,
  onDismissAlert,
  onShopInfoUpdated,
  onUpdateRepair,
  onDeleteRepair,
  onLogout,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'jobs' | 'excel' | 'settings' | 'branches' | 'source'>('jobs');
  const [chromePerm, setChromePerm] = useState<NotificationPermission | 'unsupported'>(() =>
    getChromeNotificationState(),
  );
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [costDrafts, setCostDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string>('');

  const authHeaders: Record<string, string> = {};
  if (role === 'admin' && adminToken) {
    authHeaders['x-admin-token'] = adminToken;
  } else if (techToken) {
    authHeaders['x-tech-token'] = techToken;
  }

  // Technicians only see repairs for their own branch; Admin sees all branches
  const scopedRepairs =
    role === 'admin'
      ? repairs
      : repairs.filter((r) => (r.branchCode || 'main') === shopInfo.branchCode);

  const activeJobs = scopedRepairs.filter((r) => r.status !== 'completed');
  const completedCount = scopedRepairs.filter((r) => r.status === 'completed').length;

  const handleEnableChromeNotifications = async () => {
    const perm = await requestChromeNotificationPermission();
    setChromePerm(perm);
    if (perm === 'granted') {
      playAlertChime();
      triggerChromeNotification(
        'เปิดแจ้งเตือน EV Care สำเร็จ',
        'เมื่อลูกค้าแจ้งซ่อมเข้ามา ระบบจะเด้งแจ้งเตือนผ่าน Google Chrome ทันที',
      );
      setToastMsg('เปิดการแจ้งเตือนผ่าน Google Chrome เรียบร้อยแล้ว');
      window.setTimeout(() => setToastMsg(''), 3500);
    } else if (perm === 'denied') {
      setToastMsg('เบราว์เซอร์บล็อกการแจ้งเตือน กรุณาอนุญาต Notification ในตั้งค่า Chrome');
      window.setTimeout(() => setToastMsg(''), 4500);
    }
  };

  const handleTestNotification = () => {
    playAlertChime();
    const sent = triggerChromeNotification(
      'ทดสอบแจ้งเตือนซ่อมรถไฟฟ้า',
      'ระบบแจ้งเตือนผ่าน Google Chrome พร้อมทำงานแล้ว',
    );
    setToastMsg(
      sent
        ? 'ส่งการแจ้งเตือนทดสอบไปยัง Chrome แล้ว'
        : 'กรุณากดเปิดสิทธิ์แจ้งเตือน Chrome ก่อนทดสอบ',
    );
    window.setTimeout(() => setToastMsg(''), 3000);
  };

  const handleQuickStatusClick = async (ticket: RepairTicket, nextStatus: RepairStatus) => {
    setSavingId(ticket.id);
    try {
      await onUpdateRepair(
        ticket.id,
        {
          status: nextStatus,
          technicianNote: noteDrafts[ticket.id] ?? ticket.technicianNote,
          estimatedCost: costDrafts[ticket.id] ?? ticket.estimatedCost,
        },
        authHeaders,
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveDetails = async (ticket: RepairTicket) => {
    setSavingId(ticket.id);
    try {
      await onUpdateRepair(
        ticket.id,
        {
          technicianNote: noteDrafts[ticket.id] ?? ticket.technicianNote,
          estimatedCost: costDrafts[ticket.id] ?? ticket.estimatedCost,
        },
        authHeaders,
      );
      setToastMsg(`บันทึกข้อมูล ${ticket.code} เรียบร้อย`);
      window.setTimeout(() => setToastMsg(''), 2500);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-5">
      {/* Real-time Incoming Repair Popup Alert */}
      {incomingAlert && (
        <div
          role="alert"
          className="rounded-2xl border-2 border-amber-400 bg-amber-50 shadow-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-amber-400 to-sky-500 text-white flex items-center justify-center shrink-0 shadow">
              <BellRing className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                มีรายการแจ้งซ่อมใหม่เข้าด่วน · {incomingAlert.vehicleLabel} ({incomingAlert.branchName})
              </p>
              <p className="text-xs sm:text-sm text-slate-700 mt-0.5">
                คุณ{incomingAlert.customerName} ({incomingAlert.phone}) — {incomingAlert.issue}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => {
                void handleQuickStatusClick(incomingAlert, 'accepted');
                onDismissAlert();
              }}
              className="px-3.5 py-2 min-h-[40px] rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 transition-colors whitespace-nowrap"
            >
              กดรับงานทันที
            </button>
            <button
              type="button"
              onClick={onDismissAlert}
              aria-label="ปิดการแจ้งเตือน"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-amber-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Control Top Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">
            {role === 'admin'
              ? 'ศูนย์ควบคุม Admin (ผู้ดูแลระบบสูงสุด)'
              : `หน้าสำหรับช่าง · ${shopInfo.branchName}`}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
            <span>{isConnected ? 'เชื่อมต่อเรียลไทม์' : 'กำลังเชื่อมต่อใหม่...'}</span>
            <span aria-hidden="true">·</span>
            <span>ช่าง{shopInfo.technicianName}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">งานค้างดำเนินการ {activeJobs.length} งาน</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">ซ่อมเสร็จแล้ว {completedCount} งาน</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {chromePerm === 'granted' ? (
            <button
              type="button"
              onClick={handleTestNotification}
              className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-colors whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              แจ้งเตือน Chrome เปิดอยู่ · ทดสอบ
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleEnableChromeNotifications()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700 active:scale-[0.98] transition-all whitespace-nowrap"
            >
              <Bell className="w-4 h-4" />
              เปิดแจ้งเตือน Google Chrome
            </button>
          )}
          <button
            type="button"
            onClick={playAlertChime}
            aria-label="ทดสอบเสียงเตือน"
            className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            title="ทดสอบเสียงเตือน"
          >
            <Volume2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            ออกจากระบบ
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="rounded-xl bg-slate-900 text-white text-xs font-medium px-4 py-2.5 shadow">
          {toastMsg}
        </div>
      )}

      {/* Segmented Section Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl w-fit max-w-full">
        <button
          type="button"
          onClick={() => setActiveTab('jobs')}
          className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'jobs'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          อัปเดตงาน 3 มิติ ({scopedRepairs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('excel')}
          className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'excel'
              ? 'bg-white text-[#15803D] shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          ตารางลูกค้า (Excel)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
            activeTab === 'settings'
              ? 'bg-white text-sky-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {role === 'admin' ? 'ตั้งค่า Admin & ช่าง' : 'ตั้งค่าช่าง'}
        </button>
        {role === 'admin' && adminToken && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab('branches')}
              className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'branches'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              สร้างลิงก์สาขา (Admin)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('source')}
              className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap ${
                activeTab === 'source'
                  ? 'bg-white text-sky-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              โหลด Source Code
            </button>
          </>
        )}
      </div>

      {/* Tab 1: Active Job Cards with Clickable 3D Circular Status Icons */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              กำลังโหลดข้อมูลแจ้งซ่อม...
            </div>
          ) : scopedRepairs.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
              <p className="text-base font-semibold text-slate-800">ยังไม่มีรายการแจ้งซ่อมเข้ามา</p>
              <p className="text-xs sm:text-sm text-slate-500">
                เมื่อลูกค้ากดส่งแจ้งซ่อม ระบบจะเด้งเตือนทันทีและแสดงรายการที่นี่เพื่อให้ช่างกดอัปเดตสถานะ
              </p>
            </div>
          ) : (
            scopedRepairs.map((ticket) => {
              const vehicleMeta = VEHICLE_OPTIONS.find((v) => v.id === ticket.vehicleType);
              const currentStepIdx = REPAIR_STATUS_STEPS.findIndex((s) => s.id === ticket.status);
              const noteVal = noteDrafts[ticket.id] ?? ticket.technicianNote;
              const costVal = costDrafts[ticket.id] ?? ticket.estimatedCost;

              return (
                <article
                  key={ticket.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {vehicleMeta && (
                        <img
                          src={vehicleMeta.imageUrl}
                          alt={ticket.vehicleLabel}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl object-contain bg-slate-50 border border-slate-200 p-1 shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span className="font-mono-tabular font-semibold text-slate-800">
                            {ticket.code}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{ticket.vehicleLabel}</span>
                          <span aria-hidden="true">·</span>
                          <span>{ticket.branchName || 'สาขาหลัก'}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">
                            {formatThaiDateTime(ticket.createdAt)}
                          </span>
                        </div>
                        <h2 className="text-base font-bold text-slate-900 mt-0.5 truncate">
                          {ticket.customerName}
                        </h2>
                        <div className="flex flex-wrap items-center gap-3 mt-1 text-xs">
                          <a
                            href={`tel:${ticket.phone}`}
                            className="inline-flex items-center gap-1 font-mono-tabular font-semibold text-sky-700 hover:underline"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {ticket.phone}
                          </a>
                          <a
                            href={`https://maps.google.com/?q=${ticket.location.lat},${ticket.location.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-600 hover:text-sky-700 underline"
                          >
                            <MapPin className="w-3.5 h-3.5 text-rose-500" />
                            {ticket.location.addressNote || 'เปิดจุดปักหมุด'}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-slate-800 bg-slate-50 rounded-xl px-3.5 py-2.5 border border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 mr-2">อาการแจ้งซ่อม:</span>
                    {ticket.issue}
                  </div>

                  {/* Clickable 3D Circular Status Update Icons */}
                  <div className="pt-1">
                    <p className="text-xs font-semibold text-slate-600 mb-2.5">
                      แตะที่ไอคอนทรงกลม 3 มิติเพื่ออัปเดตสถานะงานให้ลูกค้าเห็นทันที:
                    </p>
                    <div className="grid grid-cols-5 gap-1 sm:gap-2">
                      {REPAIR_STATUS_STEPS.map((step, idx) => (
                        <Status3DIcon
                          key={step.id}
                          status={step.id}
                          active={ticket.status === step.id}
                          completed={idx < currentStepIdx}
                          size="sm"
                          interactive
                          label={step.shortLabel}
                          onClick={() => void handleQuickStatusClick(ticket, step.id)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={noteVal}
                      onChange={(e) =>
                        setNoteDrafts((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                      }
                      placeholder="บันทึกอาการจริง / ข้อความถึงลูกค้า..."
                      className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={costVal}
                        onChange={(e) =>
                          setCostDrafts((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                        }
                        placeholder="ค่าซ่อม (บาท)"
                        className="w-28 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm font-mono-tabular text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                      <button
                        type="button"
                        disabled={savingId === ticket.id}
                        onClick={() => void handleSaveDetails(ticket)}
                        className="h-10 px-3.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        บันทึก
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Excel History Table */}
      {activeTab === 'excel' && (
        <ExcelHistoryTable
          repairs={scopedRepairs}
          onChangeStatus={async (id, status) => {
            await onUpdateRepair(id, { status }, authHeaders);
          }}
          onDelete={async (id) => {
            await onDeleteRepair(id, authHeaders);
          }}
        />
      )}

      {/* Tab 3: Settings (Technician Settings + Admin Source Code Download) */}
      {activeTab === 'settings' && (
        <div className="space-y-5">
          <TechnicianSettingsPanel
            shopInfo={shopInfo}
            authHeaders={authHeaders}
            onUpdated={onShopInfoUpdated}
          />
          {role === 'admin' && adminToken && (
            <SourceExportPanel adminToken={adminToken} />
          )}
        </div>
      )}

      {/* Tab 4: Admin-Only Branch Link Manager */}
      {activeTab === 'branches' && role === 'admin' && adminToken && (
        <BranchManagerPanel adminToken={adminToken} />
      )}

      {/* Tab 5: Admin-Only Source Code Export */}
      {activeTab === 'source' && role === 'admin' && adminToken && (
        <SourceExportPanel adminToken={adminToken} />
      )}
    </div>
  );
}
