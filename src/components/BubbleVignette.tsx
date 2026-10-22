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

  // Dimensões compactas e calibradas:
  // - WhatsApp logo button fixo: 48px
  // - Cada bubble de contato: 48px + 12px de gap = 60px
  // - Padding do canto direito da tela: 16px (definido em App.tsx)
  // - Feather compacto para transição suave: ~76px * scale
  const bubbleCount = activeBubbles.length;
  const baseDockContentWidth = (48 + bubbleCount * 60) * bubbleScale;
  const calculatedDockReach = 16 + baseDockContentWidth;
  const featherWidth = Math.round(76 * bubbleScale);
  const calculatedWidth = Math.round(calculatedDockReach + featherWidth);

  // Altura da vinheta: cobre a altura do dock (12px padding + 48px bolha = 60px) + ~56px de fade suave para cima
  const dockHeightPx = 12 + 48 * bubbleScale;
  const featherHeight = Math.round(56 * bubbleScale);
  const calculatedHeight = Math.round(dockHeightPx + featherHeight);

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

  // Ponto exato onde termina a área de bolhas e começa a zona de fade-out suave
  const dockLeftReach = Math.max(20, targetWidth - featherWidth);
  const dockReachPercent = Math.min(
    84,
    Math.max(20, Math.round((dockLeftReach / targetWidth) * 100))
  );
  const featherPercent = 100 - dockReachPercent;

  const dockHeightPercent = Math.min(
    56,
    Math.max(25, Math.round((dockHeightPx / targetHeight) * 100))
  );
  const featherYPercent = 100 - dockHeightPercent;

  // Máscara horizontal com atenuação cúbica/Hermite multi-stop:
  // Zera completamente o alpha (0.000) antes da borda esquerda física do elemento,
  // eliminando 100% de qualquer linha de corte perceptível mesmo em fundos claros ou coloridos.
  const horizontalMask = `linear-gradient(
    to left,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 1) ${dockReachPercent}%,
    rgba(0, 0, 0, 0.92) ${dockReachPercent + featherPercent * 0.16}%,
    rgba(0, 0, 0, 0.70) ${dockReachPercent + featherPercent * 0.38}%,
    rgba(0, 0, 0, 0.42) ${dockReachPercent + featherPercent * 0.60}%,
    rgba(0, 0, 0, 0.18) ${dockReachPercent + featherPercent * 0.78}%,
    rgba(0, 0, 0, 0.04) ${dockReachPercent + featherPercent * 0.90}%,
    rgba(0, 0, 0, 0.005) ${dockReachPercent + featherPercent * 0.96}%,
    rgba(0, 0, 0, 0) ${dockReachPercent + featherPercent * 0.99}%,
    rgba(0, 0, 0, 0) 100%
  )`;

  // Máscara vertical com atenuação cúbica/Hermite multi-stop:
  // Zera completamente o alpha (0.000) antes da borda superior física do elemento.
  const verticalMask = `linear-gradient(
    to top,
    rgba(0, 0, 0, 1) 0%,
    rgba(0, 0, 0, 1) ${dockHeightPercent}%,
    rgba(0, 0, 0, 0.92) ${dockHeightPercent + featherYPercent * 0.16}%,
    rgba(0, 0, 0, 0.68) ${dockHeightPercent + featherYPercent * 0.38}%,
    rgba(0, 0, 0, 0.38) ${dockHeightPercent + featherYPercent * 0.60}%,
    rgba(0, 0, 0, 0.15) ${dockHeightPercent + featherYPercent * 0.78}%,
    rgba(0, 0, 0, 0.03) ${dockHeightPercent + featherYPercent * 0.90}%,
    rgba(0, 0, 0, 0.004) ${dockHeightPercent + featherYPercent * 0.96}%,
    rgba(0, 0, 0, 0) ${dockHeightPercent + featherYPercent * 0.99}%,
    rgba(0, 0, 0, 0) 100%
  )`;

  // Backgrounds com tons ricos e consistentes de acordo com a escolha do usuário
  let gradientBackground = '';

  if (bubbleVignetteStyle === 'radial') {
    // Spotlight circular a partir do canto
    gradientBackground = `
      radial-gradient(
        circle at 100% 100%,
        rgba(5, 7, 10, ${0.98 * alpha}) 0%,
        rgba(8, 11, 15, ${0.92 * alpha}) 40%,
        rgba(12, 16, 22, ${0.84 * alpha}) 75%,
        rgba(15, 20, 28, ${0.72 * alpha}) 100%
      )
    `;
  } else if (bubbleVignetteStyle === 'emerald') {
    // WhatsApp Noturno com nuance esmeralda
    gradientBackground = `
      radial-gradient(
        ellipse at 100% 100%,
        rgba(3, 26, 20, ${0.98 * alpha}) 0%,
        rgba(6, 36, 28, ${0.90 * alpha}) 45%,
        rgba(9, 25, 22, ${0.82 * alpha}) 75%,
        rgba(11, 20, 19, ${0.75 * alpha}) 100%
      )
    `;
  } else {
    // Clássico (Padrão): Escuro / Carvão de alto contraste
    gradientBackground = `
      radial-gradient(
        ellipse at 100% 100%,
        rgba(6, 9, 12, ${0.98 * alpha}) 0%,
        rgba(8, 12, 16, ${0.92 * alpha}) 45%,
        rgba(12, 17, 23, ${0.85 * alpha}) 75%,
        rgba(15, 20, 26, ${0.78 * alpha}) 100%
      )
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
            maskImage: horizontalMask,
            WebkitMaskImage: horizontalMask,
          }}
          className="fixed bottom-0 right-0 pointer-events-none select-none z-0 overflow-hidden"
          aria-hidden="true"
        >
          {/* Camada interna com a máscara vertical e a cor de contraste rica */}
          <div
            className="w-full h-full pointer-events-none"
            style={{
              background: gradientBackground,
              maskImage: verticalMask,
              WebkitMaskImage: verticalMask,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
