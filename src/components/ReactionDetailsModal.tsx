import React, { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { FormattedMessage, DEFAULT_AVATAR } from '../types/whatsapp';
import { Emoji } from './Emoji';

interface ReactionDetailsModalProps {
  message: FormattedMessage;
  onClose: () => void;
  onToggleReaction: (emoji: string) => void;
}

export const ReactionDetailsModal: React.FC<ReactionDetailsModalProps> = ({
  message,
  onClose,
  onToggleReaction,
}) => {
  const [selectedTab, setSelectedTab] = useState<string>('all');

  const reactionsList = useMemo(() => {
    return (message.reactions || []).filter((r) => r.count > 0 && r.emoji);
  }, [message.reactions]);

  const totalCount = useMemo(() => {
    return reactionsList.reduce((acc, r) => acc + r.count, 0);
  }, [reactionsList]);

  // Se a lista de reações ficar vazia (por exemplo, após remover), fecha o modal
  useEffect(() => {
    if (reactionsList.length === 0) {
      onClose();
    }
  }, [reactionsList.length, onClose]);

  // Fechar no teclado com tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const displayedSenders = useMemo(() => {
    const list: Array<{
      id: string;
      name?: string;
      avatar?: string;
      emoji: string;
      fromMe?: boolean;
    }> = [];

    reactionsList.forEach((r) => {
      if (selectedTab !== 'all' && selectedTab !== r.emoji) return;
      if (r.senders && r.senders.length > 0) {
        r.senders.forEach((s) => {
          list.push({
            id: s.id || `${r.emoji}-${s.fromMe ? 'me' : 'other'}`,
            name: s.name,
            avatar: s.avatar,
            emoji: r.emoji,
            fromMe: s.fromMe,
          });
        });
      } else {
        list.push({
          id: `${r.emoji}-fallback`,
          name: r.fromMe ? 'Você' : undefined,
          emoji: r.emoji,
          fromMe: r.fromMe,
        });
      }
    });

    return list;
  }, [reactionsList, selectedTab]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      data-interactive="true"
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[2px] p-3 select-none"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.15 }}
        data-interactive="true"
        className="w-full max-w-[310px] max-h-[380px] bg-[#222E35] text-[#E9EDEF] border border-[#313D45] rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/[0.08] bg-[#182229]/60 shrink-0">
          <h3 className="text-sm font-semibold text-[#E9EDEF]">Reações</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/10 transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Reaction Tabs */}
        <div className="flex items-center px-2 border-b border-white/[0.08] overflow-x-auto wa-scrollbar bg-[#182229]/40 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedTab('all')}
            className={`px-2.5 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              selectedTab === 'all'
                ? 'border-[#00A884] text-[#00A884]'
                : 'border-transparent text-[#8696A0] hover:text-[#E9EDEF]'
            }`}
          >
            <span>Todas</span>
            <span className="text-[11px] opacity-80">{totalCount}</span>
          </button>

          {reactionsList.map((r) => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => setSelectedTab(r.emoji)}
              className={`px-2.5 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                selectedTab === r.emoji
                  ? 'border-[#00A884] text-[#00A884]'
                  : 'border-transparent text-[#8696A0] hover:text-[#E9EDEF]'
              }`}
            >
              <Emoji char={r.emoji} className="w-3.5 h-3.5" />
              <span className="text-[11px] opacity-80">{r.count}</span>
            </button>
          ))}
        </div>

        {/* Senders List */}
        <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04] p-1 wa-scrollbar">
          {displayedSenders.map((sender, idx) => {
            const isMe = sender.fromMe;
            return (
              <div
                key={`${sender.id}-${idx}`}
                onClick={() => {
                  if (isMe) {
                    onToggleReaction(sender.emoji);
                    onClose();
                  }
                }}
                className={`flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors ${
                  isMe
                    ? 'hover:bg-white/[0.06] cursor-pointer group/sender'
                    : 'hover:bg-white/[0.03]'
                }`}
                title={isMe ? 'Clique para remover sua reação' : undefined}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={sender.avatar || DEFAULT_AVATAR}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-white/10"
                  />
                  <div className="min-w-0 flex flex-col">
                    <span className="text-[12.5px] font-medium truncate text-[#E9EDEF]">
                      {isMe ? 'Você' : sender.name || 'Contato'}
                    </span>
                    {isMe && (
                      <span className="text-[10px] text-[#00A884] group-hover/sender:underline">
                        Clique para remover
                      </span>
                    )}
                  </div>
                </div>
                <div className="ml-2 shrink-0 flex items-center justify-center">
                  <Emoji char={sender.emoji} className="w-5 h-5" />
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
};
