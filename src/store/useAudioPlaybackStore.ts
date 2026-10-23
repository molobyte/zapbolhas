import { create } from 'zustand';

export type PlaybackSpeed = 1 | 1.5 | 2;

export interface ActiveAudioState {
  chatId: string;
  messageId: string;
  audioUrl?: string;
  duration: number; // segundos totais
  currentTime: number; // segundos atuais decorridos
  progress: number; // 0 a 1
  isPlaying: boolean;
  playbackRate: PlaybackSpeed;
}

export const AUDIO_SPEED_STORAGE_KEY = 'whatsapp-bubbles-audio-playback-rate-v1';

export function getStoredPlaybackRate(): PlaybackSpeed {
  try {
    const saved = localStorage.getItem(AUDIO_SPEED_STORAGE_KEY);
    if (saved === '1.5') return 1.5;
    if (saved === '2') return 2;
    return 1;
  } catch {
    return 1;
  }
}

export function setStoredPlaybackRate(rate: PlaybackSpeed) {
  try {
    localStorage.setItem(AUDIO_SPEED_STORAGE_KEY, String(rate));
  } catch {}
}

function getEffectiveDuration(audio: HTMLAudioElement | null, fallback: number): number {
  if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
    return audio.duration;
  }
  return fallback > 0 ? fallback : 15;
}

// Instâncias fora do ciclo de vida dos componentes React
let globalAudio: HTMLAudioElement | null = null;
let animFrameId: number | null = null;
let lastSimTime = 0;

function stopGlobalAudio() {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  if (globalAudio) {
    try {
      globalAudio.pause();
      globalAudio.onended = null;
      globalAudio.onerror = null;
      globalAudio.removeAttribute('src');
      globalAudio.load();
    } catch {}
    globalAudio = null;
  }
}

interface AudioPlaybackStore {
  activeAudio: ActiveAudioState | null;

  play: (params: {
    chatId: string;
    messageId: string;
    audioUrl?: string;
    duration: number;
    initialProgress?: number;
  }) => void;

  pause: () => void;
  resume: () => void;

  togglePlay: (params?: {
    chatId: string;
    messageId: string;
    audioUrl?: string;
    duration: number;
  }) => void;

  seekTo: (params: {
    chatId: string;
    messageId: string;
    audioUrl?: string;
    duration: number;
    progress: number;
  }) => void;

  setPlaybackRate: (rate: PlaybackSpeed) => void;
  stop: (chatId?: string) => void;
}

export const useAudioPlaybackStore = create<AudioPlaybackStore>((set, get) => {
  const startAnimationLoop = () => {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    lastSimTime = performance.now();

    const tick = () => {
      const current = get().activeAudio;
      if (!current || !current.isPlaying) {
        animFrameId = null;
        return;
      }

      if (globalAudio && current.audioUrl) {
        const dur = getEffectiveDuration(globalAudio, current.duration);
        const curTime = globalAudio.currentTime;

        if (curTime >= dur || globalAudio.ended) {
          stopGlobalAudio();
          set({ activeAudio: null });
          return;
        }

        const progress = Math.min(1, Math.max(0, curTime / Math.max(0.1, dur)));
        set({
          activeAudio: {
            ...current,
            duration: dur,
            currentTime: curTime,
            progress,
            isPlaying: true,
          },
        });
      } else {
        // Modo simulado quando não há URL de áudio
        const now = performance.now();
        const dt = (now - lastSimTime) / 1000;
        lastSimTime = now;

        const step = (dt * current.playbackRate) / Math.max(1, current.duration);
        const nextProgress = current.progress + step;

        if (nextProgress >= 1) {
          stopGlobalAudio();
          set({ activeAudio: null });
          return;
        }

        set({
          activeAudio: {
            ...current,
            progress: nextProgress,
            currentTime: nextProgress * current.duration,
            isPlaying: true,
          },
        });
      }

      animFrameId = requestAnimationFrame(tick);
    };

    animFrameId = requestAnimationFrame(tick);
  };

  return {
    activeAudio: null,

    play: (params) => {
      stopGlobalAudio();

      const rate = getStoredPlaybackRate();
      const initialProgress = Math.max(0, Math.min(1, params.initialProgress || 0));

      if (params.audioUrl) {
        const audio = new Audio(params.audioUrl);
        globalAudio = audio;
        audio.playbackRate = rate;

        audio.onloadedmetadata = () => {
          if (globalAudio === audio) {
            audio.playbackRate = rate;
          }
        };

        if (initialProgress > 0) {
          audio.currentTime = initialProgress * params.duration;
        }

        audio.onended = () => {
          stopGlobalAudio();
          set({ activeAudio: null });
        };

        audio.onerror = () => {
          stopGlobalAudio();
          set({ activeAudio: null });
        };

        audio.play().catch(() => {});
      }

      set({
        activeAudio: {
          chatId: params.chatId,
          messageId: params.messageId,
          audioUrl: params.audioUrl,
          duration: params.duration,
          currentTime: initialProgress * params.duration,
          progress: initialProgress,
          isPlaying: true,
          playbackRate: rate,
        },
      });

      startAnimationLoop();
    },

    pause: () => {
      if (globalAudio) {
        globalAudio.pause();
      }
      if (animFrameId !== null) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
      const current = get().activeAudio;
      if (current) {
        set({
          activeAudio: {
            ...current,
            isPlaying: false,
          },
        });
      }
    },

    resume: () => {
      const current = get().activeAudio;
      if (!current) return;

      if (globalAudio && current.audioUrl) {
        globalAudio.playbackRate = current.playbackRate;
        globalAudio.play().catch(() => {});
      }

      set({
        activeAudio: {
          ...current,
          isPlaying: true,
        },
      });

      startAnimationLoop();
    },

    togglePlay: (params) => {
      const current = get().activeAudio;
      if (!params) {
        if (current) {
          if (current.isPlaying) {
            get().pause();
          } else {
            get().resume();
          }
        }
        return;
      }

      if (current && current.messageId === params.messageId) {
        if (current.isPlaying) {
          get().pause();
        } else {
          get().resume();
        }
      } else {
        get().play(params);
      }
    },

    seekTo: (params) => {
      const current = get().activeAudio;
      const clamped = Math.max(0, Math.min(1, params.progress));

      if (current && current.messageId === params.messageId) {
        const targetTime = clamped * current.duration;
        if (globalAudio && current.audioUrl) {
          globalAudio.currentTime = targetTime;
        }
        set({
          activeAudio: {
            ...current,
            currentTime: targetTime,
            progress: clamped,
          },
        });
      } else {
        get().play({
          chatId: params.chatId,
          messageId: params.messageId,
          audioUrl: params.audioUrl,
          duration: params.duration,
          initialProgress: clamped,
        });
      }
    },

    setPlaybackRate: (rate) => {
      setStoredPlaybackRate(rate);
      if (globalAudio) {
        globalAudio.playbackRate = rate;
      }
      const current = get().activeAudio;
      if (current) {
        set({
          activeAudio: {
            ...current,
            playbackRate: rate,
          },
        });
      }
    },

    stop: (chatId?: string) => {
      const current = get().activeAudio;
      if (!current) return;
      if (chatId && current.chatId !== chatId) return;

      stopGlobalAudio();
      set({ activeAudio: null });
    },
  };
});
