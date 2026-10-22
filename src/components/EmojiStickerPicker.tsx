import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Smile,
  Sticker,
  Search,
  Plus,
  Star,
  Trash2,
  RefreshCw,
  Clock,
  Heart,
  Hand,
  Cat,
  Pizza,
  Gamepad2,
  Lightbulb,
  X,
  Loader2,
  Paperclip,
  Send,
} from 'lucide-react';
import { StickerItem } from '../types/whatsapp';
import { useBubbleStore } from '../store/useBubbleStore';

export type PickerTab = 'emoji' | 'sticker' | 'attachment';

interface EmojiStickerPickerProps {
  initialTab?: PickerTab;
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (stickerDataUrl: string) => void;
  onSelectMedia?: (media: {
    mediaDataUrl: string;
    mediaType?: 'image' | 'video';
    filename?: string;
    caption?: string;
  }) => void;
  onClose: () => void;
}

export interface EmojiEntry {
  char: string;
  keywords: string;
}

export type EmojiCategoryId =
  | 'recent'
  | 'smileys'
  | 'gestures'
  | 'hearts'
  | 'animals'
  | 'food'
  | 'activities'
  | 'objects';

export const EMOJI_CATEGORIES: Array<{
  id: EmojiCategoryId;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'recent', label: 'Recentes', icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'smileys', label: 'Carinhas', icon: <Smile className="w-3.5 h-3.5" /> },
  { id: 'gestures', label: 'Gestos', icon: <Hand className="w-3.5 h-3.5" /> },
  { id: 'hearts', label: 'Corações', icon: <Heart className="w-3.5 h-3.5" /> },
  { id: 'animals', label: 'Natureza', icon: <Cat className="w-3.5 h-3.5" /> },
  { id: 'food', label: 'Comida', icon: <Pizza className="w-3.5 h-3.5" /> },
  { id: 'activities', label: 'Jogos', icon: <Gamepad2 className="w-3.5 h-3.5" /> },
  { id: 'objects', label: 'Objetos', icon: <Lightbulb className="w-3.5 h-3.5" /> },
];

