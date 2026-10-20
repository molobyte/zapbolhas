import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw, Smartphone } from 'lucide-react';
import { useBubbleStore } from '../store/useBubbleStore';

interface QRCodePopoverProps {
  onInteractiveEnter: () => void;
  onInteractiveLeave: () => void;
}

export const QRCodePopover: React.FC<QRCodePopoverProps> = ({
  onInteractiveEnter,
  onInteractiveLeave,
}) => {
  const { waStatus, qrDataUrl, waError } = useBubbleStore();

  const handleRetry = () => {
    if (window.electronAPI) {
      window.electronAPI.initWhatsApp();
    }
  };

  return (
    <motion.div
      data-interactive="true"
      onMouseEnter={onInteractiveEnter}
      onMouseLeave={onInteractiveLeave}
      initial={{ opacity: 0, y: 14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className="relative w-[310px] h-[380px] bg-[#111B21] rounded-[8px] shadow-[0_14px_40px_rgba(0,0,0,0.85)] border border-[#222D34] p-5 flex flex-col items-center justify-between text-center pointer-events-auto"
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
        ) : waStatus === 'error' ? (
          <div className="flex flex-col items-center gap-2 px-3 text-[#111B21]">
            <p className="text-[12px] font-medium text-red-600 line-clamp-3">
              {waError || 'Erro ao iniciar o motor do WhatsApp.'}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#25D366] text-white text-[12px] font-medium hover:bg-[#1fb855]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar novamente</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2.5 text-[#111B21]">
            <Loader2 className="w-8 h-8 text-[#25D366] animate-spin" />
            <span className="text-[12px] font-medium text-[#54656F]">
              {waStatus === 'authenticated'
                ? 'Autenticado! Sincronizando...'
                : 'Gerando QR Code...'}
            </span>
          </div>
        )}
      </div>

      {/* Rodapé informativo */}
      <div className="w-full flex flex-col items-center">
        <span className="text-[11px] text-[#8696A0]">
          Sua sessão ficará salva automaticamente neste computador.
        </span>
      </div>

      {/* Seta / Triângulo apontando para o botão verde */}
      <div
        style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
        className="w-[16px] h-[8px] bg-[#111B21] absolute top-full -mt-[1px] right-[16px] pointer-events-none z-30"
        aria-hidden="true"
      />
    </motion.div>
  );
};
