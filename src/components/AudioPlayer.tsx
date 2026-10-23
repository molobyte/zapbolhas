import React, { useMemo } from 'react';
import { AudioData, DEFAULT_AVATAR } from '../types/whatsapp';
import { MessageCheckIcon } from './MessageCheckIcon';
import {
  useAudioPlaybackStore,
  getStoredPlaybackRate,
  PlaybackSpeed,
} from '../store/useAudioPlaybackStore';

interface AudioPlayerProps {
  audioData: AudioData;
  timestamp: string;
  fromMe: boolean;
  ack?: 'sent' | 'delivered' | 'read';
  chatId?: string;
  messageId?: string;
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
  chatId,
  messageId,
}) => {
  const effectiveChatId = chatId || 'unknown';
  const effectiveMessageId = messageId || audioData.audioUrl || 'unknown';

  const activeAudio = useAudioPlaybackStore((state) => state.activeAudio);
  const isThisAudioActive = Boolean(
    activeAudio && activeAudio.messageId === effectiveMessageId
  );

  const isPlaying = Boolean(isThisAudioActive && activeAudio?.isPlaying);
  const progress = isThisAudioActive && activeAudio ? activeAudio.progress : 0;
  const playbackRate = isThisAudioActive && activeAudio
    ? activeAudio.playbackRate
    : getStoredPlaybackRate();

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

  const togglePlay = () => {
    useAudioPlaybackStore.getState().togglePlay({
      chatId: effectiveChatId,
      messageId: effectiveMessageId,
      audioUrl: audioData.audioUrl,
      duration: fallbackSeconds,
    });
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextRate: PlaybackSpeed =
      playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    useAudioPlaybackStore.getState().setPlaybackRate(nextRate);
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    useAudioPlaybackStore.getState().seekTo({
      chatId: effectiveChatId,
      messageId: effectiveMessageId,
      audioUrl: audioData.audioUrl,
      duration: fallbackSeconds,
      progress: clickRatio,
    });
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
          {fromMe && <MessageCheckIcon ack={ack} />}
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
