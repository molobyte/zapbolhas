import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pin } from 'lucide-react';
import { BubbleItem } from '../types/whatsapp';
import { useBubbleStore } from '../store/useBubbleStore';
import { hexToRgba } from '../utils/colorUtils';

interface ContactBubbleProps {
  bubble: BubbleItem;
  isActive: boolean;
  onSelect: (chatId: string) => void;
  onClose: (chatId: string) => void;
  onOpenContextMenu: (bubble: BubbleItem, e: React.MouseEvent) => void;
}

export const ContactBubble: React.FC<ContactBubbleProps> = ({
  bubble,
  isActive,
  onSelect,
  onClose,
  onOpenContextMenu,
}) => {
  const {
    bubbleBorderMode,
    bubbleBorderColor,
    bubbleBorderOpacity,
    bubbleBorderWidth,
  } = useBubbleStore();

  const isCustomBorder = bubbleBorderMode === 'custom';
  const customBorderRgba = isCustomBorder
    ? hexToRgba(bubbleBorderColor, bubbleBorderOpacity)
    : undefined;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onOpenContextMenu(bubble, e);
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
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.2, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      className="relative group select-none w-[48px] h-[48px] shrink-0 flex items-center justify-center"
    >
      {/* Botão Principal da Bolha */}
      <button
        type="button"
        onClick={() => onSelect(bubble.chatId)}
        onContextMenu={handleContextMenu}
        onAuxClick={handleAuxClick}
        title={`${bubble.name}${bubble.isPinned ? ' (Fixada)' : ''} (Clique direito para opções)`}
        style={
          isCustomBorder
            ? {
                borderColor: customBorderRgba,
                borderWidth: `${bubbleBorderWidth || 1.5}px`,
                borderStyle: 'solid',
              }
            : undefined
        }
        className={`relative w-[48px] h-[48px] rounded-full overflow-hidden shrink-0 block shadow-[0_4px_14px_rgba(0,0,0,0.65)] transition-transform duration-150 hover:scale-105 active:scale-95 focus:outline-none ${
          isActive
            ? isCustomBorder
              ? 'ring-2 ring-[#25D366]'
              : 'ring-2 ring-[#25D366] border border-white/30'
            : isCustomBorder
              ? ''
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

      {/* Badge de Mensagens Não Lidas / Marcado como Não Lido */}
      <AnimatePresence>
        {bubble.isMarkedUnread || bubble.unreadCount === -1 ? (
          <motion.span
            key="marked-unread-badge"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 20 }}
            title="Marcada como não lida"
            className="pointer-events-none absolute -bottom-[3px] -right-[2px] w-[18px] h-[18px] rounded-[5px] bg-[#25D366] text-white flex items-center justify-center shadow-[0_2px_6px_rgba(0,0,0,0.55)] z-10"
          >
            <span className="w-2 h-2 rounded-full bg-white shadow-xs" />
          </motion.span>
        ) : bubble.unreadCount > 0 ? (
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
        ) : null}
      </AnimatePresence>

      {/* Bolinha de Notificação de Menção no Canto Inferior Esquerdo (@ em #32CAED) */}
      <AnimatePresence>
        {bubble.hasMention && (bubble.unreadCount > 0 || bubble.isMarkedUnread || bubble.unreadCount === -1) && !isActive && (
          <motion.span
            key="mention-badge"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 520, damping: 20 }}
            title="Você foi marcado neste grupo"
            className="pointer-events-none absolute -bottom-[3px] -left-[2px] w-[19px] h-[19px] rounded-full bg-[#32CAED] text-[#111B21] text-[11.5px] font-black leading-none flex items-center justify-center shadow-[0_2px_6px_rgba(0,0,0,0.55)] border border-[#111B21]/60 z-10 select-none"
          >
            @
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