export const EMOJI_DATA: Record<Exclude<EmojiCategoryId, 'recent'>, EmojiEntry[]> = {
  smileys: [
    { char: '😂', keywords: 'rindo lagrimas kkk engraçado feliz' },
    { char: '🤣', keywords: 'rolando rindo muito gargalhada kkk' },
    { char: '😀', keywords: 'sorriso feliz alegre rosto' },
    { char: '😄', keywords: 'sorrindo feliz olhos' },
    { char: '😁', keywords: 'sorriso dentes alegre' },
    { char: '😆', keywords: 'rindo olhos fechados' },
    { char: '😅', keywords: 'suor frio rindo nervoso alivio' },
    { char: '😊', keywords: 'timido feliz corado sorriso' },
    { char: '😇', keywords: 'anjo inocente santo' },
    { char: '🙂', keywords: 'sorriso leve ok' },
    { char: '🙃', keywords: 'cabeça para baixo ironia' },
    { char: '😉', keywords: 'piscada piscando' },
    { char: '😌', keywords: 'aliviado paz calmo' },
    { char: '😍', keywords: 'apaixonado amor olhos coração' },
    { char: '🥰', keywords: 'amor corações carinhoso apaixonado' },
    { char: '😘', keywords: 'beijo coração amor' },
    { char: '😗', keywords: 'beijo assobio' },
    { char: '😋', keywords: 'delicia gostoso lingua comida' },
    { char: '😛', keywords: 'lingua brincadeira' },
    { char: '😜', keywords: 'piscando lingua maluco' },
    { char: '🤪', keywords: 'doido maluco zoeira' },
    { char: '🤨', keywords: 'desconfiado sobrancelha duvida' },
    { char: '🧐', keywords: 'monoculo analisando curioso' },
    { char: '🤓', keywords: 'nerd oculos inteligente' },
    { char: '😎', keywords: 'oculos escuro maneiro top estilo' },
    { char: '🤩', keywords: 'estrelas incrivel fã uau' },
    { char: '🥳', keywords: 'festa aniversario comemorando parabens' },
    { char: '😏', keywords: 'sorriso de canto malicioso' },
    { char: '😒', keywords: 'tedio chateado serio' },
    { char: '😞', keywords: 'triste decepcionado' },
    { char: '😔', keywords: 'pensativo triste cabisbaixo' },
    { char: '😟', keywords: 'preocupado' },
    { char: '😕', keywords: 'confuso indeciso' },
    { char: '🙁', keywords: 'triste chateado' },
    { char: '😣', keywords: 'sofrendo dificil' },
    { char: '😖', keywords: 'frustrado' },
    { char: '😫', keywords: 'cansado exausto' },
    { char: '😩', keywords: 'cansado desanimado' },
    { char: '🥺', keywords: 'pidão fofo por favor olhos marejados' },
    { char: '😢', keywords: 'chorando lagrima triste' },
    { char: '😭', keywords: 'chorando muito berreiro triste' },
    { char: '😤', keywords: 'bufando bravo determinado' },
    { char: '😠', keywords: 'bravo irritado raiva' },
    { char: '😡', keywords: 'muito bravo vermelho furioso raiva' },
    { char: '🤬', keywords: 'xingando palavrão furioso' },
    { char: '🤯', keywords: 'mente explodindo chocado surpreso' },
    { char: '😳', keywords: 'vergonha chocado olhos arregalados' },
    { char: '🥵', keywords: 'calor quente suando' },
    { char: '🥶', keywords: 'frio congelando gelado' },
    { char: '😱', keywords: 'gritando susto medo chocado' },
    { char: '😨', keywords: 'medo assustado' },
    { char: '😰', keywords: 'ansioso suor nervoso' },
    { char: '😥', keywords: 'alivio triste suor' },
    { char: '😓', keywords: 'suor desanimo' },
    { char: '🤗', keywords: 'abraço carinhoso' },
    { char: '🤔', keywords: 'pensando duvida hmm' },
    { char: '🤭', keywords: 'risadinha segredo ops' },
    { char: '🤫', keywords: 'silencio shh segredo' },
    { char: '🤥', keywords: 'mentira pinoquio' },
    { char: '😶', keywords: 'sem boca calado' },
    { char: '😐', keywords: 'neutro serio' },
    { char: '😑', keywords: 'sem expressão serio' },
    { char: '😬', keywords: 'sem graça eita tenso' },
    { char: '🙄', keywords: 'revirando olhos paciencia' },
    { char: '😯', keywords: 'surpreso uau' },
    { char: '😦', keywords: 'boquiaberto' },
    { char: '😮', keywords: 'oh surpreso' },
    { char: '😲', keywords: 'espantado chocado' },
    { char: '🥱', keywords: 'bocejando sono preguiça' },
    { char: '😴', keywords: 'dormindo sono zzz' },
    { char: '🤤', keywords: 'babando vontade sono' },
    { char: '😪', keywords: 'sonolento' },
    { char: '😵', keywords: 'tonto confuso' },
    { char: '🤐', keywords: 'boca fechada ziper segredo' },
    { char: '🥴', keywords: 'tonto zonzo bebado' },
    { char: '🤢', keywords: 'enjoado nojo verde' },
    { char: '🤮', keywords: 'vomitando nojo' },
    { char: '🤧', keywords: 'espirrando gripe doente' },
    { char: '😷', keywords: 'mascara doente médico' },
    { char: '🤒', keywords: 'febre termometro doente' },
    { char: '🤕', keywords: 'machucado curativo' },
    { char: '🤑', keywords: 'dinheiro rico cifrão' },
    { char: '🤠', keywords: 'cowboy chapeu sertanejo' },
    { char: '😈', keywords: 'diabinho malvado roxo' },
    { char: '👻', keywords: 'fantasma susto boo' },
    { char: '💀', keywords: 'caveira morto rindo' },
    { char: '🤡', keywords: 'palhaço feito de trouxa' },
    { char: '💩', keywords: 'coco merda engraçado' },
    { char: '🤖', keywords: 'robo bot tecnologia' },
    { char: '👽', keywords: 'alien et extraterrestre' },
  ],
  gestures: [
    { char: '👍', keywords: 'joinha ok positivo sim legal bom' },
    { char: '👎', keywords: 'negativo ruim não' },
    { char: '👏', keywords: 'palmas aplausos parabens bravo' },
    { char: '🙌', keywords: 'mãos para cima aleluia comemoração' },
    { char: '🤝', keywords: 'aperto de mão acordo parceria fechado' },
    { char: '🙏', keywords: 'orando por favor obrigado amén gratidão' },
    { char: '✌️', keywords: 'paz e amor vitoria dois' },
    { char: '🤞', keywords: 'dedos cruzados sorte torcendo' },
    { char: '🫶', keywords: 'coração com as mãos amor' },
    { char: '🤟', keywords: 'eu te amo rock' },
    { char: '🤘', keywords: 'rock metal' },
    { char: '👌', keywords: 'ok perfeito top' },
    { char: '🤌', keywords: 'italiano que isso' },
    { char: '🤏', keywords: 'pouquinho pequeno quase' },
    { char: '👈', keywords: 'apontando esquerda' },
    { char: '👉', keywords: 'apontando direita' },
    { char: '👆', keywords: 'apontando cima' },
    { char: '👇', keywords: 'apontando baixo' },
    { char: '☝️', keywords: 'um atenção' },
    { char: '✋', keywords: 'mão pare oi cinco' },
    { char: '👋', keywords: 'tchau oi acenando olá' },
    { char: '🤚', keywords: 'mão levantada' },
    { char: '🖐️', keywords: 'mão aberta cinco' },
    { char: '🖖', keywords: 'vida longa e prospera spock' },
    { char: '💪', keywords: 'força musculo academia treino forte' },
    { char: '👊', keywords: 'soco toque aqui' },
    { char: '✊', keywords: 'punho fechado força' },
    { char: '🤛', keywords: 'punho esquerda' },
    { char: '🤜', keywords: 'punho direita' },
    { char: '✍️', keywords: 'escrevendo anotando' },
    { char: '🤳', keywords: 'selfie celular foto' },
    { char: '💅', keywords: 'unhas esmalte debochado' },
    { char: '👀', keywords: 'olhos olhando observando curioso' },
    { char: '🧠', keywords: 'cerebro inteligente mente' },
    { char: '🤦', keywords: 'mão na testa decepção meu deus' },
    { char: '🤷', keywords: 'não sei tanto faz ombros' },
    { char: '🙋', keywords: 'eu mão levantada' },
    { char: '🙇', keywords: 'desculpa reverencia' },
    { char: '🕺', keywords: 'dançando festa' },
    { char: '💃', keywords: 'dançando festa' },
  ],
  hearts: [
    { char: '❤️', keywords: 'coração vermelho amor paixão' },
    { char: '🧡', keywords: 'coração laranja' },
    { char: '💛', keywords: 'coração amarelo amizade' },
    { char: '💚', keywords: 'coração verde xbox esperança' },
    { char: '💙', keywords: 'coração azul' },
    { char: '💜', keywords: 'coração roxo' },
    { char: '🖤', keywords: 'coração preto' },
    { char: '🤍', keywords: 'coração branco paz' },
    { char: '🤎', keywords: 'coração marrom' },
    { char: '💔', keywords: 'coração partido triste' },
    { char: '❤️‍🔥', keywords: 'coração em chamas paixão fogo' },
    { char: '💕', keywords: 'dois corações amor' },
    { char: '💞', keywords: 'corações girando' },
    { char: '💓', keywords: 'coração batendo' },
    { char: '💗', keywords: 'coração crescendo' },
    { char: '💖', keywords: 'coração brilhante' },
    { char: '💘', keywords: 'coração flecha cupido' },
    { char: '💝', keywords: 'coração presente laço' },
    { char: '🔥', keywords: 'fogo quente top brabo' },
    { char: '✨', keywords: 'brilho estrelas magica novo' },
    { char: '🌟', keywords: 'estrela brilhante destaque' },
    { char: '⭐', keywords: 'estrela favorito' },
    { char: '⚡', keywords: 'raio rapido energia' },
    { char: '💥', keywords: 'explosão impacto boom' },
    { char: '💯', keywords: 'cem 100 perfeito total' },
    { char: '💢', keywords: 'raiva nervoso' },
    { char: '💨', keywords: 'vento correndo rapido' },
    { char: '💫', keywords: 'estrela tonto' },
    { char: '💬', keywords: 'balão conversa mensagem chat' },
    { char: '✅', keywords: 'check correto feito confirmado verde' },
    { char: '☑️', keywords: 'check marcado' },
    { char: '❌', keywords: 'errado cancelar x vermelho' },
    { char: '⚠️', keywords: 'aviso atenção alerta' },
    { char: '🚫', keywords: 'proibido bloqueado' },
    { char: '❓', keywords: 'interrogação duvida pergunta' },
    { char: '❗', keywords: 'exclamação importante' },
    { char: '🎉', keywords: 'festa confete parabens comemoração' },
    { char: '🎊', keywords: 'confete festa' },
    { char: '🎈', keywords: 'balão festa aniversario' },
    { char: '🎁', keywords: 'presente aniversario natal' },
  ],
  animals: [
    { char: '🐶', keywords: 'cachorro cão pet fofo' },
    { char: '🐱', keywords: 'gato gatinho pet' },
    { char: '🐭', keywords: 'rato camundongo' },
    { char: '🐹', keywords: 'hamster' },
    { char: '🐰', keywords: 'coelho pascoa' },
    { char: '🦊', keywords: 'raposa' },
    { char: '🐻', keywords: 'urso' },
    { char: '🐼', keywords: 'panda' },
    { char: '🐨', keywords: 'coala' },
    { char: '🐯', keywords: 'tigre' },
    { char: '🦁', keywords: 'leão rei' },
    { char: '🐮', keywords: 'vaca boi' },
    { char: '🐷', keywords: 'porco' },
    { char: '🐸', keywords: 'sapo' },
    { char: '🐵', keywords: 'macaco' },
    { char: '🙈', keywords: 'macaco não vejo vergonha' },
    { char: '🙉', keywords: 'macaco não ouço' },
    { char: '🙊', keywords: 'macaco não falo segredo' },
    { char: '🐔', keywords: 'galinha frango' },
    { char: '🐧', keywords: 'pinguim frio' },
    { char: '🐦', keywords: 'passaro' },
    { char: '🦅', keywords: 'aguia' },
    { char: '🦆', keywords: 'pato' },
    { char: '🦉', keywords: 'coruja sabedoria noite' },
    { char: '🐺', keywords: 'lobo' },
    { char: '🐴', keywords: 'cavalo' },
    { char: '🦄', keywords: 'unicornio magico' },
    { char: '🐝', keywords: 'abelha mel' },
    { char: '🦋', keywords: 'borboleta' },
    { char: '🐢', keywords: 'tartaruga devagar' },
    { char: '🐍', keywords: 'cobra serpente' },
    { char: '🦖', keywords: 'dinossauro t-rex' },
    { char: '🐙', keywords: 'polvo' },
    { char: '🦈', keywords: 'tubarão' },
    { char: '🐬', keywords: 'golfinho' },
    { char: '🌹', keywords: 'rosa flor amor' },
    { char: '🌻', keywords: 'girassol flor sol' },
    { char: '🌴', keywords: 'palmeira praia ferias' },
    { char: '☀️', keywords: 'sol dia calor' },
    { char: '🌙', keywords: 'lua noite' },
    { char: '🌈', keywords: 'arco-iris colorido' },
    { char: '🌧️', keywords: 'chuva chovendo' },
  ],
  food: [
    { char: '🍕', keywords: 'pizza comida' },
    { char: '🍔', keywords: 'hamburguer lanche fast food' },
    { char: '🍟', keywords: 'batata frita lanche' },
    { char: '🌭', keywords: 'cachorro quente hot dog' },
    { char: '🍿', keywords: 'pipoca cinema filme' },
    { char: '🥓', keywords: 'bacon' },
    { char: '🥚', keywords: 'ovo' },
    { char: '🍳', keywords: 'ovo frito frigideira' },
    { char: '🥞', keywords: 'panqueca cafe da manhã' },
    { char: '🧀', keywords: 'queijo' },
    { char: '🍖', keywords: 'carne churrasco' },
    { char: '🍗', keywords: 'frango coxa' },
    { char: '🥩', keywords: 'bife carne churrasco picanha' },
    { char: '🌮', keywords: 'taco mexicano' },
    { char: '🌯', keywords: 'burrito' },
    { char: '🥗', keywords: 'salada saudavel' },
    { char: '🍝', keywords: 'macarrão espaguete massa' },
    { char: '🍜', keywords: 'lamen miojo sopa' },
    { char: '🍣', keywords: 'sushi japones' },
    { char: '🍦', keywords: 'sorvete casquinha' },
    { char: '🍩', keywords: 'donut rosquinha doce' },
    { char: '🍪', keywords: 'biscoito cookie' },
    { char: '🎂', keywords: 'bolo aniversario festa' },
    { char: '🍰', keywords: 'fatia bolo doce' },
    { char: '🍫', keywords: 'chocolate doce' },
    { char: '🍬', keywords: 'bala doce' },
    { char: '🍭', keywords: 'pirulito' },
    { char: '☕', keywords: 'cafe quente xicara' },
    { char: '🍵', keywords: 'cha verde' },
    { char: '🥤', keywords: 'refrigerante suco copo canudo' },
    { char: '🍺', keywords: 'cerveja chopp bar bebida' },
    { char: '🍻', keywords: 'brinde cerveja comemorar' },
    { char: '🥂', keywords: 'taças champanhe brinde' },
    { char: '🍷', keywords: 'vinho taça' },
    { char: '🥃', keywords: 'whisky bebida' },
    { char: '🍎', keywords: 'maçã fruta' },
    { char: '🍌', keywords: 'banana fruta' },
    { char: '🍉', keywords: 'melancia fruta' },
    { char: '🍓', keywords: 'morango fruta' },
    { char: '🥑', keywords: 'abacate fruta' },
  ],
  activities: [
    { char: '🎮', keywords: 'videogame controle jogo xbox playstation gamer' },
    { char: '🕹️', keywords: 'joystick arcade jogo' },
    { char: '👾', keywords: 'jogo retro alien' },
    { char: '🏆', keywords: 'trofeu campeão conquista vitoria 1000g' },
    { char: '🥇', keywords: 'medalha ouro primeiro lugar' },
    { char: '🥈', keywords: 'medalha prata segundo' },
    { char: '🥉', keywords: 'medalha bronze terceiro' },
    { char: '🎖️', keywords: 'medalha honra rewards' },
    { char: '🏅', keywords: 'medalha esporte' },
    { char: '⚽', keywords: 'futebol bola gol' },
    { char: '🏀', keywords: 'basquete bola' },
    { char: '🏈', keywords: 'futebol americano' },
    { char: '🎾', keywords: 'tenis bola' },
    { char: '🏐', keywords: 'volei bola' },
    { char: '🎱', keywords: 'sinuca bilhar bola 8' },
    { char: '🎯', keywords: 'alvo dardo certeiro' },
    { char: '🎲', keywords: 'dado sorte jogo' },
    { char: '♟️', keywords: 'xadrez estrategia' },
    { char: '🎧', keywords: 'fone de ouvido headset musica call party' },
    { char: '🎤', keywords: 'microfone cantar voz' },
    { char: '🎬', keywords: 'cinema filme claquete' },
    { char: '🎸', keywords: 'guitarra violão rock musica' },
    { char: '🎹', keywords: 'teclado piano musica' },
    { char: '🥁', keywords: 'bateria tambor musica' },
    { char: '🏎️', keywords: 'carro corrida formula forza' },
    { char: '🚀', keywords: 'foguete espaço rapido subindo' },
    { char: '✈️', keywords: 'avião viagem ferias' },
    { char: '🏖️', keywords: 'praia ferias sol' },
  ],
  objects: [
    { char: '💻', keywords: 'notebook computador pc dev trabalho' },
    { char: '🖥️', keywords: 'monitor pc computador tela' },
    { char: '📱', keywords: 'celular smartphone whatsapp' },
    { char: '⌨️', keywords: 'teclado digitar' },
    { char: '🖱️', keywords: 'mouse computador' },
    { char: '📷', keywords: 'camera foto fotografia' },
    { char: '📹', keywords: 'camera video filmadora' },
    { char: '📺', keywords: 'tv televisão serie' },
    { char: '🔋', keywords: 'bateria energia carregada' },
    { char: '🔌', keywords: 'tomada cabo energia' },
    { char: '💡', keywords: 'lampada ideia luz dica' },
    { char: '💰', keywords: 'saco dinheiro rico' },
    { char: '💵', keywords: 'nota dinheiro dolar' },
    { char: '💳', keywords: 'cartão de credito compra' },
    { char: '💎', keywords: 'diamante joia raro' },
    { char: '🔑', keywords: 'chave segredo acesso' },
    { char: '🔒', keywords: 'cadeado fechado seguro' },
    { char: '🔓', keywords: 'cadeado aberto desbloqueado' },
    { char: '🔔', keywords: 'sino notificação alerta' },
    { char: '🔕', keywords: 'sino silenciado mudo' },
    { char: '📢', keywords: 'megafone aviso anuncio' },
    { char: '⏰', keywords: 'despertador relogio hora' },
    { char: '⏳', keywords: 'ampulheta tempo esperando' },
    { char: '📅', keywords: 'calendario data agenda' },
    { char: '📌', keywords: 'alfinete fixado importante' },
    { char: '📎', keywords: 'clipe anexo arquivo' },
    { char: '📝', keywords: 'bloco notas anotando texto' },
    { char: '📁', keywords: 'pasta arquivo' },
    { char: '🗑️', keywords: 'lixeira apagar lixo' },
    { char: '🛠️', keywords: 'ferramentas configuração conserto' },
    { char: '⚙️', keywords: 'engrenagem configuração ajustes' },
    { char: '🇧🇷', keywords: 'brasil bandeira br' },
  ],
};

