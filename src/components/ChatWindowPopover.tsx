import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Minus,
  X,
  Paperclip,
  Smile,
  Sticker,
  AtSign,
  Mic,
  SendHorizontal,
  ZoomIn,
  ZoomOut,
  Download,
  ExternalLink,
} from 'lucide-react';
import { useBubbleStore } from '../store/useBubbleStore';
import { GroupParticipant, CHAT_SIZE_CONFIG, ChatBubbleSize } from '../types/whatsapp';
import { MessageBubble } from './MessageBubble';
import { EmojiStickerPicker, PickerTab } from './EmojiStickerPicker';
import { FormattedText } from './FormattedText';

interface ChatWindowPopoverProps {
  onInteractiveEnter: () => void;
  onInteractiveLeave: () => void;
}

export const ChatWindowPopover: React.FC<ChatWindowPopoverProps> = ({
  onInteractiveEnter,
  onInteractiveLeave,
}) => {
  const {
    activeChatId,
    activeBubbles,
    chats,
    messagesByChat,
    unreadBannerByChat,
    replyingTo,
    viewingImage,
    bubbleScale,
    chatSizes,
    setReplyingTo,
    setViewingImage,
    minimizeActiveChat,
    closeBubble,
    groupParticipantsByChat,
    fetchGroupParticipants,
    sendMessage,
    sendSticker,
    sendVoiceNote,
  } = useBubbleStore();

  const [inputText, setInputText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<PickerTab>('emoji');
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionAtIndex, setMentionAtIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [trackedMentions, setTrackedMentions] = useState<Map<string, string>>(new Map());
  const [zoom, setZoom] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesContentRef = useRef<HTMLDivElement | null>(null);
  const unreadDividerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const userHasScrolledUpRef = useRef<boolean>(false);
  const isLoadingOlderRef = useRef<boolean>(false);

  const activeChat = chats.find((c) => c.id === activeChatId);
  const isGroupChat = Boolean(activeChat?.isGroup);
  const groupParticipants = (activeChatId && groupParticipantsByChat[activeChatId]) || [];

  const normalizeQuery = (str: string): string =>
    (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  const filteredParticipants = useMemo(() => {
    if (!showMentionPopover || !isGroupChat) return [];
    const q = normalizeQuery(mentionQuery);
    if (!q) {
      return groupParticipants.slice(0, 10);
    }
    return groupParticipants
      .filter((p) => {
        const name = normalizeQuery(p.name);
        const push = normalizeQuery(p.pushname || '');
        const id = (p.id || '').toLowerCase();
        return name.includes(q) || push.includes(q) || id.includes(q);
      })
      .slice(0, 10);
  }, [showMentionPopover, isGroupChat, groupParticipants, mentionQuery]);
  const messages = activeChatId ? messagesByChat[activeChatId] || [] : [];
  const unreadBanner = activeChatId ? unreadBannerByChat[activeChatId] : undefined;

  const activeBubble = activeBubbles.find((b) => b.chatId === activeChatId);
  const isPinned = Boolean(activeBubble?.isPinned);

  const currentSizeKey: ChatBubbleSize = (activeChatId && chatSizes[activeChatId]) || 'pequeno';
  const currentSize = CHAT_SIZE_CONFIG[currentSizeKey] || CHAT_SIZE_CONFIG.pequeno;

  // Calcula a posição horizontal exata da seta para apontar para o centro da bolha ativa no dock inferior,
  // considerando o nível de zoom atual (bubbleScale) e o tamanho da janela
  const activeBubbleIndex = activeBubbles.findIndex((b) => b.chatId === activeChatId);
  const stepsFromRight =
    activeBubbleIndex >= 0 ? activeBubbles.length - activeBubbleIndex : 1;
  const arrowRightPx = Math.min(
    currentSize.width - 28,
    Math.max(12, Math.round(24 * bubbleScale + stepsFromRight * 60 * bubbleScale - 7))
  );

  const scrollToTarget = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const divider = unreadDividerRef.current;
    if (divider && unreadBanner && unreadBanner.count > 0) {
      // Posiciona a visualização na barra de mensagens não lidas, deixando a última mensagem lida acima como contexto
      container.scrollTop = Math.max(0, divider.offsetTop - 68);
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }, [unreadBanner]);

  // Sempre que trocar de conversa (ou abrir a janela), reseta a trava de rolagem manual do usuário
  useLayoutEffect(() => {
    userHasScrolledUpRef.current = false;
    isLoadingOlderRef.current = false;
  }, [activeChatId]);

  // Sincroniza o scroll imediatamente antes da pintura e no próximo frame quando mensagens ou banner mudam
  useLayoutEffect(() => {
    if (userHasScrolledUpRef.current) return;
    scrollToTarget();
    const rafId = requestAnimationFrame(() => {
      if (!userHasScrolledUpRef.current) {
        scrollToTarget();
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [activeChatId, messages, unreadBanner?.firstUnreadMsgId, unreadBanner?.count, scrollToTarget]);

  // Observa mudanças de altura do conteúdo (ex: decodificação assíncrona de <img> base64 ou download HD)
  // para impedir que o scroll fique perdido no meio do chat após o carregamento das imagens
  useEffect(() => {
    const contentEl = messagesContentRef.current;
    if (!contentEl) return;

    const observer = new ResizeObserver(() => {
      if (!userHasScrolledUpRef.current) {
        scrollToTarget();
      }
    });

    observer.observe(contentEl);
    return () => observer.disconnect();
  }, [activeChatId, scrollToTarget]);

  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingTo]);

  useEffect(() => {
    setViewingImage(null);
    setPickerOpen(false);
    setShowMentionPopover(false);
    setZoom(1);
  }, [activeChatId, setViewingImage]);

  useEffect(() => {
    setZoom(1);
  }, [viewingImage]);

  // Carrega os 10 primeiros colaboradores ao abrir o grupo
  useEffect(() => {
    if (activeChatId && isGroupChat) {
      fetchGroupParticipants(activeChatId, '', 10);
    }
  }, [activeChatId, isGroupChat, fetchGroupParticipants]);

  // Busca dinamicamente os colaboradores conforme o usuário digita letras após o '@' (máximo 10)
  useEffect(() => {
    if (!activeChatId || !isGroupChat || !showMentionPopover) return;
    const timer = setTimeout(() => {
      fetchGroupParticipants(activeChatId, mentionQuery, 10);
    }, 60);
    return () => clearTimeout(timer);
  }, [activeChatId, isGroupChat, showMentionPopover, mentionQuery, fetchGroupParticipants]);

  // Mantém o índice selecionado dentro dos limites da lista
  useEffect(() => {
    if (selectedMentionIndex >= filteredParticipants.length && filteredParticipants.length > 0) {
      setSelectedMentionIndex(0);
    }
  }, [filteredParticipants.length, selectedMentionIndex]);

  if (!activeChatId || !activeChat) return null;

  const handleInsertEmoji = (emoji: string) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart ?? inputText.length;
      const end = input.selectionEnd ?? inputText.length;
      const nextText = inputText.slice(0, start) + emoji + inputText.slice(end);
      setInputText(nextText);
      requestAnimationFrame(() => {
        input.focus();
        const cursorPos = start + emoji.length;
        input.setSelectionRange(cursorPos, cursorPos);
      });
    } else {
      setInputText((prev) => prev + emoji);
    }
  };

  const handleSendSticker = async (stickerDataUrl: string) => {
    userHasScrolledUpRef.current = false;
    setPickerOpen(false);
    await sendSticker(stickerDataUrl);
  };

  const handleTogglePicker = (tab: PickerTab) => {
    if (pickerOpen && pickerTab === tab) {
      setPickerOpen(false);
    } else {
      setPickerTab(tab);
      setPickerOpen(true);
    }
  };

  const handleSelectParticipant = (participant: GroupParticipant) => {
    const atIndex = mentionAtIndex >= 0 ? mentionAtIndex : inputText.lastIndexOf('@');
    if (atIndex < 0) return;
    const before = inputText.slice(0, atIndex);
    const cursorPos = inputRef.current?.selectionStart ?? inputText.length;
    const after = inputText.slice(cursorPos);
    const cleanSelectName = (participant.name || '').replace(/^~/, '').trim();
    const replacement = `@${cleanSelectName} `;
    const nextText = `${before}${replacement}${after}`;
    setInputText(nextText);
    setShowMentionPopover(false);

    setTrackedMentions((prev) => {
      const next = new Map(prev);
      next.set(cleanSelectName, participant.id);
      return next;
    });

    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPos = before.length + replacement.length;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart ?? value.length;
    setInputText(value);

    if (!isGroupChat) {
      setShowMentionPopover(false);
      return;
    }

    const sub = value.slice(0, cursorPos);
    const atIndex = sub.lastIndexOf('@');
    if (atIndex >= 0 && (atIndex === 0 || /\s/.test(sub[atIndex - 1]))) {
      const query = sub.slice(atIndex + 1);
      if (!/[\r\n]/.test(query) && query.length < 30) {
        setMentionQuery(query);
        setMentionAtIndex(atIndex);
        setShowMentionPopover(true);
        setSelectedMentionIndex(0);
        return;
      }
    }
    setShowMentionPopover(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentionPopover && filteredParticipants.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev + 1) % filteredParticipants.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(
          (prev) => (prev - 1 + filteredParticipants.length) % filteredParticipants.length
        );
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const chosen =
          filteredParticipants[selectedMentionIndex] || filteredParticipants[0];
        if (chosen) {
          handleSelectParticipant(chosen);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentionPopover(false);
        return;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    const textToSend = inputText;

    const mentionIds: string[] = [];
    for (const [name, id] of trackedMentions.entries()) {
      if (textToSend.includes(`@${name}`)) {
        mentionIds.push(id);
      }
    }

    setInputText('');
    setPickerOpen(false);
    setShowMentionPopover(false);
    setTrackedMentions(new Map());
    userHasScrolledUpRef.current = false;
    await sendMessage(textToSend, mentionIds.length > 0 ? mentionIds : undefined);
  };

  const handleMicClick = async () => {
    userHasScrolledUpRef.current = false;
    await sendVoiceNote(14);
  };

  const handleDownloadImage = async () => {
    if (!viewingImage) return;
    const isVideo = viewingImage.mediaType === 'video';
    let urlToDownload = isVideo
      ? viewingImage.videoUrl || viewingImage.imageUrl
      : viewingImage.imageUrl;
    if (viewingImage.messageId && window.electronAPI?.downloadMedia) {
      const hd = await window.electronAPI.downloadMedia(viewingImage.messageId);
      if (hd) {
        urlToDownload = hd;
      }
    }
    const link = document.createElement('a');
    link.href = urlToDownload;
    link.download = isVideo
      ? `whatsapp-video-${Date.now()}.mp4`
      : `whatsapp-image-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenExternalImage = async () => {
    if (!viewingImage) return;
    const isVideo = viewingImage.mediaType === 'video';
    let urlToOpen = isVideo
      ? viewingImage.videoUrl || viewingImage.imageUrl
      : viewingImage.imageUrl;
    if (viewingImage.messageId && window.electronAPI?.downloadMedia) {
      const hd = await window.electronAPI.downloadMedia(viewingImage.messageId);
      if (hd) {
        urlToOpen = hd;
      }
    }
    window.electronAPI?.openExternalImage(urlToOpen);
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
      className={`relative ${currentSize.widthClass} ${currentSize.heightClass} max-h-[calc(100vh-84px)] bg-[#0B141A] rounded-[8px] shadow-[0_16px_44px_rgba(0,0,0,0.88)] border border-white/[0.06] flex flex-col pointer-events-auto group/chat transition-[width,height] duration-200`}
    >
      <div className="relative w-full h-full rounded-[8px] overflow-hidden flex flex-col">
        {/* Textura de Fundo Oficial WhatsApp Dark Doodles */}
        <div
          className="absolute inset-0 pointer-events-none opacity-95 bg-repeat"
          style={{
            backgroundImage: `url('/wa-doodle-bg.png')`,
            backgroundSize: '180px 180px',
          }}
        />

      {/* Barra de Topo Minimalista em Hover (Minimizar conversa vs. Fechar/Remover Bolha) */}
      <div className="absolute top-0 left-0 right-0 z-30 px-3 py-1.5 bg-gradient-to-b from-[#111B21]/95 via-[#111B21]/75 to-transparent flex items-center justify-between opacity-0 group-hover/chat:opacity-100 transition-opacity duration-150">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src={activeChat.avatar}
            alt={activeChat.name}
            className="w-6 h-6 rounded-full object-cover border border-white/15"
          />
          <span className="text-[12.5px] font-medium text-[#E9EDEF] truncate">
            {activeChat.name}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={minimizeActiveChat}
            title="Minimizar conversa (mantém a bolha)"
            className="w-6 h-6 rounded-full bg-[#202C33]/90 hover:bg-[#2A3942] text-[#E9EDEF] flex items-center justify-center transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={isPinned}
            onClick={() => {
              if (isPinned) return;
              closeBubble(activeChatId);
            }}
            title={
              isPinned
                ? 'Conversa fixada (desfixe na bolha para fechar)'
                : 'Fechar conversa e remover bolha'
            }
            className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
              isPinned
                ? 'bg-[#202C33]/40 text-[#8696A0]/40 cursor-not-allowed'
                : 'bg-[#202C33]/90 hover:bg-[#EF4444] text-[#E9EDEF]'
            }`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Área de Histórico de Mensagens */}
      <div
        ref={scrollContainerRef}
        onLoadCapture={() => {
          if (!userHasScrolledUpRef.current) {
            scrollToTarget();
          }
        }}
        onWheel={(e) => {
          const container = scrollContainerRef.current;
          if (!container) return;
          if (e.deltaY < 0) {
            userHasScrolledUpRef.current = true;
            // Se o usuário chegou ao topo da conversa, carrega mais mensagens anteriores do WhatsApp
            if (
              container.scrollTop <= 20 &&
              !isLoadingOlderRef.current &&
              messages.length >= 25 &&
              messages.length < 500 &&
              window.electronAPI?.getMessages
            ) {
              isLoadingOlderRef.current = true;
              const prevHeight = container.scrollHeight;
              const targetChatId = activeChatId;
              window.electronAPI
                .getMessages(targetChatId, Math.min(500, messages.length + 80))
                .then((olderMsgs) => {
                  if (olderMsgs && olderMsgs.length > messages.length) {
                    useBubbleStore.getState().setMessagesForChat(targetChatId, olderMsgs);
                    requestAnimationFrame(() => {
                      if (scrollContainerRef.current) {
                        const newHeight = scrollContainerRef.current.scrollHeight;
                        scrollContainerRef.current.scrollTop = Math.max(
                          0,
                          newHeight - prevHeight
                        );
                      }
                    });
                  }
                })
                .finally(() => {
                  isLoadingOlderRef.current = false;
                });
            }
          } else if (
            !unreadBanner &&
            container.scrollHeight - container.scrollTop - container.clientHeight <= 40
          ) {
            userHasScrolledUpRef.current = false;
          }
        }}
        onPointerDown={(e) => {
          const container = scrollContainerRef.current;
          if (!container) return;
          const rect = container.getBoundingClientRect();
          // Se o usuário clicou na barra de rolagem à direita para arrastar manualmente
          if (e.clientX >= rect.right - 14) {
            userHasScrolledUpRef.current = true;
          }
        }}
        className="relative z-10 flex-1 overflow-y-auto px-3 pt-2 pb-2 wa-scrollbar"
      >
        <div ref={messagesContentRef} className="flex flex-col min-h-full justify-end">
          {messages.map((msg, index) => {
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const isFirstUnread =
              Boolean(unreadBanner && unreadBanner.count > 0) &&
              msg.id === unreadBanner?.firstUnreadMsgId;

            const isFirstInGroup =
              !prevMsg ||
              prevMsg.fromMe !== msg.fromMe ||
              prevMsg.senderName !== msg.senderName ||
              Boolean(msg.dateLabel) ||
              isFirstUnread;

            return (
              <React.Fragment key={msg.id}>
                {isFirstUnread && unreadBanner && (
                  <div
                    ref={unreadDividerRef}
                    className="my-2.5 -mx-3 py-1.5 px-3 bg-[#182229]/90 border-y border-white/[0.04] flex items-center justify-center select-none"
                  >
                    <span className="bg-[#202C33] text-[#E9EDEF] text-[11px] font-medium tracking-wide uppercase px-3.5 py-1 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
                      {unreadBanner.count === 1
                        ? '1 mensagem não lida'
                        : `${unreadBanner.count} mensagens não lidas`}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isFirstInGroup={isFirstInGroup}
                  isGroupChat={activeChat.isGroup}
                  onReply={(quote) => setReplyingTo(quote)}
                />
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Preview de Resposta (Quote) acima do Input */}
      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-20 mx-2 px-3 py-1.5 bg-[#182229] rounded-t-[8px] border-b border-[#2A3942] flex items-center justify-between"
          >
            <div className="flex-1 min-w-0 border-l-[3px] border-[#06CF9C] pl-2 py-0.5">
              <div className="text-[11px] font-semibold text-[#06CF9C] truncate">
                {replyingTo.author}
              </div>
              <div className="text-[11.5px] text-[#8696A0] truncate">
                {replyingTo.text}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="ml-2 p-1 text-[#8696A0] hover:text-[#E9EDEF]"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Painel Flutuante de Emojis e Figurinhas da Biblioteca */}
      <AnimatePresence>
        {pickerOpen && (
          <EmojiStickerPicker
            initialTab={pickerTab}
            onSelectEmoji={handleInsertEmoji}
            onSelectSticker={handleSendSticker}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Popover de Autocomplete de Menção (@) para Grupos */}
      <AnimatePresence>
        {showMentionPopover && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute bottom-[52px] left-2 right-2 z-40 bg-[#182229] rounded-[8px] shadow-[0_12px_36px_rgba(0,0,0,0.85)] border border-white/10 overflow-hidden"
          >
            <div className="px-3 py-1.5 bg-[#111B21] border-b border-white/[0.06] flex items-center justify-between text-[11px] text-[#8696A0] select-none">
              <div className="flex items-center gap-1.5 font-medium">
                <AtSign className="w-3.5 h-3.5 text-[#00A884]" />
                <span>Mencionar membro do grupo (máx. 10)</span>
              </div>
              <span className="text-[10px]">Use ↑↓ e Enter</span>
            </div>
            <div className="max-h-[220px] overflow-y-auto wa-scrollbar py-1">
              {filteredParticipants.length > 0 ? (
                filteredParticipants.map((p, idx) => {
                  const isSelected = idx === selectedMentionIndex;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectParticipant(p)}
                      onMouseEnter={() => setSelectedMentionIndex(idx)}
                      className={`w-full px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#005C4B] text-white'
                          : 'hover:bg-[#202C33] text-[#E9EDEF]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={p.avatar || '/avatars/me.png'}
                          alt={p.name}
                          className="w-6 h-6 rounded-full object-cover shrink-0 border border-white/10"
                        />
                        <div className="min-w-0 flex items-center gap-1.5">
                          <span className="text-[12.5px] font-medium truncate">
                            {p.pushname && p.pushname.startsWith('+')
                              ? (p.name.startsWith('~') ? p.name : `~${p.name}`)
                              : p.name}
                          </span>
                          {p.pushname && p.pushname !== p.name && (
                            <span
                              className={`text-[11px] truncate ${
                                isSelected ? 'text-white/80' : 'text-[#8696A0]'
                              }`}
                            >
                              {p.pushname.startsWith('+')
                                ? p.pushname
                                : (p.pushname.startsWith('~') ? p.pushname : `~${p.pushname}`)}
                            </span>
                          )}
                        </div>
                      </div>

                      {p.isAdmin && (
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-semibold shrink-0 ${
                            isSelected
                              ? 'bg-black/25 text-white'
                              : 'bg-[#25D366]/20 text-[#25D366]'
                          }`}
                        >
                          Admin
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-3 text-center text-[12px] text-[#8696A0]">
                  Nenhum colaborador encontrado
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barra de Digitação Inferior (Idêntica à conversando.jpg) */}
      <form onSubmit={handleSubmit} className="relative z-20 px-2 pb-2 pt-1">
        <div className="h-[42px] bg-[#202C33] rounded-[8px] px-3 flex items-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
          {/* Ícone Clipe de Papel (Anexo / Importar Figurinha) */}
          <button
            type="button"
            onClick={() => handleTogglePicker('sticker')}
            title="Adicionar figurinha da biblioteca"
            className="text-[#8696A0] hover:text-[#D1D7DB] transition-colors shrink-0 focus:outline-none"
          >
            <Paperclip className="w-[18px] h-[18px] -rotate-45 stroke-[1.9]" />
          </button>

          {/* Ícone Emoji */}
          <button
            type="button"
            onClick={() => handleTogglePicker('emoji')}
            title="Abrir painel de Emojis"
            className={`transition-colors shrink-0 focus:outline-none ${
              pickerOpen && pickerTab === 'emoji'
                ? 'text-[#00A884]'
                : 'text-[#8696A0] hover:text-[#D1D7DB]'
            }`}
          >
            <Smile className="w-[19px] h-[19px] stroke-[1.9]" />
          </button>

          {/* Ícone Figurinhas (Stickers) */}
          <button
            type="button"
            onClick={() => handleTogglePicker('sticker')}
            title="Abrir biblioteca de Figurinhas"
            className={`transition-colors shrink-0 focus:outline-none ${
              pickerOpen && pickerTab === 'sticker'
                ? 'text-[#00A884]'
                : 'text-[#8696A0] hover:text-[#D1D7DB]'
            }`}
          >
            <Sticker className="w-[18px] h-[18px] stroke-[1.9]" />
          </button>

          {/* Campo de Texto */}
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            placeholder={
              isGroupChat
                ? 'Digite uma mensagem ou @ para marcar...'
                : 'Digite uma mensagem'
            }
            className="flex-1 bg-transparent text-[13.5px] text-[#D1D7DB] placeholder-[#8696A0] focus:outline-none"
          />

          {/* Botão Microfone ou Enviar */}
          {inputText.trim().length > 0 ? (
            <button
              type="submit"
              title="Enviar mensagem"
              className="text-[#00A884] hover:text-[#25D366] transition-transform active:scale-90 shrink-0 focus:outline-none"
            >
              <SendHorizontal className="w-[19px] h-[19px]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleMicClick}
              title="Enviar nota de voz"
              className="text-[#8696A0] hover:text-[#D1D7DB] transition-colors shrink-0 focus:outline-none"
            >
              <Mic className="w-[19px] h-[19px] stroke-[1.9]" />
            </button>
          )}
        </div>
      </form>

      {/* Modal Lightbox Visualizador de Imagens */}
      <AnimatePresence>
        {viewingImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#0B141A]/95 backdrop-blur-md flex flex-col justify-between overflow-hidden"
          >
            {/* Barra Superior do Visualizador */}
            <div className="px-3 py-2 bg-[#111B21] border-b border-white/10 flex items-center justify-between shrink-0 z-10">
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium text-[#E9EDEF] truncate">
                  {viewingImage.senderName || activeChat.name}
                </div>
                {viewingImage.timestamp && (
                  <div className="text-[10.5px] text-[#8696A0]">
                    Hoje às {viewingImage.timestamp}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.35).toFixed(2))))}
                  title="Reduzir zoom"
                  className="p-1.5 rounded hover:bg-[#202C33] text-[#8696A0] hover:text-[#E9EDEF]"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, Number((z + 0.35).toFixed(2))))}
                  title="Aumentar zoom"
                  className="p-1.5 rounded hover:bg-[#202C33] text-[#8696A0] hover:text-[#E9EDEF]"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  title="Salvar imagem"
                  className="p-1.5 rounded hover:bg-[#202C33] text-[#8696A0] hover:text-[#E9EDEF]"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleOpenExternalImage}
                  title="Abrir em tela cheia no Visualizador de Fotos do Windows"
                  className="p-1.5 rounded hover:bg-[#202C33] text-[#25D366] hover:text-[#E9EDEF]"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewingImage(null)}
                  title="Fechar visualização"
                  className="p-1.5 rounded hover:bg-[#EF4444] text-[#E9EDEF]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Área Central com Imagem ou Vídeo e Zoom */}
            <div
              onClick={() => setViewingImage(null)}
              className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-2 cursor-zoom-out wa-scrollbar"
            >
              {viewingImage.mediaType === 'video' && viewingImage.videoUrl ? (
                <video
                  src={viewingImage.videoUrl}
                  poster={viewingImage.imageUrl || undefined}
                  controls
                  autoPlay
                  playsInline
                  onClick={(e) => e.stopPropagation()}
                  className="max-w-full max-h-full object-contain rounded shadow-lg bg-black"
                />
              ) : (
                <img
                  src={viewingImage.imageUrl}
                  alt={viewingImage.caption || 'Imagem ampliada'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoom((z) => (z > 1 ? 1 : 1.75));
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    handleOpenExternalImage();
                  }}
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center',
                  }}
                  className="max-w-full max-h-full object-contain rounded shadow-lg transition-transform duration-150 cursor-zoom-in"
                />
              )}
            </div>

            {/* Legenda Inferior */}
            {viewingImage.caption && (
              <div className="px-3 py-2 bg-[#111B21]/95 border-t border-white/10 text-[12.5px] text-[#E9EDEF] text-center max-h-[80px] overflow-y-auto wa-scrollbar shrink-0">
                <FormattedText text={viewingImage.caption} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      {/* Seta / Triângulo Inferior Contínuo com o Background do WhatsApp (sem losango interno) */}
      <div
        style={{
          right: `${arrowRightPx - 1}px`,
          clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
        }}
        className="w-[16px] h-[8px] bg-[#0B141A] absolute top-full -mt-[1px] pointer-events-none transition-all duration-200 z-30 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute inset-0 opacity-95 bg-repeat"
          style={{
            backgroundImage: `url('/wa-doodle-bg.png')`,
            backgroundSize: '180px 180px',
            backgroundPosition: `-${currentSize.width - (arrowRightPx - 1) - 16}px -${currentSize.height - 1}px`,
          }}
        />
      </div>
    </motion.div>
  );
};
