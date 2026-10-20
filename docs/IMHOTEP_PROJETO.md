# IMHOTEP

> **Editor visual de design, prototipagem, motion e desenvolvimento, nativo para agentes de IA, totalmente hospedado em infraestrutura própria.**

**Tipo de documento:** visão do produto, especificação funcional e direcionamento de implementação  
**Status:** planejamento técnico; as telas da interface já foram desenhadas pelo idealizador  
**Ambiente-alvo:** servidor Linux da empresa, com acesso remoto via SSH e navegador no computador do usuário  
**Integrações prioritárias:** Claude Code, Codex e OpenCode

---

## 1. O que é o Imhotep?

O **Imhotep** é um editor de criação visual pensado para reunir, em uma única ferramenta:

- a edição de telas e componentes típica de **Figma**, **Sketch** e **Pencil.dev**;
- a **prototipagem navegável**, em que telas, botões e interações são conectados e testados;
- o **motion design**, com timeline, keyframes e animações editáveis;
- o **Dev Mode**, para inspecionar propriedades e obter código correspondente ao design;
- uma **integração profunda com agentes de inteligência artificial**, capazes de ler, renderizar e modificar projetos pelo terminal, sem abrir a interface gráfica;
- a **autonomia de uma solução self-hosted**, com arquivos e histórico guardados no servidor controlado pelo usuário.

O Imhotep não deve ser uma página que apenas simula um editor, nem um chatbot com uma pré-visualização ao lado. Ele deve ser uma **ferramenta de produção real**, capaz de criar, editar, salvar, abrir, exportar, versionar e executar protótipos.

### Frase que resume o projeto

**O que eu desenho no navegador, a IA consegue entender e alterar pelo SSH. O que a IA altera no servidor, eu vejo no canvas em tempo real. Tudo fica salvo sob meu controle.**

---

## 2. Por que estamos criando o Imhotep?

A ideia nasceu da experiência com editores como o Pencil.dev. Essas ferramentas são úteis para desenhar telas, mas não resolvem satisfatoriamente o fluxo de trabalho desejado:

1. Os projetos visuais frequentemente dependem de um aplicativo, serviço, sessão ou interface gráfica para serem interpretados e editados corretamente.
2. Os agentes de programação já estão instalados no servidor Linux. Mesmo recebendo os arquivos do projeto, muitas vezes têm dificuldade para **ver o resultado visual**, navegar pelas telas e trabalhar sobre o design sem recorrer a uma interface externa.
3. Abrir manualmente o editor, exportar imagens e transferir arquivos a cada alteração torna o processo lento e trabalhoso.
4. Faltam, ou são limitados, recursos importantes de editores profissionais: **prototipagem com conexões entre telas**, **inspeção de código**, **motion design**, **bibliotecas de recursos** e **desenho vetorial avançado**.
5. O usuário quer manter os projetos, os arquivos de origem, os assets e as revisões **no servidor da empresa**, em vez de ficar preso a um fornecedor.

O objetivo não é apenas copiar Figma ou Pencil.dev. É eliminar essa separação entre **design**, **código**, **agentes** e **infraestrutura local**.

### Problemas que o Imhotep deve resolver

| Problema atual | Solução esperada no Imhotep |
| --- | --- |
| A IA no servidor não consegue interpretar uma tela sem abrir um aplicativo | Leitura estruturada do documento e renderização **headless** via CLI/MCP |
| O projeto está na máquina do usuário ou em um serviço externo | Projeto e assets persistidos no servidor Linux |
| Alterações da IA são difíceis de acompanhar | Eventos reais de edição propagados ao navegador em tempo real |
| Telas desenhadas não estão conectadas | Modo Prototype com ligações visuais e navegação funcional |
| Falta um Dev Mode completo e acessível | Inspeção de layout, propriedades, CSS, JS/TS e componentes |
| Falta motion design integrado | Timeline com keyframes, easing, estados e pré-visualização |
| Ferramentas vetoriais são limitadas | Formas parametrizáveis, caneta Bézier e operações booleanas |
| Dependência de plugins e serviços de terceiros | Núcleo local e aberto a integrações opcionais |

---

## 3. Princípios inegociáveis

### 3.1. Local-first e self-hosted

- A **fonte de verdade** dos projetos fica no servidor Linux.
- Deve ser possível iniciar, operar, abrir e editar o Imhotep sem login obrigatório em qualquer serviço de design externo.
- O editor visual pode ser acessado do PC através de um **túnel SSH** ou outra conexão privada autorizada.
- A máquina do usuário funciona como **cliente de visualização e edição**; não deve ser o único lugar em que o projeto está salvo.
- A execução deve ser possível em ambiente **sem desktop gráfico** no servidor.
- A solução precisa ter estratégia de backup, recuperação e versionamento.

