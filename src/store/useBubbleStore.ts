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
  SoundPreset,
  ViewingImageState,
  WaConnectionState,
} from '../types/whatsapp';
import { triggerIncomingNotificationSound } from '../utils/notificationSound';

const WAVEFORM_INCOMING_046 = [
  0.22, 0.35, 0.65, 0.28, 0.82, 0.45, 0.3, 0.55, 0.9, 0.48, 0.32, 0.72,
  0.38, 0.25, 0.68, 0.95, 0.52, 0.78, 0.34, 0.62, 0.88, 0.42, 0.92, 0.56,
  0.3, 0.64, 0.48, 0.75, 0.35, 0.84, 0.44, 0.28, 0.5, 0.22,
];

const WAVEFORM_OUTGOING_216 = [
  0.25, 0.42, 0.3, 0.75, 0.52, 0.88, 0.4, 0.68, 0.94, 0.6, 0.82, 0.45,
  0.76, 0.55, 0.35, 0.7, 0.92, 0.62, 0.48, 0.85, 0.58, 0.38, 0.78, 0.9,
  0.5, 0.66, 0.84, 0.44, 0.72, 0.88, 0.54, 0.74, 0.38, 0.24,
];

export const INITIAL_MOCK_CHATS: ChatSummary[] = [
  {
    id: 'cacadores-rewards',
    parentName: 'Caçadores De Rewards',
    name: '💚🎖️Caçadores de Rewards🎖️💚',
    avatar: '/avatars/cacadores-rewards.png',
    unreadCount: 0,
    isGroup: true,
    lastMessage: {
      senderName: '~João Victor',
      text: 'Figurinha',
      mediaType: 'sticker',
      timestamp: '13:58',
    },
  },
  {
    id: 'xbox-clube',
    parentName: 'Comunidade Xbox 🇧🇷',
    name: 'Xbox Clube',
    avatar: '/avatars/xbox-clube.png',
    unreadCount: 0,
    isGroup: true,
    lastMessage: {
      senderName: '~Daniel',
      text: 'fritar ovo',
      mediaType: 'text',
      timestamp: '13:54',
    },
  },
  {
    id: 'unidev-qam',
    name: 'Unidev QAM',
    avatar: '/avatars/unidev-qam.png',
    unreadCount: 2,
    isGroup: true,
    lastMessage: {
      senderName: '~Hllink',
      text: 'Foto',
      mediaType: 'photo',
      timestamp: '13:51',
    },
  },
  {
    id: 'amigos-xbox',
    name: 'Amigos XBOX',
    avatar: '/avatars/amigos-xbox.png',
    unreadCount: 0,
    isGroup: true,
    lastMessage: {
      senderName: 'Júnior (Amigo do Danilo)',
      text: 'Figurinha',
      mediaType: 'sticker',
      timestamp: '13:49',
    },
  },
  {
    id: 'danilo-neves',
    name: 'Danilo Neves Xbox',
    avatar: '/avatars/danilo-neves.png',
    unreadCount: 4,
    isGroup: false,
    lastMessage: {
      text: '2:16',
      mediaType: 'audio',
      fromMe: true,
      ack: 'read',
      duration: '2:16',
      timestamp: '13:50',
    },
  },
  {
    id: 'conquista-bloqueada',
    name: 'Canal ConquistaBloqueada',
    avatar: '/avatars/conquista-bloqueada.png',
    unreadCount: 0,
    isGroup: true,
    lastMessage: {
      senderName: '~🎮😎EnrickDKastro🇧🇷💚',
      text: 'Figurinha',
      mediaType: 'sticker',
      timestamp: '13:30',
    },
  },
];

export const INITIAL_MOCK_BUBBLES: BubbleItem[] = [
  {
    chatId: 'danilo-neves',
    name: 'Danilo Neves Xbox',
    avatar: '/avatars/danilo-neves.png',
    unreadCount: 4,
  },
  {
    chatId: 'unidev-qam',
    name: 'Unidev QAM',
    avatar: '/avatars/unidev-qam.png',
    unreadCount: 2,
  },
];

