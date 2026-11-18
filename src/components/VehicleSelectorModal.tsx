import { Bike, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { VEHICLE_OPTIONS, type VehicleOption } from '../constants/vehicles';
import { RippleButton, RippleLayer, useInkRipple } from './InkRipple';

interface VehicleSelectorModalProps {
  onSelect: (vehicle: VehicleOption) => void;
  onClose: () => void;
}

function VehicleOrbButton({
  vehicle,
  onSelect,
}: {
  vehicle: VehicleOption;
  onSelect: (vehicle: VehicleOption) => void;
}) {
  const [failed, setFailed] = useState(false);
  const { ripples, isPressed, triggerRipple, releaseRipple } = useInkRipple();

  return (
    <button
      type="button"
      data-pressed={isPressed ? 'true' : undefined}
      onPointerDown={triggerRipple}
      onPointerUp={releaseRipple}
      onPointerLeave={releaseRipple}
      onPointerCancel={releaseRipple}
      onClick={() => onSelect(vehicle)}
      aria-label={`เลือก ${vehicle.label}`}
      className="group min-w-0 w-full flex flex-col items-center gap-2.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-2xl"
    >
      {/* Modern 3D Circular Orb with centered vehicle illustration */}
      <div className="vehicle-orb-3d relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden flex items-center justify-center">
        {/* Specular glossy highlight */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 w-14 sm:w-16 h-3.5 rounded-full bg-white/80 blur-[1px] z-10"
        />

        {failed ? (
          <div className="relative z-10 flex items-center justify-center text-slate-400">
            <Bike className="w-11 h-11" />
          </div>
        ) : (
          <img
            src={vehicle.imageUrl}
            alt={vehicle.label}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="relative z-10 w-[74%] h-[74%] object-contain select-none transition-transform duration-150 group-hover:scale-105 drop-shadow-[0_6px_10px_rgba(15,23,42,0.16)]"
          />
        )}

        <RippleLayer ripples={ripples} tone="brand" />
      </div>

      <span className="w-full text-sm sm:text-base font-semibold text-slate-800 group-hover:text-sky-700 text-center leading-snug transition-colors">
        {vehicle.shortLabel}
      </span>
    </button>
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
        className="w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200"
      >
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5" />

        <div className="flex items-center justify-between gap-2 px-4 sm:px-6 pt-3.5 pb-3 border-b border-slate-100">
          <div className="min-w-0">
            <h2
              id="vehicle-modal-title"
              className="text-base sm:text-lg font-semibold text-slate-900 truncate"
            >
              เลือกชนิดรถไฟฟ้าที่ต้องการซ่อม
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              แตะที่วงกลมรูปรถเพื่อกรอกอาการและปักหมุด
            </p>
          </div>
          <RippleButton
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </RippleButton>
        </div>

        {/* 2x2 Grid of 3D Circular Vehicle Orbs sized comfortably for mobile & desktop */}
        <div className="px-5 py-5 sm:p-7">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:gap-6 w-full max-w-sm sm:max-w-md mx-auto">
            {VEHICLE_OPTIONS.map((vehicle) => (
              <VehicleOrbButton key={vehicle.id} vehicle={vehicle} onSelect={onSelect} />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