**Atenção:** ser self-hosted não significa que modelos de IA usados por Claude Code ou Codex rodem necessariamente de forma local. Se forem usados modelos remotos, o envio de conteúdo às APIs respectivas deve ser uma decisão explícita e controlável.

### 3.2. IA nativa, não acessório

- Claude Code, OpenCode e Codex são **clientes de primeira classe** da plataforma.
- Esses agentes precisam conseguir localizar projetos, ler a árvore de elementos, renderizar previews, criar e editar componentes, conectar telas e editar animações **sem navegador aberto**.
- A integração deve usar uma API estruturada, com **MCP e CLI**, em vez de depender de cliques simulados na interface.
- As mesmas regras de validação e histórico devem valer para mudanças feitas por usuários e por agentes.

### 3.3. Sincronização visual verdadeira

- As ações da IA devem produzir alterações reais no documento e atualizar o canvas automaticamente.
- O navegador deve mostrar o nome do agente, o elemento afetado, o estado da operação e sua conclusão.
- As indicações de progresso devem refletir **eventos reais**, não animações inventadas.
- O usuário deve poder desfazer, revisar e restaurar alterações feitas pela IA.
- O servidor deve lidar com edições simultâneas sem corromper o projeto.

### 3.4. Qualidade de um editor profissional

- Canvas fluido, atalhos de teclado, ferramentas vetoriais, painéis ajustáveis, zoom e seleção múltipla.
- Componentes reutilizáveis e organização por páginas, frames, grupos e camadas.
- Prototipagem, motion e modo de desenvolvimento integrados ao **mesmo documento**.
- O editor precisa produzir **arquivos reais e resultados utilizáveis**, não apenas representações estáticas.

---

## 4. Situação atual das telas e regra para implementação

**As telas da interface já foram criadas pelo idealizador do projeto.**

Ao iniciar o desenvolvimento:

1. **Usar as telas existentes como referência principal** de aparência, organização, navegação, hierarquia e componentes.
2. **Não redesenhar toda a UI**, não criar uma landing page e não substituir o layout existente por um dashboard genérico.
3. Implementar o comportamento real das telas: selecionar, desenhar, conectar, animar, inspecionar, salvar e sincronizar.
4. Transformar elementos repetidos das telas em componentes reutilizáveis e preservar a identidade visual escolhida.
5. Se algum detalhe não estiver definido pelas telas, escolher uma solução coerente e **registrar a decisão**, sem descaracterizar o design.
6. Validar a interface implementada visualmente contra os arquivos/prints originais.

**Observação:** este documento descreve o produto, mas **não contém os arquivos das telas já desenhadas**. Quem implementar deverá receber o repositório ou as exportações correspondentes. Não deve presumir que os layouts descritos em texto substituem esses materiais.

---

## 5. Modos de trabalho do Imhotep

O produto terá cinco modos principais, compartilhando projeto, seleção, componentes e histórico:

1. **Design** — criação visual e edição vetorial.
2. **Prototype** — fluxos, conexões e navegação entre telas.
3. **Motion** — animações, timeline e interações animadas.
4. **Dev** — inspeção, exportação e prévia de código.
5. **AI** — trabalho contextual com os agentes e acompanhamento das operações.

Esses modos **não são cinco aplicativos isolados**: são diferentes ferramentas de trabalho sobre a mesma estrutura de dados.

### 5.1. Design Mode

#### Canvas e estrutura

- Canvas infinito, artboards/frames e múltiplas páginas.
- Pan, zoom, ajuste à seleção, réguas, guias e snapping.
- Seleção simples e múltipla, arrastar, duplicar, copiar/colar e edição de propriedades.
- Layers com hierarquia, visibilidade, bloqueio, agrupamento e reordenação.
- Frames de desktop, tablet e celular e possibilidade de dimensões customizadas.
- Layout responsivo, constraints, auto layout, alinhamento e distribuição.
- Estilos, variáveis de design e componentes reutilizáveis, incluindo variantes.
- Histórico de ações, desfazer/refazer e versões nomeadas.

#### Formas e vetores

Não limitar as ferramentas a retângulo e elipse. Incluir:

- retângulos, retângulos arredondados, círculos, elipses e linhas;
- triângulos, losangos, estrelas, setas, arcos e anéis;
- polígonos configuráveis por número de lados;
- caneta, curvas Bézier, edição de nós e paths;
- operações **Union, Subtract, Intersect e Exclude**;
- fill, stroke, gradientes, opacidade, sombra, efeitos, máscaras e clipping;
- transformação, rotação, escala e composição de vetores.

