import { BrowserWindow, app } from 'electron';
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';

export interface FormattedChatSummary {
  id: string;
  name: string;
  parentName?: string;
  avatar: string;
  parentAvatar?: string;
  unreadCount: number;
  isGroup: boolean;
  isMuted?: boolean;
  lastMessage: {
    text: string;
    senderName?: string;
    mediaType: 'text' | 'sticker' | 'photo' | 'video' | 'audio';
    fromMe?: boolean;
    ack?: 'sent' | 'delivered' | 'read';
    duration?: string;
    timestamp: string;
  };
}

export interface FormattedChatMessage {
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
  quotedMessage?: {
    id: string;
    author: string;
    authorColor?: string;
    text: string;
  };
  reaction?: string;
  audioData?: {
    duration: string;
    durationSeconds: number;
    audioUrl?: string;
    senderAvatar: string;
    waveform: number[];
  };
  mentions?: string[];
}

function findBrowserExecutable(): string | undefined {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe')
      : '',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function formatTime(unixSeconds: number): string {
  if (!unixSeconds) return '';
  const date = new Date(unixSeconds * 1000);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatDateLabel(unixSeconds: number): string {
  if (!unixSeconds) return 'Hoje';
  const msgDate = new Date(unixSeconds * 1000);
  const now = new Date();

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  if (isSameDay(msgDate, now)) return 'Hoje';

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(msgDate, yesterday)) return 'Ontem';

  const dd = String(msgDate.getDate()).padStart(2, '0');
  const mm = String(msgDate.getMonth() + 1).padStart(2, '0');
  const yyyy = msgDate.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDuration(seconds: number): string {
  const s = Math.max(1, Math.round(Number(seconds) || 0));
  const mins = Math.floor(s / 60);
  const rem = String(s % 60).padStart(2, '0');
  return `${mins}:${rem}`;
}

function generateDeterministicWaveform(seed: string, length = 34): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < length; i++) {
    const val = Math.abs(Math.sin(hash + i * 0.7) * 0.75 + Math.cos(i * 1.3) * 0.25);
    bars.push(Math.max(0.18, Math.min(1, Number(val.toFixed(2)))));
  }
  return bars;
}

function pickSenderColor(seed: string): string {
  const cleanSeed = (seed || '').replace(/^~/, '').trim();
  const palette = ['#53BDEB', '#06CF9C', '#E59866', '#F472B6', '#A78BFA', '#FBBF24'];
  let hash = 0;
  for (let i = 0; i < cleanSeed.length; i++) {
    hash = (hash << 5) - hash + cleanSeed.charCodeAt(i);
    hash |= 0;
  }
  return palette[Math.abs(hash) % palette.length];
}

