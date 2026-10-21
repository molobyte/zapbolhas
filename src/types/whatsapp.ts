export type MessageMediaType = 'text' | 'sticker' | 'photo' | 'video' | 'audio';

export interface LastMessagePreview {
  text: string;
  senderName?: string;
  mediaType: MessageMediaType;
  fromMe?: boolean;
  ack?: 'sent' | 'delivered' | 'read';
  duration?: string;
  timestamp: string;
}

export interface ChatSummary {
  id: string;
  name: string;
  parentName?: string;
  avatar: string;
  parentAvatar?: string;
  unreadCount: number;
  isGroup: boolean;
  isMuted?: boolean;
  lastMessage: LastMessagePreview;
}

export interface QuotedMessage {
  id: string;
  author: string;
  authorColor?: string;
  text: string;
}

export interface AudioData {
  duration: string;
  durationSeconds: number;
  audioUrl?: string;
  senderAvatar: string;
  waveform: number[];
}

export interface FormattedMessage {
  id: string;
  chatId: string;
  text: string;
  timestamp: string;
  dateLabel?: string;
  fromMe: boolean;
  type: 'text' | 'audio' | 'image' | 'video' | 'sticker';
  senderName?: string;
  senderColor?: string;
  senderAvatar?: string;
  imageUrl?: string;
  videoUrl?: string;
  mediaDuration?: string;
  isHdLoaded?: boolean;
  ack?: 'sent' | 'delivered' | 'read';
  quotedMessage?: QuotedMessage;
  reaction?: string;
  audioData?: AudioData;
  mentions?: string[];
}

export type ChatBubbleSize = 'pequeno' | 'medio' | 'grande';

export const CHAT_SIZE_CONFIG: Record<
  ChatBubbleSize,
  { width: number; height: number; widthClass: string; heightClass: string; label: string }
> = {
  pequeno: {
    width: 372,
    height: 476,
    widthClass: 'w-[372px]',
    heightClass: 'h-[476px]',
    label: 'Pequeno (Atual)',
  },
  medio: {
    width: 460,
    height: 560,
    widthClass: 'w-[460px]',
    heightClass: 'h-[560px]',
    label: 'Médio',
  },
  grande: {
    width: 550,
    height: 600,
    widthClass: 'w-[550px]',
    heightClass: 'h-[600px]',
    label: 'Grande',
  },
};

export interface BubbleItem {
  chatId: string;
  name: string;
  avatar: string;
  unreadCount: number;
  isPinned?: boolean;
  lastActivity?: number;
}

export interface ViewingImageState {
  messageId?: string;
  mediaType?: 'image' | 'video';
  imageUrl: string;
  videoUrl?: string;
  caption?: string;
  senderName?: string;
  timestamp?: string;
}

export type ActivePopover = 'none' | 'chat-list' | 'chat-window' | 'qr-code' | 'settings';

export type SoundPreset = 'default' | 'crystal' | 'pop' | 'custom';

export interface DisplayInfo {
  id: number;
  label: string;
  isPrimary: boolean;
  bounds: { x: number; y: number; width: number; height: number };
}

export type ConnectionMode = 'mock' | 'whatsapp';

export type WaConnectionState = 'disconnected' | 'initializing' | 'qr' | 'authenticated' | 'ready' | 'error';

export interface IncomingMessagePayload {
  chat: ChatSummary;
  message: FormattedMessage;
}

export interface GroupParticipant {
  id: string;
  rawId?: string;
  user?: string;
  name: string;
  pushname?: string;
  avatar?: string;
  isAdmin?: boolean;
}

export interface SendMessagePayload {
  chatId: string;
  text: string;
  quotedMessageId?: string;
  mentions?: string[];
  type?: 'text' | 'audio';
  duration?: string;
  durationSeconds?: number;
}

export interface SendStickerPayload {
  chatId: string;
  stickerDataUrl: string;
  quotedMessageId?: string;
}

export interface SendMediaPayload {
  chatId: string;
  mediaDataUrl: string;
  caption?: string;
  filename?: string;
  quotedMessageId?: string;
  mentions?: string[];
  sendAudioAsVoice?: boolean;
}

export interface StickerItem {
  id: string;
  dataUrl: string;
  source: 'library' | 'whatsapp';
  name?: string;
}

export interface ElectronAPI {
  setIgnoreMouseEvents: (ignore: boolean) => void;
  getMessages: (chatId: string, limit?: number) => Promise<FormattedMessage[]>;
  getGroupParticipants?: (
    chatId: string,
    query?: string,
    limit?: number
  ) => Promise<GroupParticipant[]>;
  sendMessage: (payload: SendMessagePayload) => Promise<FormattedMessage | null>;
  sendSticker?: (payload: SendStickerPayload) => Promise<FormattedMessage | null>;
  sendMedia?: (payload: SendMediaPayload) => Promise<FormattedMessage | null>;
  selectMediaFile?: () => Promise<{
    dataUrl: string;
    mediaType: 'image' | 'video';
    filename: string;
  } | null>;
  readClipboardImage?: () => Promise<{
    dataUrl: string;
    mediaType: 'image';
    filename: string;
  } | null>;
  getWhatsAppStickers?: () => Promise<StickerItem[]>;
  getUserStickers?: () => Promise<StickerItem[]>;
  importStickersFromDisk?: () => Promise<StickerItem[]>;
  saveStickerToLibrary?: (dataUrl: string) => Promise<StickerItem | null>;
  deleteUserSticker?: (stickerId: string) => Promise<boolean>;
  markAsRead: (chatId: string) => Promise<void>;
  downloadMedia: (msgId: string) => Promise<string | null>;
  openExternalImage: (dataUrl: string) => Promise<boolean>;
  openExternalUrl?: (url: string) => Promise<boolean>;
  getSfxDataUrl?: (type: 'user' | 'group', preset?: string) => Promise<string | null>;
  selectCustomSound?: (
    type: 'user' | 'group'
  ) => Promise<{ fileName: string; dataUrl: string } | null>;
  getDisplays?: () => Promise<{ displays: DisplayInfo[]; currentDisplayId: number }>;
  setDisplay?: (displayId: number) => Promise<boolean>;
  openSettingsWindow?: () => Promise<void>;
  closeSettingsWindow?: () => void;
  broadcastSettingsUpdate?: (patch: Record<string, unknown>) => void;
  onSettingsUpdated?: (callback: (patch: Record<string, unknown>) => void) => () => void;
  logoutWhatsApp?: () => Promise<boolean>;
  refreshWhatsApp?: () => Promise<ChatSummary[]>;
  reloadWindow?: () => void;
  quitApp?: () => void;
  initWhatsApp: () => Promise<{ status: WaConnectionState; qrDataUrl?: string | null }>;
  getChats: () => Promise<ChatSummary[]>;
  getStatus: () => Promise<{ status: WaConnectionState; qrDataUrl?: string | null; error?: string | null }>;
  onQr: (callback: (qrDataUrl: string) => void) => () => void;
  onReady: (callback: () => void) => () => void;
  onChatsLoaded: (callback: (chats: ChatSummary[]) => void) => () => void;
  onMessageReceived: (callback: (payload: IncomingMessagePayload) => void) => () => void;
  onStatusChange: (callback: (status: { status: WaConnectionState; error?: string | null }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