### 5.2. Prototype Mode — funcionalidade obrigatória

**Este é um dos pontos que motivaram o projeto.** Desenhar frames isolados não basta: devem existir conexões utilizáveis entre eles.

#### Conectar telas

- Selecionar um botão, link, componente ou região clicável.
- Arrastar um **conector visual** até um frame de destino.
- Mostrar ligações e setas no canvas, no estilo de fluxos de prototipagem do Figma.
- Editar ou remover conexões, definir a tela inicial e criar múltiplos fluxos.
- Abrir um preview executável e navegar entre as telas de verdade.

#### Gatilhos e ações

**Gatilhos previstos:** clique/toque, hover, mouse enter/leave, pressionar/soltar, arrastar, teclado, scroll, tempo decorrido e eventos customizados controlados.

**Ações previstas:** navegar, voltar, abrir/fechar overlay, rolar até elemento, alterar variante, definir variável, executar animação e navegar condicionalmente.

#### Transições e estados

- Instant, dissolve, slide, push, move-in/out e transições personalizadas.
- Integração com o Motion Mode para curvas de animação e timing.
- Variáveis e estados para testar abas, menus, formulários e fluxos condicionais.
- Preview com dispositivos/resoluções, reinício de fluxo e indicação de hotspots.
- Permitir que agentes **criem, consultem, modifiquem e testem** conexões.

### 5.3. Motion Mode

O Imhotep terá um ambiente de motion design integrado aos elementos do canvas.

- Timeline com pistas (tracks), playhead, keyframes e controle de tempo.
- Reprodução, pausa, loop, velocidade e duração.
- Animação de posição, escala, rotação, opacidade, cor, stroke e outras propriedades compatíveis.
- Easing, editor de curvas e animações do tipo spring.
- Sequências, stagger, transições entre variantes e efeitos de entrada/saída.
- Motion paths e, posteriormente, morphing de SVG quando tecnicamente suportado.
- Eventos de ativação como hover, clique, scroll ou abertura de uma tela.
- Animações reutilizáveis para componentes e interações de protótipo.
- Preview imediato e exportação de código de motion compatível com o alvo selecionado.

**Regra:** as animações devem ser armazenadas como dados editáveis no projeto, e não apenas como vídeos ou GIFs finais.

### 5.4. Dev Mode

As funções básicas de inspeção não devem depender de uma assinatura paga externa.

Ao selecionar um elemento, o usuário poderá inspecionar:

- coordenadas, dimensões, distância entre elementos, margens e padding;
- fontes, estilos tipográficos, cores, bordas, gradientes e efeitos;
- propriedades de layout e responsividade;
- componentes, variantes, variáveis e tokens;
- interações de protótipo e código das animações.

#### Saídas de código prioritárias

1. **CSS** e valores de estilo inspecionáveis.
2. **HTML** com estrutura básica.
3. **JavaScript / TypeScript** para interações compatíveis.
4. **React / TSX** e **Tailwind CSS** para componentes e páginas.
5. Código de **motion** em CSS ou JavaScript, conforme o tipo de animação.

**C++:** não existe uma exportação universal de um design para “C++”. Se esse destino for necessário, desenvolver futuramente um gerador específico para **Qt/QML ou outro framework de UI definido**, com documentação das limitações.

#### Comportamento esperado

- Código com syntax highlighting, copiar e exportar.
- Visualização lado a lado do componente visual e seu código.
- Preview do resultado produzido.
- Identificação explícita de comportamentos que ainda exigem implementação manual.
- Separar **inspeção fiel de propriedades** de **geração de código de produção**: não prometer equivalência perfeita em qualquer framework.

### 5.5. AI Workspace

Os agentes prioritários são **Claude Code, Codex e OpenCode**, todos executando no servidor Linux.

Funcionalidades:

- Escolher agente/sessão e visualizar operações recentes.
- Solicitar criação de frame, layout, componente, protótipo e animação.
- Editar um componente selecionado por linguagem natural.
- Mostrar seleção, identificação e atividade do agente no canvas.
- Consultar diferenças antes/depois, aprovar operações sensíveis e desfazer alterações.
- Registrar qual agente alterou o quê, quando e em qual revisão.
- Continuar operando normalmente quando o navegador estiver fechado.

O AI Workspace não deve se limitar a uma caixa de conversa. Os agentes precisam ter **ferramentas concretas** conectadas ao motor do editor.