const RECENT_EMOJIS_KEY = 'whatsapp-bubbles-recent-emojis-v1';

function loadRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_EMOJIS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 24);
      }
    }
  } catch {
    // Ignore localStorage error
  }
  return ['😂', '❤️', '👍', '🔥', '🎮', '🙏', '😍', '🤣', '💚', '👏', '🥳', '🏆'];
}

function saveRecentEmoji(emoji: string): string[] {
  const current = loadRecentEmojis();
  const next = [emoji, ...current.filter((e) => e !== emoji)].slice(0, 24);
  try {
    localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(next));
  } catch {
    // Ignore localStorage error
  }
  return next;
}

/**
 * Converte qualquer imagem (PNG, JPG, GIF, WebP) para um WebP 512x512 compatível com figurinhas do WhatsApp.
 */
export async function normalizeImageToStickerWebp(dataUrl: string): Promise<string> {
  if (dataUrl.startsWith('data:image/webp')) {
    return dataUrl;
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.clearRect(0, 0, 512, 512);
        const scale = Math.min(512 / img.width, 512 / img.height);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const x = Math.round((512 - w) / 2);
        const y = Math.round((512 - h) / 2);
        ctx.drawImage(img, x, y, w, h);
        const webpUrl = canvas.toDataURL('image/webp', 0.9);
        resolve(webpUrl.startsWith('data:image/webp') ? webpUrl : dataUrl);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function ensureDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string) || url);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch {
    return url;
  }
}

