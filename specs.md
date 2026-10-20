# Especificação Técnica do Projeto: WhatsApp Bubbles Desktop

## 1. Visão Geral do Projeto
O **WhatsApp Bubbles** é um cliente desktop alternativo para WhatsApp no Windows 11 que substitui a janela tradicional em tela cheia por um sistema minimalista de **bolhas flutuantes (Chat Heads)** ancorado no canto inferior direito da tela, logo acima da bandeja do sistema (relógio do Windows).

O aplicativo opera como um overlay transparente sempre visível (`Always on Top`), permitindo que o usuário continue usando o computador normalmente e interaja com o WhatsApp apenas através de popovers flutuantes rápidos.

---

## 2. Stack Tecnológica Obrigatória
Para garantir transparência nativa no sistema operacional, passagem de cliques (click-through) nas áreas vazias e fidelidade visual idêntica ao WhatsApp Web Dark Mode:

* **Runtime / Shell Desktop:** Electron (última versão estável)
* **Frontend Framework:** React 18+ com TypeScript (empacotado via Vite)
* **Estilização:** Tailwind CSS + Lucide React (ícones equivalentes ao WhatsApp)
* **Animações de Bolhas e Popovers:** Framer Motion (transições suaves de entrada/saída e efeito *spring*)
* **Motor do WhatsApp (Backend no Electron Main Process):** `whatsapp-web.js` (com `LocalAuth` para manter a sessão salva sem precisar ler QR Code toda vez) + `qrcode` (para renderizar o QR Code no primeiro login).
* **Gerenciamento de Estado (Frontend):** Zustand

---

## 3. Arquitetura de Janela e Overlay (Crítico)
O aplicativo NÃO deve parecer um programa tradicional com barra de título.

### 3.1. Configuração da `BrowserWindow` (Electron Main)
* **Posicionamento:** Ancorado no canto inferior direito da área de trabalho útil (`screen.getPrimaryDisplay().workArea`), respeitando a altura da barra de tarefas do Windows.
* **Dimensões da Janela de Overlay:** `width: 480`, `height: 600` (posicionada em `x: workArea.width - 480`, `y: workArea.height - 600`).
* **Propriedades da Janela:**
  * `transparent: true`
  * `frame: false`
  * `alwaysOnTop: true` (nível `'screen-saver'` ou `'pop-up-menu'` para ficar acima de outros apps)
  * `resizable: false`
  * `skipTaskbar: false` (exibir ícone na barra de tarefas conforme imagens, ou bandeja do sistema)
  * `hasShadow: false` (as sombras serão controladas via CSS nas bolhas e nos popovers)

### 3.2. Sistema Click-Through (Cliques Atravessam a Área Transparente)
Como a janela de `480x600` possui grande parte da sua área transparente quando os popups estão fechados, o usuário deve conseguir clicar nos ícones da área de trabalho ou janelas que estão por trás:
1. Por padrão, o Electron deve ativar `mainWindow.setIgnoreMouseEvents(true, { forward: true })`.
2. No React, os elementos interativos (Dock de Bolhas, Popover da Lista de Conversas e Popover de Chat Ativo) devem escutar os eventos `onMouseEnter` e `onMouseLeave`.
3. Ao entrar em um elemento visível (`onMouseEnter`), envia-se um IPC `set-ignore-mouse-events: false` para habilitar o clique.
4. Ao sair para a área transparente (`onMouseLeave`), envia-se `set-ignore-mouse-events: true` (com `{ forward: true }`) para devolver o clique ao Windows.

---

## 4. Design System e Fidelidade Visual (Baseado nos Mockups)

