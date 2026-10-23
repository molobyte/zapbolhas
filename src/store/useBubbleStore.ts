import { create } from 'zustand';
import { useAudioPlaybackStore } from './useAudioPlaybackStore';
import {
  ActivePopover,
  BubbleItem,
  ChatBubbleSize,
  ChatSummary,
  ConnectionMode,
  FormattedMessage,
  GroupParticipant,
  GroupMetadataInfo,
  IncomingMessagePayload,
  MessageReactionItem,
  MessageMediaType,
  QuotedMessage,
  SavedContact,
  BubbleBorderMode,
  SoundPreset,
  StartupChatFilter,
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
  bubbleBorderMode: BubbleBorderMode;
  bubbleBorderColor: string;
  bubbleBorderOpacity: number;
  bubbleBorderWidth: number;
  startupChatFilter: StartupChatFilter;
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
        bubbleBorderMode:
          parsed.bubbleBorderMode === 'minimal' ||
          parsed.bubbleBorderMode === 'advanced' ||
          parsed.bubbleBorderMode === 'custom' ||
          parsed.bubbleBorderMode === 'default'
            ? parsed.bubbleBorderMode
            : 'default',
        bubbleBorderColor:
          typeof parsed.bubbleBorderColor === 'string' && parsed.bubbleBorderColor.startsWith('#')
            ? parsed.bubbleBorderColor
            : '#FFFFFF',
        bubbleBorderOpacity:
          typeof parsed.bubbleBorderOpacity === 'number'
            ? Math.min(100, Math.max(0, parsed.bubbleBorderOpacity))
            : 15,
        bubbleBorderWidth:
          typeof parsed.bubbleBorderWidth === 'number'
            ? Math.min(6, Math.max(0.5, parsed.bubbleBorderWidth))
            : 1.5,
        startupChatFilter:
          parsed.startupChatFilter === 'pinned_only'
            ? 'pinned_only'
            : 'pinned_and_unread_48h',
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
    bubbleBorderMode: 'default',
    bubbleBorderColor: '#FFFFFF',
    bubbleBorderOpacity: 80,
    bubbleBorderWidth: 1.5,
    startupChatFilter: 'pinned_and_unread_48h',
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
const PINNED_METADATA_STORAGE_KEY = 'whatsapp-bubbles-pinned-metadata-v1';
const UNPINNED_STORAGE_KEY = 'whatsapp-bubbles-unpinned-chats-v1';
const CHAT_SIZES_STORAGE_KEY = 'whatsapp-bubbles-chat-sizes-v1';

export interface PinnedChatMeta {
  chatId: string;
  name: string;
  avatar: string;
  isGroup?: boolean;
  lastActivity?: number;
}

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

function loadPinnedChatMeta(): Record<string, PinnedChatMeta> {
  try {
    const raw = localStorage.getItem(PINNED_METADATA_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // Ignore localStorage error
  }
  return {};
}

function savePinnedChatMeta(meta: Record<string, PinnedChatMeta>): void {
  try {
    localStorage.setItem(PINNED_METADATA_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // Ignore localStorage error
  }
}

function loadUnpinnedChatIds(): string[] {
  try {
    const raw = localStorage.getItem(UNPINNED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.filter((id) => typeof id === 'string');
    }
  } catch {
    // Ignore localStorage error
  }
  return [];
}

function saveUnpinnedChatIds(ids: string[]): void {
  try {
    localStorage.setItem(UNPINNED_STORAGE_KEY, JSON.stringify(ids));
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

const newlyActiveChatIdsThisSession = new Set<string>();
const dismissedChatIdsThisSession = new Set<string>();

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
  bubbleBorderMode: BubbleBorderMode;
  bubbleBorderColor: string;
  bubbleBorderOpacity: number;
  bubbleBorderWidth: number;
  startupChatFilter: StartupChatFilter;

  chats: ChatSummary[];
  activeBubbles: BubbleItem[];
  pinnedChatIds: string[];
  chatSizes: Record<string, ChatBubbleSize>;
  activePopover: ActivePopover;
  activeChatId: string | null;
  messagesByChat: Record<string, FormattedMessage[]>;
  groupParticipantsByChat: Record<string, GroupParticipant[]>;
  initialGroupParticipantsByChat: Record<string, GroupParticipant[]>;
  groupMetadataByChat: Record<string, GroupMetadataInfo>;
  unreadBannerByChat: Record<string, UnreadBannerInfo | undefined>;
  replyingTo: QuotedMessage | null;
  viewingImage: ViewingImageState | null;
  savedContacts: SavedContact[];
  isLoadingContacts: boolean;
  activeReactionDetailsMessage: FormattedMessage | null;

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
  fetchGroupMetadata: (chatId: string) => Promise<GroupMetadataInfo | null>;
  updateMessageMedia: (chatId: string, msgId: string, mediaDataUrl: string) => void;
  setReplyingTo: (quote: QuotedMessage | null) => void;
  setViewingImage: (img: ViewingImageState | null) => void;
  setActiveReactionDetailsMessage: (msg: FormattedMessage | null) => void;

  // Settings Actions
  setBubbleScale: (scale: number) => void;
  setMaxBubbles: (max: number) => void;
  setSoundMuted: (muted: boolean) => void;
  setUserSoundPreset: (preset: SoundPreset, customFileName?: string) => void;
  setGroupSoundPreset: (preset: SoundPreset, customFileName?: string) => void;
  setBubbleBorderMode: (mode: BubbleBorderMode) => void;
  setBubbleBorderColor: (color: string) => void;
  setBubbleBorderOpacity: (opacity: number) => void;
  setBubbleBorderWidth: (width: number) => void;
  setStartupChatFilter: (filter: StartupChatFilter) => void;
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
  markChatAsUnread: (chatId: string) => Promise<void>;
  markChatAsRead: (chatId: string) => Promise<void>;
  toggleMuteChat: (chatId: string) => Promise<void>;
  deleteMessagesLocally: (chatId: string, messageIds: string[]) => void;
  forwardMessages: (targetChatId: string, messagesToForward: FormattedMessage[]) => Promise<void>;
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
  sendReaction: (chatId: string, messageId: string, emoji: string) => Promise<void>;
  applyReactionUpdate: (payload: {
    messageId: string;
    chatId?: string;
    reaction: string;
    senderId?: string;
    senderName?: string;
    senderAvatar?: string;
    fromMe?: boolean;
    reactions?: MessageReactionItem[];
    timestamp?: number;
  }) => void;
  receiveIncomingMessage: (payload: IncomingMessagePayload) => void;
}

function getCurrentTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function isMatchingMessageId(msgId: string, targetId: string): boolean {
  if (!msgId || !targetId) return false;
  if (msgId === targetId) return true;
  if (msgId.endsWith(`_${targetId}`) || targetId.endsWith(`_${msgId}`)) return true;
  const partA = msgId.includes('_') ? msgId.split('_')[2] : msgId;
  const partB = targetId.includes('_') ? targetId.split('_')[2] : targetId;
  return Boolean(partA && partB && partA === partB);
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
  bubbleBorderMode: initialSettings.bubbleBorderMode,
  bubbleBorderColor: initialSettings.bubbleBorderColor,
  bubbleBorderOpacity: initialSettings.bubbleBorderOpacity,
  bubbleBorderWidth: initialSettings.bubbleBorderWidth,
  startupChatFilter: initialSettings.startupChatFilter,

  chats: [],
  activeBubbles: [],
  pinnedChatIds: initialPinnedChatIds,
  chatSizes: initialChatSizes,
  activePopover: 'none',
  activeChatId: null,
  messagesByChat: {},
  groupParticipantsByChat: {},
  initialGroupParticipantsByChat: {},
  groupMetadataByChat: {},
  unreadBannerByChat: {},
  replyingTo: null,
  viewingImage: null,
  activeReactionDetailsMessage: null,
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
      const { maxBubbles, pinnedChatIds: currentPinnedIds, activeBubbles: currentActive } = get();
      const metaMap = loadPinnedChatMeta();
      const unpinnedSet = new Set(loadUnpinnedChatIds());
      const chatMap = new Map(realChats.map((c) => [c.id, c]));

      // 1. Detecta conversas fixadas no WhatsApp (c.isPinned) que o usuário ainda não desfixou
      const combinedPinnedSet = new Set(currentPinnedIds);
      for (const c of realChats) {
        if (c.isPinned && !unpinnedSet.has(c.id)) {
          combinedPinnedSet.add(c.id);
        }
      }
      const updatedPinnedIds = Array.from(combinedPinnedSet);
      savePinnedChatIds(updatedPinnedIds);

      // 2. Constrói bolhas para todas as conversas fixadas
      const pinnedBubbles: BubbleItem[] = [];
      const now = Date.now();
      updatedPinnedIds.forEach((pid, idx) => {
        const realChat = chatMap.get(pid);
        const existingBubble = currentActive.find((b) => b.chatId === pid);
        const meta = metaMap[pid];

        const name = realChat?.name || existingBubble?.name || meta?.name || pid.split('@')[0];
        const avatar = realChat?.avatar || existingBubble?.avatar || meta?.avatar || '';
        const isGroup = realChat?.isGroup ?? existingBubble?.isGroup ?? meta?.isGroup ?? pid.endsWith('@g.us');
        const lastActivity =
          existingBubble?.lastActivity || meta?.lastActivity || now - (updatedPinnedIds.length - idx) * 1000;
        const unreadCount = realChat ? realChat.unreadCount : (existingBubble?.unreadCount || 0);
        const isMarkedUnread = realChat
          ? Boolean(realChat.isMarkedUnread || realChat.unreadCount === -1)
          : Boolean(existingBubble?.isMarkedUnread);
        const hasMention = realChat ? Boolean(realChat.hasMention) : Boolean(existingBubble?.hasMention);

        // Atualiza metadata em disco
        metaMap[pid] = {
          chatId: pid,
          name,
          avatar,
          isGroup,
          lastActivity,
        };

        pinnedBubbles.push({
          chatId: pid,
          name,
          avatar,
          unreadCount,
          isMarkedUnread,
          isPinned: true,
          isGroup,
          hasMention,
          lastActivity,
        });
      });
      savePinnedChatMeta(metaMap);

      // 3. Garante que se alguma conversa fixada não estiver na lista de realChats, adicionamos um resumo sintético dela
      const existingChatIds = new Set(realChats.map((c) => c.id));
      const syntheticMissingChats: ChatSummary[] = [];
      for (const pid of updatedPinnedIds) {
        if (!existingChatIds.has(pid)) {
          const meta = metaMap[pid];
          syntheticMissingChats.push({
            id: pid,
            name: meta?.name || pid.split('@')[0],
            avatar: meta?.avatar || '',
            unreadCount: 0,
            isMarkedUnread: false,
            isGroup: Boolean(meta?.isGroup ?? pid.endsWith('@g.us')),
            isPinned: true,
            lastMessage: {
              text: '',
              mediaType: 'text',
              timestamp: '',
            },
          });
        }
      }
      const fullChatsList = [...realChats, ...syntheticMissingChats];

      // 4. Cria bolhas para as conversas reais não silenciadas com mensagens não lidas que NÃO estejam fixadas
      // REGRA: Ao abrir o aplicativo, verificar a opção do usuário (startupChatFilter):
      // - 'pinned_only': abre apenas as conversas fixadas
      // - 'pinned_and_unread_48h' (padrão): abre as fixadas e as conversas não lidas cuja última interação
      //   (minha ou do outro colaborador) ocorreu nas últimas 48 horas.
      const { startupChatFilter } = get();
      let unreadBubbles: BubbleItem[] = [];

      if (startupChatFilter !== 'pinned_only') {
        const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
        const unreadUnpinnedChats = realChats.filter((c) => {
          if (updatedPinnedIds.includes(c.id)) return false;
          if (c.isMuted) return false;
          const isUnread = Boolean(c.unreadCount > 0 || c.isMarkedUnread || c.unreadCount === -1);
          if (!isUnread) return false;

          const chatTs = c.timestamp || c.lastMessage?.timestampMs;
          if (!chatTs || typeof chatTs !== 'number' || chatTs <= 0) {
            return false;
          }
          const diff = now - chatTs;
          // Última interação (minha ou do outro colaborador) dentro das últimas 48 horas
          return diff >= -600000 && diff <= FORTY_EIGHT_HOURS_MS;
        });

        unreadBubbles = unreadUnpinnedChats
          .slice(0, Math.max(0, maxBubbles - pinnedBubbles.length))
          .reverse()
          .map((c, idx) => ({
            chatId: c.id,
            name: c.name,
            avatar: c.avatar,
            unreadCount: c.unreadCount,
            isMarkedUnread: Boolean(c.isMarkedUnread || c.unreadCount === -1),
            isPinned: false,
            isGroup: c.isGroup,
            hasMention: Boolean(c.hasMention),
            lastActivity: now - (unreadUnpinnedChats.length - idx) * 1000,
          }));
      }

      const combinedInitial = [...unreadBubbles, ...pinnedBubbles];
      const organizedInitial = organizeBubbles(combinedInitial, maxBubbles, updatedPinnedIds);

      set({
        mode: 'whatsapp',
        waStatus: 'ready',
        hasSyncedRealChats: true,
        chats: fullChatsList,
        activeBubbles: organizedInitial,
        pinnedChatIds: updatedPinnedIds,
        messagesByChat: {},
        activePopover: activePopover === 'qr-code' ? 'chat-list' : activePopover,
        activeChatId: null,
      });
      return;
    }

    const { maxBubbles, pinnedChatIds: currentPinnedIds, startupChatFilter } = get();
    const isAnyChatOpen = activePopover === 'chat-window' && Boolean(activeChatId);

    // Sincronizações subsequentes em segundo plano: atualiza lista e mantém bolhas sincronizadas
    const chatMap = new Map(realChats.map((c) => [c.id, c]));
    const metaMap = loadPinnedChatMeta();
    let metaChanged = false;

    let updatedBubbles = activeBubbles.map((b) => {
      const fresh = chatMap.get(b.chatId);
      if (!fresh) return b;
      const isCurrentlyOpen = isAnyChatOpen && activeChatId === b.chatId;
      const isMarkedUnread = isCurrentlyOpen
        ? false
        : Boolean(fresh.isMarkedUnread || fresh.unreadCount === -1 || (b.isMarkedUnread && fresh.unreadCount === 0));
      const unreadCount = isCurrentlyOpen ? 0 : fresh.unreadCount;
      const hasMention = isCurrentlyOpen || unreadCount === 0
        ? false
        : Boolean(fresh.hasMention);

      // Mantém metadata atualizado para conversas fixadas
      if (b.isPinned || currentPinnedIds.includes(b.chatId)) {
        if (
          metaMap[b.chatId] &&
          (metaMap[b.chatId].name !== fresh.name || metaMap[b.chatId].avatar !== fresh.avatar)
        ) {
          metaMap[b.chatId].name = fresh.name;
          metaMap[b.chatId].avatar = fresh.avatar;
          metaChanged = true;
        }
      }

      return {
        ...b,
        name: fresh.name,
        avatar: fresh.avatar,
        unreadCount,
        isMarkedUnread,
        isPinned: b.isPinned ?? currentPinnedIds.includes(b.chatId),
        isGroup: fresh.isGroup ?? b.isGroup,
        hasMention,
      };
    });

    if (metaChanged) {
      savePinnedChatMeta(metaMap);
    }

    // Garante que todas as conversas fixadas permaneçam em updatedBubbles
    for (const pid of currentPinnedIds) {
      if (!updatedBubbles.some((b) => b.chatId === pid)) {
        const fresh = chatMap.get(pid);
        const meta = metaMap[pid];
        const newPinnedB: BubbleItem = {
          chatId: pid,
          name: fresh?.name || meta?.name || pid.split('@')[0],
          avatar: fresh?.avatar || meta?.avatar || '',
          unreadCount: fresh?.unreadCount || 0,
          isMarkedUnread: Boolean(fresh?.isMarkedUnread),
          isPinned: true,
          isGroup: fresh?.isGroup ?? meta?.isGroup ?? pid.endsWith('@g.us'),
          hasMention: Boolean(fresh?.hasMention),
          lastActivity: meta?.lastActivity || Date.now(),
        };
        updatedBubbles.push(newPinnedB);
      }
    }

    if (startupChatFilter === 'pinned_only') {
      updatedBubbles = updatedBubbles.filter(
        (b) =>
          b.isPinned ||
          currentPinnedIds.includes(b.chatId) ||
          newlyActiveChatIdsThisSession.has(b.chatId) ||
          (isAnyChatOpen && activeChatId === b.chatId)
      );
    } else {
      // Se surgiu alguma conversa não silenciada com unreadCount > 0 ou marcada como não lida que ainda não tem bolha, cria a bolha
      // (respeitando que a interação tenha ocorrido nas últimas 48 horas e que não tenha sido dispensada nesta sessão)
      const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
      const nowTs = Date.now();
      for (const c of realChats) {
        if (dismissedChatIdsThisSession.has(c.id)) continue;
        const isUnread = Boolean(c.unreadCount > 0 || c.isMarkedUnread || c.unreadCount === -1);
        const chatTs = c.timestamp || c.lastMessage?.timestampMs;
        const isWithin48h =
          typeof chatTs === 'number' &&
          chatTs > 0 &&
          nowTs - chatTs <= FORTY_EIGHT_HOURS_MS &&
          nowTs - chatTs >= -600000;

        if (
          isUnread &&
          !c.isMuted &&
          isWithin48h &&
          !updatedBubbles.some((b) => b.chatId === c.id)
        ) {
          const newB: BubbleItem = {
            chatId: c.id,
            name: c.name,
            avatar: c.avatar,
            unreadCount: c.unreadCount,
            isMarkedUnread: Boolean(c.isMarkedUnread || c.unreadCount === -1),
            isPinned: currentPinnedIds.includes(c.id),
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
    }
    const finalBubbles = isAnyChatOpen
      ? updatedBubbles
      : organizeBubbles(updatedBubbles, maxBubbles, currentPinnedIds);

    const existingChatIds = new Set(realChats.map((c) => c.id));
    const syntheticMissingChats: ChatSummary[] = [];
    for (const pid of currentPinnedIds) {
      if (!existingChatIds.has(pid)) {
        const meta = metaMap[pid];
        syntheticMissingChats.push({
          id: pid,
          name: meta?.name || pid.split('@')[0],
          avatar: meta?.avatar || '',
          unreadCount: 0,
          isMarkedUnread: false,
          isGroup: Boolean(meta?.isGroup ?? pid.endsWith('@g.us')),
          isPinned: true,
          lastMessage: {
            text: '',
            mediaType: 'text',
            timestamp: '',
          },
        });
      }
    }
    const fullChatsList = [...realChats, ...syntheticMissingChats];

    const normalizedChats = fullChatsList.map((c) => {
      const isCurrentlyOpen =
        activePopover === 'chat-window' && activeChatId === c.id;
      if (isCurrentlyOpen && (c.unreadCount > 0 || c.unreadCount === -1 || c.isMarkedUnread || c.hasMention)) {
        window.electronAPI?.markAsRead(c.id);
        return { ...c, unreadCount: 0, isMarkedUnread: false, hasMention: false };
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
      const prevMap = new Map(prevMsgs.map((m) => [m.id, m]));
      const merged = messages.map((m) => {
        const prev = prevMap.get(m.id);
        const resolvedReactions = m.reactions || prev?.reactions;
        const resolvedReaction = m.reaction || prev?.reaction;
        if (!prev) return { ...m, reactions: resolvedReactions, reaction: resolvedReaction };
        return {
          ...m,
          imageUrl: prev.isHdLoaded && !m.isHdLoaded ? prev.imageUrl || m.imageUrl : m.imageUrl,
          videoUrl: prev.isHdLoaded && !m.isHdLoaded ? prev.videoUrl || m.videoUrl : m.videoUrl,
          isHdLoaded: m.isHdLoaded || prev.isHdLoaded,
          audioData:
            m.audioData && prev.audioData?.audioUrl
              ? { ...m.audioData, audioUrl: prev.audioData.audioUrl }
              : m.audioData,
          reactions: resolvedReactions,
          reaction: resolvedReaction,
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

  fetchGroupParticipants: async (chatId, query, limit = 1000) => {
    const { initialGroupParticipantsByChat } = get();
    const cleanQuery = (query || '').trim();
    const safeLimit = Math.max(1, Math.min(Number(limit) || 1000, 1000));

    // Se a busca estiver vazia e já temos a lista com quantidade suficiente ou completa, restaura imediatamente
    const currentCached = initialGroupParticipantsByChat[chatId] || [];
    if (!cleanQuery && currentCached.length >= safeLimit && currentCached.length > 0) {
      set((state) => ({
        groupParticipantsByChat: {
          ...state.groupParticipantsByChat,
          [chatId]: currentCached,
        },
      }));
      return currentCached;
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
                [chatId]:
                  participants.length >= (state.initialGroupParticipantsByChat[chatId]?.length || 0)
                    ? participants
                    : state.initialGroupParticipantsByChat[chatId],
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

  fetchGroupMetadata: async (chatId) => {
    if (!chatId) return null;
    const { groupMetadataByChat } = get();
    if (groupMetadataByChat[chatId]) {
      return groupMetadataByChat[chatId];
    }
    if (window.electronAPI?.getGroupMetadata) {
      try {
        const meta = await window.electronAPI.getGroupMetadata(chatId);
        if (meta) {
          set((state) => ({
            groupMetadataByChat: {
              ...state.groupMetadataByChat,
              [chatId]: meta,
            },
          }));
          return meta;
        }
      } catch (err) {
        console.error('[Store] Failed to fetch group metadata:', err);
      }
    }
    return null;
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

  setActiveReactionDetailsMessage: (activeReactionDetailsMessage) =>
    set({ activeReactionDetailsMessage }),

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
      bubbleBorderMode: s.bubbleBorderMode,
      bubbleBorderColor: s.bubbleBorderColor,
      bubbleBorderOpacity: s.bubbleBorderOpacity,
      bubbleBorderWidth: s.bubbleBorderWidth,
      startupChatFilter: s.startupChatFilter,
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
      bubbleBorderMode: s.bubbleBorderMode,
      bubbleBorderColor: s.bubbleBorderColor,
      bubbleBorderOpacity: s.bubbleBorderOpacity,
      bubbleBorderWidth: s.bubbleBorderWidth,
      startupChatFilter: s.startupChatFilter,
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
      bubbleBorderMode: s.bubbleBorderMode,
      bubbleBorderColor: s.bubbleBorderColor,
      bubbleBorderOpacity: s.bubbleBorderOpacity,
      bubbleBorderWidth: s.bubbleBorderWidth,
      startupChatFilter: s.startupChatFilter,
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
      bubbleBorderMode: s.bubbleBorderMode,
      bubbleBorderColor: s.bubbleBorderColor,
      bubbleBorderOpacity: s.bubbleBorderOpacity,
      bubbleBorderWidth: s.bubbleBorderWidth,
      startupChatFilter: s.startupChatFilter,
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
      bubbleBorderMode: s.bubbleBorderMode,
      bubbleBorderColor: s.bubbleBorderColor,
      bubbleBorderOpacity: s.bubbleBorderOpacity,
      bubbleBorderWidth: s.bubbleBorderWidth,
      startupChatFilter: s.startupChatFilter,
    });
    set({ groupSoundPreset, customGroupSoundName: updatedCustomName });
    window.electronAPI?.broadcastSettingsUpdate?.({
      groupSoundPreset,
      customGroupSoundName: updatedCustomName,
    });
  },

  setBubbleBorderMode: (bubbleBorderMode: BubbleBorderMode) => {
    const s = get();
    saveUserSettings({
      bubbleScale: s.bubbleScale,
      maxBubbles: s.maxBubbles,
      soundMuted: s.soundMuted,
      userSoundPreset: s.userSoundPreset,
      groupSoundPreset: s.groupSoundPreset,
      customUserSoundName: s.customUserSoundName,
      customGroupSoundName: s.customGroupSoundName,
      bubbleBorderMode,
      bubbleBorderColor: s.bubbleBorderColor,
      bubbleBorderOpacity: s.bubbleBorderOpacity,
      bubbleBorderWidth: s.bubbleBorderWidth,
      startupChatFilter: s.startupChatFilter,
    });
    set({ bubbleBorderMode });
    window.electronAPI?.broadcastSettingsUpdate?.({ bubbleBorderMode });
  },

  setBubbleBorderColor: (bubbleBorderColor: string) => {
    const s = get();
    saveUserSettings({
      bubbleScale: s.bubbleScale,
      maxBubbles: s.maxBubbles,
      soundMuted: s.soundMuted,
      userSoundPreset: s.userSoundPreset,
      groupSoundPreset: s.groupSoundPreset,
      customUserSoundName: s.customUserSoundName,
      customGroupSoundName: s.customGroupSoundName,
      bubbleBorderMode: s.bubbleBorderMode,
      bubbleBorderColor,
      bubbleBorderOpacity: s.bubbleBorderOpacity,
      bubbleBorderWidth: s.bubbleBorderWidth,
      startupChatFilter: s.startupChatFilter,
    });
    set({ bubbleBorderColor });
    window.electronAPI?.broadcastSettingsUpdate?.({ bubbleBorderColor });
  },

  setBubbleBorderOpacity: (bubbleBorderOpacity: number) => {
    const clamped = Math.min(100, Math.max(0, Math.round(bubbleBorderOpacity)));
    const s = get();
    saveUserSettings({
      bubbleScale: s.bubbleScale,
      maxBubbles: s.maxBubbles,
      soundMuted: s.soundMuted,
      userSoundPreset: s.userSoundPreset,
      groupSoundPreset: s.groupSoundPreset,
      customUserSoundName: s.customUserSoundName,
      customGroupSoundName: s.customGroupSoundName,
      bubbleBorderMode: s.bubbleBorderMode,
      bubbleBorderColor: s.bubbleBorderColor,
      bubbleBorderOpacity: clamped,
      bubbleBorderWidth: s.bubbleBorderWidth,
      startupChatFilter: s.startupChatFilter,
    });
    set({ bubbleBorderOpacity: clamped });
    window.electronAPI?.broadcastSettingsUpdate?.({ bubbleBorderOpacity: clamped });
  },

  setBubbleBorderWidth: (bubbleBorderWidth: number) => {
    const clamped = Math.min(6, Math.max(0.5, Number(bubbleBorderWidth.toFixed(1))));
    const s = get();
    saveUserSettings({
      bubbleScale: s.bubbleScale,
      maxBubbles: s.maxBubbles,
      soundMuted: s.soundMuted,
      userSoundPreset: s.userSoundPreset,
      groupSoundPreset: s.groupSoundPreset,
      customUserSoundName: s.customUserSoundName,
      customGroupSoundName: s.customGroupSoundName,
      bubbleBorderMode: s.bubbleBorderMode,
      bubbleBorderColor: s.bubbleBorderColor,
      bubbleBorderOpacity: s.bubbleBorderOpacity,
      bubbleBorderWidth: clamped,
      startupChatFilter: s.startupChatFilter,
    });
    set({ bubbleBorderWidth: clamped });
    window.electronAPI?.broadcastSettingsUpdate?.({ bubbleBorderWidth: clamped });
  },

  setStartupChatFilter: (startupChatFilter: StartupChatFilter) => {
    const s = get();
    saveUserSettings({
      bubbleScale: s.bubbleScale,
      maxBubbles: s.maxBubbles,
      soundMuted: s.soundMuted,
      userSoundPreset: s.userSoundPreset,
      groupSoundPreset: s.groupSoundPreset,
      customUserSoundName: s.customUserSoundName,
      customGroupSoundName: s.customGroupSoundName,
      bubbleBorderMode: s.bubbleBorderMode,
      bubbleBorderColor: s.bubbleBorderColor,
      bubbleBorderOpacity: s.bubbleBorderOpacity,
      bubbleBorderWidth: s.bubbleBorderWidth,
      startupChatFilter,
    });

    let nextBubbles = s.activeBubbles;
    let nextActiveChatId = s.activeChatId;
    let nextPopover = s.activePopover;

    if (startupChatFilter === 'pinned_only') {
      const isAnyChatOpen = s.activePopover === 'chat-window' && Boolean(s.activeChatId);
      nextBubbles = s.activeBubbles.filter(
        (b) =>
          b.isPinned ||
          s.pinnedChatIds.includes(b.chatId) ||
          newlyActiveChatIdsThisSession.has(b.chatId) ||
          (isAnyChatOpen && s.activeChatId === b.chatId)
      );
      if (s.activeChatId && !nextBubbles.some((b) => b.chatId === s.activeChatId)) {
        nextActiveChatId = null;
        if (nextPopover === 'chat-window') nextPopover = 'none';
      }
    }

    set({
      startupChatFilter,
      activeBubbles: nextBubbles,
      activeChatId: nextActiveChatId,
      activePopover: nextPopover,
    });
    window.electronAPI?.broadcastSettingsUpdate?.({ startupChatFilter });
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
    const nextBorderMode =
      patch.bubbleBorderMode === 'custom' || patch.bubbleBorderMode === 'default' || patch.bubbleBorderMode === 'minimal' || patch.bubbleBorderMode === 'advanced'
        ? patch.bubbleBorderMode
        : s.bubbleBorderMode;
    const nextBorderColor =
      typeof patch.bubbleBorderColor === 'string' ? patch.bubbleBorderColor : s.bubbleBorderColor;
    const nextBorderOpacity =
      typeof patch.bubbleBorderOpacity === 'number'
        ? patch.bubbleBorderOpacity
        : s.bubbleBorderOpacity;
    const nextBorderWidth =
      typeof patch.bubbleBorderWidth === 'number'
        ? patch.bubbleBorderWidth
        : s.bubbleBorderWidth;
    const nextStartupChatFilter =
      patch.startupChatFilter === 'pinned_only' || patch.startupChatFilter === 'pinned_and_unread_48h'
        ? (patch.startupChatFilter as StartupChatFilter)
        : s.startupChatFilter;

    const trimmedBubbles = organizeBubbles(s.activeBubbles, nextMaxBubbles, s.pinnedChatIds);
    let filteredBubbles = trimmedBubbles;
    let activeStillExists =
      !s.activeChatId || filteredBubbles.some((b) => b.chatId === s.activeChatId);

    if (nextStartupChatFilter === 'pinned_only') {
      const isAnyChatOpen = s.activePopover === 'chat-window' && Boolean(s.activeChatId);
      filteredBubbles = trimmedBubbles.filter(
        (b) =>
          b.isPinned ||
          s.pinnedChatIds.includes(b.chatId) ||
          newlyActiveChatIdsThisSession.has(b.chatId) ||
          (isAnyChatOpen && s.activeChatId === b.chatId)
      );
      activeStillExists =
        !s.activeChatId || filteredBubbles.some((b) => b.chatId === s.activeChatId);
    }

    saveUserSettings({
      bubbleScale: nextScale,
      maxBubbles: nextMaxBubbles,
      soundMuted: nextSoundMuted,
      userSoundPreset: nextUserPreset,
      groupSoundPreset: nextGroupPreset,
      customUserSoundName: nextCustomUser,
      customGroupSoundName: nextCustomGroup,
      bubbleBorderMode: nextBorderMode,
      bubbleBorderColor: nextBorderColor,
      bubbleBorderOpacity: nextBorderOpacity,
      bubbleBorderWidth: nextBorderWidth,
      startupChatFilter: nextStartupChatFilter,
    });

    set({
      bubbleScale: nextScale,
      maxBubbles: nextMaxBubbles,
      soundMuted: nextSoundMuted,
      userSoundPreset: nextUserPreset,
      groupSoundPreset: nextGroupPreset,
      customUserSoundName: nextCustomUser,
      customGroupSoundName: nextCustomGroup,
      bubbleBorderMode: nextBorderMode,
      bubbleBorderColor: nextBorderColor,
      bubbleBorderOpacity: nextBorderOpacity,
      bubbleBorderWidth: nextBorderWidth,
      startupChatFilter: nextStartupChatFilter,
      activeBubbles: filteredBubbles,
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
    newlyActiveChatIdsThisSession.clear();
    dismissedChatIdsThisSession.clear();
    savePinnedChatIds([]);
    savePinnedChatMeta({});
    saveUnpinnedChatIds([]);
    set({
      waStatus: 'initializing',
      qrDataUrl: null,
      hasSyncedRealChats: false,
      chats: [],
      activeBubbles: [],
      pinnedChatIds: [],
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
        activeReactionDetailsMessage: null,
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
    dismissedChatIdsThisSession.delete(chatId);
    newlyActiveChatIdsThisSession.add(chatId);

    const { chats, activeBubbles, messagesByChat, unreadBannerByChat } = get();
    const targetChat = chats.find((c) => c.id === chatId);
    if (!targetChat) return;

    const existingBubble = activeBubbles.find((b) => b.chatId === chatId);
    const rawUnread = Math.max(
      existingBubble?.unreadCount || 0,
      targetChat.unreadCount || 0
    );
    const isExplicitlyUnread = Boolean(
      existingBubble?.isMarkedUnread ||
      targetChat.isMarkedUnread ||
      existingBubble?.unreadCount === -1 ||
      targetChat.unreadCount === -1
    );
    const unreadAtOpen = isExplicitlyUnread
      ? Math.max(1, rawUnread > 0 ? rawUnread : 0)
      : Math.max(0, rawUnread);
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
        isMarkedUnread: false,
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
        b.chatId === chatId ? { ...b, unreadCount: 0, isMarkedUnread: false, hasMention: false } : b
      );
    }

    const updatedChats = chats.map((c) =>
      c.id === chatId ? { ...c, unreadCount: 0, isMarkedUnread: false, hasMention: false } : c
    );

    set({
      activeBubbles: updatedBubbles,
      chats: updatedChats,
      activePopover: 'chat-window',
      activeChatId: chatId,
      replyingTo: null,
      viewingImage: null,
      activeReactionDetailsMessage: null,
      unreadBannerByChat: {
        ...unreadBannerByChat,
        [chatId]: bannerInfo,
      },
    });

    if (targetChat?.isGroup || existingBubble?.isGroup) {
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
        activeReactionDetailsMessage: null,
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
    const rawUnread = Math.max(
      existingBubble?.unreadCount || 0,
      targetChat?.unreadCount || 0
    );
    const isExplicitlyUnread = Boolean(
      existingBubble?.isMarkedUnread ||
      targetChat?.isMarkedUnread ||
      existingBubble?.unreadCount === -1 ||
      targetChat?.unreadCount === -1
    );
    const unreadAtOpen = isExplicitlyUnread
      ? Math.max(1, rawUnread > 0 ? rawUnread : 0)
      : Math.max(0, rawUnread);
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
      b.chatId === chatId ? { ...b, unreadCount: 0, isMarkedUnread: false, hasMention: false } : b
    );
    const updatedChats = chats.map((c) =>
      c.id === chatId ? { ...c, unreadCount: 0, isMarkedUnread: false, hasMention: false } : c
    );

    set({
      activeBubbles: updatedBubbles,
      chats: updatedChats,
      activePopover: 'chat-window',
      activeChatId: chatId,
      replyingTo: null,
      viewingImage: null,
      activeReactionDetailsMessage: null,
      unreadBannerByChat: {
        ...unreadBannerByChat,
        [chatId]: bannerInfo,
      },
    });

    if (targetChat?.isGroup || existingBubble?.isGroup) {
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
      activeReactionDetailsMessage: null,
    });
  },

  // 5.4 Fechar a conversa definitivamente (remove a bolha da barra inferior)
  closeBubble: (chatId) => {
    // Para instantaneamente a reprodução de áudio deste contato se estiver ativa
    useAudioPlaybackStore.getState().stop(chatId);

    const { activeBubbles, activeChatId, activePopover, maxBubbles, pinnedChatIds } = get();
    const bubble = activeBubbles.find((b) => b.chatId === chatId);
    if (bubble?.isPinned) {
      // Bloqueado: bolhas fixadas não podem ser fechadas até serem desfixadas
      return;
    }
    dismissedChatIdsThisSession.add(chatId);
    newlyActiveChatIdsThisSession.delete(chatId);
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
      activeReactionDetailsMessage: isClosingActiveChat ? null : get().activeReactionDetailsMessage,
    });
  },

  // Fixar ou Desfixar conversa
  togglePinBubble: (chatId: string) => {
    const { activeBubbles, pinnedChatIds, maxBubbles, activePopover, activeChatId, chats } = get();
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

    const metaMap = loadPinnedChatMeta();
    if (nextPinned) {
      const targetBubble = activeBubbles.find((b) => b.chatId === chatId);
      const targetChat = chats.find((c) => c.id === chatId);
      metaMap[chatId] = {
        chatId,
        name: targetBubble?.name || targetChat?.name || chatId.split('@')[0],
        avatar: targetBubble?.avatar || targetChat?.avatar || '',
        isGroup: targetBubble?.isGroup ?? targetChat?.isGroup,
        lastActivity: targetBubble?.lastActivity || Date.now(),
      };
      savePinnedChatMeta(metaMap);

      const unpinned = loadUnpinnedChatIds().filter((id) => id !== chatId);
      saveUnpinnedChatIds(unpinned);
    } else {
      delete metaMap[chatId];
      savePinnedChatMeta(metaMap);

      const unpinned = Array.from(new Set([...loadUnpinnedChatIds(), chatId]));
      saveUnpinnedChatIds(unpinned);
    }

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

  // Marcar conversa como não lida (sincroniza com celular/WhatsApp e define indicador na bolha)
  markChatAsUnread: async (chatId: string) => {
    const { activeBubbles, chats, activePopover, activeChatId } = get();
    const isThisChatCurrentlyOpen = activePopover === 'chat-window' && activeChatId === chatId;

    const updatedBubbles = activeBubbles.map((b) =>
      b.chatId === chatId
        ? { ...b, unreadCount: -1, isMarkedUnread: true, hasMention: false }
        : b
    );
    const updatedChats = chats.map((c) =>
      c.id === chatId
        ? { ...c, unreadCount: -1, isMarkedUnread: true, hasMention: false }
        : c
    );

    set({
      activeBubbles: updatedBubbles,
      chats: updatedChats,
      ...(isThisChatCurrentlyOpen
        ? {
            activePopover: 'none',
            activeChatId: null,
            replyingTo: null,
            viewingImage: null,
          }
        : {}),
    });

    try {
      if (window.electronAPI?.markAsUnread) {
        await window.electronAPI.markAsUnread(chatId);
      }
    } catch (err) {
      console.error('[useBubbleStore] Error in markChatAsUnread:', err);
    }
  },

  // Marcar conversa como lida
  markChatAsRead: async (chatId: string) => {
    const { activeBubbles, chats } = get();
    const updatedBubbles = activeBubbles.map((b) =>
      b.chatId === chatId
        ? { ...b, unreadCount: 0, isMarkedUnread: false, hasMention: false }
        : b
    );
    const updatedChats = chats.map((c) =>
      c.id === chatId
        ? { ...c, unreadCount: 0, isMarkedUnread: false, hasMention: false }
        : c
    );

    set({
      activeBubbles: updatedBubbles,
      chats: updatedChats,
    });

    try {
      if (window.electronAPI?.markAsRead) {
        await window.electronAPI.markAsRead(chatId);
      }
    } catch (err) {
      console.error('[useBubbleStore] Error in markChatAsRead:', err);
    }
  },

  // Silenciar ou Reativar som da conversa
  toggleMuteChat: async (chatId: string) => {
    const { chats } = get();
    const target = chats.find((c) => c.id === chatId);
    if (!target) return;
    const nextMuted = !target.isMuted;
    set({
      chats: chats.map((c) => (c.id === chatId ? { ...c, isMuted: nextMuted } : c)),
    });
    if (window.electronAPI?.toggleMute) {
      try {
        await window.electronAPI.toggleMute(chatId, nextMuted);
      } catch (err) {
        console.error('[useBubbleStore] Erro ao alternar silêncio:', err);
      }
    }
  },

  // Apagar mensagens selecionadas localmente
  deleteMessagesLocally: (chatId: string, messageIds: string[]) => {
    const { messagesByChat, chats } = get();
    const currentMsgs = messagesByChat[chatId];
    if (!currentMsgs || messageIds.length === 0) return;

    const idSet = new Set(messageIds);
    const remaining = currentMsgs.filter(
      (m) => !idSet.has(m.id) && !messageIds.some((id) => isMatchingMessageId(m.id, id))
    );

    const updatedChats = chats.map((c) => {
      if (c.id === chatId && remaining.length > 0) {
        const last = remaining[remaining.length - 1];
        const mediaType: MessageMediaType =
          last.type === 'image'
            ? 'photo'
            : last.type === 'video'
            ? 'video'
            : last.type === 'audio'
            ? 'audio'
            : last.type === 'sticker'
            ? 'sticker'
            : 'text';

        return {
          ...c,
          lastMessage: {
            text:
              last.text ||
              (last.type === 'image'
                ? '📷 Foto'
                : last.type === 'video'
                ? '🎥 Vídeo'
                : last.type === 'audio'
                ? '🎤 Áudio'
                : last.type === 'sticker'
                ? '💟 Figurinha'
                : 'Mensagem'),
            mediaType,
            timestamp: last.timestamp,
            senderName: last.senderName,
            fromMe: last.fromMe,
          },
        };
      }
      return c;
    });

    set({
      messagesByChat: {
        ...messagesByChat,
        [chatId]: remaining,
      },
      chats: updatedChats,
    });
  },

  // Encaminhar mensagens para outro contato ou grupo
  forwardMessages: async (targetChatId: string, messagesToForward: FormattedMessage[]) => {
    if (!targetChatId || messagesToForward.length === 0) return;

    for (const msg of messagesToForward) {
      if (msg.type === 'sticker' && msg.imageUrl && window.electronAPI?.sendSticker) {
        await window.electronAPI.sendSticker({
          chatId: targetChatId,
          stickerDataUrl: msg.imageUrl,
        });
      } else if (
        (msg.type === 'image' || msg.type === 'video') &&
        (msg.imageUrl || msg.videoUrl) &&
        window.electronAPI?.sendMedia
      ) {
        await window.electronAPI.sendMedia({
          chatId: targetChatId,
          mediaDataUrl: msg.imageUrl || msg.videoUrl || '',
          caption: msg.text || undefined,
        });
      } else if (msg.type === 'audio' && msg.audioData?.audioUrl && window.electronAPI?.sendMedia) {
        await window.electronAPI.sendMedia({
          chatId: targetChatId,
          mediaDataUrl: msg.audioData.audioUrl,
          sendAudioAsVoice: true,
        });
      } else if (msg.text && window.electronAPI?.sendMessage) {
        await window.electronAPI.sendMessage({
          chatId: targetChatId,
          text: msg.text,
        });
      }
    }

    if (window.electronAPI?.getMessages) {
      window.electronAPI.getMessages(targetChatId, 50).then((msgs) => {
        if (msgs) {
          get().setMessagesForChat(targetChatId, msgs);
        }
      });
    }
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
            const isMatch =
              (sentMsg && m.id === sentMsg.id) ||
              (idx === freshMsgs.length - 1 && m.fromMe && (m.type === 'image' || m.type === 'video'));
            if (isMatch) {
              return {
                ...m,
                imageUrl:
                  mediaType === 'image' ? payload.mediaDataUrl : m.imageUrl,
                videoUrl:
                  mediaType === 'video' ? payload.mediaDataUrl : m.videoUrl,
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

    dismissedChatIdsThisSession.delete(chat.id);
    newlyActiveChatIdsThisSession.add(chat.id);

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
        const prevCount = Math.max(0, currentBubble.unreadCount);
        const refreshedBubble: BubbleItem = {
          ...currentBubble,
          name: chat.name,
          avatar: chat.avatar,
          unreadCount: isThisChatCurrentlyOpen ? 0 : prevCount + 1,
          isMarkedUnread: false,
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
          isMarkedUnread: false,
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
        const prevCount = Math.max(0, currentBubble.unreadCount);
        const refreshedBubble: BubbleItem = {
          ...currentBubble,
          name: chat.name,
          avatar: chat.avatar,
          unreadCount: prevCount + 1,
          isMarkedUnread: false,
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
          isMarkedUnread: false,
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
                unreadCount: isThisChatCurrentlyOpen ? 0 : Math.max(0, c.unreadCount || 0) + 1,
                isMarkedUnread: false,
                hasMention: isThisChatCurrentlyOpen
                  ? false
                  : (messageMentionsMe ? true : Boolean(c.hasMention || chat.hasMention)),
              }
            : c
        )
      : [
          {
            ...chat,
            unreadCount: isThisChatCurrentlyOpen ? 0 : Math.max(0, chat.unreadCount || 0) || 1,
            isMarkedUnread: false,
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

  applyReactionUpdate: (payload: {
    messageId: string;
    chatId?: string;
    reaction: string;
    senderId?: string;
    senderName?: string;
    senderAvatar?: string;
    fromMe?: boolean;
    reactions?: MessageReactionItem[];
    timestamp?: number;
  }) => {
    const { messagesByChat } = get();

    let targetChatId = payload.chatId;
    if (!targetChatId || !messagesByChat[targetChatId]) {
      for (const [cid, msgs] of Object.entries(messagesByChat)) {
        if (msgs.some((m) => isMatchingMessageId(m.id, payload.messageId))) {
          targetChatId = cid;
          break;
        }
      }
    }
    if (!targetChatId) return;

    const currentMsgs = messagesByChat[targetChatId];
    if (!currentMsgs) return;

    const msgIndex = currentMsgs.findIndex((m) => isMatchingMessageId(m.id, payload.messageId));
    if (msgIndex === -1) return;

    const msg = currentMsgs[msgIndex];

    // Se o backend forneceu a lista oficial completa de reações atualizadas:
    if (payload.reactions && Array.isArray(payload.reactions)) {
      const updatedMsg: FormattedMessage = {
        ...msg,
        reactions: payload.reactions.length > 0 ? payload.reactions : undefined,
        reaction: payload.reactions[0]?.emoji || undefined,
      };
      const updatedList = [...currentMsgs];
      updatedList[msgIndex] = updatedMsg;

      const curDetails = get().activeReactionDetailsMessage;
      const nextDetails =
        curDetails && isMatchingMessageId(curDetails.id, payload.messageId)
          ? (updatedMsg.reactions && updatedMsg.reactions.length > 0 ? updatedMsg : null)
          : curDetails;

      set({
        messagesByChat: {
          ...messagesByChat,
          [targetChatId]: updatedList,
        },
        activeReactionDetailsMessage: nextDetails,
      });
      return;
    }

    let currentReactions: MessageReactionItem[] = msg.reactions
      ? msg.reactions.map((r) => ({
          ...r,
          senders: r.senders ? [...r.senders] : undefined,
        }))
      : msg.reaction
      ? [{ emoji: msg.reaction, count: 1, fromMe: false }]
      : [];

    const isFromMe = Boolean(payload.fromMe);
    const senderId = payload.senderId || (isFromMe ? 'me' : 'sender');
    const newEmoji = (payload.reaction || '').trim();

    // 1. Remove reações anteriores deste remetente
    for (let i = currentReactions.length - 1; i >= 0; i--) {
      const item = currentReactions[i];
      let removedSender = false;

      if (item.senders && item.senders.length > 0) {
        const sIdx = item.senders.findIndex(
          (s) =>
            (isFromMe && s.fromMe) ||
            (!isFromMe && s.id && (s.id === senderId || s.id.split('@')[0] === senderId.split('@')[0]))
        );
        if (sIdx !== -1) {
          item.senders.splice(sIdx, 1);
          item.count = Math.max(0, item.count - 1);
          removedSender = true;
        }
      } else if (isFromMe && item.fromMe) {
        item.count = Math.max(0, item.count - 1);
        item.fromMe = false;
        removedSender = true;
      }

      if (item.count <= 0) {
        currentReactions.splice(i, 1);
      } else if (removedSender && isFromMe) {
        item.fromMe = item.senders ? item.senders.some((s) => s.fromMe) : false;
      }
    }

    // 2. Se newEmoji não for vazio, adiciona ou incrementa a reação
    if (newEmoji) {
      let existingItem = currentReactions.find((r) => r.emoji === newEmoji);
      if (!existingItem) {
        existingItem = {
          emoji: newEmoji,
          count: 0,
          fromMe: isFromMe,
          senders: [],
        };
        currentReactions.push(existingItem);
      }

      existingItem.count += 1;
      if (isFromMe) {
        existingItem.fromMe = true;
      }
      if (!existingItem.senders) {
        existingItem.senders = [];
      }
      existingItem.senders.push({
        id: senderId,
        name: isFromMe ? 'Você' : (payload.senderName || undefined),
        avatar: isFromMe ? undefined : (payload.senderAvatar || undefined),
        fromMe: isFromMe,
        timestamp: payload.timestamp || Date.now(),
      });
    }

    const updatedReactions = currentReactions.length > 0 ? currentReactions : undefined;
    const updatedPrimaryReaction = updatedReactions?.[0]?.emoji || undefined;

    const updatedMsg: FormattedMessage = {
      ...msg,
      reactions: updatedReactions,
      reaction: updatedPrimaryReaction,
    };

    const updatedList = [...currentMsgs];
    updatedList[msgIndex] = updatedMsg;

    const curDetails = get().activeReactionDetailsMessage;
    const nextDetails =
      curDetails && isMatchingMessageId(curDetails.id, payload.messageId)
        ? (updatedMsg.reactions && updatedMsg.reactions.length > 0 ? updatedMsg : null)
        : curDetails;

    set({
      messagesByChat: {
        ...messagesByChat,
        [targetChatId]: updatedList,
      },
      activeReactionDetailsMessage: nextDetails,
    });
  },

  sendReaction: async (chatId: string, messageId: string, emoji: string) => {
    const { messagesByChat, applyReactionUpdate } = get();
    const currentMsgs = messagesByChat[chatId] || [];
    const targetMsg = currentMsgs.find((m) => isMatchingMessageId(m.id, messageId));

    let existingMyEmoji: string | undefined;
    if (targetMsg?.reactions) {
      const myItem = targetMsg.reactions.find(
        (r) => r.fromMe || r.senders?.some((s) => s.fromMe)
      );
      if (myItem) existingMyEmoji = myItem.emoji;
    } else if (targetMsg?.reaction && targetMsg?.fromMe) {
      existingMyEmoji = targetMsg.reaction;
    }

    const targetReaction = existingMyEmoji === emoji ? '' : emoji;

    applyReactionUpdate({
      messageId,
      chatId,
      reaction: targetReaction,
      fromMe: true,
      senderId: 'me',
      timestamp: Date.now(),
    });

    if (window.electronAPI?.sendReaction) {
      await window.electronAPI.sendReaction(chatId, messageId, targetReaction);
    }
  },
}));
