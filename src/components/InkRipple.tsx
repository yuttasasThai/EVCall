import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type PointerEvent,
} from 'react';

export interface RippleItem {
  id: number;
  x: number;
  y: number;
  size: number;
}

const MIN_PRESS_MS = 130;

export function useInkRipple() {
  const [ripples, setRipples] = useState<RippleItem[]>([]);
  const [isPressed, setIsPressed] = useState(false);
  const nextIdRef = useRef(1);
  const timersRef = useRef<number[]>([]);
  const pressReleaseTimerRef = useRef<number | null>(null);
  const pressStartAtRef = useRef(0);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      if (pressReleaseTimerRef.current !== null) {
        window.clearTimeout(pressReleaseTimerRef.current);
      }
    };
  }, []);

  const triggerRipple = useCallback((e: PointerEvent<HTMLElement>) => {
    if (pressReleaseTimerRef.current !== null) {
      window.clearTimeout(pressReleaseTimerRef.current);
      pressReleaseTimerRef.current = null;
    }
    pressStartAtRef.current = Date.now();
    setIsPressed(true);

    // Safety auto-release in case pointerup fires outside window
    pressReleaseTimerRef.current = window.setTimeout(() => {
      setIsPressed(false);
      pressReleaseTimerRef.current = null;
    }, 320);

    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width && !rect.height) return;

    const hasPointerPos = e.clientX !== 0 || e.clientY !== 0;
    const x = hasPointerPos ? e.clientX - rect.left : rect.width / 2;
    const y = hasPointerPos ? e.clientY - rect.top : rect.height / 2;
    const size = Math.max(rect.width, rect.height) * 2.3;
    const id = nextIdRef.current++;

    setRipples((prev) => [...prev.slice(-4), { id, x, y, size }]);

    const timer = window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 560);
    timersRef.current.push(timer);
  }, []);

  const releaseRipple = useCallback(() => {
    if (pressReleaseTimerRef.current !== null) {
      window.clearTimeout(pressReleaseTimerRef.current);
      pressReleaseTimerRef.current = null;
    }
    const elapsed = Date.now() - pressStartAtRef.current;
    const remaining = Math.max(0, MIN_PRESS_MS - elapsed);
    if (remaining === 0) {
      setIsPressed(false);
    } else {
      pressReleaseTimerRef.current = window.setTimeout(() => {
        setIsPressed(false);
        pressReleaseTimerRef.current = null;
      }, remaining);
    }
  }, []);

  return { ripples, isPressed, triggerRipple, releaseRipple };
}

interface RippleLayerProps {
  ripples: RippleItem[];
  tone?: 'light' | 'brand';
}

export function RippleLayer({ ripples, tone = 'light' }: RippleLayerProps) {
  if (ripples.length === 0) return null;

  const colorClass = tone === 'light' ? 'bg-white/45' : 'bg-sky-500/25';

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] z-20"
    >
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className={`ink-ripple-wave ${colorClass}`}
          style={{
            width: `${ripple.size}px`,
            height: `${ripple.size}px`,
            left: `${ripple.x - ripple.size / 2}px`,
            top: `${ripple.y - ripple.size / 2}px`,
          }}
        />
      ))}
    </span>
  );
}

interface RippleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  rippleTone?: 'light' | 'brand';
}

export const RippleButton = forwardRef<HTMLButtonElement, RippleButtonProps>(function RippleButton(
  {
    rippleTone = 'brand',
    className = '',
    children,
    onPointerDown,
    onPointerUp,
    onPointerLeave,
    onPointerCancel,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  const { ripples, isPressed, triggerRipple, releaseRipple } = useInkRipple();

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      data-pressed={isPressed && !disabled ? 'true' : undefined}
      onPointerDown={(e) => {
        if (!disabled) {
          triggerRipple(e);
        }
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        releaseRipple();
        onPointerUp?.(e);
      }}
      onPointerLeave={(e) => {
        releaseRipple();
        onPointerLeave?.(e);
      }}
      onPointerCancel={(e) => {
        releaseRipple();
        onPointerCancel?.(e);
      }}
      className={`ripple-btn-press relative overflow-hidden ${className}`}
      {...rest}
    >
      {children}
      <RippleLayer ripples={ripples} tone={rippleTone} />
    </button>
  );
});
