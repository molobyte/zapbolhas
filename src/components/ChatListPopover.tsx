import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useBubbleStore } from '../store/useBubbleStore';
import { ChatSummary } from '../types/whatsapp';

interface ChatListPopoverProps {
  onInteractiveEnter: () => void;
  onInteractiveLeave: () => void;
}

const StickerIcon: React.FC = () => (
  <svg
    viewBox="0 0 16 16"
    className="w-[13px] h-[13px] text-[#8696A0] shrink-0 inline-block"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
  >
    <path d="M3.5 2h9A1.5 1.5 0 0 1 14 3.5v6.2a1.5 1.5 0 0 1-.44 1.06l-2.8 2.8A1.5 1.5 0 0 1 9.7 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2Z" />
    <path d="M9.5 13.8V10.5A1.5 1.5 0 0 1 11 9h2.8" />
  </svg>
);

const PhotoIcon: React.FC = () => (
  <svg
    viewBox="0 0 16 16"
    className="w-[13px] h-[13px] text-[#8696A0] shrink-0 inline-block"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
  >
    <rect x="2" y="2.5" width="12" height="11" rx="1.8" />
    <circle cx="5.5" cy="6" r="1.1" fill="currentColor" stroke="none" />
    <path d="m2.5 11.5 3.2-3.2a1 1 0 0 1 1.4 0l2.4 2.4 1.6-1.6a1 1 0 0 1 1.4 0l1.5 1.5" />
  </svg>
);

const DoubleCheckIcon: React.FC<{ read?: boolean }> = ({ read }) => (
  <svg
    viewBox="0 0 16 11"
    className={`w-[15px] h-[11px] shrink-0 inline-block ${
      read ? 'text-[#53BDEB]' : 'text-[#8696A0]'
    }`}
    fill="currentColor"
  >
    <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.336-.146.47.47 0 0 0-.343.146l-.311.31a.445.445 0 0 0-.14.337c0 .136.047.25.14.343l2.996 2.996a.724.724 0 0 0 .502.203.697.697 0 0 0 .546-.266l6.646-8.417a.497.497 0 0 0 .108-.299.441.441 0 0 0-.19-.374l-.338-.273Zm3.614 0a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.2-1.135-.66.819 1.67 1.67a.724.724 0 0 0 .502.203.697.697 0 0 0 .546-.266l6.646-8.417a.497.497 0 0 0 .108-.299.441.441 0 0 0-.19-.374l-.347-.273Z" />
  </svg>
);

const GreenMicIcon: React.FC = () => (
  <svg
    viewBox="0 0 14 16"
    className="w-[12px] h-[13px] text-[#00A884] shrink-0 inline-block"
    fill="currentColor"
  >
    <path d="M7 10.5a2.5 2.5 0 0 0 2.5-2.5V3.5a2.5 2.5 0 1 0-5 0V8A2.5 2.5 0 0 0 7 10.5Z" />
    <path d="M3 7.5a.5.5 0 0 1 .5.5 3.5 3.5 0 1 0 7 0 .5.5 0 0 1 1 0 4.5 4.5 0 0 1-4 4.473V14h1.5a.5.5 0 0 1 0 1h-4a.5.5 0 0 1 0-1H6.5v-1.527A4.5 4.5 0 0 1 2.5 8a.5.5 0 0 1 .5-.5Z" />
  </svg>
);

