import { Bike, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { VEHICLE_OPTIONS, type VehicleOption } from '../constants/vehicles';

interface VehicleSelectorModalProps {
  onSelect: (vehicle: VehicleOption) => void;
  onClose: () => void;
}

function VehicleThumb({ vehicle }: { vehicle: VehicleOption }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="w-full aspect-square max-w-[52px] sm:max-w-[88px] mx-auto rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
        <Bike className="w-6 h-6 sm:w-7 sm:h-7" />
      </div>
    );
  }

  return (
    <div className="w-full aspect-square max-w-[52px] sm:max-w-[88px] mx-auto rounded-xl bg-white overflow-hidden flex items-center justify-center p-0.5 sm:p-1">
      <img
        src={vehicle.imageUrl}
        alt={vehicle.label}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-contain select-none transition-transform duration-150 group-hover:scale-105"
      />
    </div>
  );
}

export function VehicleSelectorModal({ onSelect, onClose }: VehicleSelectorModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vehicle-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="w-full sm:max-w-xl max-h-[88dvh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200"
      >
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5" />

        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 pt-3.5 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <h2
              id="vehicle-modal-title"
              className="text-sm sm:text-lg font-semibold text-slate-900 truncate"
            >
              เลือกชนิดรถไฟฟ้าที่ต้องการซ่อม
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              แตะเลือกรูปรถด้านล่างเพื่อกรอกอาการและปักหมุด
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Horizontal 4-column row strictly contained within narrow mobile viewports */}
        <div className="px-2.5 py-3.5 sm:p-6">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-3 w-full">
            {VEHICLE_OPTIONS.map((vehicle) => (
              <button
                key={vehicle.id}
                type="button"
                onClick={() => onSelect(vehicle)}
                className="group min-w-0 w-full overflow-hidden flex flex-col items-center justify-between rounded-xl sm:rounded-2xl border border-slate-200 bg-white hover:border-sky-400 hover:bg-sky-50/40 active:scale-[0.97] px-1 py-2 sm:p-3 transition-all shadow-sm hover:shadow-md min-h-[96px] sm:min-h-[140px] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <VehicleThumb vehicle={vehicle} />
                <span className="mt-1.5 w-full text-[10px] sm:text-xs font-semibold text-slate-800 text-center leading-tight break-words">
                  {vehicle.shortLabel}
                </span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
