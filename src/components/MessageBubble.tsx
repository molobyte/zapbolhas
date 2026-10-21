import React, { useEffect, useState } from 'react';
import {
  CornerUpLeft,
  Maximize2,
  ExternalLink,
  Loader2,
  Image as ImageIcon,
  Play,
  Video as VideoIcon,
  Star,
} from 'lucide-react';
import { FormattedMessage, QuotedMessage, DEFAULT_AVATAR } from '../types/whatsapp';
import { useBubbleStore } from '../store/useBubbleStore';
import { AudioPlayer } from './AudioPlayer';
import { normalizeImageToStickerWebp } from './EmojiStickerPicker';
import { FormattedText } from './FormattedText';

interface MessageBubbleProps {
  message: FormattedMessage;
  isFirstInGroup: boolean;
  isGroupChat?: boolean;
  onReply: (quote: QuotedMessage) => void;
}

const DoubleCheckIcon: React.FC<{ ack?: 'sent' | 'delivered' | 'read' }> = ({ ack = 'read' }) => (
  <svg
    viewBox="0 0 16 11"
    className={`w-[15px] h-[11px] inline-block ml-1 shrink-0 ${
      ack === 'read' ? 'text-[#53BDEB]' : 'text-[#99BEB7]'
    }`}
    fill="currentColor"
  >
    <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.336-.146.47.47 0 0 0-.343.146l-.311.31a.445.445 0 0 0-.14.337c0 .136.047.25.14.343l2.996 2.996a.724.724 0 0 0 .502.203.697.697 0 0 0 .546-.266l6.646-8.417a.497.497 0 0 0 .108-.299.441.441 0 0 0-.19-.374l-.338-.273Zm3.614 0a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.2-1.135-.66.819 1.67 1.67a.724.724 0 0 0 .502.203.697.697 0 0 0 .546-.266l6.646-8.417a.497.497 0 0 0 .108-.299.441.441 0 0 0-.19-.374l-.347-.273Z" />
  </svg>
);

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isFirstInGroup,
  isGroupChat,
  onReply,
}) => {
  const {
    fromMe,
    type,
    text,
    timestamp,
    dateLabel,
    quotedMessage,
    reaction,
    audioData,
    ack,
    senderName,
    senderColor,
    senderAvatar,
    imageUrl,
    videoUrl,
    mediaDuration,
    isHdLoaded,
  } = message;

  const { updateMessageMedia, setViewingImage } = useBubbleStore();
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [autoPlayVideo, setAutoPlayVideo] = useState(false);
  const [savedSticker, setSavedSticker] = useState(false);

  // Decripta automaticamente imagens, vídeos, figurinhas e áudios em alta resolução
  useEffect(() => {
    let cancelled = false;
    if (
      (type === 'image' || type === 'sticker' || type === 'audio' || type === 'video') &&
      !isHdLoaded &&
      window.electronAPI?.downloadMedia
    ) {
      setIsLoadingMedia(true);
      window.electronAPI
        .downloadMedia(message.id)
        .then((dataUrl) => {
          if (!cancelled && dataUrl) {
            updateMessageMedia(message.chatId, message.id, dataUrl);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingMedia(false);
          }
        });
    }
    return () => {
      cancelled = true;
    };
  }, [type, isHdLoaded, message.id, message.chatId, updateMessageMedia]);

  const handlePlayOrExpandVideo = async (
    e: React.MouseEvent,
    openInLightbox = false
  ) => {
    e.stopPropagation();
    let targetVideoUrl = videoUrl;

    if (!targetVideoUrl && window.electronAPI?.downloadMedia) {
      setIsLoadingMedia(true);
      const hd = await window.electronAPI.downloadMedia(message.id);
      setIsLoadingMedia(false);
      if (hd) {
        updateMessageMedia(message.chatId, message.id, hd);
        targetVideoUrl = hd;
      }
    }

    if (!targetVideoUrl) return;

    if (openInLightbox) {
      if (
        useBubbleStore.getState().activeChatId === message.chatId &&
        useBubbleStore.getState().activePopover === 'chat-window'
      ) {
        setViewingImage({
          messageId: message.id,
          mediaType: 'video',
          imageUrl: imageUrl || '',
          videoUrl: targetVideoUrl,
          caption: text || undefined,
          senderName: fromMe ? 'Você' : senderName || 'Contato',
          timestamp,
        });
      }
    } else {
      setAutoPlayVideo(true);
    }
  };

  const handleOpenImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let targetUrl = imageUrl;

    if (!isHdLoaded && window.electronAPI?.downloadMedia) {
      setIsLoadingMedia(true);
      const hd = await window.electronAPI.downloadMedia(message.id);
      setIsLoadingMedia(false);
      if (hd) {
        updateMessageMedia(message.chatId, message.id, hd);
        targetUrl = hd;
      }
    }

    if (
      targetUrl &&
      useBubbleStore.getState().activeChatId === message.chatId &&
      useBubbleStore.getState().activePopover === 'chat-window'
    ) {
      setViewingImage({
        messageId: message.id,
        mediaType: 'image',
        imageUrl: targetUrl,
        caption: text || undefined,
        senderName: fromMe ? 'Você' : senderName || 'Contato',
        timestamp,
      });
    }
  };

  const handleOpenExternal = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let targetUrl = type === 'video' ? videoUrl : imageUrl;

    if ((!isHdLoaded || !targetUrl) && window.electronAPI?.downloadMedia) {
      setIsLoadingMedia(true);
      const hd = await window.electronAPI.downloadMedia(message.id);
      setIsLoadingMedia(false);
      if (hd) {
        updateMessageMedia(message.chatId, message.id, hd);
        targetUrl = hd;
      }
    }

    if (targetUrl && window.electronAPI?.openExternalImage) {
      await window.electronAPI.openExternalImage(targetUrl);
    }
  };

  const handleSaveStickerToLibrary = async (e: React.MouseEvent) => {
    e.stopPropagation();
    let targetUrl = imageUrl;
    if ((!isHdLoaded || !targetUrl) && window.electronAPI?.downloadMedia) {
      setIsLoadingMedia(true);
      const hd = await window.electronAPI.downloadMedia(message.id);
      setIsLoadingMedia(false);
      if (hd) {
        updateMessageMedia(message.chatId, message.id, hd);
        targetUrl = hd;
      }
    }
    if (!targetUrl || !window.electronAPI?.saveStickerToLibrary) return;
    const webpUrl = await normalizeImageToStickerWebp(targetUrl);
    const saved = await window.electronAPI.saveStickerToLibrary(webpUrl);
    if (saved) {
      setSavedSticker(true);
    }
  };

  const handleReplyTrigger = () => {
    onReply({
      id: message.id,
      author: fromMe ? 'Você' : senderName || 'Contato',
      authorColor: fromMe ? '#06CF9C' : senderColor || '#E59866',
      text:
        type === 'audio'
          ? `🎤 Mensagem de voz (${audioData?.duration || '0:46'})`
          : type === 'video'
          ? text || '🎥 Vídeo'
          : type === 'image'
          ? text || '📷 Foto'
          : type === 'sticker'
          ? '💟 Figurinha'
          : text,
    });
  };

  return (
    <>
      {/* Separador de Data Centralizado (ex: "Hoje") */}
      {dateLabel && (
        <div className="flex justify-center my-2.5">
          <span className="bg-[#182229] text-[#8696A0] text-[11px] font-medium px-3 py-1 rounded-[7px] shadow-sm select-none">
            {dateLabel}
          </span>
        </div>
      )}

      {/* Linha da Mensagem */}
      <div
        onDoubleClick={handleReplyTrigger}
        className={`group/msg relative flex items-center ${
          fromMe ? 'justify-end' : 'justify-start'
        } ${reaction ? 'mb-3.5' : 'mb-[3px]'}`}
      >
        {/* Foto do perfil do membro à esquerda do balão em conversas de grupo */}
        {!fromMe && isGroupChat && (
          <div className="w-[28px] h-[28px] mr-2 self-start mt-0.5 shrink-0">
            {isFirstInGroup && (
              <img
                src={senderAvatar || DEFAULT_AVATAR}
                alt={senderName || 'Membro'}
                className="w-[28px] h-[28px] rounded-full object-cover border border-white/10 shadow-sm"
                draggable={false}
              />
            )}
          </div>
        )}

        {/* Botão de Responder em Hover (Esquerda para enviadas) */}
        {fromMe && (
          <button
            type="button"
            onClick={handleReplyTrigger}
            title="Responder mensagem"
            className="opacity-0 group-hover/msg:opacity-100 mr-1.5 p-1 rounded-full bg-[#202C33]/80 text-[#8696A0] hover:text-[#E9EDEF] transition-opacity"
          >
            <CornerUpLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Balão da Mensagem */}
        <div
          className={`relative ${
            !fromMe && isGroupChat ? 'max-w-[76%]' : 'max-w-[82%]'
          } rounded-[7.5px] px-2.5 py-1.5 shadow-[0_1px_1px_rgba(0,0,0,0.3)] ${
            fromMe
              ? 'bg-[#005C4B] text-[#E9EDEF]'
              : 'bg-[#202C33] text-[#E9EDEF]'
          } ${isFirstInGroup && !fromMe ? 'rounded-tl-none' : ''} ${
            isFirstInGroup && fromMe ? 'rounded-tr-none' : ''
          }`}
        >
          {/* Tail / Pontinha superior do primeiro balão */}
          {isFirstInGroup && !fromMe && (
            <svg
              viewBox="0 0 8 13"
              className="w-2 h-3 text-[#202C33] fill-current absolute -left-[7px] top-0 pointer-events-none"
            >
              <path d="M1.533 3.568 8 12.193V1H2.812C1.042 1 .474 2.156 1.533 3.568z" />
            </svg>
          )}
          {isFirstInGroup && fromMe && (
            <svg
              viewBox="0 0 8 13"
              className="w-2 h-3 text-[#005C4B] fill-current absolute -right-[7px] top-0 pointer-events-none"
            >
              <path d="M5.188 1H0v11.193l6.467-8.625C7.526 2.156 6.958 1 5.188 1z" />
            </svg>
          )}

          {/* Nome do Remetente em Grupos */}
          {!fromMe && isGroupChat && senderName && isFirstInGroup && (
            <div
              style={{ color: senderColor || '#53BDEB' }}
              className="text-[11.5px] font-semibold leading-tight truncate mb-0.5"
            >
              {senderName}
            </div>
          )}

          {/* Bloco de Mensagem Citada (Reply/Quote) */}
          {quotedMessage && (
            <div
              style={{
                borderLeftColor: quotedMessage.authorColor || '#E59866',
              }}
              className={`rounded-[5px] border-l-[4px] px-2.5 py-1.5 mb-1.5 ${
                fromMe ? 'bg-[#025144]' : 'bg-[#1D282F]'
              }`}
            >
              <div
                style={{ color: quotedMessage.authorColor || '#E59866' }}
                className="text-[12px] font-semibold leading-tight truncate"
              >
                {quotedMessage.author}
              </div>
              <div className="text-[12px] text-[#B8C7C4] leading-snug line-clamp-2 mt-0.5">
                <FormattedText text={quotedMessage.text} />
              </div>
            </div>
          )}

          {/* Conteúdo: Player de Áudio, Vídeo, Imagem/Figurinha ou Texto */}
          {type === 'audio' && audioData ? (
            <AudioPlayer
              audioData={audioData}
              timestamp={timestamp}
              fromMe={fromMe}
              ack={ack}
            />
          ) : (
            <div className="text-[13.2px] leading-[18px] break-words">
              {type === 'video' && (
                <div className="relative group/vid mb-1.5 overflow-hidden rounded-[6px] bg-black/80 min-w-[210px]">
                  {videoUrl ? (
                    <div className="relative overflow-hidden rounded-[6px]">
                      <video
                        src={videoUrl}
                        poster={imageUrl}
                        controls
                        autoPlay={autoPlayVideo}
                        playsInline
                        preload="metadata"
                        onClick={(e) => e.stopPropagation()}
                        className="w-full min-w-[210px] max-h-[260px] rounded-[6px] bg-black object-contain"
                      />
                      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover/vid:opacity-100 transition-opacity flex items-center gap-1.5 z-10">
                        <button
                          type="button"
                          onClick={(e) => handlePlayOrExpandVideo(e, true)}
                          title="Ampliar vídeo na janela"
                          className="p-1.5 rounded-full bg-[#111B21]/85 text-white shadow-md hover:bg-[#00A884] transition-colors"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleOpenExternal}
                          title="Abrir vídeo no reprodutor do Windows"
                          className="p-1.5 rounded-full bg-[#111B21]/85 text-white shadow-md hover:bg-[#00A884] transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={(e) => handlePlayOrExpandVideo(e, false)}
                      title="Clique para carregar e reproduzir o vídeo"
                      className="relative cursor-pointer overflow-hidden rounded-[6px] min-w-[210px] min-h-[140px] flex items-center justify-center bg-[#111B21]"
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={text || 'Vídeo'}
                          className={`w-full min-w-[210px] max-h-[240px] object-cover rounded-[6px] ${
                            isLoadingMedia ? 'blur-[1.5px] brightness-75' : 'brightness-90'
                          }`}
                        />
                      ) : (
                        <div className="w-[210px] h-[140px] flex flex-col items-center justify-center gap-1.5 text-[#8696A0]">
                          <VideoIcon className="w-7 h-7 text-[#25D366]" />
                          <span className="text-[11.5px]">Vídeo</span>
                        </div>
                      )}

                      {/* Botão Play Central ou Spinner de Carregamento */}
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <div className="w-11 h-11 rounded-full bg-black/65 border border-white/25 flex items-center justify-center text-white shadow-lg group-hover/vid:scale-105 group-hover/vid:bg-[#00A884] transition-all">
                          {isLoadingMedia ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          )}
                        </div>
                      </div>

                      {/* Badge inferior esquerdo com ícone de vídeo e duração */}
                      <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10.5px] flex items-center gap-1 select-none">
                        <VideoIcon className="w-3 h-3" />
                        <span>{mediaDuration || 'Vídeo'}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {type !== 'video' && (type === 'image' || type === 'sticker' || imageUrl) && (
                <div className="relative group/img mb-1.5 overflow-hidden rounded-[6px]">
                  {imageUrl ? (
                    <div
                      onClick={handleOpenImage}
                      title="Clique para visualizar e ampliar a imagem"
                      className="relative cursor-pointer overflow-hidden rounded-[6px]"
                    >
                      <img
                        src={imageUrl}
                        alt={text || 'Imagem'}
                        className={`w-full rounded-[6px] transition-transform duration-200 group-hover/img:scale-[1.02] ${
                          type === 'sticker'
                            ? 'max-w-[130px] max-h-[130px] object-contain'
                            : 'min-w-[190px] max-h-[240px] object-cover'
                        } ${!isHdLoaded && isLoadingMedia ? 'blur-[1.5px] brightness-90' : ''}`}
                      />

                      {/* Spinner sutil enquanto baixa a versão HD */}
                      {isLoadingMedia && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin drop-shadow" />
                        </div>
                      )}

                      {/* Overlay em Hover com botões de Ampliar, Favoritar Figurinha e Abrir no Windows */}
                      <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                        <span className="p-1.5 rounded-full bg-[#111B21]/85 text-white shadow-md hover:bg-[#00A884] transition-colors">
                          <Maximize2 className="w-4 h-4" />
                        </span>
                        {type === 'sticker' && (
                          <button
                            type="button"
                            onClick={handleSaveStickerToLibrary}
                            title={
                              savedSticker
                                ? 'Salva na sua biblioteca de figurinhas!'
                                : 'Salvar figurinha na minha biblioteca'
                            }
                            className={`p-1.5 rounded-full bg-[#111B21]/85 shadow-md transition-colors ${
                              savedSticker
                                ? 'text-[#FBBF24] bg-[#005C4B]'
                                : 'text-[#FBBF24] hover:bg-[#00A884] hover:text-white'
                            }`}
                          >
                            <Star
                              className={`w-4 h-4 ${savedSticker ? 'fill-current' : ''}`}
                            />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleOpenExternal}
                          title="Abrir imagem no Visualizador de Fotos do Windows"
                          className="p-1.5 rounded-full bg-[#111B21]/85 text-white shadow-md hover:bg-[#00A884] transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleOpenImage}
                      className="w-[200px] h-[120px] rounded-[6px] bg-[#182229]/80 hover:bg-[#182229] border border-white/10 flex flex-col items-center justify-center gap-1.5 text-[#8696A0] hover:text-[#E9EDEF] transition-colors"
                    >
                      {isLoadingMedia ? (
                        <>
                          <Loader2 className="w-5 h-5 text-[#25D366] animate-spin" />
                          <span className="text-[11.5px]">Carregando foto...</span>
                        </>
                      ) : (
                        <>
                          <ImageIcon className="w-6 h-6 text-[#25D366]" />
                          <span className="text-[11.5px]">Clique para abrir a foto</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {text && <FormattedText text={text} mentions={message.mentions} />}

              <span className="inline-flex items-center float-right ml-2.5 mt-1.5 -mb-0.5 text-[10.5px] text-[#8696A0] select-none leading-none">
                <span>{timestamp}</span>
                {fromMe && <DoubleCheckIcon ack={ack} />}
              </span>
            </div>
          )}

          {/* Reação de Emoji no Canto Inferior Direito (ex: 😂) */}
          {reaction && (
            <div className="absolute -bottom-[13px] right-2 bg-[#1F2C34] border border-[#0B141A] rounded-full px-1.5 py-[1px] text-[12px] leading-tight shadow-md select-none z-10">
              {reaction}
            </div>
          )}
        </div>

        {/* Botão de Responder em Hover (Direita para recebidas) */}
        {!fromMe && (
          <button
            type="button"
            onClick={handleReplyTrigger}
            title="Responder mensagem"
            className="opacity-0 group-hover/msg:opacity-100 ml-1.5 p-1 rounded-full bg-[#202C33]/80 text-[#8696A0] hover:text-[#E9EDEF] transition-opacity"
          >
            <CornerUpLeft className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </>
  );
};
