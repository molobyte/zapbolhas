import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AudioData, DEFAULT_AVATAR } from '../types/whatsapp';

interface AudioPlayerProps {
  audioData: AudioData;
  timestamp: string;
  fromMe: boolean;
  ack?: 'sent' | 'delivered' | 'read';
}

type PlaybackSpeed = 1 | 1.5 | 2;

const AUDIO_SPEED_STORAGE_KEY = 'whatsapp-bubbles-audio-playback-rate-v1';

function getStoredPlaybackRate(): PlaybackSpeed {
  try {
    const saved = localStorage.getItem(AUDIO_SPEED_STORAGE_KEY);
    if (saved === '1.5') return 1.5;
    if (saved === '2') return 2;
    return 1;
  } catch {
    return 1;
  }
}

function setStoredPlaybackRate(rate: PlaybackSpeed) {
  try {
    localStorage.setItem(AUDIO_SPEED_STORAGE_KEY, String(rate));
    window.dispatchEvent(new CustomEvent('wa:audio-speed-change', { detail: rate }));
  } catch {}
}

function parseDurationString(str?: string): number {
  if (!str) return 0;
  const parts = str.split(':').map((p) => parseInt(p.trim(), 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const rem = String(s % 60).padStart(2, '0');
  return `${mins}:${rem}`;
}

const DEFAULT_WAVEFORM = [
  4, 7, 11, 16, 14, 18, 15, 20, 17, 13, 10, 8, 12, 16, 19,
  15, 11, 7, 10, 14, 18, 16, 13, 9, 6, 10, 15, 12, 8, 5, 4
];

const DoubleCheckRead: React.FC<{ read?: boolean }> = ({ read = true }) => (
  <svg
    viewBox="0 0 16 11"
    className={`w-[15px] h-[11px] inline-block ml-1 shrink-0 ${
      read ? 'text-[#53BDEB]' : 'text-[#8696A0]'
    }`}
    fill="currentColor"
  >
    <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.336-.146.47.47 0 0 0-.343.146l-.311.31a.445.445 0 0 0-.14.337c0 .136.047.25.14.343l2.996 2.996a.724.724 0 0 0 .502.203.697.697 0 0 0 .546-.266l6.646-8.417a.497.497 0 0 0 .108-.299.441.441 0 0 0-.19-.374l-.338-.273Zm3.614 0a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.2-1.135-.66.819 1.67 1.67a.724.724 0 0 0 .502.203.697.697 0 0 0 .546-.266l6.646-8.417a.497.497 0 0 0 .108-.299.441.441 0 0 0-.19-.374l-.347-.273Z" />
  </svg>
);

const MicBadgeIcon: React.FC<{ colorClass: string }> = ({ colorClass }) => (
  <svg
    viewBox="0 0 16 19"
    className={`w-[14px] h-[16px] ${colorClass} drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]`}
    fill="currentColor"
  >
    <path d="M8 12a3 3 0 0 0 3-3V4a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
    <path d="M3.5 8.5a.6.6 0 0 1 .6.6 3.9 3.9 0 1 0 7.8 0 .6.6 0 1 1 1.2 0 5.1 5.1 0 0 1-4.5 5.06V16h1.8a.6.6 0 1 1 0 1.2H5.6a.6.6 0 1 1 0-1.2h1.8v-1.84A5.1 5.1 0 0 1 2.9 9.1a.6.6 0 0 1 .6-.6Z" />
  </svg>
);

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioData,
  timestamp,
  fromMe,
  ack,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [playbackRate, setPlaybackRate] = useState<PlaybackSpeed>(getStoredPlaybackRate);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerId = useRef(Math.random().toString(36).substring(2));

  // Calcula com robustez a duração total em segundos
  const fallbackSeconds = useMemo(() => {
    if (audioData.durationSeconds && audioData.durationSeconds > 0) {
      return audioData.durationSeconds;
    }
    const parsed = parseDurationString(audioData.duration);
    if (parsed > 0) {
      return parsed;
    }
    return 15;
  }, [audioData.durationSeconds, audioData.duration]);

  // Obtém a duração válida do elemento de áudio, contornando o bug do Chromium
  // em que gravações WebM/OGG de MediaRecorder reportam duration = Infinity
  const getEffectiveDuration = (audio?: HTMLAudioElement | null): number => {
    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      return audio.duration;
    }
    return fallbackSeconds;
  };

  // Instanciação e ciclo de vida do elemento HTMLAudioElement
  useEffect(() => {
    if (audioData.audioUrl) {
      const audio = new Audio(audioData.audioUrl);
      audio.playbackRate = playbackRate;
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        setProgress(0);
      };

      return () => {
        audio.pause();
        audioRef.current = null;
      };
    } else {
      audioRef.current = null;
    }
  }, [audioData.audioUrl]);

  // Sincroniza velocidade de reprodução com o elemento de áudio
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Sincroniza preferência de velocidade entre múltiplos players
  useEffect(() => {
    const handleSpeedSync = (e: Event) => {
      const customEvent = e as CustomEvent<PlaybackSpeed>;
      if (customEvent.detail && [1, 1.5, 2].includes(customEvent.detail)) {
        setPlaybackRate(customEvent.detail);
        if (audioRef.current) {
          audioRef.current.playbackRate = customEvent.detail;
        }
      }
    };

    window.addEventListener('wa:audio-speed-change', handleSpeedSync);
    return () => {
      window.removeEventListener('wa:audio-speed-change', handleSpeedSync);
    };
  }, []);

  // Pausa este áudio se outro começar a tocar no app
  useEffect(() => {
    const handleOtherAudioPlaying = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail !== playerId.current && isPlaying) {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
      }
    };

    window.addEventListener('wa:audio-playing', handleOtherAudioPlaying);
    return () => {
      window.removeEventListener('wa:audio-playing', handleOtherAudioPlaying);
    };
  }, [isPlaying]);

  // Loop de atualização a 60fps enquanto o áudio estiver tocando
  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;
    let lastTime = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const audio = audioRef.current;
      if (audio && audioData.audioUrl) {
        const dur = getEffectiveDuration(audio);
        if (dur > 0) {
          const curTime = audio.currentTime;
          if (curTime >= dur || audio.ended) {
            setIsPlaying(false);
            setProgress(0);
            return;
          }
          setProgress(Math.min(1, Math.max(0, curTime / dur)));
        }
      } else {
        // Modo simulado caso não haja arquivo de áudio carregado
        setProgress((prev) => {
          const step = (dt * playbackRate) / Math.max(1, fallbackSeconds);
          const next = prev + step;
          if (next >= 1) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, audioData.audioUrl, fallbackSeconds, playbackRate]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (audio && audioData.audioUrl) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        window.dispatchEvent(
          new CustomEvent('wa:audio-playing', { detail: playerId.current })
        );
        audio.playbackRate = playbackRate;
        const dur = getEffectiveDuration(audio);
        // Se já chegou ao final, reinicia do começo
        if (progress >= 1 || (audio.currentTime >= dur && dur > 0)) {
          audio.currentTime = 0;
          setProgress(0);
        }
        audio.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      // Simulação quando não há áudio carregado
      if (isPlaying) {
        setIsPlaying(false);
      } else {
        window.dispatchEvent(
          new CustomEvent('wa:audio-playing', { detail: playerId.current })
        );
        if (progress >= 1) {
          setProgress(0);
        }
        setIsPlaying(true);
      }
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    let nextRate: PlaybackSpeed = 1;
    if (playbackRate === 1) {
      nextRate = 1.5;
    } else if (playbackRate === 1.5) {
      nextRate = 2;
    } else {
      nextRate = 1;
    }
    setPlaybackRate(nextRate);
    setStoredPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setProgress(clickRatio);

    const audio = audioRef.current;
    if (audio && audioData.audioUrl) {
      const dur = getEffectiveDuration(audio);
      if (dur > 0) {
        audio.currentTime = Math.min(dur, Math.max(0, clickRatio * dur));
      }
    }
  };

  const isListening = isPlaying || progress > 0;

  const displayedDuration = isListening
    ? formatSeconds(progress * fallbackSeconds)
    : audioData.duration || formatSeconds(fallbackSeconds);

  const waveformBars =
    audioData.waveform && audioData.waveform.length >= 8
      ? audioData.waveform
      : DEFAULT_WAVEFORM;

  const AvatarWithMic = (
    <div className="relative w-[45px] h-[45px] shrink-0">
      <img
        src={audioData.senderAvatar || DEFAULT_AVATAR}
        alt="Avatar"
        className="w-[45px] h-[45px] rounded-full object-cover"
        draggable={false}
      />
      <div
        className={`absolute -bottom-[2px] ${
          fromMe ? '-right-[3px]' : '-left-[4px]'
        }`}
      >
        <MicBadgeIcon colorClass={fromMe ? 'text-[#25D366]' : 'text-[#53BDEB]'} />
      </div>
    </div>
  );

  const AvatarOrSpeedSlot = (
    <div className="relative w-[45px] h-[45px] shrink-0 flex items-center justify-center">
      {isListening ? (
        <button
          type="button"
          onClick={cycleSpeed}
          title="Alterar velocidade de reprodução (1x, 1.5x, 2x)"
          className={`min-w-[38px] h-[28px] px-2 rounded-full text-[12px] font-bold tracking-tight shadow-sm flex items-center justify-center transition-all cursor-pointer select-none active:scale-95 ${
            fromMe
              ? 'bg-[#004739] hover:bg-[#003d31] border border-[#007a65]/50 text-[#E9EDEF]'
              : 'bg-[#202C33] hover:bg-[#2A3942] border border-[#374248] text-[#E9EDEF]'
          }`}
        >
          {playbackRate}x
        </button>
      ) : (
        AvatarWithMic
      )}
    </div>
  );

  const PlayPauseBtn = (
    <button
      type="button"
      onClick={togglePlay}
      className="w-7 h-7 flex items-center justify-center text-[#E9EDEF] hover:text-white transition-transform active:scale-90 shrink-0 focus:outline-none cursor-pointer"
      title={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
    >
      {isPlaying ? (
        <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current">
          <rect x="3" y="2.5" width="3.5" height="11" rx="1" />
          <rect x="9.5" y="2.5" width="3.5" height="11" rx="1" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="w-4 h-4 fill-current ml-0.5">
          <path d="M4 2.5v11l9-5.5-9-5.5Z" />
        </svg>
      )}
    </button>
  );

  const WaveformBlock = (
    <div className="flex-1 min-w-[148px] flex flex-col justify-center pt-2">
      {/* Barras de Onda Sonora + Bolinha Azul */}
      <div
        onClick={handleWaveformClick}
        className="relative h-[22px] max-h-[22px] max-w-[170px] overflow-hidden flex items-center gap-[2.5px] cursor-pointer select-none"
      >
        {/* Bolinha Azul de Progresso (60fps sincronizado sem delay de CSS) */}
        <div
          style={{ left: `calc(${progress * 100}% - 5px)` }}
          className="absolute w-[10px] h-[10px] rounded-full bg-[#53BDEB] shadow z-10 pointer-events-none"
        />

        {waveformBars.map((val, idx) => {
          const barRatio = idx / waveformBars.length;
          const isPlayed = barRatio <= progress;
          const normalizedVal = val > 1 ? Math.min(1, val / 100) : Math.max(0, val);
          const heightPx = Math.max(3, Math.min(20, Math.round(normalizedVal * 18)));

          let barColor = 'bg-[#8696A0]';
          if (isPlayed) {
            barColor = 'bg-[#53BDEB]';
          } else if (fromMe) {
            barColor = 'bg-[#669E93]';
          }

          return (
            <div
              key={idx}
              style={{ height: `${heightPx}px` }}
              className={`w-[2.5px] rounded-full transition-colors ${barColor}`}
            />
          );
        })}
      </div>

      {/* Linha Inferior: Duração à esquerda, Horário + Checks à direita */}
      <div className="flex items-center justify-between text-[10.5px] text-[#8696A0] leading-none mt-1">
        <span>{displayedDuration}</span>
        <span className="flex items-center">
          <span>{timestamp}</span>
          {fromMe && <DoubleCheckRead read={ack === 'read'} />}
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-2.5 px-1.5 py-0.5 min-w-[248px]">
      {fromMe ? (
        <>
          {AvatarOrSpeedSlot}
          {PlayPauseBtn}
          {WaveformBlock}
        </>
      ) : (
        <>
          {PlayPauseBtn}
          {WaveformBlock}
          {AvatarOrSpeedSlot}
        </>
      )}
    </div>
  );
};
