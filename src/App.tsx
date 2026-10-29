import React, { useEffect, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useBubbleStore } from './store/useBubbleStore';
import { BubbleDock } from './components/BubbleDock';
import { ChatListPopover } from './components/ChatListPopover';
import { ChatWindowPopover } from './components/ChatWindowPopover';
import { QRCodePopover } from './components/QRCodePopover';
import { SettingsPopover } from './components/SettingsPopover';
import { MediaViewerModal } from './components/MediaViewerModal';
import { ErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  const {
    activePopover,
    viewingImage,
    setQrDataUrl,
    setWaStatus,
    applyRealWhatsAppChats,
    receiveIncomingMessage,
    applyReactionUpdate,
    updateMessageAck,
    deleteMessagesLocally,
    applyExternalSettingsUpdate,
    isDockHidden,
    dockAnimPhase,
    soundMuted,
    toggleDockVisibility,
    refreshApp,
    logoutWhatsApp,
  } = useBubbleStore();

  const isSettingsWindow =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('view') === 'settings' ||
      new URLSearchParams(window.location.search).get('view') === 'media-viewer');

  const isMediaViewerWindow =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('view') === 'media-viewer';

  const isIgnoringMouseRef = useRef<boolean>(true);

  const setIgnoreMouse = useCallback(
    (ignore: boolean) => {
      if (isSettingsWindow) return;
      if (isIgnoringMouseRef.current === ignore) return;
      isIgnoringMouseRef.current = ignore;
      window.electronAPI?.setIgnoreMouseEvents(ignore);
    },
    [isSettingsWindow]
  );

  const handleInteractiveEnter = useCallback(() => {
    setIgnoreMouse(false);
  }, [setIgnoreMouse]);

  const handleInteractiveLeave = useCallback(() => {
    setIgnoreMouse(true);
  }, [setIgnoreMouse]);

  // Garantia extra de Click-Through: se um popover fechar enquanto o mouse estava sobre ele,
  // ou ao mover o cursor na área transparente (forwarded mousemove), sincroniza imediatamente.
  useEffect(() => {
    if (isSettingsWindow) return;
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const isOverInteractive = Boolean(target?.closest('[data-interactive="true"]'));
      setIgnoreMouse(!isOverInteractive);
    };

    window.addEventListener('mousemove', handleGlobalMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [setIgnoreMouse, isSettingsWindow]);

  useEffect(() => {
    if (isSettingsWindow) return;
    if (isDockHidden || dockAnimPhase === 'hidden') {
      setIgnoreMouse(true);
      return;
    }
    if (activePopover === 'none') {
      const isOverInteractive = Boolean(
        document.querySelector(':hover')?.closest('[data-interactive="true"]')
      );
      if (!isOverInteractive) {
        setIgnoreMouse(true);
      }
    }
  }, [activePopover, isDockHidden, dockAnimPhase, setIgnoreMouse, isSettingsWindow]);

  // Sincroniza estado inicial e alterações de visibilidade/áudio com o System Tray
  useEffect(() => {
    if (isSettingsWindow) return;
    window.electronAPI?.syncTrayState?.({ hidden: isDockHidden, soundMuted });
  }, [isDockHidden, soundMuted, isSettingsWindow]);

  // Inicializa automaticamente a sessão do WhatsApp (LocalAuth) em segundo plano ao abrir o app
  // e escuta todos os eventos IPC em tempo real (apenas na janela principal das bolhas).
  useEffect(() => {
    const api = window.electronAPI;
    if (!api || isSettingsWindow) return;

    // Dispara a inicialização automática para aproveitar a sessão LocalAuth já conectada
    api.initWhatsApp().then((res) => {
      if (res.qrDataUrl) {
        setQrDataUrl(res.qrDataUrl);
      }
      setWaStatus(res.status);
    });

    const unsubQr = api.onQr((qrDataUrl) => {
      setQrDataUrl(qrDataUrl);
      setWaStatus('qr');
    });

    const unsubReady = api.onReady(() => {
      setWaStatus('ready');
    });

    const unsubChats = api.onChatsLoaded((chats) => {
      if (chats && chats.length > 0) {
        applyRealWhatsAppChats(chats);
      }
    });

    const unsubMsg = api.onMessageReceived((payload) => {
      receiveIncomingMessage(payload);
    });

    const unsubReaction = api.onReactionReceived
      ? api.onReactionReceived((payload: any) => {
          applyReactionUpdate(payload);
        })
      : () => {};

    const unsubAck = api.onMessageAck
      ? api.onMessageAck((payload) => {
          updateMessageAck(payload);
        })
      : () => {};

    const unsubDeleted = api.onMessageDeleted
      ? api.onMessageDeleted((payload) => {
          deleteMessagesLocally(payload.chatId, [payload.messageId]);
        })
      : () => {};

    const unsubStatus = api.onStatusChange(({ status, error }) => {
      setWaStatus(status, error);
    });

    const unsubSettings = api.onSettingsUpdated
      ? api.onSettingsUpdated((patch) => {
          applyExternalSettingsUpdate(patch);
        })
      : () => {};

    const unsubTrayToggle = api.onTrayToggleVisibility
      ? api.onTrayToggleVisibility(() => {
          toggleDockVisibility();
        })
      : () => {};

    const unsubTrayRefresh = api.onTrayRefresh
      ? api.onTrayRefresh(() => {
          refreshApp();
        })
      : () => {};

    const unsubTrayLogout = api.onTrayLogout
      ? api.onTrayLogout(() => {
          logoutWhatsApp();
        })
      : () => {};

    const unsubTraySet = api.onTraySetVisibility
      ? api.onTraySetVisibility((hidden) => {
          toggleDockVisibility(hidden);
        })
      : () => {};

    return () => {
      unsubQr();
      unsubReady();
      unsubChats();
      unsubMsg();
      unsubReaction();
      unsubAck();
      unsubDeleted();
      unsubStatus();
      unsubSettings();
      unsubTrayToggle();
      unsubTraySet();
      unsubTrayRefresh();
      unsubTrayLogout();
    };
  }, [
    isSettingsWindow,
    setQrDataUrl,
    setWaStatus,
    applyRealWhatsAppChats,
    receiveIncomingMessage,
    applyReactionUpdate,
    updateMessageAck,
    deleteMessagesLocally,
    applyExternalSettingsUpdate,
    toggleDockVisibility,
    refreshApp,
    logoutWhatsApp,
  ]);

  if (isMediaViewerWindow) {
    return (
      <div className="w-screen h-screen bg-transparent p-1 overflow-hidden select-none">
        <MediaViewerModal
          isStandaloneWindow
          onInteractiveEnter={handleInteractiveEnter}
          onInteractiveLeave={handleInteractiveLeave}
        />
      </div>
    );
  }

  // Quando aberta como Dialog Box separada (?view=settings), renderiza apenas a janela de Configurações
  if (isSettingsWindow) {
    return (
      <div className="w-screen h-screen bg-transparent p-1.5 overflow-hidden select-none">
        <SettingsPopover
          isStandaloneWindow
          onInteractiveEnter={handleInteractiveEnter}
          onInteractiveLeave={handleInteractiveLeave}
        />
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-transparent pointer-events-none select-none relative overflow-visible">
      {/* Modal Externo Redimensionável de Visualização de Imagem/Vídeo */}
      <AnimatePresence>
        {viewingImage && (
          <MediaViewerModal
            key="media-viewer-modal"
            onInteractiveEnter={handleInteractiveEnter}
            onInteractiveLeave={handleInteractiveLeave}
          />
        )}
      </AnimatePresence>

      {/* Área do Dock e Popovers Flutuantes (Fixos no canto inferior direito) */}
      <div className="w-full h-full pointer-events-none flex flex-col justify-end items-end pb-[12px] pr-[16px] overflow-hidden">
        {/* Área Superior de Popovers Flutuantes (apenas um aberto por vez) */}
      <div className="mb-[12px] flex flex-col items-end pointer-events-none">
        <ErrorBoundary name="Popovers">
          <AnimatePresence mode="wait">
            {activePopover === 'chat-list' && (
              <ChatListPopover
                key="chat-list"
                onInteractiveEnter={handleInteractiveEnter}
                onInteractiveLeave={handleInteractiveLeave}
              />
            )}

            {activePopover === 'chat-window' && (
              <ChatWindowPopover
                key="chat-window"
                onInteractiveEnter={handleInteractiveEnter}
                onInteractiveLeave={handleInteractiveLeave}
              />
            )}

            {activePopover === 'qr-code' && (
              <QRCodePopover
                key="qr-code"
                onInteractiveEnter={handleInteractiveEnter}
                onInteractiveLeave={handleInteractiveLeave}
              />
            )}

            {activePopover === 'settings' && (
              <SettingsPopover
                key="settings"
                onInteractiveEnter={handleInteractiveEnter}
                onInteractiveLeave={handleInteractiveLeave}
              />
            )}
          </AnimatePresence>
        </ErrorBoundary>
      </div>

      {/* Dock Inferior Direito com as Bolhas de Contatos e o Botão Fixo do WhatsApp */}
      <BubbleDock
        onInteractiveEnter={handleInteractiveEnter}
        onInteractiveLeave={handleInteractiveLeave}
      />
      </div>
    </div>
  );
};

export default App;
