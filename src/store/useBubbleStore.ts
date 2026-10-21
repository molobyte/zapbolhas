import { create } from 'zustand';
import {
  ActivePopover,
  BubbleItem,
  ChatBubbleSize,
  ChatSummary,
  ConnectionMode,
  FormattedMessage,
  GroupParticipant,
  IncomingMessagePayload,
  QuotedMessage,
  SavedContact,
  SoundPreset,
  ViewingImageState,
  WaConnectionState,
} from '../types/whatsapp';
import { triggerIncomingNotificationSound } from '../utils/notificationSound';

export interface UnreadBannerInfo {
  count: number;
  firstUnreadMsgId?: string;
  resolvedFromFullFetch?: boolean;
}

function computeFirstUnreadMsgId(
  messages: FormattedMessage[],
  unreadCount: number
): string | undefined {
  if (!messages || messages.length === 0 || unreadCount <= 0) return undefined;
  let remaining = unreadCount;
  let firstUnreadId: string | undefined;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (!messages[i].fromMe) {
      firstUnreadId = messages[i].id;
      remaining--;
      if (remaining === 0) {
        return firstUnreadId;
      }
    }
  }
  return firstUnreadId || messages[Math.max(0, messages.length - unreadCount)]?.id;
}

interface SavedUserSettings {
  bubbleScale: number;
  maxBubbles: number;
  soundMuted: boolean;
  userSoundPreset: SoundPreset;
  groupSoundPreset: SoundPreset;
  customUserSoundName?: string;
  customGroupSoundName?: string;
}

const SETTINGS_STORAGE_KEY = 'whatsapp-bubbles-settings-v1';

function loadUserSettings(): SavedUserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        bubbleScale:
          typeof parsed.bubbleScale === 'number'
            ? Math.min(1.45, Math.max(0.65, parsed.bubbleScale))
            : 1,
        maxBubbles:
          typeof parsed.maxBubbles === 'number'
            ? Math.min(15, Math.max(1, Math.round(parsed.maxBubbles)))
            : 10,
        soundMuted: Boolean(parsed.soundMuted),
        userSoundPreset: parsed.userSoundPreset || 'default',
        groupSoundPreset: parsed.groupSoundPreset || 'default',
        customUserSoundName: parsed.customUserSoundName,
        customGroupSoundName: parsed.customGroupSoundName,
      };
    }
  } catch {
    // Ignore localStorage error
  }
  return {
    bubbleScale: 1,
    maxBubbles: 10,
    soundMuted: false,
    userSoundPreset: 'default',
    groupSoundPreset: 'default',
  };
}

function saveUserSettings(settings: SavedUserSettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore localStorage error
  }
}

const PINNED_STORAGE_KEY = 'whatsapp-bubbles-pinned-chats-v1';
const CHAT_SIZES_STORAGE_KEY = 'whatsapp-bubbles-chat-sizes-v1';

function loadPinnedChatIds(): string[] {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((id) => typeof id === 'string');
    }
  } catch {
    // Ignore localStorage error
  }
  return [];
}

function savePinnedChatIds(ids: string[]): void {
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Ignore localStorage error
  }
}

function loadChatSizes(): Record<string, ChatBubbleSize> {
  try {
    const raw = localStorage.getItem(CHAT_SIZES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
    }
  } catch {
    // Ignore localStorage error
  }
  return {};
}

function saveChatSizes(sizes: Record<string, ChatBubbleSize>): void {
  try {
    localStorage.setItem(CHAT_SIZES_STORAGE_KEY, JSON.stringify(sizes));
  } catch {
    // Ignore localStorage error
  }
}

export function organizeBubbles(
  bubbles: BubbleItem[],
  maxBubbles: number,
  pinnedChatIds: string[]
): BubbleItem[] {
  const isPinned = (chatId: string) => pinnedChatIds.includes(chatId);

  const unpinned: { item: BubbleItem; originalIndex: number }[] = [];
  const pinned: { item: BubbleItem; originalIndex: number }[] = [];

  bubbles.forEach((b, idx) => {
    if (isPinned(b.chatId)) {
      pinned.push({ item: { ...b, isPinned: true }, originalIndex: idx });
    } else {
      unpinned.push({ item: { ...b, isPinned: false }, originalIndex: idx });
    }
  });

  const now = Date.now();
  const getSortKey = (entry: { item: BubbleItem; originalIndex: number }) => {
    if (typeof entry.item.lastActivity === 'number' && entry.item.lastActivity > 0) {
      return entry.item.lastActivity;
    }
    // Preserva a posição relativa caso não haja timestamp registrado
    const fallback = now - (bubbles.length - entry.originalIndex) * 1000;
    entry.item.lastActivity = fallback;
    return fallback;
  };

  // Ordena por recência/atividade: mais antigas à esquerda, mais recentes à direita
  unpinned.sort((a, b) => getSortKey(a) - getSortKey(b));
  pinned.sort((a, b) => getSortKey(a) - getSortKey(b));

  // Conversas fixadas são sempre mantidas; não-fixadas ocupam as vagas restantes
  const availableSlots = Math.max(0, maxBubbles - pinned.length);
  const trimmedUnpinned = unpinned.slice(-availableSlots).map((e) => e.item);
  const finalPinned = pinned.map((e) => e.item);

  // Não-fixadas à esquerda (0..k), fixadas à direita (junto ao botão do WhatsApp)
  return [...trimmedUnpinned, ...finalPinned];
}

export function moveBubbleToMostRecent(
  bubbles: BubbleItem[],
  chatId: string,
  maxBubbles: number,
  pinnedChatIds: string[]
): BubbleItem[] {
  const bubble = bubbles.find((b) => b.chatId === chatId);
  if (!bubble) {
    return organizeBubbles(bubbles, maxBubbles, pinnedChatIds);
  }

  const now = Date.now();
  const updated = bubbles.map((b) =>
    b.chatId === chatId ? { ...b, lastActivity: now } : b
  );
  return organizeBubbles(updated, maxBubbles, pinnedChatIds);
}

const initialSettings = loadUserSettings();
const initialPinnedChatIds = loadPinnedChatIds();
const initialChatSizes = loadChatSizes();

interface BubbleStoreState {
  mode: ConnectionMode;
  waStatus: WaConnectionState;
  qrDataUrl: string | null;
  waError: string | null;
  hasSyncedRealChats: boolean;

  // Configurações do Usuário
  bubbleScale: number;
  maxBubbles: number;
  soundMuted: boolean;
  userSoundPreset: SoundPreset;
  groupSoundPreset: SoundPreset;
  customUserSoundName?: string;
  customGroupSoundName?: string;

  chats: ChatSummary[];
  activeBubbles: BubbleItem[];
  pinnedChatIds: string[];
  chatSizes: Record<string, ChatBubbleSize>;
  activePopover: ActivePopover;
  activeChatId: string | null;
  messagesByChat: Record<string, FormattedMessage[]>;
  groupParticipantsByChat: Record<string, GroupParticipant[]>;
  initialGroupParticipantsByChat: Record<string, GroupParticipant[]>;
  unreadBannerByChat: Record<string, UnreadBannerInfo | undefined>;
  replyingTo: QuotedMessage | null;
  viewingImage: ViewingImageState | null;
  savedContacts: SavedContact[];
  isLoadingContacts: boolean;

