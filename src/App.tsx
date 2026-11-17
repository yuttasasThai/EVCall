import {
  AlertTriangle,
  ShieldCheck,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActiveTicketStatus } from './components/ActiveTicketStatus';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthGateModal } from './components/AuthGateModal';
import { BootScreen } from './components/BootScreen';
import { RepairDetailsModal } from './components/RepairDetailsModal';
import { VehicleSelectorModal } from './components/VehicleSelectorModal';
import type { VehicleOption } from './constants/vehicles';
import { APP_NAME, APP_VERSION } from './constants/version';
import { useRepairSocket } from './hooks/useRepairSocket';
import type { CreateRepairPayload, RepairTicket } from './types/repair';
import { playAlertChime, triggerChromeNotification } from './utils/notifications';
import {
  preloadVoices,
  setVoiceEnabled,
  speakThai,
  stopSpeaking,
  unlockSpeechAudio,
} from './utils/voice';

const ACTIVE_TICKET_STORAGE_KEY = 'ev_care_active_ticket_id';

function getInitialBranchCode(): string {
  if (typeof window === 'undefined') return 'main';
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('branch');
  return raw && raw.trim() ? raw.trim() : 'main';
}

export default function App() {
  const [branchCode] = useState<string>(() => getInitialBranchCode());
  const isBranchMode = branchCode !== 'main';

  const [viewMode, setViewMode] = useState<'customer' | 'technician' | 'admin'>('customer');
  const [authModalMode, setAuthModalMode] = useState<'technician' | 'admin' | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [techToken, setTechToken] = useState<string | null>(null);

  const [activeTicketId, setActiveTicketId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem(`${ACTIVE_TICKET_STORAGE_KEY}_${getInitialBranchCode()}`);
    }
    return null;
  });

  const [showStatusScreen, setShowStatusScreen] = useState<boolean>(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState<boolean>(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption | null>(null);
  const [incomingAlert, setIncomingAlert] = useState<RepairTicket | null>(null);
  const [voiceOn, setVoiceOn] = useState<boolean>(true);
  const [bootDone, setBootDone] = useState<boolean>(false);

  const arrivalVoiceCountRef = useRef(0);
  const handleBootComplete = useCallback(() => setBootDone(true), []);

  useEffect(() => {
    preloadVoices();
  }, []);

  const handleRepairCreated = useCallback(
    (repair: RepairTicket) => {
      const matchesTechBranch =
        viewMode === 'technician' && (repair.branchCode || 'main') === branchCode;
      if (viewMode === 'admin' || matchesTechBranch) {
        setIncomingAlert(repair);
        playAlertChime();
        triggerChromeNotification(
          `แจ้งซ่อมใหม่: ${repair.vehicleLabel}`,
          `${repair.customerName} (${repair.phone}) · ${repair.issue}`,
          repair.id,
        );
      }
    },
    [branchCode, viewMode],
  );

  const {
    repairs,
    shopInfo,
    setShopInfo,
    isLoading,
    isConnected,
    createRepair,
    updateRepair,
    deleteRepair,
  } = useRepairSocket({
    branchCode,
    onRepairCreated: handleRepairCreated,
  });

  const activeTicket = repairs.find((r) => r.id === activeTicketId) ?? null;

  useEffect(() => {
    if (activeTicketId && repairs.length > 0 && !activeTicket) {
      window.localStorage.removeItem(`${ACTIVE_TICKET_STORAGE_KEY}_${branchCode}`);
      setActiveTicketId(null);
      setShowStatusScreen(false);
    }
  }, [activeTicketId, branchCode, repairs.length, activeTicket]);

  // 1.1 Arrival voice prompt after boot screen finishes: "กรุณากดปุ่ม เพื่อแจ้งซ่อม" (1-2 times max)
  useEffect(() => {
    if (
      !bootDone ||
      !voiceOn ||
      viewMode !== 'customer' ||
      showStatusScreen ||
      vehicleModalOpen ||
      selectedVehicle ||
      shopInfo.isExpired ||
      shopInfo.isNotFound
    ) {
      return;
    }
    if (arrivalVoiceCountRef.current >= 2) {
      return;
    }

    let cancelled = false;
    let reminderTimer: number | null = null;
    let gestureAttached = false;

    const detachGestureFallback = () => {
      if (!gestureAttached) return;
      gestureAttached = false;
      window.removeEventListener('click', handleFirstGesture, true);
    };

    const handleFirstGesture = (e: MouseEvent) => {
      detachGestureFallback();
      if (cancelled || arrivalVoiceCountRef.current >= 2) return;
      const target = e.target as HTMLElement | null;
      if (
        target?.closest('button[aria-label="แจ้งซ่อมงาน"]') ||
        target?.closest('button[data-voice-toggle="true"]')
      ) {
        return;
      }
      if (arrivalVoiceCountRef.current === 0) {
        unlockSpeechAudio();
        speakArrival();
      }
    };

    const attachGestureFallback = () => {
      if (gestureAttached || cancelled) return;
      gestureAttached = true;
      window.addEventListener('click', handleFirstGesture, { once: true, capture: true });
    };

    const speakArrival = () => {
      if (cancelled || arrivalVoiceCountRef.current >= 2) return;
      speakThai('กรุณากดปุ่ม เพื่อแจ้งซ่อม', {
        onStart: () => {
          if (cancelled) return;
          detachGestureFallback();
          arrivalVoiceCountRef.current += 1;
          if (arrivalVoiceCountRef.current === 1 && reminderTimer === null) {
            reminderTimer = window.setTimeout(() => {
              if (!cancelled && arrivalVoiceCountRef.current < 2) {
                speakArrival();
              }
            }, 5200);
          }
        },
        onBlocked: () => {
          if (cancelled) return;
          attachGestureFallback();
        },
      });
    };

    // Attempt automatic playback immediately when boot finishes
    speakArrival();

    return () => {
      cancelled = true;
      if (reminderTimer !== null) {
        window.clearTimeout(reminderTimer);
      }
      detachGestureFallback();
    };
  }, [
    bootDone,
    voiceOn,
    viewMode,
    showStatusScreen,
    vehicleModalOpen,
    selectedVehicle,
    shopInfo.isExpired,
    shopInfo.isNotFound,
  ]);

  const handleToggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    setVoiceEnabled(next);
    if (next) {
      unlockSpeechAudio();
      if (
        viewMode === 'customer' &&
        !showStatusScreen &&
        !vehicleModalOpen &&
        !selectedVehicle &&
        arrivalVoiceCountRef.current === 0
      ) {
        speakThai('กรุณากดปุ่ม เพื่อแจ้งซ่อม', {
          onStart: () => {
            arrivalVoiceCountRef.current = 1;
          },
        });
      }
    }
  };

  // 1.2 Open Vehicle Selector -> speak prompt
  const handleOpenVehicleModal = () => {
    arrivalVoiceCountRef.current = 2; // Stop arrival reminders once user interacts
    unlockSpeechAudio();
    setVehicleModalOpen(true);
    speakThai('กรุณาเลือกชนิดรถที่จะแจ้ง');
  };

  // 1.2 & 1.3 Select Vehicle -> speak chosen vehicle + details instruction
  const handleSelectVehicle = (vehicle: VehicleOption) => {
    setSelectedVehicle(vehicle);
    speakThai(`ท่านได้เลือก รถ${vehicle.label}`);
    speakThai('โปรดกรอกรายละเอียด เสร็จแล้ว กดปุ่มแจ้งซ่อมที่ด้านล่าง', { queue: true });
  };

  // 1.4 Submit Repair -> speak technician thank-you message
  const handleCreateRepairSubmit = async (payload: CreateRepairPayload) => {
    const created = await createRepair(payload);
    window.localStorage.setItem(`${ACTIVE_TICKET_STORAGE_KEY}_${branchCode}`, created.id);
    setActiveTicketId(created.id);
    setSelectedVehicle(null);
    setVehicleModalOpen(false);
    setShowStatusScreen(true);

    const techName = shopInfo.technicianName || 'สมชาย';
    speakThai(`ช่าง${techName} ขอบคุณคับ จะรีบติดต่อกลับโดยเร็ว`);
  };

  const handleOpenTechnician = () => {
    stopSpeaking();
    if (techToken) {
      setViewMode('technician');
    } else {
      setAuthModalMode('technician');
    }
  };

  const handleOpenAdmin = () => {
    if (isBranchMode) return;
    stopSpeaking();
    if (adminToken) {
      setViewMode('admin');
    } else {
      setAuthModalMode('admin');
    }
  };

  // Expired / Invalid Branch Screen (after boot animation completes)
  if (bootDone && isBranchMode && (shopInfo.isExpired || shopInfo.isNotFound)) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#F6F8FB] px-6 text-center">
        <div className="max-w-md w-full bg-white rounded-3xl border border-rose-200 shadow-lg p-7 space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            {shopInfo.isNotFound ? 'ไม่พบลิงก์สาขานี้' : 'ลิงก์สาขาหมดอายุการใช้งาน'}
          </h1>
          <p className="text-sm text-slate-600">
            {shopInfo.isNotFound
              ? 'กรุณาตรวจสอบลิงก์สาขากับผู้ดูแลระบบ (Admin) อีกครั้ง'
              : `ลิงก์สำหรับ "${shopInfo.branchName}" (${shopInfo.branchCode}) หมดอายุแล้ว กรุณาติดต่อ Admin เพื่อต่ออายุลิงก์`}
          </p>
          <p className="text-xs text-slate-400 font-mono-tabular">{APP_VERSION}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-[#F6F8FB] text-slate-900">
      <AnimatePresence>
        {!bootDone && <BootScreen onComplete={handleBootComplete} />}
      </AnimatePresence>
      {/* Clean Single-Row Header */}
      <header className="sticky top-0 z-30 h-14 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-2.5 sm:px-6 flex items-center justify-between gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => {
            setViewMode('customer');
            setShowStatusScreen(false);
          }}
          className="min-w-0 shrink-0 text-sm sm:text-lg font-bold tracking-tight text-slate-900 flex items-center gap-1.5 sm:gap-2"
        >
          <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-sky-500 to-blue-700 text-white flex items-center justify-center shadow-sm shrink-0">
            <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-amber-300 text-amber-300" />
          </span>
          <span className="truncate max-w-[96px] sm:max-w-none whitespace-nowrap">
            {isBranchMode ? shopInfo.branchName : APP_NAME}
          </span>
        </button>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {viewMode === 'customer' && activeTicket && !showStatusScreen && (
            <button
              type="button"
              onClick={() => setShowStatusScreen(true)}
              className="px-2 sm:px-3 py-1.5 min-h-[36px] rounded-lg bg-sky-50 text-sky-700 border border-sky-200 text-[11px] sm:text-xs font-semibold hover:bg-sky-100 transition-colors whitespace-nowrap"
            >
              สถานะ<span className="hidden sm:inline"> {activeTicket.code}</span>
            </button>
          )}

          <button
            type="button"
            data-voice-toggle="true"
            onClick={handleToggleVoice}
            aria-label={voiceOn ? 'ปิดเสียงพูด' : 'เปิดเสียงพูด'}
            title={voiceOn ? 'เสียงแนะนำเปิดอยู่' : 'เสียงแนะนำปิดอยู่'}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            {voiceOn ? <Volume2 className="w-4 h-4 text-sky-600" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => {
              if (viewMode === 'technician') {
                setViewMode('customer');
              } else {
                handleOpenTechnician();
              }
            }}
            className={`px-2 sm:px-3 py-1.5 min-h-[36px] rounded-lg text-[11px] sm:text-xs font-semibold transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
              viewMode === 'technician'
                ? 'bg-sky-600 text-white hover:bg-sky-700'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            {viewMode === 'technician' ? 'หน้าลูกค้า' : 'สำหรับช่าง'}
          </button>

          {/* Admin button is strictly hidden on Branch Links */}
          {!isBranchMode && (
            <button
              type="button"
              onClick={() => {
                if (viewMode === 'admin') {
                  setViewMode('customer');
                } else {
                  handleOpenAdmin();
                }
              }}
              className={`px-2 sm:px-3 py-1.5 min-h-[36px] rounded-lg text-[11px] sm:text-xs font-semibold transition-colors inline-flex items-center gap-1 whitespace-nowrap ${
                viewMode === 'admin'
                  ? 'bg-slate-900 text-white hover:bg-slate-800'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {viewMode === 'admin' ? 'หน้าลูกค้า' : 'Admin'}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {viewMode === 'admin' && adminToken && !isBranchMode ? (
          <AdminDashboard
            role="admin"
            adminToken={adminToken}
            techToken={techToken}
            shopInfo={shopInfo}
            repairs={repairs}
            isLoading={isLoading}
            isConnected={isConnected}
            incomingAlert={incomingAlert}
            onDismissAlert={() => setIncomingAlert(null)}
            onShopInfoUpdated={setShopInfo}
            onUpdateRepair={updateRepair}
            onDeleteRepair={deleteRepair}
            onLogout={() => {
              setAdminToken(null);
              setViewMode('customer');
            }}
          />
        ) : viewMode === 'technician' && techToken ? (
          <AdminDashboard
            role="technician"
            adminToken={null}
            techToken={techToken}
            shopInfo={shopInfo}
            repairs={repairs}
            isLoading={isLoading}
            isConnected={isConnected}
            incomingAlert={incomingAlert}
            onDismissAlert={() => setIncomingAlert(null)}
            onShopInfoUpdated={setShopInfo}
            onUpdateRepair={updateRepair}
            onDeleteRepair={deleteRepair}
            onLogout={() => {
              setTechToken(null);
              setViewMode('customer');
            }}
          />
        ) : showStatusScreen && activeTicket ? (
          <ActiveTicketStatus
            ticket={activeTicket}
            shopInfo={shopInfo}
            isConnected={isConnected}
            onNewRequest={handleOpenVehicleModal}
            onBackHome={() => setShowStatusScreen(false)}
          />
        ) : (
          /* Customer Home: ONLY ONE 3D Circular Repair Button + Version Footer */
          <div className="flex-1 flex flex-col items-center justify-between px-4 sm:px-6 py-5 sm:py-8 text-center">
            <div />

            <div className="flex flex-col items-center w-full max-w-lg">
              <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight text-balance">
                แจ้งซ่อมรถไฟฟ้าออนไลน์
              </h1>

              <div className="my-6 sm:my-9">
                <div className="btn-3d-outer p-3 sm:p-4 rounded-full inline-flex items-center justify-center">
                  <button
                    type="button"
                    onClick={handleOpenVehicleModal}
                    aria-label="แจ้งซ่อมงาน"
                    className="btn-3d-core relative w-44 h-44 sm:w-56 sm:h-56 rounded-full flex flex-col items-center justify-center text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 rounded-full bg-white/30 blur-[2px]"
                    />

                    <div className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/15 border border-white/30 shadow-inner mb-2 sm:mb-2.5">
                      <Wrench className="w-8 h-8 sm:w-10 sm:h-10 text-white drop-shadow" strokeWidth={2.2} />
                      <Zap
                        className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 fill-amber-300 absolute -right-1 -bottom-1 drop-shadow"
                        strokeWidth={2}
                      />
                    </div>

                    <span className="text-xl sm:text-2xl font-bold tracking-tight drop-shadow-sm">
                      แจ้งซ่อมงาน
                    </span>
                    <span className="text-[11px] sm:text-xs text-sky-100 font-medium mt-0.5">
                      แตะเพื่อเริ่มต้น
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Program Version displayed cleanly on Main Screen */}
            <footer className="text-[11px] sm:text-xs text-slate-400 font-mono-tabular break-words">
              {APP_NAME} · {shopInfo.branchName} · เวอร์ชัน {APP_VERSION}
            </footer>
          </div>
        )}
      </main>

      {/* Popup 1: Horizontal Vehicle Type Selector */}
      <AnimatePresence>
        {vehicleModalOpen && !selectedVehicle && (
          <VehicleSelectorModal
            onSelect={handleSelectVehicle}
            onClose={() => setVehicleModalOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Popup 2: Repair Details + Pin + Yellow/Blue Electric Cable Button */}
      <AnimatePresence>
        {selectedVehicle && (
          <RepairDetailsModal
            vehicle={selectedVehicle}
            onBack={() => setSelectedVehicle(null)}
            onClose={() => {
              setSelectedVehicle(null);
              setVehicleModalOpen(false);
            }}
            onSubmit={handleCreateRepairSubmit}
          />
        )}
      </AnimatePresence>

      {/* Login Gate Modal for Technician or Admin */}
      <AnimatePresence>
        {authModalMode && (
          <AuthGateModal
            mode={authModalMode}
            branchCode={branchCode}
            branchName={shopInfo.branchName}
            onSuccessAdmin={(token) => {
              setAdminToken(token);
              setAuthModalMode(null);
              setViewMode('admin');
            }}
            onSuccessTechnician={(token, updatedShop) => {
              setTechToken(token);
              setShopInfo(updatedShop);
              setAuthModalMode(null);
              setViewMode('technician');
            }}
            onClose={() => setAuthModalMode(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
