import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Download,
  ExternalLink,
  Maximize2,
  Minimize2,
  Image as ImageIcon,
  Video as VideoIcon,
  Loader2,
} from 'lucide-react';
import { ViewingImageState } from '../types/whatsapp';
import { useBubbleStore } from '../store/useBubbleStore';
import { FormattedText } from './FormattedText';

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

interface MediaViewerModalProps {
  isStandaloneWindow?: boolean;
  onInteractiveEnter?: () => void;
  onInteractiveLeave?: () => void;
}

const MIN_WIDTH = 420;
const MIN_HEIGHT = 340;

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  isStandaloneWindow = false,
  onInteractiveEnter,
  onInteractiveLeave,
}) => {
  const { viewingImage, setViewingImage } = useBubbleStore();
  const [standaloneMedia, setStandaloneMedia] = useState<ViewingImageState | null>(null);
  const media = isStandaloneWindow ? standaloneMedia : viewingImage;

  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingPan, setIsDraggingPan] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number }>({
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
  });

  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isLoadingHd, setIsLoadingHd] = useState<boolean>(false);
  const [isHdReady, setIsHdReady] = useState<boolean>(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  // Estado de tamanho/posição para modo modal flutuante (quando não está em janela Electron separada)
  const [modalBounds, setModalBounds] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>(() => {
    const w = typeof window !== 'undefined' ? Math.min(820, Math.round(window.innerWidth * 0.72)) : 760;
    const h = typeof window !== 'undefined' ? Math.min(600, Math.round(window.innerHeight * 0.75)) : 540;
    const x = typeof window !== 'undefined' ? Math.max(20, Math.round((window.innerWidth - w) / 2)) : 100;
    const y = typeof window !== 'undefined' ? Math.max(20, Math.round((window.innerHeight - h) / 2)) : 80;
    return { x, y, width: w, height: h };
  });

  const resetView = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, []);

  // Carrega dados iniciais e escuta novas imagens quando em janela standalone do Electron
  useEffect(() => {
    if (!isStandaloneWindow) return;

    if (window.electronAPI?.getMediaViewerData) {
      window.electronAPI.getMediaViewerData().then((data) => {
        if (data) {
          setStandaloneMedia(data);
          resetView();
          setNaturalSize(null);
          setIsHdReady(false);
        }
      });
    }

    const unsub = window.electronAPI?.onMediaViewerData
      ? window.electronAPI.onMediaViewerData((data) => {
          if (data) {
            setStandaloneMedia(data);
            resetView();
            setNaturalSize(null);
            setIsHdReady(false);
          }
        })
      : () => {};

    return () => {
      unsub();
    };
  }, [isStandaloneWindow, resetView]);

  // Sempre que mudar a mídia no modo in-app, reseta zoom/rotação
  useEffect(() => {
    if (!isStandaloneWindow && viewingImage) {
      resetView();
      setNaturalSize(null);
      setIsHdReady(false);
    }
  }, [isStandaloneWindow, viewingImage?.messageId, viewingImage?.imageUrl, resetView]);

  // Busca versão em Alta Definição (HD) automaticamente se houver messageId
  useEffect(() => {
    if (!media?.messageId || !window.electronAPI?.downloadMedia) return;

    let cancelled = false;
    setIsLoadingHd(true);

    window.electronAPI
      .downloadMedia(media.messageId)
      .then((hdDataUrl) => {
        if (cancelled || !hdDataUrl) return;
        setIsHdReady(true);
        if (isStandaloneWindow) {
          setStandaloneMedia((prev) => {
            if (!prev || prev.messageId !== media.messageId) return prev;
            if (hdDataUrl.startsWith('data:video/') || prev.mediaType === 'video') {
              return { ...prev, videoUrl: hdDataUrl };
            }
            return { ...prev, imageUrl: hdDataUrl };
          });
        } else {
          const current = useBubbleStore.getState().viewingImage;
          if (current && current.messageId === media.messageId) {
            if (hdDataUrl.startsWith('data:video/') || current.mediaType === 'video') {
              setViewingImage({ ...current, videoUrl: hdDataUrl });
            } else {
              setViewingImage({ ...current, imageUrl: hdDataUrl });
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingHd(false);
      });

    return () => {
      cancelled = true;
    };
  }, [media?.messageId, isStandaloneWindow, setViewingImage]);

  const handleClose = useCallback(() => {
    if (isStandaloneWindow && window.electronAPI?.closeMediaViewerWindow) {
      window.electronAPI.closeMediaViewerWindow();
    } else {
      setViewingImage(null);
    }
  }, [isStandaloneWindow, setViewingImage]);

  const handleToggleMaximize = useCallback(async () => {
    if (isStandaloneWindow && window.electronAPI?.toggleMaximizeMediaViewer) {
      const maximized = await window.electronAPI.toggleMaximizeMediaViewer();
      setIsMaximized(maximized);
    } else {
      setIsMaximized((prev) => !prev);
    }
  }, [isStandaloneWindow]);

  // Atalhos de teclado: ESC fecha, + amplia, - reduz, 0 reseta, R gira
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom((z) => Math.min(5, Number((z + 0.25).toFixed(2))));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoom((z) => Math.max(0.25, Number((z - 0.25).toFixed(2))));
      } else if (e.key === '0') {
        e.preventDefault();
        resetView();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setRotation((r) => (r + 90) % 360);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClose, resetView]);

  // Zoom suave com a roda do mouse
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom((prev) => {
      const next = Math.min(5, Math.max(0.25, Number((prev + delta).toFixed(2))));
      if (next === 1) {
        setPan({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  // Arrastar imagem (Pan)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (media?.mediaType === 'video') return;
    e.preventDefault();
    setIsDraggingPan(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  useEffect(() => {
    if (!isDraggingPan) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
    };

    const handleMouseUp = () => {
      setIsDraggingPan(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingPan]);

  // Redimensionamento interativo em 8 direções (bordas e cantos)
  const handleStartResize = useCallback(
    async (dir: ResizeDirection, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const startScreenX = e.screenX;
      const startScreenY = e.screenY;

      let initialBounds = modalBounds;
      if (isStandaloneWindow && window.electronAPI?.getMediaViewerBounds) {
        const b = await window.electronAPI.getMediaViewerBounds();
        if (b) {
          initialBounds = { x: b.x, y: b.y, width: b.width, height: b.height };
          if (b.isMaximized) setIsMaximized(false);
        }
      }

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.screenX - startScreenX;
        const dy = moveEvent.screenY - startScreenY;

        let newX = initialBounds.x;
        let newY = initialBounds.y;
        let newWidth = initialBounds.width;
        let newHeight = initialBounds.height;

        if (dir.includes('e')) {
          newWidth = Math.max(MIN_WIDTH, initialBounds.width + dx);
        }
        if (dir.includes('s')) {
          newHeight = Math.max(MIN_HEIGHT, initialBounds.height + dy);
        }
        if (dir.includes('w')) {
          const proposedWidth = Math.max(MIN_WIDTH, initialBounds.width - dx);
          newX = initialBounds.x + (initialBounds.width - proposedWidth);
          newWidth = proposedWidth;
        }
        if (dir.includes('n')) {
          const proposedHeight = Math.max(MIN_HEIGHT, initialBounds.height - dy);
          newY = initialBounds.y + (initialBounds.height - proposedHeight);
          newHeight = proposedHeight;
        }

        if (isStandaloneWindow && window.electronAPI?.setMediaViewerBounds) {
          window.electronAPI.setMediaViewerBounds({
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
          });
        } else {
          setModalBounds({
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
          });
        }
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [isStandaloneWindow, modalBounds]
  );

  // Arrastar janela pelo cabeçalho quando em modo modal flutuante in-app
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (isStandaloneWindow || isMaximized) return;
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    const startX = e.screenX;
    const startY = e.screenY;
    const initialX = modalBounds.x;
    const initialY = modalBounds.y;

    const handleMove = (mv: MouseEvent) => {
      setModalBounds((prev) => ({
        ...prev,
        x: initialX + (mv.screenX - startX),
        y: initialY + (mv.screenY - startY),
      }));
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handleDownload = async () => {
    if (!media) return;
    const isVideo = media.mediaType === 'video';
    let urlToDownload = isVideo ? media.videoUrl || media.imageUrl : media.imageUrl;
    if (media.messageId && window.electronAPI?.downloadMedia) {
      const hd = await window.electronAPI.downloadMedia(media.messageId);
      if (hd) urlToDownload = hd;
    }
    const link = document.createElement('a');
    link.href = urlToDownload;
    link.download = isVideo
      ? `zapbolhas-video-${Date.now()}.mp4`
      : `zapbolhas-imagem-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenExternal = async () => {
    if (!media) return;
    const isVideo = media.mediaType === 'video';
    let urlToOpen = isVideo ? media.videoUrl || media.imageUrl : media.imageUrl;
    if (media.messageId && window.electronAPI?.downloadMedia) {
      const hd = await window.electronAPI.downloadMedia(media.messageId);
      if (hd) urlToOpen = hd;
    }
    window.electronAPI?.openExternalImage(urlToOpen);
  };

  if (!media) {
    if (isStandaloneWindow) {
      return (
        <div className="w-screen h-screen bg-[#0B141A] flex items-center justify-center text-[#8696A0]">
          <Loader2 className="w-6 h-6 text-[#25D366] animate-spin" />
        </div>
      );
    }
    return null;
  }

  const isVideo = media.mediaType === 'video' && Boolean(media.videoUrl);
  const isModifiedView = zoom !== 1 || rotation !== 0 || pan.x !== 0 || pan.y !== 0;

  return (
    <motion.div
      data-interactive="true"
      onMouseEnter={onInteractiveEnter}
      onMouseLeave={onInteractiveLeave}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
      style={
        isStandaloneWindow
          ? undefined
          : isMaximized
          ? { top: 12, left: 12, width: 'calc(100vw - 24px)', height: 'calc(100vh - 24px)' }
          : {
              top: modalBounds.y,
              left: modalBounds.x,
              width: modalBounds.width,
              height: modalBounds.height,
            }
      }
      className={
        isStandaloneWindow
          ? `relative w-full h-full bg-[#18191B] ${
              isMaximized ? 'rounded-none' : 'rounded-[10px]'
            } shadow-[0_18px_52px_rgba(0,0,0,0.9)] border border-white/[0.12] flex flex-col pointer-events-auto text-[#E9EDEF] overflow-hidden select-none`
          : `fixed z-[100] bg-[#18191B] rounded-[10px] shadow-[0_20px_60px_rgba(0,0,0,0.92)] border border-white/[0.14] flex flex-col pointer-events-auto text-[#E9EDEF] overflow-hidden select-none`
      }
    >
      {/* Alças de Redimensionamento em 8 Direções (Bordas e Cantos) */}
      {!isMaximized && (
        <>
          {/* Topo (N) */}
          <div
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            onMouseDown={(e) => handleStartResize('n', e)}
            className="absolute top-0 left-3 right-3 h-[5px] cursor-ns-resize z-50"
          />
          {/* Base (S) */}
          <div
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            onMouseDown={(e) => handleStartResize('s', e)}
            className="absolute bottom-0 left-3 right-3 h-[6px] cursor-ns-resize z-50"
          />
          {/* Esquerda (W) */}
          <div
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            onMouseDown={(e) => handleStartResize('w', e)}
            className="absolute top-3 bottom-3 left-0 w-[6px] cursor-ew-resize z-50"
          />
          {/* Direita (E) */}
          <div
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            onMouseDown={(e) => handleStartResize('e', e)}
            className="absolute top-3 bottom-3 right-0 w-[6px] cursor-ew-resize z-50"
          />
          {/* Canto Superior Esquerdo (NW) */}
          <div
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            onMouseDown={(e) => handleStartResize('nw', e)}
            className="absolute top-0 left-0 w-3.5 h-3.5 cursor-nwse-resize z-50"
          />
          {/* Canto Superior Direito (NE) */}
          <div
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            onMouseDown={(e) => handleStartResize('ne', e)}
            className="absolute top-0 right-0 w-3.5 h-3.5 cursor-nesw-resize z-50"
          />
          {/* Canto Inferior Esquerdo (SW) */}
          <div
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            onMouseDown={(e) => handleStartResize('sw', e)}
            className="absolute bottom-0 left-0 w-3.5 h-3.5 cursor-nesw-resize z-50"
          />
          {/* Canto Inferior Direito (SE) com Grip Visual */}
          <div
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            onMouseDown={(e) => handleStartResize('se', e)}
            title="Arraste para redimensionar a janela"
            className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-50 flex items-end justify-end p-1 text-[#8696A0]/60 hover:text-[#25D366] transition-colors"
          >
            <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-current">
              <path d="M9 1v8H1L9 1zm-2 4L5 7h2V5z" />
            </svg>
          </div>
        </>
      )}

      {/* Barra de Título e Ferramentas Estilo Zapbolhas / Windows */}
      <header
        style={isStandaloneWindow ? ({ WebkitAppRegion: 'drag' } as React.CSSProperties) : undefined}
        onMouseDown={handleHeaderMouseDown}
        onDoubleClick={handleToggleMaximize}
        className="h-[46px] bg-[#111B21] border-b border-white/[0.08] flex items-center justify-between pl-3.5 pr-0 shrink-0 select-none cursor-move z-20"
      >
        {/* Info do Remetente e Horário */}
        <div className="flex items-center gap-2.5 min-w-0 pr-3">
          <div className="w-7 h-7 rounded-full bg-[#005C4B] flex items-center justify-center shrink-0 border border-[#25D366]/30">
            {isVideo ? (
              <VideoIcon className="w-3.5 h-3.5 text-[#25D366]" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5 text-[#25D366]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#E9EDEF] truncate">
                {media.senderName || 'Visualizador de Imagem'}
              </span>
              {isLoadingHd && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#202C33] text-[10px] text-[#8696A0]">
                  <Loader2 className="w-2.5 h-2.5 animate-spin text-[#25D366]" />
                  HD
                </span>
              )}
              {!isLoadingHd && isHdReady && (
                <span className="px-1.5 py-0.2 rounded bg-[#005C4B]/60 border border-[#25D366]/30 text-[9.5px] font-bold text-[#25D366]">
                  HD
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10.5px] text-[#8696A0] leading-tight">
              {media.timestamp && <span>Hoje às {media.timestamp}</span>}
              {naturalSize && (
                <>
                  {media.timestamp && <span>•</span>}
                  <span>
                    {naturalSize.width} × {naturalSize.height} px
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Controles de Zoom, Rotação, Download e Janela */}
        <div
          style={isStandaloneWindow ? ({ WebkitAppRegion: 'no-drag' } as React.CSSProperties) : undefined}
          className="flex items-center h-full shrink-0"
        >
          {!isVideo && (
            <div className="flex items-center gap-1 mr-1.5 bg-[#202C33]/80 px-1.5 py-1 rounded-[7px] border border-white/[0.06]">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.25, Number((z - 0.25).toFixed(2))))}
                title="Reduzir zoom (-)"
                className="p-1 rounded hover:bg-[#2A3942] text-[#AEBAC1] hover:text-white transition-colors cursor-pointer"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={resetView}
                title="Clique para restaurar 100% (Atalho: 0)"
                className="min-w-[44px] px-1.5 py-0.5 rounded text-[11px] font-semibold text-[#25D366] hover:bg-[#2A3942] transition-colors text-center cursor-pointer"
              >
                {Math.round(zoom * 100)}%
              </button>

              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(5, Number((z + 0.25).toFixed(2))))}
                title="Aumentar zoom (+)"
                className="p-1 rounded hover:bg-[#2A3942] text-[#AEBAC1] hover:text-white transition-colors cursor-pointer"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <div className="w-[1px] h-3.5 bg-white/10 mx-0.5" />

              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                title="Girar 90° (Atalho: R)"
                className="p-1 rounded hover:bg-[#2A3942] text-[#AEBAC1] hover:text-white transition-colors cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>

              {isModifiedView && (
                <button
                  type="button"
                  onClick={resetView}
                  title="Ajustar à janela / Restaurar posição"
                  className="p-1 rounded hover:bg-[#2A3942] text-[#25D366] hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Ações de Arquivo */}
          <div className="flex items-center gap-0.5 mr-1">
            <button
              type="button"
              onClick={handleDownload}
              title="Salvar no computador"
              className="p-2 rounded-[6px] hover:bg-[#202C33] text-[#AEBAC1] hover:text-[#E9EDEF] transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleOpenExternal}
              title="Abrir no Visualizador de Fotos do Windows"
              className="p-2 rounded-[6px] hover:bg-[#202C33] text-[#25D366] hover:text-[#E9EDEF] transition-colors cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          <div className="w-[1px] h-4 bg-white/10 mx-0.5" />

          {/* Controles de Janela Estilo Windows */}
          <button
            type="button"
            onClick={handleToggleMaximize}
            title={isMaximized ? 'Restaurar tamanho' : 'Maximizar janela'}
            className="w-10 h-full flex items-center justify-center text-[#8696A0] hover:text-white hover:bg-[#202C33] transition-colors cursor-pointer"
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleClose}
            title="Fechar (ESC)"
            className="w-10 h-full flex items-center justify-center text-[#8696A0] hover:text-white hover:bg-[#E81123] active:bg-[#C4101F] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Área Central da Imagem / Vídeo com Fundo Padrão do Zapbolhas */}
      <div
        onWheel={handleWheel}
        onMouseDown={handleCanvasMouseDown}
        onDoubleClick={() => {
          if (isVideo) return;
          if (zoom > 1 || pan.x !== 0 || pan.y !== 0) {
            resetView();
          } else {
            setZoom(2);
          }
        }}
        className={`relative flex-1 min-h-0 overflow-hidden bg-[#0B141A] flex items-center justify-center p-4 ${
          !isVideo
            ? isDraggingPan
              ? 'cursor-grabbing'
              : zoom > 1
              ? 'cursor-grab'
              : 'cursor-zoom-in'
            : ''
        }`}
      >
        {/* Textura Doodle sutil ao fundo igual à janela de conversa */}
        <div
          className="absolute inset-0 opacity-[0.06] bg-repeat pointer-events-none"
          style={{
            backgroundImage: "url('/wa-doodle-bg.png')",
            backgroundSize: '200px 200px',
          }}
        />

        {isVideo ? (
          <video
            src={media.videoUrl}
            poster={media.imageUrl || undefined}
            controls
            autoPlay
            playsInline
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 max-w-full max-h-full object-contain rounded-[6px] shadow-[0_12px_36px_rgba(0,0,0,0.8)] bg-black"
          />
        ) : (
          <img
            src={media.imageUrl}
            alt={media.caption || 'Imagem ampliada'}
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
              }
            }}
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
            className={`relative z-10 max-w-full max-h-full object-contain rounded-[4px] shadow-[0_12px_36px_rgba(0,0,0,0.8)] ${
              isDraggingPan ? '' : 'transition-transform duration-150 ease-out'
            }`}
          />
        )}

        {/* Barra Flutuante Inferior de Controle Rápido de Zoom */}
        {!isVideo && (
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="absolute bottom-3.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#111B21]/90 backdrop-blur-md border border-white/[0.1] shadow-[0_8px_24px_rgba(0,0,0,0.75)]"
          >
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.25, Number((z - 0.25).toFixed(2))))}
              title="Diminuir zoom"
              className="text-[#8696A0] hover:text-[#E9EDEF] transition-colors cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              min={0.25}
              max={4}
              step={0.05}
              value={Math.min(4, zoom)}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-24 accent-[#25D366] cursor-pointer h-1 bg-[#2A3942] rounded-lg"
            />

            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(5, Number((z + 0.25).toFixed(2))))}
              title="Aumentar zoom"
              className="text-[#8696A0] hover:text-[#E9EDEF] transition-colors cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] font-mono font-semibold text-[#25D366] min-w-[38px] text-right">
              {Math.round(zoom * 100)}%
            </span>

            {isModifiedView && (
              <>
                <div className="w-[1px] h-3.5 bg-white/10" />
                <button
                  type="button"
                  onClick={resetView}
                  className="text-[11px] text-[#E9EDEF] hover:text-[#25D366] font-medium transition-colors cursor-pointer"
                >
                  Ajustar
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Rodapé com Legenda da Imagem (quando houver) */}
      {media.caption && (
        <footer className="px-4 py-2.5 bg-[#111B21]/95 border-t border-white/[0.08] text-[13px] text-[#E9EDEF] text-center max-h-[96px] overflow-y-auto wa-scrollbar shrink-0 z-20">
          <FormattedText text={media.caption} />
        </footer>
      )}
    </motion.div>
  );
};
