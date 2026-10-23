import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  CheckSquare,
  Bell,
  BellOff,
  Pin,
  X,
  Users,
  User,
} from 'lucide-react';
import { ChatSummary, DEFAULT_AVATAR } from '../types/whatsapp';
import { FormattedText } from './FormattedText';

interface ChatContactSidebarProps {
  chat: ChatSummary;
  isPinned: boolean;
  onTogglePin: () => void;
  onToggleMute: () => void;
  onStartSearch: () => void;
  onStartSelection: () => void;
  onClose: () => void;
}

export const ChatContactSidebar: React.FC<ChatContactSidebarProps> = ({
  chat,
  isPinned,
  onTogglePin,
  onToggleMute,
  onStartSearch,
  onStartSelection,
  onClose,
}) => {
  const [avatarUrl, setAvatarUrl] = useState<string>(chat.avatar || DEFAULT_AVATAR);

  // Busca avatar de alta resolução via API do Electron quando disponível
  useEffect(() => {
    let isCancelled = false;
    setAvatarUrl(chat.avatar || DEFAULT_AVATAR);

    if (window.electronAPI?.getHighResProfilePic && chat.id) {
      window.electronAPI
        .getHighResProfilePic(chat.id)
        .then((hdUrl) => {
          if (!isCancelled && hdUrl && typeof hdUrl === 'string') {
            setAvatarUrl(hdUrl);
          }
        })
        .catch(() => {});
    }

    return () => {
      isCancelled = true;
    };
  }, [chat.id, chat.avatar]);

  return (
    <motion.aside
      initial={{ opacity: 0, x: 280 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 280 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="absolute right-[calc(100%-24px)] top-3 bottom-5 w-[305px] z-10 bg-[#111B21] rounded-l-[18px] border-y border-l border-white/[0.08] shadow-[-12px_12px_36px_rgba(0,0,0,0.75)] flex flex-col pt-5 pb-4 pl-3.5 pr-[42px] overflow-y-auto wa-scrollbar select-none pointer-events-auto"
    >
      {/* Botão de Fechar Discreto no Topo Esquerdo */}
      <button
        type="button"
        onClick={onClose}
        title="Fechar painel do contato"
        className="absolute top-2.5 left-2.5 p-1.5 rounded-full text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/10 transition-colors z-20 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Topo: Foto do Perfil em Alta Resolução Centralizada */}
      <div className="flex flex-col items-center text-center mt-1 mb-4">
        <div className="relative group/avatar">
          <img
            src={avatarUrl}
            alt={chat.name}
            onError={() => setAvatarUrl(DEFAULT_AVATAR)}
            className="w-[104px] h-[104px] rounded-full object-cover shadow-[0_8px_24px_rgba(0,0,0,0.65)] border-2 border-white/10 ring-4 ring-black/30"
            draggable={false}
          />
          {chat.isGroup ? (
            <div
              title="Grupo"
              className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#202C33] border border-white/15 text-[#00A884] shadow-md"
            >
              <Users className="w-3.5 h-3.5" />
            </div>
          ) : (
            <div
              title="Contato"
              className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#202C33] border border-white/15 text-[#53BDEB] shadow-md"
            >
              <User className="w-3.5 h-3.5" />
            </div>
          )}
        </div>

        {/* Nome do Contato / Grupo com suporte a Emojis */}
        <h3 className="mt-3.5 font-medium text-[15px] text-[#E9EDEF] leading-snug px-2 line-clamp-2 break-words">
          <FormattedText text={chat.name} />
        </h3>
      </div>

      {/* Lista de Opções da Conversa com padding à direita para não ser encoberta pela conversa */}
      <div className="flex flex-col gap-1 mt-2">
        {/* 1. Pesquisar */}
        <button
          type="button"
          onClick={onStartSearch}
          className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors text-left group/opt cursor-pointer"
        >
          <Search className="w-5 h-5 text-[#AEBAC1] group-hover/opt:text-[#00A884] transition-colors shrink-0" />
          <span className="text-[14px] font-normal text-[#E9EDEF] group-hover/opt:text-white">
            Pesquisar
          </span>
        </button>

        {/* 2. Selecionar mensagens */}
        <button
          type="button"
          onClick={onStartSelection}
          className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors text-left group/opt cursor-pointer"
        >
          <CheckSquare className="w-5 h-5 text-[#AEBAC1] group-hover/opt:text-[#00A884] transition-colors shrink-0" />
          <span className="text-[14px] font-normal text-[#E9EDEF] group-hover/opt:text-white">
            Selecionar mensagens
          </span>
        </button>

        {/* 3. Silenciar */}
        <button
          type="button"
          onClick={onToggleMute}
          className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors text-left group/opt cursor-pointer"
        >
          {chat.isMuted ? (
            <BellOff className="w-5 h-5 text-[#EF4444] shrink-0" />
          ) : (
            <Bell className="w-5 h-5 text-[#AEBAC1] group-hover/opt:text-[#00A884] transition-colors shrink-0" />
          )}
          <span className="text-[14px] font-normal text-[#E9EDEF] group-hover/opt:text-white flex-1">
            {chat.isMuted ? 'Silenciado' : 'Silenciar'}
          </span>
          {chat.isMuted && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] font-medium shrink-0">
              Ativo
            </span>
          )}
        </button>

        {/* 4. Fixar Conversa */}
        <button
          type="button"
          onClick={onTogglePin}
          className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors text-left group/opt cursor-pointer"
        >
          <Pin
            className={`w-5 h-5 transition-transform shrink-0 ${
              isPinned ? 'rotate-45 text-[#00A884]' : 'text-[#AEBAC1] group-hover/opt:text-[#00A884]'
            }`}
          />
          <span className="text-[14px] font-normal text-[#E9EDEF] group-hover/opt:text-white flex-1">
            {isPinned ? 'Conversa fixada' : 'Fixar conversa'}
          </span>
          {isPinned && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00A884]/20 text-[#00A884] font-medium shrink-0">
              Fixada
            </span>
          )}
        </button>
      </div>
    </motion.aside>
  );
};