export const INITIAL_MOCK_MESSAGES: Record<string, FormattedMessage[]> = {
  'danilo-neves': [
    {
      id: 'dn-0',
      chatId: 'danilo-neves',
      text: 'Bora jogar mais tarde?',
      timestamp: '21:29',
      fromMe: false,
      type: 'text',
    },
    {
      id: 'dn-1',
      chatId: 'danilo-neves',
      text: 'Top demais',
      timestamp: '21:30',
      fromMe: false,
      type: 'text',
    },
    {
      id: 'dn-2',
      chatId: 'danilo-neves',
      text: 'Kkk',
      timestamp: '21:30',
      fromMe: false,
      type: 'text',
    },
    {
      id: 'dn-3',
      chatId: 'danilo-neves',
      text: 'Hoje a tarde entrei',
      timestamp: '21:30',
      fromMe: false,
      type: 'text',
    },
    {
      id: 'dn-4',
      chatId: 'danilo-neves',
      text: 'Mais tu tava em outro jogo aí não quis atrapalhar kkk',
      timestamp: '21:30',
      fromMe: false,
      type: 'text',
    },
    {
      id: 'dn-5',
      chatId: 'danilo-neves',
      text: 'Ah eu deixei aberto por causa do rewards',
      timestamp: '22:35',
      fromMe: true,
      type: 'text',
      ack: 'read',
      reaction: '😂',
      quotedMessage: {
        id: 'dn-4',
        author: 'Danilo Neves Xbox',
        authorColor: '#E59866',
        text: 'Mais tu tava em outro jogo aí não quis atrapalhar kkk',
      },
    },
    {
      id: 'dn-6',
      chatId: 'danilo-neves',
      text: 'Ahuahaua',
      timestamp: '22:35',
      fromMe: true,
      type: 'text',
      ack: 'read',
    },
    {
      id: 'dn-7',
      chatId: 'danilo-neves',
      text: 'Não tava on nao',
      timestamp: '22:35',
      fromMe: true,
      type: 'text',
      ack: 'read',
    },
    {
      id: 'dn-8',
      chatId: 'danilo-neves',
      text: '',
      timestamp: '13:45',
      dateLabel: 'Hoje',
      fromMe: false,
      type: 'audio',
      audioData: {
        duration: '0:46',
        durationSeconds: 46,
        senderAvatar: '/avatars/danilo-neves.png',
        waveform: WAVEFORM_INCOMING_046,
      },
    },
    {
      id: 'dn-9',
      chatId: 'danilo-neves',
      text: '',
      timestamp: '13:50',
      fromMe: true,
      type: 'audio',
      ack: 'read',
      audioData: {
        duration: '2:16',
        durationSeconds: 136,
        senderAvatar: '/avatars/me.png',
        waveform: WAVEFORM_OUTGOING_216,
      },
    },
  ],
  'unidev-qam': [
    {
      id: 'uq-1',
      chatId: 'unidev-qam',
      senderName: '~Hllink',
      text: 'Pessoal, subi a build nova do projeto para testes!',
      timestamp: '13:40',
      dateLabel: 'Hoje',
      fromMe: false,
      type: 'text',
    },
    {
      id: 'uq-2',
      chatId: 'unidev-qam',
      senderName: '~Hllink',
      text: '📷 Foto: Screenshot do painel atualizado',
      timestamp: '13:51',
      fromMe: false,
      type: 'text',
    },
  ],
  'cacadores-rewards': [
    {
      id: 'cr-1',
      chatId: 'cacadores-rewards',
      senderName: '~João Victor',
      text: 'Alguém já fez a missão diária do Game Pass hoje?',
      timestamp: '13:50',
      dateLabel: 'Hoje',
      fromMe: false,
      type: 'text',
    },
    {
      id: 'cr-2',
      chatId: 'cacadores-rewards',
      senderName: '~João Victor',
      text: '🎯 Figurinha enviada',
      timestamp: '13:58',
      fromMe: false,
      type: 'text',
    },
  ],
  'xbox-clube': [
    {
      id: 'xc-1',
      chatId: 'xbox-clube',
      senderName: '~Daniel',
      text: 'Meu Series X esquentou tanto no Call of Duty que dá pra',
      timestamp: '13:53',
      dateLabel: 'Hoje',
      fromMe: false,
      type: 'text',
    },
    {
      id: 'xc-2',
      chatId: 'xbox-clube',
      senderName: '~Daniel',
      text: 'fritar ovo',
      timestamp: '13:54',
      fromMe: false,
      type: 'text',
    },
  ],
  'amigos-xbox': [
    {
      id: 'ax-1',
      chatId: 'amigos-xbox',
      senderName: 'Júnior (Amigo do Danilo)',
      text: 'Logo mais tem lobby fechado de Forza Horizon!',
      timestamp: '13:48',
      dateLabel: 'Hoje',
      fromMe: false,
      type: 'text',
    },
    {
      id: 'ax-2',
      chatId: 'amigos-xbox',
      senderName: 'Júnior (Amigo do Danilo)',
      text: '🏎️ Figurinha',
      timestamp: '13:49',
      fromMe: false,
      type: 'text',
    },
  ],
  'conquista-bloqueada': [
    {
      id: 'cb-1',
      chatId: 'conquista-bloqueada',
      senderName: '~🎮😎EnrickDKastro🇧🇷💚',
      text: 'Platinei mais um 1000G hoje galera!',
      timestamp: '13:29',
      dateLabel: 'Hoje',
      fromMe: false,
      type: 'text',
    },
    {
      id: 'cb-2',
      chatId: 'conquista-bloqueada',
      senderName: '~🎮😎EnrickDKastro🇧🇷💚',
      text: '🏆 Figurinha',
      timestamp: '13:30',
      fromMe: false,
      type: 'text',
    },
  ],
};

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

