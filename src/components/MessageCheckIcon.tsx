import React from 'react';

export interface MessageCheckIconProps {
  ack?: 'sent' | 'delivered' | 'read';
  className?: string;
}

/**
 * Ícone clássico de checagem do WhatsApp:
 * - 1 flechinha cinza: enviada (sent)
 * - 2 flechinhas cinzas: entregue ao dispositivo (delivered)
 * - 2 flechinhas azuis: lida / visualizada (read)
 */
export const MessageCheckIcon: React.FC<MessageCheckIconProps> = ({
  ack = 'sent',
  className = '',
}) => {
  const isRead = ack === 'read';
  const isSingle = ack === 'sent';
  const colorClass = isRead ? 'text-[#53BDEB]' : 'text-[#8696A0]';

  return (
    <svg
      viewBox="0 0 16 11"
      className={`w-[15px] h-[11px] inline-block ml-1 shrink-0 ${colorClass} ${className}`}
      fill="currentColor"
    >
      {isSingle ? (
        // 1 flechinha clássica (sent)
        <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.336-.146.47.47 0 0 0-.343.146l-.311.31a.445.445 0 0 0-.14.337c0 .136.047.25.14.343l2.996 2.996a.724.724 0 0 0 .502.203.697.697 0 0 0 .546-.266l6.646-8.417a.497.497 0 0 0 .108-.299.441.441 0 0 0-.19-.374l-.338-.273Z" />
      ) : (
        // 2 flechinhas clássicas (delivered / read)
        <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.336-.146.47.47 0 0 0-.343.146l-.311.31a.445.445 0 0 0-.14.337c0 .136.047.25.14.343l2.996 2.996a.724.724 0 0 0 .502.203.697.697 0 0 0 .546-.266l6.646-8.417a.497.497 0 0 0 .108-.299.441.441 0 0 0-.19-.374l-.338-.273Zm3.614 0a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-1.2-1.135-.66.819 1.67 1.67a.724.724 0 0 0 .502.203.697.697 0 0 0 .546-.266l6.646-8.417a.497.497 0 0 0 .108-.299.441.441 0 0 0-.19-.374l-.347-.273Z" />
      )}
    </svg>
  );
};
