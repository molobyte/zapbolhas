import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw, Smartphone, AlertTriangle, QrCode } from 'lucide-react';
import { useBubbleStore } from '../store/useBubbleStore';

interface QRCodePopoverProps {
  onInteractiveEnter: () => void;
  onInteractiveLeave: () => void;
}

export const QRCodePopover: React.FC<QRCodePopoverProps> = ({
  onInteractiveEnter,
  onInteractiveLeave,
}) => {
  const {
    waStatus,
    qrDataUrl,
    waError,
    waConnectionDetails,
    isReconnectingSession,
    bubbleScale,
    requestNewQrSession,
    reconnectWhatsApp,
  } = useBubbleStore();

  const [nowTick, setNowTick] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (qrDataUrl) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [qrDataUrl]);

  const elapsedSeconds = Math.max(
    0,
    Math.floor((nowTick - (waConnectionDetails?.stageStartedAt || nowTick)) / 1000)
  );
  const stage = waConnectionDetails?.stage;
  const isErrorOrDisconnected =
    waStatus === 'error' ||
    waStatus === 'disconnected' ||
    stage === 'error' ||
    stage === 'disconnected' ||
    stage === 'session_expired';
  const isGeneratingSlow = !qrDataUrl && !isErrorOrDisconnected && (stage === 'stalled' || elapsedSeconds >= 18);
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
      className="relative w-[316px] min-h-[396px] bg-[#111B21] rounded-[8px] shadow-[0_14px_40px_rgba(0,0,0,0.85)] border border-[#222D34] p-5 flex flex-col items-center justify-between gap-3 text-center pointer-events-auto"
    >
      {/* Cabeçalho */}
      <div className="space-y-1">
        <div className="flex items-center justify-center gap-1.5 text-[#25D366] font-semibold text-[15px]">
          <Smartphone className="w-4 h-4" />
          <span>Conectar WhatsApp</span>
        </div>
        <p className="text-[12px] text-[#8696A0] leading-snug">
          Abra o WhatsApp no seu celular, toque em{' '}
          <strong className="text-[#E9EDEF]">Dispositivos conectados</strong> e aponte a
          câmera para o QR Code.
        </p>
      </div>

      {/* Área do QR Code */}
      <div className="w-[216px] h-[216px] rounded-lg bg-white p-2.5 flex items-center justify-center shadow-inner relative">
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="WhatsApp QR Code"
            className="w-full h-full object-contain"
          />
        ) : isErrorOrDisconnected ? (
          <div className="flex flex-col items-center gap-2.5 px-3 text-[#111B21]">
            <AlertTriangle className="w-7 h-7 text-amber-600" />
            <p className="text-[12px] font-semibold text-[#111B21] leading-tight">
              {waConnectionDetails?.title || 'Sessão desconectada'}
            </p>
            <p className="text-[11px] text-[#54656F] line-clamp-3 leading-snug">
              {waConnectionDetails?.detail ||
                waError ||
                'Não foi possível gerar o QR Code automaticamente.'}
            </p>
            <button
              type="button"
              disabled={isReconnectingSession}
              onClick={() => requestNewQrSession()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#25D366] text-white text-[12px] font-semibold hover:bg-[#1fb855] disabled:opacity-60 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Gerar novo QR Code</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-3 text-[#111B21]">
            <Loader2 className="w-8 h-8 text-[#25D366] animate-spin" />
            <span className="text-[12px] font-semibold text-[#111B21] leading-tight">
              {waStatus === 'authenticated'
                ? 'Autenticado! Lendo mensagens...'
                : waConnectionDetails?.title || 'Gerando QR Code...'}
            </span>
            <span className="text-[11px] text-[#54656F] leading-snug">
              {isGeneratingSlow
                ? `Demorando mais que o normal (${elapsedSeconds}s). Você pode reiniciar a geração abaixo.`
                : waConnectionDetails?.detail || `Aguarde um instante... (${elapsedSeconds}s)`}
            </span>
            {isGeneratingSlow && (
              <button
                type="button"
                disabled={isReconnectingSession}
                onClick={() => requestNewQrSession()}
                className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#25D366] text-white text-[11.5px] font-semibold hover:bg-[#1fb855] disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReconnectingSession ? 'animate-spin' : ''}`} />
                <span>Reiniciar QR Code</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Rodapé informativo + ação de regeneração */}
      <div className="w-full flex flex-col items-center gap-1.5">
        <span className="text-[11px] text-[#8696A0]">
          {qrDataUrl
            ? 'Sua sessão ficará salva automaticamente neste computador.'
            : 'Se o QR Code expirou ou demorou, clique para gerar outro.'}
        </span>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={isReconnectingSession}
            onClick={() => requestNewQrSession()}
            className="inline-flex items-center gap-1 text-[11px] text-[#25D366] hover:underline disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${isReconnectingSession ? 'animate-spin' : ''}`} />
            <span>Gerar novo QR Code</span>
          </button>
          {waConnectionDetails?.hasSavedSession && !qrDataUrl && (
            <button
              type="button"
              disabled={isReconnectingSession}
              onClick={() => reconnectWhatsApp()}
              className="inline-flex items-center gap-1 text-[11px] text-[#8696A0] hover:text-[#E9EDEF] hover:underline disabled:opacity-50 cursor-pointer"
            >
              <span>Tentar sessão salva</span>
            </button>
          )}
        </div>
      </div>

      {/* Seta / Triângulo apontando para o botão verde */}
      <div
        style={{
          right: `${arrowRightPx}px`,
          clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
        }}
        className="w-[16px] h-[8px] bg-[#111B21] absolute top-full -mt-[1px] pointer-events-none z-30"
        aria-hidden="true"
      />
    </motion.div>
  );
};
