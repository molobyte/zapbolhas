import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Settings, LogOut, Power, RotateCw } from 'lucide-react';
import { useBubbleStore } from '../store/useBubbleStore';
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
    openSettings,
    logoutWhatsApp,
    refreshApp,
  } = useBubbleStore();

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isSyncing =
    waStatus === 'initializing' ||
    waStatus === 'authenticated' ||
    (waStatus === 'ready' && !hasSyncedRealChats);

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

  const handleRightClickLogo = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowContextMenu((prev) => !prev);
  };

  return (
    <div className="relative flex flex-col items-end">
      {/* Menu de Contexto Flutuante (Botão Direito no Logo do WhatsApp) — Sobreposto sem empurrar menus */}
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

            <button
              type="button"
              onClick={async () => {
                setShowContextMenu(false);
                await logoutWhatsApp();
              }}
              className="w-full px-3.5 py-2 text-left text-[13px] text-[#FBBF24] hover:bg-[#202C33] flex items-center gap-2.5 transition-colors"
            >
              <LogOut className="w-4 h-4 text-[#FBBF24]" />
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

      {/* Dock Principal de Bolhas (Escalável em Tempo Real pelo Slider de Zoom) */}
      <div
        data-interactive="true"
        onMouseEnter={onInteractiveEnter}
        onMouseLeave={onInteractiveLeave}
        style={{ zoom: bubbleScale }}
        className="flex items-center justify-end gap-[12px] pointer-events-auto"
      >
        <AnimatePresence mode="popLayout">
          {activeBubbles.map((bubble) => (
            <ContactBubble
              key={bubble.chatId}
              bubble={bubble}
              isActive={activePopover === 'chat-window' && activeChatId === bubble.chatId}
              onSelect={toggleBubbleChat}
              onClose={closeBubble}
            />
          ))}
        </AnimatePresence>

        {/* Botão Fixo Verde do WhatsApp (Extrema Direita) */}
        <motion.button
          type="button"
          onClick={() => {
            setShowContextMenu(false);
            toggleMainButton();
          }}
          onContextMenu={handleRightClickLogo}
          whileTap={{ scale: 0.94 }}
          title={
            isSyncing
              ? 'Sincronizando conversas do WhatsApp... (Clique direito para opções)'
              : 'WhatsApp Bubbles (Clique esquerdo: conversas | Clique direito: opções)'
          }
          className="relative w-[48px] h-[48px] rounded-full bg-[#25D366] hover:bg-[#22c55e] text-white shadow-[0_4px_14px_rgba(0,0,0,0.65)] flex items-center justify-center transition-transform duration-150 hover:scale-105 focus:outline-none"
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
          {isSyncing && (
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
