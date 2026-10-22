import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Sliders,
  Monitor,
  Volume2,
  VolumeX,
  FolderOpen,
  Play,
  Layers,
  Eye,
} from 'lucide-react';
import { useBubbleStore } from '../store/useBubbleStore';
import { DisplayInfo, SoundPreset } from '../types/whatsapp';
import { previewNotificationSound } from '../utils/notificationSound';

interface SettingsPopoverProps {
  onInteractiveEnter: () => void;
  onInteractiveLeave: () => void;
  isStandaloneWindow?: boolean;
}

export const SettingsPopover: React.FC<SettingsPopoverProps> = ({
  onInteractiveEnter,
  onInteractiveLeave,
  isStandaloneWindow = false,
}) => {
  const {
    bubbleScale,
    maxBubbles,
    soundMuted,
    userSoundPreset,
    groupSoundPreset,
    customUserSoundName,
    customGroupSoundName,
    dockBackdrop,
    bubbleContrast,
    setBubbleScale,
    setMaxBubbles,
    setSoundMuted,
    setUserSoundPreset,
    setGroupSoundPreset,
    setDockBackdrop,
    setBubbleContrast,
    minimizeActiveChat,
  } = useBubbleStore();

  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [currentDisplayId, setCurrentDisplayId] = useState<number | null>(null);

  useEffect(() => {
    if (window.electronAPI?.getDisplays) {
      window.electronAPI.getDisplays().then((res) => {
        if (res) {
          setDisplays(res.displays || []);
          setCurrentDisplayId(res.currentDisplayId);
        }
      });
    }
  }, []);

  const handleSelectDisplay = async (displayId: number) => {
    setCurrentDisplayId(displayId);
    if (window.electronAPI?.setDisplay) {
      await window.electronAPI.setDisplay(displayId);
    }
  };

  const handlePickCustomFile = async (type: 'user' | 'group') => {
    if (!window.electronAPI?.selectCustomSound) return;
    const result = await window.electronAPI.selectCustomSound(type);
    if (result) {
      if (type === 'user') {
        setUserSoundPreset('custom', result.fileName);
        previewNotificationSound(false, 'custom');
      } else {
        setGroupSoundPreset('custom', result.fileName);
        previewNotificationSound(true, 'custom');
      }
    }
  };

  const arrowRightPx = Math.max(8, Math.round(24 * bubbleScale - 8));

  const handleClose = () => {
    if (isStandaloneWindow && window.electronAPI?.closeSettingsWindow) {
      window.electronAPI.closeSettingsWindow();
    } else {
      minimizeActiveChat();
    }
  };

  return (
    <motion.div
      data-interactive="true"
      onMouseEnter={onInteractiveEnter}
      onMouseLeave={onInteractiveLeave}
      initial={isStandaloneWindow ? { opacity: 0, scale: 0.97 } : { opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={
        isStandaloneWindow
          ? 'relative w-full h-full bg-[#18191B] rounded-[12px] shadow-[0_14px_38px_rgba(0,0,0,0.85)] border border-white/[0.12] flex flex-col pointer-events-auto text-[#E9EDEF] overflow-hidden'
          : 'relative w-[360px] max-h-[500px] bg-[#18191B] rounded-[12px] shadow-[0_14px_38px_rgba(0,0,0,0.85)] border border-white/[0.08] flex flex-col pointer-events-auto text-[#E9EDEF]'
      }
    >
      {/* Cabeçalho (arrastável quando em janela de diálogo separada) */}
      <div
        style={isStandaloneWindow ? ({ WebkitAppRegion: 'drag' } as React.CSSProperties) : undefined}
        className={`px-4 py-3 border-b border-white/[0.07] flex items-center justify-between ${
          isStandaloneWindow ? 'cursor-move bg-[#202C33]/60' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-[#25D366]" />
          <span className="text-[14px] font-semibold tracking-tight">
            Configurações — WhatsApp Bubbles
          </span>
        </div>
        <button
          type="button"
          style={isStandaloneWindow ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
          onClick={handleClose}
          title="Fechar configurações"
          className="w-6 h-6 rounded-full bg-[#202C33] hover:bg-[#2A3942] text-[#8696A0] hover:text-[#E9EDEF] flex items-center justify-center transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Corpo com Rolagem */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4 wa-scrollbar">
        {/* 1. Slider de Zoom das Bolinhas (Tempo Real) */}
        <div className="bg-[#111B21]/90 rounded-[8px] p-3 border border-white/[0.05]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[12.5px] font-medium text-[#E9EDEF]">
              Tamanho das Bolhas (Zoom)
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] font-semibold text-[#25D366]">
                {Math.round(bubbleScale * 100)}%
              </span>
              {bubbleScale !== 1 && (
                <button
                  type="button"
                  onClick={() => setBubbleScale(1)}
                  className="text-[10.5px] px-1.5 py-0.5 rounded bg-[#202C33] hover:bg-[#2A3942] text-[#8696A0] hover:text-[#E9EDEF]"
                >
                  Resetar
                </button>
              )}
            </div>
          </div>
          <input
            type="range"
            min={0.65}
            max={1.45}
            step={0.05}
            value={bubbleScale}
            onChange={(e) => setBubbleScale( parseFloat(e.target.value) )}
            className="w-full accent-[#25D366] cursor-pointer h-1.5 bg-[#2A3942] rounded-lg"
          />
          <div className="flex justify-between text-[10.5px] text-[#8696A0] mt-1">
            <span>65% (Menor)</span>
            <span>100%</span>
            <span>145% (Maior)</span>
          </div>
        </div>

        {/* 2. Limite de Quantidade de Bubbles */}
        <div className="bg-[#111B21]/90 rounded-[8px] p-3 border border-white/[0.05]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[#25D366]" />
              <span className="text-[12.5px] font-medium text-[#E9EDEF]">
                Limite de Bubbles na Tela
              </span>
            </div>
            <span className="min-w-[26px] px-2 py-0.5 rounded-full bg-[#25D366]/20 text-[#25D366] text-[12px] font-bold text-center">
              {maxBubbles}
            </span>
          </div>
          <p className="text-[11px] text-[#8696A0] leading-snug mb-2">
            Quando atingir o limite, uma nova mensagem remove a bolha mais antiga para dar lugar à mais recente.
          </p>
          <input
            type="range"
            min={1}
            max={15}
            step={1}
            value={maxBubbles}
            onChange={(e) => setMaxBubbles(parseInt(e.target.value, 10))}
            className="w-full accent-[#25D366] cursor-pointer h-1.5 bg-[#2A3942] rounded-lg"
          />
          <div className="flex justify-between text-[10.5px] text-[#8696A0] mt-1">
            <span>1 bolha</span>
            <span>Padrão: 10</span>
            <span>15 bolhas</span>
          </div>
        </div>

        {/* 3. Aparência e Visibilidade */}
        <div className="bg-[#111B21]/90 rounded-[8px] p-3 border border-white/[0.05] space-y-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Eye className="w-3.5 h-3.5 text-[#25D366]" />
            <span className="text-[12.5px] font-medium text-[#E9EDEF]">
              Aparência e Visibilidade
            </span>
          </div>

          {/* Opção A: Cápsula de Fundo da Barra */}
          <div className="flex items-center justify-between">
            <div className="pr-2">
              <div className="text-[12px] font-medium text-[#E9EDEF]">
                Cápsula de Fundo da Barra
              </div>
              <div className="text-[10.5px] text-[#8696A0] leading-snug">
                Base escura que isola as bolhas contra textos, vídeos ou apps no fundo.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDockBackdrop(!dockBackdrop)}
              className={`px-2.5 py-1 rounded-full text-[11.5px] font-semibold transition-colors shrink-0 ${
                dockBackdrop
                  ? 'bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40'
                  : 'bg-[#202C33] text-[#8696A0] border border-white/10'
              }`}
            >
              {dockBackdrop ? 'Ativada' : 'Desativada'}
            </button>
          </div>

          {/* Opção B: Contraste das Bordas */}
          <div className="flex items-center justify-between">
            <div className="pr-2">
              <div className="text-[12px] font-medium text-[#E9EDEF]">
                Contraste das Bordas
              </div>
              <div className="text-[10.5px] text-[#8696A0] leading-snug">
                Borda dupla branca e escura para máxima nitidez em qualquer tema.
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 bg-[#202C33] p-0.5 rounded-[6px] border border-white/10">
              <button
                type="button"
                onClick={() => setBubbleContrast('high')}
                className={`px-2 py-0.5 text-[11px] rounded-[4px] font-medium transition-colors ${
                  bubbleContrast === 'high'
                    ? 'bg-[#25D366] text-[#111B21] font-bold'
                    : 'text-[#8696A0] hover:text-[#E9EDEF]'
                }`}
              >
                Alto
              </button>
              <button
                type="button"
                onClick={() => setBubbleContrast('subtle')}
                className={`px-2 py-0.5 text-[11px] rounded-[4px] font-medium transition-colors ${
                  bubbleContrast === 'subtle'
                    ? 'bg-[#25D366] text-[#111B21] font-bold'
                    : 'text-[#8696A0] hover:text-[#E9EDEF]'
                }`}
              >
                Sutil
              </button>
            </div>
          </div>
        </div>

        {/* 4. Escolha do Monitor / Tela */}
        <div className="bg-[#111B21]/90 rounded-[8px] p-3 border border-white/[0.05]">
          <div className="flex items-center gap-1.5 mb-2">
            <Monitor className="w-3.5 h-3.5 text-[#25D366]" />
            <span className="text-[12.5px] font-medium text-[#E9EDEF]">
              Tela de Exibição (Monitor)
            </span>
          </div>
          {displays.length <= 1 ? (
            <div className="text-[11.5px] text-[#8696A0] bg-[#202C33]/70 px-2.5 py-2 rounded-[6px]">
              {displays[0]?.label || 'Tela 1 (Principal) — Único monitor detectado'}
            </div>
          ) : (
            <div className="space-y-1.5">
              {displays.map((d) => {
                const isSelected = d.id === currentDisplayId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => handleSelectDisplay(d.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-[6px] text-[12px] flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-[#005C4B] text-[#E9EDEF] font-medium border border-[#25D366]/40'
                        : 'bg-[#202C33] text-[#8696A0] hover:bg-[#2A3942] hover:text-[#E9EDEF]'
                    }`}
                  >
                    <span className="truncate">{d.label}</span>
                    {isSelected && (
                      <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-[#25D366] text-[#111B21] font-bold shrink-0 ml-2">
                        Ativa
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. Áudio das Notificações (Mutar ou Mudar Som) */}
        <div className="bg-[#111B21]/90 rounded-[8px] p-3 border border-white/[0.05] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {soundMuted ? (
                <VolumeX className="w-4 h-4 text-[#EF4444]" />
              ) : (
                <Volume2 className="w-4 h-4 text-[#25D366]" />
              )}
              <span className="text-[12.5px] font-medium text-[#E9EDEF]">
                Sons de Notificação
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSoundMuted(!soundMuted)}
              className={`px-2.5 py-1 rounded-full text-[11.5px] font-semibold transition-colors ${
                soundMuted
                  ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40'
                  : 'bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40'
              }`}
            >
              {soundMuted ? 'Mutado (Silencioso)' : 'Ativado'}
            </button>
          </div>

          {/* Som de Contato Individual (30s) */}
          <div className={`space-y-1.5 ${soundMuted ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between text-[11.5px] text-[#8696A0]">
              <span>Som de Contato Individual (cooldown 30s)</span>
              <button
                type="button"
                onClick={() => previewNotificationSound(false, userSoundPreset)}
                title="Testar som de contato"
                className="flex items-center gap-1 text-[#25D366] hover:underline text-[11px]"
              >
                <Play className="w-3 h-3 fill-current" />
                Testar
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={userSoundPreset}
                onChange={(e) => {
                  const preset = e.target.value as SoundPreset;
                  setUserSoundPreset(preset);
                  previewNotificationSound(false, preset);
                }}
                className="flex-1 bg-[#202C33] text-[#E9EDEF] text-[12px] rounded-[6px] px-2.5 py-1.5 border border-white/10 focus:outline-none focus:border-[#25D366]"
              >
                <option value="default">Padrão (Chime Duplo)</option>
                <option value="crystal">Cristal Suave</option>
                <option value="pop">Pop Moderno</option>
                {customUserSoundName && (
                  <option value="custom">Personalizado: {customUserSoundName}</option>
                )}
              </select>
              <button
                type="button"
                onClick={() => handlePickCustomFile('user')}
                title="Escolher arquivo de áudio (.mp3, .wav, .ogg)"
                className="px-2.5 py-1.5 rounded-[6px] bg-[#202C33] hover:bg-[#2A3942] text-[#E9EDEF] border border-white/10 flex items-center gap-1 text-[11.5px] shrink-0"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#25D366]" />
                Arquivo
              </button>
            </div>
          </div>

          {/* Som de Grupo (2 min) */}
          <div className={`space-y-1.5 ${soundMuted ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="flex items-center justify-between text-[11.5px] text-[#8696A0]">
              <span>Som de Grupo (cooldown 2 min)</span>
              <button
                type="button"
                onClick={() => previewNotificationSound(true, groupSoundPreset)}
                title="Testar som de grupo"
                className="flex items-center gap-1 text-[#25D366] hover:underline text-[11px]"
              >
                <Play className="w-3 h-3 fill-current" />
                Testar
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={groupSoundPreset}
                onChange={(e) => {
                  const preset = e.target.value as SoundPreset;
                  setGroupSoundPreset(preset);
                  previewNotificationSound(true, preset);
                }}
                className="flex-1 bg-[#202C33] text-[#E9EDEF] text-[12px] rounded-[6px] px-2.5 py-1.5 border border-white/10 focus:outline-none focus:border-[#25D366]"
              >
                <option value="default">Padrão (Acorde Marimba)</option>
                <option value="crystal">Cristal Arpejo</option>
                <option value="pop">Pop Duplo</option>
                {customGroupSoundName && (
                  <option value="custom">Personalizado: {customGroupSoundName}</option>
                )}
              </select>
              <button
                type="button"
                onClick={() => handlePickCustomFile('group')}
                title="Escolher arquivo de áudio (.mp3, .wav, .ogg)"
                className="px-2.5 py-1.5 rounded-[6px] bg-[#202C33] hover:bg-[#2A3942] text-[#E9EDEF] border border-white/10 flex items-center gap-1 text-[11.5px] shrink-0"
              >
                <FolderOpen className="w-3.5 h-3.5 text-[#25D366]" />
                Arquivo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Seta / Triângulo apontando para o botão verde do WhatsApp (somente no modo popover) */}
      {!isStandaloneWindow && (
        <div
          style={{
            right: `${arrowRightPx}px`,
            clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
          }}
          className="w-[16px] h-[8px] bg-[#18191B] absolute top-full -mt-[1px] pointer-events-none z-30"
          aria-hidden="true"
        />
      )}
    </motion.div>
  );
};