export const EmojiStickerPicker: React.FC<EmojiStickerPickerProps> = ({
  initialTab = 'emoji',
  onSelectEmoji,
  onSelectSticker,
  onSelectMedia,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<PickerTab>(initialTab);
  const [emojiCategory, setEmojiCategory] = useState<EmojiCategoryId>('smileys');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => loadRecentEmojis());

  const [stickerFilter, setStickerFilter] = useState<'all' | 'library' | 'whatsapp'>('all');
  const [libraryStickers, setLibraryStickers] = useState<StickerItem[]>([]);
  const [whatsappStickers, setWhatsappStickers] = useState<StickerItem[]>([]);
  const [isLoadingStickers, setIsLoadingStickers] = useState(false);
  const [isProcessingMedia, setIsProcessingMedia] = useState(false);

  const chats = useBubbleStore((s) => s.chats);
  const messagesByChat = useBubbleStore((s) => s.messagesByChat);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Extrai figurinhas já carregadas nas conversas locais como complemento imediato
  const localChatStickers = useMemo<StickerItem[]>(() => {
    const seen = new Set<string>();
    const items: StickerItem[] = [];
    for (const msgs of Object.values(messagesByChat)) {
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.type === 'sticker' && m.imageUrl && !seen.has(m.imageUrl)) {
          seen.add(m.imageUrl);
          items.push({
            id: `chat-stk-${m.id}`,
            dataUrl: m.imageUrl,
            source: 'whatsapp',
          });
        }
      }
    }
    return items;
  }, [messagesByChat]);

  // Extrai no máximo as últimas 20 fotos recebidas em conversas e grupos
  const recentPhotos = useMemo<Array<{ id: string; url: string; caption?: string }>>(() => {
    const seen = new Set<string>();
    const items: Array<{ id: string; url: string; caption?: string }> = [];

    // Prioriza varrer a partir das conversas ordenadas por atividade recente
    for (const chat of chats) {
      const msgs = messagesByChat[chat.id] || [];
      for (let i = msgs.length - 1; i >= 0; i--) {
        const m = msgs[i];
        if (m.type === 'image' && m.imageUrl && !seen.has(m.imageUrl)) {
          seen.add(m.imageUrl);
          items.push({
            id: m.id,
            url: m.imageUrl,
            caption: m.text,
          });
          if (items.length >= 20) return items;
        }
      }
    }

    // Varre conversas restantes em messagesByChat que possam não estar na lista principal
    if (items.length < 20) {
      for (const [chatId, msgs] of Object.entries(messagesByChat)) {
        if (chats.some((c) => c.id === chatId)) continue;
        for (let i = msgs.length - 1; i >= 0; i--) {
          const m = msgs[i];
          if (m.type === 'image' && m.imageUrl && !seen.has(m.imageUrl)) {
            seen.add(m.imageUrl);
            items.push({
              id: m.id,
              url: m.imageUrl,
              caption: m.text,
            });
            if (items.length >= 20) return items;
          }
        }
      }
    }

    return items;
  }, [chats, messagesByChat]);

  const handlePhotoClick = async (photo: { id: string; url: string; caption?: string }) => {
    if (isProcessingMedia) return;
    setIsProcessingMedia(true);
    try {
      let finalDataUrl = photo.url;
      // Se for mensagem do WhatsApp, tenta baixar a mídia original em alta resolução
      if (photo.id && window.electronAPI?.downloadMedia) {
        try {
          const hd = await window.electronAPI.downloadMedia(photo.id);
          if (hd) {
            finalDataUrl = hd;
          }
        } catch {
          // Mantém url atual como fallback
        }
      }
      finalDataUrl = await ensureDataUrl(finalDataUrl);
      onSelectMedia?.({
        mediaDataUrl: finalDataUrl,
        mediaType: 'image',
        filename: 'foto.jpg',
      });
    } finally {
      setIsProcessingMedia(false);
    }
  };

  const handlePickComputerFile = async () => {
    if (isProcessingMedia) return;
    if (window.electronAPI?.selectMediaFile) {
      setIsProcessingMedia(true);
      try {
        const res = await window.electronAPI.selectMediaFile();
        if (res && res.dataUrl) {
          onSelectMedia?.({
            mediaDataUrl: res.dataUrl,
            mediaType: res.mediaType,
            filename: res.filename,
          });
        }
      } finally {
        setIsProcessingMedia(false);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingMedia(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const isVideo = file.type.startsWith('video/');
      onSelectMedia?.({
        mediaDataUrl: dataUrl,
        mediaType: isVideo ? 'video' : 'image',
        filename: file.name,
      });
      setIsProcessingMedia(false);
    };
    reader.onerror = () => setIsProcessingMedia(false);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const loadAllStickers = useCallback(async () => {
    setIsLoadingStickers(true);
    try {
      const [userRes, waRes] = await Promise.all([
        window.electronAPI?.getUserStickers
          ? window.electronAPI.getUserStickers()
          : Promise.resolve([]),
        window.electronAPI?.getWhatsAppStickers
          ? window.electronAPI.getWhatsAppStickers()
          : Promise.resolve([]),
      ]);
      if (userRes) setLibraryStickers(userRes);
      if (waRes) setWhatsappStickers(waRes);
    } finally {
      setIsLoadingStickers(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'sticker') {
      loadAllStickers();
    }
  }, [activeTab, loadAllStickers]);

  const handleEmojiClick = (emoji: string) => {
    const updated = saveRecentEmoji(emoji);
    setRecentEmojis(updated);
    onSelectEmoji(emoji);
  };

  const handleImportFromLibrary = async () => {
    if (!window.electronAPI?.importStickersFromDisk) return;
    setIsLoadingStickers(true);
    try {
      const imported = await window.electronAPI.importStickersFromDisk();
      if (imported && imported.length > 0) {
        // Normaliza cada imagem importada para WebP 512x512 e atualiza na biblioteca
        const normalizedList: StickerItem[] = [];
        for (const item of imported) {
          const webpUrl = await normalizeImageToStickerWebp(item.dataUrl);
          if (webpUrl !== item.dataUrl && window.electronAPI?.saveStickerToLibrary) {
            await window.electronAPI.deleteUserSticker?.(item.id);
            const saved = await window.electronAPI.saveStickerToLibrary(webpUrl);
            if (saved) {
              normalizedList.push(saved);
              continue;
            }
          }
          normalizedList.push({ ...item, dataUrl: webpUrl });
        }
        const refreshed = await window.electronAPI.getUserStickers?.();
        if (refreshed) {
          setLibraryStickers(refreshed);
        } else {
          setLibraryStickers((prev) => [...normalizedList, ...prev]);
        }
        setStickerFilter('library');
      }
    } finally {
      setIsLoadingStickers(false);
    }
  };

  const handleSaveWhatsAppStickerToLibrary = async (
    e: React.MouseEvent,
    sticker: StickerItem
  ) => {
    e.stopPropagation();
    if (!window.electronAPI?.saveStickerToLibrary) return;
    const webpUrl = await normalizeImageToStickerWebp(sticker.dataUrl);
    const saved = await window.electronAPI.saveStickerToLibrary(webpUrl);
    if (saved) {
      setLibraryStickers((prev) => {
        if (prev.some((s) => s.id === saved.id)) return prev;
        return [saved, ...prev];
      });
    }
  };

  const handleDeleteSticker = async (e: React.MouseEvent, stickerId: string) => {
    e.stopPropagation();
    if (!window.electronAPI?.deleteUserSticker) return;
    await window.electronAPI.deleteUserSticker(stickerId);
    setLibraryStickers((prev) => prev.filter((s) => s.id !== stickerId));
  };

  const handleStickerClick = async (sticker: StickerItem) => {
    const webpUrl = await normalizeImageToStickerWebp(sticker.dataUrl);
    onSelectSticker(webpUrl);
  };

  const filteredEmojis = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const all = Object.values(EMOJI_DATA).flat();
      const seen = new Set<string>();
      return all.filter((entry) => {
        if (seen.has(entry.char)) return false;
        const match = entry.char.includes(q) || entry.keywords.toLowerCase().includes(q);
        if (match) seen.add(entry.char);
        return match;
      });
    }
    if (emojiCategory === 'recent') {
      return recentEmojis.map((char) => ({ char, keywords: '' }));
    }
    return EMOJI_DATA[emojiCategory] || [];
  }, [searchQuery, emojiCategory, recentEmojis]);

  const combinedStickers = useMemo(() => {
    const seenUrls = new Set<string>();
    const mergedWa: StickerItem[] = [];
    for (const s of [...whatsappStickers, ...localChatStickers]) {
      if (!seenUrls.has(s.dataUrl)) {
        seenUrls.add(s.dataUrl);
        mergedWa.push(s);
      }
    }

    if (stickerFilter === 'library') {
      return libraryStickers;
    }
    if (stickerFilter === 'whatsapp') {
      return mergedWa;
    }
    return [...libraryStickers, ...mergedWa];
  }, [stickerFilter, libraryStickers, whatsappStickers, localChatStickers]);

  const savedUrlsSet = useMemo(
    () => new Set(libraryStickers.map((s) => s.dataUrl)),
    [libraryStickers]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.97 }}
      transition={{ duration: 0.14 }}
      className="relative z-30 mx-2 mb-1.5 bg-[#202C33] rounded-[10px] shadow-[0_10px_32px_rgba(0,0,0,0.75)] border border-white/10 flex flex-col overflow-hidden h-[275px]"
    >
      {/* Topo: Alternador Emojis vs Figurinhas */}
      <div className="px-2.5 py-1.5 bg-[#182229] border-b border-white/[0.07] flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('emoji')}
            className={`px-3 py-1 rounded-[6px] text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === 'emoji'
                ? 'bg-[#00A884] text-[#111B21] font-semibold'
                : 'text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/5'
            }`}
          >
            <Smile className="w-3.5 h-3.5" />
            <span>Emojis</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sticker')}
            className={`px-3 py-1 rounded-[6px] text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === 'sticker'
                ? 'bg-[#00A884] text-[#111B21] font-semibold'
                : 'text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/5'
            }`}
          >
            <Sticker className="w-3.5 h-3.5" />
            <span>Figurinhas</span>
            {(libraryStickers.length > 0 || whatsappStickers.length > 0) && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === 'sticker'
                    ? 'bg-[#111B21]/25 text-[#111B21]'
                    : 'bg-[#2A3942] text-[#E9EDEF]'
                }`}
              >
                {libraryStickers.length + whatsappStickers.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attachment')}
            className={`px-3 py-1 rounded-[6px] text-[12px] font-medium flex items-center gap-1.5 transition-colors ${
              activeTab === 'attachment'
                ? 'bg-[#00A884] text-[#111B21] font-semibold'
                : 'text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/5'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5 -rotate-45" />
            <span>Anexos</span>
            {recentPhotos.length > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activeTab === 'attachment'
                    ? 'bg-[#111B21]/25 text-[#111B21]'
                    : 'bg-[#2A3942] text-[#E9EDEF]'
                }`}
              >
                {recentPhotos.length}
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Fechar painel"
          className="p-1 rounded-full text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* CONTEÚDO ABA 1: EMOJIS */}
      {activeTab === 'emoji' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Busca + Categorias */}
          <div className="px-2.5 pt-2 pb-1.5 space-y-1.5 border-b border-white/[0.05]">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-[#8696A0] absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar emoji (ex: coração, rindo, jogo)..."
                className="w-full bg-[#111B21] text-[12px] text-[#E9EDEF] placeholder-[#8696A0] pl-7 pr-6 py-1 rounded-[6px] border border-white/[0.06] focus:outline-none focus:border-[#00A884]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 text-[#8696A0] hover:text-[#E9EDEF]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {!searchQuery && (
              <div className="flex items-center justify-between gap-0.5">
                {EMOJI_CATEGORIES.map((cat) => {
                  const isActive = emojiCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setEmojiCategory(cat.id)}
                      title={cat.label}
                      className={`flex-1 py-1 rounded-[5px] flex items-center justify-center transition-colors ${
                        isActive
                          ? 'bg-[#2A3942] text-[#00A884]'
                          : 'text-[#8696A0] hover:text-[#E9EDEF] hover:bg-white/5'
                      }`}
                    >
                      {cat.icon}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Grade de Emojis */}
          <div className="flex-1 overflow-y-auto px-2 py-1.5 wa-scrollbar">
            {filteredEmojis.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[12px] text-[#8696A0]">
                Nenhum emoji encontrado para &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              <div className="grid grid-cols-8 gap-1">
                {filteredEmojis.map((item) => (
                  <button
                    key={item.char}
                    type="button"
                    onClick={() => handleEmojiClick(item.char)}
                    className="h-8 rounded-[6px] hover:bg-white/10 active:scale-90 flex items-center justify-center text-[20px] transition-transform select-none"
                  >
                    {item.char}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO ABA 2: FIGURINHAS (STICKERS) */}
      {activeTab === 'sticker' && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Barra de Ações da Biblioteca de Figurinhas */}
          <div className="px-2.5 py-1.5 bg-[#182229]/60 border-b border-white/[0.06] flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setStickerFilter('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  stickerFilter === 'all'
                    ? 'bg-[#2A3942] text-[#E9EDEF]'
                    : 'text-[#8696A0] hover:text-[#E9EDEF]'
                }`}
              >
                Todas
              </button>
              <button
                type="button"
                onClick={() => setStickerFilter('library')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  stickerFilter === 'library'
                    ? 'bg-[#2A3942] text-[#FBBF24]'
                    : 'text-[#8696A0] hover:text-[#E9EDEF]'
                }`}
              >
                <Star className="w-3 h-3 fill-current" />
                <span>Biblioteca ({libraryStickers.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setStickerFilter('whatsapp')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                  stickerFilter === 'whatsapp'
                    ? 'bg-[#2A3942] text-[#25D366]'
                    : 'text-[#8696A0] hover:text-[#E9EDEF]'
                }`}
              >
                WhatsApp
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={loadAllStickers}
                title="Sincronizar figurinhas recentes do WhatsApp"
                className="p-1 rounded bg-[#2A3942] hover:bg-[#364852] text-[#8696A0] hover:text-[#E9EDEF] transition-colors"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoadingStickers ? 'animate-spin text-[#25D366]' : ''}`}
                />
              </button>
              <button
                type="button"
                onClick={handleImportFromLibrary}
                title="Adicionar figurinhas ou imagens (.webp, .png, .jpg, .gif) do seu computador"
                className="px-2 py-1 rounded bg-[#00A884] hover:bg-[#25D366] text-[#111B21] font-semibold text-[11px] flex items-center gap-1 transition-colors shrink-0"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Adicionar</span>
              </button>
            </div>
          </div>

          {/* Grade de Figurinhas */}
          <div className="flex-1 overflow-y-auto p-2 wa-scrollbar">
            {isLoadingStickers && combinedStickers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-[#8696A0]">
                <Loader2 className="w-5 h-5 text-[#25D366] animate-spin" />
                <span className="text-[12px]">Carregando suas figurinhas...</span>
              </div>
            ) : combinedStickers.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 gap-2">
                <Sticker className="w-7 h-7 text-[#8696A0]/70" />
                <p className="text-[11.5px] text-[#8696A0] leading-snug">
                  Sua biblioteca está vazia. Clique em{' '}
                  <strong className="text-[#25D366]">+ Adicionar</strong> para importar
                  figurinhas/imagens do PC ou passe o mouse sobre uma figurinha no chat para
                  favoritar (★).
                </p>
                <button
                  type="button"
                  onClick={handleImportFromLibrary}
                  className="mt-1 px-3 py-1.5 rounded-[6px] bg-[#00A884] hover:bg-[#25D366] text-[#111B21] font-semibold text-[11.5px] flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Escolher da Biblioteca do PC</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {combinedStickers.map((stk) => {
                  const isSavedInLibrary =
                    stk.source === 'library' || savedUrlsSet.has(stk.dataUrl);
                  return (
                    <div
                      key={stk.id}
                      onClick={() => handleStickerClick(stk)}
                      title="Clique para enviar figurinha"
                      className="group/stk relative aspect-square rounded-[8px] bg-[#111B21]/60 hover:bg-[#2A3942]/80 border border-white/[0.05] p-1.5 flex items-center justify-center cursor-pointer transition-all"
                    >
                      <img
                        src={stk.dataUrl}
                        alt={stk.name || 'Figurinha'}
                        className="w-full h-full object-contain group-hover/stk:scale-105 transition-transform pointer-events-none"
                        draggable={false}
                      />

                      {/* Botão Favoritar na Biblioteca (para figurinhas vindas do WhatsApp) */}
                      {stk.source === 'whatsapp' && !isSavedInLibrary && (
                        <button
                          type="button"
                          onClick={(e) => handleSaveWhatsAppStickerToLibrary(e, stk)}
                          title="Salvar na minha biblioteca de figurinhas"
                          className="opacity-0 group-hover/stk:opacity-100 absolute top-1 right-1 w-5 h-5 rounded-full bg-[#111B21]/90 text-[#FBBF24] hover:scale-110 flex items-center justify-center shadow transition-all"
                        >
                          <Star className="w-3 h-3" />
                        </button>
                      )}

                      {/* Indicador/Botão Excluir para figurinhas da Biblioteca do Usuário */}
                      {stk.source === 'library' && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSticker(e, stk.id)}
                          title="Remover da biblioteca"
                          className="opacity-0 group-hover/stk:opacity-100 absolute top-1 right-1 w-5 h-5 rounded-full bg-[#111B21]/90 text-[#EF4444] hover:bg-[#EF4444] hover:text-white flex items-center justify-center shadow transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONTEÚDO ABA 3: ANEXOS (ENVIAR FOTO DO COMPUTADOR OU REENVIAR RECENTES) */}
      {activeTab === 'attachment' && (
        <div className="flex-1 flex flex-col min-h-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileInputChange}
          />

          {/* Barra de Subtítulo / Info */}
          <div className="px-3 py-1.5 bg-[#182229]/60 border-b border-white/[0.06] flex items-center justify-between text-[11px] text-[#8696A0]">
            <span>Reenvio rápido das últimas fotos ou carregue do PC</span>
            {isProcessingMedia && (
              <div className="flex items-center gap-1 text-[#00A884]">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Enviando...</span>
              </div>
            )}
          </div>

          {/* Grade de Anexos */}
          <div className="flex-1 overflow-y-auto p-2 wa-scrollbar">
            <div className="grid grid-cols-4 gap-2">
              {/* Primeiro Card: Botão (+) para carregar do computador */}
              <button
                type="button"
                onClick={handlePickComputerFile}
                disabled={isProcessingMedia}
                title="Carregar imagem ou vídeo do seu computador"
                className="group/add aspect-square rounded-[8px] bg-[#111B21]/70 hover:bg-[#202C33] border-2 border-dashed border-[#00A884]/60 hover:border-[#25D366] flex flex-col items-center justify-center gap-1 p-1 text-center cursor-pointer transition-all disabled:opacity-50"
              >
                <div className="w-7 h-7 rounded-full bg-[#00A884]/20 group-hover/add:bg-[#00A884]/35 flex items-center justify-center transition-colors">
                  <Plus className="w-4 h-4 text-[#00A884] group-hover/add:text-[#25D366] stroke-[2.5]" />
                </div>
                <span className="text-[11px] font-semibold text-[#E9EDEF] leading-tight">
                  Do computador
                </span>
                <span className="text-[9px] text-[#8696A0] leading-none">
                  Foto ou vídeo
                </span>
              </button>

              {/* Cards das últimas até 20 fotos recebidas */}
              {recentPhotos.map((photo, idx) => (
                <button
                  key={photo.id || `photo-${idx}`}
                  type="button"
                  onClick={() => handlePhotoClick(photo)}
                  disabled={isProcessingMedia}
                  title="Clique para reenviar foto"
                  className="group/photo relative aspect-square rounded-[8px] bg-[#111B21]/60 hover:bg-[#2A3942] border border-white/[0.08] hover:border-[#00A884] overflow-hidden cursor-pointer transition-all flex items-center justify-center p-0.5 focus:outline-none disabled:opacity-50"
                >
                  <img
                    src={photo.url}
                    alt="Foto recente"
                    className="w-full h-full object-cover rounded-[6px] group-hover/photo:scale-105 transition-transform"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover/photo:bg-black/35 transition-colors flex items-center justify-center rounded-[6px]">
                    <div className="opacity-0 group-hover/photo:opacity-100 transition-opacity bg-[#111B21]/90 rounded-full p-1 text-[#00A884] shadow-md flex items-center justify-center">
                      <Send className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};