export const MOCK_GROUP_PARTICIPANTS: Record<string, GroupParticipant[]> = {
  'cacadores-rewards': [
    { id: '5511990001111@c.us', name: 'João Victor', pushname: 'João', avatar: '/avatars/cacadores-rewards.png', isAdmin: true },
    { id: '5511990002222@c.us', name: 'Danilo Neves', pushname: 'Danilo', avatar: '/avatars/danilo-neves.png' },
    { id: '5511990003333@c.us', name: 'Hllink', avatar: '/avatars/unidev-qam.png' },
    { id: '5511990004444@c.us', name: 'Enrick D Kastro', pushname: 'Enrick', avatar: '/avatars/conquista-bloqueada.png' },
  ],
  'xbox-clube': [
    { id: '5511990005555@c.us', name: 'Daniel', pushname: 'Daniel', avatar: '/avatars/xbox-clube.png', isAdmin: true },
    { id: '5511990002222@c.us', name: 'Danilo Neves', pushname: 'Danilo', avatar: '/avatars/danilo-neves.png' },
    { id: '5511990006666@c.us', name: 'Júnior', avatar: '/avatars/amigos-xbox.png' },
  ],
  'unidev-qam': [
    { id: '5511990003333@c.us', name: 'Hllink', avatar: '/avatars/unidev-qam.png', isAdmin: true },
    { id: '5511990002222@c.us', name: 'Danilo Neves', avatar: '/avatars/danilo-neves.png' },
    { id: '5511990001111@c.us', name: 'João Victor', avatar: '/avatars/cacadores-rewards.png' },
  ],
  'amigos-xbox': [
    { id: '5511990006666@c.us', name: 'Júnior', avatar: '/avatars/amigos-xbox.png', isAdmin: true },
    { id: '5511990002222@c.us', name: 'Danilo Neves', avatar: '/avatars/danilo-neves.png' },
  ],
  'conquista-bloqueada': [
    { id: '5511990004444@c.us', name: 'EnrickDKastro', avatar: '/avatars/conquista-bloqueada.png', isAdmin: true },
    { id: '5511990002222@c.us', name: 'Danilo Neves', avatar: '/avatars/danilo-neves.png' },
  ],
};

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
  const isPinned = (chatId: string, itemPinned?: boolean) =>
    itemPinned ?? pinnedChatIds.includes(chatId);

  const unpinned: BubbleItem[] = [];
  const pinned: BubbleItem[] = [];

  for (const b of bubbles) {
    if (isPinned(b.chatId, b.isPinned)) {
      pinned.push({ ...b, isPinned: true });
    } else {
      unpinned.push({ ...b, isPinned: false });
    }
  }

  // Available slots for unpinned bubbles (pinned are always kept)
  const availableSlots = Math.max(0, maxBubbles - pinned.length);
  const trimmedUnpinned = unpinned.slice(-availableSlots);

  // Unpinned on left (0..k), pinned on right (closer to WhatsApp button)
  return [...trimmedUnpinned, ...pinned];
}