  // Actions
  setWaStatus: (status: WaConnectionState, error?: string | null) => void;
  setQrDataUrl: (qr: string | null) => void;
  setChats: (chats: ChatSummary[]) => void;
  applyRealWhatsAppChats: (chats: ChatSummary[]) => void;
  setMessagesForChat: (chatId: string, messages: FormattedMessage[]) => void;
  fetchGroupParticipants: (
    chatId: string,
    query?: string,
    limit?: number
  ) => Promise<GroupParticipant[]>;
  updateMessageMedia: (chatId: string, msgId: string, mediaDataUrl: string) => void;
  setReplyingTo: (quote: QuotedMessage | null) => void;
  setViewingImage: (img: ViewingImageState | null) => void;

  // Settings Actions
  setBubbleScale: (scale: number) => void;
  setMaxBubbles: (max: number) => void;
  setSoundMuted: (muted: boolean) => void;
  setUserSoundPreset: (preset: SoundPreset, customFileName?: string) => void;
  setGroupSoundPreset: (preset: SoundPreset, customFileName?: string) => void;
  applyExternalSettingsUpdate: (patch: Record<string, unknown>) => void;
  openSettings: () => void;
  logoutWhatsApp: () => Promise<void>;
  refreshApp: () => Promise<void>;

  // Core Business Logic Flows (Specs Section 5)
  toggleMainButton: () => void;
  selectChatFromList: (chatId: string) => void;
  fetchSavedContacts: (query?: string) => Promise<void>;
  startChatWithContact: (contact: SavedContact) => void;
  toggleBubbleChat: (chatId: string) => void;
  minimizeActiveChat: () => void;
  closeBubble: (chatId: string) => void;
  togglePinBubble: (chatId: string) => void;
  setChatBubbleSize: (chatId: string, size: ChatBubbleSize) => void;
  sendMessage: (
    text: string,
    mentions?: string[],
    textForWhatsApp?: string,
    mentionedDisplayNames?: string[]
  ) => Promise<void>;
  sendSticker: (stickerDataUrl: string) => Promise<void>;
  sendMedia: (payload: {
    mediaDataUrl: string;
    mediaType?: 'image' | 'video';
    caption?: string;
    filename?: string;
    mentions?: string[];
  }) => Promise<void>;
  sendVoiceNote: (payload: {
    audioDataUrl: string;
    durationSeconds: number;
    waveform?: number[];
  }) => Promise<void>;
  receiveIncomingMessage: (payload: IncomingMessagePayload) => void;
}

function getCurrentTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export const useBubbleStore = create<BubbleStoreState>((set, get) => ({
  mode: 'whatsapp',
  waStatus: 'initializing',
  qrDataUrl: null,
  waError: null,
  hasSyncedRealChats: false,

  bubbleScale: initialSettings.bubbleScale,
  maxBubbles: initialSettings.maxBubbles,
  soundMuted: initialSettings.soundMuted,
  userSoundPreset: initialSettings.userSoundPreset,
  groupSoundPreset: initialSettings.groupSoundPreset,
  customUserSoundName: initialSettings.customUserSoundName,
  customGroupSoundName: initialSettings.customGroupSoundName,

  chats: [],
  activeBubbles: [],
  pinnedChatIds: initialPinnedChatIds,
  chatSizes: initialChatSizes,
  activePopover: 'none',
  activeChatId: null,
  messagesByChat: {},
  groupParticipantsByChat: {},
  initialGroupParticipantsByChat: {},
  unreadBannerByChat: {},
  replyingTo: null,
  viewingImage: null,
  savedContacts: [],
  isLoadingContacts: false,

  setWaStatus: (waStatus, waError = null) => {
    const { activePopover } = get();
    set({ waStatus, waError });

    if (waStatus === 'qr') {
      // Sem sessão conectada: abre automaticamente o leitor de QR Code
      set({
        mode: 'whatsapp',
        activePopover: 'qr-code',
        activeChatId: null,
        viewingImage: null,
      });
      return;
    }

    if (waStatus === 'authenticated') {
      set({
        mode: 'whatsapp',
        activePopover: activePopover === 'qr-code' ? 'chat-list' : activePopover,
      });
      return;
    }

    if (waStatus === 'ready') {
      set({
        mode: 'whatsapp',
        activePopover: activePopover === 'qr-code' ? 'chat-list' : activePopover,
      });
      if (window.electronAPI) {
        window.electronAPI.getChats().then((realChats) => {
          if (realChats && realChats.length > 0) {
            get().applyRealWhatsAppChats(realChats);
          }
        });
      }
    }
  },

  setQrDataUrl: (qrDataUrl) => set({ qrDataUrl }),

  setChats: (chats) => set({ chats }),

  applyRealWhatsAppChats: (realChats) => {
    const {
      hasSyncedRealChats,
      activeBubbles,
      activePopover,
      activeChatId,
    } = get();

    if (!realChats || realChats.length === 0) return;

    if (!hasSyncedRealChats) {
      const { maxBubbles, pinnedChatIds } = get();
      // Primeira sincronização real: cria bolhas para as conversas reais não silenciadas que possuem mensagens não lidas.
      // As mais recentes ficam na direita (final do array) e respeitam o limite maxBubbles.
      const initialRealBubbles: BubbleItem[] = realChats
        .filter((c) => c.unreadCount > 0 && !c.isMuted)
        .slice(0, maxBubbles)
        .reverse()
        .map((c, idx) => ({
          chatId: c.id,
          name: c.name,
          avatar: c.avatar,
          unreadCount: c.unreadCount,
          isPinned: pinnedChatIds.includes(c.id),
          isGroup: c.isGroup,
          hasMention: Boolean(c.hasMention),
          lastActivity: Date.now() - (maxBubbles - idx) * 1000,
        }));

      const organizedInitial = organizeBubbles(initialRealBubbles, maxBubbles, pinnedChatIds);

      set({
        mode: 'whatsapp',
        waStatus: 'ready',
        hasSyncedRealChats: true,
        chats: realChats,
        activeBubbles: organizedInitial,
        messagesByChat: {},
        activePopover: activePopover === 'qr-code' ? 'chat-list' : activePopover,
        activeChatId: null,
      });
      return;
    }

    const { maxBubbles, pinnedChatIds } = get();
    const isAnyChatOpen = activePopover === 'chat-window' && Boolean(activeChatId);

    // Sincronizações subsequentes em segundo plano: atualiza lista e mantém bolhas sincronizadas
    const chatMap = new Map(realChats.map((c) => [c.id, c]));
    let updatedBubbles = activeBubbles.map((b) => {
      const fresh = chatMap.get(b.chatId);
      if (!fresh) return b;
      const isCurrentlyOpen = isAnyChatOpen && activeChatId === b.chatId;
      const unreadCount = isCurrentlyOpen ? 0 : fresh.unreadCount;
      const hasMention = isCurrentlyOpen || unreadCount === 0
        ? false
        : Boolean(fresh.hasMention);
      return {
        ...b,
        name: fresh.name,
        avatar: fresh.avatar,
        unreadCount,
        isPinned: b.isPinned ?? pinnedChatIds.includes(b.chatId),
        isGroup: fresh.isGroup ?? b.isGroup,
        hasMention,
      };
    });

    // Se surgiu alguma conversa não silenciada com unreadCount > 0 que ainda não tem bolha, cria a bolha
    for (const c of realChats) {
      if (
        c.unreadCount > 0 &&
        !c.isMuted &&
        !updatedBubbles.some((b) => b.chatId === c.id)
      ) {
        const newB: BubbleItem = {
          chatId: c.id,
          name: c.name,
          avatar: c.avatar,
          unreadCount: c.unreadCount,
          isPinned: pinnedChatIds.includes(c.id),
          isGroup: c.isGroup,
          hasMention: Boolean(c.hasMention),
          lastActivity: Date.now(),
        };
        if (isAnyChatOpen) {
          // Insere na última esquerda para não movimentar as bolhas existentes
          updatedBubbles = [newB, ...updatedBubbles];
        } else {
          updatedBubbles = [...updatedBubbles, newB];
        }
      }
    }
    const finalBubbles = isAnyChatOpen
      ? updatedBubbles
      : organizeBubbles(updatedBubbles, maxBubbles, pinnedChatIds);

    const normalizedChats = realChats.map((c) => {
      const isCurrentlyOpen =
        activePopover === 'chat-window' && activeChatId === c.id;
      if (isCurrentlyOpen && (c.unreadCount > 0 || c.hasMention)) {
        window.electronAPI?.markAsRead(c.id);
        return { ...c, unreadCount: 0, hasMention: false };
      }
      return c;
    });

    set({
      mode: 'whatsapp',
      chats: normalizedChats,
      activeBubbles: finalBubbles,
    });
  },

  setMessagesForChat: (chatId, messages) =>
    set((state) => {
      const prevMsgs = state.messagesByChat[chatId] || [];
      const hdMap = new Map(
        prevMsgs.filter((m) => m.isHdLoaded).map((m) => [m.id, m])
      );
      const merged = messages.map((m) => {
        const prevHd = hdMap.get(m.id);
        if (!prevHd || m.isHdLoaded) return m;
        return {
          ...m,
          imageUrl: prevHd.imageUrl || m.imageUrl,
          videoUrl: prevHd.videoUrl || m.videoUrl,
          isHdLoaded: true,
          audioData:
            m.audioData && prevHd.audioData?.audioUrl
              ? { ...m.audioData, audioUrl: prevHd.audioData.audioUrl }
              : m.audioData,
        };
      });

      const currentBanner = state.unreadBannerByChat[chatId];
      let updatedBanner = currentBanner;
      if (currentBanner && currentBanner.count > 0 && !currentBanner.resolvedFromFullFetch) {
        updatedBanner = {
          ...currentBanner,
          firstUnreadMsgId: computeFirstUnreadMsgId(merged, currentBanner.count),
          resolvedFromFullFetch: true,
        };
      }

      return {
        messagesByChat: {
          ...state.messagesByChat,
          [chatId]: merged,
        },
        unreadBannerByChat: {
          ...state.unreadBannerByChat,
          [chatId]: updatedBanner,
        },
      };
    }),

  fetchGroupParticipants: async (chatId, query, limit = 10) => {
    const { initialGroupParticipantsByChat } = get();
    const cleanQuery = (query || '').trim();
    const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));

    // Se a busca estiver vazia e já temos a lista inicial de participantes para este grupo, restaura imediatamente
    if (!cleanQuery && initialGroupParticipantsByChat[chatId]?.length > 0) {
      set((state) => ({
        groupParticipantsByChat: {
          ...state.groupParticipantsByChat,
          [chatId]: initialGroupParticipantsByChat[chatId],
        },
      }));
      return initialGroupParticipantsByChat[chatId];
    }

    if (window.electronAPI?.getGroupParticipants) {
      try {
        const participants = await window.electronAPI.getGroupParticipants(
          chatId,
          cleanQuery,
          safeLimit
        );
        if (participants) {
          set((state) => ({
            groupParticipantsByChat: {
              ...state.groupParticipantsByChat,
              [chatId]: participants,
            },
            ...(!cleanQuery && {
              initialGroupParticipantsByChat: {
                ...state.initialGroupParticipantsByChat,
                [chatId]: participants,
              },
            }),
          }));
          return participants;
        }
      } catch (err) {
        console.error('[Store] Failed to fetch group participants:', err);
      }
    }

    return [];
  },

  updateMessageMedia: (chatId, msgId, mediaDataUrl) =>
    set((state) => {
      const existing = state.messagesByChat[chatId] || [];
      const updated = existing.map((m) => {
        if (m.id !== msgId) return m;
        if (m.type === 'audio' && m.audioData) {
          return {
            ...m,
            isHdLoaded: true,
            audioData: {
              ...m.audioData,
              audioUrl: mediaDataUrl,
            },
          };
        }
        if (m.type === 'video' || mediaDataUrl.startsWith('data:video/')) {
          return {
            ...m,
            videoUrl: mediaDataUrl,
            isHdLoaded: true,
          };
        }
        return {
          ...m,
          imageUrl: mediaDataUrl,
          isHdLoaded: true,
        };
      });
      const updatedViewingImage =
        state.viewingImage?.messageId === msgId
          ? mediaDataUrl.startsWith('data:video/')
            ? {
                ...state.viewingImage,
                mediaType: 'video' as const,
                videoUrl: mediaDataUrl,
              }
            : { ...state.viewingImage, imageUrl: mediaDataUrl }
          : state.viewingImage;
      return {
        messagesByChat: {
          ...state.messagesByChat,
          [chatId]: updated,
        },
        viewingImage: updatedViewingImage,
      };
    }),

  setReplyingTo: (replyingTo) => set({ replyingTo }),

  setViewingImage: (viewingImage) => set({ viewingImage }),

  setBubbleScale: (scale) => {
    const clamped = Math.min(1.45, Math.max(0.65, Number(scale.toFixed(2))));
    const s = get();
    saveUserSettings({
      bubbleScale: clamped,
      maxBubbles: s.maxBubbles,
      soundMuted: s.soundMuted,
      userSoundPreset: s.userSoundPreset,
      groupSoundPreset: s.groupSoundPreset,
      customUserSoundName: s.customUserSoundName,
      customGroupSoundName: s.customGroupSoundName,
    });
    set({ bubbleScale: clamped });
    window.electronAPI?.broadcastSettingsUpdate?.({ bubbleScale: clamped });
  },

  setMaxBubbles: (max) => {
    const clamped = Math.min(15, Math.max(1, Math.round(max)));
    const s = get();
    saveUserSettings({
      bubbleScale: s.bubbleScale,
      maxBubbles: clamped,
      soundMuted: s.soundMuted,
      userSoundPreset: s.userSoundPreset,
      groupSoundPreset: s.groupSoundPreset,
      customUserSoundName: s.customUserSoundName,
      customGroupSoundName: s.customGroupSoundName,
    });
    const trimmedBubbles = organizeBubbles(s.activeBubbles, clamped, s.pinnedChatIds);
    const activeStillExists =
      !s.activeChatId || trimmedBubbles.some((b) => b.chatId === s.activeChatId);
    set({
      maxBubbles: clamped,
      activeBubbles: trimmedBubbles,
      activeChatId: activeStillExists ? s.activeChatId : null,
      activePopover:
        !activeStillExists && s.activePopover === 'chat-window'
          ? 'none'
          : s.activePopover,
    });
    window.electronAPI?.broadcastSettingsUpdate?.({ maxBubbles: clamped });
  },

  setSoundMuted: (soundMuted) => {
    const s = get();
    saveUserSettings({
      bubbleScale: s.bubbleScale,
      maxBubbles: s.maxBubbles,
      soundMuted,
      userSoundPreset: s.userSoundPreset,
      groupSoundPreset: s.groupSoundPreset,
      customUserSoundName: s.customUserSoundName,
      customGroupSoundName: s.customGroupSoundName,
    });
    set({ soundMuted });
    window.electronAPI?.broadcastSettingsUpdate?.({ soundMuted });
  },

  setUserSoundPreset: (userSoundPreset, customFileName) => {
    const s = get();
    const updatedCustomName =
      customFileName !== undefined ? customFileName : s.customUserSoundName;
    saveUserSettings({
      bubbleScale: s.bubbleScale,
      maxBubbles: s.maxBubbles,
      soundMuted: s.soundMuted,
      userSoundPreset,
      groupSoundPreset: s.groupSoundPreset,
      customUserSoundName: updatedCustomName,
      customGroupSoundName: s.customGroupSoundName,
    });
    set({ userSoundPreset, customUserSoundName: updatedCustomName });
    window.electronAPI?.broadcastSettingsUpdate?.({
      userSoundPreset,
      customUserSoundName: updatedCustomName,
    });
  },

  setGroupSoundPreset: (groupSoundPreset, customFileName) => {
    const s = get();
    const updatedCustomName =
      customFileName !== undefined ? customFileName : s.customGroupSoundName;
    saveUserSettings({
      bubbleScale: s.bubbleScale,
      maxBubbles: s.maxBubbles,
      soundMuted: s.soundMuted,
      userSoundPreset: s.userSoundPreset,
      groupSoundPreset,
      customUserSoundName: s.customUserSoundName,
      customGroupSoundName: updatedCustomName,
    });
    set({ groupSoundPreset, customGroupSoundName: updatedCustomName });
    window.electronAPI?.broadcastSettingsUpdate?.({
      groupSoundPreset,
      customGroupSoundName: updatedCustomName,
    });
  },

  applyExternalSettingsUpdate: (patch) => {
    const s = get();
    const nextScale =
      typeof patch.bubbleScale === 'number' ? patch.bubbleScale : s.bubbleScale;
    const nextMaxBubbles =
      typeof patch.maxBubbles === 'number' ? patch.maxBubbles : s.maxBubbles;
    const nextSoundMuted =
      typeof patch.soundMuted === 'boolean' ? patch.soundMuted : s.soundMuted;
    const nextUserPreset =
      (patch.userSoundPreset as SoundPreset) || s.userSoundPreset;
    const nextGroupPreset =
      (patch.groupSoundPreset as SoundPreset) || s.groupSoundPreset;
    const nextCustomUser =
      typeof patch.customUserSoundName === 'string'
        ? patch.customUserSoundName
        : s.customUserSoundName;
    const nextCustomGroup =
      typeof patch.customGroupSoundName === 'string'
        ? patch.customGroupSoundName
        : s.customGroupSoundName;

    const trimmedBubbles = organizeBubbles(s.activeBubbles, nextMaxBubbles, s.pinnedChatIds);
    const activeStillExists =
      !s.activeChatId || trimmedBubbles.some((b) => b.chatId === s.activeChatId);

    set({
      bubbleScale: nextScale,
      maxBubbles: nextMaxBubbles,
      soundMuted: nextSoundMuted,
      userSoundPreset: nextUserPreset,
      groupSoundPreset: nextGroupPreset,
      customUserSoundName: nextCustomUser,
      customGroupSoundName: nextCustomGroup,
      activeBubbles: trimmedBubbles,
      activeChatId: activeStillExists ? s.activeChatId : null,
      activePopover:
        !activeStillExists && s.activePopover === 'chat-window'
          ? 'none'
          : s.activePopover,
    });
  },

  openSettings: () => {
    if (window.electronAPI?.openSettingsWindow) {
      window.electronAPI.openSettingsWindow();
      return;
    }
    const { activePopover, activeBubbles, maxBubbles, pinnedChatIds } = get();
    const nextBubbles =
      activePopover === 'chat-window'
        ? organizeBubbles(activeBubbles, maxBubbles, pinnedChatIds)
        : activeBubbles;

    set({
      activeBubbles: nextBubbles,
      activePopover: 'settings',
      activeChatId: null,
      replyingTo: null,
      viewingImage: null,
    });
  },

  logoutWhatsApp: async () => {
    set({
      waStatus: 'initializing',
      qrDataUrl: null,
      hasSyncedRealChats: false,
      chats: [],
      activeBubbles: [],
      messagesByChat: {},
      unreadBannerByChat: {},
      activeChatId: null,
      replyingTo: null,
      viewingImage: null,
      activePopover: 'qr-code',
    });
    if (window.electronAPI?.logoutWhatsApp) {
      await window.electronAPI.logoutWhatsApp();
    }
  },

  refreshApp: async () => {
    // 1. Invoca refresh no backend (limpa caches e puxa conversas mais recentes do WhatsApp)
    if (window.electronAPI?.refreshWhatsApp) {
      try {
        const freshChats = await window.electronAPI.refreshWhatsApp();
        if (freshChats && freshChats.length > 0) {
          get().applyRealWhatsAppChats(freshChats);
        }
      } catch (_) {}
    } else if (window.electronAPI?.getChats) {
      try {
        const freshChats = await window.electronAPI.getChats();
        if (freshChats && freshChats.length > 0) {
          get().applyRealWhatsAppChats(freshChats);
        }
      } catch (_) {}
    }

    // 2. Atualiza mensagens da conversa ativa (se houver)
    const activeId = get().activeChatId;
    if (activeId && window.electronAPI?.getMessages) {
      try {
        const msgs = await window.electronAPI.getMessages(activeId, 100);
        if (msgs) {
          get().setMessagesForChat(activeId, msgs);
        }
      } catch (_) {}
    }

    // 3. Atualiza mensagens de todas as bolhas abertas
    const bubbles = get().activeBubbles;
    for (const b of bubbles) {
      if (b.chatId !== activeId && window.electronAPI?.getMessages) {
        window.electronAPI
          .getMessages(b.chatId, 50)
          .then((msgs) => {
            if (msgs) get().setMessagesForChat(b.chatId, msgs);
          })
          .catch(() => {});
      }
    }

    // 4. Se a sessão estiver desconectada ou em erro, tenta reconectar
    const status = get().waStatus;
    if (status === 'disconnected' || status === 'error') {
      window.electronAPI?.initWhatsApp?.();
    }
  },

  // 5.2 Fluxo do Botão Principal (Ícone Verde do WhatsApp)
  toggleMainButton: () => {
    const { activePopover, waStatus, qrDataUrl } = get();

    // Caso não tenha conexão (precisa escanear QR Code ou deu erro/desconectou), abre o QR Code
    const needsQrOrReconnect =
      waStatus === 'qr' ||
      waStatus === 'disconnected' ||
      waStatus === 'error' ||
      Boolean(qrDataUrl && waStatus !== 'ready' && waStatus !== 'authenticated');

    if (needsQrOrReconnect) {
      if (activePopover === 'qr-code') {
        set({ activePopover: 'none', activeChatId: null, viewingImage: null });
      } else {
        set({
          activePopover: 'qr-code',
          activeChatId: null,
          replyingTo: null,
          viewingImage: null,
        });
        if (
          window.electronAPI &&
          (waStatus === 'disconnected' || waStatus === 'error')
        ) {
          window.electronAPI.initWhatsApp();
        }
      }
      return;
    }

    // Conectado ou sincronizando sessão já existente: abre/fecha a lista de conversas
    // (se ainda estiver carregando as conversas, o ChatListPopover exibe a animação de carregamento)
    if (activePopover === 'chat-list') {
      set({ activePopover: 'none', activeChatId: null, viewingImage: null });
    } else {
      const { activeBubbles, maxBubbles, pinnedChatIds } = get();
      const nextBubbles =
        activePopover === 'chat-window'
          ? organizeBubbles(activeBubbles, maxBubbles, pinnedChatIds)
          : activeBubbles;

      set({
        activeBubbles: nextBubbles,
        activePopover: 'chat-list',
        activeChatId: null,
        replyingTo: null,
        viewingImage: null,
      });
      if (waStatus === 'ready' && window.electronAPI) {
        window.electronAPI.getChats().then((realChats) => {
          if (realChats && realChats.length > 0) {
            get().applyRealWhatsAppChats(realChats);
          }
        });
      }
    }
  },

  // 5.3 Fluxo de Criação de Bolha pela Lista
  selectChatFromList: (chatId) => {
    const { chats, activeBubbles, messagesByChat, unreadBannerByChat } = get();
    const targetChat = chats.find((c) => c.id === chatId);
    if (!targetChat) return;

    const existingBubble = activeBubbles.find((b) => b.chatId === chatId);
    const unreadAtOpen = Math.max(
      existingBubble?.unreadCount || 0,
      targetChat.unreadCount || 0
    );
    const existingMsgs = messagesByChat[chatId] || [];

    const bannerInfo: UnreadBannerInfo | undefined =
      unreadAtOpen > 0
        ? {
            count: unreadAtOpen,
            firstUnreadMsgId: computeFirstUnreadMsgId(existingMsgs, unreadAtOpen),
            resolvedFromFullFetch: false,
          }
        : undefined;

    const { maxBubbles, pinnedChatIds } = get();
    const exists = Boolean(existingBubble);
    const isPinned = pinnedChatIds.includes(chatId);
    let updatedBubbles: BubbleItem[];

    const now = Date.now();
    if (!exists) {
      const newBubble: BubbleItem = {
        chatId: targetChat.id,
        name: targetChat.name,
        avatar: targetChat.avatar,
        unreadCount: 0,
        isPinned,
        isGroup: targetChat.isGroup,
        hasMention: false,
        lastActivity: now,
      };
      updatedBubbles = organizeBubbles(
        [...activeBubbles, newBubble],
        maxBubbles,
        pinnedChatIds
      );
    } else {
      updatedBubbles = activeBubbles.map((b) =>
        b.chatId === chatId ? { ...b, unreadCount: 0, hasMention: false } : b
      );
    }

    const updatedChats = chats.map((c) =>
      c.id === chatId ? { ...c, unreadCount: 0, hasMention: false } : c
    );

    set({
      activeBubbles: updatedBubbles,
      chats: updatedChats,
      activePopover: 'chat-window',
      activeChatId: chatId,
      replyingTo: null,
      viewingImage: null,
      unreadBannerByChat: {
        ...unreadBannerByChat,
        [chatId]: bannerInfo,
      },
    });

    if (targetChat?.isGroup) {
      get().fetchGroupParticipants(chatId);
    }

    if (window.electronAPI) {
      const desiredLimit = Math.min(500, Math.max(100, unreadAtOpen + 20));
      window.electronAPI.getMessages(chatId, desiredLimit).then((msgs) => {
        if (msgs) {
          get().setMessagesForChat(chatId, msgs);
        }
        window.electronAPI?.markAsRead(chatId);
      });
    }
  },

  fetchSavedContacts: async (query?: string) => {
    if (window.electronAPI?.getSavedContacts) {
      set({ isLoadingContacts: true });
      try {
        const contacts = await window.electronAPI.getSavedContacts(query);
        set({ savedContacts: contacts || [], isLoadingContacts: false });
      } catch (err) {
        console.error('Error fetching saved contacts:', err);
        set({ isLoadingContacts: false });
      }
    } else {
      set({ savedContacts: [], isLoadingContacts: false });
    }
  },

  startChatWithContact: (contact: SavedContact) => {
    const { chats, selectChatFromList } = get();
    const existing = chats.find((c) => c.id === contact.id);
    if (existing) {
      selectChatFromList(contact.id);
      return;
    }

    const newChat: ChatSummary = {
      id: contact.id,
      name: contact.name || contact.pushname || contact.phoneNumber || 'Contato',
      avatar: contact.avatar || '',
      unreadCount: 0,
      isGroup: false,
      lastMessage: {
        text: '',
        mediaType: 'text',
        timestamp: '',
      },
    };

    set((state) => ({
      chats: [newChat, ...state.chats],
    }));

    selectChatFromList(contact.id);
  },

  // 5.4 Fluxo de Interação com Bolha Existente
  toggleBubbleChat: (chatId) => {
    const {
      activePopover,
      activeChatId,
      activeBubbles,
      chats,
      messagesByChat,
      unreadBannerByChat,
      maxBubbles,
      pinnedChatIds,
    } = get();

    if (activePopover === 'chat-window' && activeChatId === chatId) {
      const updatedBubbles = organizeBubbles(
        activeBubbles,
        maxBubbles,
        pinnedChatIds
      );
      set({
        activeBubbles: updatedBubbles,
        activePopover: 'none',
        activeChatId: null,
        replyingTo: null,
        viewingImage: null,
      });
      return;
    }

    let baseBubbles = activeBubbles;
    if (activePopover === 'chat-window' && activeChatId && activeChatId !== chatId) {
      baseBubbles = organizeBubbles(
        activeBubbles,
        maxBubbles,
        pinnedChatIds
      );
    }

    const existingBubble = baseBubbles.find((b) => b.chatId === chatId);
    const targetChat = chats.find((c) => c.id === chatId);
    const unreadAtOpen = Math.max(
      existingBubble?.unreadCount || 0,
      targetChat?.unreadCount || 0
    );
    const existingMsgs = messagesByChat[chatId] || [];

    const bannerInfo: UnreadBannerInfo | undefined =
      unreadAtOpen > 0
        ? {
            count: unreadAtOpen,
            firstUnreadMsgId: computeFirstUnreadMsgId(existingMsgs, unreadAtOpen),
            resolvedFromFullFetch: false,
          }
        : undefined;

    const updatedBubbles = baseBubbles.map((b) =>
      b.chatId === chatId ? { ...b, unreadCount: 0, hasMention: false } : b
    );
    const updatedChats = chats.map((c) =>
      c.id === chatId ? { ...c, unreadCount: 0, hasMention: false } : c
    );

    set({
      activeBubbles: updatedBubbles,
      chats: updatedChats,
      activePopover: 'chat-window',
      activeChatId: chatId,
      replyingTo: null,
      viewingImage: null,
      unreadBannerByChat: {
        ...unreadBannerByChat,
        [chatId]: bannerInfo,
      },
    });

    if (targetChat?.isGroup) {
      get().fetchGroupParticipants(chatId);
    }

    if (window.electronAPI) {
      const desiredLimit = Math.min(500, Math.max(100, unreadAtOpen + 20));
      window.electronAPI.getMessages(chatId, desiredLimit).then((msgs) => {
        if (msgs) {
          get().setMessagesForChat(chatId, msgs);
        }
        window.electronAPI?.markAsRead(chatId);
      });
    }
  },

  minimizeActiveChat: () => {
    const { activeBubbles, maxBubbles, pinnedChatIds } = get();
    const updatedBubbles = organizeBubbles(activeBubbles, maxBubbles, pinnedChatIds);

    set({
      activeBubbles: updatedBubbles,
      activePopover: 'none',
      activeChatId: null,
      replyingTo: null,
      viewingImage: null,
    });
  },

  // 5.4 Fechar a conversa definitivamente (remove a bolha da barra inferior)
  closeBubble: (chatId) => {
    const { activeBubbles, activeChatId, activePopover, maxBubbles, pinnedChatIds } = get();
    const bubble = activeBubbles.find((b) => b.chatId === chatId);
    if (bubble?.isPinned) {
      // Bloqueado: bolhas fixadas não podem ser fechadas até serem desfixadas
      return;
    }
    const updatedBubbles = activeBubbles.filter((b) => b.chatId !== chatId);
    const isClosingActiveChat =
      activePopover === 'chat-window' && activeChatId === chatId;

    // Se estava fechando o chat ativo, organiza as bolhas restantes; caso contrário, mantém posições
    const finalBubbles = isClosingActiveChat
      ? organizeBubbles(updatedBubbles, maxBubbles, pinnedChatIds)
      : updatedBubbles;

    set({
      activeBubbles: finalBubbles,
      activePopover: isClosingActiveChat ? 'none' : activePopover,
      activeChatId: isClosingActiveChat ? null : activeChatId,
      replyingTo: isClosingActiveChat ? null : get().replyingTo,
      viewingImage: isClosingActiveChat ? null : get().viewingImage,
    });
  },

  // Fixar ou Desfixar conversa
  togglePinBubble: (chatId: string) => {
    const { activeBubbles, pinnedChatIds, maxBubbles, activePopover, activeChatId } = get();
    const isCurrentlyPinned = pinnedChatIds.includes(chatId);
    const nextPinned = !isCurrentlyPinned;

    const nextPinnedSet = new Set(pinnedChatIds);
    if (nextPinned) {
      nextPinnedSet.add(chatId);
    } else {
      nextPinnedSet.delete(chatId);
    }
    const nextPinnedIds = Array.from(nextPinnedSet);
    savePinnedChatIds(nextPinnedIds);

    const updated = activeBubbles.map((b) =>
      b.chatId === chatId ? { ...b, isPinned: nextPinned } : b
    );
    const isAnyChatOpen = activePopover === 'chat-window' && Boolean(activeChatId);
    const reordered = isAnyChatOpen
      ? updated
      : organizeBubbles(updated, maxBubbles, nextPinnedIds);

    set({
      activeBubbles: reordered,
      pinnedChatIds: nextPinnedIds,
    });
  },

  // Ajustar tamanho da janela de conversa deste usuário
  setChatBubbleSize: (chatId: string, size: ChatBubbleSize) => {
    const { chatSizes } = get();
    const updated = {
      ...chatSizes,
      [chatId]: size,
    };
    saveChatSizes(updated);
    set({ chatSizes: updated });
  },

  // Envio de mensagem de texto
  sendMessage: async (text, mentions, textForWhatsApp, mentionedDisplayNames) => {
    const trimmed = text.trim();
    const { activeChatId, replyingTo, messagesByChat, chats, unreadBannerByChat } =
      get();
    if (!trimmed || !activeChatId) return;

    const timestamp = getCurrentTimeStr();
    const optimisticMsg: FormattedMessage = {
      id: `msg-${Date.now()}`,
      chatId: activeChatId,
      text: trimmed,
      timestamp,
      fromMe: true,
      type: 'text',
      ack: 'read',
      quotedMessage: replyingTo || undefined,
      mentions: mentionedDisplayNames && mentionedDisplayNames.length > 0 ? mentionedDisplayNames : undefined,
    };

    const currentMsgs = messagesByChat[activeChatId] || [];
    const updatedChats = chats.map((c) =>
      c.id === activeChatId
        ? {
            ...c,
            lastMessage: {
              text: trimmed,
              mediaType: 'text' as const,
              fromMe: true,
              ack: 'read' as const,
              timestamp,
            },
          }
        : c
    );

    const now = Date.now();
    const updatedActiveBubbles = get().activeBubbles.map((b) =>
      b.chatId === activeChatId ? { ...b, lastActivity: now } : b
    );

    set({
      messagesByChat: {
        ...messagesByChat,
        [activeChatId]: [...currentMsgs, optimisticMsg],
      },
      unreadBannerByChat: {
        ...unreadBannerByChat,
        [activeChatId]: undefined,
      },
      activeBubbles: updatedActiveBubbles,
      chats: updatedChats,
      replyingTo: null,
    });

    if (window.electronAPI) {
      await window.electronAPI.sendMessage({
        chatId: activeChatId,
        text: (textForWhatsApp && textForWhatsApp.trim()) || trimmed,
        quotedMessageId: replyingTo?.id,
        mentions: mentions && mentions.length > 0 ? mentions : undefined,
      });
      const freshMsgs = await window.electronAPI.getMessages(
        activeChatId,
        Math.max(100, currentMsgs.length + 5)
      );
      if (freshMsgs && freshMsgs.length > 0) {
        get().setMessagesForChat(activeChatId, freshMsgs);
      }
    }
  },

  // Envio de figurinha (sticker)
  sendSticker: async (stickerDataUrl) => {
    const { activeChatId, replyingTo, messagesByChat, chats, unreadBannerByChat } =
      get();
    if (!stickerDataUrl || !activeChatId) return;

    const timestamp = getCurrentTimeStr();
    const optimisticSticker: FormattedMessage = {
      id: `sticker-${Date.now()}`,
      chatId: activeChatId,
      text: '',
      timestamp,
      fromMe: true,
      type: 'sticker',
      imageUrl: stickerDataUrl,
      isHdLoaded: true,
      ack: 'read',
      quotedMessage: replyingTo || undefined,
    };

    const currentMsgs = messagesByChat[activeChatId] || [];
    const updatedChats = chats.map((c) =>
      c.id === activeChatId
        ? {
            ...c,
            lastMessage: {
              text: 'Figurinha',
              mediaType: 'sticker' as const,
              fromMe: true,
              ack: 'read' as const,
              timestamp,
            },
          }
        : c
    );

    const now = Date.now();
    const updatedActiveBubbles = get().activeBubbles.map((b) =>
      b.chatId === activeChatId ? { ...b, lastActivity: now } : b
    );

    set({
      messagesByChat: {
        ...messagesByChat,
        [activeChatId]: [...currentMsgs, optimisticSticker],
      },
      unreadBannerByChat: {
        ...unreadBannerByChat,
        [activeChatId]: undefined,
      },
      activeBubbles: updatedActiveBubbles,
      chats: updatedChats,
      replyingTo: null,
    });

    if (window.electronAPI?.sendSticker) {
      const sentMsg = await window.electronAPI.sendSticker({
        chatId: activeChatId,
        stickerDataUrl,
        quotedMessageId: replyingTo?.id,
      });
      const freshMsgs = await window.electronAPI.getMessages(
        activeChatId,
        Math.max(100, currentMsgs.length + 5)
      );
      if (freshMsgs && freshMsgs.length > 0) {
        const enriched = freshMsgs.map((m, idx) => {
          if (
            (sentMsg && m.id === sentMsg.id) ||
            (idx === freshMsgs.length - 1 && m.fromMe && m.type === 'sticker' && !m.imageUrl)
          ) {
            return { ...m, imageUrl: m.imageUrl || stickerDataUrl, isHdLoaded: true };
          }
          return m;
        });
        get().setMessagesForChat(activeChatId, enriched);
      }
    }
  },

  // Envio de mídia (foto / vídeo / anexo)
  sendMedia: async (payload) => {
    const { activeChatId, replyingTo, messagesByChat, chats, unreadBannerByChat } =
      get();
    if (!payload.mediaDataUrl || !activeChatId) return;

    const mediaType = payload.mediaType || 'image';
    const timestamp = getCurrentTimeStr();
    const optimisticMedia: FormattedMessage = {
      id: `media-${Date.now()}`,
      chatId: activeChatId,
      text: payload.caption || '',
      timestamp,
      fromMe: true,
      type: mediaType,
      imageUrl: mediaType === 'image' ? payload.mediaDataUrl : undefined,
      videoUrl: mediaType === 'video' ? payload.mediaDataUrl : undefined,
      isHdLoaded: true,
      ack: 'read',
      quotedMessage: replyingTo || undefined,
    };

    const currentMsgs = messagesByChat[activeChatId] || [];
    const updatedChats = chats.map((c) =>
      c.id === activeChatId
        ? {
            ...c,
            lastMessage: {
              text: payload.caption || (mediaType === 'image' ? 'Foto' : 'Vídeo'),
              mediaType: mediaType === 'image' ? ('photo' as const) : ('video' as const),
              fromMe: true,
              ack: 'read' as const,
              timestamp,
            },
          }
        : c
    );

    const now = Date.now();
    const updatedActiveBubbles = get().activeBubbles.map((b) =>
      b.chatId === activeChatId ? { ...b, lastActivity: now } : b
    );

    set({
      messagesByChat: {
        ...messagesByChat,
        [activeChatId]: [...currentMsgs, optimisticMedia],
      },
      unreadBannerByChat: {
        ...unreadBannerByChat,
        [activeChatId]: undefined,
      },
      activeBubbles: updatedActiveBubbles,
      chats: updatedChats,
      replyingTo: null,
    });

    if (window.electronAPI?.sendMedia) {
      try {
        const sentMsg = await window.electronAPI.sendMedia({
          chatId: activeChatId,
          mediaDataUrl: payload.mediaDataUrl,
          caption: payload.caption,
          filename: payload.filename,
          quotedMessageId: replyingTo?.id,
          mentions: payload.mentions,
        });

        if (!sentMsg) {
          console.error('[WhatsApp] Falha ao enviar mídia (serviço retornou null)');
          const latestMessages = get().messagesByChat[activeChatId] || [];
          set({
            messagesByChat: {
              ...get().messagesByChat,
              [activeChatId]: latestMessages.filter((m) => m.id !== optimisticMedia.id),
            },
          });
          return;
        }

        const freshMsgs = await window.electronAPI.getMessages(
          activeChatId,
          Math.max(100, currentMsgs.length + 5)
        );
        if (freshMsgs && freshMsgs.length > 0) {
          const enriched = freshMsgs.map((m, idx) => {
            if (
              (sentMsg && m.id === sentMsg.id) ||
              (idx === freshMsgs.length - 1 &&
                m.fromMe &&
                (m.type === 'image' || m.type === 'video') &&
                !m.imageUrl &&
                !m.videoUrl)
            ) {
              return {
                ...m,
                imageUrl:
                  mediaType === 'image' ? m.imageUrl || payload.mediaDataUrl : m.imageUrl,
                videoUrl:
                  mediaType === 'video' ? m.videoUrl || payload.mediaDataUrl : m.videoUrl,
                isHdLoaded: true,
              };
            }
            return m;
          });
          get().setMessagesForChat(activeChatId, enriched);
        }
      } catch (err) {
        console.error('[WhatsApp] Exceção ao enviar mídia:', err);
        const latestMessages = get().messagesByChat[activeChatId] || [];
        set({
          messagesByChat: {
            ...get().messagesByChat,
            [activeChatId]: latestMessages.filter((m) => m.id !== optimisticMedia.id),
          },
        });
      }
    }
  },

  // Envio de nota de voz (áudio gravado pelo microfone)
  sendVoiceNote: async ({
    audioDataUrl,
    durationSeconds,
    waveform,
  }: {
    audioDataUrl: string;
    durationSeconds: number;
    waveform?: number[];
  }) => {
    const { activeChatId, messagesByChat, chats } = get();
    if (!activeChatId) return;

    const mins = Math.floor(durationSeconds / 60);
    const secs = String(durationSeconds % 60).padStart(2, '0');
    const durationStr = `${mins}:${secs}`;
    const timestamp = getCurrentTimeStr();
    const tempId = `voice-${Date.now()}`;

    const voiceMsg: FormattedMessage = {
      id: tempId,
      chatId: activeChatId,
      text: '',
      timestamp,
      fromMe: true,
      type: 'audio',
      ack: 'sent',
      audioData: {
        duration: durationStr,
        durationSeconds,
        audioUrl: audioDataUrl,
        senderAvatar: '',
        waveform: waveform && waveform.length > 0 ? waveform : [],
      },
    };

    const currentMsgs = messagesByChat[activeChatId] || [];
    const updatedChats = chats.map((c) =>
      c.id === activeChatId
        ? {
            ...c,
            lastMessage: {
              text: durationStr,
              mediaType: 'audio' as const,
              fromMe: true,
              ack: 'sent' as const,
              duration: durationStr,
              timestamp,
            },
          }
        : c
    );

    const now = Date.now();
    const updatedActiveBubbles = get().activeBubbles.map((b) =>
      b.chatId === activeChatId ? { ...b, lastActivity: now } : b
    );

    set({
      messagesByChat: {
        ...messagesByChat,
        [activeChatId]: [...currentMsgs, voiceMsg],
      },
      activeBubbles: updatedActiveBubbles,
      chats: updatedChats,
    });

    if (window.electronAPI?.sendMedia) {
      try {
        const realMsg = await window.electronAPI.sendMedia({
          chatId: activeChatId,
          mediaDataUrl: audioDataUrl,
          filename: 'voice.ogg',
          sendAudioAsVoice: true,
        });
        if (realMsg) {
          set((state) => {
            const list = state.messagesByChat[activeChatId] || [];
            return {
              messagesByChat: {
                ...state.messagesByChat,
                [activeChatId]: list.map((m) =>
                  m.id === tempId
                    ? {
                        ...realMsg,
                        audioData: {
                          duration: durationStr,
                          durationSeconds,
                          senderAvatar: realMsg.audioData?.senderAvatar || '',
                          waveform: waveform || realMsg.audioData?.waveform || [],
                          audioUrl: realMsg.audioData?.audioUrl || audioDataUrl,
                        },
                      }
                    : m
                ),
              },
            };
          });
        }
      } catch (err) {
        console.error('[Store] Falha ao enviar áudio pelo WhatsApp:', err);
      }
    }
  },

  // 5.5 Fluxo de Recebimento de Nova Mensagem (Gatilho Automático)
  receiveIncomingMessage: ({ chat, message }) => {
    if (chat.isMuted) return;

    const {
      activeBubbles,
      activePopover,
      activeChatId,
      messagesByChat,
      chats,
      maxBubbles,
      pinnedChatIds,
      soundMuted,
      userSoundPreset,
      groupSoundPreset,
    } = get();

    // Uma conversa está aberta no momento se activePopover === 'chat-window' e há activeChatId
    const isAnyChatOpen = activePopover === 'chat-window' && Boolean(activeChatId);
    const isThisChatCurrentlyOpen = isAnyChatOpen && activeChatId === chat.id;

    const existingMsgs = messagesByChat[chat.id] || [];
    const alreadyExists = existingMsgs.some((m) => m.id === message.id);

    // Toca o efeito sonoro de notificação (respeitando 30s para usuário, 2min para grupo e sem interpolação)
    if (!message.fromMe && !alreadyExists) {
      triggerIncomingNotificationSound(chat.id, Boolean(chat.isGroup), {
        soundMuted,
        preset: chat.isGroup ? groupSoundPreset : userSoundPreset,
      });
    }

    const updatedMessages = alreadyExists
      ? existingMsgs
      : [...existingMsgs, message];

    const bubbleIndex = activeBubbles.findIndex((b) => b.chatId === chat.id);
    const bubbleExists = bubbleIndex >= 0;
    const isPinned = pinnedChatIds.includes(chat.id);
    const now = Date.now();
    const isGroup = Boolean(chat.isGroup);
    const isReplyToMe = Boolean(
      isGroup &&
      !message.fromMe &&
      message.quotedMessage &&
      (
        message.quotedMessage.fromMe ||
        message.quotedMessage.author === 'Você' ||
        message.quotedMessage.author === '@Você'
      )
    );
    const messageMentionsMe = Boolean(
      isGroup &&
      !message.fromMe &&
      (
        chat.hasMention ||
        isReplyToMe ||
        (Array.isArray(message.mentions) && message.mentions.some((m) => m === 'Você' || m === '@Você')) ||
        (typeof message.text === 'string' && (message.text.includes('@Você') || message.text.includes('@você')))
      )
    );
    let updatedBubbles: BubbleItem[];

    if (isAnyChatOpen) {
      // REGRA 1 & 2: Enquanto uma conversa estiver aberta, a movimentação de bolhas deve ficar fixa.
      // Se a bolha já está sendo exibida, exibe as notificações normalmente, mas NÃO se move para a mais recente.
      if (bubbleExists) {
        const currentBubble = activeBubbles[bubbleIndex];
        const refreshedBubble: BubbleItem = {
          ...currentBubble,
          name: chat.name,
          avatar: chat.avatar,
          unreadCount: isThisChatCurrentlyOpen ? 0 : currentBubble.unreadCount + 1,
          isPinned: currentBubble.isPinned ?? isPinned,
          isGroup,
          hasMention: isThisChatCurrentlyOpen
            ? false
            : (messageMentionsMe ? true : Boolean(currentBubble.hasMention || chat.hasMention)),
          lastActivity: now,
        };
        updatedBubbles = activeBubbles.map((b) =>
          b.chatId === chat.id ? refreshedBubble : b
        );
      } else {
        // REGRA 3: Se a bolha não estava sendo exibida (conversa nova), ela é gerada na ÚLTIMA ESQUERDA
        // (índice 0 do array) para não mover as bolhas existentes de lugar e não atrapalhar o usuário.
        const newBubble: BubbleItem = {
          chatId: chat.id,
          name: chat.name,
          avatar: chat.avatar,
          unreadCount: isThisChatCurrentlyOpen ? 0 : 1,
          isPinned,
          isGroup,
          hasMention: isThisChatCurrentlyOpen
            ? false
            : Boolean(messageMentionsMe || chat.hasMention),
          lastActivity: now,
        };
        updatedBubbles = [newBubble, ...activeBubbles];
      }
    } else {
      // REGRA 5: Quando o usuário NÃO está com nenhum chat ativo, as bolhas se ordenam
      // na ordem correta sempre, aparecendo da mais recente para a direita.
      if (bubbleExists) {
        const currentBubble = activeBubbles[bubbleIndex];
        const refreshedBubble: BubbleItem = {
          ...currentBubble,
          name: chat.name,
          avatar: chat.avatar,
          unreadCount: currentBubble.unreadCount + 1,
          isPinned: currentBubble.isPinned ?? isPinned,
          isGroup,
          hasMention: messageMentionsMe
            ? true
            : Boolean(currentBubble.hasMention || chat.hasMention),
          lastActivity: now,
        };
        const withoutCurrent = activeBubbles.filter((b) => b.chatId !== chat.id);
        updatedBubbles = organizeBubbles(
          [...withoutCurrent, refreshedBubble],
          maxBubbles,
          pinnedChatIds
        );
      } else {
        const newBubble: BubbleItem = {
          chatId: chat.id,
          name: chat.name,
          avatar: chat.avatar,
          unreadCount: 1,
          isPinned,
          isGroup,
          hasMention: Boolean(messageMentionsMe || chat.hasMention),
          lastActivity: now,
        };
        updatedBubbles = organizeBubbles(
          [...activeBubbles, newBubble],
          maxBubbles,
          pinnedChatIds
        );
      }
    }

    const activeStillInBubbles =
      !activeChatId || updatedBubbles.some((b) => b.chatId === activeChatId);

    const chatExistsInList = chats.some((c) => c.id === chat.id);
    const updatedChats = chatExistsInList
      ? chats.map((c) =>
          c.id === chat.id
            ? {
                ...c,
                lastMessage: chat.lastMessage,
                unreadCount: isThisChatCurrentlyOpen ? 0 : (c.unreadCount || 0) + 1,
                hasMention: isThisChatCurrentlyOpen
                  ? false
                  : (messageMentionsMe ? true : Boolean(c.hasMention || chat.hasMention)),
              }
            : c
        )
      : [
          {
            ...chat,
            unreadCount: isThisChatCurrentlyOpen ? 0 : (chat.unreadCount || 1),
            hasMention: isThisChatCurrentlyOpen
              ? false
              : (messageMentionsMe ? true : Boolean(chat.hasMention)),
          },
          ...chats,
        ];

    if (isThisChatCurrentlyOpen && !message.fromMe) {
      window.electronAPI?.markAsRead(chat.id);
    }

    set({
      activeBubbles: updatedBubbles,
      activeChatId: activeStillInBubbles ? activeChatId : null,
      activePopover:
        !activeStillInBubbles && activePopover === 'chat-window'
          ? 'none'
          : activePopover,
      chats: updatedChats,
      messagesByChat: {
        ...messagesByChat,
        [chat.id]: updatedMessages,
      },
    });
  },
}));