function createInitialsAvatarDataUrl(name: string): string {
  const clean = (name || 'WA').replace(/[^\p{L}\p{N}\s]/gu, '').trim() || 'WA';
  const parts = clean.split(/\s+/);
  const initials =
    parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : clean.slice(0, 2).toUpperCase();
  const bgColors = ['#005C4B', '#1F2C34', '#025144', '#2A3942', '#128C7E'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const bg = bgColors[Math.abs(hash) % bgColors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="${bg}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#E9EDEF" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="600">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function mapAck(ack?: number): 'sent' | 'delivered' | 'read' {
  if (ack && ack >= 3) return 'read';
  if (ack === 2) return 'delivered';
  return 'sent';
}

function logMediaDebug(msg: string) {
  try {
    const p = path.join(process.cwd(), 'media_debug.log');
    fs.appendFileSync(p, `[${new Date().toISOString()}] ${msg}\n`, 'utf8');
  } catch {}
}

export class WhatsAppService {
  private client: Client | null = null;
  private mainWindow: BrowserWindow | null = null;
  private status: 'disconnected' | 'initializing' | 'qr' | 'authenticated' | 'ready' | 'error' =
    'disconnected';
  private qrDataUrl: string | null = null;
  private lastError: string | null = null;
  private avatarCache = new Map<string, string>();
  private mediaCache = new Map<string, string>();
  private myAvatarUrl = '/avatars/me.png';
  private syncTimer: NodeJS.Timeout | null = null;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  public setMainWindow(win: BrowserWindow) {
    this.mainWindow = win;
  }

  public getStatus() {
    return {
      status: this.status,
      qrDataUrl: this.qrDataUrl,
      error: this.lastError,
    };
  }

  private emitToRenderer(channel: string, payload?: unknown) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, payload);
    }
  }

  private updateStatus(
    status: 'disconnected' | 'initializing' | 'qr' | 'authenticated' | 'ready' | 'error',
    error: string | null = null
  ) {
    this.status = status;
    this.lastError = error;
    this.emitToRenderer('wa:status-change', { status, error });
  }

  public async initialize(): Promise<{
    status: 'disconnected' | 'initializing' | 'qr' | 'authenticated' | 'ready' | 'error';
    qrDataUrl?: string | null;
  }> {
    if (
      this.client &&
      (this.status === 'initializing' ||
        this.status === 'qr' ||
        this.status === 'ready' ||
        this.status === 'authenticated')
    ) {
      if (this.status === 'ready') {
        this.getRecentChats().then((chats) => {
          if (chats.length > 0) {
            this.emitToRenderer('wa:chats-loaded', chats);
          }
        });
      }
      return { status: this.status, qrDataUrl: this.qrDataUrl };
    }

    this.updateStatus('initializing');

    try {
      const executablePath = findBrowserExecutable();
      const authDataPath = path.join(app.getPath('userData'), 'wwebjs_auth');

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: authDataPath,
        }),
        puppeteer: {
          headless: true,
          executablePath,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu',
          ],
        },
      });

      this.registerEvents();
      this.client.initialize().catch((err: Error) => {
        console.error('[WhatsAppService] Client initialization error:', err);
        this.updateStatus('error', err.message || 'Falha ao iniciar o WhatsApp Web');
      });

      return { status: this.status, qrDataUrl: this.qrDataUrl };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      this.updateStatus('error', message);
      return { status: 'error', qrDataUrl: null };
    }
  }

  private async patchWWebJSGetChatModel() {
    if (!this.client?.pupPage) return;
    try {
      // 1. Re-evaluate LoadUtils from whatsapp-web.js to guarantee our patched Utils.js is active
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { LoadUtils } = require('whatsapp-web.js/src/util/Injected/Utils');
        if (typeof LoadUtils === 'function') {
          await this.client.pupPage.evaluate(LoadUtils);
        }
      } catch (loadErr) {
        console.warn('[WhatsAppService] LoadUtils evaluation warning:', loadErr);
      }

      // 2. Wrap all memoized getters and model helpers so they never crash
      await this.client.pupPage.evaluate(() => {
        const w = window as any;
        if (!w.WWebJS) return;

        // Wrap WhatsApp Web internal getters to prevent "Data passed to getter must include an id property (it's how we memoize) but got undefined"
        const getterModules = [
          'WAWebContactGetters',
          'WAWebChatGetters',
          'WAWebFrontendContactGetters',
          'WAWebMsgGetters',
        ];

        for (const modName of getterModules) {
          try {
            const mod = typeof w.require === 'function' ? w.require(modName) : null;
            if (mod) {
              for (const fnName of Object.keys(mod)) {
                const origFn = mod[fnName];
                if (typeof origFn === 'function' && !origFn._safePatched) {
                  const safeFn = function (this: any, target: any, ...args: any[]) {
                    if (!target || (!target.id && !target._serialized && typeof target !== 'string')) {
                      return false;
                    }
                    try {
                      return origFn.call(this, target, ...args);
                    } catch (err: any) {
                      if (err && String(err).includes("it's how we memoize")) {
                        return false;
                      }
                      throw err;
                    }
                  };
                  safeFn._safePatched = true;
                  mod[fnName] = safeFn;
                }
              }
            }
          } catch {}
        }

        // 2. Wrap addAndSendMsgToChat to sanitize outgoing message objects
        try {
          const sendChatAction = typeof w.require === 'function' ? w.require('WAWebSendMsgChatAction') : null;
          if (sendChatAction && typeof sendChatAction.addAndSendMsgToChat === 'function' && !sendChatAction.addAndSendMsgToChat._safePatched) {
            const origAddAndSend = sendChatAction.addAndSendMsgToChat;
            sendChatAction.addAndSendMsgToChat = function (this: any, chat: any, message: any, ...rest: any[]) {
              if (message) {
                delete message.__x_id;
                // If message.id was wiped by spread, recover from newMsgKey or id
                if (!message.id && message.__x_id) {
                  message.id = message.__x_id;
                }
                // Ensure from is not undefined (critical for @lid and memoize getters)
                if (!message.from) {
                  try {
                    const mePrefs = typeof w.require === 'function' ? w.require('WAWebUserPrefsMeUser') : {};
                    message.from = (typeof mePrefs?.getMaybeMePnUser === 'function' ? mePrefs.getMaybeMePnUser() : null) ||
                                   (typeof mePrefs?.getMeUser === 'function' ? mePrefs.getMeUser() : null) ||
                                   (typeof w.require === 'function' ? w.require('WAWebConnModel')?.Conn?.wid : null);
                  } catch {}
                }
              }
              return origAddAndSend.call(this, chat, message, ...rest);
            };
            sendChatAction.addAndSendMsgToChat._safePatched = true;
          }
        } catch {}

        // Safe WWebJS.getChatModel
        const origGetChatModel = w.WWebJS.getChatModel;
        if (typeof origGetChatModel === 'function' && !w.WWebJS._patchedSafeGetChatModel) {
          w.WWebJS.getChatModel = async function (chat: Record<string, unknown>, opts?: unknown) {
            try {
              return await origGetChatModel.call(this, chat, opts);
            } catch {
              if (!chat) return null;
              const serialize = chat.serialize as (() => Record<string, unknown>) | undefined;
              const model = typeof serialize === 'function' ? serialize.call(chat) : { id: chat.id };
              model.isGroup = Boolean(chat.groupMetadata);
              model.formattedTitle = chat.formattedTitle || chat.name;
              return model;
            }
          };
          w.WWebJS._patchedSafeGetChatModel = true;
        }

        // Safe WWebJS.processStickerData
        const origProcessStickerData = w.WWebJS.processStickerData;
        if (typeof origProcessStickerData === 'function' && !w.WWebJS._patchedSafeProcessSticker) {
          w.WWebJS.processStickerData = async function (mediaInfo: unknown) {
            try {
              return await origProcessStickerData.call(this, mediaInfo);
            } catch {
              if (typeof w.WWebJS?.processMediaData === 'function') {
                return await w.WWebJS.processMediaData(mediaInfo, {
                  forceSticker: true,
                  forceGif: false,
                  forceVoice: false,
                  forceDocument: false,
                  forceMediaHd: false,
                  sendToChannel: false,
                  sendToStatus: false,
                });
              }
              throw new Error('Failed to process sticker media');
            }
          };
          w.WWebJS._patchedSafeProcessSticker = true;
        }

        // Safe WWebJS.getMessageModel
        const origGetMessageModel = w.WWebJS.getMessageModel;
        if (typeof origGetMessageModel === 'function' && !w.WWebJS._patchedSafeGetMsgModel) {
          w.WWebJS.getMessageModel = function (message: any) {
            if (!message) return null;
            try {
              return origGetMessageModel.call(this, message);
            } catch {
              return {
                id: message.id || { _serialized: message.id?._serialized || String(message.id) },
                ack: message.ack,
                body: message.body,
                type: message.type || 'chat',
                t: message.t,
                from: message.from,
                to: message.to,
              };
            }
          };
          w.WWebJS._patchedSafeGetMsgModel = true;
        }
      });
    } catch {
      // Ignore patch error
    }
  }

  private registerEvents() {
    if (!this.client) return;

    this.client.on('qr', async (qr: string) => {
      try {
        const dataUrl = await QRCode.toDataURL(qr, {
          width: 240,
          margin: 2,
          color: {
            dark: '#111B21',
            light: '#FFFFFF',
          },
        });
        this.qrDataUrl = dataUrl;
        this.updateStatus('qr');
        this.emitToRenderer('wa:qr', dataUrl);
      } catch (err) {
        console.error('[WhatsAppService] QR generation failed:', err);
      }
    });

    this.client.on('authenticated', () => {
      this.qrDataUrl = null;
      this.updateStatus('authenticated');
    });

    this.client.on('ready', async () => {
      this.qrDataUrl = null;
      await this.patchWWebJSGetChatModel();
      this.updateStatus('ready');
      this.emitToRenderer('wa:ready');

      try {
        if (this.client?.info?.wid?._serialized) {
          const ownPic = await this.client
            .getProfilePicUrl(this.client.info.wid._serialized)
            .catch(() => '');
          if (ownPic) this.myAvatarUrl = ownPic;
        }
      } catch {
        // Ignore own pic error
      }

      const chats = await this.getRecentChats();
      if (chats.length > 0) {
        this.emitToRenderer('wa:chats-loaded', chats);
      }

      // Sincronização leve periódica para manter contadores e novas conversas atualizados
      if (this.syncTimer) clearInterval(this.syncTimer);
      this.syncTimer = setInterval(async () => {
        if (this.status === 'ready') {
          const updatedChats = await this.getRecentChats();
          if (updatedChats.length > 0) {
            this.emitToRenderer('wa:chats-loaded', updatedChats);
          }
        }
      }, 8000);
    });

    this.client.on('message_create', async (msg) => {
      try {
        const chatId = msg.fromMe ? msg.to : msg.from;
        if (!chatId || chatId === 'status@broadcast') return;

        const allChats = await this.getRecentChats();
        const targetChat = allChats.find((c) => c.id === chatId);
        if (!targetChat) return;

        // Só dispara criação de bolha/incremento de não lidas para mensagens recebidas (!msg.fromMe)
        if (!msg.fromMe) {
          const recentMsgs = await this.getMessages(chatId, 5);
          const latestMsg = recentMsgs[recentMsgs.length - 1];
          if (latestMsg) {
            this.emitToRenderer('wa:message-received', {
              chat: targetChat,
              message: latestMsg,
            });
          }
        } else {
          this.emitToRenderer('wa:chats-loaded', allChats);
        }
      } catch (err) {
        console.error('[WhatsAppService] Error handling message_create:', err);
      }
    });

    this.client.on('disconnected', (reason: string) => {
      console.warn('[WhatsAppService] Client disconnected:', reason);
      if (this.syncTimer) {
        clearInterval(this.syncTimer);
        this.syncTimer = null;
      }
      this.qrDataUrl = null;
      this.updateStatus('disconnected', reason);
    });
  }

  public async getRecentChats(): Promise<FormattedChatSummary[]> {
    if (!this.client?.pupPage || this.status !== 'ready') {
      return [];
    }

    try {
      const rawChats = await this.client.pupPage.evaluate(async () => {
        const w = window as unknown as {
          require: (mod: string) => Record<string, any>;
        };
        const collections = w.require('WAWebCollections');
        const ChatCol = collections.Chat;
        const ProfilePicThumb = collections.ProfilePicThumb;
        const ContactCol = collections.Contact;
        const widFactory = w.require('WAWebWidFactory');
        const ContactGetters = w.require('WAWebContactGetters');
        const lidUtils = w.require('WAWebLidMigrationUtils');

        const serializeId = (val: any): string => {
          if (!val) return '';
          if (typeof val === 'string') return val;
          if (typeof val._serialized === 'string' && val._serialized) return val._serialized;
          if (typeof val.toString === 'function') {
            const s = val.toString();
            if (s && s !== '[object Object]') return s;
          }
          return '';
        };

        const loadIdbContactMap = async (): Promise<Map<string, any>> => {
          return new Promise((resolve) => {
            const timer = setTimeout(() => resolve(new Map()), 300);
            try {
              const req = indexedDB.open('model-storage');
              req.onerror = () => {
                clearTimeout(timer);
                resolve(new Map());
              };
              req.onsuccess = (e: any) => {
                try {
                  const db = e.target.result;
                  let storeName = '';
                  if (db.objectStoreNames.contains('contact')) {
                    storeName = 'contact';
                  } else if (db.objectStoreNames.contains('contacts')) {
                    storeName = 'contacts';
                  }
                  if (!storeName) {
                    clearTimeout(timer);
                    resolve(new Map());
                    return;
                  }
                  const tx = db.transaction(storeName, 'readonly');
                  const store = tx.objectStore(storeName);
                  const getAllReq = store.getAll();
                  getAllReq.onsuccess = (ev: any) => {
                    clearTimeout(timer);
                    const list = ev.target.result || [];
                    const map = new Map<string, any>();
                    for (const item of list) {
                      if (item && item.id) {
                        const strId =
                          typeof item.id === 'string'
                            ? item.id
                            : item.id._serialized || '';
                        if (strId) map.set(strId, item);
                        if (item.phoneNumber) {
                          const pn =
                            typeof item.phoneNumber === 'string'
                              ? item.phoneNumber
                              : item.phoneNumber._serialized || '';
                          if (pn) {
                            map.set(pn, item);
                            const clean = pn.split('@')[0];
                            if (clean) map.set(clean, item);
                          }
                        }
                      }
                    }
                    resolve(map);
                  };
                  getAllReq.onerror = () => {
                    clearTimeout(timer);
                    resolve(new Map());
                  };
                } catch (_) {
                  clearTimeout(timer);
                  resolve(new Map());
                }
              };
            } catch (_) {
              clearTimeout(timer);
              resolve(new Map());
            }
          });
        };

        const idbMap = await loadIdbContactMap();

        const contactIndex = new Map<string, any>();
        try {
          if (ContactCol?.getModelsArray) {
            const arr = ContactCol.getModelsArray();
            for (const cm of arr) {
              if (!cm) continue;
              const sid = serializeId(cm.id);
              if (sid) {
                contactIndex.set(sid, cm);
                const user = sid.split('@')[0];
                if (user) contactIndex.set(user, cm);
              }
              if (cm.lid) {
                const lidSid = serializeId(cm.lid);
                if (lidSid) {
                  contactIndex.set(lidSid, cm);
                  const lidUser = lidSid.split('@')[0];
                  if (lidUser) contactIndex.set(lidUser, cm);
                }
              }
              if (cm.phoneNumber) {
                const pnSid = serializeId(cm.phoneNumber);
                if (pnSid) {
                  contactIndex.set(pnSid, cm);
                  const pnUser = pnSid.split('@')[0];
                  if (pnUser) contactIndex.set(pnUser, cm);
                }
              }
            }
          }
        } catch (_) {}

        const formatPhone = (num: string) => {
          if (!num) return '';
          const digits = num.replace(/\D/g, '');
          if (digits.length === 13 && digits.startsWith('55')) {
            return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
          }
          if (digits.length === 12 && digits.startsWith('55')) {
            return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
          }
          return digits ? `+${digits}` : num;
        };

        const resolveSender = (rawAuthor: any, notifyName?: string) => {
          const authorId = serializeId(rawAuthor);
          if (!authorId && !rawAuthor) {
            const cleanNotify = (notifyName || '').replace(/^~/, '').trim();
            return {
              senderName: cleanNotify ? `~${cleanNotify}` : '',
              isSavedContact: false,
              savedName: '',
              pushname: cleanNotify,
              contact: null,
              cleanPhone: '',
              phoneNumber: '',
            };
          }

          let contact: any = null;
          if (rawAuthor && typeof rawAuthor === 'object') {
            try { contact = ContactCol?.get(rawAuthor); } catch (_) {}
          }
          if (!contact && authorId) {
            try { contact = ContactCol?.get(authorId); } catch (_) {}
            if (!contact) contact = contactIndex.get(authorId);
          }

          let pnWidStr = '';
          if (lidUtils?.toPn) {
            try {
              let targetWid = rawAuthor;
              if ((!targetWid || typeof targetWid !== 'object') && authorId && widFactory?.createWid) {
                targetWid = widFactory.createWid(authorId);
              }
              if (targetWid) {
                const pnWid = lidUtils.toPn(targetWid);
                if (pnWid) {
                  pnWidStr = serializeId(pnWid);
                  if (!contact) {
                    contact = ContactCol?.get(pnWid) || contactIndex.get(pnWidStr);
                  }
                }
              }
            } catch (_) {}
          }

          const idbItem =
            (authorId && idbMap.get(authorId)) ||
            (pnWidStr && idbMap.get(pnWidStr)) ||
            null;

          const idbPhone = idbItem?.phoneNumber
            ? serializeId(idbItem.phoneNumber) || String(idbItem.phoneNumber)
            : '';

          if (!contact && idbPhone) {
            contact =
              ContactCol?.get(idbPhone) ||
              contactIndex.get(idbPhone) ||
              contactIndex.get(idbPhone.split('@')[0]);
          }

          if (!contact && authorId) {
            const rawUser = authorId.split('@')[0];
            if (rawUser) {
              contact = contactIndex.get(rawUser);
            }
          }

          const resolvedPhone =
            idbPhone ||
            pnWidStr ||
            (authorId.includes('@c.us') ? authorId : '');
          const cleanPhone = resolvedPhone
            ? resolvedPhone.split('@')[0]
            : authorId.split('@')[0];

          let savedName = '';
          if (contact) {
            if (ContactGetters?.getName) {
              try { savedName = ContactGetters.getName(contact) || ''; } catch (_) {}
            }
            if (!savedName) {
              savedName =
                (typeof contact.get === 'function'
                  ? contact.get('name') || contact.get('displayName') || contact.get('formattedTitle')
                  : '') ||
                contact.name ||
                contact.displayName ||
                contact.formattedTitle ||
                contact.attributes?.name ||
                contact.attributes?.displayName ||
                contact.attributes?.formattedTitle ||
                '';
            }
            if (!savedName && (contact.isBusiness || contact.isEnterprise)) {
              savedName =
                contact.verifiedName ||
                contact.attributes?.verifiedName ||
                (ContactGetters?.getVerifiedName ? ContactGetters.getVerifiedName(contact) : '') ||
                '';
            }
          }

          if (!savedName && idbItem) {
            savedName = idbItem.name || idbItem.displayName || idbItem.formattedTitle || '';
          }

          const cleanSaved = savedName ? savedName.replace(/^~/, '').trim() : '';

          const digitsOnlySaved = cleanSaved.replace(/\D/g, '');
          const digitsOnlyPhone = cleanPhone.replace(/\D/g, '');
          const isPhoneEquivalent =
            cleanSaved.startsWith('+') ||
            (digitsOnlySaved.length >= 8 && digitsOnlySaved === digitsOnlyPhone) ||
            cleanSaved === authorId ||
            cleanSaved === cleanPhone;

          const isRealSavedName = Boolean(
            cleanSaved &&
            !isPhoneEquivalent &&
            (
              contact?.isAddressBookContact ||
              contact?.isMyContact ||
              contact?.name ||
              idbItem?.name ||
              (contact && cleanSaved !== contact.pushname && cleanSaved !== contact.notifyName)
            )
          );

          let pushname = '';
          if (contact) {
            if (ContactGetters?.getPushname) {
              try { pushname = ContactGetters.getPushname(contact) || ''; } catch (_) {}
            }
            if (!pushname) {
              pushname =
                (typeof contact.get === 'function'
                  ? contact.get('pushname') || contact.get('notifyName')
                  : '') ||
                contact.pushname ||
                contact.notifyName ||
                contact.attributes?.pushname ||
                contact.attributes?.notifyName ||
                '';
            }
          }
          if (!pushname && idbItem) {
            pushname = idbItem.pushname || idbItem.notifyName || '';
          }
          if (!pushname && notifyName) {
            pushname = notifyName;
          }
          const cleanPushname = pushname ? pushname.replace(/^~/, '').trim() : '';

          if (isRealSavedName) {
            return {
              senderName: cleanSaved,
              isSavedContact: true,
              savedName: cleanSaved,
              pushname: cleanPushname,
              contact,
              phoneNumber: resolvedPhone,
              cleanPhone,
            };
          }

          if (cleanPushname) {
            return {
              senderName: `~${cleanPushname}`,
              isSavedContact: false,
              savedName: '',
              pushname: cleanPushname,
              contact,
              phoneNumber: resolvedPhone,
              cleanPhone,
            };
          }

          const formattedPhone = formatPhone(cleanPhone);
          return {
            senderName: formattedPhone || cleanPhone || 'Membro',
            isSavedContact: false,
            savedName: '',
            pushname: '',
            contact,
            phoneNumber: resolvedPhone,
            cleanPhone,
          };
        };

        const myIds = new Set<string>();
        try {
          const mePrefs = (typeof w.require === 'function' ? w.require('WAWebUserPrefsMeUser') : null) || {};
          const connMod = (typeof w.require === 'function' ? w.require('WAWebConnModel') : null) || {};
          const addMe = (val: any) => {
            if (!val) return;
            const sid = serializeId(val);
            if (sid) {
              myIds.add(sid);
              const u = sid.split('@')[0];
              if (u) myIds.add(u);
            }
          };
          addMe(mePrefs.getMaybeMePnUser?.());
          addMe(mePrefs.getMaybeMeLidUser?.());
          addMe(mePrefs.getMeUser?.());
          addMe(connMod.Conn?.wid);
        } catch (_) {}

        const formatMentionsInText = (
          rawText: string,
          rawMsg?: any
        ): { text: string; mentions: string[] } => {
          if (!rawText || typeof rawText !== 'string' || !rawText.includes('@')) {
            return { text: rawText || '', mentions: [] };
          }

          let formatted = rawText;
          const collectedMentions: string[] = [];

          const mentionedJids: any[] = Array.isArray(rawMsg?.mentionedJidList)
            ? rawMsg.mentionedJidList
            : [];

          for (const item of mentionedJids) {
            if (!item) continue;
            const sid = serializeId(item);
            const user = sid ? sid.split('@')[0] : (typeof item === 'string' ? item : item.user);
            if (!user) continue;

            let displayName = '';
            if (myIds.has(user) || myIds.has(sid)) {
              displayName = 'Você';
            } else {
              const senderInfo = resolveSender(item);
              const name =
                senderInfo.savedName ||
                senderInfo.pushname ||
                senderInfo.senderName;
              displayName = name ? name.replace(/^~/, '').trim() : '';
            }

            if (displayName) {
              if (!collectedMentions.includes(displayName)) {
                collectedMentions.push(displayName);
              }
              const escapedUser = user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const regWithServer = new RegExp(`@${escapedUser}@(lid|c\\.us)(?=[^a-zA-Z0-9_]|$)`, 'g');
              const regUserOnly = new RegExp(`@${escapedUser}(?=[^a-zA-Z0-9_]|$)`, 'g');
              formatted = formatted.replace(regWithServer, `@${displayName}`);
              formatted = formatted.replace(regUserOnly, `@${displayName}`);
            }
          }

          const groupMentions: any[] = Array.isArray(rawMsg?.groupMentions) ? rawMsg.groupMentions : [];
          for (const gm of groupMentions) {
            if (!gm) continue;
            const gJid = serializeId(gm.groupJid);
            const gUser = gJid ? gJid.split('@')[0] : '';
            const subject = gm.groupSubject || '';
            if (gUser && subject) {
              if (!collectedMentions.includes(subject)) {
                collectedMentions.push(subject);
              }
              const escaped = gUser.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const reg = new RegExp(`@${escaped}(?=[^a-zA-Z0-9_]|$)`, 'g');
              formatted = formatted.replace(reg, `@${subject}`);
            }
          }

          formatted = formatted.replace(/@(\d{7,20})(?=[^a-zA-Z0-9_]|$)/g, (match, digits) => {
            if (myIds.has(digits)) {
              if (!collectedMentions.includes('Você')) {
                collectedMentions.push('Você');
              }
              return '@Você';
            }

            const contact = contactIndex.get(digits) || idbMap.get(digits);
            if (contact) {
              const senderInfo = resolveSender(contact);
              const name = senderInfo.savedName || senderInfo.pushname || senderInfo.senderName;
              if (name) {
                const cleanName = name.replace(/^~/, '').trim();
                if (cleanName && cleanName !== digits && !cleanName.startsWith('+')) {
                  if (!collectedMentions.includes(cleanName)) {
                    collectedMentions.push(cleanName);
                  }
                  return `@${cleanName}`;
                }
              }
            }

            try {
              if (widFactory?.createWid) {
                const widLid = widFactory.createWid(`${digits}@lid`);
                const senderLid = resolveSender(widLid);
                const nameLid = senderLid.savedName || senderLid.pushname || senderLid.senderName;
                if (nameLid) {
                  const clean = nameLid.replace(/^~/, '').trim();
                  if (clean && clean !== digits && !clean.startsWith('+')) {
                    if (!collectedMentions.includes(clean)) {
                      collectedMentions.push(clean);
                    }
                    return `@${clean}`;
                  }
                }

                const widPn = widFactory.createWid(`${digits}@c.us`);
                const senderPn = resolveSender(widPn);
                const namePn = senderPn.savedName || senderPn.pushname || senderPn.senderName;
                if (namePn) {
                  const clean = namePn.replace(/^~/, '').trim();
                  if (clean && clean !== digits && !clean.startsWith('+')) {
                    if (!collectedMentions.includes(clean)) {
                      collectedMentions.push(clean);
                    }
                    return `@${clean}`;
                  }
                }
              }
            } catch {}

            const formattedDigits = formatPhone(digits);
            if (formattedDigits && formattedDigits !== digits) {
              return `@${formattedDigits}`;
            }

            return match;
          });

          return { text: formatted, mentions: collectedMentions };
        };

        const allChats: any[] = ChatCol.getModelsArray()
          .filter((c: any) => {
            const cid = serializeId(c.id);
            return (
              !c.archive &&
              cid &&
              cid !== 'status@broadcast' &&
              !cid.endsWith('@newsletter')
            );
          })
          .sort((a: any, b: any) => (b.t || 0) - (a.t || 0))
          .slice(0, 25);

        const results = [];

        for (const c of allChats) {
          const id: string = serializeId(c.id);
          const contactModel = ContactCol?.get(id) || c.contact;

          const msgs: any[] = (c.msgs?.getModelsArray?.() || []).filter(
            (m: any) =>
              !m.isNotification &&
              m.type !== 'e2e_notification' &&
              m.type !== 'gp2' &&
              m.type !== 'notification_template'
          );
          const lastMsg = msgs[msgs.length - 1];
          const lastIncomingMsg = [...msgs].reverse().find((m: any) => !m.id?.fromMe);

          const isGroup = Boolean(c.groupMetadata || c.id?.server === 'g.us' || id.endsWith('@g.us'));
          const name: string =
            c.formattedTitle ||
            c.name ||
            contactModel?.name ||
            contactModel?.pushname ||
            contactModel?.verifiedName ||
            (!isGroup && lastIncomingMsg?.notifyName) ||
            c.id?.user ||
            'Contato';

          let avatar = '';
          try {
            const pic = ProfilePicThumb?.get(id) || c.contact?.profilePicThumb;
            avatar = pic?.eurl || pic?.img || pic?.imgFull || '';
            if (!avatar && ProfilePicThumb?.find) {
              const found: any = await Promise.race([
                ProfilePicThumb.find(c.id),
                new Promise((r) => setTimeout(() => r(null), 350)),
              ]);
              avatar = found?.eurl || found?.img || '';
            }
          } catch {
            avatar = '';
          }

          const isMuted = Boolean(c.mute?.expiration && c.mute.expiration !== 0);
          const unreadCount = Number(c.unreadCount || 0);

          let senderName = '';
          if (lastMsg && !lastMsg.id?.fromMe && isGroup) {
            const info = resolveSender(lastMsg.author, lastMsg.notifyName);
            senderName = info.senderName;
          }

          const rawType = String(lastMsg?.type || 'chat');
          const rawBody =
            rawType === 'chat'
              ? String(lastMsg?.body || '')
              : String(lastMsg?.caption || '');
          const formattedLastMsg = formatMentionsInText(rawBody, lastMsg);

          results.push({
            id,
            name,
            avatar,
            unreadCount,
            isGroup,
            isMuted,
            timestamp: Number(lastMsg?.t || c.t || 0),
            lastMsgType: rawType,
            lastMsgBody: formattedLastMsg.text,
            lastMsgFromMe: Boolean(lastMsg?.id?.fromMe),
            lastMsgAck: Number(lastMsg?.ack || 0),
            lastMsgDuration: Number(lastMsg?.duration || 0),
            senderName,
          });
        }

        return results;
      });

      return rawChats.map((raw) => {
        if (raw.avatar) {
          this.avatarCache.set(raw.id, raw.avatar);
        }
        const avatar =
          raw.avatar ||
          this.avatarCache.get(raw.id) ||
          createInitialsAvatarDataUrl(raw.name);

        let mediaType: 'text' | 'sticker' | 'photo' | 'video' | 'audio' = 'text';
        let text = raw.lastMsgBody || '';
        let duration: string | undefined;

        if (raw.lastMsgType === 'sticker') {
          mediaType = 'sticker';
          text = 'Figurinha';
        } else if (raw.lastMsgType === 'image') {
          mediaType = 'photo';
          text = raw.lastMsgBody || 'Foto';
        } else if (
          raw.lastMsgType === 'video' ||
          raw.lastMsgType === 'ptv' ||
          raw.lastMsgType === 'gif'
        ) {
          mediaType = 'video';
          text = raw.lastMsgBody || 'Vídeo';
        } else if (raw.lastMsgType === 'ptt' || raw.lastMsgType === 'audio') {
          mediaType = 'audio';
          duration = formatDuration(raw.lastMsgDuration || 15);
          text = duration;
        } else if (raw.lastMsgType === 'revoked') {
          text = '🚫 Mensagem apagada';
        } else if (raw.lastMsgType === 'call_log') {
          text = '📞 Chamada de voz';
        } else if (raw.lastMsgType === 'document') {
          text = raw.lastMsgBody || '📄 Documento';
        }

        return {
          id: raw.id,
          name: raw.name,
          avatar,
          unreadCount: raw.unreadCount,
          isGroup: raw.isGroup,
          isMuted: raw.isMuted,
          lastMessage: {
            text,
            senderName: raw.senderName || undefined,
            mediaType,
            fromMe: raw.lastMsgFromMe,
            ack: mapAck(raw.lastMsgAck),
            duration,
            timestamp: formatTime(raw.timestamp),
          },
        };
      });
    } catch (err) {
      console.error('[WhatsAppService] Error in getRecentChats:', err);
      return [];
    }
  }

  public async getMessages(chatId: string, limit = 100): Promise<FormattedChatMessage[]> {
    if (!this.client?.pupPage || this.status !== 'ready') {
      return [];
    }

    try {
      const chatAvatar =
        this.avatarCache.get(chatId) || createInitialsAvatarDataUrl(chatId);

      const rawMsgs = await this.client.pupPage.evaluate(
        async (targetChatId: string, maxLimit: number) => {
          const w = window as unknown as {
            require: (mod: string) => Record<string, any>;
          };
          const serializeId = (val: any): string => {
            if (!val) return '';
            if (typeof val === 'string') return val;
            if (typeof val._serialized === 'string' && val._serialized) return val._serialized;
            if (typeof val.toString === 'function') {
              const s = val.toString();
              if (s && s !== '[object Object]') return s;
            }
            return '';
          };

          const collections = w.require('WAWebCollections');
          const ChatCol = collections.Chat;
          const ContactCol = collections.Contact;
          const ProfilePicThumb = collections.ProfilePicThumb;
          const widFactory = w.require('WAWebWidFactory');
          const ContactGetters = w.require('WAWebContactGetters');
          const lidUtils = w.require('WAWebLidMigrationUtils');

          const loadIdbContactMap = async (): Promise<Map<string, any>> => {
            return new Promise((resolve) => {
              const timer = setTimeout(() => resolve(new Map()), 300);
              try {
                const req = indexedDB.open('model-storage');
                req.onerror = () => {
                  clearTimeout(timer);
                  resolve(new Map());
                };
                req.onsuccess = (e: any) => {
                  try {
                    const db = e.target.result;
                    let storeName = '';
                    if (db.objectStoreNames.contains('contact')) {
                      storeName = 'contact';
                    } else if (db.objectStoreNames.contains('contacts')) {
                      storeName = 'contacts';
                    }
                    if (!storeName) {
                      clearTimeout(timer);
                      resolve(new Map());
                      return;
                    }
                    const tx = db.transaction(storeName, 'readonly');
                    const store = tx.objectStore(storeName);
                    const getAllReq = store.getAll();
                    getAllReq.onsuccess = (ev: any) => {
                      clearTimeout(timer);
                      const list = ev.target.result || [];
                      const map = new Map<string, any>();
                      for (const item of list) {
                        if (item && item.id) {
                          const strId =
                            typeof item.id === 'string'
                              ? item.id
                              : item.id._serialized || '';
                          if (strId) map.set(strId, item);
                          if (item.phoneNumber) {
                            const pn =
                              typeof item.phoneNumber === 'string'
                                ? item.phoneNumber
                                : item.phoneNumber._serialized || '';
                            if (pn) {
                              map.set(pn, item);
                              const clean = pn.split('@')[0];
                              if (clean) map.set(clean, item);
                            }
                          }
                        }
                      }
                      resolve(map);
                    };
                    getAllReq.onerror = () => {
                      clearTimeout(timer);
                      resolve(new Map());
                    };
                  } catch (_) {
                    clearTimeout(timer);
                    resolve(new Map());
                  }
                };
              } catch (_) {
                clearTimeout(timer);
                resolve(new Map());
              }
            });
          };

          const idbMap = await loadIdbContactMap();

          const contactIndex = new Map<string, any>();
          try {
            if (ContactCol?.getModelsArray) {
              const arr = ContactCol.getModelsArray();
              for (const cm of arr) {
                if (!cm) continue;
                const sid = serializeId(cm.id);
                if (sid) {
                  contactIndex.set(sid, cm);
                  const user = sid.split('@')[0];
                  if (user) contactIndex.set(user, cm);
                }
                if (cm.lid) {
                  const lidSid = serializeId(cm.lid);
                  if (lidSid) {
                    contactIndex.set(lidSid, cm);
                    const lidUser = lidSid.split('@')[0];
                    if (lidUser) contactIndex.set(lidUser, cm);
                  }
                }
                if (cm.phoneNumber) {
                  const pnSid = serializeId(cm.phoneNumber);
                  if (pnSid) {
                    contactIndex.set(pnSid, cm);
                    const pnUser = pnSid.split('@')[0];
                    if (pnUser) contactIndex.set(pnUser, cm);
                  }
                }
              }
            }
          } catch (_) {}

          const formatPhone = (num: string) => {
            if (!num) return '';
            const digits = num.replace(/\D/g, '');
            if (digits.length === 13 && digits.startsWith('55')) {
              return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
            }
            if (digits.length === 12 && digits.startsWith('55')) {
              return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
            }
            return digits ? `+${digits}` : num;
          };

          const resolveSender = (rawAuthor: any, notifyName?: string) => {
            const authorId = serializeId(rawAuthor);
            if (!authorId && !rawAuthor) {
              const cleanNotify = (notifyName || '').replace(/^~/, '').trim();
              return {
                senderName: cleanNotify ? `~${cleanNotify}` : '',
                isSavedContact: false,
                savedName: '',
                pushname: cleanNotify,
                contact: null,
                cleanPhone: '',
                phoneNumber: '',
              };
            }

            let contact: any = null;
            if (rawAuthor && typeof rawAuthor === 'object') {
              try { contact = ContactCol?.get(rawAuthor); } catch (_) {}
            }
            if (!contact && authorId) {
              try { contact = ContactCol?.get(authorId); } catch (_) {}
              if (!contact) contact = contactIndex.get(authorId);
            }

            let pnWidStr = '';
            if (lidUtils?.toPn) {
              try {
                let targetWid = rawAuthor;
                if ((!targetWid || typeof targetWid !== 'object') && authorId && widFactory?.createWid) {
                  targetWid = widFactory.createWid(authorId);
                }
                if (targetWid) {
                  const pnWid = lidUtils.toPn(targetWid);
                  if (pnWid) {
                    pnWidStr = serializeId(pnWid);
                    if (!contact) {
                      contact = ContactCol?.get(pnWid) || contactIndex.get(pnWidStr);
                    }
                  }
                }
              } catch (_) {}
            }

            const idbItem =
              (authorId && idbMap.get(authorId)) ||
              (pnWidStr && idbMap.get(pnWidStr)) ||
              null;

            const idbPhone = idbItem?.phoneNumber
              ? serializeId(idbItem.phoneNumber) || String(idbItem.phoneNumber)
              : '';

            if (!contact && idbPhone) {
              contact =
                ContactCol?.get(idbPhone) ||
                contactIndex.get(idbPhone) ||
                contactIndex.get(idbPhone.split('@')[0]);
            }

            if (!contact && authorId) {
              const rawUser = authorId.split('@')[0];
              if (rawUser) {
                contact = contactIndex.get(rawUser);
              }
            }

            const resolvedPhone =
              idbPhone ||
              pnWidStr ||
              (authorId.includes('@c.us') ? authorId : '');
            const cleanPhone = resolvedPhone
              ? resolvedPhone.split('@')[0]
              : authorId.split('@')[0];

            let savedName = '';
            if (contact) {
              if (ContactGetters?.getName) {
                try { savedName = ContactGetters.getName(contact) || ''; } catch (_) {}
              }
              if (!savedName) {
                savedName =
                  (typeof contact.get === 'function'
                    ? contact.get('name') || contact.get('displayName') || contact.get('formattedTitle')
                    : '') ||
                  contact.name ||
                  contact.displayName ||
                  contact.formattedTitle ||
                  contact.attributes?.name ||
                  contact.attributes?.displayName ||
                  contact.attributes?.formattedTitle ||
                  '';
              }
              if (!savedName && (contact.isBusiness || contact.isEnterprise)) {
                savedName =
                  contact.verifiedName ||
                  contact.attributes?.verifiedName ||
                  (ContactGetters?.getVerifiedName ? ContactGetters.getVerifiedName(contact) : '') ||
                  '';
              }
            }

            if (!savedName && idbItem) {
              savedName = idbItem.name || idbItem.displayName || idbItem.formattedTitle || '';
            }

            const cleanSaved = savedName ? savedName.replace(/^~/, '').trim() : '';

            const digitsOnlySaved = cleanSaved.replace(/\D/g, '');
            const digitsOnlyPhone = cleanPhone.replace(/\D/g, '');
            const isPhoneEquivalent =
              cleanSaved.startsWith('+') ||
              (digitsOnlySaved.length >= 8 && digitsOnlySaved === digitsOnlyPhone) ||
              cleanSaved === authorId ||
              cleanSaved === cleanPhone;

            const isRealSavedName = Boolean(
              cleanSaved &&
              !isPhoneEquivalent &&
              (
                contact?.isAddressBookContact ||
                contact?.isMyContact ||
                contact?.name ||
                idbItem?.name ||
                (contact && cleanSaved !== contact.pushname && cleanSaved !== contact.notifyName)
              )
            );

            let pushname = '';
            if (contact) {
              if (ContactGetters?.getPushname) {
                try { pushname = ContactGetters.getPushname(contact) || ''; } catch (_) {}
              }
              if (!pushname) {
                pushname =
                  (typeof contact.get === 'function'
                    ? contact.get('pushname') || contact.get('notifyName')
                    : '') ||
                  contact.pushname ||
                  contact.notifyName ||
                  contact.attributes?.pushname ||
                  contact.attributes?.notifyName ||
                  '';
              }
            }
            if (!pushname && idbItem) {
              pushname = idbItem.pushname || idbItem.notifyName || '';
            }
            if (!pushname && notifyName) {
              pushname = notifyName;
            }
            const cleanPushname = pushname ? pushname.replace(/^~/, '').trim() : '';

            if (isRealSavedName) {
              return {
                senderName: cleanSaved,
                isSavedContact: true,
                savedName: cleanSaved,
                pushname: cleanPushname,
                contact,
                phoneNumber: resolvedPhone,
                cleanPhone,
              };
            }

            if (cleanPushname) {
              return {
                senderName: `~${cleanPushname}`,
                isSavedContact: false,
                savedName: '',
                pushname: cleanPushname,
                contact,
                phoneNumber: resolvedPhone,
                cleanPhone,
              };
            }

            const formattedPhone = formatPhone(cleanPhone);
            return {
              senderName: formattedPhone || cleanPhone || 'Membro',
              isSavedContact: false,
              savedName: '',
              pushname: '',
              contact,
              phoneNumber: resolvedPhone,
              cleanPhone,
            };
          };

          const myIds = new Set<string>();
          try {
            const mePrefs = (typeof w.require === 'function' ? w.require('WAWebUserPrefsMeUser') : null) || {};
            const connMod = (typeof w.require === 'function' ? w.require('WAWebConnModel') : null) || {};
            const addMe = (val: any) => {
              if (!val) return;
              const sid = serializeId(val);
              if (sid) {
                myIds.add(sid);
                const u = sid.split('@')[0];
                if (u) myIds.add(u);
              }
            };
            addMe(mePrefs.getMaybeMePnUser?.());
            addMe(mePrefs.getMaybeMeLidUser?.());
            addMe(mePrefs.getMeUser?.());
            addMe(connMod.Conn?.wid);
          } catch (_) {}

          const formatMentionsInText = (
            rawText: string,
            rawMsg?: any
          ): { text: string; mentions: string[] } => {
            if (!rawText || typeof rawText !== 'string' || !rawText.includes('@')) {
              return { text: rawText || '', mentions: [] };
            }

            let formatted = rawText;
            const collectedMentions: string[] = [];

            const mentionedJids: any[] = Array.isArray(rawMsg?.mentionedJidList)
              ? rawMsg.mentionedJidList
              : [];

            for (const item of mentionedJids) {
              if (!item) continue;
              const sid = serializeId(item);
              const user = sid ? sid.split('@')[0] : (typeof item === 'string' ? item : item.user);
              if (!user) continue;

              let displayName = '';
              if (myIds.has(user) || myIds.has(sid)) {
                displayName = 'Você';
              } else {
                const senderInfo = resolveSender(item);
                const name =
                  senderInfo.savedName ||
                  senderInfo.pushname ||
                  senderInfo.senderName;
                displayName = name ? name.replace(/^~/, '').trim() : '';
              }

              if (displayName) {
                if (!collectedMentions.includes(displayName)) {
                  collectedMentions.push(displayName);
                }
                const escapedUser = user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regWithServer = new RegExp(`@${escapedUser}@(lid|c\\.us)(?=[^a-zA-Z0-9_]|$)`, 'g');
                const regUserOnly = new RegExp(`@${escapedUser}(?=[^a-zA-Z0-9_]|$)`, 'g');
                formatted = formatted.replace(regWithServer, `@${displayName}`);
                formatted = formatted.replace(regUserOnly, `@${displayName}`);
              }
            }

            const groupMentions: any[] = Array.isArray(rawMsg?.groupMentions) ? rawMsg.groupMentions : [];
            for (const gm of groupMentions) {
              if (!gm) continue;
              const gJid = serializeId(gm.groupJid);
              const gUser = gJid ? gJid.split('@')[0] : '';
              const subject = gm.groupSubject || '';
              if (gUser && subject) {
                if (!collectedMentions.includes(subject)) {
                  collectedMentions.push(subject);
                }
                const escaped = gUser.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const reg = new RegExp(`@${escaped}(?=[^a-zA-Z0-9_]|$)`, 'g');
                formatted = formatted.replace(reg, `@${subject}`);
              }
            }

            formatted = formatted.replace(/@(\d{7,20})(?=[^a-zA-Z0-9_]|$)/g, (match, digits) => {
              if (myIds.has(digits)) {
                if (!collectedMentions.includes('Você')) {
                  collectedMentions.push('Você');
                }
                return '@Você';
              }

              const contact = contactIndex.get(digits) || idbMap.get(digits);
              if (contact) {
                const senderInfo = resolveSender(contact);
                const name = senderInfo.savedName || senderInfo.pushname || senderInfo.senderName;
                if (name) {
                  const cleanName = name.replace(/^~/, '').trim();
                  if (cleanName && cleanName !== digits && !cleanName.startsWith('+')) {
                    if (!collectedMentions.includes(cleanName)) {
                      collectedMentions.push(cleanName);
                    }
                    return `@${cleanName}`;
                  }
                }
              }

              try {
                if (widFactory?.createWid) {
                  const widLid = widFactory.createWid(`${digits}@lid`);
                  const senderLid = resolveSender(widLid);
                  const nameLid = senderLid.savedName || senderLid.pushname || senderLid.senderName;
                  if (nameLid) {
                    const clean = nameLid.replace(/^~/, '').trim();
                    if (clean && clean !== digits && !clean.startsWith('+')) {
                      if (!collectedMentions.includes(clean)) {
                        collectedMentions.push(clean);
                      }
                      return `@${clean}`;
                    }
                  }

                  const widPn = widFactory.createWid(`${digits}@c.us`);
                  const senderPn = resolveSender(widPn);
                  const namePn = senderPn.savedName || senderPn.pushname || senderPn.senderName;
                  if (namePn) {
                    const clean = namePn.replace(/^~/, '').trim();
                    if (clean && clean !== digits && !clean.startsWith('+')) {
                      if (!collectedMentions.includes(clean)) {
                        collectedMentions.push(clean);
                      }
                      return `@${clean}`;
                    }
                  }
                }
              } catch {}

              const formattedDigits = formatPhone(digits);
              if (formattedDigits && formattedDigits !== digits) {
                return `@${formattedDigits}`;
              }

              return match;
            });

            return { text: formatted, mentions: collectedMentions };
          };
          const chat =
            ChatCol.get(targetChatId) ||
            ChatCol.getModelsArray().find((c: any) => serializeId(c.id) === targetChatId);
          if (!chat) return [];

          const isValidMsg = (m: any) =>
            !m.isNotification &&
            m.type !== 'e2e_notification' &&
            m.type !== 'gp2' &&
            m.type !== 'notification_template' &&
            m.type !== 'call_log';

          // Garante que todas as mensagens não lidas (+ margem de contexto acima da barra) sejam carregadas,
          // além de respeitar qualquer limite maior solicitado ao rolar para o topo
          const effectiveLimit = Math.min(
            500,
            Math.max(maxLimit || 100, (chat.unreadCount || 0) + 20)
          );
          const maxLoadPasses = Math.min(15, Math.ceil(effectiveLimit / 18) + 2);

          try {
            const loadMsgs = w.require('WAWebChatLoadMessages');
            for (let i = 0; i < maxLoadPasses; i++) {
              const currentValid = (chat.msgs?.getModelsArray?.() || []).filter(isValidMsg);
              if (currentValid.length >= effectiveLimit) break;
              const loaded = await Promise.race([
                loadMsgs.loadEarlierMsgs({ chat }),
                new Promise((r) => setTimeout(() => r(null), 1500)),
              ]);
              if (!loaded || !loaded.length) break;
            }
          } catch {
            // Continue with already cached messages in chat.msgs
          }

          const isGroup = Boolean(
            chat.groupMetadata || chat.id?.server === 'g.us' || targetChatId.endsWith('@g.us')
          );
          const msgs: any[] = (chat.msgs?.getModelsArray?.() || [])
            .filter(isValidMsg)
            .slice(-effectiveLimit);

          const authorAvatarMap: Record<string, string> = {};
          if (isGroup) {
            const uniqueAuthors = new Map<string, any>();
            for (const m of msgs) {
              if (!m.id?.fromMe && m.author) {
                const aid = serializeId(m.author);
                if (aid && !uniqueAuthors.has(aid)) {
                  uniqueAuthors.set(aid, m.author);
                }
              }
            }
            await Promise.all(
              Array.from(uniqueAuthors.entries()).map(async ([aid, rawAuthor]) => {
                try {
                  const c = ContactCol?.get(aid);
                  const pic =
                    ProfilePicThumb?.get(aid) ||
                    ProfilePicThumb?.get(rawAuthor) ||
                    c?.profilePicThumb;
                  let url = pic?.eurl || pic?.img || pic?.imgFull || '';
                  if (!url && ProfilePicThumb?.find) {
                    const found: any = await Promise.race([
                      ProfilePicThumb.find(rawAuthor),
                      new Promise((r) => setTimeout(() => r(null), 180)),
                    ]);
                    url = found?.eurl || found?.img || found?.imgFull || '';
                  }
                  if (url) {
                    authorAvatarMap[aid] = url;
                  }
                } catch {
                  // Ignore individual member avatar error
                }
              })
            );
          }

          return msgs.map((m: any) => {
            const id = serializeId(m.id) || `${m.t}-${Math.random()}`;
            const fromMe = Boolean(m.id?.fromMe);
            const rawType = String(m.type || 'chat');

            let senderName = '';
            let authorId = '';
            let senderAvatar = '';
            if (!fromMe && isGroup) {
              authorId = serializeId(m.author);
              const info = resolveSender(m.author, m.notifyName);
              senderName = info.senderName;
              senderAvatar = authorId ? authorAvatarMap[authorId] || '' : '';
            } else if (!fromMe && !isGroup) {
              const chatContact = ContactCol?.get(targetChatId) || chat.contact;
              senderName =
                chat.formattedTitle ||
                chat.name ||
                chatContact?.name ||
                m.notifyName ||
                chatContact?.pushname ||
                '';
            }

            let quoted: { id: string; author: string; text: string } | null = null;
            if (m.quotedMsg) {
              let qAuthor = 'Contato';
              if (m.quotedMsg.id?.fromMe) {
                qAuthor = 'Você';
              } else {
                const qInfo = resolveSender(m.quotedParticipant, m.quotedMsg.notifyName);
                qAuthor = qInfo.senderName || chat.formattedTitle || 'Contato';
              }
              const qType = String(m.quotedMsg.type || 'chat');
              const qText =
                qType === 'chat'
                  ? String(m.quotedMsg.body || '')
                  : qType === 'ptt' || qType === 'audio'
                  ? '🎤 Mensagem de voz'
                  : qType === 'sticker'
                  ? '💟 Figurinha'
                  : String(m.quotedMsg.caption || '📷 Foto');
              const qFormatted = formatMentionsInText(qText, m.quotedMsg);

              quoted = {
                id: String(m.quotedStanzaID || id),
                author: qAuthor,
                text: qFormatted.text,
              };
            }

            // Extrai preview imediato de m.body ou m.mediaData.preview
            let thumbBase64 = '';
            if (
              rawType === 'image' ||
              rawType === 'video' ||
              rawType === 'ptv' ||
              rawType === 'gif' ||
              rawType === 'sticker'
            ) {
              const rawPreview =
                (typeof m.body === 'string' && m.body.length > 20 ? m.body : '') ||
                (typeof m.mediaData?.preview?._b64 === 'string' ? m.mediaData.preview._b64 : '') ||
                (typeof m.preview === 'string' ? m.preview : '');

              if (rawPreview) {
                if (rawPreview.startsWith('data:')) {
                  thumbBase64 = rawPreview;
                } else {
                  const mime = rawType === 'sticker' ? 'image/webp' : 'image/jpeg';
                  thumbBase64 = `data:${mime};base64,${rawPreview}`;
                }
              }
            }

            const rawBodyText =
              rawType === 'chat'
                ? String(m.body || '')
                : rawType === 'revoked'
                ? '🚫 Mensagem apagada'
                : String(m.caption || '');

            const { text, mentions } = formatMentionsInText(rawBodyText, m);

            return {
              id,
              rawType,
              text,
              mentions,
              t: Number(m.t || 0),
              fromMe,
              isGroup,
              authorId,
              senderAvatar,
              ack: Number(m.ack || 3),
              duration: Number(m.duration || 0),
              senderName,
              quoted,
              thumbBase64,
            };
          });
        },
        chatId,
        limit
      );

      // Pré-decripta em alta definição (HD) as mídias recentes de imagem/figurinha que ainda não estão em cache
      const uncachedMediaIds = rawMsgs
        .filter(
          (m) =>
            (m.rawType === 'image' || m.rawType === 'sticker') &&
            m.id &&
            !this.mediaCache.has(m.id)
        )
        .slice(-6)
        .map((m) => m.id);

      if (uncachedMediaIds.length > 0) {
        await Promise.all(
          uncachedMediaIds.map((id) => this.downloadMedia(id).catch(() => null))
        );
      }

      let lastDateLabel = '';

      return rawMsgs.map((m) => {
        let type: 'text' | 'audio' | 'image' | 'video' | 'sticker' = 'text';
        if (m.rawType === 'ptt' || m.rawType === 'audio') {
          type = 'audio';
        } else if (m.rawType === 'image') {
          type = 'image';
        } else if (
          m.rawType === 'video' ||
          m.rawType === 'ptv' ||
          m.rawType === 'gif'
        ) {
          type = 'video';
        } else if (m.rawType === 'sticker') {
          type = 'sticker';
        }

        const currentLabel = formatDateLabel(m.t);
        const dateLabel = currentLabel !== lastDateLabel ? currentLabel : undefined;
        lastDateLabel = currentLabel;

        const cachedMedia = this.mediaCache.get(m.id);

        let resolvedSenderAvatar: string | undefined;
        if (!m.fromMe && m.isGroup) {
          if (m.senderAvatar && m.authorId) {
            this.avatarCache.set(m.authorId, m.senderAvatar);
          }
          const cleanName = (m.senderName || 'Membro').replace(/^~/, '').trim();
          resolvedSenderAvatar =
            m.senderAvatar ||
            (m.authorId ? this.avatarCache.get(m.authorId) : undefined) ||
            createInitialsAvatarDataUrl(cleanName || 'M');
        }

        let audioData: FormattedChatMessage['audioData'];
        if (type === 'audio') {
          const durSec = Math.max(1, m.duration || 15);
          audioData = {
            duration: formatDuration(durSec),
            durationSeconds: durSec,
            audioUrl: cachedMedia || undefined,
            senderAvatar: m.fromMe
              ? this.myAvatarUrl
              : resolvedSenderAvatar || chatAvatar,
            waveform: generateDeterministicWaveform(m.id),
          };
        }

        return {
          id: m.id,
          chatId,
          text: m.text,
          mentions: m.mentions,
          timestamp: formatTime(m.t),
          dateLabel,
          fromMe: m.fromMe,
          type,
          senderName: m.senderName || undefined,
          senderColor: m.senderName ? pickSenderColor(m.senderName) : undefined,
          senderAvatar: resolvedSenderAvatar,
          imageUrl:
            type === 'video'
              ? m.thumbBase64 || undefined
              : cachedMedia || m.thumbBase64 || undefined,
          videoUrl: type === 'video' ? cachedMedia || undefined : undefined,
          mediaDuration:
            type === 'video' && m.duration > 0
              ? formatDuration(m.duration)
              : undefined,
          isHdLoaded: Boolean(cachedMedia),
          ack: mapAck(m.ack),
          quotedMessage: m.quoted
            ? {
                id: m.quoted.id,
                author: m.quoted.author,
                authorColor: pickSenderColor(m.quoted.author),
                text: m.quoted.text,
              }
            : undefined,
          audioData,
        };
      });
    } catch (err) {
      console.error('[WhatsAppService] Error in getMessages for', chatId, err);
      return [];
    }
  }

  public async downloadMedia(msgId: string): Promise<string | null> {
    if (this.mediaCache.has(msgId)) {
      return this.mediaCache.get(msgId)!;
    }
    if (!this.client?.pupPage || this.status !== 'ready') {
      return null;
    }

    try {
      const result = await this.client.pupPage.evaluate(async (targetMsgId: string) => {
        const w = window as unknown as {
          require: (mod: string) => Record<string, any>;
          WWebJS?: {
            arrayBufferToBase64Async?: (buf: ArrayBuffer) => Promise<string>;
          };
        };

        const serializeId = (val: any): string => {
          if (!val) return '';
          if (typeof val === 'string') return val;
          if (typeof val._serialized === 'string' && val._serialized) return val._serialized;
          if (typeof val.toString === 'function') {
            const s = val.toString();
            if (s && s !== '[object Object]') return s;
          }
          return '';
        };

        const MsgCol = w.require('WAWebCollections').Msg;
        const msg =
          MsgCol.get(targetMsgId) ||
          MsgCol.getModelsArray().find((m: any) => serializeId(m.id) === targetMsgId) ||
          (await MsgCol.getMessagesById?.([targetMsgId]))?.messages?.[0];

        if (!msg) return null;

        try {
          if (msg.mediaData && msg.mediaData.mediaStage !== 'RESOLVED') {
            await Promise.race([
              msg.downloadMedia({
                downloadEvenIfExpensive: true,
                rmrReason: 1,
                isUserInitiated: true,
              }),
              new Promise((r) => setTimeout(r, 15000)),
            ]);
          }
        } catch {
          // Proceed to downloadAndMaybeDecrypt
        }

        const declaredMime =
          msg.mimetype ||
          (msg.type === 'sticker'
            ? 'image/webp'
            : msg.type === 'ptt' || msg.type === 'audio'
            ? 'audio/ogg; codecs=opus'
            : msg.type === 'video' || msg.type === 'ptv' || msg.type === 'gif'
            ? 'video/mp4'
            : 'image/jpeg');

        const mockQpl = {
          addAnnotations() {
            return this;
          },
          addPoint() {
            return this;
          },
        };

        const decryptedMedia: ArrayBuffer = await w
          .require('WAWebDownloadManager')
          .downloadManager.downloadAndMaybeDecrypt({
            directPath: msg.directPath,
            encFilehash: msg.encFilehash,
            filehash: msg.filehash,
            mediaKey: msg.mediaKey,
            mediaKeyTimestamp: msg.mediaKeyTimestamp,
            type: msg.type,
            mimetype: declaredMime,
            signal: new AbortController().signal,
            downloadQpl: mockQpl,
          });

        if (decryptedMedia && decryptedMedia.byteLength > 0) {
          let base64 = '';
          if (w.WWebJS?.arrayBufferToBase64Async) {
            base64 = await w.WWebJS.arrayBufferToBase64Async(decryptedMedia);
          } else {
            const bytes = new Uint8Array(decryptedMedia);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            base64 = btoa(binary);
          }
          if (base64) {
            const cleanMime = declaredMime.split(';')[0].trim();
            return `data:${cleanMime};base64,${base64}`;
          }
        }

        return null;
      }, msgId);

      if (result) {
        this.mediaCache.set(msgId, result);
        return result;
      }
      return null;
    } catch (err) {
      console.error('[WhatsAppService] Error downloading media for', msgId, err);
      return null;
    }
  }

  public async sendMessage(payload: {
    chatId: string;
    text: string;
    quotedMessageId?: string;
    mentions?: string[];
  }): Promise<FormattedChatMessage | null> {
    if (!this.client || this.status !== 'ready') {
      return null;
    }
    try {
      await this.patchWWebJSGetChatModel();
      const options: { quotedMessageId?: string; mentions?: string[] } = {};
      if (payload.quotedMessageId) {
        options.quotedMessageId = payload.quotedMessageId;
      }
      if (payload.mentions && payload.mentions.length > 0) {
        options.mentions = payload.mentions
          .map((m) => {
            if (typeof m === 'string' && !m.includes('@')) {
              return `${m.replace(/\D/g, '')}@c.us`;
            }
            return m;
          })
          .filter(Boolean);
      }
      try {
        await this.client.sendMessage(payload.chatId, payload.text, options);
      } catch (sendErr) {
        console.error('[WhatsAppService] Falha ao enviar mensagem com opções:', sendErr);
        if (options.mentions) {
          delete options.mentions;
          await this.client.sendMessage(payload.chatId, payload.text, options);
        } else {
          throw sendErr;
        }
      }
      const recent = await this.getMessages(payload.chatId, 5);
      return recent[recent.length - 1] || null;
    } catch (err) {
      console.error('[WhatsAppService] Error sending message:', err);
      return null;
    }
  }

  public async getGroupParticipants(
    chatId: string,
    query: string = '',
    limit: number = 10
  ): Promise<
    Array<{
      id: string;
      rawId?: string;
      user?: string;
      name: string;
      pushname?: string;
      avatar?: string;
      isAdmin?: boolean;
    }>
  > {
    if (!this.client?.pupPage || this.status !== 'ready') {
      return [];
    }
    try {
      const raw = await this.client.pupPage.evaluate(
        async (targetChatId: string, queryStr: string, maxLimit: number) => {
          try {
            const w = window as any;
            if (typeof w.require !== 'function') return [];
            const collections = w.require('WAWebCollections');
            if (!collections) return [];
            const ChatCol = collections.Chat;
            const ContactCol = collections.Contact;
            const ProfilePicThumb = collections.ProfilePicThumb;

            const serializeId = (val: any): string => {
              if (!val) return '';
              if (typeof val === 'string') return val;
              if (typeof val._serialized === 'string' && val._serialized) return val._serialized;
              return '';
            };

            const chat =
              ChatCol?.get?.(targetChatId) ||
              ChatCol?.getModelsArray?.()?.find?.((c: any) => serializeId(c.id) === targetChatId);

            if (!chat) return [];

            let groupMetadata =
              chat.groupMetadata || (chat.id?.server === 'g.us' ? chat.groupMetadata : null);

            if (!groupMetadata) {
              const GroupMetadataCol =
                collections.GroupMetadata || collections.WAWebGroupMetadataCollection;
              groupMetadata = GroupMetadataCol?.get?.(targetChatId);
            }

            const getParticipantsList = (meta: any) => {
              if (!meta) return [];
              if (typeof meta.participants?.getModelsArray === 'function') {
                return meta.participants.getModelsArray();
              }
              if (Array.isArray(meta.participants)) {
                return meta.participants;
              }
              if (typeof meta.getModelsArray === 'function') {
                return meta.getModelsArray();
              }
              return [];
            };

            let rawList: any[] = getParticipantsList(groupMetadata);

            if (rawList.length === 0) {
              try {
                const widFactory = w.require('WAWebWidFactory');
                const chatWid = widFactory?.createWid?.(targetChatId);
                const GroupMetadataCol =
                  collections.GroupMetadata || collections.WAWebGroupMetadataCollection;
                if (GroupMetadataCol?.update && chatWid) {
                  await GroupMetadataCol.update(chatWid);
                  groupMetadata =
                    chat.groupMetadata || GroupMetadataCol.get?.(targetChatId) || groupMetadata;
                  rawList = getParticipantsList(groupMetadata);
                }
              } catch (_) {}
            }

            if (rawList.length === 0) return [];

            const normalize = (str: any) =>
              typeof str === 'string'
                ? str
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toLowerCase()
                    .trim()
                : '';

            const q = normalize(queryStr);
            const safeLimit = Math.max(1, Math.min(Number(maxLimit) || 10, 50));

            type Candidate = {
              id: string;
              rawId: string;
              user: string;
              name: string;
              pushname: string;
              isAdmin: boolean;
              score: number;
              contact: any;
            };

            const candidates: Candidate[] = [];

            // Carrega os contatos salvos no IndexedDB do WhatsApp Web (contém pushname e telefone de todos os membros)
            const idbMap: Map<string, any> = await new Promise((resolve) => {
              const timer = setTimeout(() => resolve(new Map()), 1500);
              try {
                const req = window.indexedDB.open('model-storage');
                req.onerror = () => {
                  clearTimeout(timer);
                  resolve(new Map());
                };
                req.onsuccess = (e: any) => {
                  try {
                    const db = e.target.result;
                    let storeName = '';
                    if (db.objectStoreNames.contains('contact')) {
                      storeName = 'contact';
                    } else if (db.objectStoreNames.contains('contacts')) {
                      storeName = 'contacts';
                    }

                    if (!storeName) {
                      clearTimeout(timer);
                      resolve(new Map());
                      return;
                    }

                    const tx = db.transaction(storeName, 'readonly');
                    const store = tx.objectStore(storeName);
                    const getAllReq = store.getAll();
                    getAllReq.onsuccess = (ev: any) => {
                      clearTimeout(timer);
                      const list = ev.target.result || [];
                      const map = new Map<string, any>();
                      for (const item of list) {
                        if (item && item.id) {
                          const strId =
                            typeof item.id === 'string'
                              ? item.id
                              : item.id._serialized || '';
                          if (strId) map.set(strId, item);
                          if (item.phoneNumber) {
                            map.set(item.phoneNumber, item);
                          }
                        }
                      }
                      resolve(map);
                    };
                    getAllReq.onerror = () => {
                      clearTimeout(timer);
                      resolve(new Map());
                    };
                  } catch (_) {
                    clearTimeout(timer);
                    resolve(new Map());
                  }
                };
              } catch (_) {
                clearTimeout(timer);
                resolve(new Map());
              }
            });

            const widFactory = w.require('WAWebWidFactory');
            const ContactGetters = w.require('WAWebContactGetters');
            const lidUtils = w.require('WAWebLidMigrationUtils');

            const contactIndex = new Map<string, any>();
            try {
              if (ContactCol?.getModelsArray) {
                const arr = ContactCol.getModelsArray();
                for (const cm of arr) {
                  if (!cm) continue;
                  const sid = serializeId(cm.id);
                  if (sid) {
                    contactIndex.set(sid, cm);
                    const user = sid.split('@')[0];
                    if (user) contactIndex.set(user, cm);
                  }
                  if (cm.lid) {
                    const lidSid = serializeId(cm.lid);
                    if (lidSid) {
                      contactIndex.set(lidSid, cm);
                      const lidUser = lidSid.split('@')[0];
                      if (lidUser) contactIndex.set(lidUser, cm);
                    }
                  }
                  if (cm.phoneNumber) {
                    const pnSid = serializeId(cm.phoneNumber);
                    if (pnSid) {
                      contactIndex.set(pnSid, cm);
                      const pnUser = pnSid.split('@')[0];
                      if (pnUser) contactIndex.set(pnUser, cm);
                    }
                  }
                }
              }
            } catch (_) {}

            const formatPhone = (num: string) => {
              if (!num) return '';
              const digits = num.replace(/\D/g, '');
              if (digits.length === 13 && digits.startsWith('55')) {
                return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`;
              }
              if (digits.length === 12 && digits.startsWith('55')) {
                return `+55 ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`;
              }
              return digits ? `+${digits}` : num;
            };

            const resolveSender = (rawAuthor: any, notifyName?: string) => {
              const authorId = serializeId(rawAuthor);
              if (!authorId && !rawAuthor) {
                const cleanNotify = (notifyName || '').replace(/^~/, '').trim();
                return {
                  senderName: cleanNotify ? `~${cleanNotify}` : '',
                  isSavedContact: false,
                  savedName: '',
                  pushname: cleanNotify,
                  contact: null,
                  cleanPhone: '',
                  phoneNumber: '',
                };
              }

              let contact: any = null;
              if (rawAuthor && typeof rawAuthor === 'object') {
                try { contact = ContactCol?.get(rawAuthor); } catch (_) {}
              }
              if (!contact && authorId) {
                try { contact = ContactCol?.get(authorId); } catch (_) {}
                if (!contact) contact = contactIndex.get(authorId);
              }

              let pnWidStr = '';
              if (lidUtils?.toPn) {
                try {
                  let targetWid = rawAuthor;
                  if ((!targetWid || typeof targetWid !== 'object') && authorId && widFactory?.createWid) {
                    targetWid = widFactory.createWid(authorId);
                  }
                  if (targetWid) {
                    const pnWid = lidUtils.toPn(targetWid);
                    if (pnWid) {
                      pnWidStr = serializeId(pnWid);
                      if (!contact) {
                        contact = ContactCol?.get(pnWid) || contactIndex.get(pnWidStr);
                      }
                    }
                  }
                } catch (_) {}
              }

              const idbItem =
                (authorId && idbMap.get(authorId)) ||
                (pnWidStr && idbMap.get(pnWidStr)) ||
                null;

              const idbPhone = idbItem?.phoneNumber
                ? serializeId(idbItem.phoneNumber) || String(idbItem.phoneNumber)
                : '';

              if (!contact && idbPhone) {
                contact =
                  ContactCol?.get(idbPhone) ||
                  contactIndex.get(idbPhone) ||
                  contactIndex.get(idbPhone.split('@')[0]);
              }

              if (!contact && authorId) {
                const rawUser = authorId.split('@')[0];
                if (rawUser) {
                  contact = contactIndex.get(rawUser);
                }
              }

              const resolvedPhone =
                idbPhone ||
                pnWidStr ||
                (authorId.includes('@c.us') ? authorId : '');
              const cleanPhone = resolvedPhone
                ? resolvedPhone.split('@')[0]
                : authorId.split('@')[0];

              let savedName = '';
              if (contact) {
                if (ContactGetters?.getName) {
                  try { savedName = ContactGetters.getName(contact) || ''; } catch (_) {}
                }
                if (!savedName) {
                  savedName =
                    (typeof contact.get === 'function'
                      ? contact.get('name') || contact.get('displayName') || contact.get('formattedTitle')
                      : '') ||
                    contact.name ||
                    contact.displayName ||
                    contact.formattedTitle ||
                    contact.attributes?.name ||
                    contact.attributes?.displayName ||
                    contact.attributes?.formattedTitle ||
                    '';
                }
                if (!savedName && (contact.isBusiness || contact.isEnterprise)) {
                  savedName =
                    contact.verifiedName ||
                    contact.attributes?.verifiedName ||
                    (ContactGetters?.getVerifiedName ? ContactGetters.getVerifiedName(contact) : '') ||
                    '';
                }
              }

              if (!savedName && idbItem) {
                savedName = idbItem.name || idbItem.displayName || idbItem.formattedTitle || '';
              }

              const cleanSaved = savedName ? savedName.replace(/^~/, '').trim() : '';

              const digitsOnlySaved = cleanSaved.replace(/\D/g, '');
              const digitsOnlyPhone = cleanPhone.replace(/\D/g, '');
              const isPhoneEquivalent =
                cleanSaved.startsWith('+') ||
                (digitsOnlySaved.length >= 8 && digitsOnlySaved === digitsOnlyPhone) ||
                cleanSaved === authorId ||
                cleanSaved === cleanPhone;

              const isRealSavedName = Boolean(
                cleanSaved &&
                !isPhoneEquivalent &&
                (
                  contact?.isAddressBookContact ||
                  contact?.isMyContact ||
                  contact?.name ||
                  idbItem?.name ||
                  (contact && cleanSaved !== contact.pushname && cleanSaved !== contact.notifyName)
                )
              );

              let pushname = '';
              if (contact) {
                if (ContactGetters?.getPushname) {
                  try { pushname = ContactGetters.getPushname(contact) || ''; } catch (_) {}
                }
                if (!pushname) {
                  pushname =
                    (typeof contact.get === 'function'
                      ? contact.get('pushname') || contact.get('notifyName')
                      : '') ||
                    contact.pushname ||
                    contact.notifyName ||
                    contact.attributes?.pushname ||
                    contact.attributes?.notifyName ||
                    '';
                }
              }
              if (!pushname && idbItem) {
                pushname = idbItem.pushname || idbItem.notifyName || '';
              }
              if (!pushname && notifyName) {
                pushname = notifyName;
              }
              const cleanPushname = pushname ? pushname.replace(/^~/, '').trim() : '';

              if (isRealSavedName) {
                return {
                  senderName: cleanSaved,
                  isSavedContact: true,
                  savedName: cleanSaved,
                  pushname: cleanPushname,
                  contact,
                  phoneNumber: resolvedPhone,
                  cleanPhone,
                };
              }

              if (cleanPushname) {
                return {
                  senderName: `~${cleanPushname}`,
                  isSavedContact: false,
                  savedName: '',
                  pushname: cleanPushname,
                  contact,
                  phoneNumber: resolvedPhone,
                  cleanPhone,
                };
              }

              const formattedPhone = formatPhone(cleanPhone);
              return {
                senderName: formattedPhone || cleanPhone || 'Membro',
                isSavedContact: false,
                savedName: '',
                pushname: '',
                contact,
                phoneNumber: resolvedPhone,
                cleanPhone,
              };
            };

            for (const p of rawList) {
              const rawId = serializeId(p.id || p);
              if (!rawId) continue;

              const info = resolveSender(p.id || p, p.pushname || p.notifyName);
              const canonicalId = info.phoneNumber || rawId;
              let validCanonical = canonicalId;
              if (validCanonical && !validCanonical.includes('@')) {
                validCanonical = `${validCanonical.replace(/\D/g, '')}@c.us`;
              }
              const userTag = (rawId || validCanonical).split('@')[0];
              const formattedPhone = formatPhone(info.cleanPhone);

              let displayName = '';
              let displayPushname = '';

              if (info.isSavedContact && info.savedName) {
                displayName = info.savedName;
                displayPushname = info.pushname && info.pushname !== info.savedName ? info.pushname : '';
              } else {
                displayName = info.pushname || formattedPhone || 'Membro';
                displayPushname = info.pushname ? formattedPhone : '';
              }

              const isAdmin = Boolean(
                p.isAdmin || p.isSuperAdmin || p.admin === 'admin' || p.admin === 'superadmin'
              );

              if (!q) {
                candidates.push({
                  id: validCanonical,
                  rawId,
                  user: userTag,
                  name: displayName,
                  pushname: displayPushname,
                  isAdmin,
                  score: isAdmin ? 10 : 0,
                  contact: null,
                });
                if (candidates.length >= safeLimit) {
                  break;
                }
                continue;
              }

              const normDisplay = normalize(displayName);
              const normPush = normalize(info.pushname || displayPushname);
              const normSaved = normalize(info.savedName);
              const cleanPhone = info.cleanPhone;
              const cleanId = canonicalId.toLowerCase();

              let score = 0;
              if (
                normDisplay.startsWith(q) ||
                normPush.startsWith(q) ||
                normSaved.startsWith(q)
              ) {
                score = 100;
              } else if (
                normDisplay.includes(' ' + q) ||
                normPush.includes(' ' + q) ||
                normSaved.includes(' ' + q)
              ) {
                score = 80;
              } else if (
                normDisplay.includes(q) ||
                normPush.includes(q) ||
                normSaved.includes(q)
              ) {
                score = 60;
              } else if (cleanPhone.startsWith(q)) {
                score = 30;
              } else if (cleanId.includes(q) || cleanPhone.includes(q)) {
                score = 20;
              }

              if (score > 0) {
                if (isAdmin) score += 5;
                candidates.push({
                  id: validCanonical,
                  rawId,
                  user: userTag,
                  name: displayName,
                  pushname: displayPushname,
                  isAdmin,
                  score,
                  contact: null,
                });
              }
            }

            if (q) {
              candidates.sort((a, b) => b.score - a.score);
            }

            const topSelected = candidates.slice(0, safeLimit);

            const results: any[] = [];
            for (const item of topSelected) {
              let avatar = '';
              try {
                let pic =
                  ProfilePicThumb?.get?.(item.id) ||
                  ProfilePicThumb?.get?.(item.rawId);
                if (!pic && widFactory?.createWid) {
                  if (item.id) pic = ProfilePicThumb?.get?.(widFactory.createWid(item.id));
                  if (!pic && item.rawId) pic = ProfilePicThumb?.get?.(widFactory.createWid(item.rawId));
                }
                avatar = pic?.eurl || (pic?.img && pic.img.length < 32768 ? pic.img : '') || '';
              } catch (_) {
                avatar = '';
              }

              results.push({
                id: item.id,
                name: item.name,
                pushname: item.pushname,
                avatar,
                isAdmin: item.isAdmin,
              });
            }

            return results;
          } catch (err) {
            console.error('[WhatsAppService] evaluate getGroupParticipants error:', err);
            return [];
          }
        },
        chatId,
        query || '',
        limit || 10
      );

      return (raw || []).map((p: any) => {
        const cleanName = (p.name || 'Membro').replace(/^~/, '').trim();
        const avatar =
          p.avatar ||
          this.avatarCache.get(p.id) ||
          createInitialsAvatarDataUrl(cleanName);
        if (p.avatar) {
          this.avatarCache.set(p.id, p.avatar);
        }
        return {
          id: p.id,
          rawId: p.rawId || p.id,
          user: p.user || (p.rawId || p.id).split('@')[0],
          name: cleanName,
          pushname: p.pushname || undefined,
          avatar,
          isAdmin: Boolean(p.isAdmin),
        };
      });
    } catch (err) {
      console.error('[WhatsAppService] Error getting group participants:', err);
      return [];
    }
  }

  public async sendSticker(payload: {
    chatId: string;
    stickerDataUrl: string;
    quotedMessageId?: string;
  }): Promise<FormattedChatMessage | null> {
    if (!this.client || this.status !== 'ready') {
      return null;
    }
    try {
      const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(
        payload.stickerDataUrl
      );
      if (!match) {
        return null;
      }
      const mimetype = match[1];
      const base64Data = match[2];
      const media = new MessageMedia(mimetype, base64Data, 'sticker.webp');

      const options: {
        sendMediaAsSticker: boolean;
        stickerName: string;
        stickerAuthor: string;
        quotedMessageId?: string;
      } = {
        sendMediaAsSticker: true,
        stickerName: 'WhatsApp Bubbles',
        stickerAuthor: 'Minha Biblioteca',
      };
      if (payload.quotedMessageId) {
        options.quotedMessageId = payload.quotedMessageId;
      }

      await this.patchWWebJSGetChatModel();
      const sent = await this.client.sendMessage(payload.chatId, media, options);
      const sentId = (sent as unknown as { id?: { _serialized?: string } })?.id?._serialized;
      if (sentId) {
        this.mediaCache.set(sentId, payload.stickerDataUrl);
      }

      const recent = await this.getMessages(payload.chatId, 5);
      const latest = recent[recent.length - 1] || null;
      if (latest && latest.type === 'sticker' && !latest.imageUrl) {
        latest.imageUrl = payload.stickerDataUrl;
        latest.isHdLoaded = true;
      }
      return latest;
    } catch (err) {
      console.error('[WhatsAppService] Error sending sticker:', err);
      return null;
    }
  }

  public async sendMedia(payload: {
    chatId: string;
    mediaDataUrl: string;
    caption?: string;
    filename?: string;
    quotedMessageId?: string;
    mentions?: string[];
  }): Promise<FormattedChatMessage | null> {
    if (!this.client || this.status !== 'ready') {
      const msg = `[WhatsAppService] sendMedia abortado: cliente não está pronto (status: ${this.status})`;
      console.warn(msg);
      logMediaDebug(msg);
      return null;
    }
    try {
      let mimetype = 'image/jpeg';
      let base64Data = payload.mediaDataUrl;

      if (payload.mediaDataUrl.startsWith('data:')) {
        const commaIdx = payload.mediaDataUrl.indexOf(',');
        if (commaIdx !== -1) {
          const header = payload.mediaDataUrl.slice(0, commaIdx);
          base64Data = payload.mediaDataUrl.slice(commaIdx + 1);
          const mimeMatch = /^data:([^;]+)/i.exec(header);
          if (mimeMatch) {
            mimetype = mimeMatch[1].trim();
          }
        }
      } else if (fs.existsSync(payload.mediaDataUrl)) {
        const ext = (path.extname(payload.mediaDataUrl) || '').toLowerCase();
        if (ext === '.png') mimetype = 'image/png';
        else if (ext === '.webp') mimetype = 'image/webp';
        else if (ext === '.gif') mimetype = 'image/gif';
        else if (ext === '.mp4') mimetype = 'video/mp4';
        else if (ext === '.mov') mimetype = 'video/quicktime';
        else mimetype = 'image/jpeg';
        const buf = fs.readFileSync(payload.mediaDataUrl);
        base64Data = buf.toString('base64');
      }
      base64Data = base64Data.replace(/[\r\n\s]/g, '');

      if (!base64Data) {
        const msg = '[WhatsAppService] sendMedia: base64Data está vazio após extração';
        console.error(msg);
        logMediaDebug(msg);
        return null;
      }

      const defaultFilename = mimetype.startsWith('video/')
        ? 'video.mp4'
        : mimetype.includes('png')
        ? 'image.png'
        : mimetype.includes('webp')
        ? 'image.webp'
        : 'image.jpg';
      const filename = payload.filename || defaultFilename;
      const media = new MessageMedia(mimetype, base64Data, filename);

      const options: {
        caption?: string;
        quotedMessageId?: string;
        mentions?: string[];
      } = {};
      if (payload.caption) {
        options.caption = payload.caption;
      }
      if (payload.quotedMessageId) {
        options.quotedMessageId = payload.quotedMessageId;
      }
      if (payload.mentions && payload.mentions.length > 0) {
        options.mentions = payload.mentions
          .map((m) => {
            if (typeof m === 'string' && !m.includes('@')) {
              return `${m.replace(/\D/g, '')}@c.us`;
            }
            return m;
          })
          .filter(Boolean);
      }

      const infoMsg = `Iniciando envio de mídia (${mimetype}, ${filename}, ${base64Data.length} chars) para ${payload.chatId}`;
      console.log(`[WhatsAppService] ${infoMsg}`);
      logMediaDebug(infoMsg);

      await this.patchWWebJSGetChatModel();

      let sent: any;
      try {
        sent = await this.client.sendMessage(payload.chatId, media, options);
      } catch (sendErr) {
        console.error('[WhatsAppService] Falha ao enviar mídia com opções:', sendErr);
        logMediaDebug(`Falha sendMessage com opções: ${String(sendErr)}`);
        if (options.quotedMessageId) {
          console.log('[WhatsAppService] Tentando reenviar sem quotedMessageId...');
          logMediaDebug('Tentando reenviar sem quotedMessageId...');
          delete options.quotedMessageId;
          sent = await this.client.sendMessage(payload.chatId, media, options);
        } else {
          throw sendErr;
        }
      }

      console.log('[WhatsAppService] Mídia enviada com sucesso no WhatsApp!');
      logMediaDebug('Mídia enviada com sucesso no WhatsApp!');
      const sentId = (sent as unknown as { id?: { _serialized?: string } })?.id?._serialized;
      if (sentId) {
        this.mediaCache.set(sentId, payload.mediaDataUrl);
      }

      const recent = await this.getMessages(payload.chatId, 5);
      const latest = recent[recent.length - 1] || null;
      if (latest && (latest.type === 'image' || latest.type === 'video')) {
        if (latest.type === 'image' && !latest.imageUrl) {
          latest.imageUrl = payload.mediaDataUrl;
          latest.isHdLoaded = true;
        } else if (latest.type === 'video' && !latest.videoUrl) {
          latest.videoUrl = payload.mediaDataUrl;
          latest.isHdLoaded = true;
        }
      }
      return latest;
    } catch (err: any) {
      const errDetail = err?.stack || String(err);
      console.error('[WhatsAppService] Error sending media:', errDetail);
      logMediaDebug(`Error sending media: ${errDetail}`);
      return null;
    }
  }

  public async getWhatsAppStickers(): Promise<
    Array<{ id: string; dataUrl: string; source: 'whatsapp' }>
  > {
    if (!this.client?.pupPage || this.status !== 'ready') {
      return [];
    }

    try {
      const candidates = await this.client.pupPage.evaluate(async () => {
        const w = window as unknown as {
          require: (mod: string) => Record<string, any>;
        };
        const serializeId = (val: any): string => {
          if (!val) return '';
          if (typeof val === 'string') return val;
          if (typeof val._serialized === 'string' && val._serialized) return val._serialized;
          if (typeof val.toString === 'function') {
            const s = val.toString();
            if (s && s !== '[object Object]') return s;
          }
          return '';
        };

        const collections = w.require('WAWebCollections');
        const seenHashes = new Set<string>();
        const found: Array<{ id: string; filehash: string; thumb: string }> = [];

        // 1. Verifica mensagens de figurinha nas conversas carregadas (mais recentes primeiro)
        const MsgCol = collections?.Msg;
        const allMsgs: any[] = (MsgCol?.getModelsArray?.() || [])
          .filter((m: any) => m?.type === 'sticker')
          .sort((a: any, b: any) => (b.t || 0) - (a.t || 0));

        for (const m of allMsgs) {
          const msgId = serializeId(m.id);
          if (!msgId) continue;
          const hash = String(m.filehash || m.encFilehash || msgId);
          if (seenHashes.has(hash)) continue;
          seenHashes.add(hash);

          let thumb = '';
          const rawPreview =
            (typeof m.body === 'string' && m.body.length > 20 ? m.body : '') ||
            (typeof m.mediaData?.preview?._b64 === 'string' ? m.mediaData.preview._b64 : '');
          if (rawPreview) {
            thumb = rawPreview.startsWith('data:')
              ? rawPreview
              : `data:image/webp;base64,${rawPreview}`;
          }

          found.push({ id: msgId, filehash: hash, thumb });
          if (found.length >= 28) break;
        }

        return found;
      });

      const resolved: Array<{ id: string; dataUrl: string; source: 'whatsapp' }> = [];

      // Decripta as figurinhas encontradas (em paralelo limitado)
      await Promise.all(
        candidates.map(async (item) => {
          try {
            const hdDataUrl =
              this.mediaCache.get(item.id) || (await this.downloadMedia(item.id));
            const finalUrl = hdDataUrl || item.thumb;
            if (finalUrl) {
              resolved.push({
                id: `wa-${item.filehash.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || item.id}`,
                dataUrl: finalUrl,
                source: 'whatsapp',
              });
            }
          } catch {
            if (item.thumb) {
              resolved.push({
                id: `wa-${item.id}`,
                dataUrl: item.thumb,
                source: 'whatsapp',
              });
            }
          }
        })
      );

      return resolved;
    } catch (err) {
      console.error('[WhatsAppService] Error in getWhatsAppStickers:', err);
      return [];
    }
  }

  public async markAsRead(chatId: string): Promise<void> {
    if (!this.client?.pupPage || this.status !== 'ready') {
      return;
    }
    try {
      await this.client.pupPage.evaluate(async (targetChatId: string) => {
        const w = window as unknown as {
          require: (mod: string) => Record<string, any>;
          WWebJS?: {
            getChat?: (id: string, opts?: { getAsModel?: boolean }) => Promise<any>;
            sendSeen?: (id: string) => Promise<boolean>;
          };
        };

        const serializeId = (val: any): string => {
          if (!val) return '';
          if (typeof val === 'string') return val;
          if (typeof val._serialized === 'string' && val._serialized) return val._serialized;
          if (typeof val.toString === 'function') {
            const s = val.toString();
            if (s && s !== '[object Object]') return s;
          }
          return '';
        };

        try {
          const Stream = w.require('WAWebStreamModel')?.Stream;
          Stream?.markAvailable?.();

          const ChatCol = w.require('WAWebCollections').Chat;
          let chat =
            (await w.WWebJS?.getChat?.(targetChatId, { getAsModel: false })) ||
            ChatCol.get(targetChatId) ||
            ChatCol.getModelsArray().find((c: any) => serializeId(c.id) === targetChatId);

          if (!chat) {
            const wid = w.require('WAWebWidFactory')?.createWid?.(targetChatId);
            if (wid) {
              chat = ChatCol.get(wid);
            }
          }

          if (!chat) return;

          // Importante: NÃO zerar chat.unreadCount antes de chamar sendSeen,
          // pois o WhatsApp Web verifica se chat.unreadCount > 0 para enviar o pacote
          // de confirmação de leitura (read receipt / app state sync) para o servidor e celular!
          const seenMod = w.require('WAWebUpdateUnreadChatAction');
          if (seenMod?.sendSeen) {
            await seenMod.sendSeen({
              chat,
              threadId: undefined,
            });
          } else if (w.WWebJS?.sendSeen) {
            await w.WWebJS.sendSeen(targetChatId);
          }

          // Garante atualização local após o envio da confirmação ao servidor
          chat.unreadCount = 0;
        } catch (err) {
          console.error('[WhatsApp Web] sendSeen internal error:', err);
        }
      }, chatId);
    } catch (err) {
      console.error('[WhatsAppService] Error in markAsRead:', err);
    }
  }

  public async refresh(): Promise<FormattedChatSummary[]> {
    console.log('[WhatsAppService] Manual refresh requested...');
    this.mediaCache.clear();
    this.avatarCache.clear();

    if (!this.client || this.status !== 'ready') {
      console.log('[WhatsAppService] Client not ready, attempting re-initialization...');
      this.initialize().catch(() => null);
      return [];
    }

    try {
      const chats = await this.getRecentChats();
      if (chats.length > 0) {
        this.emitToRenderer('wa:chats-loaded', chats);
      }
      return chats;
    } catch (err) {
      console.error('[WhatsAppService] Error during refresh:', err);
      return [];
    }
  }

  public async logout(): Promise<boolean> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    try {
      if (this.client) {
        await this.client.logout().catch(() => null);
        await this.client.destroy().catch(() => null);
      }
    } catch (err) {
      console.warn('[WhatsAppService] Error during logout/destroy:', err);
    }

    this.client = null;
    this.qrDataUrl = null;
    this.avatarCache.clear();
    this.mediaCache.clear();
    this.updateStatus('disconnected');

    try {
      const authDataPath = path.join(app.getPath('userData'), 'wwebjs_auth');
      if (fs.existsSync(authDataPath)) {
        fs.rmSync(authDataPath, { recursive: true, force: true });
      }
    } catch {
      // Ignore auth folder cleanup error
    }

    await this.initialize();
    return true;
  }
}
