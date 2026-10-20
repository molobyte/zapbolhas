import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pin, PinOff, Maximize2, ChevronLeft, Check } from 'lucide-react';
import { BubbleItem, ChatBubbleSize, CHAT_SIZE_CONFIG } from '../types/whatsapp';
import { useBubbleStore } from '../store/useBubbleStore';

interface ContactBubbleProps {
  bubble: BubbleItem;
  isActive: boolean;
  isContextMenuOpen: boolean;
  onSelect: (chatId: string) => void;
  onClose: (chatId: string) => void;
  onOpenContextMenu: (chatId: string) => void;
  onCloseContextMenu: () => void;
  onInteractiveEnter: () => void;
  onInteractiveLeave: () => void;
}

export const ContactBubble: React.FC<ContactBubbleProps> = ({
  bubble,
  isActive,
  isContextMenuOpen,
  onSelect,
  onClose,
  onOpenContextMenu,
  onCloseContextMenu,
  onInteractiveEnter,
  onInteractiveLeave,
}) => {
  const { togglePinBubble, chatSizes, setChatBubbleSize } = useBubbleStore();
  const [showSizeSubmenu, setShowSizeSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const currentSizeKey: ChatBubbleSize = chatSizes[bubble.chatId] || 'pequeno';

  useEffect(() => {
    if (!isContextMenuOpen) {
      setShowSizeSubmenu(false);
      return;
    }

    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseContextMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseContextMenu();
      }
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isContextMenuOpen, onCloseContextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenContextMenu(bubble.chatId);
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      if (!bubble.isPinned) {
        onClose(bubble.chatId);
      }
    }
  };

  return (
    <motion.div
      layout
      initial={{ scale: 0.3, opacity: 0, y: 16 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.2, opacity: 0, y: 12 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      className="relative group select-none"
    >
      {/* Menu de Contexto Flutuante do Bubble */}
      <AnimatePresence>
        {isContextMenuOpen && (
          <motion.div
            ref={menuRef}
            data-interactive="true"
            onMouseEnter={onInteractiveEnter}
            onMouseLeave={onInteractiveLeave}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.14 }}
            className="absolute bottom-full right-0 mb-2.5 w-[215px] bg-[#182229]/95 backdrop-blur-md rounded-[10px] shadow-[0_14px_38px_rgba(0,0,0,0.92)] border border-white/15 py-1.5 z-[120] pointer-events-auto"
          >
            {/* Opção 1: Fixar / Desfixar conversa */}
            <button
              type="button"
              onClick={() => {
                togglePinBubble(bubble.chatId);
                onCloseContextMenu();
              }}
              className="w-full px-3.5 py-2 text-left text-[13px] text-[#E9EDEF] hover:bg-[#202C33] flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-2.5">
                {bubble.isPinned ? (
                  <PinOff className="w-4 h-4 text-[#25D366]" />
                ) : (
                  <Pin className="w-4 h-4 text-[#8696A0]" />
                )}
                <span>{bubble.isPinned ? 'Desfixar conversa' : 'Fixar conversa'}</span>
              </div>
              {bubble.isPinned && (
                <span className="text-[10px] uppercase font-semibold text-[#25D366] bg-[#25D366]/15 px-1.5 py-0.5 rounded">
                  Fixada
                </span>
              )}
            </button>

            {/* Opção 2: Tamanho da conversa (com submenu Pequeno, Médio, Grande) */}
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
                <div className="flex items-center gap-2.5">
                  <Maximize2 className="w-4 h-4 text-[#8696A0]" />
                  <span>Tamanho da conversa</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#8696A0]">
                  <span className="text-[11px] capitalize">
                    {currentSizeKey === 'pequeno'
                      ? 'Pequeno'
                      : currentSizeKey === 'medio'
                      ? 'Médio'
                      : 'Grande'}
                  </span>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </div>
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
                      className="w-[170px] bg-[#182229]/95 backdrop-blur-md rounded-[10px] shadow-[0_14px_38px_rgba(0,0,0,0.92)] border border-white/15 py-1.5 overflow-hidden"
                    >
                      {(['pequeno', 'medio', 'grande'] as const).map((sizeKey) => {
                        const isSelected = currentSizeKey === sizeKey;
                        const label = CHAT_SIZE_CONFIG[sizeKey].label;

                        return (
                          <button
                            key={sizeKey}
                            type="button"
                            onClick={() => {
                              setChatBubbleSize(bubble.chatId, sizeKey);
                              onCloseContextMenu();
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

            {/* Opção 3: Fechar (bloqueado se a bolha estiver fixada) */}
            <button
              type="button"
              disabled={bubble.isPinned}
              onClick={() => {
                if (bubble.isPinned) return;
                onClose(bubble.chatId);
                onCloseContextMenu();
              }}
              title={
                bubble.isPinned
                  ? 'Desfixe a conversa para poder fechar'
                  : 'Fechar conversa'
              }
              className={`w-full px-3.5 py-2 text-left text-[13px] flex items-center justify-between transition-colors ${
                bubble.isPinned
                  ? 'text-[#8696A0]/40 cursor-not-allowed'
                  : 'text-[#EF4444] hover:bg-[#202C33]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <X className="w-4 h-4" />
                <span>Fechar</span>
              </div>
              {bubble.isPinned && (
                <span className="text-[10px] text-[#8696A0]/60">Desfixe antes</span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão Principal da Bolha */}
      <button
        type="button"
        onClick={() => {
          onCloseContextMenu();
          onSelect(bubble.chatId);
        }}
        onContextMenu={handleContextMenu}
        onAuxClick={handleAuxClick}
        title={`${bubble.name}${bubble.isPinned ? ' (Fixada)' : ''} (Clique direito para opções)`}
        className={`relative w-[48px] h-[48px] rounded-full overflow-hidden shadow-[0_4px_14px_rgba(0,0,0,0.65)] transition-transform duration-150 hover:scale-105 active:scale-95 focus:outline-none ${
          isActive
            ? 'ring-2 ring-[#25D366] border border-white/30'
            : 'border-[1.5px] border-white/15'
        }`}
      >
        <img
          src={bubble.avatar}
          alt={bubble.name}
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      </button>

      {/* Ícone de Pin no canto superior direito quando fixada */}
      {bubble.isPinned ? (
        <div
          title="Conversa fixada (não pode ser fechada até desfixar)"
          className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-[#182229] text-[#25D366] border border-[#25D366]/40 shadow-md flex items-center justify-center z-20 pointer-events-none"
        >
          <Pin className="w-2.5 h-2.5 fill-[#25D366] text-[#25D366] rotate-45" />
        </div>
      ) : (
        /* Botão Fechar (X) em Hover quando não fixada */
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose(bubble.chatId);
          }}
          title="Fechar bolha"
          className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-[#182229] text-[#E9EDEF] border border-white/20 shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[#EF4444] hover:border-[#EF4444] transition-all duration-150 z-20"
        >
          <X className="w-3 h-3 stroke-[2.5]" />
        </button>
      )}

      {/* Badge de Mensagens Não Lidas */}
      <AnimatePresence mode="popLayout">
        {bubble.unreadCount > 0 && (
          <motion.span
            key={bubble.unreadCount}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 20 }}
            className="pointer-events-none absolute -bottom-[3px] -right-[2px] min-w-[18px] h-[20px] px-[5px] rounded-[5px] bg-[#F04444] text-white text-[12px] font-semibold leading-none flex items-center justify-center shadow-[0_2px_6px_rgba(0,0,0,0.55)] z-10"
          >
            {bubble.unreadCount}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
