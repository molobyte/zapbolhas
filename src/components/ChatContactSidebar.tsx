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
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="absolute right-full top-0 bottom-0 w-[260px] mr-[-1px] z-0 bg-[#111B21] rounded-l-[12px] border-y border-l border-white/[0.08] shadow-[0_16px_40px_rgba(0,0,0,0.85)] flex flex-col p-4 overflow-y-auto wa-scrollbar select-none pointer-events-auto"
    >
      {/* Botão de Fechar no Topo Direito */}
      <div className="flex justify-end mb-1">
        <button
          type="button"
          onClick={onClose}
          title="Fechar painel do contato"
          className="p-1 rounded-full text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Topo: Foto do Perfil em Alta Resolução */}
      <div className="flex flex-col items-center text-center mt-1 mb-4">
        <div className="relative group/avatar">
          <img
            src={avatarUrl}
            alt={chat.name}
            onError={() => setAvatarUrl(DEFAULT_AVATAR)}
            className="w-[104px] h-[104px] rounded-full object-cover shadow-[0_8px_24px_rgba(0,0,0,0.6)] border-2 border-white/10 ring-4 ring-black/25"
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
        <h3 className="mt-3.5 font-semibold text-[14.5px] text-[#E9EDEF] leading-snug px-1 line-clamp-2 break-words">
          <FormattedText text={chat.name} />
        </h3>

        <span className="text-[11.5px] text-[#8696A0] mt-1 flex items-center gap-1 font-normal">
          {chat.isGroup ? 'Grupo do WhatsApp' : 'Contato'}
        </span>
      </div>

      {/* Separador Sutil */}
      <div className="h-[1px] bg-white/[0.08] mb-3 mx-1" />

      {/* Lista de Opções da Conversa */}
      <div className="flex flex-col gap-1.5 flex-1">
        {/* 1. Pesquisar */}
        <button
          type="button"
          onClick={onStartSearch}
          className="w-full p-2.5 rounded-[8px] hover:bg-[#202C33] active:bg-[#26343d] flex items-center gap-3 transition-colors text-left group/opt cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-[#202C33] group-hover/opt:bg-[#00A884]/20 flex items-center justify-center shrink-0 transition-colors">
            <Search className="w-4 h-4 text-[#8696A0] group-hover/opt:text-[#00A884] transition-colors" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-[#E9EDEF]">
              Pesquisar
            </div>
            <div className="text-[11px] text-[#8696A0] truncate">
              Buscar mensagens nesta conversa
            </div>
          </div>
        </button>

        {/* 2. Selecionar mensagens */}
        <button
          type="button"
          onClick={onStartSelection}
          className="w-full p-2.5 rounded-[8px] hover:bg-[#202C33] active:bg-[#26343d] flex items-center gap-3 transition-colors text-left group/opt cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-[#202C33] group-hover/opt:bg-[#00A884]/20 flex items-center justify-center shrink-0 transition-colors">
            <CheckSquare className="w-4 h-4 text-[#8696A0] group-hover/opt:text-[#00A884] transition-colors" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-[#E9EDEF]">
              Selecionar mensagens
            </div>
            <div className="text-[11px] text-[#8696A0] truncate">
              Encaminhar ou apagar localmente
            </div>
          </div>
        </button>

        {/* 3. Silenciar */}
        <button
          type="button"
          onClick={onToggleMute}
          className="w-full p-2.5 rounded-[8px] hover:bg-[#202C33] active:bg-[#26343d] flex items-center gap-3 transition-colors text-left group/opt cursor-pointer"
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              chat.isMuted
                ? 'bg-[#EF4444]/20 text-[#EF4444]'
                : 'bg-[#202C33] text-[#8696A0] group-hover/opt:bg-[#00A884]/20 group-hover/opt:text-[#00A884]'
            }`}
          >
            {chat.isMuted ? (
              <BellOff className="w-4 h-4 text-[#EF4444]" />
            ) : (
              <Bell className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-[#E9EDEF] flex items-center justify-between">
              <span>{chat.isMuted ? 'Silenciado' : 'Silenciar'}</span>
              {chat.isMuted && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EF4444]/20 text-[#EF4444] font-medium">
                  Ativo
                </span>
              )}
            </div>
            <div className="text-[11px] text-[#8696A0] truncate">
              {chat.isMuted
                ? 'Clique para reativar notificações'
                : 'Silenciar notificações no WhatsApp'}
            </div>
          </div>
        </button>

        {/* 4. Fixar Conversa */}
        <button
          type="button"
          onClick={onTogglePin}
          className="w-full p-2.5 rounded-[8px] hover:bg-[#202C33] active:bg-[#26343d] flex items-center gap-3 transition-colors text-left group/opt cursor-pointer"
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
              isPinned
                ? 'bg-[#00A884]/20 text-[#00A884]'
                : 'bg-[#202C33] text-[#8696A0] group-hover/opt:bg-[#00A884]/20 group-hover/opt:text-[#00A884]'
            }`}
          >
            <Pin
              className={`w-4 h-4 transition-transform ${
                isPinned ? 'rotate-45 text-[#00A884]' : ''
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-[#E9EDEF] flex items-center justify-between">
              <span>{isPinned ? 'Conversa fixada' : 'Fixar conversa'}</span>
              {isPinned && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00A884]/20 text-[#00A884] font-medium">
                  Fixada
                </span>
              )}
            </div>
            <div className="text-[11px] text-[#8696A0] truncate">
              {isPinned
                ? 'Fixada no dock do WhatsApp Bubbles'
                : 'Fixar no app WhatsApp Bubbles'}
            </div>
          </div>
        </button>
      </div>
    </motion.aside>
  );
};
