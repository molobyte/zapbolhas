import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  setIgnoreMouseEvents: (ignore: boolean) => {
    ipcRenderer.send('window:set-ignore-mouse', ignore);
  },

  getMessages: (chatId: string, limit?: number) => {
    return ipcRenderer.invoke('wa:get-messages', chatId, limit);
  },

  getGroupParticipants: (chatId: string, query?: string, limit?: number) => {
    return ipcRenderer.invoke('wa:get-group-participants', chatId, query, limit);
  },

  sendMessage: (payload: {
    chatId: string;
    text: string;
    quotedMessageId?: string;
    mentions?: string[];
  }) => {
    return ipcRenderer.invoke('wa:send-message', payload);
  },

  sendSticker: (payload: {
    chatId: string;
    stickerDataUrl: string;
    quotedMessageId?: string;
  }) => {
    return ipcRenderer.invoke('wa:send-sticker', payload);
  },

  sendMedia: (payload: {
    chatId: string;
    mediaDataUrl: string;
    caption?: string;
    filename?: string;
    quotedMessageId?: string;
    mentions?: string[];
  }) => {
    return ipcRenderer.invoke('wa:send-media', payload);
  },

  selectMediaFile: () => {
    return ipcRenderer.invoke('wa:select-media-file');
  },

  readClipboardImage: () => {
    return ipcRenderer.invoke('wa:read-clipboard-image');
  },

  getWhatsAppStickers: () => {
    return ipcRenderer.invoke('wa:get-whatsapp-stickers');
  },

  getUserStickers: () => {
    return ipcRenderer.invoke('wa:get-user-stickers');
  },

  importStickersFromDisk: () => {
    return ipcRenderer.invoke('wa:import-stickers');
  },

  saveStickerToLibrary: (dataUrl: string) => {
    return ipcRenderer.invoke('wa:save-sticker-to-library', dataUrl);
  },

  deleteUserSticker: (stickerId: string) => {
    return ipcRenderer.invoke('wa:delete-user-sticker', stickerId);
  },

  markAsRead: (chatId: string) => {
    return ipcRenderer.invoke('wa:mark-as-read', chatId);
  },

  downloadMedia: (msgId: string) => {
    return ipcRenderer.invoke('wa:download-media', msgId);
  },

  openExternalImage: (dataUrl: string) => {
    return ipcRenderer.invoke('wa:open-external-image', dataUrl);
  },

  openExternalUrl: (url: string) => {
    return ipcRenderer.invoke('wa:open-external-url', url);
  },

  getSfxDataUrl: (type: 'user' | 'group', preset?: string) => {
    return ipcRenderer.invoke('wa:get-sfx', type, preset);
  },

  selectCustomSound: (type: 'user' | 'group') => {
    return ipcRenderer.invoke('wa:select-custom-sound', type);
  },

  getDisplays: () => {
    return ipcRenderer.invoke('window:get-displays');
  },

  setDisplay: (displayId: number) => {
    return ipcRenderer.invoke('window:set-display', displayId);
  },

  openSettingsWindow: () => {
    return ipcRenderer.invoke('window:open-settings');
  },

  closeSettingsWindow: () => {
    ipcRenderer.send('window:close-settings');
  },

  broadcastSettingsUpdate: (patch: Record<string, unknown>) => {
    ipcRenderer.send('settings:broadcast', patch);
  },

  onSettingsUpdated: (callback: (patch: Record<string, unknown>) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, patch: Record<string, unknown>) =>
      callback(patch);
    ipcRenderer.on('settings:updated', handler);
    return () => ipcRenderer.removeListener('settings:updated', handler);
  },

  logoutWhatsApp: () => {
    return ipcRenderer.invoke('wa:logout');
  },

  refreshWhatsApp: () => {
    return ipcRenderer.invoke('wa:refresh');
  },

  reloadWindow: () => {
    ipcRenderer.send('window:reload');
  },

  quitApp: () => {
    ipcRenderer.send('app:quit');
  },

  initWhatsApp: () => {
    return ipcRenderer.invoke('wa:init');
  },

  getChats: () => {
    return ipcRenderer.invoke('wa:get-chats');
  },

  getStatus: () => {
    return ipcRenderer.invoke('wa:get-status');
  },

  onQr: (callback: (qrDataUrl: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, qrDataUrl: string) => callback(qrDataUrl);
    ipcRenderer.on('wa:qr', handler);
    return () => ipcRenderer.removeListener('wa:qr', handler);
  },

  onReady: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('wa:ready', handler);
    return () => ipcRenderer.removeListener('wa:ready', handler);
  },

  onChatsLoaded: (callback: (chats: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, chats: unknown[]) => callback(chats);
    ipcRenderer.on('wa:chats-loaded', handler);
    return () => ipcRenderer.removeListener('wa:chats-loaded', handler);
  },

  onMessageReceived: (callback: (payload: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: unknown) => callback(payload);
    ipcRenderer.on('wa:message-received', handler);
    return () => ipcRenderer.removeListener('wa:message-received', handler);
  },

  onStatusChange: (callback: (payload: { status: string; error?: string | null }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { status: string; error?: string | null }) =>
      callback(payload);
    ipcRenderer.on('wa:status-change', handler);
    return () => ipcRenderer.removeListener('wa:status-change', handler);
  },
});