export const ChatListPopover: React.FC<ChatListPopoverProps> = ({
  onInteractiveEnter,
  onInteractiveLeave,
}) => {
  const { chats, selectChatFromList, hasSyncedRealChats, waStatus } =
    useBubbleStore();

  // Permite fechar a lista de conversas pressionando ESC
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        useBubbleStore.setState({ activePopover: 'none' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const isLoadingChats = !hasSyncedRealChats && chats.length === 0;

  const renderLastMessagePreview = (chat: ChatSummary) => {
    const { lastMessage } = chat;

    if (lastMessage.mediaType === 'audio') {
      return (
        <span className="flex items-center gap-1 text-[12.5px] text-[#8696A0] truncate">
          {lastMessage.fromMe && <DoubleCheckIcon read={lastMessage.ack === 'read'} />}
          <GreenMicIcon />
          <span>{lastMessage.duration || lastMessage.text}</span>
        </span>
      );
    }

    if (lastMessage.mediaType === 'sticker') {
      return (
        <span className="flex items-center gap-1 text-[12.5px] text-[#8696A0] truncate">
          {lastMessage.senderName && (
            <span className="truncate max-w-[140px]">{lastMessage.senderName}:</span>
          )}
          <StickerIcon />
          <span>Figurinha</span>
        </span>
      );
    }

    if (lastMessage.mediaType === 'photo' || lastMessage.mediaType === 'video') {
      return (
        <span className="flex items-center gap-1 text-[12.5px] text-[#8696A0] truncate">
          {lastMessage.senderName && (
            <span className="truncate max-w-[140px]">{lastMessage.senderName}:</span>
          )}
          <PhotoIcon />
          <span>
            {lastMessage.text || (lastMessage.mediaType === 'video' ? 'Vídeo' : 'Foto')}
          </span>
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-[12.5px] text-[#8696A0] truncate">
        {lastMessage.fromMe && <DoubleCheckIcon read={lastMessage.ack === 'read'} />}
        <span className="truncate">
          {lastMessage.senderName
            ? `${lastMessage.senderName}: ${lastMessage.text}`
            : lastMessage.text}
        </span>
      </span>
    );
  };

  return (
    <motion.div
      data-interactive="true"
      onMouseEnter={onInteractiveEnter}
      onMouseLeave={onInteractiveLeave}
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className="relative w-[310px] h-[440px] bg-[#18191B] rounded-[6px] shadow-[0_14px_40px_rgba(0,0,0,0.85)] border border-white/[0.05] flex flex-col pointer-events-auto group/list"
    >
      {isLoadingChats ? (
        <div className="flex-1 flex flex-col justify-between py-4 px-3 overflow-hidden">
          {/* Banner superior de status de sincronização */}
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-[6px] bg-[#202C33]/90 border border-white/[0.05]">
            <Loader2 className="w-5 h-5 text-[#25D366] animate-spin shrink-0" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-[#E9EDEF] leading-tight">
                Carregando conversas...
              </div>
              <div className="text-[11px] text-[#8696A0] truncate mt-0.5">
                {waStatus === 'authenticated' || waStatus === 'ready'
                  ? 'Sincronizando mensagens recentes'
                  : 'Conectando à sessão do WhatsApp'}
              </div>
            </div>
          </div>

          {/* Esqueleto animado (Skeleton) das linhas de conversa */}
          <div className="flex-1 flex flex-col justify-around py-2">
            {[0, 1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 px-2 py-2 animate-pulse"
              >
                <div className="w-[42px] h-[42px] rounded-full bg-[#2A3942]/80 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-[#2A3942]/80 rounded w-3/5" />
                  <div className="h-2.5 bg-[#202C33] rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Lista de Conversas Rolável */
        <div className="flex-1 overflow-y-auto py-2 px-1.5 wa-scrollbar">
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              onClick={() => selectChatFromList(chat.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[5px] hover:bg-[#202C33]/80 active:bg-[#202C33] transition-colors text-left group"
            >
              {/* Avatar do Contato ou Grupo/Comunidade */}
              <div className="relative w-[42px] h-[42px] shrink-0 flex items-center justify-center">
                <img
                  src={chat.avatar}
                  alt={chat.name}
                  className={`w-[42px] h-[42px] object-cover ${
                    chat.parentName ? 'rounded-[8px]' : 'rounded-full'
                  }`}
                  draggable={false}
                />
              </div>

              {/* Textos Centralizados */}
              <div className="flex-1 min-w-0">
                {chat.parentName && (
                  <div className="text-[11px] text-[#8696A0] leading-tight truncate mb-[1px]">
                    {chat.parentName}
                  </div>
                )}
                <div className="text-[14px] font-medium text-[#E9EDEF] leading-snug truncate">
                  {chat.name}
                </div>
                <div className="mt-[1px]">{renderLastMessagePreview(chat)}</div>
              </div>

              {/* Indicador numérico de mensagens não lidas à direita */}
              {chat.unreadCount > 0 && (
                <div className="shrink-0 pl-1 flex items-center justify-end">
                  <span className="min-w-[20px] h-[20px] px-[6px] rounded-full bg-[#25D366] text-[#111B21] text-[11.5px] font-bold leading-none flex items-center justify-center shadow-sm">
                    {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Seta / Triângulo Inferior Direito Apontando exatamente para o Centro do Botão Verde do WhatsApp */}
      <div
        style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
        className="w-[16px] h-[8px] bg-[#18191B] absolute top-full -mt-[1px] right-[16px] pointer-events-none z-30"
        aria-hidden="true"
      />
    </motion.div>
  );
};