---

## 6. Bibliotecas de SVG, fontes e recursos

O Imhotep deve permitir trabalhar com bibliotecas instaladas no próprio servidor.

- Importação de SVG, PNG, WebP e outros formatos de recursos suportados.
- Catálogo local e pesquisável de ícones, com tags, categorias e favoritos.
- Coleções como Lucide, Tabler e Phosphor, respeitando suas licenças.
- Possibilidade de adicionar um pacote próprio de SVGs e manter seus elementos editáveis sempre que possível.
- Alteração de cor, escala, stroke e propriedades de ícones.
- Fontes locais `.ttf`, `.otf` e `.woff2`, com preview e associação ao documento.
- Design tokens de tipografia, cor, espaçamento e efeitos.
- Cache local para reduzir a dependência de serviços de assets externos.

**Estética desejada:** refinamento semelhante ao dos aplicativos da Apple, ícones minimalistas e interfaces limpas. **Não incluir ou redistribuir recursos proprietários da Apple sem a licença/autorização correspondente.** Recursos próprios, livres ou corretamente licenciados são permitidos.

---

## 7. Fluxos principais de uso

### 7.1. Pessoa desenhando no PC

1. A pessoa conecta ao servidor via SSH.
2. Abre o Imhotep pelo navegador do próprio computador.
3. Escolhe um projeto salvo no servidor.
4. Desenha ou edita um componente no canvas.
5. O servidor persiste a alteração e registra uma revisão.
6. O projeto pode ser reaberto depois, do mesmo ou de outro computador autorizado.

### 7.2. Claude Code, Codex ou OpenCode trabalhando sem interface gráfica

1. O agente recebe uma tarefa no terminal do servidor.
2. Consulta os projetos e abre a estrutura do documento pela CLI ou MCP.
3. Renderiza um frame em SVG ou PNG, **sem exigir uma sessão gráfica aberta**.
4. Inspeciona os nós relevantes e propõe ou executa uma alteração validada.
5. O motor salva o projeto no servidor e publica os eventos de alteração.
6. Se houver um navegador conectado, ele recebe as mudanças em tempo real.
7. O agente pode renderizar outra prévia e verificar o resultado.

### 7.3. Prototipagem funcional

1. A pessoa cria frames **Login**, **Chat** e **Agentes**.
2. Seleciona o botão “Entrar” e conecta visualmente ao frame “Chat”.
3. Define `On Click → Navigate To → Chat` com uma transição.
4. Usa **Play** para executar o fluxo navegável.
5. A IA consegue ler e testar a conexão sem redesenhar a tela.

### 7.4. Design para desenvolvimento

1. A pessoa seleciona um componente.
2. Abre o **Dev Mode**.
3. Inspeciona dimensões, fontes, variáveis e estilos.
4. Visualiza CSS ou um componente React/TSX gerado.
5. Copia, exporta ou utiliza o código como base em outro projeto.

---

## 8. Arquitetura proposta

A arquitetura deve ser **server-first, headless-first e baseada em um único modelo de documento**.

```text
                     COMPUTADOR DO USUÁRIO
                  Navegador (via túnel SSH)
                             │
                       HTTPS / WebSocket
                             │
┌──────────────────── SERVIDOR LINUX ───────────────────────┐
│                                                          │
│  Editor Web (Design / Prototype / Motion / Dev / AI)      │
│                             │                            │
│  Backend / API / Sync Server / Permissões / Histórico     │
│                             │                            │
│              Design Engine + Document Schema             │
│               │            │             │               │
│          Renderizador   Prototype      Motion Engine     │
│          Headless       Runtime        + Exportadores    │
│               │            │             │               │
│               └────────────┴─────────────┘               │
│                             │                            │
│                Projetos + Assets + Versões               │
│                             ▲                            │
│                   CLI / MCP / API local                  │
│                     ▲       ▲       ▲                    │
│                  Claude   Codex   OpenCode               │
└──────────────────────────────────────────────────────────┘
```

### Componentes técnicos

**A. Modelo de documentos (núcleo independente)**

Representa páginas, frames, nós, geometria, estilos, assets, componentes, variantes, conexões de protótipo, animações, tokens e metadados. Deve ser tipado, versionado e validado.

**B. Design Engine**

Realiza operações sobre documentos: criar nós, alterar propriedades, calcular hierarquia, transformar shapes, atualizar layout, registrar revisões e gerar diffs. **Não pode depender do React ou de um navegador aberto para funcionar.**

**C. Renderizador headless**

