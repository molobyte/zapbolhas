import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Settings,
  LogOut,
  Power,
  RotateCw,
  Pin,
  PinOff,
  Maximize2,
  ChevronLeft,
  Check,
  CheckCheck,
  CircleDot,
  EyeOff,
  X,
} from 'lucide-react';
import { useBubbleStore } from '../store/useBubbleStore';
import { BubbleItem, CHAT_SIZE_CONFIG } from '../types/whatsapp';
import { ContactBubble } from './ContactBubble';

interface BubbleDockProps {
  onInteractiveEnter: () => void;
  onInteractiveLeave: () => void;
}

export const BubbleDock: React.FC<BubbleDockProps> = ({
  onInteractiveEnter,
  onInteractiveLeave,
}) => {
  const {
    activeBubbles,
    activePopover,
    activeChatId,
    waStatus,
    hasSyncedRealChats,
    bubbleScale,
    toggleMainButton,
    toggleBubbleChat,
    closeBubble,
    togglePinBubble,
    chatSizes,
    setChatBubbleSize,
    markChatAsUnread,
    markChatAsRead,
    openSettings,
    logoutWhatsApp,
    refreshApp,
    dockAnimPhase,
    toggleDockVisibility,
  } = useBubbleStore();

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [bubbleMenu, setBubbleMenu] = useState<{
    bubble: BubbleItem;
    rightPx: number;
  } | null>(null);
  const [showSizeSubmenu, setShowSizeSubmenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const dockContainerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const bubbleMenuRef = useRef<HTMLDivElement | null>(null);

  const isSyncing =
    waStatus === 'initializing' ||
    waStatus === 'authenticated' ||
    (waStatus === 'ready' && !hasSyncedRealChats);

  // Fecha menu do WhatsApp ao clicar fora
  useEffect(() => {
    if (!showContextMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowContextMenu(false);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [showContextMenu]);

  // Fecha menu da bolha ao clicar fora ou ao pressionar Escape
  useEffect(() => {
    if (!bubbleMenu) {
      setShowSizeSubmenu(false);
      return;
    }
    const handleOutsideClick = (e: MouseEvent) => {
      if (bubbleMenuRef.current && !bubbleMenuRef.current.contains(e.target as Node)) {
        setBubbleMenu(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBubbleMenu(null);
      }
    };
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [bubbleMenu]);

  // Se a bolha for fechada ou removida, fecha o menu correspondente
  useEffect(() => {
    if (bubbleMenu && !activeBubbles.some((b) => b.chatId === bubbleMenu.bubble.chatId)) {
      setBubbleMenu(null);
    }
  }, [activeBubbles, bubbleMenu]);

  const handleRightClickLogo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBubbleMenu(null);
    setShowContextMenu((prev) => !prev);
  };

  const handleOpenBubbleMenu = (bubble: BubbleItem, e: React.MouseEvent) => {
    setShowContextMenu(false);
    if (!dockContainerRef.current) return;
    const dockRect = dockContainerRef.current.getBoundingClientRect();
    const targetRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const rightPx = Math.max(0, dockRect.right - targetRect.right);
    setBubbleMenu({ bubble, rightPx });
  };

  return (
    <div ref={dockContainerRef} className="relative flex flex-col items-end">
      {/* Menu de Contexto Flutuante (Botão Direito no Logo do WhatsApp) */}
      <AnimatePresence>
        {showContextMenu && (
          <motion.div
            ref={menuRef}
            data-interactive="true"
            onMouseEnter={onInteractiveEnter}
            onMouseLeave={onInteractiveLeave}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.14 }}
            className="absolute bottom-full right-0 mb-2.5 w-[215px] bg-[#182229]/95 backdrop-blur-md rounded-[10px] shadow-[0_14px_38px_rgba(0,0,0,0.92)] border border-white/15 py-1.5 z-[100] pointer-events-auto overflow-hidden"
          >
            <button
              type="button"
              onClick={() => {
                setShowContextMenu(false);
                toggleDockVisibility(true);
              }}
              className="w-full px-3.5 py-2 text-left text-[13px] text-[#E9EDEF] hover:bg-[#202C33] flex items-center gap-2.5 transition-colors"
            >
              <EyeOff className="w-4 h-4 text-[#25D366]" />
              <span>Esconder ZapBolhas</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowContextMenu(false);
                openSettings();
              }}
              className="w-full px-3.5 py-2 text-left text-[13px] text-[#E9EDEF] hover:bg-[#202C33] flex items-center gap-2.5 transition-colors"
            >
              <Settings className="w-4 h-4 text-[#25D366]" />
              <span>Configurações</span>
            </button>

            <button
              type="button"
              disabled={isRefreshing}
              onClick={async (e) => {
                setIsRefreshing(true);
                try {
                  if (e.ctrlKey || e.shiftKey) {
                    window.electronAPI?.reloadWindow?.();
                    return;
                  }
                  await refreshApp();
                } finally {
                  setTimeout(() => {
                    setIsRefreshing(false);
                    setShowContextMenu(false);
                  }, 350);
                }
              }}
              className="w-full px-3.5 py-2 text-left text-[13px] text-[#E9EDEF] hover:bg-[#202C33] flex items-center gap-2.5 transition-colors disabled:opacity-60"
            >
              <RotateCw
                className={`w-4 h-4 text-[#00A884] ${isRefreshing ? 'animate-spin' : ''}`}
              />
              <span>{isRefreshing ? 'Recarregando...' : 'Recarregar'}</span>
            </button>

            {/* Deslogar no padrão das opções de cima: texto branco e ícone sutil */}
            <button
              type="button"
              onClick={async () => {
                setShowContextMenu(false);
                await logoutWhatsApp();
              }}
              className="w-full px-3.5 py-2 text-left text-[13px] text-[#E9EDEF] hover:bg-[#202C33] flex items-center gap-2.5 transition-colors"
            >
              <LogOut className="w-4 h-4 text-[#8696A0]" />
              <span>Deslogar do WhatsApp</span>
            </button>

            <div className="my-1 border-t border-white/[0.08]" />

            <button
              type="button"
              onClick={() => {
                setShowContextMenu(false);
                window.electronAPI?.quitApp?.();
              }}
              className="w-full px-3.5 py-2 text-left text-[13px] text-[#EF4444] hover:bg-[#202C33] flex items-center gap-2.5 transition-colors"
            >
              <Power className="w-4 h-4 text-[#EF4444]" />
              <span>Sair do aplicativo</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Menu de Contexto Flutuante das Bolhas de Contato (Visualmente idêntico ao de 10.png) */}
      <AnimatePresence>
        {bubbleMenu && (
          <motion.div
            ref={bubbleMenuRef}
            data-interactive="true"
            onMouseEnter={onInteractiveEnter}
            onMouseLeave={onInteractiveLeave}
            style={{ right: `${bubbleMenu.rightPx}px` }}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.14 }}
            className="absolute bottom-full mb-2.5 w-[215px] bg-[#182229]/95 backdrop-blur-md rounded-[10px] shadow-[0_14px_38px_rgba(0,0,0,0.92)] border border-white/15 py-1.5 z-[100] pointer-events-auto select-none"
          >
            {/* Opção 1: Fixar / Desfixar conversa */}
            <button
              type="button"
              onClick={() => {
                togglePinBubble(bubbleMenu.bubble.chatId);
                setBubbleMenu(null);
              }}
              className="w-full px-3.5 py-2 text-left text-[13px] text-[#E9EDEF] hover:bg-[#202C33] flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {bubbleMenu.bubble.isPinned ? (
                  <PinOff className="w-4 h-4 text-[#25D366] shrink-0" />
                ) : (
                  <Pin className="w-4 h-4 text-[#8696A0] shrink-0" />
                )}
                <span className="truncate">
                  {bubbleMenu.bubble.isPinned ? 'Desfixar conversa' : 'Fixar conversa'}
                </span>
              </div>
              {bubbleMenu.bubble.isPinned && (
                <span className="text-[10px] uppercase font-semibold text-[#25D366] bg-[#25D366]/15 px-1.5 py-0.5 rounded shrink-0">
                  Fixada
                </span>
              )}
            </button>

            {/* Opção 2: Marcar como não lido / Marcar como lido */}
            {(() => {
              const isUnread = Boolean(
                bubbleMenu.bubble.isMarkedUnread ||
                bubbleMenu.bubble.unreadCount > 0 ||
                bubbleMenu.bubble.unreadCount === -1
              );
              return (
                <button
                  type="button"
                  onClick={() => {
                    if (isUnread) {
                      markChatAsRead(bubbleMenu.bubble.chatId);
                    } else {
                      markChatAsUnread(bubbleMenu.bubble.chatId);
                    }
                    setBubbleMenu(null);
                  }}
                  className="w-full px-3.5 py-2 text-left text-[13px] text-[#E9EDEF] hover:bg-[#202C33] flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isUnread ? (
                      <CheckCheck className="w-4 h-4 text-[#25D366] shrink-0" />
                    ) : (
                      <CircleDot className="w-4 h-4 text-[#8696A0] shrink-0" />
                    )}
                    <span className="truncate">
                      {isUnread ? 'Marcar como lido' : 'Marcar como não lido'}
                    </span>
                  </div>
                </button>
              );
            })()}

            {/* Opção 3: Tamanho da conversa (com submenu Pequeno, Médio, Grande) */}
            <div
              className="relative"
              onMouseEnter={() => setShowSizeSubmenu(true)}
              onMouseLeave={() => setShowSizeSubmenu(false)}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSizeSubmenu((v) => !v);
                }}
                className="w-full px-3.5 py-2 text-left text-[13px] text-[#E9EDEF] hover:bg-[#202C33] flex items-center justify-between transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Maximize2 className="w-4 h-4 text-[#8696A0] shrink-0" />
                  <span className="whitespace-nowrap">Tamanho da conversa</span>
                </div>
                <ChevronLeft className="w-4 h-4 text-[#8696A0] shrink-0" />
              </button>

              {/* Submenu de Tamanhos (expande para a esquerda) */}
              <AnimatePresence>
                {showSizeSubmenu && (
                  <div className="absolute right-full top-0 pr-1.5 z-[130]">
                    <motion.div
                      initial={{ opacity: 0, x: 6, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 6, scale: 0.95 }}
                      transition={{ duration: 0.12 }}
                      className="w-[160px] bg-[#182229]/95 backdrop-blur-md rounded-[10px] shadow-[0_14px_38px_rgba(0,0,0,0.92)] border border-white/15 py-1.5 overflow-hidden"
                    >
                      {(['pequeno', 'medio', 'grande'] as const).map((sizeKey) => {
                        const isSelected =
                          (chatSizes[bubbleMenu.bubble.chatId] || 'pequeno') === sizeKey;
                        const label = CHAT_SIZE_CONFIG[sizeKey].label;

                        return (
                          <button
                            key={sizeKey}
                            type="button"
                            onClick={() => {
                              setChatBubbleSize(bubbleMenu.bubble.chatId, sizeKey);
                              setBubbleMenu(null);
                            }}
                            className="w-full px-3 py-1.5 text-left text-[12.5px] text-[#E9EDEF] hover:bg-[#202C33] flex items-center justify-between transition-colors"
                          >
                            <span className={isSelected ? 'text-[#25D366] font-medium' : ''}>
                              {label}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-[#25D366]" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>
            </div>

            <div className="my-1 border-t border-white/[0.08]" />

            {/* Opção 3: Fechar */}
            <button
              type="button"
              disabled={bubbleMenu.bubble.isPinned}
              onClick={() => {
                if (bubbleMenu.bubble.isPinned) return;
                closeBubble(bubbleMenu.bubble.chatId);
                setBubbleMenu(null);
              }}
              title={
                bubbleMenu.bubble.isPinned
                  ? 'Desfixe a conversa para poder fechar'
                  : 'Fechar conversa'
              }
              className={`w-full px-3.5 py-2 text-left text-[13px] flex items-center justify-between transition-colors ${
                bubbleMenu.bubble.isPinned
                  ? 'text-[#8696A0]/40 cursor-not-allowed'
                  : 'text-[#EF4444] hover:bg-[#202C33]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <X className="w-4 h-4 shrink-0" />
                <span>Fechar</span>
              </div>
              {bubbleMenu.bubble.isPinned && (
                <span className="text-[10px] text-[#8696A0]/60">Desfixe antes</span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtro SVG Metaball / Mercúrio Líquido para fusão das bolhas com o logo do WhatsApp */}
      <svg width="0" height="0" className="absolute pointer-events-none opacity-0" aria-hidden="true">
        <defs>
          <filter
            id="zapbolhas-mercury-goo"
            x="-50%"
            y="-80%"
            width="200%"
            height="260%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="8.5" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Dock Principal de Bolhas (Escalável em Tempo Real pelo Slider de Zoom) */}
      <div
        data-interactive={dockAnimPhase === 'hidden' ? 'false' : 'true'}
        onMouseEnter={() => {
          if (dockAnimPhase !== 'hidden') onInteractiveEnter();
        }}
        onMouseLeave={onInteractiveLeave}
        style={{
          zoom: bubbleScale,
          filter:
            dockAnimPhase === 'merging' || dockAnimPhase === 'emerging'
              ? 'url(#zapbolhas-mercury-goo)'
              : undefined,
        }}
        className={`flex items-center justify-end gap-[12px] h-[48px] px-4 -mx-4 ${
          dockAnimPhase === 'hidden'
            ? 'pointer-events-none opacity-0'
            : 'pointer-events-auto'
        }`}
      >
        {(dockAnimPhase === 'visible' ||
          dockAnimPhase === 'merging' ||
          dockAnimPhase === 'emerging') && (
          <AnimatePresence mode="popLayout">
            {activeBubbles.map((bubble, idx) => {
              const offsetToLogoPx = (activeBubbles.length - idx) * 60;
              return (
                <ContactBubble
                  key={bubble.chatId}
                  bubble={bubble}
                  isActive={activePopover === 'chat-window' && activeChatId === bubble.chatId}
                  mercuryPhase={dockAnimPhase}
                  offsetToLogoPx={offsetToLogoPx}
                  onSelect={(chatId) => {
                    setBubbleMenu(null);
                    toggleBubbleChat(chatId);
                  }}
                  onClose={closeBubble}
                  onOpenContextMenu={handleOpenBubbleMenu}
                />
              );
            })}
          </AnimatePresence>
        )}

        {/* Botão Fixo Verde do WhatsApp (Extrema Direita) */}
        <motion.button
          type="button"
          onClick={() => {
            if (dockAnimPhase !== 'visible') return;
            setShowContextMenu(false);
            setBubbleMenu(null);
            toggleMainButton();
          }}
          onContextMenu={(e) => {
            if (dockAnimPhase !== 'visible') return;
            handleRightClickLogo(e);
          }}
          whileTap={dockAnimPhase === 'visible' ? { scale: 0.94 } : undefined}
          animate={
            dockAnimPhase === 'merging'
              ? { scale: [1, 1.06, 1.24, 1.15], opacity: 1 }
              : dockAnimPhase === 'zooming-out'
              ? { scale: [1.15, 1.36, 0], opacity: [1, 1, 0] }
              : dockAnimPhase === 'hidden'
              ? { scale: 0, opacity: 0 }
              : dockAnimPhase === 'zooming-in'
              ? { scale: [0, 1.28, 1.08], opacity: [0, 1, 1] }
              : dockAnimPhase === 'emerging'
              ? { scale: [1.08, 0.94, 1], opacity: 1 }
              : { scale: 1, opacity: 1 }
          }
          transition={
            dockAnimPhase === 'merging'
              ? { duration: 0.44, ease: 'easeInOut' }
              : dockAnimPhase === 'zooming-out'
              ? { duration: 0.31, times: [0, 0.34, 1], ease: 'easeInOut' }
              : dockAnimPhase === 'zooming-in'
              ? { duration: 0.25, times: [0, 0.68, 1], ease: 'easeOut' }
              : dockAnimPhase === 'emerging'
              ? { duration: 0.44, ease: 'easeOut' }
              : { type: 'spring', stiffness: 420, damping: 25 }
          }
          title={
            isSyncing
              ? 'Sincronizando conversas do WhatsApp... (Clique direito para opções)'
              : 'WhatsApp Bubbles (Clique esquerdo: conversas | Clique direito: opções)'
          }
          className="relative z-30 w-[48px] h-[48px] shrink-0 rounded-full bg-[#25D366] hover:bg-[#22c55e] text-white shadow-[0_4px_14px_rgba(0,0,0,0.65)] flex items-center justify-center focus:outline-none"
        >
          {/* Ícone Oficial do WhatsApp */}
          <svg
            viewBox="0 0 24 24"
            className={`w-[26px] h-[26px] fill-current ${
              isSyncing ? 'animate-pulse' : ''
            }`}
            aria-hidden="true"
          >
            <path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.469 3.484 1.359 5.016L2 22l5.156-1.359c1.484.813 3.156 1.25 4.875 1.25 5.516 0 9.969-4.453 9.969-9.969S17.547 2 12.031 2zm0 18.25c-1.5 0-2.969-.406-4.266-1.172l-.313-.188-3.047.797.813-2.969-.203-.313c-.844-1.344-1.281-2.891-1.281-4.484 0-4.594 3.734-8.328 8.328-8.328 4.578 0 8.313 3.734 8.313 8.328 0 4.594-3.734 8.328-8.344 8.328zm4.563-6.219c-.25-.125-1.484-.734-1.719-.813-.234-.078-.391-.125-.563.125-.172.25-.641.813-.797.984-.141.172-.297.188-.547.063-.25-.125-1.063-.391-2.016-1.25-.75-.672-1.25-1.484-1.406-1.734-.141-.25-.016-.391.109-.516.109-.109.25-.297.375-.438.125-.141.172-.25.25-.422.078-.172.047-.313-.016-.438-.063-.125-.563-1.359-.766-1.859-.203-.484-.406-.422-.563-.422-.141-.016-.313-.016-.484-.016s-.438.063-.672.313c-.234.25-.891.875-.891 2.125s.906 2.469 1.031 2.641c.125.172 1.781 2.719 4.313 3.813.609.266 1.078.422 1.453.531.609.188 1.156.172 1.594.109.484-.078 1.484-.609 1.688-1.203.219-.594.219-1.094.156-1.203-.063-.094-.234-.156-.484-.281z" />
          </svg>
          {isSyncing && dockAnimPhase === 'visible' && (
            <>
              <span
                title="Sincronizando WhatsApp..."
                className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#FBBF24] border-2 border-[#111B21] animate-ping"
              />
              <span
                title="Sincronizando WhatsApp..."
                className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#FBBF24] border-2 border-[#111B21]"
              />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
};
