import { BrowserWindow, app } from 'electron';
import { Client, LocalAuth, MessageMedia } from 'whatsapp-web.js';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';

let ffmpegExecutablePath: string | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ffmpegExecutablePath = require('ffmpeg-static');
} catch (err) {
  console.warn('[WhatsAppService] ffmpeg-static não disponível:', err);
}

async function convertAudioToWhatsAppVoiceOgg(
  inputBuffer: Buffer
): Promise<{ buffer: Buffer; isOgg: boolean }> {
  if (!ffmpegExecutablePath || !fs.existsSync(ffmpegExecutablePath)) {
    return { buffer: inputBuffer, isOgg: false };
  }

  const tempInput = path.join(
    os.tmpdir(),
    `wa_voice_in_${Date.now()}_${Math.random().toString(36).slice(2)}.webm`
  );
  const tempOutput = path.join(
    os.tmpdir(),
    `wa_voice_out_${Date.now()}_${Math.random().toString(36).slice(2)}.ogg`
  );

  try {
    fs.writeFileSync(tempInput, inputBuffer);
  } catch (err) {
    console.error('[WhatsAppService] Falha ao escrever tempInput para áudio:', err);
    return { buffer: inputBuffer, isOgg: false };
  }

  return new Promise<{ buffer: Buffer; isOgg: boolean }>((resolve) => {
    // Transcodifica para Opus mono 48kHz em container OGG limpo.
    // O WhatsApp no iOS (iPhone) exige estritamente áudio Opus em 48.000 Hz (48kHz) mono
    // com timestamps limpos (-avoid_negative_ts make_zero) e sem metadados (-map_metadata -1).
    // Taxas diferentes como 16kHz quebram o decodificador CoreAudio/AVFoundation no iOS,
    // disparando o erro "Este áudio não está mais disponível. Peça para reenviá-lo".
    execFile(
      ffmpegExecutablePath!,
      [
        '-y',
        '-i',
        tempInput,
        '-vn',
        '-c:a',
        'libopus',
        '-b:a',
        '32k',
        '-vbr',
        'on',
        '-ar',
        '48000',
        '-ac',
        '1',
        '-application',
        'voip',
        '-avoid_negative_ts',
        'make_zero',
        '-map_metadata',
        '-1',
        '-f',
        'ogg',
        tempOutput,
      ],
      { timeout: 15000 },
      (err, _stdout, stderr) => {
        try {
          if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput);
        } catch {}

        if (err) {
          console.error('[WhatsAppService] Erro ao converter áudio com ffmpeg:', err, stderr);
          try {
            if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput);
          } catch {}
          resolve({ buffer: inputBuffer, isOgg: false });
          return;
        }

        try {
          if (fs.existsSync(tempOutput)) {
            const outBuf = fs.readFileSync(tempOutput);
            try {
              fs.unlinkSync(tempOutput);
            } catch {}
            resolve({ buffer: outBuf, isOgg: true });
            return;
          }
        } catch (readErr) {
          console.error('[WhatsAppService] Falha ao ler arquivo OGG convertido:', readErr);
        }
        resolve({ buffer: inputBuffer, isOgg: false });
      }
    );
  });
}

export interface FormattedChatSummary {
  id: string;
  name: string;
  parentName?: string;
  avatar: string;
  parentAvatar?: string;
  unreadCount: number;
  isMarkedUnread?: boolean;
  isGroup: boolean;
  isMuted?: boolean;
  hasMention?: boolean;
  isPinned?: boolean;
  timestamp?: number;
  lastMessage: {
    text: string;
    senderName?: string;
    mediaType: 'text' | 'sticker' | 'photo' | 'video' | 'audio';
    fromMe?: boolean;
    ack?: 'sent' | 'delivered' | 'read';
    duration?: string;
    timestamp: string;
    timestampMs?: number;
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
  isViewOnce?: boolean;
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
    fromMe?: boolean;
  };
  reaction?: string;
  reactions?: Array<{
    emoji: string;
    count: number;
    fromMe?: boolean;
    senders?: Array<{
      id: string;
      name?: string;
      avatar?: string;
      fromMe?: boolean;
      timestamp?: number;
    }>;
  }>;
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
  const safeName =
    typeof name === 'string'
      ? typeof (name as any).toWellFormed === 'function'
        ? (name as any).toWellFormed()
        : name.replace(/[\uD800-\uDFFF]/g, '')
      : '';