export function moveBubbleToMostRecent(
  bubbles: BubbleItem[],
  chatId: string,
  maxBubbles: number,
  pinnedChatIds: string[]
): BubbleItem[] {
  const bubble = bubbles.find((b) => b.chatId === chatId);
  if (!bubble) return bubbles;

  const withoutBubble = bubbles.filter((b) => b.chatId !== chatId);
  const isPinned = bubble.isPinned ?? pinnedChatIds.includes(chatId);

  const unpinned = withoutBubble.filter(
    (b) => !(b.isPinned ?? pinnedChatIds.includes(b.chatId))
  );
  const pinned = withoutBubble.filter(
    (b) => (b.isPinned ?? pinnedChatIds.includes(b.chatId))
  );

  if (isPinned) {
    return organizeBubbles(
      [...unpinned, ...pinned, { ...bubble, isPinned: true }],
      maxBubbles,
      pinnedChatIds
    );
  } else {
    return organizeBubbles(
      [...unpinned, { ...bubble, isPinned: false }, ...pinned],
      maxBubbles,
      pinnedChatIds
    );
  }
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
  userForcedMock: boolean;

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
  showDebugControls: boolean;

  // Actions
  setMode: (mode: ConnectionMode) => void;
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
  toggleDebugControls: () => void;

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
  toggleBubbleChat: (chatId: string) => void;
  minimizeActiveChat: () => void;
  closeBubble: (chatId: string) => void;
  togglePinBubble: (chatId: string) => void;
  setChatBubbleSize: (chatId: string, size: ChatBubbleSize) => void;
  sendMessage: (text: string, mentions?: string[]) => Promise<void>;
  sendSticker: (stickerDataUrl: string) => Promise<void>;
  sendVoiceNote: (durationSeconds?: number) => Promise<void>;
  receiveIncomingMessage: (payload: IncomingMessagePayload) => void;
  simulateIncomingMessage: () => void;
  resetDemoState: () => void;
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
  userForcedMock: false,

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
  groupParticipantsByChat: MOCK_GROUP_PARTICIPANTS,
  initialGroupParticipantsByChat: MOCK_GROUP_PARTICIPANTS,
  unreadBannerByChat: {},
  replyingTo: null,
  viewingImage: null,
  showDebugControls: false,

  setMode: (mode) => {
    if (mode === 'whatsapp') {
      set({
        mode: 'whatsapp',
        userForcedMock: false,
        activeChatId: null,
      });
      if (window.electronAPI) {
        window.electronAPI.initWhatsApp().then((res) => {
          if (res.qrDataUrl) {
            set({ qrDataUrl: res.qrDataUrl });
          }
          get().setWaStatus(res.status);
        });
      }
    } else {
      set({
        mode: 'mock',
        userForcedMock: true,
        hasSyncedRealChats: false,
        activePopover: 'none',
        activeChatId: null,
        chats: INITIAL_MOCK_CHATS,
        activeBubbles: organizeBubbles(
          INITIAL_MOCK_BUBBLES,
          get().maxBubbles,
          get().pinnedChatIds
        ),
        messagesByChat: INITIAL_MOCK_MESSAGES,
      });
    }
  },

  setWaStatus: (waStatus, waError = null) => {
    const { activePopover, userForcedMock } = get();
    set({ waStatus, waError });

    if (userForcedMock) return;

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
      userForcedMock,
      activeBubbles,
      activePopover,
      activeChatId,
    } = get();

    if (userForcedMock || !realChats || realChats.length === 0) return;

    if (!hasSyncedRealChats) {
      const { maxBubbles, pinnedChatIds } = get();
      // Primeira sincronização real: cria bolhas para as conversas reais não silenciadas que possuem mensagens não lidas.
      // As mais recentes ficam na direita (final do array) e respeitam o limite maxBubbles.
      const initialRealBubbles: BubbleItem[] = realChats
        .filter((c) => c.unreadCount > 0 && !c.isMuted)
        .slice(0, maxBubbles)
        .reverse()
        .map((c) => ({
          chatId: c.id,
          name: c.name,
          avatar: c.avatar,
          unreadCount: c.unreadCount,
          isPinned: pinnedChatIds.includes(c.id),
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
    // Sincronizações subsequentes em segundo plano: atualiza lista e mantém bolhas sincronizadas
    const chatMap = new Map(realChats.map((c) => [c.id, c]));
    let updatedBubbles = activeBubbles.map((b) => {
      const fresh = chatMap.get(b.chatId);
      if (!fresh) return b;
      const isCurrentlyOpen =
        activePopover === 'chat-window' && activeChatId === b.chatId;
      return {
        ...b,
        name: fresh.name,
        avatar: fresh.avatar,
        unreadCount: isCurrentlyOpen ? 0 : fresh.unreadCount,
        isPinned: b.isPinned ?? pinnedChatIds.includes(b.chatId),
      };
    });

    // Se surgiu alguma conversa não silenciada com unreadCount > 0 que ainda não tem bolha, cria a bolha
    for (const c of realChats) {
      if (
        c.unreadCount > 0 &&
        !c.isMuted &&
        !updatedBubbles.some((b) => b.chatId === c.id) &&
        updatedBubbles.length < maxBubbles
      ) {
        updatedBubbles.push({
          chatId: c.id,
          name: c.name,
          avatar: c.avatar,
          unreadCount: c.unreadCount,
          isPinned: pinnedChatIds.includes(c.id),
        });
      }
    }
    const organizedBubbles = organizeBubbles(updatedBubbles, maxBubbles, pinnedChatIds);

    const normalizedChats = realChats.map((c) => {
      const isCurrentlyOpen =
        activePopover === 'chat-window' && activeChatId === c.id;
      if (isCurrentlyOpen && c.unreadCount > 0) {
        window.electronAPI?.markAsRead(c.id);
        return { ...c, unreadCount: 0 };
      }
      return c;
    });

    set({
      mode: 'whatsapp',
      chats: normalizedChats,
      activeBubbles: organizedBubbles,
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
    const { mode, initialGroupParticipantsByChat } = get();
    const cleanQuery = (query || '').trim();
    const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));

    // Se a busca estiver vazia e já temos a lista inicial de 10 colaboradores para este grupo, restaura imediatamente
    if (!cleanQuery && initialGroupParticipantsByChat[chatId]?.length > 0) {
      set((state) => ({
        groupParticipantsByChat: {
          ...state.groupParticipantsByChat,
          [chatId]: initialGroupParticipantsByChat[chatId],
        },
      }));
      return initialGroupParticipantsByChat[chatId];
    }

    if (mode === 'whatsapp' && window.electronAPI?.getGroupParticipants) {
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

    const mock = MOCK_GROUP_PARTICIPANTS[chatId] || [];
    let filtered = mock;
    if (cleanQuery) {
      const normalize = (str: string) =>
        (str || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
      const q = normalize(cleanQuery);
      filtered = mock.filter((p) => {
        const nName = normalize(p.name);
        const nPush = normalize(p.pushname || '');
        const nId = (p.id || '').toLowerCase();
        return nName.includes(q) || nPush.includes(q) || nId.includes(q);
      });
    }
    const limited = filtered.slice(0, safeLimit);
    set((state) => ({
      groupParticipantsByChat: {
        ...state.groupParticipantsByChat,
        [chatId]: limited,
      },
      ...(!cleanQuery && {
        initialGroupParticipantsByChat: {
          ...state.initialGroupParticipantsByChat,
          [chatId]: limited,
        },
      }),
    }));
    return limited;
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

  toggleDebugControls: () =>
    set((state) => ({ showDebugControls: !state.showDebugControls })),

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
    const { activePopover, activeChatId, activeBubbles, maxBubbles, pinnedChatIds } = get();
    const nextBubbles =
      activePopover === 'chat-window' && activeChatId
        ? moveBubbleToMostRecent(activeBubbles, activeChatId, maxBubbles, pinnedChatIds)
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
      const { activeChatId, activeBubbles, maxBubbles, pinnedChatIds } = get();
      const nextBubbles =
        activePopover === 'chat-window' && activeChatId
          ? moveBubbleToMostRecent(activeBubbles, activeChatId, maxBubbles, pinnedChatIds)
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
    const { chats, activeBubbles, mode, messagesByChat, unreadBannerByChat } = get();
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

    if (!exists) {
      const newBubble: BubbleItem = {
        chatId: targetChat.id,
        name: targetChat.name,
        avatar: targetChat.avatar,
        unreadCount: 0,
        isPinned,
      };
      const unpinned = activeBubbles.filter((b) => !b.isPinned);
      const pinned = activeBubbles.filter((b) => b.isPinned);
      if (isPinned) {
        updatedBubbles = organizeBubbles(
          [...unpinned, ...pinned, newBubble],
          maxBubbles,
          pinnedChatIds
        );
      } else {
        updatedBubbles = organizeBubbles(
          [...unpinned, newBubble, ...pinned],
          maxBubbles,
          pinnedChatIds
        );
      }
    } else {
      updatedBubbles = activeBubbles.map((b) =>
        b.chatId === chatId ? { ...b, unreadCount: 0 } : b
      );
    }

    const updatedChats = chats.map((c) =>
      c.id === chatId ? { ...c, unreadCount: 0 } : c
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

    if (mode === 'whatsapp' && window.electronAPI) {
      const desiredLimit = Math.min(500, Math.max(100, unreadAtOpen + 20));
      window.electronAPI.getMessages(chatId, desiredLimit).then((msgs) => {
        if (msgs) {
          get().setMessagesForChat(chatId, msgs);
        }
        window.electronAPI?.markAsRead(chatId);
      });
    }
  },

  // 5.4 Fluxo de Interação com Bolha Existente
  toggleBubbleChat: (chatId) => {
    const {
      activePopover,
      activeChatId,
      activeBubbles,
      chats,
      mode,
      messagesByChat,
      unreadBannerByChat,
      maxBubbles,
      pinnedChatIds,
    } = get();

    if (activePopover === 'chat-window' && activeChatId === chatId) {
      const updatedBubbles = moveBubbleToMostRecent(
        activeBubbles,
        chatId,
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
      baseBubbles = moveBubbleToMostRecent(
        activeBubbles,
        activeChatId,
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
      b.chatId === chatId ? { ...b, unreadCount: 0 } : b
    );
    const updatedChats = chats.map((c) =>
      c.id === chatId ? { ...c, unreadCount: 0 } : c
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

    if (mode === 'whatsapp' && window.electronAPI) {
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
    const { activeChatId, activeBubbles, maxBubbles, pinnedChatIds } = get();
    const updatedBubbles = activeChatId
      ? moveBubbleToMostRecent(activeBubbles, activeChatId, maxBubbles, pinnedChatIds)
      : activeBubbles;

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
    const { activeBubbles, activeChatId, activePopover } = get();
    const bubble = activeBubbles.find((b) => b.chatId === chatId);
    if (bubble?.isPinned) {
      // Bloqueado: bolhas fixadas não podem ser fechadas até serem desfixadas
      return;
    }
    const updatedBubbles = activeBubbles.filter((b) => b.chatId !== chatId);
    const isClosingActiveChat =
      activePopover === 'chat-window' && activeChatId === chatId;

    set({
      activeBubbles: updatedBubbles,
      activePopover: isClosingActiveChat ? 'none' : activePopover,
      activeChatId: isClosingActiveChat ? null : activeChatId,
      replyingTo: isClosingActiveChat ? null : get().replyingTo,
      viewingImage: isClosingActiveChat ? null : get().viewingImage,
    });
  },

  // Fixar ou Desfixar conversa
  togglePinBubble: (chatId: string) => {
    const { activeBubbles, pinnedChatIds, maxBubbles } = get();
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
    const reordered = organizeBubbles(updated, maxBubbles, nextPinnedIds);

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
  sendMessage: async (text, mentions) => {
    const trimmed = text.trim();
    const { activeChatId, replyingTo, mode, messagesByChat, chats, unreadBannerByChat } =
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

    set({
      messagesByChat: {
        ...messagesByChat,
        [activeChatId]: [...currentMsgs, optimisticMsg],
      },
      unreadBannerByChat: {
        ...unreadBannerByChat,
        [activeChatId]: undefined,
      },
      chats: updatedChats,
      replyingTo: null,
    });

    if (mode === 'whatsapp' && window.electronAPI) {
      await window.electronAPI.sendMessage({
        chatId: activeChatId,
        text: trimmed,
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
    const { activeChatId, replyingTo, mode, messagesByChat, chats, unreadBannerByChat } =
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

    set({
      messagesByChat: {
        ...messagesByChat,
        [activeChatId]: [...currentMsgs, optimisticSticker],
      },
      unreadBannerByChat: {
        ...unreadBannerByChat,
        [activeChatId]: undefined,
      },
      chats: updatedChats,
      replyingTo: null,
    });

    if (mode === 'whatsapp' && window.electronAPI?.sendSticker) {
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

  // Envio de nota de voz (áudio)
  sendVoiceNote: async (durationSeconds = 12) => {
    const { activeChatId, messagesByChat, chats } = get();
    if (!activeChatId) return;

    const mins = Math.floor(durationSeconds / 60);
    const secs = String(durationSeconds % 60).padStart(2, '0');
    const durationStr = `${mins}:${secs}`;
    const timestamp = getCurrentTimeStr();

    const voiceMsg: FormattedMessage = {
      id: `voice-${Date.now()}`,
      chatId: activeChatId,
      text: '',
      timestamp,
      fromMe: true,
      type: 'audio',
      ack: 'read',
      audioData: {
        duration: durationStr,
        durationSeconds,
        senderAvatar: '/avatars/me.png',
        waveform: WAVEFORM_OUTGOING_216,
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
              ack: 'read' as const,
              duration: durationStr,
              timestamp,
            },
          }
        : c
    );

    set({
      messagesByChat: {
        ...messagesByChat,
        [activeChatId]: [...currentMsgs, voiceMsg],
      },
      chats: updatedChats,
    });
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
      soundMuted,
      userSoundPreset,
      groupSoundPreset,
    } = get();
    const isChatCurrentlyOpen =
      activePopover === 'chat-window' && activeChatId === chat.id;

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

    const bubbleExists = activeBubbles.some((b) => b.chatId === chat.id);
    const { pinnedChatIds } = get();
    const isPinned = pinnedChatIds.includes(chat.id);
    let updatedBubbles: BubbleItem[];

    if (!bubbleExists) {
      const newBubble: BubbleItem = {
        chatId: chat.id,
        name: chat.name,
        avatar: chat.avatar,
        unreadCount: isChatCurrentlyOpen ? 0 : 1,
        isPinned,
      };
      const unpinned = activeBubbles.filter((b) => !b.isPinned);
      const pinned = activeBubbles.filter((b) => b.isPinned);
      if (isPinned) {
        updatedBubbles = organizeBubbles(
          [...unpinned, ...pinned, newBubble],
          maxBubbles,
          pinnedChatIds
        );
      } else {
        updatedBubbles = organizeBubbles(
          [...unpinned, newBubble, ...pinned],
          maxBubbles,
          pinnedChatIds
        );
      }
    } else {
      const currentBubble = activeBubbles.find((b) => b.chatId === chat.id)!;
      const refreshedBubble: BubbleItem = {
        ...currentBubble,
        name: chat.name,
        avatar: chat.avatar,
        unreadCount: isChatCurrentlyOpen ? 0 : currentBubble.unreadCount + 1,
        isPinned: currentBubble.isPinned ?? isPinned,
      };
      if (isChatCurrentlyOpen) {
        // Enquanto o usuário estiver com esta conversa aberta, atualiza a bolha na mesma posição
        // para que a seta e a janela não percam o alinhamento com a bolha durante a conversa ativa.
        // A bolha só será movida para o topo dos recentes quando a conversa for fechada.
        updatedBubbles = activeBubbles.map((b) =>
          b.chatId === chat.id ? refreshedBubble : b
        );
      } else {
        const withoutCurrent = activeBubbles.filter((b) => b.chatId !== chat.id);
        if (refreshedBubble.isPinned) {
          const unpinned = withoutCurrent.filter((b) => !b.isPinned);
          const pinned = withoutCurrent.filter((b) => b.isPinned);
          updatedBubbles = organizeBubbles(
            [...unpinned, ...pinned, refreshedBubble],
            maxBubbles,
            pinnedChatIds
          );
        } else {
          const unpinned = withoutCurrent.filter((b) => !b.isPinned);
          const pinned = withoutCurrent.filter((b) => b.isPinned);
          updatedBubbles = organizeBubbles(
            [...unpinned, refreshedBubble, ...pinned],
            maxBubbles,
            pinnedChatIds
          );
        }
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
                unreadCount: isChatCurrentlyOpen ? 0 : (c.unreadCount || 0) + 1,
              }
            : c
        )
      : [chat, ...chats];

    if (isChatCurrentlyOpen && !message.fromMe) {
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

  simulateIncomingMessage: () => {
    const { chats, activeBubbles } = get();
    const sampleMessages = [
      'Bora entrar na party do Xbox agora? 🎮',
      'Acabei de resgatar 500 pontos no Rewards!',
      'Salve! Viu a promoção nova na Xbox Store?',
      'Entra aí no call, estamos esperando!',
    ];
    const randomText =
      sampleMessages[Math.floor(Math.random() * sampleMessages.length)];
    const timestamp = getCurrentTimeStr();

    const nonBubbleChat = chats.find(
      (c) => !activeBubbles.some((b) => b.chatId === c.id)
    );
    const targetChat =
      nonBubbleChat && Math.random() > 0.45
        ? nonBubbleChat
        : chats[Math.floor(Math.random() * chats.length)];

    if (!targetChat) return;

    const simulatedMessage: FormattedMessage = {
      id: `sim-${Date.now()}`,
      chatId: targetChat.id,
      senderName: targetChat.isGroup ? '~GamerXbox' : targetChat.name,
      text: randomText,
      timestamp,
      fromMe: false,
      type: 'text',
    };

    get().receiveIncomingMessage({
      chat: {
        ...targetChat,
        isMuted: false,
        lastMessage: {
          senderName: targetChat.isGroup ? '~GamerXbox' : undefined,
          text: randomText,
          mediaType: 'text',
          timestamp,
        },
      },
      message: simulatedMessage,
    });
  },

  resetDemoState: () => {
    set({
      mode: 'mock',
      userForcedMock: true,
      hasSyncedRealChats: false,
      chats: INITIAL_MOCK_CHATS,
      activeBubbles: organizeBubbles(
        INITIAL_MOCK_BUBBLES,
        get().maxBubbles,
        get().pinnedChatIds
      ),
      activePopover: 'none',
      activeChatId: null,
      messagesByChat: INITIAL_MOCK_MESSAGES,
      replyingTo: null,
    });
  },
}));