Gera previews SVG/PNG pelo terminal. Renderização de HTML/CSS avançado pode utilizar um navegador **headless** interno, sem sessão gráfica do usuário. Deve ser possível renderizar ao menos um frame do formato nativo diretamente no servidor.

**D. Backend e sincronização**

Expõe APIs locais, autenticação/autorização quando necessária, WebSockets, controle de sessões, persistência e sincronização. A colaboração em tempo real pode utilizar **Yjs/CRDT** ou modelo transacional equivalente, conforme um protótipo técnico validar a abordagem.

**E. CLI e MCP**

São duas formas de expor o **mesmo motor**. Não implementar uma “versão simplificada” para agentes; eles precisam trabalhar com as mesmas entidades e validações do editor visual.

**F. Editor Web**

O cliente exibe as telas já desenhadas, edita o documento e acompanha operações. O navegador **não é o banco de dados nem a fonte de verdade**.

### Stack inicial sugerida (sujeita a prova técnica)

| Camada | Sugestão | Motivo |
| --- | --- | --- |
| Cliente visual | React + TypeScript | Componentização e ecossistema de UI |
| Canvas | SVG interativo + subsistema vetorial | Inspeção fina e edição de formas |
| Geometria | Paper.js ou motor geométrico equivalente | Paths, curvas e booleanas |
| Documento | JSON tipado + validação com Zod | Interoperabilidade e validação |
| Layout | Engine independente com suporte a auto layout | Consistência entre CLI e editor |
| Backend | Node.js + Fastify | APIs e integrações no servidor |
| Tempo real | WebSocket + Yjs (a validar) | Sincronização colaborativa |
| MCP | SDK compatível com os agentes | Operações estruturadas |
| Metadados | SQLite inicialmente | Instalação simples em servidor único |
| Projetos | Arquivos locais + snapshots/versionamento | Portabilidade e autonomia |
| Motion | Timeline própria + runtime de animação | Estados e exportação |
| Deploy | Docker Compose | Serviço reproduzível no Linux |

Essas bibliotecas são **propostas**, não compromissos irrevogáveis. O importante é cumprir os contratos funcionais e manter o projeto sob controle local.

---

## 9. Dados, formato de projeto e persistência

Um projeto deve reunir tudo que for necessário para continuar o trabalho:

```text
/srv/imhotep/
├── projects/
│   └── meu-projeto/
│       ├── project.json
│       ├── pages/
│       │   ├── login.json
│       │   └── chat.json
│       ├── assets/
│       ├── fonts/
│       ├── previews/
│       └── exports/
├── metadata/
├── snapshots/
└── backups/
```

A organização é ilustrativa e poderá mudar. **As alterações precisam passar por um serviço responsável pela persistência**, mesmo quando iniciadas por CLI/MCP, para impedir que um agente sobrescreva arquivos enquanto o navegador está editando.

### O modelo de dados precisa comportar

- `project`, `page`, `frame`, `node`, `group`;
- `geometry`, `transform`, `style`, `layout`;
- `component`, `instance`, `variant`, `token`;
- `asset`, `font`, `library`;
- `prototype_flow`, `interaction`, `transition`, `variable`;
- `animation`, `timeline`, `track`, `keyframe`;
- `revision`, `author`, `agent_session`, `operation`.

### Regras para segurança dos dados

- Salvamento automático no servidor e confirmação de persistência.
- Escritas atômicas, migrações de schema e validação de arquivos.
- Histórico de versões, desfazer/refazer e recuperação de snapshots.
- Backups periódicos fora da pasta principal, com teste de restauração.
- Controle de concorrência para evitar corrupção ou perda de alterações.
- Logs de alterações de agentes e usuários, sem registrar segredos indevidamente.

---

## 10. API, CLI e ferramentas MCP esperadas

Os nomes abaixo são **interfaces desejadas a implementar**, e não comandos já existentes.

### Exemplos de comandos futuros

```bash
# Listar projetos locais
imhotep projects list

# Inspecionar a estrutura de um projeto
imhotep inspect meu-projeto --page chat

# Renderizar um frame sem abrir o navegador
imhotep render meu-projeto --frame chat-home --output /tmp/chat.png

# Validar um documento
imhotep validate meu-projeto

# Exportar um protótipo navegável
imhotep prototype export meu-projeto --output ./prototype
```

### Ferramentas MCP de leitura

- `list_projects`
- `list_pages`
- `get_document_tree`
- `get_node`
- `get_selection` (quando existir cliente com seleção ativa)
- `render_frame`
- `list_assets`
- `get_prototype_graph`
- `get_animation_timeline`
- `get_revision_history`

### Ferramentas MCP de alteração

