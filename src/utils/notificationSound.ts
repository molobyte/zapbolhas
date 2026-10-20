import { SoundPreset } from '../types/whatsapp';

// Gerenciador de efeitos sonoros de notificação (pasta /sfx)
// Regras de negócio:
// 1. Conversa individual (usuário): toca o áudio configurado para usuário e inicia cooldown de 30s para esse mesmo usuário.
// 2. Conversa em grupo: toca o áudio configurado para grupo (distinto) e inicia cooldown de 2 minutos (120s) para esse mesmo grupo.
// 3. Exclusão mútua (sem interpolação de áudios): se um áudio já estiver tocando no momento em que outra
//    notificação chegar (ex: milissegundos depois), o segundo áudio é ignorado. Novas notificações só tocam
//    após o término completo do áudio em reprodução.

const USER_COOLDOWN_MS = 30 * 1000; // 30 segundos para o mesmo usuário
const GROUP_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutos (120s) para o mesmo grupo

const cooldownUntilByChat = new Map<string, number>();
let isAudioCurrentlyPlaying = false;
let safetyUnlockTimer: ReturnType<typeof setTimeout> | null = null;

function releaseAudioLock() {
  isAudioCurrentlyPlaying = false;
  if (safetyUnlockTimer) {
    clearTimeout(safetyUnlockTimer);
    safetyUnlockTimer = null;
  }
}

function getFallbackUrl(isGroup: boolean, preset: SoundPreset = 'default'): string {
  const prefix = isGroup ? 'group' : 'user';
  if (preset === 'crystal') return `/sfx/${prefix}-crystal.wav`;
  if (preset === 'pop') return `/sfx/${prefix}-pop.wav`;
  return `/sfx/${prefix}-notification.wav`;
}

export function previewNotificationSound(
  isGroup: boolean,
  preset: SoundPreset = 'default'
): void {
  const fallbackSrc = getFallbackUrl(isGroup, preset);
  const playUrl = (url: string) => {
    try {
      const audio = new Audio(url);
      audio.volume = 0.85;
      audio.play().catch(() => null);
    } catch {
      // Ignore preview error
    }
  };

  if (window.electronAPI?.getSfxDataUrl) {
    window.electronAPI
      .getSfxDataUrl(isGroup ? 'group' : 'user', preset)
      .then((dataUrl) => playUrl(dataUrl || fallbackSrc))
      .catch(() => playUrl(fallbackSrc));
  } else {
    playUrl(fallbackSrc);
  }
}

export function triggerIncomingNotificationSound(
  chatId: string,
  isGroup: boolean,
  options?: {
    soundMuted?: boolean;
    preset?: SoundPreset;
  }
): void {
  if (!chatId || options?.soundMuted) return;

  const now = Date.now();
  const cooldownUntil = cooldownUntilByChat.get(chatId) || 0;

  // Regra 1 & 2: Verifica se o usuário (30s) ou grupo (2 min) ainda está no período de silêncio
  if (now < cooldownUntil) {
    return;
  }

  // Regra 3: Sem interpolação — se qualquer áudio de notificação já estiver tocando,
  // ignora o novo som; outro só poderá tocar quando o atual tiver terminado.
  if (isAudioCurrentlyPlaying) {
    return;
  }

  // Trava síncrona imediata (impede corrida mesmo se duas mensagens chegarem no mesmo milissegundo)
  isAudioCurrentlyPlaying = true;
  const cooldownDuration = isGroup ? GROUP_COOLDOWN_MS : USER_COOLDOWN_MS;
  cooldownUntilByChat.set(chatId, now + cooldownDuration);

  // Timeout de segurança caso o evento onended falhe no navegador
  safetyUnlockTimer = setTimeout(() => {
    releaseAudioLock();
  }, 2500);

  const preset = options?.preset || 'default';
  const fallbackSrc = getFallbackUrl(isGroup, preset);

  const playFromUrl = (url: string) => {
    try {
      const audio = new Audio(url);
      audio.volume = 0.85;
      audio.onended = () => {
        releaseAudioLock();
      };
      audio.onerror = () => {
        releaseAudioLock();
      };
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          releaseAudioLock();
        });
      }
    } catch {
      releaseAudioLock();
    }
  };

  if (window.electronAPI?.getSfxDataUrl) {
    window.electronAPI
      .getSfxDataUrl(isGroup ? 'group' : 'user', preset)
      .then((dataUrl) => {
        playFromUrl(dataUrl || fallbackSrc);
      })
      .catch(() => {
        playFromUrl(fallbackSrc);
      });
  } else {
    playFromUrl(fallbackSrc);
  }
}
