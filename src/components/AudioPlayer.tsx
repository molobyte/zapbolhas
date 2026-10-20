import React, { useState, useEffect, useRef } from 'react';
import { AudioData } from '../types/whatsapp';

interface AudioPlayerProps {
  audioData: AudioData;
  timestamp: string;
  fromMe: boolean;
  ack?: 'sent' | 'delivered' | 'read';
}

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mins = Math.floor(s / 60);
  const rem = String(s % 60).padStart(2, '0');
  return `${mins}:${rem}`;
}

const DoubleCheckRead: React.FC = () => (
  <svg
    viewBox="0 0 16 11"
    className="w-[15px] h-[11px] text-[#53BDEB] inline-block ml-1 shrink-0"
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
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 1
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const totalSeconds = audioData.durationSeconds || 46;

  useEffect(() => {
    if (audioData.audioUrl) {
      const audio = new Audio(audioData.audioUrl);
      audioRef.current = audio;
      audio.ontimeupdate = () => {
        if (audio.duration) {
          setProgress(audio.currentTime / audio.duration);
        }
      };
      audio.onended = () => {
        setIsPlaying(false);
        setProgress(0);
      };
      return () => {
        audio.pause();
      };
    }
  }, [audioData.audioUrl]);

  useEffect(() => {
    if (!isPlaying || audioData.audioUrl) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 0.2 / Math.min(totalSeconds, 30);
        if (next >= 1) {
          setIsPlaying(false);
          return 0;
        }
        return next;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying, audioData.audioUrl, totalSeconds]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setProgress(clickRatio);
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = clickRatio * audioRef.current.duration;
    }
  };

  const displayedDuration =
    isPlaying || progress > 0
      ? formatSeconds(progress * totalSeconds)
      : audioData.duration;

  const AvatarWithMic = (
    <div className="relative w-[45px] h-[45px] shrink-0">
      <img
        src={audioData.senderAvatar}
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

  const PlayPauseBtn = (
    <button
      type="button"
      onClick={togglePlay}
      className="w-7 h-7 flex items-center justify-center text-[#E9EDEF] hover:text-white transition-transform active:scale-90 shrink-0 focus:outline-none"
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
        className="relative h-[22px] flex items-center gap-[2.5px] cursor-pointer select-none"
      >
        {/* Bolinha Azul de Progresso */}
        <div
          style={{ left: `calc(${progress * 100}% - 5px)` }}
          className="absolute w-[10px] h-[10px] rounded-full bg-[#53BDEB] shadow z-10 pointer-events-none transition-[left] duration-75"
        />

        {audioData.waveform.map((val, idx) => {
          const barRatio = idx / audioData.waveform.length;
          const isPlayed = barRatio <= progress;
          const heightPx = Math.max(3, Math.round(val * 18));

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
          {fromMe && <DoubleCheckRead />}
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-2.5 px-1.5 py-0.5 min-w-[248px]">
      {fromMe ? (
        <>
          {AvatarWithMic}
          {PlayPauseBtn}
          {WaveformBlock}
        </>
      ) : (
        <>
          {PlayPauseBtn}
          {WaveformBlock}
          {AvatarWithMic}
        </>
      )}
    </div>
  );
};