- `create_node`, `update_node`, `delete_node`
- `group_nodes`, `reorder_nodes`, `set_layout`
- `create_component`, `create_variant`
- `add_asset`, `apply_style`
- `create_prototype_connection`, `update_interaction`
- `create_animation`, `update_keyframe`
- `apply_patch` (lote transacional de operações)
- `save_revision`, `restore_revision`

### Regras da automação

- O agente recebe apenas acesso aos projetos autorizados.
- Chamadas precisam ser validadas quanto a tipos, permissões e referências.
- Uma operação em lote deve ser atômica quando possível.
- Operações devem ter IDs e autoria para permitir auditoria e idempotência.
- Modificações estruturais complexas devem permitir preview/diff antes da aplicação.
- Arquivos fora dos diretórios autorizados não podem ser alterados por ferramentas de projeto.

---

## 11. Edição em tempo real: comportamento esperado

**A colaboração entre agente e pessoa precisa funcionar mesmo quando o agente e o navegador estão em dispositivos diferentes.**

Fluxo esperado:

1. Claude Code chama `create_node` via MCP.
2. O backend valida e aplica a operação ao documento compartilhado.
3. O servidor atribui revisão, autor e identificação da operação.
4. O sincronizador transmite a alteração aos clientes conectados.
5. O canvas cria o elemento imediatamente e identifica o agente.
6. O estado persistido fica disponível para reabertura futura.

**Importante:** não usar somente um watcher de arquivos como solução completa de sincronização; ele pode ser útil para importações externas, mas as operações nativas devem seguir o fluxo transacional da plataforma.

### Caso de conflito

Se usuário e agente alterarem o mesmo componente ao mesmo tempo, deve existir uma política definida para mesclar operações compatíveis e resolver conflitos de forma rastreável, sem perder dados silenciosamente.

### Indicadores visuais úteis

- Claude Code criando um frame.
- Codex alterando o CSS associado a um componente.
- OpenCode conectando duas telas.
- Seleção/borda colorida do elemento sendo modificado.
- Estado `em andamento`, `concluído` ou `erro` vinculado a uma operação real.

---

## 12. Importação, exportação e interoperabilidade

### Importações desejadas

- **SVG**: prioridade alta, preservando formas editáveis quando possível.
- PNG, WebP e imagens comuns como assets.
- Fontes locais e bibliotecas de ícones.
- **`.pen` do Pencil.dev:** desejável para reaproveitar trabalho, mas precisa de estudo do formato e de testes de fidelidade.
- `.fig` e outros formatos proprietários: pesquisa futura; não assumir compatibilidade plena sem importador validado.

### Exportações desejadas

- PNG e SVG de frames e componentes.
- HTML/CSS/JavaScript para previews e exemplos.
- React/TSX/Tailwind quando o gerador estiver disponível.
- Protótipo navegável, com links e interações suportadas.
- Animações em CSS/JavaScript e, futuramente, formatos adicionais onde houver equivalência técnica.
- JSON do formato nativo e pacote completo de projeto para backup/transferência.

**A fidelidade de exportação precisa ser testada.** Não apresentar screenshots ou HTML estático como se fossem aplicativos com todas as interações funcionando.

---

## 13. Acesso, segurança e ambiente da empresa

Como o Imhotep ficará em um servidor corporativo, a autonomia deve vir acompanhada de isolamento e segurança:

- Rodar o editor em rede privada, preferencialmente ligado a `127.0.0.1` e acessado via túnel SSH ou VPN.
- Não expor o serviço diretamente à internet por padrão.
- Separar permissões de usuários, sessões e agentes quando houver múltiplos participantes.
- Limitar o sistema de arquivos às pastas autorizadas.
- Evitar execução arbitrária de comandos por meio das ferramentas MCP.
- Guardar credenciais e tokens fora dos documentos de design.
- Permitir configurar quais agentes e modelos têm acesso a quais projetos.
- Tratar a saída de agentes como entrada não confiável: validar tudo antes de aplicar.
- Documentar explicitamente quando uma integração externa receber dados de projetos.

### Exemplo de acesso remoto

Caso o serviço esteja na porta local `4173` do servidor:

```bash
ssh -L 4173:127.0.0.1:4173 usuario@servidor
```

No computador do usuário, abrir `http://localhost:4173`. O editor e os arquivos continuam no servidor; o navegador apresenta a interface remotamente.

---

## 14. Requisitos não funcionais

