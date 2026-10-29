import React from 'react';
import { motion } from 'framer-motion';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Quote,
  List,
  ListOrdered,
} from 'lucide-react';
import { FormatType, isFormatActive } from '../utils/formatText';

interface TextFormatToolbarProps {
  fullText: string;
  selectionStart: number;
  selectionEnd: number;
  onApplyFormat: (type: FormatType) => void;
  centerX: number;
  containerWidth: number;
}

export const TextFormatToolbar: React.FC<TextFormatToolbarProps> = ({
  fullText,
  selectionStart,
  selectionEnd,
  onApplyFormat,
  centerX,
  containerWidth,
}) => {
  // Largura estimada da barra de formatação (7 botões + separador + padding)
  const toolbarWidth = 236;
  const halfToolbar = toolbarWidth / 2;

  // Clampa a posição horizontal da barra para permanecer visível dentro do container
  const minX = halfToolbar + 6;
  const maxX = Math.max(minX, containerWidth - halfToolbar - 6);
  const clampedX = Math.max(minX, Math.min(maxX, centerX));

  // Posição da seta indicadora apontando diretamente para o texto selecionado
  const arrowOffset = centerX - clampedX;
  const arrowLeft = Math.max(16, Math.min(toolbarWidth - 16, halfToolbar + arrowOffset));

  const formatButtons: Array<{
    type: FormatType;
    label: string;
    shortcut?: string;
    icon: React.ReactNode;
  }> = [
    {
      type: 'bold',
      label: 'Negrito',
      shortcut: 'Ctrl+B',
      icon: <Bold className="w-[14px] h-[14px] stroke-[2.2]" />,
    },
    {
      type: 'italic',
      label: 'Itálico',
      shortcut: 'Ctrl+I',
      icon: <Italic className="w-[14px] h-[14px] stroke-[2.2]" />,
    },
    {
      type: 'strikethrough',
      label: 'Tachado',
      shortcut: 'Ctrl+Shift+X',
      icon: <Strikethrough className="w-[14px] h-[14px] stroke-[2.2]" />,
    },
    {
      type: 'monospace',
      label: 'Monoespaçado',
      shortcut: 'Ctrl+Shift+M',
      icon: <Code className="w-[14px] h-[14px] stroke-[2.2]" />,
    },
  ];

  const blockButtons: Array<{
    type: FormatType;
    label: string;
    icon: React.ReactNode;
  }> = [
    {
      type: 'quote',
      label: 'Citação',
      icon: <Quote className="w-[13px] h-[13px] stroke-[2.2]" />,
    },
    {
      type: 'bullet',
      label: 'Lista com marcadores',
      icon: <List className="w-[14px] h-[14px] stroke-[2.2]" />,
    },
    {
      type: 'number',
      label: 'Lista numerada',
      icon: <ListOrdered className="w-[14px] h-[14px] stroke-[2.2]" />,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.95 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      style={{
        left: `${clampedX}px`,
        transform: 'translateX(-50%)',
      }}
      className="absolute bottom-full mb-2.5 z-50 flex items-center gap-0.5 p-1 bg-[#202C33] border border-[#3B4A54]/80 rounded-[8px] shadow-[0_4px_20px_rgba(0,0,0,0.65)] select-none pointer-events-auto"
    >
      {/* Botões de Estilo Inline (Negrito, Itálico, Tachado, Monoespaçado) */}
      {formatButtons.map((btn) => {
        const active = isFormatActive(btn.type, fullText, selectionStart, selectionEnd);
        return (
          <button
            key={btn.type}
            type="button"
            onMouseDown={(e) => {
              // Previne perda de foco do textarea ao clicar
              e.preventDefault();
            }}
            onClick={() => onApplyFormat(btn.type)}
            title={btn.shortcut ? `${btn.label} (${btn.shortcut})` : btn.label}
            className={`w-[27px] h-[27px] rounded-[5px] flex items-center justify-center transition-all cursor-pointer ${
              active
                ? 'bg-[#00A884]/25 text-[#00A884] shadow-inner font-bold'
                : 'text-[#D1D7DB] hover:text-white hover:bg-white/10 active:scale-95'
            }`}
          >
            {btn.icon}
          </button>
        );
      })}

      {/* Divisor Vertical */}
      <div className="w-[1px] h-3.5 bg-white/15 mx-0.5" />

      {/* Botões de Estrutura (Citação, Marcadores, Numerada) */}
      {blockButtons.map((btn) => {
        const active = isFormatActive(btn.type, fullText, selectionStart, selectionEnd);
        return (
          <button
            key={btn.type}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={() => onApplyFormat(btn.type)}
            title={btn.label}
            className={`w-[27px] h-[27px] rounded-[5px] flex items-center justify-center transition-all cursor-pointer ${
              active
                ? 'bg-[#00A884]/25 text-[#00A884] shadow-inner font-bold'
                : 'text-[#D1D7DB] hover:text-white hover:bg-white/10 active:scale-95'
            }`}
          >
            {btn.icon}
          </button>
        );
      })}

      {/* Seta indicadora (speech bubble pointer) apontando para o texto */}
      <div
        className="absolute -bottom-[5px] w-2.5 h-2.5 bg-[#202C33] border-r border-b border-[#3B4A54]/80 rotate-45 pointer-events-none"
        style={{ left: `${arrowLeft}px`, transform: 'translateX(-50%) rotate(45deg)' }}
      />
    </motion.div>
  );
};
