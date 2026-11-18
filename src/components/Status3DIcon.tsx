import { Check, Clock, Navigation, UserCheck, Wrench } from 'lucide-react';
import type { RepairStatus } from '../types/repair';
import { RippleLayer, useInkRipple } from './InkRipple';

interface Status3DIconProps {
  status: RepairStatus;
  active?: boolean;
  completed?: boolean;
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onClick?: () => void;
  label?: string;
}

const STATUS_STYLES: Record<
  RepairStatus,
  {
    gradient: string;
    shadow: string;
    ring: string;
    rim: string;
  }
> = {
  pending: {
    gradient: 'radial-gradient(circle at 30% 25%, #fde047 0%, #eab308 55%, #a16207 100%)',
    shadow: '0 8px 18px -4px rgba(234, 179, 8, 0.55), 0 3px 0 0 #854d0e',
    ring: 'ring-amber-300',
    rim: 'text-amber-950',
  },
  accepted: {
    gradient: 'radial-gradient(circle at 30% 25%, #7dd3fc 0%, #0ea5e9 55%, #0369a1 100%)',
    shadow: '0 8px 18px -4px rgba(14, 165, 233, 0.55), 0 3px 0 0 #075985',
    ring: 'ring-sky-300',
    rim: 'text-white',
  },
  inspecting: {
    gradient: 'radial-gradient(circle at 30% 25%, #a5b4fc 0%, #4f46e5 55%, #312e81 100%)',
    shadow: '0 8px 18px -4px rgba(79, 70, 229, 0.5), 0 3px 0 0 #312e81',
    ring: 'ring-indigo-300',
    rim: 'text-white',
  },
  repairing: {
    gradient: 'radial-gradient(circle at 30% 25%, #fdba74 0%, #f97316 55%, #9a3412 100%)',
    shadow: '0 8px 18px -4px rgba(249, 115, 22, 0.55), 0 3px 0 0 #9a3412',
    ring: 'ring-orange-300',
    rim: 'text-white',
  },
  completed: {
    gradient: 'radial-gradient(circle at 30% 25%, #6ee7b7 0%, #10b981 55%, #047857 100%)',
    shadow: '0 8px 18px -4px rgba(16, 185, 129, 0.55), 0 3px 0 0 #065f46',
    ring: 'ring-emerald-300',
    rim: 'text-white',
  },
};

function renderGlyph(status: RepairStatus, iconSize: string) {
  switch (status) {
    case 'pending':
      return <Clock className={iconSize} strokeWidth={2.4} />;
    case 'accepted':
      return <UserCheck className={iconSize} strokeWidth={2.4} />;
    case 'inspecting':
      return <Navigation className={iconSize} strokeWidth={2.4} />;
    case 'repairing':
      return <Wrench className={iconSize} strokeWidth={2.4} />;
    case 'completed':
      return <Check className={iconSize} strokeWidth={2.8} />;
  }
}

export function Status3DIcon({
  status,
  active = false,
  completed = false,
  size = 'md',
  interactive = false,
  onClick,
  label,
}: Status3DIconProps) {
  const { ripples, isPressed, triggerRipple, releaseRipple } = useInkRipple();
  const style = STATUS_STYLES[status];
  const isLit = active || completed;

  const sizeClass =
    size === 'lg'
      ? 'w-20 h-20 sm:w-24 sm:h-24'
      : size === 'sm'
        ? 'w-10 h-10 sm:w-11 sm:h-11'
        : 'w-12 h-12 sm:w-14 sm:h-14';

  const iconClass =
    size === 'lg' ? 'w-9 h-9 sm:w-10 sm:h-10' : size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  const sphereStyle = isLit
    ? {
        background: style.gradient,
        boxShadow: `${style.shadow}, inset 0 3px 7px rgba(255,255,255,0.55), inset 0 -5px 9px rgba(15,23,42,0.28)`,
      }
    : {
        background: 'radial-gradient(circle at 32% 28%, #f8fafc 0%, #e2e8f0 68%, #cbd5e1 100%)',
        boxShadow:
          '0 4px 10px -2px rgba(15, 23, 42, 0.12), 0 2px 0 0 #94a3b8, inset 0 2px 4px rgba(255,255,255,0.9)',
      };

  const innerContent = (
    <span
      className={`status-orb-3d relative overflow-hidden flex items-center justify-center rounded-full select-none ${sizeClass} ${
        isLit ? style.rim : 'text-slate-500'
      } ${active ? `ring-4 ${style.ring} ring-offset-2 ring-offset-white` : ''} ${
        interactive ? 'cursor-pointer hover:-translate-y-0.5' : ''
      }`}
      style={sphereStyle}
    >
      {/* Specular glossy rim */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1 left-1/4 right-1/4 h-1.5 rounded-full bg-white/45 blur-[0.5px]"
      />
      {renderGlyph(status, iconClass)}
      {interactive && <RippleLayer ripples={ripples} tone={isLit ? 'light' : 'brand'} />}
    </span>
  );

  if (interactive && onClick) {
    return (
      <button
        type="button"
        data-pressed={isPressed ? 'true' : undefined}
        onPointerDown={triggerRipple}
        onPointerUp={releaseRipple}
        onPointerLeave={releaseRipple}
        onPointerCancel={releaseRipple}
        onClick={onClick}
        aria-label={label || status}
        aria-pressed={active}
        className="group min-w-0 w-full flex flex-col items-center gap-1.5 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-xl p-0.5 sm:p-1"
      >
        {innerContent}
        {label && (
          <span
            className={`text-[10px] sm:text-[11px] leading-tight text-center break-words w-full ${
              active ? 'font-semibold text-slate-900' : 'font-medium text-slate-500 group-hover:text-slate-800'
            }`}
          >
            {label}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="min-w-0 flex flex-col items-center gap-1.5">
      {innerContent}
      {label && (
        <span
          className={`text-[10px] sm:text-[11px] leading-tight text-center break-words w-full ${
            active ? 'font-semibold text-slate-900' : completed ? 'font-medium text-slate-700' : 'text-slate-400'
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
