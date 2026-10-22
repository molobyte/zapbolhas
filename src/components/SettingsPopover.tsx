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
  Palette,
  Pipette,
  RotateCcw,
  Contrast,
} from 'lucide-react';
import { useBubbleStore } from '../store/useBubbleStore';
import { BubbleVignetteStyle, DisplayInfo, SoundPreset } from '../types/whatsapp';
import { previewNotificationSound } from '../utils/notificationSound';
import { hexToRgba } from '../utils/colorUtils';

const PRESET_BORDER_COLORS = [
  { name: 'Branco', hex: '#FFFFFF' },
  { name: 'Verde WhatsApp', hex: '#25D366' },
  { name: 'Ciano Neon', hex: '#00F0FF' },
  { name: 'Azul', hex: '#3B82F6' },
  { name: 'Amarelo', hex: '#FBBF24' },
  { name: 'Roxo', hex: '#A855F7' },
  { name: 'Laranja', hex: '#F97316' },
  { name: 'Vermelho', hex: '#EF4444' },
];

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
    bubbleBorderMode,
    bubbleBorderColor,
    bubbleBorderOpacity,
    bubbleBorderWidth,
    bubbleVignetteEnabled,
    bubbleVignetteOpacity,
    bubbleVignetteStyle,
    setBubbleScale,
    setMaxBubbles,
    setSoundMuted,
    setUserSoundPreset,
    setGroupSoundPreset,
    setBubbleBorderMode,
    setBubbleBorderColor,
    setBubbleBorderOpacity,
    setBubbleBorderWidth,
    setBubbleVignetteEnabled,
    setBubbleVignetteOpacity,
    setBubbleVignetteStyle,
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

        {/* 3. Borda das Bubbles (Cor, Transparência ou Padrão Atual) */}
        <div className="bg-[#111B21]/90 rounded-[8px] p-3 border border-white/[0.05] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-[#25D366]" />
              <span className="text-[12.5px] font-medium text-[#E9EDEF]">
                Borda das Bubbles
              </span>
            </div>
            {/* Alternador: Usar Atual vs Personalizada */}
            <div className="flex items-center gap-1 bg-[#202C33] p-0.5 rounded-[6px] border border-white/10">
              <button
                type="button"
                onClick={() => setBubbleBorderMode('default')}
                className={`px-2 py-0.5 text-[11px] rounded-[4px] font-medium transition-colors ${
                  bubbleBorderMode === 'default'
                    ? 'bg-[#25D366] text-[#111B21] font-bold'
                    : 'text-[#8696A0] hover:text-[#E9EDEF]'
                }`}
              >
                Padrão Atual
              </button>
              <button
                type="button"
                onClick={() => setBubbleBorderMode('custom')}
                className={`px-2 py-0.5 text-[11px] rounded-[4px] font-medium transition-colors ${
                  bubbleBorderMode === 'custom'
                    ? 'bg-[#25D366] text-[#111B21] font-bold'
                    : 'text-[#8696A0] hover:text-[#E9EDEF]'
                }`}
              >
                Personalizada
              </button>
            </div>
          </div>

          {bubbleBorderMode === 'default' ? (
            <div className="text-[11px] text-[#8696A0] bg-[#202C33]/60 px-2.5 py-2 rounded-[6px] flex items-center justify-between">
              <span>Borda original ativa: <strong>Branca com 15% de opacidade</strong>.</span>
              <button
                type="button"
                onClick={() => setBubbleBorderMode('custom')}
                className="text-[11px] text-[#25D366] hover:underline font-semibold ml-2 shrink-0"
              >
                Personalizar
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              {/* Seletor de Cores (Paleta rápida + Color Picker Nativo) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11.5px] text-[#8696A0]">
                  <span>Cor da Borda</span>
                  <div className="flex items-center gap-2">
                    <label className="relative flex items-center gap-1.5 cursor-pointer group" title="Escolher cor personalizada">
                      <input
                        type="color"
                        value={bubbleBorderColor}
                        onChange={(e) => setBubbleBorderColor(e.target.value.toUpperCase())}
                        className="sr-only"
                      />
                      <div
                        style={{ backgroundColor: bubbleBorderColor }}
                        className="w-4 h-4 rounded-full border border-white/40 shadow-xs flex items-center justify-center group-hover:scale-110 transition-transform"
                      />
                      <span className="text-[11px] text-[#E9EDEF] font-mono font-medium">{bubbleBorderColor}</span>
                      <Pipette className="w-3 h-3 text-[#25D366]" />
                    </label>
                  </div>
                </div>

                {/* Swatches de Cores Rápidas */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PRESET_BORDER_COLORS.map((p) => {
                    const isSelected = bubbleBorderColor.toUpperCase() === p.hex.toUpperCase();
                    return (
                      <button
                        key={p.hex}
                        type="button"
                        onClick={() => setBubbleBorderColor(p.hex)}
                        title={p.name}
                        className={`w-6 h-6 rounded-full transition-transform flex items-center justify-center ${
                          isSelected ? 'scale-110 ring-2 ring-[#25D366] ring-offset-1 ring-offset-[#111B21]' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: p.hex }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Slider de Transparência / Opacidade (0% a 100%) */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11.5px]">
                  <span className="text-[#8696A0]">Transparência / Opacidade</span>
                  <span className="font-semibold text-[#25D366]">
                    {bubbleBorderOpacity}%
                    {bubbleBorderOpacity === 15 && ' (Igual atual)'}
                    {bubbleBorderOpacity === 100 && ' (Sólida)'}
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={5}
                  value={bubbleBorderOpacity}
                  onChange={(e) => setBubbleBorderOpacity(parseInt(e.target.value, 10))}
                  className="w-full accent-[#25D366] cursor-pointer h-1.5 bg-[#2A3942] rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-[#8696A0]">
                  <span>5% (Discreta)</span>
                  <button
                    type="button"
                    onClick={() => setBubbleBorderOpacity(15)}
                    className="hover:text-[#25D366] underline cursor-pointer"
                  >
                    15% (Atual)
                  </button>
                  <span>50%</span>
                  <button
                    type="button"
                    onClick={() => setBubbleBorderOpacity(100)}
                    className="hover:text-[#25D366] underline cursor-pointer"
                  >
                    100% (Sólida)
                  </button>
                </div>
              </div>

              {/* Espessura da Borda */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11.5px]">
                  <span className="text-[#8696A0]">Espessura da Borda</span>
                  <span className="font-semibold text-[#25D366]">{bubbleBorderWidth}px</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: '1px', value: 1 },
                    { label: '1.5px (Atual)', value: 1.5 },
                    { label: '2px', value: 2 },
                    { label: '3px', value: 3 },
                  ].map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setBubbleBorderWidth(item.value)}
                      className={`py-1 text-[11px] rounded-[5px] font-medium transition-colors ${
                        bubbleBorderWidth === item.value
                          ? 'bg-[#25D366] text-[#111B21] font-bold'
                          : 'bg-[#202C33] text-[#8696A0] hover:bg-[#2A3942] hover:text-[#E9EDEF]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pré-visualização em tempo real */}
              <div className="bg-[#182229] rounded-[8px] p-2.5 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="relative w-[36px] h-[36px] rounded-full overflow-hidden shadow-md shrink-0 flex items-center justify-center bg-[#202C33]"
                    style={{
                      borderColor: hexToRgba(bubbleBorderColor, bubbleBorderOpacity),
                      borderWidth: `${bubbleBorderWidth}px`,
                      borderStyle: 'solid',
                    }}
                  >
                    <div className="w-full h-full bg-gradient-to-tr from-[#005C4B] to-[#25D366] flex items-center justify-center text-white text-[11px] font-bold">
                      WA
                    </div>
                  </div>
                  <div className="text-[11px] leading-snug">
                    <div className="text-[#E9EDEF] font-medium">Prévia da bolha</div>
                    <div className="text-[#8696A0] font-mono text-[10px]">
                      {hexToRgba(bubbleBorderColor, bubbleBorderOpacity)} • {bubbleBorderWidth}px
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBubbleBorderMode('default');
                    setBubbleBorderColor('#FFFFFF');
                    setBubbleBorderOpacity(15);
                    setBubbleBorderWidth(1.5);
                  }}
                  title="Restaurar padrão atual da borda"
                  className="flex items-center gap-1 text-[10.5px] px-2 py-1 rounded bg-[#202C33] hover:bg-[#2A3942] text-[#8696A0] hover:text-[#E9EDEF] transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Resetar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 4. Vinheta / Gradiente de Fundo no Canto Inferior Direito */}
        <div className="bg-[#111B21]/90 rounded-[8px] p-3 border border-white/[0.05] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Contrast className="w-3.5 h-3.5 text-[#25D366]" />
              <span className="text-[12.5px] font-medium text-[#E9EDEF]">
                Vinheta de Fundo (Canto Inferior)
              </span>
            </div>
            {/* Alternador Ativar / Desativar */}
            <button
              type="button"
              onClick={() => setBubbleVignetteEnabled(!bubbleVignetteEnabled)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                bubbleVignetteEnabled
                  ? 'bg-[#25D366] text-[#111B21] shadow-xs'
                  : 'bg-[#202C33] text-[#8696A0] hover:text-[#E9EDEF]'
              }`}
            >
              {bubbleVignetteEnabled ? 'Ativada' : 'Desativada'}
            </button>
          </div>

          <p className="text-[11px] text-[#8696A0] leading-snug">
            Cria um gradiente escuro suave no canto inferior direito atrás das bolhas para que as cores não se misturem com o seu papel de parede ou janelas abertas. O efeito se expande automaticamente até o último contato aberto.
          </p>

          {bubbleVignetteEnabled ? (
            <div className="space-y-3 pt-1 border-t border-white/[0.06]">
              {/* Estilo do Gradiente */}
              <div className="space-y-1.5">
                <span className="text-[11.5px] text-[#8696A0]">Estilo da Vinheta</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { key: 'classic', label: 'Clássico', desc: 'Escuro Suave' },
                    { key: 'emerald', label: 'WhatsApp', desc: 'Nuance Verde' },
                    { key: 'radial', label: 'Radial', desc: 'Spotlight' },
                  ].map((styleOpt) => {
                    const isSelected = bubbleVignetteStyle === styleOpt.key;
                    return (
                      <button
                        key={styleOpt.key}
                        type="button"
                        onClick={() => setBubbleVignetteStyle(styleOpt.key as BubbleVignetteStyle)}
                        className={`py-1.5 px-2 rounded-[6px] text-left transition-colors flex flex-col ${
                          isSelected
                            ? 'bg-[#005C4B] border border-[#25D366]/40 text-[#E9EDEF]'
                            : 'bg-[#202C33] text-[#8696A0] hover:bg-[#2A3942] hover:text-[#E9EDEF]'
                        }`}
                      >
                        <span className={`text-[11.5px] font-semibold ${isSelected ? 'text-[#25D366]' : ''}`}>
                          {styleOpt.label}
                        </span>
                        <span className="text-[9.5px] opacity-75">{styleOpt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slider de Intensidade / Opacidade */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11.5px]">
                  <span className="text-[#8696A0]">Intensidade / Opacidade</span>
                  <span className="font-semibold text-[#25D366]">{bubbleVignetteOpacity}%</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={100}
                  step={5}
                  value={bubbleVignetteOpacity}
                  onChange={(e) => setBubbleVignetteOpacity(parseInt(e.target.value, 10))}
                  className="w-full accent-[#25D366] cursor-pointer h-1.5 bg-[#2A3942] rounded-lg"
                />
                <div className="flex justify-between text-[10px] text-[#8696A0]">
                  <button
                    type="button"
                    onClick={() => setBubbleVignetteOpacity(30)}
                    className="hover:text-[#25D366] underline cursor-pointer"
                  >
                    30% (Suave)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBubbleVignetteOpacity(60)}
                    className="hover:text-[#25D366] underline cursor-pointer"
                  >
                    60% (Médio)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBubbleVignetteOpacity(80)}
                    className="hover:text-[#25D366] underline cursor-pointer font-medium text-[#E9EDEF]"
                  >
                    80% (Padrão)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBubbleVignetteOpacity(100)}
                    className="hover:text-[#25D366] underline cursor-pointer"
                  >
                    100% (Forte)
                  </button>
                </div>
              </div>

              {/* Pré-visualização Interativa do Efeito no Canto */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[#8696A0]">
                  <span>Prévia do Canto da Tela</span>
                  <button
                    type="button"
                    onClick={() => {
                      setBubbleVignetteOpacity(80);
                      setBubbleVignetteStyle('classic');
                    }}
                    title="Restaurar padrão da vinheta"
                    className="flex items-center gap-1 text-[10.5px] text-[#8696A0] hover:text-[#25D366]"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Resetar
                  </button>
                </div>

                {/* Caixa simulando wallpaper desktop com a vinheta no canto */}
                <div className="relative h-[80px] rounded-[8px] overflow-hidden border border-white/10 bg-gradient-to-tr from-[#3b82f6]/30 via-[#ec4899]/30 to-[#eab308]/30 flex items-end justify-end p-2 select-none">
                  {/* Padrão quadriculado sutil de fundo para evidenciar o contraste */}
                  <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                      backgroundImage:
                        'radial-gradient(circle, #ffffff 1px, transparent 1px)',
                      backgroundSize: '10px 10px',
                    }}
                  />

                  {/* Gradiente da vinheta na prévia com atenuação suave em ambos os eixos */}
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      maskImage:
                        'linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0.65) 70%, rgba(0,0,0,0.18) 88%, rgba(0,0,0,0) 98%, transparent 100%)',
                      WebkitMaskImage:
                        'linear-gradient(to left, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 45%, rgba(0,0,0,0.65) 70%, rgba(0,0,0,0.18) 88%, rgba(0,0,0,0) 98%, transparent 100%)',
                    }}
                  >
                    <div
                      className="w-full h-full pointer-events-none"
                      style={{
                        maskImage:
                          'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 10%, rgba(0,0,0,0.82) 35%, rgba(0,0,0,0.52) 62%, rgba(0,0,0,0.18) 82%, rgba(0,0,0,0) 98%, transparent 100%)',
                        WebkitMaskImage:
                          'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 10%, rgba(0,0,0,0.82) 35%, rgba(0,0,0,0.52) 62%, rgba(0,0,0,0.18) 82%, rgba(0,0,0,0) 98%, transparent 100%)',
                        background:
                          bubbleVignetteStyle === 'radial'
                            ? `radial-gradient(circle at 100% 100%, rgba(5,7,10,${0.98 * (bubbleVignetteOpacity / 100)}) 0%, rgba(8,11,15,${0.92 * (bubbleVignetteOpacity / 100)}) 40%, rgba(12,16,22,${0.84 * (bubbleVignetteOpacity / 100)}) 75%, rgba(15,20,28,${0.72 * (bubbleVignetteOpacity / 100)}) 100%)`
                            : bubbleVignetteStyle === 'emerald'
                            ? `radial-gradient(ellipse at 100% 100%, rgba(3,26,20,${0.98 * (bubbleVignetteOpacity / 100)}) 0%, rgba(6,36,28,${0.90 * (bubbleVignetteOpacity / 100)}) 45%, rgba(9,25,22,${0.82 * (bubbleVignetteOpacity / 100)}) 75%, rgba(11,20,19,${0.75 * (bubbleVignetteOpacity / 100)}) 100%)`
                            : `radial-gradient(ellipse at 100% 100%, rgba(6,9,12,${0.98 * (bubbleVignetteOpacity / 100)}) 0%, rgba(8,12,16,${0.92 * (bubbleVignetteOpacity / 100)}) 45%, rgba(12,17,23,${0.85 * (bubbleVignetteOpacity / 100)}) 75%, rgba(15,20,26,${0.78 * (bubbleVignetteOpacity / 100)}) 100%)`,
                      }}
                    />
                  </div>

                  {/* Mini bolhas de exemplo sobrepostas na vinheta */}
                  <div className="relative z-10 flex items-center gap-1.5">
                    {/* Bolha de exemplo 1 */}
                    <div className="w-[28px] h-[28px] rounded-full border border-white/20 bg-[#2A3942] flex items-center justify-center text-[10px] text-white font-bold shadow-md">
                      Ana
                    </div>
                    {/* Bolha de exemplo 2 */}
                    <div className="w-[28px] h-[28px] rounded-full border border-white/20 bg-[#005C4B] flex items-center justify-center text-[10px] text-white font-bold shadow-md">
                      João
                    </div>
                    {/* Botão WhatsApp exemplo */}
                    <div className="w-[28px] h-[28px] rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-md">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                        <path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.469 3.484 1.359 5.016L2 22l5.156-1.359c1.484.813 3.156 1.25 4.875 1.25 5.516 0 9.969-4.453 9.969-9.969S17.547 2 12.031 2z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[11px] text-[#8696A0] bg-[#202C33]/60 px-2.5 py-2 rounded-[6px] flex items-center justify-between">
              <span>A vinheta está desativada no momento.</span>
              <button
                type="button"
                onClick={() => setBubbleVignetteEnabled(true)}
                className="text-[11px] text-[#25D366] hover:underline font-semibold ml-2 shrink-0"
              >
                Ativar agora
              </button>
            </div>
          )}
        </div>

        {/* 5. Escolha do Monitor / Tela */}
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

        {/* 6. Áudio das Notificações (Mutar ou Mudar Som) */}
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
