import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  CheckSquare,
  Bell,
  BellOff,
  Pin,
  X,
  Users,
  User,
  ArrowLeft,
} from 'lucide-react';
import { ChatSummary, DEFAULT_AVATAR, GroupParticipant } from '../types/whatsapp';
import { FormattedText } from './FormattedText';
import { useBubbleStore } from '../store/useBubbleStore';

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
  const [viewMode, setViewMode] = useState<'main' | 'members'>('main');
  const [avatarUrl, setAvatarUrl] = useState<string>(chat.avatar || DEFAULT_AVATAR);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [members, setMembers] = useState<GroupParticipant[]>(() => {
    if (chat.isGroup && chat.id) {
      return useBubbleStore.getState().groupParticipantsByChat[chat.id] || [];
    }
    return [];
  });
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

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

  // Carrega lista de participantes do grupo
  useEffect(() => {
    if (!chat.isGroup || !chat.id) return;
    let isCancelled = false;

    const cached = useBubbleStore.getState().groupParticipantsByChat[chat.id];
    if (cached && cached.length > 0) {
      setMembers(cached);
    }

    if (window.electronAPI?.getGroupParticipants) {
      setIsLoadingMembers(true);
      window.electronAPI
        .getGroupParticipants(chat.id, '', 1000)
        .then((list) => {
          if (!isCancelled && Array.isArray(list)) {
            setMembers(list);
            useBubbleStore.setState((state) => ({
              groupParticipantsByChat: {
                ...state.groupParticipantsByChat,
                [chat.id]: list,
              },
              initialGroupParticipantsByChat: {
                ...state.initialGroupParticipantsByChat,
                [chat.id]: list,
              },
            }));
          }
        })
        .catch((err) => {
          console.error('[ChatContactSidebar] Erro ao buscar membros do grupo:', err);
        })
        .finally(() => {
          if (!isCancelled) setIsLoadingMembers(false);
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [chat.id, chat.isGroup]);

  // Se o usuário entrar na tela de membros e houver 50 ou menos (limite antigo em cache), força refetch de até 1000
  useEffect(() => {
    if (viewMode === 'members' && chat.isGroup && chat.id && window.electronAPI?.getGroupParticipants) {
      if (members.length <= 50) {
        setIsLoadingMembers(true);
        window.electronAPI
          .getGroupParticipants(chat.id, '', 1000)
          .then((list) => {
            if (Array.isArray(list) && list.length > 0) {
              setMembers(list);
              useBubbleStore.setState((state) => ({
                groupParticipantsByChat: {
                  ...state.groupParticipantsByChat,
                  [chat.id]: list,
                },
                initialGroupParticipantsByChat: {
                  ...state.initialGroupParticipantsByChat,
                  [chat.id]: list,
                },
              }));
            }
          })
          .catch(() => {})
          .finally(() => {
            setIsLoadingMembers(false);
          });
      }
    }
  }, [viewMode, chat.id, chat.isGroup, members.length]);

  // Ao pressionar ESC na visualização de membros, retorna ao menu principal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && viewMode === 'members') {
        e.stopPropagation();
        setViewMode('main');
        setMemberSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  // Filtragem em tempo real dos membros
  const filteredMembers = useMemo(() => {
    const q = memberSearchQuery.toLowerCase().trim();
    if (!q) return members;
    return members.filter((m) => {
      const name = (m.name || '').toLowerCase();
      const push = (m.pushname || '').toLowerCase();
      const user = (m.user || '').toLowerCase();
      return name.includes(q) || push.includes(q) || user.includes(q);
    });
  }, [members, memberSearchQuery]);

  const handleMemberClick = (member: GroupParticipant) => {
    if (member.id) {
      useBubbleStore.getState().selectChatFromList(member.id);
      onClose();
    }
  };

  return (
    <motion.aside
      initial={{ opacity: 0, x: 280 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 280 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="absolute right-[calc(100%-20px)] top-3 bottom-5 w-[330px] z-10 bg-[#111B21] rounded-l-[18px] border-y border-l border-white/[0.08] shadow-[-10px_10px_32px_rgba(0,0,0,0.7)] flex flex-col pt-4 pb-4 pl-4 pr-[58px] overflow-hidden select-none pointer-events-auto"
    >
      <AnimatePresence mode="wait">
        {viewMode === 'main' ? (
          <motion.div
            key="main-view"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col h-full overflow-y-auto wa-scrollbar"
          >
            {/* Botão de Fechar Discreto no Topo Esquerdo */}
            <div className="flex justify-between items-center mb-1">
              <button
                type="button"
                onClick={onClose}
                title="Fechar painel do contato"
                className="p-1.5 rounded-full text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

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

            {/* Lista de Opções da Conversa com amplo respiro à direita */}
            <div className="flex flex-col gap-1 mt-2">
              {/* 0. Ver Membros (apenas para grupos, acima de Pesquisar) */}
              {chat.isGroup && (
                <button
                  type="button"
                  onClick={() => setViewMode('members')}
                  className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors text-left group/opt cursor-pointer"
                >
                  <Users className="w-5 h-5 text-[#AEBAC1] group-hover/opt:text-[#00A884] transition-colors shrink-0" />
                  <span className="text-[14px] font-normal text-[#E9EDEF] group-hover/opt:text-white flex-1">
                    Ver membros
                  </span>
                  {members.length > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-white/[0.08] text-[#8696A0] font-medium shrink-0">
                      {members.length}
                    </span>
                  )}
                </button>
              )}

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
          </motion.div>
        ) : (
          <motion.div
            key="members-view"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col h-full"
          >
            {/* Topo da lista de membros: Botão de voltar e título */}
            <div className="flex items-center gap-2 mb-2 pb-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setViewMode('main');
                  setMemberSearchQuery('');
                }}
                title="Voltar ao perfil"
                className="p-1.5 rounded-full text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/10 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 min-w-0">
                <h4 className="text-[14px] font-medium text-[#E9EDEF] truncate">
                  Membros do Grupo
                </h4>
                <div className="text-[11px] text-[#8696A0]">
                  {members.length} {members.length === 1 ? 'membro' : 'membros'}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                title="Fechar painel"
                className="p-1.5 rounded-full text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Caixa de Texto de Pesquisa de Membros */}
            <div className="relative mb-2.5 shrink-0">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#8696A0] pointer-events-none" />
              <input
                type="text"
                value={memberSearchQuery}
                onChange={(e) => setMemberSearchQuery(e.target.value)}
                placeholder="Pesquisar membro..."
                autoFocus
                className="w-full bg-[#202C33] text-[#E9EDEF] text-[13px] pl-9 pr-8 py-2 rounded-xl border border-white/10 focus:outline-none focus:border-[#00A884] placeholder:text-[#8696A0] transition-colors"
              />
              {memberSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMemberSearchQuery('')}
                  title="Limpar busca"
                  className="absolute right-2.5 top-2.5 p-0.5 text-[#8696A0] hover:text-[#E9EDEF] rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Lista Rolável de Membros */}
            <div className="flex-1 overflow-y-auto wa-scrollbar flex flex-col gap-1 pr-1">
              {isLoadingMembers && members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-[#8696A0] gap-2">
                  <div className="w-5 h-5 border-2 border-[#00A884] border-t-transparent rounded-full animate-spin" />
                  <span className="text-[12px]">Carregando membros...</span>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-10 text-[#8696A0] text-[12.5px]">
                  Nenhum membro encontrado.
                </div>
              ) : (
                filteredMembers.map((m, idx) => (
                  <div
                    key={m.id || m.rawId || idx}
                    onClick={() => handleMemberClick(m)}
                    title={m.name ? `Conversar com ${m.name}` : undefined}
                    className="flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors cursor-pointer group/member text-left"
                  >
                    <div className="relative shrink-0">
                      <img
                        src={m.avatar || DEFAULT_AVATAR}
                        alt={m.name || 'Membro'}
                        className="w-9 h-9 rounded-full object-cover border border-white/10"
                        draggable={false}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-[#E9EDEF] group-hover/member:text-white truncate">
                        <FormattedText text={m.name || m.pushname || 'Participante'} />
                      </div>
                      {m.pushname && m.pushname !== m.name && (
                        <div className="text-[11px] text-[#8696A0] truncate">
                          ~{m.pushname}
                        </div>
                      )}
                    </div>
                    {m.isAdmin && (
                      <span className="text-[10px] text-[#00A884] bg-[#00A884]/15 border border-[#00A884]/30 px-1.5 py-0.5 rounded font-medium shrink-0">
                        Admin
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );
};