- **Confiabilidade:** alterações persistem após atualização da página, desconexão ou reinício do servidor.
- **Desempenho:** canvas responsivo em projetos comuns, com estratégia para documentos grandes.
- **Usabilidade:** atalhos, menus de contexto, seleção previsível, undo/redo e estados claros.
- **Portabilidade:** possibilidade de migrar um projeto entre servidores sem depender de serviços externos.
- **Extensibilidade:** arquitetura para novos tipos de objetos, exportadores, ferramentas e agentes.
- **Observabilidade:** logs, IDs de operações e erros legíveis para humanos e agentes.
- **Privacidade:** projetos locais por padrão e envio a modelos remotos somente quando configurado.
- **Acessibilidade:** foco visível, navegação por teclado onde aplicável e contraste adequado.
- **Consistência:** a representação renderizada pelo servidor deve corresponder ao canvas visual dentro das tolerâncias definidas.

---

## 15. Prioridades e roteiro de desenvolvimento

A ordem abaixo permite entregar um produto funcional de maneira incremental, **sem abandonar os objetivos de longo prazo**.

### Etapa 0 — Integração das telas existentes

- Receber os arquivos, imagens, exportações ou repositório das telas já criadas.
- Mapear telas e componentes existentes.
- Definir tokens e componentes de UI de acordo com o visual aprovado.
- Identificar quais controles são reais e quais ainda são apenas elementos visuais.

**Entrega:** estrutura de interface fiel à referência existente.

### Etapa 1 — Núcleo de documentos, CLI e renderização headless

- Formato nativo versionado e schema validado.
- Operações básicas de leitura e escrita de elementos.
- Projetos persistidos em disco no servidor.
- CLI que consulta projeto e renderiza frame sem GUI.
- Primeiras ferramentas MCP para os três agentes.

**Entrega:** o agente consegue ler, modificar e renderizar uma tela sem navegador aberto.

### Etapa 2 — Editor visual funcional

- Canvas, seleção, pan/zoom, layers e propriedades.
- Shapes, vetores, tipografia, SVGs, assets e componentes.
- Ferramentas de geometria e auto layout básico.
- Salvamento real e undo/redo.

**Entrega:** usuário consegue criar uma tela e reabri-la fielmente.

### Etapa 3 — Colaboração com IA em tempo real

- Backend de sincronização e presença.
- Operações MCP refletidas em tempo real no canvas.
- Indicação de qual agente está modificando cada elemento.
- Histórico e resolução de conflitos.

**Entrega:** a IA edita no servidor enquanto o usuário acompanha no PC.

### Etapa 4 — Prototype Mode

- Conexões visuais entre frames.
- Regras de gatilho, ação e destino.
- Preview navegável, overlays e estados.
- Ferramentas MCP para ler e alterar fluxos.

**Entrega:** um fluxo de várias telas realmente navegável.

### Etapa 5 — Dev Mode

- Inspetor de propriedades e medidas.
- Geração básica de CSS/HTML/React/JS.
- Preview de componentes e exportação.
- Evoluir suporte a responsividade e interações.

**Entrega:** o usuário seleciona um elemento e obtém código útil e verificável.

### Etapa 6 — Motion Studio

- Timeline, keyframes, easing e reprodução.
- Animações por propriedade e interações.
- Integração com Prototype Mode.
- Exportação de motion compatível.

**Entrega:** componente animado editável, executável e exportável.

### Etapa 7 — Evolução e compatibilidade

- Importadores adicionais, inclusive estudo de `.pen`.
- Pacotes de bibliotecas, plugins e sistemas de extensão.
- Recursos avançados de colaboração e exportação.
- Aplicativo desktop opcional, reutilizando o editor web.

---

## 16. Critérios de aceitação: quando o Imhotep está realmente funcionando?

Não considerar uma versão concluída apenas porque a interface está bonita. Os testes abaixo devem ser demonstráveis.

### Teste A — Operação sem navegador

- [ ] O navegador e qualquer aplicativo gráfico estão fechados.
- [ ] O agente lista e abre um projeto pelo SSH.
- [ ] O agente obtém uma árvore de elementos estruturada.
- [ ] O agente gera um PNG de um frame no servidor.
- [ ] O agente modifica um elemento sem editar arquivos de forma insegura.
- [ ] A alteração é salva e permanece após reiniciar o serviço.

### Teste B — Sincronização em tempo real

- [ ] O usuário abre o editor do PC via SSH.
- [ ] Claude Code ou Codex cria um componente.
- [ ] O componente aparece no canvas sem atualizar a página.
- [ ] A operação mostra qual agente a executou.
- [ ] O usuário consegue desfazer ou restaurar a versão anterior.
- [ ] Não há perda silenciosa de alterações simultâneas.

