let voiceEnabled = true;

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
  options: { queue?: boolean; rate?: number; onDone?: () => void } = {},
): boolean {
  if (!voiceEnabled) return false;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  try {
    if (!options.queue) {
      window.speechSynthesis.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH';
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = 1.02;

    const thaiVoice = getPreferredThaiVoice();
    if (thaiVoice) {
      utterance.voice = thaiVoice;
    }
    if (options.onDone) {
      utterance.onend = options.onDone;
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}
