import { app, BrowserWindow, dialog, ipcMain, screen, shell, clipboard, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { WhatsAppService } from './whatsappClient';

let mainWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let waService: WhatsAppService | null = null;
let selectedDisplayId: number | null = null;

const MAX_OVERLAY_WIDTH = 1200;

interface SavedDisplayPref {
  displayId: number;
  label?: string;
  bounds?: { x: number; y: number; width: number; height: number };
}

function loadSavedDisplayPref(): SavedDisplayPref | null {
  try {
    const prefFile = path.join(app.getPath('userData'), 'display-pref.json');
    if (fs.existsSync(prefFile)) {
      const parsed = JSON.parse(fs.readFileSync(prefFile, 'utf-8'));
      if (typeof parsed.displayId === 'number') {
        return parsed;
      }
    }
  } catch {
    // Ignore read error
  }
  return null;
}

function saveDisplayPreference(target: Electron.Display) {
  try {
    const prefFile = path.join(app.getPath('userData'), 'display-pref.json');
    fs.writeFileSync(
      prefFile,
      JSON.stringify({
        displayId: target.id,
        label: target.label || '',
        bounds: target.bounds,
      }),
      'utf-8'
    );
  } catch {
    // Ignore write error
  }
}

function getTargetDisplay(): Electron.Display {
  const allDisplays = screen.getAllDisplays();
  if (allDisplays.length === 0) {
    return screen.getPrimaryDisplay();
  }

  const pref = loadSavedDisplayPref();
  const searchId = selectedDisplayId ?? pref?.displayId;

  if (searchId !== null && searchId !== undefined) {
    const found = allDisplays.find((d) => d.id === searchId);
    if (found) return found;
  }

  if (pref?.label) {
    const foundByLabel = allDisplays.find((d) => d.label === pref.label);
    if (foundByLabel) return foundByLabel;
  }

  if (pref?.bounds) {
    const foundByBounds = allDisplays.find(
      (d) =>
        d.bounds.width === pref.bounds?.width &&
        d.bounds.height === pref.bounds?.height &&
        d.bounds.x === pref.bounds?.x &&
        d.bounds.y === pref.bounds?.y
    );
    if (foundByBounds) return foundByBounds;
  }

  return screen.getPrimaryDisplay();
}

function positionWindowBottomRight(win: BrowserWindow) {
  if (!win || win.isDestroyed()) return;
  const targetDisplay = getTargetDisplay();
  const { x, y, width, height } = targetDisplay.workArea;
  const overlayWidth = Math.min(width, MAX_OVERLAY_WIDTH);
  const overlayHeight = height;
  const targetX = Math.round(x + width - overlayWidth);
  const targetY = Math.round(y + height - overlayHeight);

  win.setBounds({
    x: targetX,
    y: targetY,
    width: Math.round(overlayWidth),
    height: Math.round(overlayHeight),
  });
}

function createOverlayWindow() {
  const targetDisplay = getTargetDisplay();
  selectedDisplayId = targetDisplay.id;
  const { x, y, width, height } = targetDisplay.workArea;
  const overlayWidth = Math.min(width, MAX_OVERLAY_WIDTH);
  const overlayHeight = height;
  const targetX = Math.round(x + width - overlayWidth);
  const targetY = Math.round(y + height - overlayHeight);

  mainWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: targetX,
    y: targetY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Corrige imediatamente a limitação de altura que o Windows impõe na criação inicial do BrowserWindow
  positionWindowBottomRight(mainWindow);

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      positionWindowBottomRight(mainWindow);
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      positionWindowBottomRight(mainWindow);
    }
  });

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      positionWindowBottomRight(mainWindow);
    }
  }, 350);

  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      positionWindowBottomRight(mainWindow);
    }
  }, 1000);

  // Always on top above regular windows and popups
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  // Critical: Default to click-through so transparent areas pass clicks to Windows desktop/apps
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  // Intercepta qualquer abertura de links externos para abrir no navegador padrão do Windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl && url.startsWith(devServerUrl)) {
      return;
    }
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  waService = new WhatsAppService(mainWindow);

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
      settingsWindow = null;
    }
  });

  screen.on('display-metrics-changed', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      positionWindowBottomRight(mainWindow);
    }
  });

  screen.on('display-added', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      positionWindowBottomRight(mainWindow);
    }
  });

  screen.on('display-removed', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      positionWindowBottomRight(mainWindow);
    }
  });
}