### 4.1. Paleta de Cores (WhatsApp Dark Theme Oficial)
* **Botão Principal do WhatsApp:** Fundo `#25D366`, ícone branco `#FFFFFF`.
* **Badge de Notificação (Contador de Mensagens):** Fundo vermelho `#EF4444` (ou `#FF3B30`), texto branco `#FFFFFF` em negrito.
* **Fundo da Lista de Conversas e Header/Footer:** `#111B21`
* **Fundo do Item da Lista em Hover:** `#202C33`
* **Fundo da Área de Conversa (Chat Background):** `#0B141A` com overlay de *doodles* padrão do WhatsApp (opacidade de `0.06`).
* **Bolha de Mensagem Recebida (Esquerda):** `#202C33`, texto `#E9EDEF`.
* **Bolha de Mensagem Enviada (Direita):** `#005C4B`, texto `#E9EDEF`.
* **Bloco de Mensagem Citada (Reply/Quote):** Fundo `#025144` (enviada) ou `#1D282F` (recebida) com borda lateral esquerda de `4px` na cor `#06CF9C` ou cor do contato.
* **Barra de Digitação (Input):** Fundo externo `#202C33`, campo de texto `#2A3942`, texto `#D1D7DB`, placeholder `#8696A0`.

### 4.2. Layout e Dimensões dos Componentes

#### A. Dock Inferior de Bolhas (Canto Inferior Direito)
* Fica alinhado na base inferior direita da janela (`padding-bottom: 12px`, `padding-right: 16px`).
* Layout horizontal (`flex-row-reverse` ou alinhado à direita) com espaçamento `gap: 10px`.
* **Botão Fixo do WhatsApp (Extrema Direita):**
  * Circular, `48px x 48px`, sombra `shadow-lg`, efeito `hover:scale-105`.
* **Bolhas de Contatos Ativos (À esquerda do botão do WhatsApp):**
  * Circulares, `48px x 48px`, imagem de perfil do contato preenchendo 100% (`object-cover`), borda sutil `2px solid rgba(255,255,255,0.15)`.
  * **Badge de Não Lidas:** Posicionado no canto inferior direito da bolha (`bottom: -2px`, `right: -2px`), formato pílula/círculo (`min-w-[18px] h-[18px]`), fonte `11px` bold, exibindo a quantidade de mensagens não lidas (ex: `4`, `2`). Se for `0`, o badge fica oculto.
  * **Botão de Fechar Bolha:** Ao passar o mouse sobre a bolha (`group-hover`), exibe um pequeno ícone `X` no canto superior direito da bolha (ou permite fechar clicando com o botão direito / botão do meio do mouse na bolha).

#### B. Popover 1: Lista de Conversas (Acionado pelo Botão Verde do WhatsApp)
* **Posição:** Flutua imediatamente acima da barra de bolhas, alinhado à direita (`bottom: 72px`, `right: 16px`).
* **Dimensões:** `width: 310px`, `height: 440px`, bordas arredondadas `rounded-lg` (`8px`), sombra profunda `shadow-2xl`, seta/triângulo discreto na base direita apontando para o botão verde.
* **Estrutura Interna:**
  * Sem cabeçalho pesado (visual limpo idêntico ao mockup). Opcional: barra de busca ultra discreta no topo que aparece ao rolar para cima.
  * Lista rolável verticalmente (`overflow-y-auto` com scrollbar customizada fina e escura).
  * **Item da Lista:**
    * Avatar circular (`44px x 44px`) à esquerda.
    * Coluna central com: Nome do grupo/contato em destaque (`#E9EDEF`, `14px`, `font-medium`, truncado em 1 linha) e prévia da última mensagem abaixo (`#8696A0`, `12px`, truncado em 1 linha, com ícones para Figurinha, Foto, Áudio e checks de leitura `✓✓` azuis/cinzas).
    * Separador inferior sutil (`border-b border-[#222D34]`).

