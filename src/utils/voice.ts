let voiceEnabled = true;
let voicesPreloaded = false;

export function setVoiceEnabled(enabled: boolean): void {
  voiceEnabled = enabled;
  if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function isVoiceEnabled(): boolean {
  return voiceEnabled;
}

export function stopSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function preloadVoices(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
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

function getPreferredThaiVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang.toLowerCase().startsWith('th')) ||
    voices.find((v) => v.name.toLowerCase().includes('thai')) ||
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
    onBlocked?: () => void;
  } = {},
): boolean {
  if (!voiceEnabled) return false;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  try {
    preloadVoices();
    const synth = window.speechSynthesis;

    // Only cancel when actually speaking/pending; calling cancel() unconditionally
    // on an idle Chrome/Android synthesizer can drop the next utterance.
    if (!options.queue && (synth.speaking || synth.pending)) {
      synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = options.rate ?? 1.02;
    utterance.pitch = 1.02;

    const thaiVoice = getPreferredThaiVoice();
    if (thaiVoice) {
      utterance.voice = thaiVoice;
    }

    let started = false;
    let settled = false;

    const blockCheckTimer = window.setTimeout(() => {
      if (!started && !settled) {
        settled = true;
        options.onBlocked?.();
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
      options.onDone?.();
    };

    utterance.onerror = () => {
      window.clearTimeout(blockCheckTimer);
      if (!started && !settled) {
        settled = true;
        options.onBlocked?.();
      }
    };

    synth.speak(utterance);
    if (synth.paused) {
      synth.resume();
    }
    return true;
  } catch {
    options.onBlocked?.();
    return false;
  }
}
