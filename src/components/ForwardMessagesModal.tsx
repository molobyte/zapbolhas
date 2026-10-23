import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, X, CornerUpRight, Loader2, Users, User } from 'lucide-react';
import { ChatSummary, DEFAULT_AVATAR } from '../types/whatsapp';
import { FormattedText } from './FormattedText';

interface ForwardMessagesModalProps {
  chats: ChatSummary[];
  currentChatId?: string;
  selectedCount: number;
  onForward: (targetChatId: string) => Promise<void> | void;
  onClose: () => void;
}

export const ForwardMessagesModal: React.FC<ForwardMessagesModalProps> = ({
  chats,
  currentChatId,
  selectedCount,
  onForward,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedTargetChatId, setSelectedTargetChatId] = useState<string | null>(null);

  // Filtra conversas pelo termo de busca e exclui a própria conversa atual
  const filteredChats = useMemo(() => {
    const term = search.toLowerCase().trim();
    return chats.filter((c) => {
      if (c.id === currentChatId) return false;
      if (!term) return true;
      return (
        (c.name && c.name.toLowerCase().includes(term)) ||
        (c.lastMessage?.text && c.lastMessage.text.toLowerCase().includes(term))
      );
    });
  }, [chats, currentChatId, search]);

  const handleConfirmForward = async (targetId: string) => {
    if (isSending) return;
    setIsSending(true);
    setSelectedTargetChatId(targetId);
    try {
      await onForward(targetId);
    } finally {
      setIsSending(false);
      setSelectedTargetChatId(null);
    }
  };

  return (
    <div
      data-interactive="true"
      onClick={onClose}
      className="absolute inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3 animate-in fade-in duration-150 select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[340px] max-h-[460px] bg-[#111B21] border border-white/10 rounded-[12px] shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden"
      >
        {/* Topo do Modal */}
        <div className="px-4 py-3 bg-[#182229] border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CornerUpRight className="w-4 h-4 text-[#00A884]" />
            <h4 className="text-[13.5px] font-semibold text-[#E9EDEF]">
              Encaminhar {selectedCount} mensagem{selectedCount > 1 ? 'ns' : ''}
            </h4>
          </div>
          <button
            type="button"
            disabled={isSending}
            onClick={onClose}
            className="p-1 text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Campo de Pesquisa de Contato */}
        <div className="p-2.5 border-b border-white/[0.06] bg-[#111B21]">
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#202C33] rounded-[8px] border border-white/5 focus-within:border-[#00A884]/60 transition-colors">
            <Search className="w-3.5 h-3.5 text-[#8696A0] shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar contato ou grupo..."
              className="w-full bg-transparent text-[12px] text-[#E9EDEF] placeholder-[#8696A0] outline-none"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-[#8696A0] hover:text-[#E9EDEF]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Lista de Contatos Disponíveis */}
        <div className="flex-1 overflow-y-auto wa-scrollbar p-1.5 max-h-[300px]">
          {filteredChats.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[#8696A0]">
              Nenhum contato ou grupo encontrado.
            </div>
          ) : (
            filteredChats.map((c) => {
              const isThisTargetSending = isSending && selectedTargetChatId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={isSending}
                  onClick={() => handleConfirmForward(c.id)}
                  className="w-full p-2 rounded-[8px] hover:bg-[#202C33] active:bg-[#2A3942] transition-colors flex items-center justify-between gap-2.5 text-left group/chatItem cursor-pointer disabled:opacity-60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={c.avatar || DEFAULT_AVATAR}
                        alt={c.name}
                        className="w-8 h-8 rounded-full object-cover border border-white/10"
                        draggable={false}
                      />
                      {c.isGroup && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#202C33] border border-white/10 flex items-center justify-center text-[#00A884]">
                          <Users className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-medium text-[#E9EDEF] truncate">
                        <FormattedText text={c.name} />
                      </div>
                      {c.lastMessage?.text && (
                        <div className="text-[11px] text-[#8696A0] truncate">
                          {c.lastMessage.text}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isThisTargetSending ? (
                      <Loader2 className="w-4 h-4 text-[#00A884] animate-spin" />
                    ) : (
                      <span className="text-[11px] px-2 py-1 rounded-[6px] bg-[#00A884]/20 text-[#00A884] font-medium group-hover/chatItem:bg-[#00A884] group-hover/chatItem:text-white transition-colors">
                        Enviar
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
};