#### C. Popover 2: Janela de Conversa Ativa (Acionado ao Clicar em uma Bolha)
* **Posição:** Flutua imediatamente acima das bolhas (`bottom: 72px`, `right: 16px`).
* **Dimensões:** `width: 360px`, `height: 470px`, bordas arredondadas `rounded-lg`, sombra `shadow-2xl`.
* **Estrutura Interna:**
  * **Barra de Topo Minimalista (Opcional/Hover):** Mostra o nome do contato discreto e um botão de fechar a conversa (`X`) que remove a bolha, além de botão minimizar (`-`) que apenas recolhe o popover mantendo a bolha.
  * **Histórico de Mensagens (`flex-1 overflow-y-auto p-3 space-y-2`):**
    * Separadores de data centralizados (ex: pílula escura escrito `Hoje`).
    * Balões de mensagem de texto com horário no canto inferior direito (`10px`, `#8696A0`) e ícone de check duplo nas enviadas.
    * Suporte visual a **Mensagens Respondidas (Quotes)**: Caixa interna superior destacando o autor e o texto original.
    * Suporte visual e funcional a **Mensagens de Áudio (Voice Notes)**: Botão Play/Pause, barra de ondas sonoras (waveform pontilhada com progresso em azul `#53BDEB` ou verde), duração do áudio (`0:46`, `2:16`), horário e foto de perfil do remetente com ícone de microfone.
  * **Barra de Input Inferior (`h-[52px] bg-[#202C33] px-3 flex items-center gap-2`):**
    * Ícone de Anexo (Clipe de papel) à esquerda.
    * Ícone de Emoji (Carinha) ao lado do clipe.
    * Campo de texto (`input` estilo pílula/arredondado, placeholder `"Digite uma mensagem"`).
    * Ícone de Microfone à direita (muda automaticamente para o ícone de **Enviar / Avião de papel** quando há texto digitado no campo).

---

## 5. Regras de Negócio e Fluxos de Funcionamento

1. **Inicialização e Autenticação:**
   * Ao abrir o app, se o usuário ainda não estiver autenticado no `whatsapp-web.js`, clicar no botão verde do WhatsApp abre um popover exibindo o **QR Code** para leitura no celular.
   * Após autenticado, a sessão é persistida localmente (`LocalAuth`) e o app carrega as conversas recentes.

2. **Fluxo do Botão Principal (Ícone do WhatsApp):**
   * Clicar no botão verde alterna (abre/fecha) o **Popover da Lista de Conversas**.
   * Se houver uma janela de conversa de contato aberta no momento, ela é recolhida automaticamente para dar lugar à Lista de Conversas (apenas um popover aberto por vez).

3. **Fluxo de Criação de Bolha pela Lista:**
   * Na Lista de Conversas, ao clicar em um contato ou grupo:
     1. Verifica se já existe uma bolha aberta para esse `chatId`.
     2. Se não existir, adiciona o contato ao estado `activeBubbles` (criando a bolha circular ao lado do botão verde).
     3. Fecha o Popover da Lista de Conversas e abre imediatamente o **Popover de Conversa Ativa** daquele contato, zerando o contador de não lidas dele (`unreadCount = 0`).

4. **Fluxo de Interação e Fechamento da Bolha:**
   * **Clicar em uma bolha existente:**
     * Se o chat daquela bolha já estiver aberto, ele é minimizado (apenas o popover some, a bolha permanece na barra).
     * Se estiver minimizado (ou se outro chat estiver aberto), abre o popover de conversa daquela bolha e marca as mensagens como lidas (`unreadCount = 0`).
   * **Fechar a conversa definitivamente:**
     * Quando o usuário clica no botão de fechar (`X` na bolha ou no topo da conversa, ou clique com o botão direito na bolha), a conversa é encerrada e **a bolha desaparece completamente** da barra inferior.

5. **Fluxo de Recebimento de Nova Mensagem (Gatilho Automático):**
   * Quando o evento `message` é disparado pelo WhatsApp:
     * Ignora grupos silenciados (opcional via configuração, ou filtra apenas mensagens diretas/grupos ativos).
     * **Caso a bolha do remetente NÃO exista na barra:** O sistema cria automaticamente uma nova bolha para esse contato na barra inferior com o badge vermelho indicando `1` nova mensagem.
     * **Caso a bolha já exista, mas a conversa esteja fechada/minimizada:** Incrementa o contador vermelho na bolha (`unreadCount + 1`) com uma leve animação de *bounce*.
     * **Caso a conversa daquele contato esteja aberta e em foco:** A mensagem entra em tempo real na tela e o contador permanece zerado.

---

## 6. Estrutura de Diretórios Sugerida

