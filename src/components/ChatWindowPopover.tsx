import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Minus,
  X,
  Smile,
  AtSign,
  Mic,
  SendHorizontal,
  ZoomIn,
  ZoomOut,
  Download,
  ExternalLink,
  Trash2,
  Pause,
  Search,
  ChevronUp,
  ChevronDown,
  CheckSquare,
  CornerUpRight,
} from 'lucide-react';
import { useBubbleStore, isMatchingMessageId } from '../store/useBubbleStore';
import { useAudioPlaybackStore } from '../store/useAudioPlaybackStore';
import { GroupParticipant, CHAT_SIZE_CONFIG, ChatBubbleSize, ChatSummary, DEFAULT_AVATAR } from '../types/whatsapp';
import { MessageBubble } from './MessageBubble';
import { EmojiStickerPicker, PickerTab } from './EmojiStickerPicker';
import { FormattedText } from './FormattedText';
import { ReactionDetailsModal } from './ReactionDetailsModal';
import { ChatContactSidebar } from './ChatContactSidebar';
import { ForwardMessagesModal } from './ForwardMessagesModal';
import { DeleteMessagesModal } from './DeleteMessagesModal';

interface ChatWindowPopoverProps {
  onInteractiveEnter: () => void;
  onInteractiveLeave: () => void;
}

