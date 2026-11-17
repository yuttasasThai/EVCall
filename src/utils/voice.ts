let voiceEnabled = true;
let voicesPreloaded = false;
let audioCtx: AudioContext | null = null;
const activeUtterances = new Set<SpeechSynthesisUtterance>();

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (audioCtx) return audioCtx;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  try {
    audioCtx = new Ctx();
    return audioCtx;
  } catch {
    return null;
  }
}

export function setVoiceEnabled(enabled: boolean): void {
  voiceEnabled = enabled;
  if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    activeUtterances.clear();
  }
}

export function isVoiceEnabled(): boolean {
  return voiceEnabled;
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    activeUtterances.clear();
  }
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function hasUserActivation(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as unknown as { userActivation?: { hasBeenActive?: boolean } };
  if (nav.userActivation && typeof nav.userActivation.hasBeenActive === 'boolean') {
    return nav.userActivation.hasBeenActive;
  }
  return false;
}

export function preloadVoices(): void {
  if (!isSpeechSupported()) return;
  if (voicesPreloaded) return;
  voicesPreloaded = true;
  try {
    window.speechSynthesis.getVoices();
    if (typeof window.speechSynthesis.addEventListener === 'function') {
      window.speechSynthesis.addEventListener('voiceschanged', () => {
        window.speechSynthesis.getVoices();
      });
    }
  } catch {
    // ignore
  }
}

/**
 * Must be called inside a trusted user gesture (click / pointerdown / touchend)
 * so Android Chrome / iOS Safari unlocks AudioContext & Web Speech TTS.
 */
export function unlockSpeechAudio(): void {
  preloadVoices();
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume().catch(() => {});
  }

  if (!isSpeechSupported()) return;
  try {
    const synth = window.speechSynthesis;
    if (synth.paused) {
      synth.resume();
    }
    if (!synth.speaking && !synth.pending) {
      const warmup = new SpeechSynthesisUtterance(' ');
      warmup.lang = 'th-TH';
      warmup.volume = 0;
      warmup.rate = 10;
      activeUtterances.add(warmup);
      warmup.onend = () => activeUtterances.delete(warmup);
      warmup.onerror = () => activeUtterances.delete(warmup);
      synth.speak(warmup);
    }
  } catch {
    // ignore
  }
}

function getPreferredThaiVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith('th')) ||
    voices.find((v) => v.name.toLowerCase().includes('thai') || v.name.includes('ไทย')) ||
    null
  );
}

export function speakThai(
  text: string,
  options: {
    queue?: boolean;
    rate?: number;
    onStart?: () => void;
    onDone?: () => void;
    onBlocked?: (reason?: string) => void;
  } = {},
): boolean {
  if (!voiceEnabled) return false;
  if (!isSpeechSupported()) {
    options.onBlocked?.('unsupported');
    return false;
  }

  try {
    preloadVoices();
    const synth = window.speechSynthesis;

    // Only cancel when actually speaking/pending; calling cancel() unconditionally
    // on an idle Chrome/Android synthesizer can drop the next utterance.
    if (!options.queue && (synth.speaking || synth.pending)) {
      synth.cancel();
      activeUtterances.clear();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.volume = 1;
    utterance.rate = options.rate ?? 1;
    utterance.pitch = 1;

    const thaiVoice = getPreferredThaiVoice();
    if (thaiVoice) {
      utterance.voice = thaiVoice;
    }

    // Keep strong reference so Chromium GC never drops callbacks or cuts speech
    activeUtterances.add(utterance);

    let started = false;
    let settled = false;

    const blockCheckTimer = window.setTimeout(() => {
      if (!started && !settled) {
        settled = true;
        activeUtterances.delete(utterance);
        options.onBlocked?.('timeout');
      }
    }, 650);

    utterance.onstart = () => {
      started = true;
      window.clearTimeout(blockCheckTimer);
      options.onStart?.();
    };

    utterance.onend = () => {
      settled = true;
      window.clearTimeout(blockCheckTimer);
      activeUtterances.delete(utterance);
      options.onDone?.();
    };

    utterance.onerror = (event) => {
      window.clearTimeout(blockCheckTimer);
      activeUtterances.delete(utterance);
      if (!started && !settled) {
        settled = true;
        options.onBlocked?.(event?.error || 'error');
      }
    };

    synth.speak(utterance);
    if (synth.paused) {
      synth.resume();
    }
    return true;
  } catch {
    options.onBlocked?.('exception');
    return false;
  }
}
