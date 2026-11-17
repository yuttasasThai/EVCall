import { Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { APP_NAME, APP_VERSION } from '../constants/version';
import { preloadVoices, unlockSpeechAudio } from '../utils/voice';

interface BootScreenProps {
  onComplete: () => void;
}

const CREDIT_TEXT = 'สร้างสรรค์โดย ช่างหน่อยชุมแพ';
const CHAR_INTERVAL_MS = 55;
const HOLD_AFTER_TYPING_MS = 950;

export function BootScreen({ onComplete }: BootScreenProps) {
  const [typedCount, setTypedCount] = useState(0);
  const [exiting, setExiting] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    preloadVoices();
  }, []);

  useEffect(() => {
    const chars = Array.from(CREDIT_TEXT);
    if (typedCount < chars.length) {
      const t = window.setTimeout(() => {
        setTypedCount((c) => c + 1);
      }, CHAR_INTERVAL_MS);
      return () => window.clearTimeout(t);
    }

    let fadeTimer = 0;
    const doneTimer = window.setTimeout(() => {
      setExiting(true);
      fadeTimer = window.setTimeout(() => {
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete();
        }
      }, 220);
    }, HOLD_AFTER_TYPING_MS);

    return () => {
      window.clearTimeout(doneTimer);
      if (fadeTimer) window.clearTimeout(fadeTimer);
    };
  }, [typedCount, onComplete]);

  const chars = Array.from(CREDIT_TEXT);
  const visibleText = chars.slice(0, typedCount).join('');
  const progressPct = Math.round((typedCount / chars.length) * 100);

  // Tapping anywhere on the boot screen unlocks Chrome Web Speech audio early
  const handleWarmAudio = () => {
    unlockSpeechAudio();
  };

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.22 }}
      onClick={handleWarmAudio}
      onTouchEnd={handleWarmAudio}
      onPointerDown={handleWarmAudio}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#F6F8FB] px-5 text-center select-none"
    >
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* 3D Electric Emblem */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="btn-3d-outer p-3 rounded-full mb-5"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-sky-400 via-sky-600 to-blue-800 flex items-center justify-center shadow-lg">
            <Zap className="w-9 h-9 text-amber-300 fill-amber-300 drop-shadow" />
          </div>
        </motion.div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{APP_NAME}</h1>
        <p className="text-xs text-slate-500 mt-1">ระบบแจ้งซ่อมรถไฟฟ้าออนไลน์</p>

        {/* Typewriter Text */}
        <div className="mt-7 min-h-[36px] flex items-center justify-center px-2">
          <p className="text-base sm:text-lg font-semibold text-sky-700 tracking-wide">
            {visibleText}
            <span
              aria-hidden="true"
              className="inline-block w-0.5 h-5 bg-sky-600 ml-1 align-middle animate-pulse"
            />
          </p>
        </div>

        {/* Sleek Boot Progress Bar */}
        <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-5">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-amber-400 transition-all duration-75"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <p className="mt-4 text-[11px] font-mono-tabular text-slate-400">
          กำลังเตรียมระบบ · {APP_VERSION}
        </p>
      </div>
    </motion.div>
  );
}
