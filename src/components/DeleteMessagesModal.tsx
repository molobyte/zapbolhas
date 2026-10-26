import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, X, Loader2 } from 'lucide-react';

interface DeleteMessagesModalProps {
  selectedCount: number;
  canDeleteForEveryone: boolean;
  isDeleting: boolean;
  onDeleteForEveryone: () => Promise<void> | void;
  onDeleteForMe: () => Promise<void> | void;
  onClose: () => void;
}

export const DeleteMessagesModal: React.FC<DeleteMessagesModalProps> = ({
  selectedCount,
  canDeleteForEveryone,
  isDeleting,
  onDeleteForEveryone,
  onDeleteForMe,
  onClose,
}) => {
  // Atalho do teclado: Tecla ESC fecha a janela de confirmação
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isDeleting]);

  const isPlural = selectedCount > 1;

  return (
    <div
      data-interactive="true"
      onClick={() => {
        if (!isDeleting) onClose();
      }}
      className="absolute inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-3 animate-in fade-in duration-150 select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[320px] bg-[#111B21] border border-white/10 rounded-[12px] shadow-[0_20px_50px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden"
      >
        {/* Topo do Modal */}
        <div className="px-4 py-3 bg-[#182229] border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-[#EF4444]" />
            <h4 className="text-[13.5px] font-semibold text-[#E9EDEF]">
              {isPlural ? `Apagar ${selectedCount} mensagens?` : 'Apagar mensagem?'}
            </h4>
          </div>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="p-1 text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/10 rounded-full transition-colors disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo explicativo */}
        <div className="p-4 text-[13px] text-[#8696A0] leading-relaxed">
          {canDeleteForEveryone
            ? isPlural
              ? 'Deseja apagar estas mensagens no WhatsApp? Você pode apagar para todos nesta conversa ou apenas para você.'
              : 'Deseja apagar esta mensagem no WhatsApp? Você pode apagar para todos nesta conversa ou apenas para você.'
            : isPlural
            ? 'Deseja apagar estas mensagens no WhatsApp? Elas serão apagadas de todos os seus aparelhos.'
            : 'Deseja apagar esta mensagem no WhatsApp? Ela será apagada de todos os seus aparelhos.'}
        </div>

        {/* Ações / Botões */}
        <div className="px-4 pb-4 pt-1 flex flex-col gap-2">
          {canDeleteForEveryone && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={onDeleteForEveryone}
              className="w-full py-2 px-3 rounded-[6px] bg-[#EF4444] hover:bg-[#DC2626] text-white text-[13px] font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Apagando no WhatsApp...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Apagar para todos</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            disabled={isDeleting}
            onClick={onDeleteForMe}
            className={`w-full py-2 px-3 rounded-[6px] text-[13px] font-medium transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              canDeleteForEveryone
                ? 'bg-[#202C33] hover:bg-[#2A3942] text-[#E9EDEF] border border-white/5'
                : 'bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-sm'
            }`}
          >
            {isDeleting && !canDeleteForEveryone ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Apagando no WhatsApp...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Apagar para mim</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="w-full py-1.5 px-3 rounded-[6px] bg-transparent hover:bg-white/[0.05] text-[#8696A0] hover:text-[#E9EDEF] text-[13px] font-medium transition-colors flex items-center justify-center cursor-pointer disabled:opacity-40"
          >
            Cancelar
          </button>
        </div>
      </motion.div>
    </div>
  );
};