function registerIpcHandlers() {
  ipcMain.on('window:set-ignore-mouse', (_event, ignore: boolean) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (ignore) {
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      mainWindow.setIgnoreMouseEvents(false);
    }
  });

  ipcMain.on('app:quit', () => {
    app.quit();
  });

  ipcMain.handle('window:open-settings', async () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      if (settingsWindow.isMinimized()) {
        settingsWindow.restore();
      }
      settingsWindow.show();
      settingsWindow.focus();
      return;
    }

    const targetDisplay = getTargetDisplay();
    const { x, y, width, height } = targetDisplay.workArea;
    const dialogWidth = 410;
    const dialogHeight = 580;

    settingsWindow = new BrowserWindow({
      width: dialogWidth,
      height: dialogHeight,
      x: Math.round(x + (width - dialogWidth) / 2),
      y: Math.round(y + (height - dialogHeight) / 2),
      title: 'Configurações — WhatsApp Bubbles',
      transparent: true,
      frame: false,
      resizable: false,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      hasShadow: true,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    settingsWindow.setAlwaysOnTop(true, 'pop-up-menu');

    const devServerUrl = process.env.VITE_DEV_SERVER_URL;
    if (devServerUrl) {
      await settingsWindow.loadURL(`${devServerUrl}?view=settings`);
    } else {
      await settingsWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
        query: { view: 'settings' },
      });
    }

    settingsWindow.on('closed', () => {
      settingsWindow = null;
    });
  });

  ipcMain.on('window:close-settings', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
      settingsWindow = null;
    }
  });

  ipcMain.on('settings:broadcast', (_event, patch: Record<string, unknown>) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings:updated', patch);
    }
  });

  ipcMain.handle('wa:refresh', async () => {
    if (!waService) return [];
    return await waService.refresh();
  });

  ipcMain.on('window:reload', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.reload();
    }
  });

  ipcMain.handle('wa:logout', async () => {
    if (!waService) return false;
    return await waService.logout();
  });

  ipcMain.handle('window:get-displays', async () => {
    const primary = screen.getPrimaryDisplay();
    const allDisplays = screen.getAllDisplays();
    const activeTarget = getTargetDisplay();
    return {
      currentDisplayId: activeTarget.id,
      displays: allDisplays.map((d, idx) => {
        const isPrimary = d.id === primary.id;
        const namePart = d.label ? ` (${d.label})` : '';
        return {
          id: d.id,
          isPrimary,
          bounds: d.bounds,
          label: `Tela ${idx + 1}${isPrimary ? ' (Principal)' : ''}${namePart} — ${d.bounds.width}x${d.bounds.height}`,
        };
      }),
    };
  });

  ipcMain.handle('window:set-display', async (_event, displayId: number) => {
    selectedDisplayId = displayId;
    const targetDisplay = getTargetDisplay();
    saveDisplayPreference(targetDisplay);
    if (mainWindow && !mainWindow.isDestroyed()) {
      positionWindowBottomRight(mainWindow);
    }
    return true;
  });

  ipcMain.handle('wa:init', async () => {
    if (!waService) return { status: 'disconnected', qrDataUrl: null };
    return await waService.initialize();
  });

  ipcMain.handle('wa:get-status', async () => {
    if (!waService) return { status: 'disconnected', qrDataUrl: null, error: null };
    return waService.getStatus();
  });

  ipcMain.handle('wa:get-chats', async () => {
    if (!waService) return [];
    return await waService.getRecentChats();
  });

  ipcMain.handle('wa:get-messages', async (_event, chatId: string, limit?: number) => {
    if (!waService) return [];
    return await waService.getMessages(chatId, limit);
  });

  ipcMain.handle(
    'wa:get-group-participants',
    async (_event, chatId: string, query?: string, limit?: number) => {
      if (!waService) return [];
      return await waService.getGroupParticipants(chatId, query, limit || 1000);
    }
  );

  ipcMain.handle('wa:get-group-metadata', async (_event, chatId: string) => {
    if (!waService) return null;
    return await waService.getGroupMetadata(chatId);
  });

  ipcMain.handle('wa:get-saved-contacts', async (_event, query?: string) => {
    if (!waService) return [];
    return await waService.getSavedContacts(query);
  });

  ipcMain.handle('wa:get-sfx', async (_event, type: 'user' | 'group', preset = 'default') => {
    try {
      const prefix = type === 'group' ? 'group' : 'user';
      let baseName = `${prefix}-notification`;
      if (preset === 'crystal') {
        baseName = `${prefix}-crystal`;
      } else if (preset === 'pop') {
        baseName = `${prefix}-pop`;
      } else if (preset === 'custom') {
        baseName = `custom-${prefix}`;
      }

      const searchDirs = [
        path.join(process.cwd(), 'sfx'),
        path.join(__dirname, '../sfx'),
        path.join(__dirname, '../public/sfx'),
      ];
      const exts: Array<{ ext: string; mime: string }> = [
        { ext: '.mp3', mime: 'audio/mpeg' },
        { ext: '.wav', mime: 'audio/wav' },
        { ext: '.ogg', mime: 'audio/ogg' },
      ];

      for (const dir of searchDirs) {
        for (const { ext, mime } of exts) {
          const candidate = path.join(dir, `${baseName}${ext}`);
          if (fs.existsSync(candidate)) {
            const buf = fs.readFileSync(candidate);
            return `data:${mime};base64,${buf.toString('base64')}`;
          }
        }
      }
      return null;
    } catch (err) {
      console.error('[main] Error loading sfx:', err);
      return null;
    }
  });

  ipcMain.handle('wa:select-custom-sound', async (_event, type: 'user' | 'group') => {
    try {
      const res = await dialog.showOpenDialog({
        title:
          type === 'group'
            ? 'Escolher áudio de notificação para Grupos'
            : 'Escolher áudio de notificação para Contatos',
        filters: [
          { name: 'Arquivos de Áudio', extensions: ['mp3', 'wav', 'ogg'] },
        ],
        properties: ['openFile'],
      });

      if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
        return null;
      }

      const sourcePath = res.filePaths[0];
      const ext = path.extname(sourcePath).toLowerCase() || '.wav';
      const mime =
        ext === '.mp3' ? 'audio/mpeg' : ext === '.ogg' ? 'audio/ogg' : 'audio/wav';
      const prefix = type === 'group' ? 'group' : 'user';

      const sfxDir = path.join(process.cwd(), 'sfx');
      if (!fs.existsSync(sfxDir)) {
        fs.mkdirSync(sfxDir, { recursive: true });
      }

      // Remove versões customizadas anteriores com outras extensões
      for (const oldExt of ['.mp3', '.wav', '.ogg']) {
        const oldFile = path.join(sfxDir, `custom-${prefix}${oldExt}`);
        if (fs.existsSync(oldFile)) {
          fs.unlinkSync(oldFile);
        }
      }

      const targetPath = path.join(sfxDir, `custom-${prefix}${ext}`);
      fs.copyFileSync(sourcePath, targetPath);

      const buf = fs.readFileSync(targetPath);
      return {
        fileName: path.basename(sourcePath),
        dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
      };
    } catch (err) {
      console.error('[main] Error selecting custom sound:', err);
      return null;
    }
  });

  ipcMain.handle('wa:download-media', async (_event, msgId: string) => {
    if (!waService) return null;
    return await waService.downloadMedia(msgId);
  });

  ipcMain.handle('wa:open-external-image', async (_event, dataUrl: string) => {
    try {
      const match = /^data:(image|video)\/([a-zA-Z0-9+.-]+);base64,(.+)$/.exec(dataUrl);
      if (!match) return false;
      const mediaKind = match[1];
      const subtype = match[2];
      const ext =
        mediaKind === 'video'
          ? subtype === 'webm'
            ? 'webm'
            : 'mp4'
          : subtype === 'jpeg'
          ? 'jpg'
          : subtype === 'webp'
          ? 'webp'
          : 'png';
      const base64Data = match[3];
      const tempDir = path.join(app.getPath('temp'), 'whatsapp-bubbles-images');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const prefix = mediaKind === 'video' ? 'wa-vid' : 'wa-img';
      const filePath = path.join(tempDir, `${prefix}-${Date.now()}.${ext}`);
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
      await shell.openPath(filePath);
      return true;
    } catch (err) {
      console.error('[main] Error opening external media:', err);
      return false;
    }
  });

  ipcMain.handle('wa:open-external-url', async (_event, rawUrl: string) => {
    try {
      if (!rawUrl || typeof rawUrl !== 'string') return false;
      let target = rawUrl.trim();
      if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target)) {
        target = `https://${target}`;
      }
      await shell.openExternal(target);
      return true;
    } catch (err) {
      console.error('[main] Error opening external url:', err);
      return false;
    }
  });

  ipcMain.handle(
    'wa:send-message',
    async (
      _event,
      payload: { chatId: string; text: string; quotedMessageId?: string; mentions?: string[] }
    ) => {
      if (!waService) return null;
      return await waService.sendMessage(payload);
    }
  );

  ipcMain.handle(
    'wa:send-sticker',
    async (
      _event,
      payload: { chatId: string; stickerDataUrl: string; quotedMessageId?: string }
    ) => {
      if (!waService) return null;
      return await waService.sendSticker(payload);
    }
  );

  ipcMain.handle(
    'wa:send-media',
    async (
      _event,
      payload: {
        chatId: string;
        mediaDataUrl: string;
        caption?: string;
        filename?: string;
        quotedMessageId?: string;
        mentions?: string[];
        sendAudioAsVoice?: boolean;
      }
    ) => {
      if (!waService) return null;
      return await waService.sendMedia(payload);
    }
  );

  ipcMain.handle('wa:select-media-file', async () => {
    try {
      const res = await dialog.showOpenDialog({
        title: 'Selecionar Imagem ou Vídeo',
        filters: [
          {
            name: 'Imagens e Vídeos',
            extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'webm', 'mkv', 'avi'],
          },
        ],
        properties: ['openFile'],
      });

      if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
        return null;
      }

      const filePath = res.filePaths[0];
      const buf = fs.readFileSync(filePath);
      const ext = (path.extname(filePath) || '').toLowerCase();
      let mime = 'image/jpeg';
      if (ext === '.png') mime = 'image/png';
      else if (ext === '.webp') mime = 'image/webp';
      else if (ext === '.gif') mime = 'image/gif';
      else if (ext === '.mp4') mime = 'video/mp4';
      else if (ext === '.mov') mime = 'video/quicktime';
      else if (ext === '.webm') mime = 'video/webm';
      else if (ext === '.mkv') mime = 'video/x-matroska';
      else if (ext === '.avi') mime = 'video/x-msvideo';

      const filename = path.basename(filePath);
      const isVideo = mime.startsWith('video/');
      const mediaType: 'image' | 'video' = isVideo ? 'video' : 'image';
      const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

      return {
        dataUrl,
        mediaType,
        filename,
      };
    } catch (err) {
      console.error('[main] Error selecting media file:', err);
      return null;
    }
  });

  ipcMain.handle('wa:read-clipboard-image', async () => {
    try {
      const img = clipboard.readImage();
      if (!img || img.isEmpty()) {
        return null;
      }
      return {
        dataUrl: img.toDataURL(),
        mediaType: 'image' as const,
        filename: 'clipboard.png',
      };
    } catch (err) {
      console.error('[main] Erro ao ler imagem da área de transferência:', err);
      return null;
    }
  });

  ipcMain.handle('wa:get-whatsapp-stickers', async () => {
    if (!waService) return [];
    return await waService.getWhatsAppStickers();
  });

  const getStickersDir = () => {
    const dir = path.join(process.cwd(), 'stickers');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  };

  const extToMime = (ext: string): string => {
    const clean = ext.toLowerCase();
    if (clean === '.webp') return 'image/webp';
    if (clean === '.png') return 'image/png';
    if (clean === '.gif') return 'image/gif';
    return 'image/jpeg';
  };

  ipcMain.handle('wa:get-user-stickers', async () => {
    try {
      const dir = getStickersDir();
      const files = fs
        .readdirSync(dir)
        .filter((f) => /\.(webp|png|jpg|jpeg|gif)$/i.test(f));

      // Ordena pelos mais recentes primeiro
      const withStats = files
        .map((fileName) => {
          const fullPath = path.join(dir, fileName);
          const stat = fs.statSync(fullPath);
          return { fileName, fullPath, mtime: stat.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);

      return withStats.map(({ fileName, fullPath }) => {
        const ext = path.extname(fileName);
        const mime = extToMime(ext);
        const buf = fs.readFileSync(fullPath);
        return {
          id: fileName,
          name: path.basename(fileName, ext),
          dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
          source: 'library' as const,
        };
      });
    } catch (err) {
      console.error('[main] Error loading user stickers:', err);
      return [];
    }
  });

  ipcMain.handle('wa:import-stickers', async () => {
    try {
      const res = await dialog.showOpenDialog({
        title: 'Adicionar Figurinhas da sua Biblioteca',
        filters: [
          {
            name: 'Figurinhas e Imagens (.webp, .png, .jpg, .gif)',
            extensions: ['webp', 'png', 'jpg', 'jpeg', 'gif'],
          },
        ],
        properties: ['openFile', 'multiSelections'],
      });

      if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
        return [];
      }

      const dir = getStickersDir();
      const imported: Array<{
        id: string;
        name: string;
        dataUrl: string;
        source: 'library';
      }> = [];

      for (const srcPath of res.filePaths) {
        const buf = fs.readFileSync(srcPath);
        const ext = (path.extname(srcPath) || '.webp').toLowerCase();
        const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 14);
        const targetFileName = `sticker-${hash}${ext}`;
        const targetPath = path.join(dir, targetFileName);
        fs.writeFileSync(targetPath, buf);

        const mime = extToMime(ext);
        imported.push({
          id: targetFileName,
          name: path.basename(srcPath, ext),
          dataUrl: `data:${mime};base64,${buf.toString('base64')}`,
          source: 'library',
        });
      }

      return imported;
    } catch (err) {
      console.error('[main] Error importing stickers:', err);
      return [];
    }
  });

  ipcMain.handle('wa:save-sticker-to-library', async (_event, dataUrl: string) => {
    try {
      const match = /^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/.exec(dataUrl);
      if (!match) return null;
      const subtype = match[1].toLowerCase();
      const base64Data = match[2];
      const ext =
        subtype === 'webp'
          ? '.webp'
          : subtype === 'png'
          ? '.png'
          : subtype === 'gif'
          ? '.gif'
          : '.jpg';
      const buf = Buffer.from(base64Data, 'base64');
      const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 14);
      const dir = getStickersDir();
      const targetFileName = `sticker-${hash}${ext}`;
      const targetPath = path.join(dir, targetFileName);
      fs.writeFileSync(targetPath, buf);

      return {
        id: targetFileName,
        name: `Figurinha ${hash.slice(0, 6)}`,
        dataUrl,
        source: 'library' as const,
      };
    } catch (err) {
      console.error('[main] Error saving sticker to library:', err);
      return null;
    }
  });

  ipcMain.handle('wa:delete-user-sticker', async (_event, stickerId: string) => {
    try {
      const dir = getStickersDir();
      const safeName = path.basename(stickerId);
      const targetPath = path.join(dir, safeName);
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      return true;
    } catch (err) {
      console.error('[main] Error deleting user sticker:', err);
      return false;
    }
  });

  ipcMain.handle('wa:mark-as-read', async (_event, chatId: string) => {
    if (!waService) return;
    await waService.markAsRead(chatId);
  });

  ipcMain.handle('wa:mark-as-unread', async (_event, chatId: string) => {
    if (!waService) return;
    await waService.markAsUnread(chatId);
  });

  ipcMain.handle(
    'wa:send-reaction',
    async (_event, payload: { chatId: string; messageId: string; reaction: string }) => {
      if (!waService) return false;
      const { chatId, messageId, reaction } = payload || {};
      return waService.sendReaction(chatId, messageId, reaction);
    }
  );

  ipcMain.handle('wa:get-high-res-pic', async (_event, chatId: string) => {
    if (!waService) return null;
    return waService.getHighResProfilePic(chatId);
  });

  ipcMain.handle('wa:toggle-mute', async (_event, payload: { chatId: string; mute?: boolean }) => {
    if (!waService) return false;
    const { chatId, mute } = payload || {};
    return waService.toggleMute(chatId, mute);
  });
}

app.whenReady().then(() => {
  // Concede permissão de microfone/mídia automaticamente para a gravação de áudio no Electron
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'media') return true;
    return true;
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
      return;
    }
    callback(true);
  });

  registerIpcHandlers();
  createOverlayWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOverlayWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