interface TrackedMentionData {
  id: string;
  rawId: string;
  user: string;
  name: string;
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
    activeReactionDetailsMessage,
    bubbleScale,
    chatSizes,
    setReplyingTo,
    setViewingImage,
    setActiveReactionDetailsMessage,
    minimizeActiveChat,
    closeBubble,
    groupParticipantsByChat,
    fetchGroupParticipants,
    togglePinBubble,
    toggleMuteChat,
    deleteMessages,
    deleteMessagesLocally,
    forwardMessages,
    pinnedChatIds,
    sendMessage,
    sendSticker,
    sendMedia,
    sendVoiceNote,
    sendReaction,
  } = useBubbleStore();

  const [inputText, setInputText] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<PickerTab>('emoji');
  const [pendingMedia, setPendingMedia] = useState<{
    mediaDataUrl: string;
    mediaType?: 'image' | 'video';
    filename?: string;
    caption?: string;
    previousInputText?: string;
  } | null>(null);
  const [pendingCaption, setPendingCaption] = useState('');
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionAtIndex, setMentionAtIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [trackedMentions, setTrackedMentions] = useState<Map<string, TrackedMentionData>>(new Map());
  const [zoom, setZoom] = useState(1);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const isScrollingToBottomRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Estados para Sidebar do Contato, Pesquisa e Seleção de Mensagens
  const [showContactSidebar, setShowContactSidebar] = useState(false);
  const [isSearchingInChat, setIsSearchingInChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndex, setSearchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeletingMessages, setIsDeletingMessages] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesContentRef = useRef<HTMLDivElement | null>(null);
  const unreadDividerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const userHasScrolledUpRef = useRef<boolean>(false);
  const isAtBottomRef = useRef<boolean>(true);
  const initialUnreadScrolledForChatRef = useRef<string | null>(null);
  const hasJumpedToActiveAudioRef = useRef<string | null>(null);
  const initialPositionedForAudioRef = useRef<string | null>(null);
  const userInteractedScrollRef = useRef<boolean>(false);
  const isLoadingOlderRef = useRef<boolean>(false);

  // Estados e Refs para Gravação de Áudio / Nota de Voz (Visual WhatsApp Web)
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [visualizerBars, setVisualizerBars] = useState<number[]>(() => new Array(24).fill(4));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recordedWaveformRef = useRef<number[]>([]);

  const formatRecordDuration = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const secs = String(sec % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const lastActiveChatIdRef = useRef<string | null>(activeChatId);
  if (activeChatId) {
    lastActiveChatIdRef.current = activeChatId;
  }
  const currentChatId = activeChatId || lastActiveChatIdRef.current;

  const lastActiveChatRef = useRef<ChatSummary | undefined>(undefined);
  const activeBubble = activeBubbles.find((b) => b.chatId === currentChatId);
  const activeChat =
    chats.find((c) => c.id === currentChatId) ||
    (activeBubble
      ? {
          id: activeBubble.chatId,
          name: activeBubble.name,
          avatar: activeBubble.avatar,
          unreadCount: activeBubble.unreadCount,
          isMarkedUnread: activeBubble.isMarkedUnread,
          isGroup: Boolean(activeBubble.isGroup),
          isPinned: Boolean(activeBubble.isPinned),
          lastMessage: {
            text: '',
            mediaType: 'text' as const,
            timestamp: '',
          },
        }
      : undefined);
  if (activeChat) {
    lastActiveChatRef.current = activeChat;
  }
  const currentChat = activeChat || lastActiveChatRef.current;

  const isGroupChat = Boolean(currentChat?.isGroup);
  const groupParticipants = (currentChatId && groupParticipantsByChat[currentChatId]) || [];

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
  const messages = currentChatId ? messagesByChat[currentChatId] || [] : [];
  const unreadBanner = currentChatId ? unreadBannerByChat[currentChatId] : undefined;

  const isPinned = Boolean(activeBubble?.isPinned || (currentChatId && pinnedChatIds.includes(currentChatId)));

  const currentSizeKey: ChatBubbleSize = (currentChatId && chatSizes[currentChatId]) || 'pequeno';
  const currentSize = CHAT_SIZE_CONFIG[currentSizeKey] || CHAT_SIZE_CONFIG.pequeno;

  // Calcula a posição horizontal exata da seta e o deslocamento do balão da conversa
  // para acompanhar bolhas afastadas à esquerda no dock inferior,
  // considerando o nível de zoom atual (bubbleScale) e o tamanho da janela
  const activeBubbleIndex = activeBubbles.findIndex((b) => b.chatId === currentChatId);
  const stepsFromRight =
    activeBubbleIndex >= 0 ? activeBubbles.length - activeBubbleIndex : 1;

  // Centro da bolha ativa em relação à borda direita do dock:
  // O botão do WhatsApp tem 48px (centro = 24px) e cada bolha dista 60px (48px + 12px gap),
  // tudo multiplicado pela escala atual de zoom (bubbleScale)
  const bubbleCenterFromRight = Math.round((24 + stepsFromRight * 60) * bubbleScale);
  const idealArrowRight = bubbleCenterFromRight - 7;
  const minArrowRight = 16;
  const maxArrowRightInWindow = currentSize.width - 28;

  let popoverShiftX = 0;
  let arrowRightPx = idealArrowRight;

  if (idealArrowRight > maxArrowRightInWindow) {
    // Quando a bolha está mais afastada à esquerda do que a largura do balão comporta,
    // o balão se desloca para a esquerda (popoverShiftX) e a seta permanece na extremidade esquerda do balão
    const unconstrainedShift = idealArrowRight - maxArrowRightInWindow;
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    // Margem de segurança de 32px para não vazar a borda esquerda do overlay (+ largura da sidebar se aberta)
    const extraLeftSpace = showContactSidebar ? 345 : 32;
    const maxAllowedShift = Math.max(0, screenWidth - currentSize.width - extraLeftSpace);
    popoverShiftX = Math.min(maxAllowedShift, unconstrainedShift);
    arrowRightPx = idealArrowRight - popoverShiftX;
  } else if (idealArrowRight < minArrowRight) {
    arrowRightPx = minArrowRight;
  }

  arrowRightPx = Math.max(minArrowRight, Math.min(maxArrowRightInWindow, arrowRightPx));

  // Determina com precisão a primeira mensagem não lida para posicionamento do divisor
  const firstUnreadMsg = useMemo(() => {
    if (!unreadBanner || unreadBanner.count <= 0 || messages.length === 0) return null;

    if (unreadBanner.firstUnreadMsgId) {
      const match = messages.find((m) =>
        isMatchingMessageId(m.id, unreadBanner.firstUnreadMsgId!)
      );
      if (match) return match;
    }

    let remaining = unreadBanner.count;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (!messages[i].fromMe) {
        remaining--;
        if (remaining <= 0) {
          return messages[i];
        }
      }
    }

    const fallbackIdx = Math.max(0, messages.length - unreadBanner.count);
    return messages[fallbackIdx] || null;
  }, [unreadBanner, messages]);

  const unreadBelowCount = useMemo(() => {
    return unreadBanner?.count || 0;
  }, [unreadBanner]);

  const updateScrollBottomVisibility = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distanceToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const atBottom = distanceToBottom <= 40;

    if (isScrollingToBottomRef.current) {
      if (atBottom) {
        isScrollingToBottomRef.current = false;
      }
      setShowScrollBottomBtn(false);
      return;
    }

    if (atBottom) {
      setShowScrollBottomBtn(false);
      return;
    }

    const hasManyUnread = Boolean(unreadBanner && unreadBanner.count >= 15);

    let messagesBelow = 0;
    const viewportBottom = container.scrollTop + container.clientHeight;
    const children = messagesContentRef.current?.children;

    if (children && children.length > 0) {
      for (let i = children.length - 1; i >= 0; i--) {
        const child = children[i] as HTMLElement;
        if (child.offsetTop >= viewportBottom - 10) {
          messagesBelow++;
        } else {
          break;
        }
      }
    }

    const isFarUp = messagesBelow >= 15 || distanceToBottom >= 700;
    setShowScrollBottomBtn(isFarUp || hasManyUnread);
  }, [unreadBanner]);

  const scrollToTarget = useCallback((forceTarget?: 'divider' | 'bottom') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Se há um áudio em reprodução ou alvo de foco deste contato, NÃO sobrescreve a posição de scroll!
    const playbackStore = useAudioPlaybackStore.getState();
    const hasAudioTarget = Boolean(
      (playbackStore.activeAudio && playbackStore.activeAudio.chatId === currentChatId) ||
      (playbackStore.focusTarget && playbackStore.focusTarget.chatId === currentChatId)
    );
    if (hasAudioTarget) {
      return;
    }

    const hasInitialScrolled = initialUnreadScrolledForChatRef.current === currentChatId;
    const divider = unreadDividerRef.current;
    const hasUnread = Boolean(unreadBanner && unreadBanner.count > 0);

    // Se a conversa tem mensagens não lidas:
    if (hasUnread) {
      if (!hasInitialScrolled || forceTarget === 'divider') {
        if (divider) {
          const containerRect = container.getBoundingClientRect();
          const dividerRect = divider.getBoundingClientRect();
          // Posiciona o divisor a 84px do topo do container (completamente livre da barra de cabeçalho e com respiro visual)
          const targetScrollTop = container.scrollTop + (dividerRect.top - containerRect.top) - 84;
          container.scrollTop = Math.max(0, targetScrollTop);

          // Se a lista de mensagens já completou o fetch da API (ou ambiente sem electron), confirma a rolagem
          if (unreadBanner?.resolvedFromFullFetch || !window.electronAPI) {
            initialUnreadScrolledForChatRef.current = currentChatId;
          }
          userHasScrolledUpRef.current = true;
          isAtBottomRef.current = false;
          requestAnimationFrame(() => {
            updateScrollBottomVisibility();
          });
          return;
        }
        // Se há mensagens não lidas mas o divider ainda não montou no DOM (fetch da API em trânsito),
        // NÃO rola para o rodapé; aguarda a montagem das mensagens com o divisor
        return;
      }
    }

    // Se NÃO há mensagens não lidas na abertura inicial:
    if (!hasUnread && (!hasInitialScrolled || forceTarget === 'bottom')) {
      container.scrollTop = container.scrollHeight;
      initialUnreadScrolledForChatRef.current = currentChatId;
      isAtBottomRef.current = true;
      userHasScrolledUpRef.current = false;
      setShowScrollBottomBtn(false);
      return;
    }

    // Se a rolagem inicial já ocorreu:
    // Apenas mantém acompanhamento no final caso o usuário NÃO tenha rolado para cima
    if (isAtBottomRef.current && !userHasScrolledUpRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [currentChatId, unreadBanner, messages.length, updateScrollBottomVisibility]);

  // Sempre que trocar de conversa (ou abrir a janela), reseta a trava e o estado de rolagem inicial
  useLayoutEffect(() => {
    initialUnreadScrolledForChatRef.current = null;
    hasJumpedToActiveAudioRef.current = null;
    initialPositionedForAudioRef.current = null;
    userInteractedScrollRef.current = false;
    userHasScrolledUpRef.current = false;
    isLoadingOlderRef.current = false;
    isAtBottomRef.current = true;
    isScrollingToBottomRef.current = false;
    setShowScrollBottomBtn(false);
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    setHighlightedMessageId(null);
    setShowContactSidebar(false);
    setIsSearchingInChat(false);
    setSearchQuery('');
    setSearchIndex(0);
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
    setShowForwardModal(false);
    setShowDeleteModal(false);
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
  }, [currentChatId, activeChatId]);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Sincroniza o scroll imediatamente antes da pintura e no próximo frame quando mensagens ou banner mudam
  useLayoutEffect(() => {
    const playbackStore = useAudioPlaybackStore.getState();
    const hasAudioTarget = Boolean(
      (playbackStore.activeAudio && playbackStore.activeAudio.chatId === currentChatId) ||
      (playbackStore.focusTarget && playbackStore.focusTarget.chatId === currentChatId)
    );
    if (hasAudioTarget) {
      if (!initialPositionedForAudioRef.current && scrollContainerRef.current) {
        initialPositionedForAudioRef.current = currentChatId;
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
      return;
    }

    const hasInitialScrolled = initialUnreadScrolledForChatRef.current === currentChatId;
    if (hasInitialScrolled && (userHasScrolledUpRef.current || !isAtBottomRef.current)) {
      return;
    }

    scrollToTarget();
    const rafId = requestAnimationFrame(() => {
      const isDone = initialUnreadScrolledForChatRef.current === currentChatId;
      if (!isDone || (isAtBottomRef.current && !userHasScrolledUpRef.current)) {
        scrollToTarget();
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [
    currentChatId,
    messages,
    unreadBanner?.firstUnreadMsgId,
    unreadBanner?.count,
    unreadBanner?.resolvedFromFullFetch,
    scrollToTarget,
  ]);

  // Observa mudanças de altura do conteúdo (ex: decodificação assíncrona de <img> base64, cards ou figurinhas)
  // para manter a rolagem correta sem atrapalhar quem está lendo mensagens anteriores
  useEffect(() => {
    const contentEl = messagesContentRef.current;
    if (!contentEl) return;

    const observer = new ResizeObserver(() => {
      const playbackStore = useAudioPlaybackStore.getState();
      const hasAudioTarget = Boolean(
        (playbackStore.activeAudio && playbackStore.activeAudio.chatId === currentChatId) ||
        (playbackStore.focusTarget && playbackStore.focusTarget.chatId === currentChatId)
      );
      if (hasAudioTarget) {
        return;
      }

      const hasInitialScrolled = initialUnreadScrolledForChatRef.current === currentChatId;
      const hasUnread = Boolean(unreadBanner && unreadBanner.count > 0);

      // Enquanto o usuário ainda não rolou manualmente com o mouse, mantém o divisor de não lidas ancorado em 84px
      if (hasUnread && !userInteractedScrollRef.current) {
        scrollToTarget('divider');
        return;
      }

      if (!hasInitialScrolled) {
        scrollToTarget();
      } else if (isAtBottomRef.current && !userHasScrolledUpRef.current) {
        const container = scrollContainerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      } else if (userHasScrolledUpRef.current) {
        updateScrollBottomVisibility();
      }
    });

    observer.observe(contentEl);
    return () => observer.disconnect();
  }, [currentChatId, unreadBanner, scrollToTarget, updateScrollBottomVisibility]);

  useEffect(() => {
    if (replyingTo && inputRef.current) {
      inputRef.current.focus();
    }
  }, [replyingTo]);

  // Foco automático no campo de texto ao abrir a conversa ou trocar de chat
  useEffect(() => {
    if (!activeChatId) return;

    const focusInput = () => {
      try {
        window.focus();
      } catch {}
      if (inputRef.current) {
        inputRef.current.focus();
      }
    };

    focusInput();
    const rafId = requestAnimationFrame(focusInput);
    const timer = setTimeout(focusInput, 80);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, [activeChatId]);

  // Redimensionamento dinâmico automático do textarea conforme quebras de linha são inseridas (Shift + Enter)
  useLayoutEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, 100);
    textarea.style.height = `${Math.max(20, nextHeight)}px`;
  }, [inputText]);

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
    if (currentChatId && isGroupChat) {
      fetchGroupParticipants(currentChatId, '', 10);
    }
  }, [currentChatId, isGroupChat, fetchGroupParticipants]);

  // Busca dinamicamente os colaboradores conforme o usuário digita letras após o '@' (máximo 10)
  useEffect(() => {
    if (!currentChatId || !isGroupChat || !showMentionPopover) return;
    const timer = setTimeout(() => {
      fetchGroupParticipants(currentChatId, mentionQuery, 10);
    }, 60);
    return () => clearTimeout(timer);
  }, [currentChatId, isGroupChat, showMentionPopover, mentionQuery, fetchGroupParticipants]);

  // Mantém o índice selecionado dentro dos limites da lista
  useEffect(() => {
    if (selectedMentionIndex >= filteredParticipants.length && filteredParticipants.length > 0) {
      setSelectedMentionIndex(0);
    }
  }, [filteredParticipants.length, selectedMentionIndex]);

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
    isAtBottomRef.current = true;
    userHasScrolledUpRef.current = false;
    setPickerOpen(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    await sendSticker(stickerDataUrl);
    inputRef.current?.focus();
  };

  const handleSelectMediaForPreview = (media: {
    mediaDataUrl: string;
    mediaType?: 'image' | 'video';
    filename?: string;
    caption?: string;
  }) => {
    setPickerOpen(false);
    setPendingCaption(media.caption || '');
    setPendingMedia({
      ...media,
      previousInputText: inputText,
    });
  };

  const handleCancelPendingMedia = useCallback(() => {
    if (pendingMedia?.previousInputText !== undefined) {
      setInputText(pendingMedia.previousInputText);
    }
    setPendingMedia(null);
    setPendingCaption('');
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [pendingMedia]);

  const handleConfirmPendingMedia = useCallback(async () => {
    if (!pendingMedia) return;
    const rawCaption = pendingCaption.trim();
    let captionForWhatsApp = rawCaption;
    const mentionJids = new Set<string>();

    if (rawCaption) {
      for (const [name, data] of trackedMentions.entries()) {
        const mentionTag = `@${name}`;
        if (rawCaption.includes(mentionTag)) {
          if (data.rawId) mentionJids.add(data.rawId);
          if (data.id && data.id !== data.rawId) {
            const formattedId = data.id.includes('@') ? data.id : `${data.id.replace(/\D/g, '')}@c.us`;
            mentionJids.add(formattedId);
          }
          captionForWhatsApp = captionForWhatsApp.split(mentionTag).join(`@${data.user}`);
        }
      }

      if (isGroupChat && groupParticipants.length > 0) {
        const sorted = [...groupParticipants].sort(
          (a, b) => (b.name || '').length - (a.name || '').length
        );
        for (const p of sorted) {
          const cleanName = (p.name || '').replace(/^~/, '').trim();
          if (!cleanName) continue;
          const mentionTag = `@${cleanName}`;
          if (captionForWhatsApp.includes(mentionTag)) {
            const userTag = p.user || (p.rawId || p.id).split('@')[0];
            const rawJid = p.rawId || p.id;
            if (rawJid) mentionJids.add(rawJid);
            if (p.id && p.id !== rawJid) {
              const formattedId = p.id.includes('@') ? p.id : `${p.id.replace(/\D/g, '')}@c.us`;
              mentionJids.add(formattedId);
            }
            captionForWhatsApp = captionForWhatsApp.split(mentionTag).join(`@${userTag}`);
          }
        }
      }
    }

    const toSend = {
      mediaDataUrl: pendingMedia.mediaDataUrl,
      mediaType: pendingMedia.mediaType || 'image',
      filename: pendingMedia.filename || 'foto.jpg',
      caption: captionForWhatsApp ? captionForWhatsApp : undefined,
      mentions: mentionJids.size > 0 ? Array.from(mentionJids) : undefined,
    };
    setPendingMedia(null);
    setPendingCaption('');
    setInputText('');
    isAtBottomRef.current = true;
    userHasScrolledUpRef.current = false;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    await sendMedia(toSend);
    inputRef.current?.focus();
  }, [pendingMedia, pendingCaption, trackedMentions, isGroupChat, groupParticipants, sendMedia]);

  const prevPendingMediaRef = useRef(pendingMedia);
  useEffect(() => {
    if (prevPendingMediaRef.current && !pendingMedia) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    }
    prevPendingMediaRef.current = pendingMedia;
  }, [pendingMedia]);

  const processImageFileForPreview = useCallback(
    (file: File | Blob, fallbackName = 'imagem.png') => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          const textAlreadyTyped = inputText.trim();
          setPickerOpen(false);
          setPendingCaption(textAlreadyTyped);
          setPendingMedia({
            mediaDataUrl: reader.result,
            mediaType: 'image',
            filename: (file as File).name || fallbackName,
            previousInputText: inputText,
          });
        }
      };
      reader.readAsDataURL(file);
    },
    [inputText]
  );

  const handleClipboardPaste = useCallback(
    async (e: React.ClipboardEvent | ClipboardEvent) => {
      if (viewingImage) return;

      const clipboardData = ('clipboardData' in e ? e.clipboardData : null) as DataTransfer | null;
      let handled = false;

      if (clipboardData) {
        // 1. Arquivos arrastados ou colados do Explorer
        if (clipboardData.files && clipboardData.files.length > 0) {
          for (let i = 0; i < clipboardData.files.length; i++) {
            const file = clipboardData.files[i];
            if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
              e.preventDefault();
              e.stopPropagation();
              processImageFileForPreview(file, file.name);
              return;
            }
          }
        }

        // 2. Itens copiados no Clipboard (PrintScreen, Snipping Tool, navegador)
        if (clipboardData.items && clipboardData.items.length > 0) {
          for (let i = 0; i < clipboardData.items.length; i++) {
            const item = clipboardData.items[i];
            if (item.type.startsWith('image/')) {
              const file = item.getAsFile();
              if (file) {
                e.preventDefault();
                e.stopPropagation();
                processImageFileForPreview(file, 'clipboard.png');
                return;
              }
            }
          }
        }
      }

      // 3. Fallback nativo do Electron (somente se não houver texto puro no clipboard)
      if (!handled && window.electronAPI?.readClipboardImage) {
        const hasPlainText = clipboardData && Boolean(clipboardData.getData('text/plain'));
        if (!hasPlainText) {
          try {
            const clip = await window.electronAPI.readClipboardImage();
            if (clip && clip.dataUrl) {
              e.preventDefault();
              e.stopPropagation();
              setPickerOpen(false);
              setPendingCaption(inputText.trim());
              setPendingMedia({
                mediaDataUrl: clip.dataUrl,
                mediaType: 'image',
                filename: clip.filename || 'clipboard.png',
                previousInputText: inputText,
              });
            }
          } catch {
            // Ignora
          }
        }
      }
    },
    [viewingImage, inputText, processImageFileForPreview]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) {
          processImageFileForPreview(file, file.name);
        }
      }
    },
    [processImageFileForPreview]
  );

  const cleanupRecording = useCallback(() => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setIsRecordingPaused(false);
    setRecordDuration(0);
    setVisualizerBars(new Array(24).fill(4));
  }, []);

  const handleCancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }
    cleanupRecording();
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [cleanupRecording]);

  const handleStartRecording = useCallback(async () => {
    if (isRecording) return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert('Seu dispositivo não possui suporte à gravação de microfone.');
        return;
      }

      setPickerOpen(false);
      setShowMentionPopover(false);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = '';
        }
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recordedWaveformRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      setIsRecording(true);
      setIsRecordingPaused(false);
      setRecordDuration(0);

      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVisualizer = () => {
        if (analyserRef.current && mediaRecorderRef.current?.state === 'recording') {
          analyserRef.current.getByteFrequencyData(dataArray);
          const barCount = 24;
          const step = Math.max(1, Math.floor(dataArray.length / barCount));
          const newBars: number[] = [];
          let currentPeak = 0;

          for (let i = 0; i < barCount; i++) {
            const val = dataArray[i * step] || 0;
            const height = Math.max(4, Math.min(22, Math.round((val / 255) * 22)));
            newBars.push(height);
            if (height > currentPeak) currentPeak = height;
          }

          setVisualizerBars(newBars);

          const normalizedPeak = Number((currentPeak / 22).toFixed(2));
          if (recordedWaveformRef.current.length < 34) {
            recordedWaveformRef.current.push(normalizedPeak);
          } else {
            const idx = Math.floor(Math.random() * 34);
            recordedWaveformRef.current[idx] = normalizedPeak;
          }
        }
        animFrameRef.current = requestAnimationFrame(updateVisualizer);
      };
      animFrameRef.current = requestAnimationFrame(updateVisualizer);
    } catch (err) {
      console.error('[VoiceRecorder] Erro ao iniciar gravação:', err);
      cleanupRecording();
      alert('Não foi possível acessar o microfone. Verifique as configurações de privacidade do Windows.');
    }
  }, [isRecording, cleanupRecording]);

  const handlePauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsRecordingPaused(true);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    }
  }, []);

  const handleResumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsRecordingPaused(false);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);

      const dataArray = new Uint8Array(analyserRef.current?.frequencyBinCount || 32);
      const updateVisualizer = () => {
        if (analyserRef.current && mediaRecorderRef.current?.state === 'recording') {
          analyserRef.current.getByteFrequencyData(dataArray);
          const barCount = 24;
          const step = Math.max(1, Math.floor(dataArray.length / barCount));
          const newBars: number[] = [];
          for (let i = 0; i < barCount; i++) {
            const val = dataArray[i * step] || 0;
            const height = Math.max(4, Math.min(22, Math.round((val / 255) * 22)));
            newBars.push(height);
          }
          setVisualizerBars(newBars);
        }
        animFrameRef.current = requestAnimationFrame(updateVisualizer);
      };
      animFrameRef.current = requestAnimationFrame(updateVisualizer);
    }
  }, []);

  const handleSendRecording = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    const duration = recordDuration;
    const waveformSample = [...recordedWaveformRef.current];
    const mimeType = recorder.mimeType || 'audio/webm;codecs=opus';

    await new Promise<void>((resolve) => {
      if (recorder.state !== 'inactive') {
        recorder.onstop = () => resolve();
        recorder.stop();
      } else {
        resolve();
      }
    });

    const finalChunks = [...audioChunksRef.current];
    cleanupRecording();

    if (finalChunks.length === 0) return;

    const audioBlob = new Blob(finalChunks, { type: mimeType });
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const audioDataUrl = reader.result;
        isAtBottomRef.current = true;
        userHasScrolledUpRef.current = false;
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
        await sendVoiceNote({
          audioDataUrl,
          durationSeconds: Math.max(1, duration),
          waveform: waveformSample.length >= 10 ? waveformSample : undefined,
        });
      }
    };
    reader.readAsDataURL(audioBlob);
  }, [recordDuration, cleanupRecording, sendVoiceNote]);

  useEffect(() => {
    return () => {
      cleanupRecording();
    };
  }, [activeChatId, cleanupRecording]);

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (!activeChatId) return;
      handleClipboardPaste(e);
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [activeChatId, handleClipboardPaste]);

  // Atalho do teclado: Tecla ESC
  // Fecha submenus (mídia pendente, lightbox de imagem, gravação, menção ou picker) ou minimiza a conversa
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      // -1.1 Se o modal de confirmação de exclusão estiver aberto, fecha-o
      if (showDeleteModal) {
        e.preventDefault();
        e.stopPropagation();
        if (!isDeletingMessages) {
          setShowDeleteModal(false);
        }
        return;
      }

      // -1. Se o modal de encaminhar mensagens estiver aberto, fecha-o
      if (showForwardModal) {
        e.preventDefault();
        e.stopPropagation();
        setShowForwardModal(false);
        return;
      }

      // 0. Se a barra de pesquisa na conversa estiver aberta, fecha-a
      if (isSearchingInChat) {
        e.preventDefault();
        e.stopPropagation();
        setIsSearchingInChat(false);
        setSearchQuery('');
        return;
      }

      // 0.1 Se estiver no modo de seleção de mensagens, cancela a seleção
      if (isSelectionMode) {
        e.preventDefault();
        e.stopPropagation();
        setIsSelectionMode(false);
        setSelectedMessageIds(new Set());
        return;
      }

      // 0.2 Se a sidebar do contato estiver aberta, fecha-a
      if (showContactSidebar) {
        e.preventDefault();
        e.stopPropagation();
        setShowContactSidebar(false);
        return;
      }

      // 0.3 Se estiver gravando áudio, cancela a gravação
      if (isRecording) {
        e.preventDefault();
        e.stopPropagation();
        handleCancelRecording();
        return;
      }

      // 1. Se estiver com preview de mídia pendente, cancela o envio
      if (pendingMedia) {
        e.preventDefault();
        e.stopPropagation();
        handleCancelPendingMedia();
        return;
      }

      // 2. Se estiver com visualizador fullscreen de imagem/vídeo, fecha-o
      if (viewingImage) {
        e.preventDefault();
        e.stopPropagation();
        setViewingImage(null);
        return;
      }

      // 3. Se o popover de menções estiver aberto, fecha-o
      if (showMentionPopover) {
        e.preventDefault();
        e.stopPropagation();
        setShowMentionPopover(false);
        return;
      }

      // 4. Se o seletor de emojis/figurinhas/anexos estiver aberto, fecha o picker
      if (pickerOpen) {
        e.preventDefault();
        e.stopPropagation();
        setPickerOpen(false);
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
        return;
      }

      // 5. Se nenhuma sobreposição estiver aberta, minimiza a conversa atual
      e.preventDefault();
      e.stopPropagation();
      minimizeActiveChat();
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [
    showForwardModal,
    isSearchingInChat,
    isSelectionMode,
    showContactSidebar,
    isRecording,
    pendingMedia,
    viewingImage,
    showMentionPopover,
    pickerOpen,
    handleCancelRecording,
    handleCancelPendingMedia,
    setViewingImage,
    minimizeActiveChat,
  ]);

  const handleTogglePicker = (tab?: PickerTab) => {
    if (!tab) {
      setPickerOpen((prev) => !prev);
      return;
    }
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

    const userTag = participant.user || (participant.rawId || participant.id).split('@')[0];
    const mentionData: TrackedMentionData = {
      id: participant.id,
      rawId: participant.rawId || participant.id,
      user: userTag,
      name: cleanSelectName,
    };

    setTrackedMentions((prev) => {
      const next = new Map(prev);
      next.set(cleanSelectName, mentionData);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        e.stopPropagation();
        setShowMentionPopover(false);
        return;
      }
    }

    // Regra: Shift + Enter insere nova linha no chat sem enviar; Enter normal envia diretamente
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Permite a quebra de linha padrão do textarea
        return;
      }
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeChatId) return;

    const textToSend = inputText;
    let textForWhatsApp = textToSend;
    const mentionJids = new Set<string>();
    const mentionedNames: string[] = [];

    // 1. Processa menções selecionadas no popover (@Nome -> @userId)
    for (const [name, data] of trackedMentions.entries()) {
      const mentionTag = `@${name}`;
      if (textToSend.includes(mentionTag)) {
        if (data.rawId) {
          mentionJids.add(data.rawId);
        }
        if (data.id && data.id !== data.rawId) {
          const formattedId = data.id.includes('@') ? data.id : `${data.id.replace(/\D/g, '')}@c.us`;
          mentionJids.add(formattedId);
        }
        mentionedNames.push(name);
        textForWhatsApp = textForWhatsApp.split(mentionTag).join(`@${data.user}`);
      }
    }

    // 2. Também verifica menções digitadas manualmente para membros do grupo
    if (isGroupChat && groupParticipants.length > 0) {
      const sorted = [...groupParticipants].sort(
        (a, b) => (b.name || '').length - (a.name || '').length
      );
      for (const p of sorted) {
        const cleanName = (p.name || '').replace(/^~/, '').trim();
        if (!cleanName) continue;
        const mentionTag = `@${cleanName}`;
        if (textForWhatsApp.includes(mentionTag)) {
          const userTag = p.user || (p.rawId || p.id).split('@')[0];
          const rawJid = p.rawId || p.id;
          if (rawJid) mentionJids.add(rawJid);
          if (p.id && p.id !== rawJid) {
            const formattedId = p.id.includes('@') ? p.id : `${p.id.replace(/\D/g, '')}@c.us`;
            mentionJids.add(formattedId);
          }
          if (!mentionedNames.includes(cleanName)) {
            mentionedNames.push(cleanName);
          }
          textForWhatsApp = textForWhatsApp.split(mentionTag).join(`@${userTag}`);
        }
      }
    }

    setInputText('');
    setPickerOpen(false);
    setShowMentionPopover(false);
    setTrackedMentions(new Map());
    isAtBottomRef.current = true;
    userHasScrolledUpRef.current = false;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }

    const mentionList = Array.from(mentionJids);
    await sendMessage(
      textToSend,
      mentionList.length > 0 ? mentionList : undefined,
      textForWhatsApp !== textToSend ? textForWhatsApp : undefined,
      mentionedNames.length > 0 ? mentionedNames : undefined
    );
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

  const maybeLoadOlderMessages = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (
      initialUnreadScrolledForChatRef.current === currentChatId &&
      container.scrollTop <= 20 &&
      !isLoadingOlderRef.current &&
      messages.length >= 25 &&
      messages.length < 500 &&
      window.electronAPI?.getMessages
    ) {
      isLoadingOlderRef.current = true;
      const prevHeight = container.scrollHeight;
      const targetChatId = currentChatId;
      if (targetChatId) {
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
      } else {
        isLoadingOlderRef.current = false;
      }
    }
  }, [currentChatId, messages.length]);

  const handleScrollToBottomSmooth = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    isScrollingToBottomRef.current = true;
    userInteractedScrollRef.current = true;
    userHasScrolledUpRef.current = false;
    isAtBottomRef.current = true;
    setShowScrollBottomBtn(false);

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingToBottomRef.current = false;
    }, 1000);

    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distanceToBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const atBottom = distanceToBottom <= 40;

    isAtBottomRef.current = atBottom;
    userHasScrolledUpRef.current = !atBottom;

    updateScrollBottomVisibility();
    maybeLoadOlderMessages();
  }, [maybeLoadOlderMessages, updateScrollBottomVisibility]);

  const handleJumpToMessage = useCallback(
    async (targetMsgId: string): Promise<boolean> => {
      if (!targetMsgId) return false;

      const findAndScrollToElement = (idToMatch: string): boolean => {
        const container = scrollContainerRef.current;
        if (!container) return false;

        const allMsgEls = container.querySelectorAll<HTMLElement>('[data-msg-id]');
        let targetEl: HTMLElement | null = null;

        // Localiza a mensagem partindo do fim (mais recente) para o início
        for (let i = allMsgEls.length - 1; i >= 0; i--) {
          const el = allMsgEls[i];
          const elMsgId = el.dataset.msgId;
          if (elMsgId && isMatchingMessageId(elMsgId, idToMatch)) {
            targetEl = el;
            break;
          }
        }

        if (targetEl) {
          const foundEl: HTMLElement = targetEl;
          const containerRect = container.getBoundingClientRect();
          const elRect = foundEl.getBoundingClientRect();
          const relativeTop = elRect.top - containerRect.top;
          const targetScrollTop =
            container.scrollTop +
            relativeTop -
            container.clientHeight / 2 +
            elRect.height / 2;

          userInteractedScrollRef.current = true;
          userHasScrolledUpRef.current = true;
          isAtBottomRef.current = false;

          container.scrollTo({
            top: Math.max(0, targetScrollTop),
            behavior: 'smooth',
          });

          setHighlightedMessageId(foundEl.dataset.msgId || idToMatch);
          if (highlightTimerRef.current) {
            clearTimeout(highlightTimerRef.current);
          }
          highlightTimerRef.current = setTimeout(() => {
            setHighlightedMessageId(null);
          }, 2000);

          return true;
        }

        return false;
      };

      // 1. Tenta encontrar a mensagem diretamente no DOM atual
      if (findAndScrollToElement(targetMsgId)) {
        return true;
      }

      // 2. Se não encontrou no DOM mas está presente no array local de mensagens (busca do fim para o início)
      let inMemoryMsg = undefined;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (isMatchingMessageId(messages[i].id, targetMsgId)) {
          inMemoryMsg = messages[i];
          break;
        }
      }
      if (inMemoryMsg) {
        return new Promise<boolean>((resolve) => {
          requestAnimationFrame(() => {
            setTimeout(() => {
              const res = findAndScrollToElement(inMemoryMsg.id);
              resolve(res);
            }, 60);
          });
        });
      }

      // 3. Se a mensagem citada é antiga e não foi carregada no lote inicial
      if (currentChatId && window.electronAPI?.getMessages) {
        try {
          const fetchLimit = Math.min(500, Math.max(150, messages.length + 120));
          const olderMsgs = await window.electronAPI.getMessages(currentChatId, fetchLimit);
          if (olderMsgs && olderMsgs.length > messages.length) {
            useBubbleStore.getState().setMessagesForChat(currentChatId, olderMsgs);
            return new Promise<boolean>((resolve) => {
              requestAnimationFrame(() => {
                setTimeout(() => {
                  const res = findAndScrollToElement(targetMsgId);
                  resolve(res);
                }, 100);
              });
            });
          }
        } catch (err) {
          console.error('[ChatWindowPopover] Erro ao carregar mensagens para ir à citação:', err);
        }
      }

      return false;
    },
    [currentChatId, messages]
  );

  // Se a conversa for aberta/restaurada e houver áudio tocando ou recém-escutado neste chat,
  // foca na mensagem que está tocando o áudio partindo do rodapé (da última mensagem para cima)
  useEffect(() => {
    const playbackStore = useAudioPlaybackStore.getState();
    const target =
      playbackStore.activeAudio && playbackStore.activeAudio.chatId === currentChatId
        ? playbackStore.activeAudio
        : playbackStore.focusTarget && playbackStore.focusTarget.chatId === currentChatId
        ? playbackStore.focusTarget
        : null;

    if (!target) return;

    if (hasJumpedToActiveAudioRef.current === target.messageId) {
      return;
    }

    // Inicia imediatamente no rodapé (última mensagem) para que a busca e foco venham de baixo para cima
    if (scrollContainerRef.current && !initialPositionedForAudioRef.current) {
      initialPositionedForAudioRef.current = currentChatId;
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }

    let isDisposed = false;
    let attempts = 0;

    const doJump = async () => {
      if (isDisposed) return;
      attempts++;
      const jumped = await handleJumpToMessage(target.messageId);
      if (jumped) {
        hasJumpedToActiveAudioRef.current = target.messageId;
        playbackStore.clearFocusTarget(currentChatId);
      } else if (attempts < 6 && !isDisposed) {
        setTimeout(doJump, 80);
      }
    };

    const timer = setTimeout(doJump, 60);

    return () => {
      isDisposed = true;
      clearTimeout(timer);
    };
  }, [currentChatId, messages.length, handleJumpToMessage]);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim() || !messages.length) return [];
    const q = searchQuery.toLowerCase();
    return messages
      .filter((m) => Boolean(m.text && m.text.toLowerCase().includes(q)))
      .map((m) => m.id);
  }, [messages, searchQuery]);

  const handleNextSearchResult = useCallback(() => {
    if (searchMatches.length === 0) return;
    const nextIdx = (searchIndex + 1) % searchMatches.length;
    setSearchIndex(nextIdx);
    handleJumpToMessage(searchMatches[nextIdx]);
  }, [searchMatches, searchIndex, handleJumpToMessage]);

  const handlePrevSearchResult = useCallback(() => {
    if (searchMatches.length === 0) return;
    const prevIdx = (searchIndex - 1 + searchMatches.length) % searchMatches.length;
    setSearchIndex(prevIdx);
    handleJumpToMessage(searchMatches[prevIdx]);
  }, [searchMatches, searchIndex, handleJumpToMessage]);

  const handleCloseSearch = useCallback(() => {
    setIsSearchingInChat(false);
    setSearchQuery('');
    setSearchIndex(0);
  }, []);

  useEffect(() => {
    if (isSearchingInChat && searchMatches.length > 0) {
      handleJumpToMessage(searchMatches[0]);
    }
  }, [searchQuery, isSearchingInChat, searchMatches, handleJumpToMessage]);

  const handleToggleSelectMessage = useCallback((msgId: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  }, []);

  const handleCancelSelection = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedMessageIds(new Set());
  }, []);

  const canDeleteForEveryone = useMemo(() => {
    if (selectedMessageIds.size === 0) return false;
    const idSet = selectedMessageIds;
    const selectedList = messages.filter(
      (m) => idSet.has(m.id) || Array.from(idSet).some((id) => isMatchingMessageId(m.id, id))
    );
    if (selectedList.length === 0) return false;
    return selectedList.every((m) => {
      if (!m.fromMe) return false;
      // WhatsApp só permite "Apagar para todos" dentro da janela de revogação (~48h: Hoje ou Ontem)
      if (m.dateLabel && m.dateLabel !== 'Hoje' && m.dateLabel !== 'Ontem') {
        return false;
      }
      return true;
    });
  }, [messages, selectedMessageIds]);

  const handleDeleteSelectedMessages = useCallback(() => {
    if (!currentChatId || selectedMessageIds.size === 0) return;
    setShowDeleteModal(true);
  }, [currentChatId, selectedMessageIds]);

  const handleConfirmDeleteMessages = useCallback(
    async (everyone: boolean) => {
      if (!currentChatId || selectedMessageIds.size === 0 || isDeletingMessages) return;
      setIsDeletingMessages(true);
      const ids = Array.from(selectedMessageIds);
      const count = ids.length;

      try {
        const success = await deleteMessages(currentChatId, ids, everyone);
        setShowDeleteModal(false);
        setIsSelectionMode(false);
        setSelectedMessageIds(new Set());

        if (success) {
          showToast(
            everyone
              ? `${count} mensagem${count > 1 ? 'ns' : ''} apagada${count > 1 ? 's' : ''} para todos!`
              : `${count} mensagem${count > 1 ? 'ns' : ''} apagada${count > 1 ? 's' : ''} no WhatsApp!`
          );
        } else {
          showToast('Mensagens apagadas localmente. Não foi possível sincronizar com o WhatsApp.');
        }
      } catch (err) {
        console.error('[ChatWindowPopover] Erro ao excluir mensagens:', err);
        setShowDeleteModal(false);
        showToast('Erro ao apagar mensagens no WhatsApp.');
      } finally {
        setIsDeletingMessages(false);
      }
    },
    [currentChatId, selectedMessageIds, isDeletingMessages, deleteMessages, showToast]
  );

  const handleForwardMessages = useCallback(
    async (targetChatId: string) => {
      if (!currentChatId || selectedMessageIds.size === 0) return;
      const count = selectedMessageIds.size;
      const msgsToForward = messages.filter((m) => selectedMessageIds.has(m.id));
      await forwardMessages(targetChatId, msgsToForward);
      setShowForwardModal(false);
      setIsSelectionMode(false);
      setSelectedMessageIds(new Set());
      const targetChat = chats.find((c) => c.id === targetChatId);
      showToast(
        `${count} mensagem${count > 1 ? 'ns' : ''} encaminhada${count > 1 ? 's' : ''} para ${
          targetChat?.name || 'contato'
        }!`
      );
    },
    [currentChatId, selectedMessageIds, messages, forwardMessages, chats, showToast]
  );

  if (!currentChat) return null;

  return (
    <motion.div
      data-interactive="true"
      onMouseEnter={onInteractiveEnter}
      onMouseLeave={onInteractiveLeave}
      onPaste={handleClipboardPaste}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      initial={{ opacity: 0, y: 14, scale: 0.96, x: -popoverShiftX }}
      animate={{ opacity: 1, y: 0, scale: 1, x: -popoverShiftX }}
      exit={{ opacity: 0, y: 12, scale: 0.96, x: -popoverShiftX }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={`relative ${currentSize.widthClass} ${currentSize.heightClass} max-h-[calc(100vh-84px)] flex flex-col pointer-events-auto group/chat transition-[width,height] duration-200`}
    >
      {/* Sidebar do Perfil do Contato/Grupo (estilo evidencias/39.png - desliza por trás à esquerda) */}
      <AnimatePresence>
        {showContactSidebar && (
          <ChatContactSidebar
            chat={currentChat}
            isPinned={isPinned}
            onTogglePin={() => togglePinBubble(currentChat.id)}
            onToggleMute={() => toggleMuteChat(currentChat.id)}
            onStartSearch={() => {
              setShowContactSidebar(false);
              setIsSearchingInChat(true);
            }}
            onStartSelection={() => {
              setShowContactSidebar(false);
              setIsSelectionMode(true);
              setSelectedMessageIds(new Set());
            }}
            onClose={() => setShowContactSidebar(false)}
          />
        )}
      </AnimatePresence>

      <div
        className={`relative z-20 w-full h-full rounded-[10px] overflow-hidden flex flex-col bg-[#0B141A] border border-white/[0.08] transition-shadow duration-300 ${
          showContactSidebar
            ? 'shadow-[-6px_0_18px_rgba(0,0,0,0.65),0_16px_44px_rgba(0,0,0,0.88)]'
            : 'shadow-[0_16px_44px_rgba(0,0,0,0.88)]'
        }`}
      >
        {/* Textura de Fundo Oficial WhatsApp Dark Doodles */}
        <div
          className="absolute inset-0 pointer-events-none opacity-95 bg-repeat"
          style={{
            backgroundImage: `url('/wa-doodle-bg.png')`,
            backgroundSize: '180px 180px',
          }}
        />

      {/* Barra de Topo Minimalista em Hover (Minimizar conversa vs. Fechar/Remover Bolha) */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 px-3 py-1.5 bg-[#111B21]/95 backdrop-blur-md border-b border-white/[0.06] flex items-center justify-between ${
          showContactSidebar ? 'opacity-100 shadow-sm' : 'opacity-0 group-hover/chat:opacity-100 group-hover/chat:shadow-sm'
        } transition-all duration-150`}
      >
        <button
          type="button"
          onClick={() => setShowContactSidebar((prev) => !prev)}
          title="Ver perfil e opções do contato"
          className="flex items-center gap-2 min-w-0 hover:opacity-85 active:scale-95 transition-all text-left cursor-pointer group/headerBtn"
        >
          <img
            src={currentChat.avatar}
            alt={currentChat.name}
            className={`w-6 h-6 rounded-full object-cover border transition-all ${
              showContactSidebar ? 'border-[#00A884] ring-2 ring-[#00A884]/40' : 'border-white/15'
            }`}
          />
          <span className="text-[12.5px] font-medium text-[#E9EDEF] truncate">
            {currentChat.name}
          </span>
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={minimizeActiveChat}
            title="Minimizar conversa (Esc)"
            className="w-6 h-6 rounded-full bg-[#202C33]/90 hover:bg-[#2A3942] text-[#E9EDEF] flex items-center justify-center transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={isPinned}
            onClick={() => {
              if (isPinned || !currentChatId) return;
              closeBubble(currentChatId);
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

      {/* Barra de Pesquisa Dentro da Conversa */}
      <AnimatePresence>
        {isSearchingInChat && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute top-0 left-0 right-0 z-40 p-2 bg-[#111B21] border-b border-white/10 flex items-center gap-2 shadow-xl select-none"
          >
            <Search className="w-4 h-4 text-[#8696A0] shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (e.shiftKey) {
                    handlePrevSearchResult();
                  } else {
                    handleNextSearchResult();
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleCloseSearch();
                }
              }}
              placeholder="Pesquisar nesta conversa..."
              className="flex-1 bg-transparent text-[12.5px] text-[#E9EDEF] placeholder-[#8696A0] outline-none"
              autoFocus
            />
            {searchQuery.trim() && (
              <span className="text-[11px] text-[#8696A0] shrink-0 select-none px-1">
                {searchMatches.length > 0
                  ? `${searchIndex + 1} de ${searchMatches.length}`
                  : 'Nenhum resultado'}
              </span>
            )}
            <button
              type="button"
              disabled={searchMatches.length === 0}
              onClick={handlePrevSearchResult}
              title="Resultado anterior (Shift+Enter)"
              className="p-1 text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronUp className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={searchMatches.length === 0}
              onClick={handleNextSearchResult}
              title="Próximo resultado (Enter)"
              className="p-1 text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleCloseSearch}
              title="Fechar pesquisa (Esc)"
              className="p-1 text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/10 rounded transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Área de Histórico de Mensagens */}
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          onLoadCapture={() => {
            const hasUnread = Boolean(unreadBanner && unreadBanner.count > 0);
            if (hasUnread && !userInteractedScrollRef.current) {
              scrollToTarget('divider');
              return;
            }
            const hasInitialScrolled = initialUnreadScrolledForChatRef.current === currentChatId;
            if (!hasInitialScrolled || (isAtBottomRef.current && !userHasScrolledUpRef.current)) {
              scrollToTarget();
            }
          }}
          onWheel={(e) => {
            userInteractedScrollRef.current = true;
            if (e.deltaY < 0) {
              isScrollingToBottomRef.current = false;
              maybeLoadOlderMessages();
            }
          }}
          onPointerDown={(e) => {
            userInteractedScrollRef.current = true;
            const container = scrollContainerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            // Se o usuário clicou na barra de rolagem à direita para arrastar manualmente
            if (e.clientX >= rect.right - 14) {
              const distanceToBottom =
                container.scrollHeight - container.scrollTop - container.clientHeight;
              const atBottom = distanceToBottom <= 40;
              isAtBottomRef.current = atBottom;
              userHasScrolledUpRef.current = !atBottom;
            }
          }}
          className="relative z-10 flex-1 overflow-y-auto px-3 pt-10 pb-2 wa-scrollbar"
        >
          <div ref={messagesContentRef} className="flex flex-col min-h-full justify-end">
            {messages.map((msg, index) => {
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const isFirstUnread = Boolean(firstUnreadMsg && firstUnreadMsg.id === msg.id);

              const isSenderChanged = Boolean(
                prevMsg && (
                  prevMsg.fromMe !== msg.fromMe ||
                  (!msg.fromMe && currentChat.isGroup && (
                    (prevMsg.senderName || '') !== (msg.senderName || '') ||
                    (prevMsg.senderAvatar && msg.senderAvatar && prevMsg.senderAvatar !== msg.senderAvatar)
                  ))
                )
              );

              const isFirstInGroup =
                !prevMsg ||
                isSenderChanged ||
                Boolean(msg.dateLabel) ||
                isFirstUnread;

              const hasSenderGap = isSenderChanged && !Boolean(msg.dateLabel) && !isFirstUnread;

              return (
                <React.Fragment key={msg.id}>
                  {isFirstUnread && unreadBanner && (
                    <div
                      ref={unreadDividerRef}
                      className="my-3.5 -mx-2 py-1 px-2 flex items-center justify-center gap-2.5 select-none"
                    >
                      <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-[#00A884]/40 to-[#00A884]/65" />
                      <span className="bg-[#182229] border border-[#00A884]/60 text-[#25D366] text-[11px] font-semibold tracking-wider uppercase px-3.5 py-1 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.5)] flex items-center gap-1.5 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
                        {unreadBanner.count === 1
                          ? '1 mensagem não lida'
                          : `${unreadBanner.count} mensagens não lidas`}
                      </span>
                      <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent via-[#00A884]/40 to-[#00A884]/65" />
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    isFirstInGroup={isFirstInGroup}
                    isSenderChanged={hasSenderGap}
                    isGroupChat={currentChat.isGroup}
                    isHighlighted={Boolean(
                      highlightedMessageId && isMatchingMessageId(msg.id, highlightedMessageId)
                    )}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedMessageIds.has(msg.id)}
                    onReply={(quote) => setReplyingTo(quote)}
                    onJumpToMessage={handleJumpToMessage}
                    onToggleSelect={handleToggleSelectMessage}
                  />
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Botão Flutuante para descer até a última mensagem (estilo WhatsApp Web) */}
        <AnimatePresence>
          {showScrollBottomBtn && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-3.5 right-4 z-30 pointer-events-auto"
            >
              <button
                type="button"
                onClick={handleScrollToBottomSmooth}
                title={
                  unreadBelowCount > 0
                    ? `${unreadBelowCount} mensagem${unreadBelowCount > 1 ? 's' : ''} não lida${unreadBelowCount > 1 ? 's' : ''} abaixo`
                    : 'Descer até a última mensagem'
                }
                className="relative flex items-center justify-center w-10 h-10 rounded-full bg-[#202C33] hover:bg-[#2A3942] border border-[#2A3942] text-[#8696A0] hover:text-[#E9EDEF] shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-all cursor-pointer group active:scale-95"
              >
                <ChevronDown className="w-5 h-5 transition-transform group-hover:translate-y-0.5" />
                {unreadBelowCount > 0 && (
                  <span className="absolute -top-1.5 -right-1 min-w-[18px] h-[18px] px-1 bg-[#00A884] text-[#111B21] text-[10.5px] font-bold rounded-full flex items-center justify-center shadow-md select-none pointer-events-none">
                    {unreadBelowCount > 99 ? '99+' : unreadBelowCount}
                  </span>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
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
            <div
              className="flex-1 min-w-0 border-l-[3px] border-[#06CF9C] pl-2 py-0.5 cursor-pointer hover:opacity-90 select-none transition-opacity"
              onClick={() => {
                if (replyingTo.id) {
                  handleJumpToMessage(replyingTo.id);
                }
              }}
              title="Ir para a mensagem citada"
            >
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
            onSelectMedia={handleSelectMediaForPreview}
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
                          src={p.avatar || DEFAULT_AVATAR}
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

      {/* Barra de Digitação Inferior ou Gravador de Voz ou Barra de Seleção de Mensagens */}
      {isSelectionMode ? (
        <div className="relative z-20 mx-2 mb-2 p-2 bg-[#182229] border border-white/10 rounded-[8px] flex items-center justify-between shadow-2xl animate-in slide-in-from-bottom-2 duration-150 select-none">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={handleCancelSelection}
              title="Cancelar seleção (Esc)"
              className="p-1.5 rounded-full hover:bg-white/10 text-[#8696A0] hover:text-[#E9EDEF] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-[12.5px] text-[#E9EDEF] font-medium truncate">
              {selectedMessageIds.size === 0
                ? 'Selecione mensagens'
                : `${selectedMessageIds.size} selecionada${selectedMessageIds.size > 1 ? 's' : ''}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={selectedMessageIds.size === 0}
              onClick={() => setShowForwardModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#00A884] text-white text-[12px] font-medium hover:bg-[#02906f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm cursor-pointer"
              title="Encaminhar para outro contato"
            >
              <CornerUpRight className="w-3.5 h-3.5" />
              <span>Encaminhar</span>
            </button>

            <button
              type="button"
              disabled={selectedMessageIds.size === 0}
              onClick={handleDeleteSelectedMessages}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[#202C33] text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-[12px] font-medium cursor-pointer"
              title="Apagar mensagens no WhatsApp"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Apagar</span>
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="relative z-20 px-2 pb-2 pt-1">
        {isRecording ? (
          <div className="h-[42px] bg-[#202C33] rounded-[8px] px-3 flex items-center justify-between gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.45)] select-none">
            {/* Botão Cancelar / Lixeira (Vermelho) */}
            <button
              type="button"
              onClick={handleCancelRecording}
              title="Cancelar gravação (Esc)"
              className="w-8 h-8 flex items-center justify-center text-[#8696A0] hover:text-[#EF4444] rounded-full hover:bg-white/[0.04] transition-colors shrink-0 focus:outline-none"
            >
              <Trash2 className="w-[18px] h-[18px]" />
            </button>

            {/* Ponto Vermelho Pulsante + Tempo de Gravação */}
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isRecordingPaused ? 'bg-[#8696A0]' : 'bg-[#EF4444] animate-pulse'
                }`}
              />
              <span className="text-[13px] font-medium text-[#E9EDEF] font-mono tabular-nums">
                {formatRecordDuration(recordDuration)}
              </span>
            </div>

            {/* Onda Sonora Animada Dinâmica (Waveform em tempo real) */}
            <div className="flex-1 flex items-center justify-center gap-[3px] h-[24px] px-1 overflow-hidden">
              {visualizerBars.map((barHeight, idx) => (
                <div
                  key={idx}
                  className="w-[2.5px] rounded-full transition-all duration-75"
                  style={{
                    height: `${barHeight}px`,
                    backgroundColor: isRecordingPaused ? '#8696A0' : '#00A884',
                  }}
                />
              ))}
            </div>

            {/* Botão Pausar / Retomar Gravação */}
            {isRecordingPaused ? (
              <button
                type="button"
                onClick={handleResumeRecording}
                title="Retomar gravação"
                className="w-8 h-8 flex items-center justify-center text-[#EF4444] hover:text-[#F87171] rounded-full hover:bg-white/[0.04] transition-colors shrink-0 focus:outline-none"
              >
                <Mic className="w-[18px] h-[18px]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePauseRecording}
                title="Pausar gravação"
                className="w-8 h-8 flex items-center justify-center text-[#8696A0] hover:text-[#E9EDEF] rounded-full hover:bg-white/[0.04] transition-colors shrink-0 focus:outline-none"
              >
                <Pause className="w-[18px] h-[18px]" />
              </button>
            )}

            {/* Botão Enviar Áudio (Círculo Verde WhatsApp) */}
            <button
              type="button"
              onClick={handleSendRecording}
              title="Enviar nota de voz"
              className="w-8 h-8 rounded-full bg-[#00A884] hover:bg-[#06CF9C] text-white flex items-center justify-center transition-all shadow-[0_2px_6px_rgba(0,168,132,0.4)] active:scale-95 shrink-0 focus:outline-none"
            >
              <SendHorizontal className="w-[16px] h-[16px] ml-0.5" />
            </button>
          </div>
        ) : (
          <div className="min-h-[42px] max-h-[120px] bg-[#202C33] rounded-[8px] px-3 py-1.5 flex items-end gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
            {/* Botão Único para Painel de Emojis, Figurinhas e Anexos */}
            <button
              type="button"
              onClick={() => handleTogglePicker()}
              title="Emojis, figurinhas e anexos"
              className={`transition-colors shrink-0 focus:outline-none mb-1 ${
                pickerOpen
                  ? 'text-[#00A884]'
                  : 'text-[#8696A0] hover:text-[#D1D7DB]'
              }`}
            >
              <Smile className="w-[20px] h-[20px] stroke-[1.9]" />
            </button>

            {/* Campo de Texto */}
            <textarea
              ref={inputRef}
              rows={1}
              autoFocus
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleInputKeyDown}
              onPaste={handleClipboardPaste}
              placeholder={
                isGroupChat
                  ? 'Digite uma mensagem ou @ para marcar...'
                  : 'Digite uma mensagem'
              }
              className="flex-1 bg-transparent text-[13.5px] text-[#D1D7DB] placeholder-[#8696A0] focus:outline-none resize-none overflow-y-auto max-h-[96px] py-1 leading-[20px] wa-scrollbar"
            />

            {/* Botão Microfone ou Enviar */}
            {inputText.trim().length > 0 ? (
              <button
                type="submit"
                title="Enviar mensagem"
                className="text-[#00A884] hover:text-[#25D366] transition-transform active:scale-90 shrink-0 focus:outline-none mb-1"
              >
                <SendHorizontal className="w-[19px] h-[19px]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartRecording}
                title="Gravar nota de voz"
                className="text-[#8696A0] hover:text-[#D1D7DB] transition-colors shrink-0 focus:outline-none hover:scale-105 active:scale-95 mb-1"
              >
                <Mic className="w-[19px] h-[19px] stroke-[1.9]" />
              </button>
            )}
          </div>
        )}
      </form>
      )}

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
                  {viewingImage.senderName || currentChat.name}
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

      {/* Modal de Confirmação e Prévia de Envio de Imagem (Estilo Evidência 16.png) */}
      <AnimatePresence>
        {pendingMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#0B141A] flex flex-col justify-between overflow-hidden select-none"
          >
            {/* Barra Superior */}
            <div className="px-3 py-2 bg-[#111B21] border-b border-white/10 flex items-center justify-between shrink-0 z-10">
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold text-[#E9EDEF] truncate">
                  {pendingMedia.mediaType === 'video' ? 'Enviar vídeo' : 'Enviar foto'}
                </div>
                <div className="text-[11px] text-[#8696A0] truncate">
                  Para {activeChat?.name}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancelPendingMedia}
                title="Cancelar envio (Esc)"
                className="p-1.5 rounded-full hover:bg-[#202C33] text-[#8696A0] hover:text-[#E9EDEF] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Área Central com a Imagem / Vídeo */}
            <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-3 wa-scrollbar">
              {pendingMedia.mediaType === 'video' ? (
                <video
                  src={pendingMedia.mediaDataUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-w-full max-h-full object-contain rounded-md shadow-2xl bg-black"
                />
              ) : (
                <img
                  src={pendingMedia.mediaDataUrl}
                  alt="Pré-visualização da imagem"
                  className="max-w-full max-h-full object-contain rounded-md shadow-2xl"
                />
              )}
            </div>

            {/* Barra Inferior com Legenda e Botões Cancelar / Confirmar */}
            <div className="p-2.5 bg-[#111B21] border-t border-white/10 flex items-center gap-2 shrink-0 z-10">
              <input
                type="text"
                value={pendingCaption}
                onChange={(e) => setPendingCaption(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmPendingMedia();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancelPendingMedia();
                  }
                }}
                placeholder="Adicionar legenda... (Opcional)"
                autoFocus
                className="flex-1 bg-[#202C33] text-[13px] text-[#D1D7DB] placeholder-[#8696A0] px-3.5 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00A884]/60 transition-all border border-transparent"
              />

              <button
                type="button"
                onClick={handleCancelPendingMedia}
                title="Cancelar envio (Esc)"
                className="px-3 py-2 text-[12.5px] font-medium text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[#202C33] rounded-lg transition-colors shrink-0"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmPendingMedia}
                title="Confirmar e enviar foto (Enter)"
                className="w-9 h-9 rounded-full bg-[#00A884] hover:bg-[#008f6f] text-white flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 shrink-0"
              >
                <SendHorizontal className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Detalhes das Reações (Scoped dentro do container da janela de conversa) */}
      <AnimatePresence>
        {activeReactionDetailsMessage && (
          <ReactionDetailsModal
            message={activeReactionDetailsMessage}
            onClose={() => setActiveReactionDetailsMessage(null)}
            onToggleReaction={(emoji) => {
              sendReaction(
                activeReactionDetailsMessage.chatId,
                activeReactionDetailsMessage.id,
                emoji
              );
            }}
          />
        )}
      </AnimatePresence>

      {/* Modal de Encaminhar Mensagens Selecionadas */}
      <AnimatePresence>
        {showForwardModal && (
          <ForwardMessagesModal
            chats={chats}
            currentChatId={currentChatId || undefined}
            selectedCount={selectedMessageIds.size}
            onForward={handleForwardMessages}
            onClose={() => setShowForwardModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Modal de Confirmação para Apagar Mensagens no WhatsApp */}
      <AnimatePresence>
        {showDeleteModal && (
          <DeleteMessagesModal
            selectedCount={selectedMessageIds.size}
            canDeleteForEveryone={canDeleteForEveryone}
            isDeleting={isDeletingMessages}
            onDeleteForEveryone={() => handleConfirmDeleteMessages(true)}
            onDeleteForMe={() => handleConfirmDeleteMessages(false)}
            onClose={() => {
              if (!isDeletingMessages) {
                setShowDeleteModal(false);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Notificação Toast Flutuante */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 bg-[#202C33]/95 border border-[#00A884]/40 text-[#E9EDEF] text-[12px] rounded-full shadow-2xl flex items-center gap-2 select-none pointer-events-none"
          >
            <span className="w-2 h-2 rounded-full bg-[#00A884]" />
            <span>{toastMessage}</span>
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
