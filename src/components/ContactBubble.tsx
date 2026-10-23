import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pin, Play, Pause } from 'lucide-react';
import { BubbleItem } from '../types/whatsapp';
import { useBubbleStore } from '../store/useBubbleStore';
import { useAudioPlaybackStore } from '../store/useAudioPlaybackStore';
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

  const activeAudio = useAudioPlaybackStore((state) => state.activeAudio);
  const isAudioActiveForThisChat = Boolean(
    activeAudio && activeAudio.chatId === bubble.chatId
  );
  const isAudioPlaying = Boolean(
    isAudioActiveForThisChat && activeAudio?.isPlaying
  );

  let borderStyle: React.CSSProperties;

  if (isActive) {
    // Quando a conversa está aberta/ativa:
    // Apenas a borda verde oficial (sem borda branca ou colorida concorrente)
    borderStyle = {
      borderColor: '#25D366',
      borderWidth: '2px',
      borderStyle: 'solid',
    };
  } else if (bubbleBorderMode === 'minimal') {
    // Modo minimalista: Cor branca com 15% de opacidade e espessura de 1.5
    borderStyle = {
      borderColor: hexToRgba('#FFFFFF', 15),
      borderWidth: '1.5px',
      borderStyle: 'solid',
    };
  } else if (bubbleBorderMode === 'advanced') {
    // Modo avançado: Opacidade de 80% e espessura de 1.5, cores reativas ao status
    const isUnread = Boolean(
      bubble.unreadCount > 0 || bubble.isMarkedUnread || bubble.unreadCount === -1
    );
    const hasMention = Boolean(bubble.hasMention && isUnread);

    let hexColor = '#FFFFFF'; // Branca para conversas lidas / sem notificação
    if (hasMention) {
      hexColor = '#32CAED'; // Mesma cor azul usada no quadrado/badge de marcação
    } else if (bubble.isMarkedUnread || bubble.unreadCount === -1) {
      hexColor = '#25D366'; // Mesma cor verde usada no badge de marcado como não lido
    } else if (bubble.unreadCount > 0) {
      hexColor = '#F04444'; // Mesma cor do quadrado de mensagens não lidas
    }

    borderStyle = {
      borderColor: hexToRgba(hexColor, 80),
      borderWidth: '1.5px',
      borderStyle: 'solid',
    };
  } else if (bubbleBorderMode === 'custom') {
    // Modo personalizado: Cor, opacidade e espessura livres
    borderStyle = {
      borderColor: hexToRgba(bubbleBorderColor || '#FFFFFF', bubbleBorderOpacity ?? 80),
      borderWidth: `${bubbleBorderWidth || 1.5}px`,
      borderStyle: 'solid',
    };
  } else {
    // Modo padrão: Cor branca com 80% de opacidade e espessura de 1.5
    borderStyle = {
      borderColor: hexToRgba('#FFFFFF', 80),
      borderWidth: '1.5px',
      borderStyle: 'solid',
    };
  }

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
        style={borderStyle}
        className="relative w-[48px] h-[48px] rounded-full overflow-hidden shrink-0 block shadow-[0_4px_14px_rgba(0,0,0,0.65)] transition-transform duration-150 hover:scale-105 active:scale-95 focus:outline-none"
      >
        <img
          src={bubble.avatar}
          alt={bubble.name}
          className="w-full h-full object-cover pointer-events-none"
          draggable={false}
        />
      </button>

      {/* Botão de Controle de Áudio Tocando no Canto Superior Esquerdo */}
      <AnimatePresence>
        {isAudioActiveForThisChat && (
          <motion.button
            key="audio-bubble-indicator"
            type="button"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            onClick={(e) => {
              e.stopPropagation();
              useAudioPlaybackStore.getState().togglePlay();
            }}
            title={
              isAudioPlaying
                ? 'Pausar áudio (clique para pausar)'
                : 'Continuar áudio (clique para reproduzir)'
            }
            className="absolute -top-1 -left-1 w-[20px] h-[20px] rounded-full bg-[#00A884] hover:bg-[#00c298] text-white border-2 border-[#111B21] shadow-[0_2px_8px_rgba(0,168,132,0.7)] flex items-center justify-center z-30 transition-transform hover:scale-110 active:scale-90 cursor-pointer"
          >
            {isAudioPlaying ? (
              <span className="relative flex items-center justify-center">
                <span className="absolute -inset-1 rounded-full bg-[#25D366]/40 animate-ping pointer-events-none" />
                <Pause className="w-2.5 h-2.5 fill-current" />
              </span>
            ) : (
              <Play className="w-2.5 h-2.5 fill-current ml-[1px]" />
            )}
          </motion.button>
        )}
      </AnimatePresence>

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
