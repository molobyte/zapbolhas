import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { BubbleItem } from '../types/whatsapp';

interface ContactBubbleProps {
  bubble: BubbleItem;
  isActive: boolean;
  onSelect: (chatId: string) => void;
  onClose: (chatId: string) => void;
}

export const ContactBubble: React.FC<ContactBubbleProps> = ({
  bubble,
  isActive,
  onSelect,
  onClose,
}) => {
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose(bubble.chatId);
  };

  const handleAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      onClose(bubble.chatId);
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
      <button
        type="button"
        onClick={() => onSelect(bubble.chatId)}
        onContextMenu={handleContextMenu}
        onAuxClick={handleAuxClick}
        title={`${bubble.name} (Clique direito para fechar)`}
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

      {/* Botão Fechar (X) em Hover */}
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

      {/* Badge de Mensagens Não Lidas (idêntico à imagem de referência) */}
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
