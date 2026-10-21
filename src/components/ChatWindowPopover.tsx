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
} from 'lucide-react';
import { useBubbleStore } from '../store/useBubbleStore';
import { GroupParticipant, CHAT_SIZE_CONFIG, ChatBubbleSize, ChatSummary, DEFAULT_AVATAR } from '../types/whatsapp';
import { MessageBubble } from './MessageBubble';
import { EmojiStickerPicker, PickerTab } from './EmojiStickerPicker';
import { FormattedText } from './FormattedText';

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
    sendMedia,
    sendVoiceNote,
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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesContentRef = useRef<HTMLDivElement | null>(null);
  const unreadDividerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const userHasScrolledUpRef = useRef<boolean>(false);
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
  const activeChat = chats.find((c) => c.id === currentChatId);
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

  const activeBubble = activeBubbles.find((b) => b.chatId === currentChatId);
  const isPinned = Boolean(activeBubble?.isPinned);

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
    // Margem de segurança de 32px para não vazar a borda esquerda do overlay
    const maxAllowedShift = Math.max(0, screenWidth - currentSize.width - 32);
    popoverShiftX = Math.min(maxAllowedShift, unconstrainedShift);
    arrowRightPx = idealArrowRight - popoverShiftX;
  } else if (idealArrowRight < minArrowRight) {
    arrowRightPx = minArrowRight;
  }

  arrowRightPx = Math.max(minArrowRight, Math.min(maxArrowRightInWindow, arrowRightPx));

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
  }, [currentChatId]);

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
  }, [currentChatId, messages, unreadBanner?.firstUnreadMsgId, unreadBanner?.count, scrollToTarget]);

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
  }, [currentChatId, scrollToTarget]);

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
    userHasScrolledUpRef.current = false;
    setPickerOpen(false);
    await sendSticker(stickerDataUrl);
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
    userHasScrolledUpRef.current = false;
    await sendMedia(toSend);
  }, [pendingMedia, pendingCaption, trackedMentions, isGroupChat, groupParticipants, sendMedia]);

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
        userHasScrolledUpRef.current = false;
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

      // 0. Se estiver gravando áudio, cancela a gravação
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
        e.stopPropagation();
        setShowMentionPopover(false);
        return;
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    userHasScrolledUpRef.current = false;

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
            src={currentChat.avatar}
            alt={currentChat.name}
            className="w-6 h-6 rounded-full object-cover border border-white/15"
          />
          <span className="text-[12.5px] font-medium text-[#E9EDEF] truncate">
            {currentChat.name}
          </span>
        </div>

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
                  isGroupChat={currentChat.isGroup}
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

      {/* Barra de Digitação Inferior ou Gravador de Voz (Visual WhatsApp Web) */}
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
          <div className="h-[42px] bg-[#202C33] rounded-[8px] px-3 flex items-center gap-2 shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
            {/* Botão Único para Painel de Emojis, Figurinhas e Anexos */}
            <button
              type="button"
              onClick={() => handleTogglePicker()}
              title="Emojis, figurinhas e anexos"
              className={`transition-colors shrink-0 focus:outline-none ${
                pickerOpen
                  ? 'text-[#00A884]'
                  : 'text-[#8696A0] hover:text-[#D1D7DB]'
              }`}
            >
              <Smile className="w-[20px] h-[20px] stroke-[1.9]" />
            </button>

            {/* Campo de Texto */}
            <input
              ref={inputRef}
              type="text"
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
                onClick={handleStartRecording}
                title="Gravar nota de voz"
                className="text-[#8696A0] hover:text-[#D1D7DB] transition-colors shrink-0 focus:outline-none hover:scale-105 active:scale-95"
              >
                <Mic className="w-[19px] h-[19px] stroke-[1.9]" />
              </button>
            )}
          </div>
        )}
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
