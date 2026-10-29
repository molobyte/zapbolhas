import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Pin,
  MessageSquare,
  Info,
  AppWindow,
  Sparkles,
} from 'lucide-react';
import { useBubbleStore } from '../store/useBubbleStore';
import {
  BubbleBorderMode,
  DisplayInfo,
  SoundPreset,
  StartupChatFilter,
  ChatListSize,
  CHAT_LIST_SIZE_CONFIG,
} from '../types/whatsapp';
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

type SettingsTab = 'geral' | 'aparencia' | 'notificacoes' | 'sistema';

interface TabItem {
  id: SettingsTab;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  {
    id: 'geral',
    label: 'Geral e Janelas',
    subtitle: 'Tamanho da lista de conversas, limites e inicialização',
    icon: AppWindow,
  },
  {
    id: 'aparencia',
    label: 'Aparência e Bordas',
    subtitle: 'Zoom das bolhas flutuantes e estilos de contorno',
    icon: Palette,
  },
  {
    id: 'notificacoes',
    label: 'Sons e Notificações',
    subtitle: 'Alertas sonoros para contatos individuais e grupos',
    icon: Volume2,
  },
  {
    id: 'sistema',
    label: 'Monitores e Sistema',
    subtitle: 'Seleção de monitor e atalhos úteis do app',
    icon: Monitor,
  },
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
    startupChatFilter,
    chatListSize,
    setBubbleScale,
    setMaxBubbles,
    setSoundMuted,
    setUserSoundPreset,
    setGroupSoundPreset,
    setBubbleBorderMode,
    setBubbleBorderColor,
    setBubbleBorderOpacity,
    setBubbleBorderWidth,
    setStartupChatFilter,
    setChatListSize,
    applyExternalSettingsUpdate,
    minimizeActiveChat,
  } = useBubbleStore();

  const [activeTab, setActiveTab] = useState<SettingsTab>('geral');
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
    const unsubDisplay = window.electronAPI?.onDisplayChanged
      ? window.electronAPI.onDisplayChanged((displayId) => {
          setCurrentDisplayId(displayId);
        })
      : () => {};
    const unsubSettings = window.electronAPI?.onSettingsUpdated
      ? window.electronAPI.onSettingsUpdated((patch) => {
          applyExternalSettingsUpdate(patch);
        })
      : () => {};
    return () => {
      unsubDisplay();
      unsubSettings();
    };
  }, [applyExternalSettingsUpdate]);

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

  const currentTabInfo = TABS.find((t) => t.id === activeTab) || TABS[0];

  return (
    <motion.div
      data-interactive="true"
      onMouseEnter={onInteractiveEnter}
      onMouseLeave={onInteractiveLeave}
      initial={isStandaloneWindow ? { opacity: 0, scale: 0.98 } : { opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={
        isStandaloneWindow
          ? 'relative w-full h-full bg-[#18191B] rounded-[10px] shadow-[0_16px_48px_rgba(0,0,0,0.85)] border border-white/[0.12] flex flex-col pointer-events-auto text-[#E9EDEF] overflow-hidden select-none'
          : 'relative w-[720px] h-[510px] max-h-[calc(100vh-84px)] bg-[#18191B] rounded-[10px] shadow-[0_16px_48px_rgba(0,0,0,0.85)] border border-white/[0.10] flex flex-col pointer-events-auto text-[#E9EDEF] overflow-hidden select-none'
      }
    >
      {/* Barra de Título Nativa Estilo Windows */}
      <div
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        className="h-[36px] bg-[#111B21] border-b border-white/[0.08] flex items-center justify-between pl-3 pr-0 shrink-0 select-none cursor-move"
      >
        <div className="flex items-center gap-2">
          {/* Ícone de configurações */}
          <div className="w-4 h-4 rounded-full bg-[#005C4B] flex items-center justify-center">
            <Sliders className="w-2.5 h-2.5 text-[#25D366]" />
          </div>
          <span className="text-[12px] font-medium text-[#CFD9DF] tracking-tight">
            Configurações — WhatsApp Bubbles
          </span>
        </div>

        {/* Botão Fechar Estilo Windows (Hover Vermelho) */}
        <button
          type="button"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          onClick={handleClose}
          title="Fechar"
          className="w-10 h-full flex items-center justify-center text-[#8696A0] hover:text-white hover:bg-[#E81123] active:bg-[#C4101F] transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Corpo da Janela Paisagem: Barra Lateral de Abas + Conteúdo */}
      <div className="flex-1 flex overflow-hidden">
        {/* Barra Lateral com Abas de Categorias */}
        <aside className="w-[210px] bg-[#111B21]/75 border-r border-white/[0.06] flex flex-col justify-between p-2 select-none shrink-0">
          <nav className="space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[6px] text-[12.5px] transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#202C33] text-[#E9EDEF] font-semibold border-l-[3px] border-l-[#25D366] shadow-xs'
                      : 'text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[#202C33]/50 border-l-[3px] border-l-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#25D366]' : 'text-[#8696A0]'}`} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Rodapé da Barra Lateral */}
          <div className="pt-2 border-t border-white/[0.06] px-2 text-[10.5px] text-[#8696A0] flex items-center justify-between">
            <span>Zapbolhas</span>
            <span className="px-1.5 py-0.5 rounded bg-[#202C33] text-[9.5px] text-[#AEBAC1]">Desktop</span>
          </div>
        </aside>

        {/* Painel de Conteúdo da Aba Ativa */}
        <main className="flex-1 bg-[#18191B] flex flex-col min-w-0 overflow-hidden">
          {/* Cabeçalho da Aba */}
          <header className="px-5 py-3 border-b border-white/[0.05] bg-[#141517] shrink-0">
            <h1 className="text-[15px] font-semibold text-[#E9EDEF] tracking-tight">
              {currentTabInfo.label}
            </h1>
            <p className="text-[11.5px] text-[#8696A0] mt-0.5 leading-snug">
              {currentTabInfo.subtitle}
            </p>
          </header>

          {/* Área de Configurações com Rolagem Suave */}
          <div className="p-5 flex-1 overflow-y-auto space-y-4 wa-scrollbar">
            {/* ============================================================== */}
            {/* ABA 1: GERAL E JANELAS                                        */}
            {/* ============================================================== */}
            {activeTab === 'geral' && (
              <>
                {/* 1. Tamanho da Janela de Lista de Conversas */}
                <section className="bg-[#111B21]/90 rounded-[8px] p-3.5 border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-[#25D366]" />
                      <span className="text-[13px] font-semibold text-[#E9EDEF]">
                        Tamanho da Janela de Lista de Conversas
                      </span>
                    </div>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#202C33] text-[#25D366] font-semibold border border-[#25D366]/30">
                      {CHAT_LIST_SIZE_CONFIG[chatListSize]?.width} × {CHAT_LIST_SIZE_CONFIG[chatListSize]?.height} px
                    </span>
                  </div>

                  <p className="text-[11.5px] text-[#8696A0] leading-relaxed">
                    Ajusta a largura e altura da janela que surge ao clicar no botão do WhatsApp para listar suas conversas recentes e contatos salvos.
                  </p>

                  {/* Alerta de Esclarecimento Solicitado pelo Usuário */}
                  <div className="flex items-start gap-2 p-2.5 rounded-[6px] bg-[#202C33]/60 border border-white/[0.06] text-[11px] text-[#AEBAC1] leading-snug">
                    <Info className="w-3.5 h-3.5 text-[#25D366] shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-[#E9EDEF]">Atenção:</strong> Esta opção altera exclusivamente o tamanho da janela da <strong>lista de conversas</strong>. As janelas de bate-papo de cada contato possuem dimensionamento independente (que você pode mudar clicando com o botão direito na bolha do contato).
                    </span>
                  </div>

                  {/* Seletor de Tamanho: Pequeno, Padrão, Médio, Grande */}
                  <div className="grid grid-cols-4 gap-2 bg-[#202C33] p-1.5 rounded-[8px] border border-white/10">
                    {(['pequeno', 'padrao', 'medio', 'grande'] as ChatListSize[]).map((sizeKey) => {
                      const isSelected = chatListSize === sizeKey;
                      const config = CHAT_LIST_SIZE_CONFIG[sizeKey];
                      return (
                        <button
                          key={sizeKey}
                          type="button"
                          onClick={() => setChatListSize(sizeKey)}
                          className={`py-2 px-1 rounded-[6px] text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#005C4B] text-[#E9EDEF] font-bold shadow-xs border border-[#25D366]/50'
                              : 'text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[#2A3942]'
                          }`}
                        >
                          <div className="text-[12px] leading-tight">{config.label}</div>
                          <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-[#25D366]' : 'text-[#8696A0]'}`}>
                            {config.width} × {config.height}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-[11px] text-[#8696A0] flex items-center justify-between px-0.5 pt-0.5">
                    <span>{CHAT_LIST_SIZE_CONFIG[chatListSize]?.description}</span>
                    {chatListSize !== 'padrao' && (
                      <button
                        type="button"
                        onClick={() => setChatListSize('padrao')}
                        className="text-[11px] text-[#25D366] hover:underline cursor-pointer"
                      >
                        Restaurar padrão
                      </button>
                    )}
                  </div>
                </section>

                {/* 2. Limite de Quantidade de Bubbles */}
                <section className="bg-[#111B21]/90 rounded-[8px] p-3.5 border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#25D366]" />
                      <span className="text-[13px] font-semibold text-[#E9EDEF]">
                        Limite de Bubbles na Tela
                      </span>
                    </div>
                    <span className="min-w-[28px] px-2.5 py-0.5 rounded-full bg-[#25D366]/20 text-[#25D366] text-[12px] font-bold text-center">
                      {maxBubbles}
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[#8696A0] leading-snug">
                    Quando atingir o limite, uma nova mensagem substitui a bolha mais antiga para dar lugar à mais recente.
                  </p>
                  <input
                    type="range"
                    min={1}
                    max={15}
                    step={1}
                    value={maxBubbles}
                    onChange={(e) => setMaxBubbles(parseInt(e.target.value, 10))}
                    className="w-full accent-[#25D366] cursor-pointer h-1.5 bg-[#2A3942] rounded-lg mt-2"
                  />
                  <div className="flex justify-between text-[10.5px] text-[#8696A0] mt-1">
                    <span>1 bolha</span>
                    <span>Padrão: 10</span>
                    <span>15 bolhas</span>
                  </div>
                </section>

                {/* 3. Conversas ao Abrir o Zapbolhas */}
                <section className="bg-[#111B21]/90 rounded-[8px] p-3.5 border border-white/[0.06] space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Pin className="w-4 h-4 text-[#25D366]" />
                    <span className="text-[13px] font-semibold text-[#E9EDEF]">
                      Ao Abrir o Zapbolhas
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[#8696A0] leading-snug">
                    Defina quais conversas devem surgir como bolhas na tela ao iniciar o aplicativo:
                  </p>

                  <div className="space-y-2 pt-1">
                    {/* Opção 1: Fixas e não lidas nas últimas 48 horas */}
                    <button
                      type="button"
                      onClick={() => setStartupChatFilter('pinned_and_unread_48h')}
                      className={`w-full text-left p-3 rounded-[8px] border transition-all flex items-start gap-3 cursor-pointer ${
                        startupChatFilter === 'pinned_and_unread_48h'
                          ? 'bg-[#005C4B]/20 border-[#25D366]/50 shadow-xs'
                          : 'bg-[#202C33] border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 transition-colors ${
                          startupChatFilter === 'pinned_and_unread_48h'
                            ? 'border-[#25D366] bg-[#25D366]'
                            : 'border-[#8696A0] bg-transparent'
                        }`}
                      >
                        {startupChatFilter === 'pinned_and_unread_48h' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#111B21]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[12px] font-medium ${
                              startupChatFilter === 'pinned_and_unread_48h'
                                ? 'text-[#25D366]'
                                : 'text-[#E9EDEF]'
                            }`}
                          >
                            Fixas + Não lidas (últimas 48h)
                          </span>
                          {startupChatFilter === 'pinned_and_unread_48h' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#25D366]/20 text-[#25D366] font-semibold">
                              Padrão
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#8696A0] leading-tight mt-0.5">
                          Abre as fixadas e as conversas com mensagens não lidas recebidas nas últimas 48 horas.
                        </p>
                      </div>
                    </button>

                    {/* Opção 2: Apenas as conversas fixadas */}
                    <button
                      type="button"
                      onClick={() => setStartupChatFilter('pinned_only')}
                      className={`w-full text-left p-3 rounded-[8px] border transition-all flex items-start gap-3 cursor-pointer ${
                        startupChatFilter === 'pinned_only'
                          ? 'bg-[#005C4B]/20 border-[#25D366]/50 shadow-xs'
                          : 'bg-[#202C33] border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full mt-0.5 border flex items-center justify-center shrink-0 transition-colors ${
                          startupChatFilter === 'pinned_only'
                            ? 'border-[#25D366] bg-[#25D366]'
                            : 'border-[#8696A0] bg-transparent'
                        }`}
                      >
                        {startupChatFilter === 'pinned_only' && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#111B21]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-[12px] font-medium ${
                            startupChatFilter === 'pinned_only'
                              ? 'text-[#25D366]'
                              : 'text-[#E9EDEF]'
                          }`}
                        >
                          Apenas as conversas fixadas
                        </span>
                        <p className="text-[11px] text-[#8696A0] leading-tight mt-0.5">
                          Abre exclusivamente com as conversas que você fixou, mantendo a tela limpa e focada.
                        </p>
                      </div>
                    </button>
                  </div>
                </section>
              </>
            )}

            {/* ============================================================== */}
            {/* ABA 2: APARÊNCIA E BORDAS                                     */}
            {/* ============================================================== */}
            {activeTab === 'aparencia' && (
              <>
                {/* 1. Zoom das Bolinhas */}
                <section className="bg-[#111B21]/90 rounded-[8px] p-3.5 border border-white/[0.06] space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-[#25D366]" />
                      <span className="text-[13px] font-semibold text-[#E9EDEF]">
                        Tamanho das Bolhas (Zoom)
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-semibold text-[#25D366]">
                        {Math.round(bubbleScale * 100)}%
                      </span>
                      {bubbleScale !== 1 && (
                        <button
                          type="button"
                          onClick={() => setBubbleScale(1)}
                          className="text-[10.5px] px-2 py-0.5 rounded bg-[#202C33] hover:bg-[#2A3942] text-[#8696A0] hover:text-[#E9EDEF] cursor-pointer"
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
                    onChange={(e) => setBubbleScale(parseFloat(e.target.value))}
                    className="w-full accent-[#25D366] cursor-pointer h-1.5 bg-[#2A3942] rounded-lg"
                  />
                  <div className="flex justify-between text-[10.5px] text-[#8696A0] mt-1">
                    <span>65% (Menor)</span>
                    <span>100% (Padrão)</span>
                    <span>145% (Maior)</span>
                  </div>
                </section>

                {/* 2. Borda das Bubbles */}
                <section className="bg-[#111B21]/90 rounded-[8px] p-3.5 border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-[#25D366]" />
                      <span className="text-[13px] font-semibold text-[#E9EDEF]">
                        Borda das Bubbles
                      </span>
                    </div>
                  </div>

                  {/* Seletor de Modo: Padrão, Minimalista, Avançado, Personalizada */}
                  <div className="grid grid-cols-4 gap-1 bg-[#202C33] p-1 rounded-[8px] border border-white/10">
                    {[
                      { key: 'default', label: 'Padrão' },
                      { key: 'minimal', label: 'Minimalista' },
                      { key: 'advanced', label: 'Avançado' },
                      { key: 'custom', label: 'Personalizada' },
                    ].map((opt) => {
                      const isSelected = bubbleBorderMode === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setBubbleBorderMode(opt.key as BubbleBorderMode)}
                          className={`py-1.5 text-[11px] rounded-[5px] font-semibold transition-colors text-center cursor-pointer ${
                            isSelected
                              ? 'bg-[#25D366] text-[#111B21] shadow-xs'
                              : 'text-[#8696A0] hover:text-[#E9EDEF]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Conteúdo específico de cada modo */}
                  {bubbleBorderMode === 'default' && (
                    <div className="space-y-2.5 pt-0.5">
                      <div className="text-[11.5px] text-[#8696A0] leading-snug bg-[#202C33]/60 p-2.5 rounded-[6px]">
                        <strong className="text-[#E9EDEF]">Modo Padrão:</strong> Borda branca com <strong>80% de opacidade</strong> e espessura de <strong>1.5px</strong>. Garante contraste nítido e visual refinado.
                      </div>
                      <div className="bg-[#182229] rounded-[8px] p-2.5 border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-[34px] h-[34px] rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-[#202C33]"
                            style={{
                              borderColor: hexToRgba('#FFFFFF', 80),
                              borderWidth: '1.5px',
                              borderStyle: 'solid',
                            }}
                          >
                            <div className="w-full h-full bg-gradient-to-tr from-[#005C4B] to-[#25D366] flex items-center justify-center text-white text-[10px] font-bold">
                              WA
                            </div>
                          </div>
                          <div className="text-[11.5px] leading-snug">
                            <div className="text-[#E9EDEF] font-medium">Borda Branca 80%</div>
                            <div className="text-[#8696A0] text-[10.5px]">Quando aberta em foco, fica exclusivamente verde</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {bubbleBorderMode === 'minimal' && (
                    <div className="space-y-2.5 pt-0.5">
                      <div className="text-[11.5px] text-[#8696A0] leading-snug bg-[#202C33]/60 p-2.5 rounded-[6px]">
                        <strong className="text-[#E9EDEF]">Modo Minimalista:</strong> Borda branca ultra discreta com <strong>15% de opacidade</strong> e espessura de <strong>1.5px</strong>.
                      </div>
                      <div className="bg-[#182229] rounded-[8px] p-2.5 border border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-[34px] h-[34px] rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-[#202C33]"
                            style={{
                              borderColor: hexToRgba('#FFFFFF', 15),
                              borderWidth: '1.5px',
                              borderStyle: 'solid',
                            }}
                          >
                            <div className="w-full h-full bg-gradient-to-tr from-[#005C4B] to-[#25D366] flex items-center justify-center text-white text-[10px] font-bold">
                              WA
                            </div>
                          </div>
                          <div className="text-[11.5px] leading-snug">
                            <div className="text-[#E9EDEF] font-medium">Borda Branca 15%</div>
                            <div className="text-[#8696A0] text-[10.5px]">Quando aberta em foco, fica exclusivamente verde</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {bubbleBorderMode === 'advanced' && (
                    <div className="space-y-2.5 pt-0.5">
                      <div className="text-[11.5px] text-[#8696A0] leading-snug bg-[#202C33]/60 p-2.5 rounded-[6px] space-y-1">
                        <div>
                          <strong className="text-[#E9EDEF]">Modo Avançado (Cores Dinâmicas):</strong> Opacidade de <strong>80%</strong> e <strong>1.5px</strong> com cores que reagem ao status da conversa:
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-white shrink-0" />
                            <span>Lidas: <strong>Branca</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#F04444] shrink-0" />
                            <span>Não lidas: <strong>Vermelha</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#32CAED] shrink-0" />
                            <span>Menção (@): <strong>Azul</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#25D366] shrink-0" />
                            <span>Aberta: <strong>Apenas verde</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Prévia dos 4 estados do modo avançado */}
                      <div className="bg-[#182229] rounded-[8px] p-2.5 border border-white/5 space-y-1.5">
                        <span className="text-[11px] text-[#8696A0] font-medium block">
                          Exemplo visual dos estados:
                        </span>
                        <div className="flex items-center justify-around pt-1">
                          {/* Estado 1: Lida */}
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className="w-[30px] h-[30px] rounded-full overflow-hidden flex items-center justify-center bg-[#2A3942]"
                              style={{
                                borderColor: hexToRgba('#FFFFFF', 80),
                                borderWidth: '1.5px',
                                borderStyle: 'solid',
                              }}
                            >
                              <span className="text-[9px] text-white font-bold">Ana</span>
                            </div>
                            <span className="text-[9.5px] text-[#8696A0]">Lida</span>
                          </div>

                          {/* Estado 2: Não lida */}
                          <div className="flex flex-col items-center gap-1">
                            <div className="relative">
                              <div
                                className="w-[30px] h-[30px] rounded-full overflow-hidden flex items-center justify-center bg-[#2A3942]"
                                style={{
                                  borderColor: hexToRgba('#F04444', 80),
                                  borderWidth: '1.5px',
                                  borderStyle: 'solid',
                                }}
                              >
                                <span className="text-[9px] text-white font-bold">João</span>
                              </div>
                              <span className="absolute -bottom-1 -right-1 min-w-[12px] h-[12px] px-1 rounded-[3px] bg-[#F04444] text-[8px] text-white font-bold flex items-center justify-center">
                                2
                              </span>
                            </div>
                            <span className="text-[9.5px] text-[#F04444]">Nova</span>
                          </div>

                          {/* Estado 3: Menção */}
                          <div className="flex flex-col items-center gap-1">
                            <div className="relative">
                              <div
                                className="w-[30px] h-[30px] rounded-full overflow-hidden flex items-center justify-center bg-[#2A3942]"
                                style={{
                                  borderColor: hexToRgba('#32CAED', 80),
                                  borderWidth: '1.5px',
                                  borderStyle: 'solid',
                                }}
                              >
                                <span className="text-[9px] text-white font-bold">Grupo</span>
                              </div>
                              <span className="absolute -bottom-1 -left-1 w-[12px] h-[12px] rounded-full bg-[#32CAED] text-[#111B21] text-[8px] font-black flex items-center justify-center">
                                @
                              </span>
                            </div>
                            <span className="text-[9.5px] text-[#32CAED]">Menção</span>
                          </div>

                          {/* Estado 4: Aberta em foco (exclusivamente verde) */}
                          <div className="flex flex-col items-center gap-1">
                            <div
                              className="w-[30px] h-[30px] rounded-full overflow-hidden flex items-center justify-center bg-[#2A3942]"
                              style={{
                                borderColor: '#25D366',
                                borderWidth: '2px',
                                borderStyle: 'solid',
                              }}
                            >
                              <span className="text-[9px] text-[#25D366] font-bold">Ativa</span>
                            </div>
                            <span className="text-[9.5px] text-[#25D366] font-medium">Aberta</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {bubbleBorderMode === 'custom' && (
                    <div className="space-y-3 pt-1">
                      {/* Seletor de Cores */}
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
                                className={`w-6 h-6 rounded-full transition-transform flex items-center justify-center cursor-pointer ${
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
                            {bubbleBorderOpacity === 80 && ' (Padrão)'}
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
                            15% (Minimal)
                          </button>
                          <button
                            type="button"
                            onClick={() => setBubbleBorderOpacity(80)}
                            className="hover:text-[#25D366] underline cursor-pointer font-medium text-[#E9EDEF]"
                          >
                            80% (Padrão)
                          </button>
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
                            { label: '1.5px (Padrão)', value: 1.5 },
                            { label: '2px', value: 2 },
                            { label: '3px', value: 3 },
                          ].map((item) => (
                            <button
                              key={item.value}
                              type="button"
                              onClick={() => setBubbleBorderWidth(item.value)}
                              className={`py-1 rounded-[5px] text-[11px] font-medium transition-colors cursor-pointer ${
                                bubbleBorderWidth === item.value
                                  ? 'bg-[#25D366] text-[#111B21] font-bold'
                                  : 'bg-[#202C33] text-[#8696A0] hover:text-[#E9EDEF]'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}

            {/* ============================================================== */}
            {/* ABA 3: SONS E NOTIFICAÇÕES                                    */}
            {/* ============================================================== */}
            {activeTab === 'notificacoes' && (
              <>
                <section className="bg-[#111B21]/90 rounded-[8px] p-3.5 border border-white/[0.06] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {soundMuted ? (
                        <VolumeX className="w-4 h-4 text-[#EF4444]" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-[#25D366]" />
                      )}
                      <span className="text-[13px] font-semibold text-[#E9EDEF]">
                        Sons de Notificação
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSoundMuted(!soundMuted)}
                      className={`px-3 py-1 rounded-full text-[11.5px] font-semibold transition-colors cursor-pointer ${
                        soundMuted
                          ? 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]/40'
                          : 'bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40'
                      }`}
                    >
                      {soundMuted ? 'Mutado (Silencioso)' : 'Ativado'}
                    </button>
                  </div>

                  {/* Som de Contato Individual */}
                  <div className={`space-y-1.5 ${soundMuted ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-between text-[11.5px] text-[#8696A0]">
                      <span>Som de Contato Individual (cooldown 30s)</span>
                      <button
                        type="button"
                        onClick={() => previewNotificationSound(false, userSoundPreset)}
                        title="Testar som de contato"
                        className="flex items-center gap-1 text-[#25D366] hover:underline text-[11px] cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Testar
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
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
                        className="px-2.5 py-1.5 rounded-[6px] bg-[#202C33] hover:bg-[#2A3942] text-[#E9EDEF] border border-white/10 flex items-center gap-1.5 text-[11.5px] shrink-0 cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-[#25D366]" />
                        Arquivo
                      </button>
                    </div>
                  </div>

                  {/* Som de Grupo */}
                  <div className={`space-y-1.5 ${soundMuted ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex items-center justify-between text-[11.5px] text-[#8696A0]">
                      <span>Som de Grupo (cooldown 2 min)</span>
                      <button
                        type="button"
                        onClick={() => previewNotificationSound(true, groupSoundPreset)}
                        title="Testar som de grupo"
                        className="flex items-center gap-1 text-[#25D366] hover:underline text-[11px] cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        Testar
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
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
                        className="px-2.5 py-1.5 rounded-[6px] bg-[#202C33] hover:bg-[#2A3942] text-[#E9EDEF] border border-white/10 flex items-center gap-1.5 text-[11.5px] shrink-0 cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-[#25D366]" />
                        Arquivo
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* ============================================================== */}
            {/* ABA 4: MONITORES E SISTEMA                                    */}
            {/* ============================================================== */}
            {activeTab === 'sistema' && (
              <>
                {/* 1. Tela de Exibição (Monitor) */}
                <section className="bg-[#111B21]/90 rounded-[8px] p-3.5 border border-white/[0.06] space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-[#25D366]" />
                    <span className="text-[13px] font-semibold text-[#E9EDEF]">
                      Tela de Exibição (Monitor)
                    </span>
                  </div>
                  <p className="text-[11.5px] text-[#8696A0] leading-snug">
                    Selecione o monitor onde o dock e as bolhas flutuantes devem permanecer fixados:
                  </p>
                  {displays.length <= 1 ? (
                    <div className="text-[11.5px] text-[#8696A0] bg-[#202C33]/70 px-3 py-2.5 rounded-[6px]">
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
                            className={`w-full text-left px-3 py-2.5 rounded-[6px] text-[12px] flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[#005C4B] text-[#E9EDEF] font-medium border border-[#25D366]/40'
                                : 'bg-[#202C33] text-[#8696A0] hover:bg-[#2A3942] hover:text-[#E9EDEF]'
                            }`}
                          >
                            <span className="truncate">{d.label}</span>
                            {isSelected && (
                              <span className="text-[10.5px] px-2 py-0.5 rounded bg-[#25D366] text-[#111B21] font-bold shrink-0 ml-2">
                                Ativa
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* 2. Dicas e Atalhos do Windows */}
                <section className="bg-[#111B21]/90 rounded-[8px] p-3.5 border border-white/[0.06] space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#25D366]" />
                    <span className="text-[13px] font-semibold text-[#E9EDEF]">
                      Atalhos e Dicas Rápidas
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 pt-1 text-[11.5px] text-[#8696A0]">
                    <div className="p-2.5 rounded-[6px] bg-[#202C33]/60 flex items-start gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#111B21] text-[#E9EDEF] font-mono text-[10px] shrink-0">ESC</span>
                      <span>Fecha imediatamente qualquer janela popover aberta (conversas, contatos ou configurações).</span>
                    </div>
                    <div className="p-2.5 rounded-[6px] bg-[#202C33]/60 flex items-start gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#111B21] text-[#E9EDEF] font-mono text-[10px] shrink-0">Clique Direito</span>
                      <span>Abre o menu de contexto na bolha de qualquer contato para silenciar, fixar ou ajustar o tamanho do chat.</span>
                    </div>
                    <div className="p-2.5 rounded-[6px] bg-[#202C33]/60 flex items-start gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#111B21] text-[#E9EDEF] font-mono text-[10px] shrink-0">Arrastar</span>
                      <span>Arraste pela barra de título superior para mover janelas livremente pela sua área de trabalho.</span>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Seta indicadora inferior apontando para o botão do WhatsApp (apenas quando em modo popover no dock) */}
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
