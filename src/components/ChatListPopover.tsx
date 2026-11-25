import React from 'react';
import { motion } from 'framer-motion';
import {
  Loader2,
  Search,
  Plus,
  X,
  ArrowLeft,
  User,
  Pin,
  RefreshCw,
  QrCode,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  MessageSquareText,
} from 'lucide-react';
import {
  useBubbleStore,
  getTypingParticipantsForChat,
  formatTypingStatusText,
} from '../store/useBubbleStore';
import { ChatSummary, SavedContact, CHAT_LIST_SIZE_CONFIG } from '../types/whatsapp';
import { MessageCheckIcon } from './MessageCheckIcon';

function formatElapsedTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  if (safe < 60) return `${safe}s`;
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${mins}m ${String(rem).padStart(2, '0')}s`;
}

interface ChatListPopoverProps {
  onInteractiveEnter: () => void;
  onInteractiveLeave: () => void;
}

const StickerIcon: React.FC = () => (
  <svg
    viewBox="0 0 16 16"
    className="w-[13px] h-[13px] text-[#8696A0] shrink-0 inline-block"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
  >
    <path d="M3.5 2h9A1.5 1.5 0 0 1 14 3.5v6.2a1.5 1.5 0 0 1-.44 1.06l-2.8 2.8A1.5 1.5 0 0 1 9.7 14H3.5A1.5 1.5 0 0 1 2 12.5v-9A1.5 1.5 0 0 1 3.5 2Z" />
    <path d="M9.5 13.8V10.5A1.5 1.5 0 0 1 11 9h2.8" />
  </svg>
);

const PhotoIcon: React.FC = () => (
  <svg
    viewBox="0 0 16 16"
    className="w-[13px] h-[13px] text-[#8696A0] shrink-0 inline-block"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
  >
    <rect x="2" y="2.5" width="12" height="11" rx="1.8" />
    <circle cx="5.5" cy="6" r="1.1" fill="currentColor" stroke="none" />
    <path d="m2.5 11.5 3.2-3.2a1 1 0 0 1 1.4 0l2.4 2.4 1.6-1.6a1 1 0 0 1 1.4 0l1.5 1.5" />
  </svg>
);

const GreenMicIcon: React.FC = () => (
  <svg
    viewBox="0 0 14 16"
    className="w-[12px] h-[13px] text-[#00A884] shrink-0 inline-block"
    fill="currentColor"
  >
    <path d="M7 10.5a2.5 2.5 0 0 0 2.5-2.5V3.5a2.5 2.5 0 1 0-5 0V8A2.5 2.5 0 0 0 7 10.5Z" />
    <path d="M3 7.5a.5.5 0 0 1 .5.5 3.5 3.5 0 1 0 7 0 .5.5 0 0 1 1 0 4.5 4.5 0 0 1-4 4.473V14h1.5a.5.5 0 0 1 0 1h-4a.5.5 0 0 1 0-1H6.5v-1.527A4.5 4.5 0 0 1 2.5 8a.5.5 0 0 1 .5-.5Z" />
  </svg>
);

export const ChatListPopover: React.FC<ChatListPopoverProps> = ({
  onInteractiveEnter,
  onInteractiveLeave,
}) => {
  const {
    chats,
    selectChatFromList,
    hasSyncedRealChats,
    waStatus,
    waError,
    qrDataUrl,
    waConnectionDetails,
    isReconnectingSession,
    reconnectWhatsApp,
    requestNewQrSession,
    openQrCodePopover,
    savedContacts,
    isLoadingContacts,
    fetchSavedContacts,
    startChatWithContact,
    pinnedChatIds,
    chatListSize,
    bubbleScale,
    typingByChat,
  } = useBubbleStore();

  const [view, setView] = React.useState<'chats' | 'contacts'>('chats');
  const [chatSearch, setChatSearch] = React.useState('');
  const [contactSearch, setContactSearch] = React.useState('');
  const [nowTick, setNowTick] = React.useState(() => Date.now());
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const isLoadingChats = !hasSyncedRealChats && chats.length === 0;
  const stage = waConnectionDetails?.stage || 'launching_browser';
  const isConnectionBroken =
    waStatus === 'disconnected' ||
    waStatus === 'error' ||
    waStatus === 'qr' ||
    stage === 'session_expired' ||
    stage === 'disconnected' ||
    stage === 'error' ||
    stage === 'awaiting_qr';

  // Atualiza cronômetro de atividade a cada segundo enquanto conecta/sincroniza
  React.useEffect(() => {
    if (!isLoadingChats && !isConnectionBroken) return;
    setNowTick(Date.now());
    const interval = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoadingChats, isConnectionBroken]);

  // Permite fechar a lista de conversas pressionando ESC ou voltar da tela de contatos
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (view === 'contacts') {
          setView('chats');
          setContactSearch('');
        } else if (chatSearch) {
          setChatSearch('');
        } else {
          useBubbleStore.setState({ activePopover: 'none' });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [view, chatSearch]);

  const elapsedStageSeconds = Math.max(
    0,
    Math.floor((nowTick - (waConnectionDetails?.stageStartedAt || nowTick)) / 1000)
  );
  const silentSeconds = Math.max(
    0,
    Math.floor((nowTick - (waConnectionDetails?.lastActivityAt || nowTick)) / 1000)
  );
  const isStalledUi =
    stage === 'stalled' ||
    (!isConnectionBroken && !waConnectionDetails?.isConnected && silentSeconds >= 25);

  // Filtragem de conversas na tela principal
  const filteredChats = React.useMemo(() => {
    if (!chatSearch.trim()) return chats;
    const q = chatSearch.toLowerCase().trim();
    return chats.filter((chat) => {
      const matchName = chat.name?.toLowerCase().includes(q);
      const matchParent = chat.parentName?.toLowerCase().includes(q);
      const matchMsg = chat.lastMessage?.text?.toLowerCase().includes(q);
      const matchSender = chat.lastMessage?.senderName?.toLowerCase().includes(q);
      return matchName || matchParent || matchMsg || matchSender;
    });
  }, [chats, chatSearch]);

  // Filtragem e deduplicação defensiva de contatos na tela de Nova Conversa
  const filteredContacts = React.useMemo(() => {
    const list = contactSearch.trim()
      ? savedContacts.filter((contact) => {
          const q = contactSearch.toLowerCase().trim();
          const matchName = contact.name?.toLowerCase().includes(q);
          const matchPush = contact.pushname?.toLowerCase().includes(q);
          const matchPhone = contact.phoneNumber?.toLowerCase().includes(q);
          const matchDigits = contact.phoneNumber?.replace(/\D/g, '').includes(q.replace(/\D/g, ''));
          return matchName || matchPush || matchPhone || matchDigits;
        })
      : savedContacts;

    // Deduplicação defensiva por telefone/chave normalizada
    const seen = new Set<string>();
    return list.filter((c) => {
      const rawDigits =
        c.phoneNumber?.replace(/\D/g, '') ||
        c.id.split('@')[0].replace(/\D/g, '') ||
        c.id;
      const key =
        rawDigits.startsWith('55') && (rawDigits.length === 12 || rawDigits.length === 13)
          ? `55${rawDigits.slice(2, 4)}${rawDigits.slice(-8)}`
          : rawDigits;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [savedContacts, contactSearch]);

  const handleOpenContacts = () => {
    setView('contacts');
    setContactSearch('');
    fetchSavedContacts();
  };

  const handleContactSearchChange = (val: string) => {
    setContactSearch(val);
    fetchSavedContacts(val);
  };

  const handleSelectContact = (contact: SavedContact) => {
    startChatWithContact(contact);
  };

  const renderLastMessagePreview = (chat: ChatSummary) => {
    const typingList = getTypingParticipantsForChat(typingByChat, chat.id);
    if (typingList.length > 0) {
      const typingText = formatTypingStatusText(typingList, Boolean(chat.isGroup), chat.name);
      return (
        <span className="flex items-center gap-1 text-[12.5px] font-medium text-[#25D366] truncate">
          <span className="truncate">{typingText}</span>
        </span>
      );
    }

    const { lastMessage } = chat;

    if (lastMessage.mediaType === 'audio') {
      return (
        <span className="flex items-center gap-1 text-[12.5px] text-[#8696A0] truncate">
          {lastMessage.fromMe && <MessageCheckIcon ack={lastMessage.ack} className="ml-0 mr-0.5" />}
          <GreenMicIcon />
          <span>{lastMessage.duration || lastMessage.text}</span>
        </span>
      );
    }

    if (lastMessage.mediaType === 'sticker') {
      return (
        <span className="flex items-center gap-1 text-[12.5px] text-[#8696A0] truncate">
          {lastMessage.fromMe && <MessageCheckIcon ack={lastMessage.ack} className="ml-0 mr-0.5" />}
          {lastMessage.senderName && (
            <span className="truncate max-w-[140px]">{lastMessage.senderName}:</span>
          )}
          <StickerIcon />
          <span>Figurinha</span>
        </span>
      );
    }

    if (lastMessage.mediaType === 'photo' || lastMessage.mediaType === 'video') {
      return (
        <span className="flex items-center gap-1 text-[12.5px] text-[#8696A0] truncate">
          {lastMessage.fromMe && <MessageCheckIcon ack={lastMessage.ack} className="ml-0 mr-0.5" />}
          {lastMessage.senderName && (
            <span className="truncate max-w-[140px]">{lastMessage.senderName}:</span>
          )}
          <PhotoIcon />
          <span>
            {lastMessage.text || (lastMessage.mediaType === 'video' ? 'Vídeo' : 'Foto')}
          </span>
        </span>
      );
    }

    return (
      <span className="flex items-center gap-1 text-[12.5px] text-[#8696A0] truncate">
        {lastMessage.fromMe && <MessageCheckIcon ack={lastMessage.ack} className="ml-0 mr-0.5" />}
        <span className="truncate">
          {lastMessage.senderName
            ? `${lastMessage.senderName}: ${lastMessage.text}`
            : lastMessage.text}
        </span>
      </span>
    );
  };

  const currentSize = CHAT_LIST_SIZE_CONFIG[chatListSize] || CHAT_LIST_SIZE_CONFIG.padrao;
  const arrowRightPx = Math.max(8, Math.round(24 * bubbleScale - 8));

  return (
    <motion.div
      data-interactive="true"
      onMouseEnter={onInteractiveEnter}
      onMouseLeave={onInteractiveLeave}
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      style={{
        width: `${currentSize.width}px`,
        height: `${currentSize.height}px`,
      }}
      className={`relative ${currentSize.widthClass} ${currentSize.heightClass} max-h-[calc(100vh-84px)] bg-[#18191B] rounded-[6px] shadow-[0_14px_40px_rgba(0,0,0,0.85)] border border-white/[0.05] flex flex-col pointer-events-auto group/list transition-[width,height] duration-200`}
    >
      {view === 'chats' ? (
        <>
          {/* Topo: Título + Botão de Nova Conversa (+) e Barra de Pesquisa */}
          <div className="px-3 pt-3 pb-2 flex flex-col gap-2 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-[#E9EDEF] tracking-tight">Conversas</h2>
              <button
                type="button"
                disabled={isLoadingChats || isConnectionBroken}
                onClick={handleOpenContacts}
                title={
                  isLoadingChats || isConnectionBroken
                    ? 'Aguarde a conexão com o WhatsApp'
                    : 'Nova conversa (Contatos salvos)'
                }
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#AEBAC1] hover:text-[#00A884] hover:bg-[#202C33] active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center bg-[#202C33] rounded-[8px] px-2.5 h-[32px] gap-2 border border-transparent focus-within:border-[#00A884]/50 transition-all">
              <Search className="w-3.5 h-3.5 text-[#8696A0] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Pesquisar conversa..."
                className="bg-transparent text-[13px] text-[#E9EDEF] placeholder-[#8696A0] outline-none w-full"
              />
              {chatSearch && (
                <button
                  type="button"
                  onClick={() => setChatSearch('')}
                  className="text-[#8696A0] hover:text-[#E9EDEF] p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {isLoadingChats ? (
            isConnectionBroken ? (
              /* Estado explícito de desconexão, perda de token, erro ou QR pendente */
              <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 text-center overflow-y-auto wa-scrollbar">
                {(() => {
                  const isQrReady = waStatus === 'qr' || stage === 'awaiting_qr' || Boolean(qrDataUrl);
                  const isTokenExpired = stage === 'session_expired';
                  const isOffline = waConnectionDetails?.reason === 'OFFLINE';
                  const isErrorState = waStatus === 'error' || stage === 'error';

                  const badgeText = isQrReady
                    ? 'Aguardando leitura do QR Code'
                    : isOffline
                    ? 'Sem conexão com a internet'
                    : isTokenExpired
                    ? 'Desconectado • Token expirado'
                    : isErrorState
                    ? 'Erro de conexão'
                    : 'WhatsApp desconectado';

                  const badgeClass = isQrReady
                    ? 'bg-[#25D366]/15 text-[#25D366] border-[#25D366]/30'
                    : isOffline
                    ? 'bg-[#FBBF24]/15 text-[#FBBF24] border-[#FBBF24]/30'
                    : 'bg-[#EF4444]/15 text-[#F87171] border-[#EF4444]/30';

                  const IconComp = isQrReady
                    ? QrCode
                    : isOffline
                    ? WifiOff
                    : isTokenExpired
                    ? KeyRound
                    : AlertTriangle;

                  const iconWrapClass = isQrReady
                    ? 'bg-[#25D366]/15 text-[#25D366] border-[#25D366]/25'
                    : isOffline
                    ? 'bg-[#FBBF24]/15 text-[#FBBF24] border-[#FBBF24]/25'
                    : 'bg-[#EF4444]/15 text-[#F87171] border-[#EF4444]/25';

                  return (
                    <div className="w-full max-w-[280px] flex flex-col items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-full border flex items-center justify-center ${iconWrapClass}`}
                      >
                        <IconComp className="w-6 h-6" />
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${badgeClass}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isQrReady
                              ? 'bg-[#25D366]'
                              : isOffline
                              ? 'bg-[#FBBF24]'
                              : 'bg-[#F87171]'
                          }`}
                        />
                        {badgeText}
                      </span>

                      <div className="space-y-1">
                        <h3 className="text-[14px] font-semibold text-[#E9EDEF] leading-snug">
                          {waConnectionDetails?.title || 'Sessão não conectada'}
                        </h3>
                        <p className="text-[11.5px] text-[#8696A0] leading-relaxed">
                          {waConnectionDetails?.detail ||
                            waError ||
                            'Não foi possível conectar com a sessão salva. Leia o QR Code novamente ou tente reconectar.'}
                        </p>
                      </div>

                      <div className="w-full flex flex-col gap-2 pt-1">
                        {isQrReady ? (
                          <button
                            type="button"
                            disabled={isReconnectingSession}
                            onClick={() => openQrCodePopover()}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[7px] bg-[#25D366] hover:bg-[#1fb855] active:scale-[0.98] disabled:opacity-60 text-[#111B21] text-[12.5px] font-semibold transition-all cursor-pointer"
                          >
                            <QrCode className="w-4 h-4 shrink-0" />
                            <span>{qrDataUrl ? 'Abrir QR Code para ler' : 'Gerar novo QR Code'}</span>
                          </button>
                        ) : isOffline ? (
                          <button
                            type="button"
                            disabled={isReconnectingSession}
                            onClick={() => reconnectWhatsApp()}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[7px] bg-[#25D366] hover:bg-[#1fb855] active:scale-[0.98] disabled:opacity-60 text-[#111B21] text-[12.5px] font-semibold transition-all cursor-pointer"
                          >
                            <RefreshCw
                              className={`w-4 h-4 shrink-0 ${
                                isReconnectingSession ? 'animate-spin' : ''
                              }`}
                            />
                            <span>Tentar reconectar</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isReconnectingSession}
                            onClick={() => requestNewQrSession()}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[7px] bg-[#25D366] hover:bg-[#1fb855] active:scale-[0.98] disabled:opacity-60 text-[#111B21] text-[12.5px] font-semibold transition-all cursor-pointer"
                          >
                            <QrCode className="w-4 h-4 shrink-0" />
                            <span>Ler QR Code novamente</span>
                          </button>
                        )}

                        {!isOffline && (
                          <button
                            type="button"
                            disabled={isReconnectingSession}
                            onClick={() => reconnectWhatsApp()}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-[#202C33] hover:bg-[#2A3942] active:scale-[0.98] disabled:opacity-60 text-[#E9EDEF] text-[12px] font-medium border border-white/[0.06] transition-all cursor-pointer"
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 shrink-0 text-[#8696A0] ${
                                isReconnectingSession ? 'animate-spin' : ''
                              }`}
                            />
                            <span>Tentar reconectar sessão salva</span>
                          </button>
                        )}

                        {isOffline && (
                          <button
                            type="button"
                            disabled={isReconnectingSession}
                            onClick={() => requestNewQrSession()}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-[7px] bg-[#202C33] hover:bg-[#2A3942] active:scale-[0.98] disabled:opacity-60 text-[#E9EDEF] text-[12px] font-medium border border-white/[0.06] transition-all cursor-pointer"
                          >
                            <QrCode className="w-3.5 h-3.5 shrink-0 text-[#8696A0]" />
                            <span>Gerar novo QR Code</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* Conectando ou sincronizando mensagens ativamente */
              <div className="flex-1 flex flex-col justify-between py-3 px-3 overflow-y-auto wa-scrollbar gap-2.5">
                {(() => {
                  const isConnected = Boolean(
                    waConnectionDetails?.isConnected ||
                      waStatus === 'authenticated' ||
                      waStatus === 'ready'
                  );
                  const pct =
                    typeof waConnectionDetails?.progressPercent === 'number'
                      ? Math.max(0, Math.min(100, waConnectionDetails.progressPercent))
                      : null;
                  const chatsCount = waConnectionDetails?.chatsLoadedCount || 0;

                  const step1Done = isConnected;
                  const step2Done =
                    stage === 'loading_chats' ||
                    stage === 'ready' ||
                    (isConnected && pct === 100);
                  const step2Active = isConnected && !step2Done;
                  const step3Active = stage === 'loading_chats';

                  return (
                    <>
                      {/* Card detalhado de status em tempo real */}
                      <div
                        className={`rounded-[8px] p-3 border space-y-2.5 ${
                          isStalledUi
                            ? 'bg-[#262117]/95 border-[#FBBF24]/30'
                            : isConnected
                            ? 'bg-[#172822]/90 border-[#25D366]/25'
                            : 'bg-[#202C33]/90 border-white/[0.07]'
                        }`}
                      >
                        {/* Linha superior: Badge de conexão real + tempo decorrido */}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                              isStalledUi
                                ? 'bg-[#FBBF24]/15 text-[#FBBF24]'
                                : isConnected
                                ? 'bg-[#25D366]/15 text-[#25D366]'
                                : 'bg-[#38BDF8]/15 text-[#38BDF8]'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isStalledUi
                                  ? 'bg-[#FBBF24]'
                                  : isConnected
                                  ? 'bg-[#25D366] animate-pulse'
                                  : 'bg-[#38BDF8] animate-pulse'
                              }`}
                            />
                            {isStalledUi
                              ? isConnected
                                ? 'Sincronização lenta'
                                : 'Demorando para responder'
                              : isConnected
                              ? 'Conectado • Lendo mensagens'
                              : 'Conectando sessão'}
                          </span>
                          <span className="text-[10.5px] font-mono text-[#8696A0] shrink-0">
                            {formatElapsedTime(elapsedStageSeconds)}
                          </span>
                        </div>

                        {/* Ícone + Título e Descrição clara do estágio atual */}
                        <div className="flex items-start gap-2.5">
                          {isStalledUi ? (
                            <AlertTriangle className="w-5 h-5 text-[#FBBF24] shrink-0 mt-0.5" />
                          ) : (
                            <Loader2
                              className={`w-5 h-5 animate-spin shrink-0 mt-0.5 ${
                                isConnected ? 'text-[#25D366]' : 'text-[#38BDF8]'
                              }`}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold text-[#E9EDEF] leading-tight">
                              {waConnectionDetails?.title ||
                                (isConnected
                                  ? 'Lendo mensagens recebidas...'
                                  : 'Conectando à sessão do WhatsApp')}
                            </div>
                            <div className="text-[11px] text-[#AEBAC1] leading-snug mt-0.5">
                              {waConnectionDetails?.detail ||
                                (isConnected
                                  ? 'Baixando mensagens que chegaram enquanto você estava fora...'
                                  : 'Verificando seu token salvo nos servidores do WhatsApp...')}
                            </div>
                          </div>
                        </div>

                        {/* Barra de progresso real (%) ou atividade contínua */}
                        <div className="space-y-1">
                          <div className="w-full h-1.5 rounded-full bg-black/35 overflow-hidden">
                            {pct !== null ? (
                              <div
                                className="h-full rounded-full bg-[#25D366] transition-all duration-300"
                                style={{ width: `${Math.max(6, pct)}%` }}
                              />
                            ) : (
                              <div
                                className={`h-full w-2/5 rounded-full animate-pulse ${
                                  isStalledUi
                                    ? 'bg-[#FBBF24]/70'
                                    : isConnected
                                    ? 'bg-[#25D366]/80'
                                    : 'bg-[#38BDF8]/75'
                                }`}
                              />
                            )}
                          </div>
                          {(pct !== null || chatsCount > 0) && (
                            <div className="flex items-center justify-between text-[10.5px] text-[#8696A0]">
                              <span className="flex items-center gap-1">
                                <MessageSquareText className="w-3 h-3 text-[#25D366]" />
                                {chatsCount > 0
                                  ? `${chatsCount} conversas lidas`
                                  : 'Recebendo histórico...'}
                              </span>
                              {pct !== null && (
                                <span className="font-mono font-semibold text-[#25D366]">
                                  {pct}%
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Mini pipeline de 3 etapas para clareza visual */}
                        <div className="grid grid-cols-3 gap-1 pt-1 border-t border-white/[0.06] text-[10px]">
                          <div className="flex items-center gap-1 min-w-0">
                            {step1Done ? (
                              <CheckCircle2 className="w-3 h-3 text-[#25D366] shrink-0" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-[#38BDF8] animate-pulse shrink-0 ml-0.5" />
                            )}
                            <span
                              className={`truncate ${
                                step1Done ? 'text-[#E9EDEF]' : 'text-[#38BDF8] font-medium'
                              }`}
                            >
                              1. Sessão
                            </span>
                          </div>
                          <div className="flex items-center gap-1 min-w-0">
                            {step2Done ? (
                              <CheckCircle2 className="w-3 h-3 text-[#25D366] shrink-0" />
                            ) : step2Active ? (
                              <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse shrink-0 ml-0.5" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-[#8696A0]/40 shrink-0 ml-0.5" />
                            )}
                            <span
                              className={`truncate ${
                                step2Done
                                  ? 'text-[#E9EDEF]'
                                  : step2Active
                                  ? 'text-[#25D366] font-medium'
                                  : 'text-[#8696A0]'
                              }`}
                            >
                              2. Mensagens
                            </span>
                          </div>
                          <div className="flex items-center gap-1 min-w-0">
                            {step3Active ? (
                              <span className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse shrink-0 ml-0.5" />
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-[#8696A0]/40 shrink-0 ml-0.5" />
                            )}
                            <span
                              className={`truncate ${
                                step3Active ? 'text-[#25D366] font-medium' : 'text-[#8696A0]'
                              }`}
                            >
                              3. Conversas
                            </span>
                          </div>
                        </div>

                        {isStalledUi && (
                          <div className="text-[10.5px] text-[#FDE68A]/90 bg-[#FBBF24]/10 border border-[#FBBF24]/20 rounded-[6px] px-2.5 py-1.5 leading-snug">
                            Se você ficou muito tempo sem abrir o ZapBolhas, a sessão pode ter perdido o token ou travado. Use os botões abaixo para reconectar ou ler um novo QR Code.
                          </div>
                        )}
                      </div>

                      {/* Esqueletos sutis apenas enquanto está carregando normalmente */}
                      {!isStalledUi && (
                        <div className="flex-1 flex flex-col justify-center gap-1 min-h-0 overflow-hidden opacity-70">
                          {[0, 1, 2].map((idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-3 px-2 py-1.5 animate-pulse"
                            >
                              <div className="w-[38px] h-[38px] rounded-full bg-[#2A3942]/75 shrink-0" />
                              <div className="flex-1 space-y-1.5">
                                <div className="h-3 bg-[#2A3942]/75 rounded w-3/5" />
                                <div className="h-2.5 bg-[#202C33] rounded w-4/5" />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Rodapé sempre disponível com ações rápidas para nunca parecer travado */}
                      <div className="shrink-0 pt-2 border-t border-white/[0.06] space-y-1.5">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={isReconnectingSession}
                            onClick={() => reconnectWhatsApp()}
                            title="Reinicia a conexão mantendo sua sessão salva"
                            className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-[11.5px] font-medium transition-all cursor-pointer disabled:opacity-50 ${
                              isStalledUi
                                ? 'bg-[#202C33] hover:bg-[#2A3942] text-[#E9EDEF] border border-white/15'
                                : 'bg-[#202C33]/75 hover:bg-[#2A3942] text-[#AEBAC1] hover:text-[#E9EDEF] border border-white/[0.06]'
                            }`}
                          >
                            <RefreshCw
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isReconnectingSession ? 'animate-spin' : ''
                              }`}
                            />
                            <span>Reconectar</span>
                          </button>
                          <button
                            type="button"
                            disabled={isReconnectingSession}
                            onClick={() => requestNewQrSession()}
                            title="Limpa a sessão antiga e gera um novo QR Code para escanear no celular"
                            className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-[11.5px] font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                              isStalledUi
                                ? 'bg-[#25D366] hover:bg-[#1fb855] text-[#111B21]'
                                : 'bg-[#202C33]/75 hover:bg-[#2A3942] text-[#AEBAC1] hover:text-[#25D366] border border-white/[0.06]'
                            }`}
                          >
                            <QrCode className="w-3.5 h-3.5 shrink-0" />
                            <span>Ler QR Code</span>
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )
          ) : filteredChats.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
              <Search className="w-8 h-8 text-[#8696A0]/40 mb-2" />
              <p className="text-[13px] text-[#8696A0]">Nenhuma conversa encontrada</p>
              <button
                type="button"
                onClick={() => {
                  setView('contacts');
                  fetchSavedContacts(chatSearch);
                }}
                className="mt-2.5 px-3 py-1.5 rounded-[6px] bg-[#00A884]/20 hover:bg-[#00A884]/30 text-[#00A884] text-[12px] font-medium transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Pesquisar nos contatos salvos</span>
              </button>
            </div>
          ) : (
            /* Lista de Conversas Rolável */
            <div className="flex-1 flex flex-col min-h-0">
              {isConnectionBroken && (
                <div className="mx-2 mt-2 mb-1 px-2.5 py-2 rounded-[6px] bg-[#2A1B1B] border border-[#EF4444]/30 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <WifiOff className="w-3.5 h-3.5 text-[#F87171] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[11.5px] font-semibold text-[#FCA5A5] truncate">
                        {waConnectionDetails?.title || 'Sessão desconectada'}
                      </div>
                      <div className="text-[10px] text-[#E9EDEF]/70 truncate">
                        Reconecte ou leia um novo QR Code
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={isReconnectingSession}
                      onClick={() => reconnectWhatsApp()}
                      title="Tentar reconectar"
                      className="p-1.5 rounded bg-white/10 hover:bg-white/20 text-[#E9EDEF] cursor-pointer"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${isReconnectingSession ? 'animate-spin' : ''}`}
                      />
                    </button>
                    <button
                      type="button"
                      disabled={isReconnectingSession}
                      onClick={() => requestNewQrSession()}
                      title="Ler novo QR Code"
                      className="px-2 py-1 rounded bg-[#25D366] hover:bg-[#1fb855] text-[#111B21] text-[10.5px] font-semibold cursor-pointer"
                    >
                      QR Code
                    </button>
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-y-auto py-1 px-1.5 wa-scrollbar">
              {filteredChats.map((chat) => (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => selectChatFromList(chat.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[5px] hover:bg-[#202C33]/80 active:bg-[#202C33] transition-colors text-left group"
                >
                  {/* Avatar do Contato ou Grupo/Comunidade */}
                  <div className="relative w-[40px] h-[40px] shrink-0 flex items-center justify-center">
                    <img
                      src={chat.avatar}
                      alt={chat.name}
                      className={`w-[40px] h-[40px] object-cover ${
                        chat.parentName ? 'rounded-[8px]' : 'rounded-full'
                      }`}
                      draggable={false}
                    />
                  </div>

                  {/* Textos Centralizados */}
                  <div className="flex-1 min-w-0">
                    {chat.parentName && (
                      <div className="text-[11px] text-[#8696A0] leading-tight truncate mb-[1px]">
                        {chat.parentName}
                      </div>
                    )}
                    <div className="text-[13.5px] font-medium text-[#E9EDEF] leading-snug truncate">
                      {chat.name}
                    </div>
                    <div className="mt-[1px]">{renderLastMessagePreview(chat)}</div>
                  </div>

                  {/* Indicador de conversa fixada, menção (@) e mensagens não lidas à direita */}
                  <div className="shrink-0 pl-1 flex items-center justify-end gap-1.5">
                    {(chat.isPinned || pinnedChatIds.includes(chat.id)) && (
                      <span title="Conversa fixada" className="inline-flex items-center justify-center">
                        <Pin className="w-3.5 h-3.5 text-[#00A884] rotate-45 shrink-0" />
                      </span>
                    )}
                    {chat.isGroup && chat.hasMention && (
                      <span
                        title="Você foi marcado neste grupo"
                        className="w-[18px] h-[18px] rounded-full bg-[#32CAED] text-[#111B21] text-[11px] font-black leading-none flex items-center justify-center shadow-sm select-none"
                      >
                        @
                      </span>
                    )}
                    {((chat.unreadCount > 0) || chat.isMarkedUnread || chat.unreadCount === -1) && (
                      chat.isMarkedUnread || chat.unreadCount === -1 ? (
                        <span
                          title="Não lida"
                          className="w-[10px] h-[10px] rounded-full bg-[#25D366] shadow-sm shrink-0"
                        />
                      ) : (
                        <span className="min-w-[20px] h-[20px] px-[6px] rounded-full bg-[#25D366] text-[#111B21] text-[11.5px] font-bold leading-none flex items-center justify-center shadow-sm">
                          {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                        </span>
                      )
                    )}
                  </div>
                </button>
              ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Tela de Nova Conversa (Contatos Salvos da Conta do WhatsApp) */
        <>
          <div className="px-3 pt-3 pb-2 flex flex-col gap-2 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setView('chats');
                    setContactSearch('');
                  }}
                  title="Voltar para conversas"
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[#AEBAC1] hover:text-[#E9EDEF] hover:bg-[#202C33] active:scale-95 transition-all cursor-pointer -ml-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <h2 className="text-[15px] font-semibold text-[#E9EDEF] tracking-tight">Nova conversa</h2>
              </div>
              <span className="text-[11px] text-[#8696A0]">
                {savedContacts.length > 0 ? `${savedContacts.length} contatos` : ''}
              </span>
            </div>

            <div className="flex items-center bg-[#202C33] rounded-[8px] px-2.5 h-[32px] gap-2 border border-transparent focus-within:border-[#00A884]/50 transition-all">
              <Search className="w-3.5 h-3.5 text-[#8696A0] shrink-0" />
              <input
                autoFocus
                type="text"
                value={contactSearch}
                onChange={(e) => handleContactSearchChange(e.target.value)}
                placeholder="Pesquisar contatos salvos..."
                className="bg-transparent text-[13px] text-[#E9EDEF] placeholder-[#8696A0] outline-none w-full"
              />
              {contactSearch && (
                <button
                  type="button"
                  onClick={() => handleContactSearchChange('')}
                  className="text-[#8696A0] hover:text-[#E9EDEF] p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {isLoadingContacts ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2.5 p-4 text-center">
              <Loader2 className="w-6 h-6 text-[#00A884] animate-spin" />
              <span className="text-[12.5px] text-[#8696A0]">
                Carregando contatos salvos...
              </span>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
              <User className="w-8 h-8 text-[#8696A0]/40 mb-2" />
              <p className="text-[13px] text-[#8696A0]">Nenhum contato encontrado</p>
              <p className="text-[11px] text-[#8696A0]/70 mt-1 max-w-[210px]">
                {contactSearch
                  ? 'Tente pesquisar por outro nome ou número'
                  : 'Nenhum contato salvo encontrado na sua conta de WhatsApp'}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto py-1 px-1.5 wa-scrollbar">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-[#00A884] uppercase tracking-wider">
                Contatos no WhatsApp
              </div>
              {filteredContacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => handleSelectContact(contact)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-[5px] hover:bg-[#202C33]/80 active:bg-[#202C33] transition-colors text-left group"
                >
                  <div className="w-[38px] h-[38px] rounded-full overflow-hidden shrink-0 bg-[#2A3942] flex items-center justify-center">
                    {contact.avatar ? (
                      <img
                        src={contact.avatar}
                        alt={contact.name}
                        className="w-full h-full object-cover rounded-full"
                        draggable={false}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-[14px] font-semibold text-[#E9EDEF]">
                        {(contact.name || '?')[0].toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] font-medium text-[#E9EDEF] leading-snug truncate">
                      {contact.name}
                    </div>
                    {(contact.phoneNumber || contact.pushname) && (
                      <div className="text-[11.5px] text-[#8696A0] leading-tight truncate mt-0.5">
                        {contact.phoneNumber || contact.pushname}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Seta / Triângulo Inferior Direito Apontando exatamente para o Centro do Botão Verde do WhatsApp */}
      <div
        style={{
          right: `${arrowRightPx}px`,
          clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
        }}
        className="w-[16px] h-[8px] bg-[#18191B] absolute top-full -mt-[1px] pointer-events-none z-30"
        aria-hidden="true"
      />
    </motion.div>
  );
};