  // Remove diacríticos e mantém apenas letras e números ASCII limpos
  const clean = safeName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9\s]/g, '')
    .trim();

  let initials = 'WA';
  if (clean) {
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2 && parts[0][0] && parts[1][0]) {
      initials = (parts[0][0] + parts[1][0]).toUpperCase();
    } else {
      initials = clean.slice(0, 2).toUpperCase();
    }
  }

  // Garante que initials contenha exclusivamente caracteres alfanuméricos seguros
  initials = initials.replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || 'WA';

  const bgColors = ['#005C4B', '#1F2C34', '#025144', '#2A3942', '#128C7E'];
  let hash = 0;
  for (let i = 0; i < safeName.length; i++) {
    hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const bg = bgColors[Math.abs(hash) % bgColors.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="${bg}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#E9EDEF" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="600">${initials}</text></svg>`;

  try {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch (_) {
    return `data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2280%22%20height%3D%2280%22%20viewBox%3D%220%200%2080%2080%22%3E%3Crect%20width%3D%2280%22%20height%3D%2280%22%20rx%3D%2240%22%20fill%3D%22%23005C4B%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2254%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%20fill%3D%22%23E9EDEF%22%20font-family%3D%22Segoe%20UI%2C%20Arial%2C%20sans-serif%22%20font-size%3D%2228%22%20font-weight%3D%22600%22%3EWA%3C%2Ftext%3E%3C%2Fsvg%3E`;
  }
}

function isRawMediaBase64OrKey(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  const trimmed = str.trim();
  if (/\s/.test(trimmed)) return false;
  if (trimmed.length >= 24) {
    if (
      trimmed.startsWith('/9j/') ||
      trimmed.startsWith('iVBORw0KGgo') ||
      trimmed.startsWith('R0lGODlh') ||
      trimmed.startsWith('UklGR') ||
      trimmed.startsWith('data:image/') ||
      trimmed.startsWith('data:video/')
    ) {
      return true;
    }
    if (/^[A-Za-z0-9+/=]{32,}$/.test(trimmed)) {
      return true;
    }
  }
  return false;
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
  private myAvatarUrl = createInitialsAvatarDataUrl('Eu');
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

    this.client.on('message_reaction', async (reaction: any) => {
      try {
        const serializeId = (val: any): string => {
          if (!val) return '';
          if (typeof val === 'string') return val;
          return val._serialized || val.id || '';
        };

        const serializeKey = (val: any): string => {
          if (!val) return '';
          if (typeof val === 'string') return val;
          if (val._serialized) return val._serialized;
          const fromMe = Boolean(val.fromMe);
          const remote = serializeId(val.remote);
          const id = val.id || '';
          if (remote && id) {
            return `${fromMe}_${remote}_${id}`;
          }
          return id;
        };

        const parentId =
          serializeKey(reaction.msgId) ||
          serializeKey(reaction.parentMsgKey) ||
          serializeKey(reaction.reactionParentKey) ||
          '';

        let chatId =
          serializeId(reaction.msgId?.remote) ||
          serializeId(reaction.parentMsgKey?.remote) ||
          '';
        if (!chatId && parentId) {
          const match = parentId.match(/_([0-9a-zA-Z._-]+@(c\.us|g\.us|broadcast))_/);
          if (match) {
            chatId = match[1];
          } else {
            const parts = parentId.split('_');
            if (parts.length >= 2 && (parts[1].endsWith('@c.us') || parts[1].endsWith('@g.us'))) {
              chatId = parts[1];
            }
          }
        }

        const emoji = String(reaction.reaction || reaction.reactionText || '').trim();

        let senderId =
          serializeId(reaction.senderId) ||
          serializeId(reaction.senderUserJid) ||
          serializeId(reaction.author) ||
          serializeId(reaction.from) ||
          '';

        let fromMe = Boolean(reaction.id?.fromMe ?? reaction.msgKey?.fromMe ?? false);
        if (!fromMe && typeof reaction.id === 'string' && reaction.id.startsWith('true_')) {
          fromMe = true;
        }
        if (!fromMe && this.client?.info?.wid) {
          const myWid = serializeId(this.client.info.wid);
          if (myWid && senderId && (senderId === myWid || senderId.split('@')[0] === myWid.split('@')[0])) {
            fromMe = true;
          }
        }

        let senderName: string | undefined;
        let senderAvatar: string | undefined;
        if (fromMe) {
          senderName = 'Você';
        } else if (senderId && this.client?.pupPage) {
          try {
            const info = await this.client.pupPage.evaluate(async (sJid: string) => {
              const w = window as any;
              const c = w.require?.('WAWebCollections')?.Contact?.get?.(sJid);
              const name = c?.formattedTitle || c?.name || c?.pushname || '';
              const pic = w.require?.('WAWebCollections')?.ProfilePicThumb?.get?.(sJid);
              const avatar = pic?.eurl || pic?.img || pic?.imgFull || '';
              return { name, avatar };
            }, senderId);
            if (info) {
              senderName = info.name || undefined;
              senderAvatar = info.avatar || undefined;
            }
          } catch {
            // Ignore contact lookup error
          }
        }

        // Tenta obter também a lista completa e oficial de reações atualizadas para essa mensagem
        let fullReactions: any[] | undefined;
        if (this.client?.pupPage && parentId) {
          try {
            fullReactions = await this.client.pupPage.evaluate(async (pId: string) => {
              const w = window as any;
              const ReactionsCol = w.require?.('WAWebCollections')?.Reactions;
              if (!ReactionsCol) return null;
              let rObj = ReactionsCol.get?.(pId);
              if (!rObj && ReactionsCol.find) {
                rObj = await Promise.race([
                  ReactionsCol.find(pId),
                  new Promise((r) => setTimeout(() => r(null), 300)),
                ]);
              }
              if (!rObj) return null;
              const rawList =
                typeof rObj.reactions?.serialize === 'function'
                  ? rObj.reactions.serialize()
                  : typeof rObj.reactions?.getModelsArray === 'function'
                  ? rObj.reactions.getModelsArray()
                  : Array.isArray(rObj.reactions)
                  ? rObj.reactions
                  : [];
              if (!rawList || rawList.length === 0) return null;
              return rawList.map((r: any) => ({
                emoji: r.aggregateEmoji || r.reactionText || r.emoji || r.id,
                count: Number(r.count || (r.senders?.length ?? 1)),
                fromMe: Boolean(r.hasReactionByMe),
                senders: (r.senders || []).map((s: any) => ({
                  id: s.senderUserJid || s.author || '',
                  fromMe: Boolean(s.msgKey?.fromMe ?? s.fromMe ?? false),
                  timestamp: Number(s.timestamp || 0),
                })),
              }));
            }, parentId);
          } catch {
            // Ignore error
          }
        }

        if (parentId) {
          this.emitToRenderer('wa:reaction-received', {
            messageId: parentId,
            chatId,
            reaction: emoji,
            senderId,
            senderName,
            senderAvatar,
            fromMe,
            reactions: fullReactions || undefined,
            timestamp: reaction.timestamp ? Number(reaction.timestamp) : Date.now(),
          });
        }
      } catch (err) {
        console.error('[WhatsAppService] Error handling message_reaction:', err);
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

        const getProp = (obj: any, key: string): any => {
          if (!obj) return undefined;
          if (typeof obj.get === 'function') {
            try {
              const v = obj.get(key);
              if (v !== undefined) return v;
            } catch (_) {}
          }
          return obj[key] ?? obj.attributes?.[key] ?? obj.__x?.[key] ?? obj._data?.[key];
        };

        const isRawMediaBase64OrKey = (str: any): boolean => {
          if (!str || typeof str !== 'string') return false;
          const trimmed = str.trim();
          if (/\s/.test(trimmed)) return false;
          if (trimmed.length >= 24) {
            if (
              trimmed.startsWith('/9j/') ||
              trimmed.startsWith('iVBORw0KGgo') ||
              trimmed.startsWith('R0lGODlh') ||
              trimmed.startsWith('UklGR') ||
              trimmed.startsWith('data:image/') ||
              trimmed.startsWith('data:video/')
            ) {
              return true;
            }
            if (/^[A-Za-z0-9+/=]{32,}$/.test(trimmed)) {
              return true;
            }
          }
          return false;
        };

        const checkIsViewOnce = (m: any): boolean => {
          if (!m) return false;

          const mediaData = getProp(m, 'mediaData') || m.mediaData || m.__x_mediaData;
          const dataObj = m._data || {};

          if (
            getProp(m, 'isViewOnce') ||
            getProp(m, 'viewOnce') ||
            getProp(m, 'isViewOnceOpened') ||
            getProp(m, 'viewOnceOpened') ||
            getProp(m, 'isViewOnceV2') ||
            getProp(m, 'viewOnceV2') ||
            getProp(m, 'isViewOnceV1') ||
            getProp(m, 'viewOnceMessage') ||
            getProp(m, 'viewOnceMessageV2') ||
            getProp(m, 'viewOnceMessageV2Extension') ||
            getProp(m, 'type') === 'view_once' ||
            getProp(m, 'subtype') === 'view_once' ||
            m.isViewOnce === true ||
            m.viewOnce === true ||
            m.isViewOnceOpened === true ||
            m.viewOnceOpened === true ||
            m.__x_isViewOnce === true ||
            m.__x_isViewOnceOpened === true ||
            m.__x_viewOnce === true ||
            m.__x_viewOnceOpened === true ||
            (typeof m.isViewOnce === 'function' && m.isViewOnce()) ||
            (typeof m.isViewOnceOpened === 'function' && m.isViewOnceOpened()) ||
            (mediaData && (
              getProp(mediaData, 'isViewOnce') ||
              getProp(mediaData, 'viewOnce') ||
              getProp(mediaData, 'isViewOnceOpened') ||
              getProp(mediaData, 'viewOnceOpened') ||
              getProp(mediaData, 'isViewOnceV2') ||
              mediaData.isViewOnce === true ||
              mediaData.viewOnce === true ||
              mediaData.isViewOnceOpened === true ||
              mediaData.viewOnceOpened === true
            )) ||
            (dataObj && (
              dataObj.isViewOnce === true ||
              dataObj.viewOnce === true ||
              dataObj.isViewOnceOpened === true ||
              dataObj.viewOnceOpened === true ||
              dataObj.type === 'view_once' ||
              dataObj.subtype === 'view_once' ||
              dataObj.viewOnceMessage ||
              dataObj.viewOnceMessageV2
            ))
          ) {
            return true;
          }

          if (typeof m.serialize === 'function') {
            try {
              const s = m.serialize();
              if (
                s?.isViewOnce ||
                s?.viewOnce ||
                s?.isViewOnceOpened ||
                s?.viewOnceOpened ||
                s?.type === 'view_once' ||
                s?.subtype === 'view_once' ||
                s?.viewOnceMessage ||
                s?.viewOnceMessageV2 ||
                s?.mediaData?.isViewOnce ||
                s?.mediaData?.isViewOnceOpened
              ) {
                return true;
              }
            } catch (_) {}
          }

          const fromMe = Boolean(m.id?.fromMe || m.fromMe);
          const rawType = String(getProp(m, 'type') || '');
          const directPath = getProp(m, 'directPath') || (mediaData && getProp(mediaData, 'directPath'));
          const renderableUrl = getProp(mediaData, 'renderableUrl');
          const body = String(getProp(m, 'body') || '').trim();
          const caption = String(getProp(m, 'caption') || '').trim();

          // 2. Se o body for uma mediaKey pura em base64 (como 'MLFJqi4g1bZ/UbmrH/S/PBh146yzj/jPL+RvuwYUwsUiqLiH/2Q==')
          // Nenhum texto humano real é uma chave base64 pura de 40 a 70 caracteres terminada em '='
          const isMediaKey = /^[A-Za-z0-9+/=]{40,70}$/.test(body) && body.endsWith('=') && !/\s/.test(body);
          if (isMediaKey) {
            return true;
          }

          // 3. Se for mídia sem directPath e sem renderableUrl:
          // Se for enviada por nós (fromMe) sem legenda e sem corpo, é uma visualização única enviada pelo celular
          if ((rawType === 'image' || rawType === 'video' || rawType === 'view_once') && !directPath && !renderableUrl) {
            if (!fromMe || (!caption && !body)) {
              return true;
            }
          }

          // 4. Se for mensagem sem texto, sem legenda, sem directPath e sem renderableUrl
          if (
            !body &&
            !caption &&
            !directPath &&
            !renderableUrl &&
            rawType !== 'ptt' &&
            rawType !== 'audio' &&
            rawType !== 'sticker' &&
            rawType !== 'revoked' &&
            rawType !== 'reaction'
          ) {
            return true;
          }

          return false;
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
          .sort((a: any, b: any) => {
            const pinA = Number(getProp(a, 'pin') || a.pin || 0);
            const pinB = Number(getProp(b, 'pin') || b.pin || 0);
            if (pinA > 0 && pinB === 0) return -1;
            if (pinB > 0 && pinA === 0) return 1;
            if (pinA > 0 && pinB > 0) return pinB - pinA;
            return (b.t || 0) - (a.t || 0);
          })
          .slice(0, 50);

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
          const rawUnread = Number(c.unreadCount ?? 0);
          const isMarkedUnread = Boolean(
            c.markedAsUnread ||
            c.markedUnread ||
            rawUnread === -1 ||
            rawUnread < 0
          );
          const unreadCount = isMarkedUnread ? -1 : (rawUnread > 0 ? rawUnread : 0);

          const unreadMentionCount = unreadCount > 0 ? Number(c.unreadMentionCount || 0) : 0;
          let hasMention = Boolean(isGroup && unreadCount > 0 && (c.hasUnreadMention || unreadMentionCount > 0));

          if (!hasMention && isGroup && unreadCount > 0) {
            const unreadMsgs = msgs.slice(-Math.min(unreadCount, 15));
            for (const um of unreadMsgs) {
              if (!um.id?.fromMe) {
                // 1. Menção direta ao usuário (@Você)
                const mentionedJids: any[] = Array.isArray(um.mentionedJidList) ? um.mentionedJidList : [];
                for (const mj of mentionedJids) {
                  const sid = serializeId(mj);
                  const u = sid ? sid.split('@')[0] : (typeof mj === 'string' ? mj : mj?.user || '');
                  if (u && (myIds.has(u) || myIds.has(sid))) {
                    hasMention = true;
                    break;
                  }
                }
                if (hasMention) break;

                // 2. Resposta a uma mensagem do usuário (citação / quote)
                const isQuotedFromMe = Boolean(
                  um.quotedMsg?.id?.fromMe ||
                  um.quotedMsg?.fromMe ||
                  um._quotedMsgObj?.id?.fromMe ||
                  um._quotedMsgObj?.fromMe
                );
                if (isQuotedFromMe) {
                  hasMention = true;
                  break;
                }

                if (um.quotedParticipant) {
                  const qsid = serializeId(um.quotedParticipant);
                  const qu = qsid ? qsid.split('@')[0] : (typeof um.quotedParticipant === 'string' ? um.quotedParticipant : um.quotedParticipant?.user || '');
                  if (qu && (myIds.has(qu) || myIds.has(qsid))) {
                    hasMention = true;
                    break;
                  }
                }
              }
            }
          }

          let senderName = '';
          if (lastMsg && !lastMsg.id?.fromMe && isGroup) {
            const info = resolveSender(lastMsg.author, lastMsg.notifyName);
            senderName = info.senderName;
          }

          let rawType = String(getProp(lastMsg, 'type') || 'chat');
          const isViewOnce = checkIsViewOnce(lastMsg);
          if (isViewOnce && (rawType === 'view_once' || rawType === 'chat')) {
            const mime = String(getProp(lastMsg, 'mimetype') || getProp(lastMsg?.mediaData, 'mimetype') || '');
            rawType = mime.startsWith('video/') ? 'video' : 'image';
          }
          const isChat = rawType === 'chat';
          const rawBody = isViewOnce
            ? String(getProp(lastMsg, 'caption') || '')
            : isChat
            ? String(getProp(lastMsg, 'body') || '')
            : String(getProp(lastMsg, 'caption') || '');
          const formattedLastMsg = formatMentionsInText(rawBody, lastMsg);
          const cleanLastMsgText = isRawMediaBase64OrKey(formattedLastMsg.text) ? '' : formattedLastMsg.text;

          const rawPin = Number(getProp(c, 'pin') || c.pin || 0);
          const isChatPinned = Boolean(rawPin > 0 || c.isPinned || c.pinned);

          results.push({
            id,
            name,
            avatar,
            unreadCount,
            isMarkedUnread,
            isGroup,
            isMuted,
            hasMention,
            isPinned: isChatPinned,
            timestamp: Number(lastMsg?.t || c.t || 0),
            lastMsgType: rawType,
            lastMsgIsViewOnce: isViewOnce,
            lastMsgBody: cleanLastMsgText,
            lastMsgFromMe: Boolean(lastMsg?.id?.fromMe),
            lastMsgAck: Number(lastMsg?.ack || 0),
            lastMsgDuration: Number(lastMsg?.duration || 0),
            senderName,
          });
        }

        return results;
      });

      return rawChats.map((raw: any) => {
        if (raw.avatar) {
          this.avatarCache.set(raw.id, raw.avatar);
        }
        const avatar =
          raw.avatar ||
          this.avatarCache.get(raw.id) ||
          createInitialsAvatarDataUrl(raw.name);

        const isViewOnce = Boolean(
          raw.lastMsgIsViewOnce ||
          raw.lastMsgType === 'view_once'
        );

        let mediaType: 'text' | 'sticker' | 'photo' | 'video' | 'audio' = 'text';
        let text = raw.lastMsgBody || '';
        let duration: string | undefined;

        if (raw.lastMsgType === 'sticker') {
          mediaType = 'sticker';
          text = 'Figurinha';
        } else if (raw.lastMsgType === 'image' || isViewOnce) {
          mediaType = 'photo';
          text = isViewOnce
            ? (raw.lastMsgBody ? `📷 Foto (1x): ${raw.lastMsgBody}` : '📷 Mensagem de visualização única')
            : (raw.lastMsgBody || 'Foto');
        } else if (
          raw.lastMsgType === 'video' ||
          raw.lastMsgType === 'ptv' ||
          raw.lastMsgType === 'gif'
        ) {
          mediaType = 'video';
          text = isViewOnce
            ? (raw.lastMsgBody ? `🎥 Vídeo (1x): ${raw.lastMsgBody}` : '🎥 Mensagem de visualização única')
            : (raw.lastMsgBody || 'Vídeo');
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

        const rawTimestampSec = Number(raw.timestamp || 0);
        const rawTimestampMs =
          rawTimestampSec > 0
            ? rawTimestampSec < 1e11
              ? rawTimestampSec * 1000
              : rawTimestampSec
            : 0;

        return {
          id: raw.id,
          name: raw.name,
          avatar,
          unreadCount: raw.unreadCount,
          isMarkedUnread: raw.isMarkedUnread || raw.unreadCount === -1,
          isGroup: raw.isGroup,
          isMuted: raw.isMuted,
          hasMention: Boolean(raw.hasMention),
          isPinned: Boolean(raw.isPinned),
          timestamp: rawTimestampMs,
          lastMessage: {
            text,
            senderName: raw.senderName || undefined,
            mediaType,
            fromMe: raw.lastMsgFromMe,
            ack: mapAck(raw.lastMsgAck),
            duration,
            timestamp: formatTime(raw.timestamp),
            timestampMs: rawTimestampMs,
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

          const getProp = (obj: any, key: string): any => {
            if (!obj) return undefined;
            if (typeof obj.get === 'function') {
              try {
                const v = obj.get(key);
                if (v !== undefined) return v;
              } catch (_) {}
            }
            return obj[key] ?? obj.attributes?.[key] ?? obj.__x?.[key] ?? obj._data?.[key];
          };

          const checkIsViewOnce = (m: any): boolean => {
            if (!m) return false;

            const mediaData = getProp(m, 'mediaData') || m.mediaData || m.__x_mediaData;
            const dataObj = m._data || {};

            if (
              getProp(m, 'isViewOnce') ||
              getProp(m, 'viewOnce') ||
              getProp(m, 'isViewOnceOpened') ||
              getProp(m, 'viewOnceOpened') ||
              getProp(m, 'isViewOnceV2') ||
              getProp(m, 'viewOnceV2') ||
              getProp(m, 'isViewOnceV1') ||
              getProp(m, 'viewOnceMessage') ||
              getProp(m, 'viewOnceMessageV2') ||
              getProp(m, 'viewOnceMessageV2Extension') ||
              getProp(m, 'type') === 'view_once' ||
              getProp(m, 'subtype') === 'view_once' ||
              m.isViewOnce === true ||
              m.viewOnce === true ||
              m.isViewOnceOpened === true ||
              m.viewOnceOpened === true ||
              m.__x_isViewOnce === true ||
              m.__x_isViewOnceOpened === true ||
              m.__x_viewOnce === true ||
              m.__x_viewOnceOpened === true ||
              (typeof m.isViewOnce === 'function' && m.isViewOnce()) ||
              (typeof m.isViewOnceOpened === 'function' && m.isViewOnceOpened()) ||
              (mediaData && (
                getProp(mediaData, 'isViewOnce') ||
                getProp(mediaData, 'viewOnce') ||
                getProp(mediaData, 'isViewOnceOpened') ||
                getProp(mediaData, 'viewOnceOpened') ||
                getProp(mediaData, 'isViewOnceV2') ||
                mediaData.isViewOnce === true ||
                mediaData.viewOnce === true ||
                mediaData.isViewOnceOpened === true ||
                mediaData.viewOnceOpened === true
              )) ||
              (dataObj && (
                dataObj.isViewOnce === true ||
                dataObj.viewOnce === true ||
                dataObj.isViewOnceOpened === true ||
                dataObj.viewOnceOpened === true ||
                dataObj.type === 'view_once' ||
                dataObj.subtype === 'view_once' ||
                dataObj.viewOnceMessage ||
                dataObj.viewOnceMessageV2
              ))
            ) {
              return true;
            }

            if (typeof m.serialize === 'function') {
              try {
                const s = m.serialize();
                if (
                  s?.isViewOnce ||
                  s?.viewOnce ||
                  s?.isViewOnceOpened ||
                  s?.viewOnceOpened ||
                  s?.type === 'view_once' ||
                  s?.subtype === 'view_once' ||
                  s?.viewOnceMessage ||
                  s?.viewOnceMessageV2 ||
                  s?.mediaData?.isViewOnce ||
                  s?.mediaData?.isViewOnceOpened
                ) {
                  return true;
                }
              } catch (_) {}
            }

            const fromMe = Boolean(m.id?.fromMe || m.fromMe);
            const rawType = String(getProp(m, 'type') || '');
            const directPath = getProp(m, 'directPath') || (mediaData && getProp(mediaData, 'directPath'));
            const renderableUrl = getProp(mediaData, 'renderableUrl');
            const body = String(getProp(m, 'body') || '').trim();
            const caption = String(getProp(m, 'caption') || '').trim();

            // 2. Se o body for uma mediaKey pura em base64 (como 'MLFJqi4g1bZ/UbmrH/S/PBh146yzj/jPL+RvuwYUwsUiqLiH/2Q==')
            // Nenhum texto humano real é uma chave base64 pura de 40 a 70 caracteres terminada em '='
            const isMediaKey = /^[A-Za-z0-9+/=]{40,70}$/.test(body) && body.endsWith('=') && !/\s/.test(body);
            if (isMediaKey) {
              return true;
            }

            // 3. Se for mídia sem directPath e sem renderableUrl:
            // Se for enviada por nós (fromMe) sem legenda e sem corpo, é uma visualização única enviada pelo celular
            if ((rawType === 'image' || rawType === 'video' || rawType === 'view_once') && !directPath && !renderableUrl) {
              if (!fromMe || (!caption && !body)) {
                return true;
              }
            }

            // 4. Se for mensagem sem texto, sem legenda, sem directPath e sem renderableUrl
            if (
              !body &&
              !caption &&
              !directPath &&
              !renderableUrl &&
              rawType !== 'ptt' &&
              rawType !== 'audio' &&
              rawType !== 'sticker' &&
              rawType !== 'revoked' &&
              rawType !== 'reaction'
            ) {
              return true;
            }

            return false;
          };

          const isRawMediaBase64OrKey = (str: any): boolean => {
            if (!str || typeof str !== 'string') return false;
            const trimmed = str.trim();
            if (/\s/.test(trimmed)) return false;
            if (trimmed.length >= 24) {
              if (
                trimmed.startsWith('/9j/') ||
                trimmed.startsWith('iVBORw0KGgo') ||
                trimmed.startsWith('R0lGODlh') ||
                trimmed.startsWith('UklGR') ||
                trimmed.startsWith('data:image/') ||
                trimmed.startsWith('data:video/')
              ) {
                return true;
              }
              if (/^[A-Za-z0-9+/=]{32,}$/.test(trimmed)) {
                return true;
              }
            }
            return false;
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
            m.type !== 'call_log' &&
            m.type !== 'reaction';

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

          const allRawModels: any[] = chat.msgs?.getModelsArray?.() || [];
          const msgs: any[] = allRawModels
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
          } else if (targetChatId) {
            try {
              const c = ContactCol?.get?.(targetChatId);
              const pic =
                ProfilePicThumb?.get?.(targetChatId) ||
                c?.profilePicThumb;
              let url = pic?.eurl || pic?.img || pic?.imgFull || '';
              if (!url && ProfilePicThumb?.find) {
                const found: any = await Promise.race([
                  ProfilePicThumb.find(targetChatId),
                  new Promise((r) => setTimeout(() => r(null), 180)),
                ]);
                url = found?.eurl || found?.img || found?.imgFull || '';
              }
              if (url) {
                authorAvatarMap[targetChatId] = url;
              }
            } catch (_) {}
          }

          const ReactionsCol = w.require?.('WAWebCollections')?.Reactions;

          const extractReactions = (rm: any): any[] => {
            if (!rm) return [];
            let rawList: any[] = [];
            if (typeof rm.reactions?.serialize === 'function') {
              try { rawList = rm.reactions.serialize(); } catch (_) {}
            }
            if ((!rawList || rawList.length === 0) && typeof rm.reactions?.getModelsArray === 'function') {
              try { rawList = rm.reactions.getModelsArray(); } catch (_) {}
            }
            if ((!rawList || rawList.length === 0) && Array.isArray(rm.reactions)) {
              rawList = rm.reactions;
            }
            if ((!rawList || rawList.length === 0) && Array.isArray(rm.reactions?.models)) {
              rawList = rm.reactions.models;
            }
            if ((!rawList || rawList.length === 0) && typeof rm.serialize === 'function') {
              try { rawList = rm.serialize(); } catch (_) {}
            }
            if ((!rawList || rawList.length === 0) && typeof rm.getModelsArray === 'function') {
              try { rawList = rm.getModelsArray(); } catch (_) {}
            }
            if ((!rawList || rawList.length === 0) && Array.isArray(rm)) {
              rawList = rm;
            }
            if (!Array.isArray(rawList) || rawList.length === 0) return [];

            const parsed: any[] = [];
            for (const r of rawList) {
              const emoji = String(r.aggregateEmoji || r.reactionText || r.emoji || r.id || r.text || '').trim();
              if (!emoji) continue;

              let sendersRaw: any[] = [];
              if (typeof r.senders?.serialize === 'function') {
                try { sendersRaw = r.senders.serialize(); } catch (_) {}
              }
              if ((!sendersRaw || sendersRaw.length === 0) && typeof r.senders?.getModelsArray === 'function') {
                try { sendersRaw = r.senders.getModelsArray(); } catch (_) {}
              }
              if ((!sendersRaw || sendersRaw.length === 0) && Array.isArray(r.senders)) {
                sendersRaw = r.senders;
              }
              if ((!sendersRaw || sendersRaw.length === 0) && Array.isArray(r.senders?.models)) {
                sendersRaw = r.senders.models;
              }

              const senders = (sendersRaw || []).map((s: any) => {
                const sId =
                  serializeId(s.senderUserJid) ||
                  serializeId(s.author) ||
                  serializeId(s.from) ||
                  serializeId(s.id) ||
                  '';
                const sFromMe = Boolean(s.fromMe ?? s.msgKey?.fromMe ?? s.id?.fromMe ?? false);
                const contactObj = sId ? ContactCol?.get?.(sId) : null;
                const sName = sFromMe
                  ? 'Você'
                  : contactObj?.formattedTitle || contactObj?.name || contactObj?.pushname || (sId ? sId : undefined);
                const sAvatar = sFromMe ? undefined : authorAvatarMap[sId];
                return {
                  id: sId,
                  name: sName,
                  avatar: sAvatar,
                  fromMe: sFromMe,
                  timestamp: Number(s.timestamp || s.reactionTimestamp || s.t || 0),
                };
              });

              const fromMe = Boolean(r.hasReactionByMe || senders.some((s: any) => s.fromMe));
              const count = Math.max(senders.length, Number(r.count || 1));
              parsed.push({
                emoji,
                count,
                fromMe,
                senders: senders.length > 0 ? senders : undefined,
              });
            }
            return parsed;
          };

          const reactionsByMsgId = new Map<string, any[]>();

          // 1. Carrega todos os modelos de reações atualmente na memória do WhatsApp Web
          if (ReactionsCol) {
            try {
              const allReactionModels =
                (typeof ReactionsCol.getModelsArray === 'function' ? ReactionsCol.getModelsArray() : null) ||
                (Array.isArray(ReactionsCol.models) ? ReactionsCol.models : []);
              for (const rm of allReactionModels) {
                const pId = serializeId(rm.id) || serializeId(rm.msgId) || serializeId(rm.parentMsgKey);
                if (pId) {
                  const extracted = extractReactions(rm);
                  if (extracted.length > 0) {
                    reactionsByMsgId.set(pId, extracted);
                  }
                }
              }
            } catch (_) {}
          }

          // 2. Para cada mensagem em msgs, tenta obter do cache síncrono e busca mensagens com hasReaction
          if (ReactionsCol) {
            for (const m of msgs) {
              const mId = serializeId(m.id);
              if (mId && !reactionsByMsgId.has(mId)) {
                try {
                  const cached = ReactionsCol.get?.(mId);
                  if (cached) {
                    const extracted = extractReactions(cached);
                    if (extracted.length > 0) {
                      reactionsByMsgId.set(mId, extracted);
                    }
                  }
                } catch (_) {}
              }
            }

            const pendingMsgs = msgs.filter((m: any) => {
              const mId = serializeId(m.id);
              return mId && (Boolean(m.hasReaction) || Boolean(m.reactions)) && !reactionsByMsgId.has(mId);
            });

            if (pendingMsgs.length > 0 && typeof ReactionsCol.find === 'function') {
              await Promise.all(
                pendingMsgs.map(async (m: any) => {
                  const mId = serializeId(m.id);
                  try {
                    const found = await Promise.race([
                      ReactionsCol.find(mId),
                      new Promise((resolve) => setTimeout(() => resolve(null), 800)),
                    ]);
                    if (found) {
                      const extracted = extractReactions(found);
                      if (extracted.length > 0) {
                        reactionsByMsgId.set(mId, extracted);
                      }
                    }
                  } catch (_) {}
                })
              );
            }
          }

          return msgs.map((m: any) => {
            const id = serializeId(m.id) || `${m.t}-${Math.random()}`;
            const fromMe = Boolean(m.id?.fromMe);
            let rawType = String(getProp(m, 'type') || 'chat');
            const isViewOnce = checkIsViewOnce(m);

            if (isViewOnce && (rawType === 'view_once' || rawType === 'chat')) {
              const mime = String(getProp(m, 'mimetype') || getProp(m?.mediaData, 'mimetype') || '');
              rawType = mime.startsWith('video/') ? 'video' : 'image';
            }

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

            let quoted: { id: string; author: string; text: string; fromMe?: boolean } | null = null;
            if (m.quotedMsg) {
              let qAuthor = 'Contato';
              let isQuotedFromMe = Boolean(m.quotedMsg.id?.fromMe || m.quotedMsg.fromMe);
              if (!isQuotedFromMe && m.quotedParticipant) {
                const qPartSid = serializeId(m.quotedParticipant);
                const qPartUser = qPartSid ? qPartSid.split('@')[0] : (typeof m.quotedParticipant === 'string' ? m.quotedParticipant : m.quotedParticipant?.user || '');
                if (qPartUser && (myIds.has(qPartUser) || myIds.has(qPartSid))) {
                  isQuotedFromMe = true;
                }
              }

              if (isQuotedFromMe) {
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

              const qId =
                (m.quotedMsg.id
                  ? serializeId(m.quotedMsg.id) || m.quotedMsg.id._serialized || m.quotedMsg.id.id
                  : null) ||
                m.quotedStanzaID ||
                (typeof m.quotedMsg === 'string' ? m.quotedMsg : '') ||
                '';

              quoted = {
                id: String(qId),
                author: qAuthor,
                text: qFormatted.text,
                fromMe: isQuotedFromMe,
              };
            }

            // Extrai preview imediato de m.mediaData.preview ou m.preview (exceto para visualização única)
            let thumbBase64 = '';
            if (
              !isViewOnce &&
              (rawType === 'image' ||
                rawType === 'video' ||
                rawType === 'ptv' ||
                rawType === 'gif' ||
                rawType === 'sticker')
            ) {
              const mData = getProp(m, 'mediaData') || m.mediaData || m.__x_mediaData;
              const previewObj = getProp(mData, 'preview');
              let candidate = '';
              if (previewObj) {
                if (typeof previewObj === 'string') {
                  candidate = previewObj;
                } else if (typeof previewObj._b64 === 'string') {
                  candidate = previewObj._b64;
                }
              }

              if (!candidate) {
                const p = getProp(m, 'preview');
                if (typeof p === 'string') candidate = p;
              }

              // Só aceita de m.body se for realmente uma string base64 de imagem (começando com /9j/ ou data:image/), NUNCA texto de legenda com espaços!
              if (!candidate) {
                const b = String(getProp(m, 'body') || '').trim();
                if (
                  b.length >= 50 &&
                  !/\s/.test(b) &&
                  (b.startsWith('/9j/') ||
                    b.startsWith('data:image/') ||
                    b.startsWith('iVBORw0KGgo') ||
                    b.startsWith('UklGR'))
                ) {
                  candidate = b;
                }
              }

              if (candidate) {
                if (candidate.startsWith('data:image/') || candidate.startsWith('data:video/')) {
                  thumbBase64 = candidate;
                } else if (!/\s/.test(candidate) && /^[A-Za-z0-9+/=]+$/.test(candidate)) {
                  const mime = rawType === 'sticker' ? 'image/webp' : 'image/jpeg';
                  thumbBase64 = `data:${mime};base64,${candidate}`;
                }
              }
            }

            let parsedReactions = reactionsByMsgId.get(id);
            if (!parsedReactions || parsedReactions.length === 0) {
              for (const [k, v] of reactionsByMsgId.entries()) {
                if (k.endsWith(`_${id}`) || id.endsWith(`_${k}`)) {
                  parsedReactions = v;
                  break;
                }
              }
            }
            if ((!parsedReactions || parsedReactions.length === 0) && (m.reactions || m.hasReaction)) {
              parsedReactions = extractReactions(m);
            }
            const reactions = parsedReactions && parsedReactions.length > 0 ? parsedReactions : undefined;
            const reaction = reactions?.[0]?.emoji || undefined;

            const isChat = rawType === 'chat';
            let rawBodyText = '';
            if (isViewOnce) {
              const c = String(getProp(m, 'caption') || '');
              rawBodyText = isRawMediaBase64OrKey(c) ? '' : c;
            } else if (isChat) {
              const b = String(getProp(m, 'body') || '');
              rawBodyText = isRawMediaBase64OrKey(b) ? '' : b;
            } else if (rawType === 'revoked') {
              rawBodyText = '🚫 Mensagem apagada';
            } else {
              // Para imagens, vídeos, figurinhas, etc., o texto deve vir EXCLUSIVAMENTE do caption (legenda)
              const c = String(getProp(m, 'caption') || '');
              rawBodyText = isRawMediaBase64OrKey(c) ? '' : c;
            }

            const { text, mentions } = formatMentionsInText(rawBodyText, m);
            const finalText = isRawMediaBase64OrKey(text) ? '' : text;

            return {
              id,
              rawType,
              isViewOnce,
              text: finalText,
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
              reaction,
              reactions,
            };
          });
        },
        chatId,
        limit
      );

      // Pré-decripta em alta definição (HD) as mídias recentes de imagem/figurinha que ainda não estão em cache (ignora visualização única)
      const uncachedMediaIds = rawMsgs
        .filter(
          (m: any) =>
            !m.isViewOnce &&
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
          isViewOnce: Boolean((m as any).isViewOnce),
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
          reaction: (m as any).reaction || undefined,
          reactions: (m as any).reactions || undefined,
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

        const getProp = (obj: any, key: string): any => {
          if (!obj) return undefined;
          if (typeof obj.get === 'function') {
            try {
              const v = obj.get(key);
              if (v !== undefined) return v;
            } catch (_) {}
          }
          return obj[key] ?? obj.attributes?.[key] ?? obj.__x?.[key] ?? obj._data?.[key];
        };

        const isRawMediaBase64OrKey = (str: any): boolean => {
          if (!str || typeof str !== 'string') return false;
          const trimmed = str.trim();
          if (/\s/.test(trimmed)) return false;
          if (trimmed.length >= 24) {
            if (
              trimmed.startsWith('/9j/') ||
              trimmed.startsWith('iVBORw0KGgo') ||
              trimmed.startsWith('R0lGODlh') ||
              trimmed.startsWith('UklGR') ||
              trimmed.startsWith('data:image/') ||
              trimmed.startsWith('data:video/')
            ) {
              return true;
            }
            if (/^[A-Za-z0-9+/=]{32,}$/.test(trimmed)) {
              return true;
            }
          }
          return false;
        };

        const checkIsViewOnce = (m: any): boolean => {
          if (!m) return false;

          const mediaData = getProp(m, 'mediaData') || m.mediaData || m.__x_mediaData;
          const dataObj = m._data || {};

          if (
            getProp(m, 'isViewOnce') ||
            getProp(m, 'viewOnce') ||
            getProp(m, 'isViewOnceOpened') ||
            getProp(m, 'viewOnceOpened') ||
            getProp(m, 'isViewOnceV2') ||
            getProp(m, 'viewOnceV2') ||
            getProp(m, 'isViewOnceV1') ||
            getProp(m, 'viewOnceMessage') ||
            getProp(m, 'viewOnceMessageV2') ||
            getProp(m, 'viewOnceMessageV2Extension') ||
            getProp(m, 'type') === 'view_once' ||
            getProp(m, 'subtype') === 'view_once' ||
            m.isViewOnce === true ||
            m.viewOnce === true ||
            m.isViewOnceOpened === true ||
            m.viewOnceOpened === true ||
            m.__x_isViewOnce === true ||
            m.__x_isViewOnceOpened === true ||
            m.__x_viewOnce === true ||
            m.__x_viewOnceOpened === true ||
            (typeof m.isViewOnce === 'function' && m.isViewOnce()) ||
            (typeof m.isViewOnceOpened === 'function' && m.isViewOnceOpened()) ||
            (mediaData && (
              getProp(mediaData, 'isViewOnce') ||
              getProp(mediaData, 'viewOnce') ||
              getProp(mediaData, 'isViewOnceOpened') ||
              getProp(mediaData, 'viewOnceOpened') ||
              getProp(mediaData, 'isViewOnceV2') ||
              mediaData.isViewOnce === true ||
              mediaData.viewOnce === true ||
              mediaData.isViewOnceOpened === true ||
              mediaData.viewOnceOpened === true
            )) ||
            (dataObj && (
              dataObj.isViewOnce === true ||
              dataObj.viewOnce === true ||
              dataObj.isViewOnceOpened === true ||
              dataObj.viewOnceOpened === true ||
              dataObj.type === 'view_once' ||
              dataObj.subtype === 'view_once' ||
              dataObj.viewOnceMessage ||
              dataObj.viewOnceMessageV2
            ))
          ) {
            return true;
          }

          if (typeof m.serialize === 'function') {
            try {
              const s = m.serialize();
              if (
                s?.isViewOnce ||
                s?.viewOnce ||
                s?.isViewOnceOpened ||
                s?.viewOnceOpened ||
                s?.type === 'view_once' ||
                s?.subtype === 'view_once' ||
                s?.viewOnceMessage ||
                s?.viewOnceMessageV2 ||
                s?.mediaData?.isViewOnce ||
                s?.mediaData?.isViewOnceOpened
              ) {
                return true;
              }
            } catch (_) {}
          }

          const fromMe = Boolean(m.id?.fromMe || m.fromMe);
          const rawType = String(getProp(m, 'type') || '');
          const directPath = getProp(m, 'directPath') || (mediaData && getProp(mediaData, 'directPath'));
          const renderableUrl = getProp(mediaData, 'renderableUrl');
          const body = String(getProp(m, 'body') || '').trim();
          const caption = String(getProp(m, 'caption') || '').trim();

          // 2. Se o body for uma mediaKey pura em base64 (como 'MLFJqi4g1bZ/UbmrH/S/PBh146yzj/jPL+RvuwYUwsUiqLiH/2Q==')
          // Nenhum texto humano real é uma chave base64 pura de 40 a 70 caracteres terminada em '='
          const isMediaKey = /^[A-Za-z0-9+/=]{40,70}$/.test(body) && body.endsWith('=') && !/\s/.test(body);
          if (isMediaKey) {
            return true;
          }

          // 3. Se for mídia sem directPath e sem renderableUrl:
          // Se for enviada por nós (fromMe) sem legenda e sem corpo, é uma visualização única enviada pelo celular
          if ((rawType === 'image' || rawType === 'video' || rawType === 'view_once') && !directPath && !renderableUrl) {
            if (!fromMe || (!caption && !body)) {
              return true;
            }
          }

          // 4. Se for mensagem sem texto, sem legenda, sem directPath e sem renderableUrl
          if (
            !body &&
            !caption &&
            !directPath &&
            !renderableUrl &&
            rawType !== 'ptt' &&
            rawType !== 'audio' &&
            rawType !== 'sticker' &&
            rawType !== 'revoked' &&
            rawType !== 'reaction'
          ) {
            return true;
          }

          return false;
        };

        const MsgCol = w.require('WAWebCollections').Msg;
        const msg =
          MsgCol.get(targetMsgId) ||
          MsgCol.getModelsArray().find((m: any) => serializeId(m.id) === targetMsgId) ||
          (await MsgCol.getMessagesById?.([targetMsgId]))?.messages?.[0];

        if (!msg) return null;

        const isViewOnce = checkIsViewOnce(msg);
        if (isViewOnce) {
          // Mídias de visualização única são protegidas pelo WhatsApp e não devem ser baixadas na versão Web
          return null;
        }

        const rawType = getProp(msg, 'type');
        const declaredMime =
          getProp(msg, 'mimetype') ||
          getProp(msg.mediaData, 'mimetype') ||
          (rawType === 'sticker'
            ? 'image/webp'
            : rawType === 'ptt' || rawType === 'audio'
            ? 'audio/ogg; codecs=opus'
            : rawType === 'video' || rawType === 'ptv' || rawType === 'gif'
            ? 'video/mp4'
            : 'image/jpeg');

        const directPath = getProp(msg, 'directPath') || getProp(msg.mediaData, 'directPath');
        const encFilehash = getProp(msg, 'encFilehash') || getProp(msg.mediaData, 'encFilehash');
        const filehash = getProp(msg, 'filehash') || getProp(msg.mediaData, 'filehash');
        const mediaKey = getProp(msg, 'mediaKey') || getProp(msg.mediaData, 'mediaKey');
        const mediaKeyTimestamp = getProp(msg, 'mediaKeyTimestamp') || getProp(msg.mediaData, 'mediaKeyTimestamp');
        const targetType =
          rawType === 'view_once'
            ? (declaredMime.startsWith('video') ? 'video' : 'image')
            : (rawType || (declaredMime.startsWith('video') ? 'video' : 'image'));

        const renderableUrl = getProp(msg.mediaData, 'renderableUrl');
        if (typeof renderableUrl === 'string' && renderableUrl) {
          if (renderableUrl.startsWith('data:')) {
            return renderableUrl;
          }
          if (renderableUrl.startsWith('blob:')) {
            try {
              const res = await fetch(renderableUrl);
              const blob = await res.blob();
              const b64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(blob);
              });
              if (b64 && b64.startsWith('data:')) {
                return b64;
              }
            } catch (_) {}
          }
        }

        const mockQpl = {
          addAnnotations() {
            return this;
          },
          addPoint() {
            return this;
          },
        };

        let decryptedMedia: ArrayBuffer | null = null;
        try {
          decryptedMedia = await w
            .require('WAWebDownloadManager')
            .downloadManager.downloadAndMaybeDecrypt({
              directPath,
              encFilehash,
              filehash,
              mediaKey,
              mediaKeyTimestamp,
              type: targetType,
              mimetype: declaredMime,
              signal: new AbortController().signal,
              downloadQpl: mockQpl,
            });
        } catch (downloadErr) {
          console.warn('[WhatsApp Web] downloadAndMaybeDecrypt failed:', downloadErr);
        }

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

        // Se o download direto falhar, tenta recuperar preview/thumbnail base64 caso esteja disponível
        const fallbackPreview =
          (typeof getProp(msg, 'body') === 'string' && (getProp(msg, 'body') as string).length > 20 ? (getProp(msg, 'body') as string) : '') ||
          (typeof getProp(msg?.mediaData, 'preview')?._b64 === 'string' ? getProp(msg?.mediaData, 'preview')._b64 : '') ||
          (typeof getProp(msg?.mediaData, 'preview') === 'string' ? getProp(msg?.mediaData, 'preview') : '');
        if (fallbackPreview) {
          if (fallbackPreview.startsWith('data:')) return fallbackPreview;
          return `data:${declaredMime.split(';')[0].trim()};base64,${fallbackPreview}`;
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
    limit: number = 1000
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
            const safeLimit = Math.max(1, Math.min(Number(maxLimit) || 10, 1000));

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
        try {
          const rawName = p.name || p.pushname || p.user || 'Membro';
          const cleanName = String(rawName).replace(/^~/, '').trim() || 'Membro';
          let avatar = p.avatar || this.avatarCache.get(p.id);
          if (!avatar) {
            try {
              avatar = createInitialsAvatarDataUrl(cleanName);
            } catch {
              avatar = createInitialsAvatarDataUrl('Membro');
            }
          }
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
        } catch (itemErr) {
          console.warn('[WhatsAppService] Error mapping participant, using fallback:', itemErr);
          const safeId = p?.id || 'unknown';
          return {
            id: safeId,
            rawId: p?.rawId || safeId,
            user: p?.user || safeId.split('@')[0],
            name: 'Membro',
            pushname: undefined,
            avatar: createInitialsAvatarDataUrl('Membro'),
            isAdmin: Boolean(p?.isAdmin),
          };
        }
      });
    } catch (err) {
      console.error('[WhatsAppService] Error getting group participants:', err);
      return [];
    }
  }

  public async getGroupMetadata(
    chatId: string
  ): Promise<{
    description?: string;
    descOwner?: string;
    descTime?: number;
    createdAt?: number;
    owner?: string;
  } | null> {
    if (!chatId) return null;
    let description = '';
    let descOwner = '';
    let descTime: number | undefined;
    let createdAt: number | undefined;
    let owner = '';

    if (this.client?.pupPage && this.status === 'ready') {
      try {
        const res = await this.client.pupPage.evaluate(async (targetChatId: string) => {
          try {
            const w = window as any;
            if (typeof w.require !== 'function') return null;
            const collections = w.require('WAWebCollections');
            if (!collections) return null;
            const ChatCol = collections.Chat;

            const serializeId = (val: any): string => {
              if (!val) return '';
              if (typeof val === 'string') return val;
              if (typeof val._serialized === 'string' && val._serialized) return val._serialized;
              return '';
            };

            const chat =
              ChatCol?.get?.(targetChatId) ||
              ChatCol?.getModelsArray?.()?.find?.((c: any) => serializeId(c.id) === targetChatId);

            const GroupMetadataCol =
              collections.GroupMetadata || collections.WAWebGroupMetadataCollection;
            let groupMetadata =
              chat?.groupMetadata || (chat?.id?.server === 'g.us' ? chat.groupMetadata : null);

            if (!groupMetadata && GroupMetadataCol) {
              groupMetadata = GroupMetadataCol.get?.(targetChatId);
            }

            if (!groupMetadata || groupMetadata.desc === undefined) {
              try {
                const widFactory = w.require('WAWebWidFactory');
                const chatWid = widFactory?.createWid?.(targetChatId);
                if (GroupMetadataCol?.update && chatWid) {
                  await GroupMetadataCol.update(chatWid);
                  groupMetadata =
                    chat?.groupMetadata || GroupMetadataCol.get?.(targetChatId) || groupMetadata;
                }
              } catch (_) {}
            }

            if (!groupMetadata) return null;

            let descText = '';
            if (typeof groupMetadata.desc === 'string') {
              descText = groupMetadata.desc;
            } else if (groupMetadata.desc && typeof groupMetadata.desc.desc === 'string') {
              descText = groupMetadata.desc.desc;
            } else if (typeof groupMetadata.description === 'string') {
              descText = groupMetadata.description;
            }

            const serializeOwner = (o: any) => {
              if (!o) return '';
              if (typeof o === 'string') return o;
              if (o._serialized) return o._serialized;
              if (o.user) return o.user;
              return '';
            };

            return {
              description: descText,
              descOwner: serializeOwner(groupMetadata.descOwner),
              descTime: groupMetadata.descTime,
              createdAt: groupMetadata.creation,
              owner: serializeOwner(groupMetadata.owner),
            };
          } catch (err) {
            return null;
          }
        }, chatId);

        if (res) {
          description = res.description || '';
          descOwner = res.descOwner || '';
          descTime = res.descTime;
          createdAt = res.createdAt;
          owner = res.owner || '';
        }
      } catch (err) {
        console.warn('[WhatsAppService] Error getting group metadata via evaluate:', err);
      }
    }

    if (!description && this.client) {
      try {
        const chat = await this.client.getChatById(chatId).catch(() => null);
        if (chat && typeof (chat as any).description === 'string') {
          description = (chat as any).description;
        }
      } catch (_) {}
    }

    return {
      description,
      descOwner,
      descTime,
      createdAt,
      owner,
    };
  }

  public async getSavedContacts(query: string = ''): Promise<
    Array<{
      id: string;
      name: string;
      pushname?: string;
      phoneNumber?: string;
      avatar?: string;
      isMyContact?: boolean;
    }>
  > {
    if (!this.client?.pupPage || this.status !== 'ready') {
      return [];
    }

    try {
      const rawList = await this.client.pupPage.evaluate(async (queryStr: string) => {
        const w = window as any;
        if (typeof w.require !== 'function') return [];
        const collections = w.require('WAWebCollections');
        if (!collections) return [];
        const ContactCol = collections.Contact;
        const ProfilePicThumb = collections.ProfilePicThumb;
        const ContactGetters = w.require('WAWebContactGetters');
        const widFactory = w.require('WAWebWidFactory');
        const lidUtils = w.require('WAWebLidMigrationUtils');

        const serializeId = (val: any): string => {
          if (!val) return '';
          if (typeof val === 'string') return val;
          if (typeof val._serialized === 'string' && val._serialized) return val._serialized;
          return '';
        };

        const loadIdbContactData = async (): Promise<{ map: Map<string, any>; list: any[] }> => {
          return new Promise((resolve) => {
            const timer = setTimeout(() => resolve({ map: new Map(), list: [] }), 800);
            try {
              const req = window.indexedDB.open('model-storage');
              req.onerror = () => {
                clearTimeout(timer);
                resolve({ map: new Map(), list: [] });
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
                    resolve({ map: new Map(), list: [] });
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
                        const strId = serializeId(item.id);
                        if (strId) map.set(strId, item);
                        if (item.phoneNumber) {
                          const pn = serializeId(item.phoneNumber);
                          if (pn) {
                            map.set(pn, item);
                            const clean = pn.split('@')[0];
                            if (clean) map.set(clean, item);
                          }
                        }
                      }
                    }
                    resolve({ map, list });
                  };
                  getAllReq.onerror = () => {
                    clearTimeout(timer);
                    resolve({ map: new Map(), list: [] });
                  };
                } catch (_) {
                  clearTimeout(timer);
                  resolve({ map: new Map(), list: [] });
                }
              };
            } catch (_) {
              clearTimeout(timer);
              resolve({ map: new Map(), list: [] });
            }
          });
        };

        const { map: idbMap, list: idbList } = await loadIdbContactData();
        const allModels = ContactCol?.getModelsArray ? ContactCol.getModelsArray() : [];

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

        const normalize = (str: any) =>
          typeof str === 'string'
            ? str
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim()
            : '';

        const q = normalize(queryStr);
        const resultMap = new Map<string, any>();

        // Combina instâncias do ContactCol e itens do IndexedDB
        const candidateItems: any[] = [...allModels, ...idbList];

        for (const item of candidateItems) {
          if (!item) continue;
          const rawId = serializeId(item.id);
          if (!rawId) continue;

          const isGroup = Boolean(
            item.isGroup ||
            item.groupMetadata ||
            rawId.endsWith('@g.us') ||
            item.id?.server === 'g.us'
          );
          const isBroadcast = Boolean(
            item.isBroadcast ||
            rawId.endsWith('@broadcast') ||
            item.id?.server === 'broadcast'
          );
          const isNewsletter = Boolean(
            item.isNewsletter ||
            rawId.endsWith('@newsletter') ||
            item.id?.server === 'newsletter'
          );
          const isMe = Boolean(item.isMe);

          if (isGroup || isBroadcast || isNewsletter || isMe) continue;

          let targetChatId = rawId;
          let phoneDigits = '';

          // Se for conta @lid, resolve o número de telefone real
          if (rawId.endsWith('@lid')) {
            if (item.phoneNumber) {
              const pn = serializeId(item.phoneNumber);
              if (pn) {
                targetChatId = pn;
                phoneDigits = pn.split('@')[0].replace(/\D/g, '');
              }
            }
            if (!phoneDigits && lidUtils?.toPn && widFactory?.createWid) {
              try {
                const widLid = widFactory.createWid(rawId);
                const pnWid = lidUtils.toPn(widLid);
                const pnSid = serializeId(pnWid);
                if (pnSid) {
                  targetChatId = pnSid;
                  phoneDigits = pnSid.split('@')[0].replace(/\D/g, '');
                }
              } catch (_) {}
            }
            if (!phoneDigits) {
              const idbMatch = idbMap.get(rawId);
              if (idbMatch?.phoneNumber) {
                const pn = serializeId(idbMatch.phoneNumber);
                if (pn) {
                  targetChatId = pn;
                  phoneDigits = pn.split('@')[0].replace(/\D/g, '');
                }
              }
            }
          }

          if (!phoneDigits) {
            phoneDigits = targetChatId.split('@')[0].replace(/\D/g, '');
          }

          // Padroniza targetChatId para formato canônico @c.us quando há dígitos
          if (phoneDigits && phoneDigits.length >= 8) {
            targetChatId = `${phoneDigits}@c.us`;
          }

          // Chave de deduplicação normalizada (unifica números com ou sem 9º dígito no Brasil)
          let dedupKey = phoneDigits;
          if (phoneDigits.startsWith('55') && (phoneDigits.length === 12 || phoneDigits.length === 13)) {
            const ddd = phoneDigits.slice(2, 4);
            const last8 = phoneDigits.slice(-8);
            dedupKey = `55${ddd}${last8}`;
          }
          if (!dedupKey) {
            dedupKey = targetChatId;
          }

          let savedName = '';
          if (ContactGetters?.getName) {
            try { savedName = ContactGetters.getName(item) || ''; } catch (_) {}
          }
          if (!savedName) {
            savedName =
              (typeof item.get === 'function'
                ? item.get('name') || item.get('displayName') || item.get('formattedTitle')
                : '') ||
              item.name ||
              item.displayName ||
              item.formattedTitle ||
              item.attributes?.name ||
              item.attributes?.displayName ||
              item.attributes?.formattedTitle ||
              '';
          }
          if (!savedName && (item.isBusiness || item.isEnterprise)) {
            savedName =
              item.verifiedName ||
              item.attributes?.verifiedName ||
              (ContactGetters?.getVerifiedName ? ContactGetters.getVerifiedName(item) : '') ||
              '';
          }

          const idbItem = idbMap.get(rawId) || idbMap.get(targetChatId);
          if (!savedName && idbItem) {
            savedName = idbItem.name || idbItem.displayName || idbItem.formattedTitle || '';
          }

          const cleanSaved = (savedName || '').replace(/^~/, '').trim();
          const pushname = (item.pushname || item.notifyName || idbItem?.pushname || '').replace(/^~/, '').trim();

          const formattedPhone = formatPhone(phoneDigits);

          const isSavedContact = Boolean(
            item.isMyContact ||
            item.isAddressBookContact ||
            idbItem?.isMyContact ||
            idbItem?.isAddressBookContact ||
            (cleanSaved && cleanSaved !== phoneDigits && cleanSaved !== formattedPhone && cleanSaved !== pushname)
          );

          if (!q && !isSavedContact) continue;

          const displayName = cleanSaved || pushname || formattedPhone || phoneDigits;
          if (!displayName) continue;

          if (q) {
            const normName = normalize(displayName);
            const normPush = normalize(pushname);
            const normPhone = normalize(formattedPhone);
            const normDigits = phoneDigits;
            if (
              !normName.includes(q) &&
              !normPush.includes(q) &&
              !normPhone.includes(q) &&
              !normDigits.includes(q)
            ) {
              continue;
            }
          }

          // Se já existe um registro para esse mesmo número, faz merge inteligente preservando o melhor modelo/avatar
          if (resultMap.has(dedupKey)) {
            const existing = resultMap.get(dedupKey);
            const isFromContactCol = Boolean(item.attributes || typeof item.get === 'function');
            if (isFromContactCol) {
              existing.rawModel = item;
            }
            if (!existing.isMyContact && isSavedContact) {
              existing.name = displayName;
              existing.isMyContact = true;
            }
            if (targetChatId.endsWith('@c.us')) {
              existing.id = targetChatId;
            }
            continue;
          }

          resultMap.set(dedupKey, {
            id: targetChatId,
            name: displayName,
            pushname,
            phoneNumber: formattedPhone,
            isMyContact: isSavedContact,
            rawModel: item,
          });
        }

        const list = Array.from(resultMap.values());

        await Promise.all(
          list.slice(0, 150).map(async (c: any) => {
            try {
              const pic =
                ProfilePicThumb?.get?.(c.id) ||
                ProfilePicThumb?.get?.(c.rawModel?.id) ||
                c.rawModel?.profilePicThumb;
              let url = pic?.eurl || pic?.img || pic?.imgFull || '';
              if (!url && ProfilePicThumb?.find) {
                const found: any = await Promise.race([
                  ProfilePicThumb.find(c.rawModel?.id || c.id),
                  new Promise((r) => setTimeout(() => r(null), 120)),
                ]);
                url = found?.eurl || found?.img || found?.imgFull || '';
              }
              c.avatar = url || '';
            } catch (_) {
              c.avatar = '';
            }
            delete c.rawModel;
          })
        );

        for (const c of list) {
          delete c.rawModel;
        }

        list.sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', 'pt-BR', { sensitivity: 'base' })
        );

        return list;
      }, query);

      return (rawList || []).map((c: any) => {
        try {
          const rawName = c.name || c.pushname || c.phoneNumber || 'Contato';
          const cleanName = String(rawName).replace(/^~/, '').trim() || 'Contato';
          let avatar = c.avatar || this.avatarCache.get(c.id);
          if (!avatar) {
            try {
              avatar = createInitialsAvatarDataUrl(cleanName);
            } catch {
              avatar = createInitialsAvatarDataUrl('Contato');
            }
          }
          if (c.avatar) {
            this.avatarCache.set(c.id, c.avatar);
          }
          return {
            id: c.id,
            name: cleanName,
            pushname: c.pushname || undefined,
            phoneNumber: c.phoneNumber || undefined,
            avatar,
            isMyContact: Boolean(c.isMyContact),
          };
        } catch (itemErr) {
          console.warn('[WhatsAppService] Error mapping contact, using fallback:', itemErr);
          return {
            id: c?.id || 'unknown',
            name: 'Contato',
            pushname: undefined,
            phoneNumber: undefined,
            avatar: createInitialsAvatarDataUrl('Contato'),
            isMyContact: Boolean(c?.isMyContact),
          };
        }
      });
    } catch (err) {
      console.error('[WhatsAppService] Error getting saved contacts:', err);
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
    sendAudioAsVoice?: boolean;
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
          const fullMatch = /^data:([^;,]+(?:;\s*codecs=[^;,]+)?)/i.exec(header);
          if (fullMatch) {
            mimetype = fullMatch[1].trim();
          } else {
            const mimeMatch = /^data:([^;]+)/i.exec(header);
            if (mimeMatch) {
              mimetype = mimeMatch[1].trim();
            }
          }
        }
      } else if (fs.existsSync(payload.mediaDataUrl)) {
        const ext = (path.extname(payload.mediaDataUrl) || '').toLowerCase();
        if (ext === '.png') mimetype = 'image/png';
        else if (ext === '.webp') mimetype = 'image/webp';
        else if (ext === '.gif') mimetype = 'image/gif';
        else if (ext === '.mp4') mimetype = 'video/mp4';
        else if (ext === '.mov') mimetype = 'video/quicktime';
        else if (ext === '.ogg' || ext === '.opus') mimetype = 'audio/ogg; codecs=opus';
        else if (ext === '.mp3') mimetype = 'audio/mp3';
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

      if (payload.sendAudioAsVoice) {
        try {
          const inputBuf = Buffer.from(base64Data, 'base64');
          const { buffer: oggBuf, isOgg } = await convertAudioToWhatsAppVoiceOgg(inputBuf);
          if (isOgg) {
            base64Data = oggBuf.toString('base64');
            mimetype = 'audio/ogg; codecs=opus';
          }
        } catch (convErr) {
          console.warn('[WhatsAppService] Falha na conversão para OGG, mantendo original:', convErr);
        }
      }

      const defaultFilename = payload.sendAudioAsVoice
        ? 'voice.ogg'
        : mimetype.startsWith('video/')
        ? 'video.mp4'
        : mimetype.startsWith('audio/')
        ? 'audio.mp3'
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
        sendAudioAsVoice?: boolean;
      } = {};
      if (payload.caption) {
        options.caption = payload.caption;
      }
      if (payload.quotedMessageId) {
        options.quotedMessageId = payload.quotedMessageId;
      }
      if (payload.sendAudioAsVoice) {
        options.sendAudioAsVoice = true;
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

      const infoMsg = `Iniciando envio de mídia (${mimetype}, ${filename}, ${base64Data.length} chars) para ${payload.chatId} (sendAudioAsVoice: ${Boolean(payload.sendAudioAsVoice)})`;
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
        } else if (options.sendAudioAsVoice) {
          console.log('[WhatsAppService] Tentando reenviar áudio sem flag sendAudioAsVoice...');
          logMediaDebug('Tentando reenviar áudio sem flag sendAudioAsVoice...');
          delete options.sendAudioAsVoice;
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
      if (latest && (latest.type === 'image' || latest.type === 'video' || latest.type === 'audio')) {
        if (latest.id) {
          this.mediaCache.set(latest.id, payload.mediaDataUrl);
        }
        if (latest.type === 'image') {
          latest.imageUrl = payload.mediaDataUrl;
          latest.isHdLoaded = true;
        } else if (latest.type === 'video') {
          latest.videoUrl = payload.mediaDataUrl;
          latest.isHdLoaded = true;
        } else if (latest.type === 'audio') {
          if (!latest.audioData) {
            latest.audioData = {
              duration: '0:05',
              durationSeconds: 5,
              senderAvatar: this.myAvatarUrl,
              waveform: [],
            };
          }
          if (latest.audioData) {
            latest.audioData.audioUrl = payload.mediaDataUrl;
          }
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

          // Se estava marcado como não lido manualmente, limpa através do Cmd.markChatUnread(chat, false)
          const Cmd = w.require?.('WAWebCmd')?.Cmd;
          if (Cmd?.markChatUnread && (chat.unreadCount === -1 || chat.markedAsUnread)) {
            try {
              await Cmd.markChatUnread(chat, false);
            } catch (_) {}
          }

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
          try {
            chat.unreadMentionCount = 0;
            chat.hasUnreadMention = false;
            chat.markedAsUnread = false;
          } catch (_) {}
        } catch (err) {
          console.error('[WhatsApp Web] sendSeen internal error:', err);
        }
      }, chatId);
    } catch (err) {
      console.error('[WhatsAppService] Error in markAsRead:', err);
    }
  }

  public async markAsUnread(chatId: string): Promise<void> {
    if (!this.client?.pupPage || this.status !== 'ready') {
      return;
    }
    try {
      if (typeof (this.client as any).markChatUnread === 'function') {
        try {
          await (this.client as any).markChatUnread(chatId);
          console.log('[WhatsAppService] markAsUnread called via client.markChatUnread for:', chatId);
          return;
        } catch (clientErr) {
          console.warn('[WhatsAppService] this.client.markChatUnread failed, using pupPage evaluate fallback:', clientErr);
        }
      }

      await this.client.pupPage.evaluate(async (targetChatId: string) => {
        const w = window as any;

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
          const Stream = w.require?.('WAWebStreamModel')?.Stream;
          Stream?.markAvailable?.();

          const ChatCol = w.require?.('WAWebCollections')?.Chat;
          let chat =
            (await w.WWebJS?.getChat?.(targetChatId, { getAsModel: false })) ||
            ChatCol?.get?.(targetChatId) ||
            ChatCol?.getModelsArray?.().find((c: any) => serializeId(c.id) === targetChatId);

          if (!chat && ChatCol) {
            const wid = w.require?.('WAWebWidFactory')?.createWid?.(targetChatId);
            if (wid) {
              chat = ChatCol.get(wid);
            }
          }

          if (!chat) return;

          const Cmd = w.require?.('WAWebCmd')?.Cmd;
          if (Cmd?.markChatUnread) {
            await Cmd.markChatUnread(chat, true);
          } else {
            const actionMod = w.require?.('WAWebUpdateUnreadChatAction');
            if (actionMod?.markChatUnread) {
              await actionMod.markChatUnread(chat, true);
            }
          }

          chat.unreadCount = -1;
          chat.markedAsUnread = true;
        } catch (err) {
          console.error('[WhatsApp Web] markChatUnread internal error:', err);
        }
      }, chatId);
    } catch (err) {
      console.error('[WhatsAppService] Error in markAsUnread:', err);
    }
  }

  public async sendReaction(chatId: string, messageId: string, reaction: string): Promise<boolean> {
    if (!this.client?.pupPage || this.status !== 'ready') {
      return false;
    }
    try {
      const success = await this.client.pupPage.evaluate(
        async ({ chatId, messageId, reaction }: { chatId: string; messageId: string; reaction: string }) => {
          const w = window as any;
          if (typeof w.require !== 'function') return false;

          const serializeId = (val: any): string => {
            if (!val) return '';
            if (typeof val === 'string') return val;
            return val._serialized || val.id || '';
          };

          try {
            const collections = w.require('WAWebCollections');
            let msg = collections.Msg?.get?.(messageId);
            if (!msg && collections.Msg?.getMessagesById) {
              const res = await collections.Msg.getMessagesById([messageId]);
              msg = res?.messages?.[0];
            }
            if (!msg && chatId) {
              const chat =
                collections.Chat?.get?.(chatId) ||
                collections.Chat?.getModelsArray?.().find((c: any) => serializeId(c.id) === chatId);
              const models = chat?.msgs?.getModelsArray?.() || [];
              msg = models.find((m: any) => {
                const id = serializeId(m.id);
                return id === messageId;
              });
            }
            if (!msg) {
              console.warn('[WhatsAppService] Could not find message to react:', messageId);
              return false;
            }

            const sendReactionAction = w.require('WAWebSendReactionMsgAction');
            if (sendReactionAction?.sendReactionToMsg) {
              await sendReactionAction.sendReactionToMsg(msg, reaction || '');
              return true;
            }
            return false;
          } catch (innerErr) {
            console.error('[WhatsAppService] sendReaction evaluate error:', innerErr);
            return false;
          }
        },
        { chatId, messageId, reaction }
      );
      return Boolean(success);
    } catch (err) {
      console.error('[WhatsAppService] Error in sendReaction:', err);
      return false;
    }
  }

  public async forwardMessages(payload: {
    targetChatId: string;
    messageIds: string[];
  }): Promise<{ success: boolean; forwardedCount: number }> {
    if (!this.client?.pupPage || this.status !== 'ready') {
      return { success: false, forwardedCount: 0 };
    }

    try {
      const res = await this.client.pupPage.evaluate(
        async ({ targetChatId, messageIds }: { targetChatId: string; messageIds: string[] }) => {
          const w = window as any;
          if (typeof w.require !== 'function') return { success: false, forwardedCount: 0 };

          const serializeId = (val: any): string => {
            if (!val) return '';
            if (typeof val === 'string') return val;
            return val._serialized || val.id || '';
          };

          const collections = w.require('WAWebCollections');
          const MsgCollection = collections?.Msg;

          // Obtém o chat de destino
          let targetChat: any = null;
          if (w.WWebJS?.getChat) {
            try {
              targetChat = await w.WWebJS.getChat(targetChatId, { getAsModel: false });
            } catch (err) {
              console.warn('[forwardMessages] WWebJS.getChat error:', err);
            }
          }
          if (!targetChat) {
            targetChat =
              collections.Chat?.get?.(targetChatId) ||
              collections.Chat?.getModelsArray?.().find((c: any) => serializeId(c.id) === targetChatId);
          }
          if (!targetChat && collections.Chat?.find) {
            try {
              targetChat = await collections.Chat.find(targetChatId);
            } catch (_) {}
          }
          if (!targetChat) {
            console.error('[forwardMessages] Destino não encontrado:', targetChatId);
            return { success: false, forwardedCount: 0 };
          }

          let forwardedCount = 0;
          for (const msgId of messageIds) {
            try {
              let msg = MsgCollection?.get?.(msgId);
              if (!msg && MsgCollection?.getMessagesById) {
                const fetched = await MsgCollection.getMessagesById([msgId]);
                msg = fetched?.messages?.[0];
              }

              if (!msg) {
                const allChats = collections.Chat?.getModelsArray?.() || [];
                for (const c of allChats) {
                  const mList = c?.msgs?.getModelsArray?.() || [];
                  const found = mList.find((m: any) => serializeId(m.id) === msgId);
                  if (found) {
                    msg = found;
                    break;
                  }
                }
              }

              if (msg) {
                const forwardAction = w.require('WAWebChatForwardMessage');
                if (forwardAction?.forwardMessages) {
                  await forwardAction.forwardMessages({
                    chat: targetChat,
                    msgs: [msg],
                    multicast: true,
                    includeCaption: true,
                    appendedText: undefined,
                  });
                  forwardedCount++;
                } else if (w.WWebJS?.forwardMessage) {
                  await w.WWebJS.forwardMessage(targetChatId, msgId);
                  forwardedCount++;
                }
              } else {
                console.warn('[forwardMessages] Mensagem não encontrada para forward:', msgId);
              }
            } catch (itemErr) {
              console.error('[forwardMessages] Erro ao encaminhar mensagem:', msgId, itemErr);
            }
          }

          return { success: forwardedCount > 0, forwardedCount };
        },
        payload
      );

      return res;
    } catch (err) {
      console.error('[WhatsAppService] Error in forwardMessages:', err);
      return { success: false, forwardedCount: 0 };
    }
  }

  public async getHighResProfilePic(chatId: string): Promise<string | null> {
    if (!this.client || this.status !== 'ready') return null;
    try {
      if (typeof (this.client as any).getProfilePicUrl === 'function') {
        const url = await (this.client as any).getProfilePicUrl(chatId).catch(() => null);
        if (url && typeof url === 'string') return url;
      }
      if (this.client.pupPage) {
        const hdUrl = await this.client.pupPage.evaluate(async (targetChatId: string) => {
          const w = window as any;
          try {
            const ProfilePicThumb = w.require?.('WAWebCollections')?.ProfilePicThumb;
            const pic = ProfilePicThumb?.get?.(targetChatId);
            if (pic?.imgFull) return pic.imgFull;
            if (pic?.eurl) return pic.eurl;
            if (ProfilePicThumb?.find) {
              const found = await ProfilePicThumb.find(targetChatId).catch(() => null);
              if (found?.imgFull) return found.imgFull;
              if (found?.eurl) return found.eurl;
            }
            return pic?.img || null;
          } catch (_) {
            return null;
          }
        }, chatId);
        if (hdUrl && typeof hdUrl === 'string') return hdUrl;
      }
    } catch (err) {
      console.warn('[WhatsAppService] Error fetching high res profile pic:', err);
    }
    return null;
  }

  public async toggleMute(chatId: string, mute?: boolean): Promise<boolean> {
    if (!this.client?.pupPage || this.status !== 'ready') {
      return false;
    }
    try {
      const chat = await this.client.getChatById(chatId).catch(() => null);
      if (chat) {
        const shouldMute = mute !== undefined ? mute : !chat.isMuted;
        if (shouldMute) {
          const unmuteDate = new Date();
          unmuteDate.setFullYear(unmuteDate.getFullYear() + 1);
          await chat.mute(unmuteDate).catch(() => null);
        } else {
          await chat.unmute().catch(() => null);
        }
        return true;
      }
    } catch (err) {
      console.warn('[WhatsAppService] Error in toggleMute via getChatById, using page fallback:', err);
    }

    try {
      await this.client.pupPage.evaluate(
        async ({ targetChatId, shouldMute }: { targetChatId: string; shouldMute?: boolean }) => {
          const w = window as any;
          try {
            const ChatCol = w.require?.('WAWebCollections')?.Chat;
            const chat = ChatCol?.get?.(targetChatId);
            if (chat) {
              const isCurrentlyMuted = Boolean(chat.mute?.expiration && chat.mute.expiration !== 0);
              const doMute = shouldMute !== undefined ? shouldMute : !isCurrentlyMuted;
              const Cmd = w.require?.('WAWebCmd')?.Cmd;
              if (Cmd?.muteChat) {
                await Cmd.muteChat(chat, doMute ? -1 : 0);
              } else if (doMute && typeof chat.mute === 'function') {
                await chat.mute({ expiration: -1 });
              } else if (!doMute && typeof chat.unmute === 'function') {
                await chat.unmute();
              }
            }
          } catch (_) {}
        },
        { targetChatId: chatId, shouldMute: mute }
      );
      return true;
    } catch (evalErr) {
      console.error('[WhatsAppService] Error in toggleMute evaluate:', evalErr);
      return false;
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