### Teste C — Prototipagem

- [ ] Existem pelo menos três frames de uma interface.
- [ ] Um botão é conectado visualmente a outro frame.
- [ ] O usuário define um gatilho e uma transição.
- [ ] O modo Play navega realmente entre as telas.
- [ ] A conexão continua funcionando após salvar e reabrir.
- [ ] O agente consegue consultar e modificar o grafo de navegação.

### Teste D — Design e Dev Mode

- [ ] É possível criar formas, editar seus nós e importar SVG.
- [ ] O editor permite configurar propriedades, fontes e layout.
- [ ] O Dev Mode mostra medidas e CSS coerentes com o elemento selecionado.
- [ ] O código exportado produz resultado verificável para o caso suportado.

### Teste E — Motion

- [ ] É possível adicionar dois ou mais keyframes a um componente.
- [ ] A timeline reproduz e permite editar a animação.
- [ ] A animação persiste no arquivo do projeto.
- [ ] A animação pode ser disparada no protótipo.
- [ ] Ao menos um formato de exportação produz a mesma animação essencial.

### Teste F — Autonomia

- [ ] É possível executar o editor em servidor Linux sem desktop gráfico.
- [ ] Projetos ficam salvos em armazenamento controlado pela empresa.
- [ ] O editor não exige conta em serviço de design externo.
- [ ] Um backup do projeto pode ser restaurado e reaberto.
- [ ] A integração com modelos externos pode ser identificada e controlada.

---

## 17. O que NÃO queremos construir

- Uma **landing page** ou dashboard que apenas exibe cartões com “Design”, “Motion” e “AI”.
- Um **clone visual estático** do Figma/Pencil sem ferramentas de edição funcional.
- Um sistema em que Claude Code precise abrir uma interface gráfica para inspecionar um frame.
- Um editor que dependa de manter uma aba do navegador permanentemente aberta para a IA trabalhar.
- Um produto que salve os projetos somente em `localStorage` do navegador.
- Um sistema que anuncie “tempo real” usando animações simuladas, sem alterações reais.
- Um software que exija um serviço de design externo para salvar, renderizar ou abrir seus próprios documentos.
- Uma promessa de exportação perfeita para qualquer linguagem ou framework sem implementação e testes.

---

## 18. Instruções para o primeiro agente de desenvolvimento

> **Contexto:** este projeto se chama Imhotep. As telas de UI já foram desenhadas; sua primeira tarefa é receber essas telas e analisar o repositório antes de começar a implementação. Não recrie o visual por iniciativa própria.
>
> **Missão:** transformar os designs existentes em um editor visual funcional, self-hosted e nativo para agentes, executado em servidor Linux com acesso pelo navegador via SSH.
>
> **Primeiro marco obrigatório:** implementar um documento visual mínimo, um motor de operações, persistência no servidor, renderização headless e acesso via CLI/MCP. Um agente deve conseguir alterar um objeto sem abrir navegador; ao reabrir a interface, a alteração precisa aparecer.
>
> **Segundo marco obrigatório:** sincronizar operações reais do agente com o canvas em tempo real.
>
> **Depois:** seguir o roteiro de Design, Prototype, Dev e Motion descrito neste documento, preservando as telas aprovadas.
>
> **Regras:** não criar mockups no lugar de funcionalidades; separar frontend, motor e backend; validar operações; registrar decisões técnicas; entregar instruções reproduzíveis de instalação e testes; evitar dependências de serviços externos obrigatórios.

---

## 19. Definição de sucesso

O Imhotep será bem-sucedido quando o usuário puder:

1. **Desenhar** uma interface completa no navegador do PC.
2. **Salvar** todo o projeto no servidor Linux da empresa.
3. **Pedir ao Claude Code, Codex ou OpenCode**, pelo terminal, para melhorar essa interface.
4. **Acompanhar a IA trabalhando** no canvas em tempo real, sem importar ou exportar arquivos manualmente.
5. **Conectar telas** e testar um protótipo navegável.
6. **Animar componentes** com ferramentas reais de motion design.
7. **Inspecionar e exportar código** útil dos elementos e interações suportados.
8. **Continuar dono dos arquivos**, dos assets, dos backups e da infraestrutura.

**Em uma frase:** o Imhotep deve fazer o design deixar de ser um arquivo isolado que a IA mal consegue enxergar e passar a ser um **ambiente de trabalho compartilhado, vivo e programável**.

---

*Documento-base do projeto Imhotep. A implementação deverá evoluir este arquivo à medida que decisões, telas, contratos de API e testes forem consolidados.*