```text
whatsapp-bubbles/
├── electron/
│   ├── main.ts                 # Criação da BrowserWindow transparente e controle de Click-Through
│   ├── preload.ts              # ContextBridge expondo a API IPC de forma segura
│   └── whatsappClient.ts       # Instância do whatsapp-web.js, eventos de mensagem e busca de mídia/áudio
├── src/
│   ├── assets/
│   │   └── wa-doodle-bg.png    # Textura de fundo oficial do chat
│   ├── components/
│   │   ├── BubbleDock.tsx      # Barra inferior com o botão verde e as bolhas dos contatos
│   │   ├── ContactBubble.tsx   # Bolha individual com avatar, badge vermelho e opção de fechar
│   │   ├── ChatListPopover.tsx # Popover da lista de amigos/conversas recentes
│   │   ├── ChatWindowPopover.tsx # Popover de conversa ativa
│   │   ├── MessageBubble.tsx   # Balão de mensagem (texto, citação/reply, áudio)
│   │   ├── AudioPlayer.tsx     # Player customizado de notas de voz com waveform
│   │   └── QRCodePopover.tsx   # Tela de login inicial via QR Code
│   ├── store/
│   │   └── useBubbleStore.ts   # Estado global (bolhas ativas, chat aberto, contadores, mensagens)
│   ├── types/
│   │   └── whatsapp.ts         # Interfaces para Chat, Message, Contact, BubbleState
│   ├── App.tsx                 # Gerenciador de layout e gatilhos de MouseEnter/MouseLeave
│   └── main.tsx
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 7. Contratos de Comunicação IPC (Electron <-> React)

### Main para Renderer (Eventos em Tempo Real)
* `wa:qr` -> `(qrDataUrl: string)`: Envia a imagem do QR Code gerada para autenticação.
* `wa:ready` -> `()`: Notifica que o cliente conectou com sucesso.
* `wa:chats-loaded` -> `(chats: ChatSummary[])`: Lista inicial de conversas recentes com foto de perfil e última mensagem.
* `wa:message-received` -> `(payload: { chat: ChatSummary, message: FormattedMessage })`: Disparado quando alguém manda mensagem (cria/atualiza a bolha e incrementa o badge).

### Renderer para Main (Ações do Usuário)
* `window:set-ignore-mouse` -> `(ignore: boolean)`: Ativa/desativa o click-through da área transparente.
* `wa:get-messages` -> `(chatId: string) => Promise<FormattedMessage[]>`: Carrega o histórico recente da conversa ao abrir uma bolha.
* `wa:send-message` -> `(payload: { chatId: string, text: string, quotedMessageId?: string }) => Promise<FormattedMessage>`: Envia mensagem de texto.
* `wa:mark-as-read` -> `(chatId: string) => Promise<void>`: Marca a conversa como lida no WhatsApp e zera a contagem.

---

## 8. Instruções de Execução para o Agente Gerador de Código
1. **Inicialize o projeto** configurando Electron + Vite + React + TypeScript + Tailwind CSS.
2. **Implemente um Modo Mock/Demo Fallback:** Crie uma flag ou fallback automático para que, enquanto o WhatsApp não estiver conectado ou durante testes de UI, o aplicativo carregue dados de exemplo idênticos às imagens de referência (contatos como *"Danilo Neves Xbox"*, *"Caçadores de Rewards"*, *"Comunidade Xbox"*, *"Unidev OAM"*, bolhas com badges `4` e `2`, mensagens com citações e players de áudio). Isso permite testar todas as animações, abertura/fechamento de bolhas e click-through imediatamente.
3. **Priorize o Click-Through perfeito:** Certifique-se de que o container raiz (`#root`) tenha `pointer-events: none` no CSS ou gerencie estritamente o `onMouseEnter` / `onMouseLeave` apenas nos containers do `BubbleDock` e do `Popover` ativo para nunca bloquear a área de trabalho do usuário.
4. **Garanta a estética fiel:** Utilize rolagem suave, barras de rolagem finas (`4px`), cores exatas do tema escuro do WhatsApp e posicionamento milimétrico acima do relógio do sistema.