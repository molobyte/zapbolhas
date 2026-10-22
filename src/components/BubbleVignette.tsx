import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBubbleStore } from '../store/useBubbleStore';

export const BubbleVignette: React.FC = () => {
  const {
    bubbleVignetteEnabled,
    bubbleVignetteOpacity,
    bubbleVignetteStyle,
    bubbleScale,
    activeBubbles,
  } = useBubbleStore();

  // Cálculo da largura geométrica ideal:
  // - WhatsApp logo button fixo: 48px
  // - Cada bubble de contato: 48px + 12px de gap = 60px
  // - Padding do canto direito da tela: 16px (definido em App.tsx)
  // - Feather / margem suave de fade-out gradativo para a esquerda: ~85px * scale
  const bubbleCount = activeBubbles.length;
  const baseDockContentWidth = (48 + bubbleCount * 60) * bubbleScale;
  const calculatedDockReach = 16 + baseDockContentWidth;
  const featherWidth = Math.round(85 * bubbleScale);
  const calculatedWidth = Math.round(calculatedDockReach + featherWidth);

  // Altura da vinheta: cobre a altura do dock (12px padding + 48px bolha) + ~65px de fade suave para cima
  const calculatedHeight = Math.round((12 + 48 * bubbleScale) + 65 * bubbleScale);

  const [measuredWidth, setMeasuredWidth] = useState<number>(calculatedWidth);

  // Monitora a posição física e largura em tempo real do dock para sincronia perfeita com animações
  useEffect(() => {
    const update = () => {
      const el = document.getElementById('bubble-dock-row');
      if (el) {
        const rect = el.getBoundingClientRect();
        const reach = window.innerWidth - rect.left;
        if (reach > 0) {
          setMeasuredWidth(Math.round(reach + featherWidth));
        }
      }
    };

    update();

    let observer: ResizeObserver | null = null;
    const el = document.getElementById('bubble-dock-row');
    if (el && typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => update());
      observer.observe(el);
    }

    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [activeBubbles.length, bubbleScale, featherWidth]);

  // Se medido for válido, usa a medição real ou o cálculo matemático (o que for maior)
  const targetWidth = Math.max(calculatedWidth, measuredWidth);
  const targetHeight = calculatedHeight;

  // Fator de intensidade (opacidade 10% a 100%)
  const alpha = Math.min(1, Math.max(0.1, bubbleVignetteOpacity / 100));

  // Ponto exato onde termina o dock e começa a zona de fade-out suave para a esquerda
  const dockLeftReach = Math.max(20, targetWidth - featherWidth);
  const solidStopPercent = Math.round(
    Math.min(88, Math.max(25, (dockLeftReach / targetWidth) * 100))
  );

  // Construção do background gradiente baseado no estilo escolhido pelo usuário
  let gradientBackground = '';

  if (bubbleVignetteStyle === 'radial') {
    // Vinheta Spotlight Circular intensa a partir do vértice inferior direito
    gradientBackground = `
      radial-gradient(
        circle at 100% 100%,
        rgba(5, 7, 10, ${0.98 * alpha}) 0%,
        rgba(8, 11, 15, ${0.85 * alpha}) 35%,
        rgba(12, 16, 22, ${0.55 * alpha}) 65%,
        rgba(15, 20, 28, ${0.20 * alpha}) 85%,
        transparent 100%
      )
    `;
  } else if (bubbleVignetteStyle === 'emerald') {
    // Degradê WhatsApp Noturno com nuances esmeralda profundas e borda suave
    gradientBackground = `
      radial-gradient(
        ellipse ${targetWidth}px ${targetHeight}px at 100% 100%,
        rgba(3, 24, 18, ${0.96 * alpha}) 0%,
        rgba(6, 32, 24, ${0.86 * alpha}) ${Math.round(solidStopPercent * 0.45)}%,
        rgba(9, 24, 20, ${0.68 * alpha}) ${Math.round(solidStopPercent * 0.85)}%,
        rgba(11, 20, 18, ${0.35 * alpha}) ${Math.round(solidStopPercent + (100 - solidStopPercent) * 0.45)}%,
        rgba(11, 20, 18, ${0.10 * alpha}) ${Math.round(solidStopPercent + (100 - solidStopPercent) * 0.8)}%,
        transparent 100%
      ),
      linear-gradient(to top, rgba(0, 0, 0, ${0.5 * alpha}) 0%, transparent 80%)
    `;
  } else {
    // Clássico (Padrão): Vinheta escura profunda que dá contraste perfeito contra qualquer papel de parede
    gradientBackground = `
      radial-gradient(
        ellipse ${targetWidth}px ${targetHeight}px at 100% 100%,
        rgba(6, 9, 12, ${0.95 * alpha}) 0%,
        rgba(8, 12, 16, ${0.88 * alpha}) ${Math.round(solidStopPercent * 0.5)}%,
        rgba(10, 15, 20, ${0.75 * alpha}) ${Math.round(solidStopPercent * 0.85)}%,
        rgba(12, 18, 24, ${0.40 * alpha}) ${Math.round(solidStopPercent + (100 - solidStopPercent) * 0.4)}%,
        rgba(14, 20, 26, ${0.12 * alpha}) ${Math.round(solidStopPercent + (100 - solidStopPercent) * 0.8)}%,
        transparent 100%
      ),
      linear-gradient(to top, rgba(0, 0, 0, ${0.45 * alpha}) 0%, transparent 75%)
    `;
  }

  return (
    <AnimatePresence>
      {bubbleVignetteEnabled && (
        <motion.div
          key="bubble-vignette"
          initial={{ opacity: 0, width: targetWidth }}
          animate={{
            opacity: 1,
            width: targetWidth,
            height: targetHeight,
          }}
          exit={{ opacity: 0 }}
          transition={{
            width: { type: 'spring', stiffness: 300, damping: 28 },
            height: { type: 'spring', stiffness: 300, damping: 28 },
            opacity: { duration: 0.22, ease: 'easeInOut' },
          }}
          style={{
            background: gradientBackground,
          }}
          className="fixed bottom-0 right-0 pointer-events-none select-none z-0 overflow-hidden"
          aria-hidden="true"
        />
      )}
    </AnimatePresence>
  );
};
