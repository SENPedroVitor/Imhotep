# Arquitetura inicial

## Decisões

- Node.js 24, ES modules e frontend JavaScript/SVG sem framework: o núcleo e o renderizador podem ser reutilizados sem uma etapa de build. O motor não depende do DOM.
- SQLite nativo do Node como fonte de verdade. Documento atual e snapshot de cada revisão são gravados na mesma transação. A versão de schema inicial é 1.
- A API é a única entrada de escrita em execução. A CLI e o MCP são clientes HTTP; nenhum deles altera JSONs ou o banco por fora do motor.
- Controle de concorrência otimista por revisão do documento inteiro. Não há CRDT nem resolução automática de conflitos neste incremento.
- Eventos SSE depois do commit. Cada evento traz documento, revisão, autor e ID da operação. Reconexões buscam o estado atual, sem depender de replay de eventos.
- Renderizador SVG compartilhado pelo navegador e servidor; PNG produzido por Sharp/libvips. Sem screenshot de navegador para renderizar documentos.
- Interface inicial baseada na tela Design Studio e no seletor de canvases existentes. Controles não implementados não simulam resultados.

## Módulos

| Caminho                | Responsabilidade                                       |
| ---------------------- | ------------------------------------------------------ |
| `src/core/document.js` | Modelo v1, validação e aplicação pura de operações     |
| `src/core/store.js`    | Transações, revisão esperada, idempotência e histórico |
| `src/server/index.js`  | API HTTP, SSE, renderização e arquivos estáticos       |
| `src/cli/`             | Cliente para terminal e scripts                        |
| `src/mcp/`             | Adaptador MCP stdio                                    |
| `public/renderer.js`   | Geração de SVG e cálculo de geometria                  |
| `public/app.js`        | Seleção, edição, zoom, histórico e interface           |
| `examples/orbit.json`  | Documento inicial extraído do design aprovado          |

## Contrato v1

Documento: `{schemaVersion: 1, name, nodes: []}`. Cada nó tem `id`, `type`, `name`, `x`, `y`, `width`, `height`, estilo e, opcionalmente, `parentId`. A posição é local ao pai. Tipos atuais: `frame`, `rectangle`, `ellipse`, `text`, `icon`, `path` e `image`. Apenas frames podem ter filhos. O documento contém páginas, interações, animações, tokens e fontes; nós informam sua página.

A API aceita até 2 MB por pedido, 200 operações por lote e 2000 nós por documento. Os valores geométricos são limitados; cores aceitam hex ou `none`, e fontes pertencem a uma lista explícita. Não são aceitos campos de script, HTML ou URLs em propriedades de estilo. Texto é escapado no SVG. O banco guarda autoria declarada pelo cliente; ela ainda não representa uma identidade autenticada.

Operações: `create_node`, `update_node`, `delete_node` (inclui descendentes) e `rename_project`. O lote é validado como um todo antes do commit. Tipos e IDs não podem ser trocados por `update_node`.

## Rotas

| Método     | Rota                                               | Uso                                  |
| ---------- | -------------------------------------------------- | ------------------------------------ |
| GET        | `/api/health`                                      | Estado do serviço                    |
| GET / POST | `/api/projects`                                    | Listar / criar                       |
| GET        | `/api/projects/:id`                                | Documento e revisão                  |
| POST       | `/api/projects/:id/operations`                     | Lote com revisão, autoria e ID       |
| GET        | `/api/projects/:id/history`                        | Até 100 entradas recentes            |
| POST       | `/api/projects/:id/restore`                        | Restaurar snapshot como nova revisão |
| GET        | `/api/projects/:id/events`                         | Stream SSE e sinal de conexão        |
| GET        | `/api/projects/:id/render?format=png&frame=:frame` | Renderização headless                |

Erro de entrada: 400. Não encontrado: 404. Conflito de revisão ou reuso de ID com conteúdo diferente: 409. Origem/Host não permitidos: 403. Tipo de conteúdo de escrita diferente de JSON: 415. Pedido acima do limite: 413.

## Limitações deliberadas

Snapshots completos simplificam a restauração; o custo de armazenamento cresce com o documento e o número de edições. Há limite de 100 itens retornados no histórico, mas as revisões anteriores continuam no banco. Não há compactação nem coleta de snapshots ainda. O schema precisa de migrações incrementais quando a versão seguinte for criada. A topologia atual pressupõe um único processo de servidor: conexões SSE são locais a esse processo.

O adapter MCP tem compatibilidade inicial por protocolo; autorização granular, recursos MCP adicionais e integração testada em cada cliente são trabalhos posteriores. O servidor atual é um workspace único e privado, sem autenticação de múltiplos usuários.

## Acesso Tailscale

`npm run start:tailscale` consulta o estado local do Tailscale, exige conexão ativa e adiciona um listener no IPv4 detectado em `100.64.0.0/10`. O listener local é preservado para CLI/MCP. Ambos compartilham o motor e as conexões SSE. Host/Origin continuam com lista explícita; não se aceita `X-Forwarded-Host` como autorização. Não há bind em `0.0.0.0`. A inicialização falha se a interface não puder ser aberta. O comando não altera ACLs nem configurações do Tailscale.

A interface suporta HTTP privado: quando `crypto.randomUUID` ou a API de clipboard não estão disponíveis, usa `crypto.getRandomValues` para UUID v4 e cópia compatível com o navegador. O tráfego entre dispositivos segue pela rede Tailscale. Um proxy HTTPS opcional pode ser autorizado por `IMHOTEP_PUBLIC_ORIGIN`, sem curingas.

## Extensões 0.2

O motor de features valida páginas, tokens/bindings, componentes/variantes, interações, animações e fontes. O banco mantém compatibilidade com documentos anteriores: os campos opcionais recebem defaults ao abrir. O núcleo de documento continua com schemaVersion 1, com extensões compatíveis opcionais; clientes antigos devem atualizar para preservar os campos. Sessões do Kendrick ficam em uma tabela separada e operações aprovadas entram no mesmo histórico transacional. Reinício marca sessões em execução como interrompidas; não há reenvio automático a provedores. O runtime exportado reutiliza renderer/motion e incorpora os dados para navegação offline.

Backups usam a API online do SQLite e verificam integridade antes de apresentar sucesso. Não há rotação automática. As fontes importadas são validadas com Fontkit, persistidas no documento e convertidas em paths nas exportações. Consulte RELEASE_0.2.md para limites de cada recurso.


## Incremento 0.3

- `public/prototype.js` contém o runtime compartilhado entre preview e HTML offline. Os relógios são por animação; interações `animate` tornam a animação dependente de gatilho. Sem animação ativa, não há loop permanente de renderização.
- O documento v1 ganha `flows` como coleção opcional com padrão vazio. Fluxos referenciam somente frames raiz. Interações suportam `animationId`, `key` e `delay`; exclusões mantêm a integridade dessas referências.
- `src/server/presence.js` recebe `POST /api/projects/:id/selection` e fornece `GET` na mesma rota. Leases por aba, limitadas a 100 clientes e 90 segundos, são efêmeras e não geram revisões. O MCP consulta todas as seleções ainda ativas desse projeto.
- `GET /api/projects/:id/sessions/:id/diff` calcula a proposta contra seu snapshot original, sem modificar o documento. Conflitos são informados e continuam bloqueados pelo motor ao aplicar.
- `GET /api/integrations/wendler` verifica serviço e prontidão do executor usando somente a API local previamente configurada pelo instalador. O navegador não fornece um destino de rede ao servidor.
- `scripts/connect-wendler.mjs` instala o MCP de dependências nativas no volume `/data` do Wendler usando sua API de plugins, sem alterar outros conectores ou embutir tokens. O modelo e as permissões do Wendler são preservados.
- `scripts/install-service.mjs` instala o serviço systemd de usuário para iniciar no login/boot com linger e reiniciar em falhas. A rede permanece loopback + Tailscale explícito.


## Incremento 0.4

- `src/core/geometry.js` implementa booleanas e normalização de curvas com Paper.js sem canvas gráfico. O resultado permanece um nó path, validado na mesma transação. Operações preservam os originais quando não há resultado válido e não removem referências compartilhadas de componentes.
- `public/vector.js` representa contornos canônicos, serializa paths e subdivide segmentos cúbicos por de Casteljau. `vector-editor.js` transforma eventos do cursor para o espaço local do path e confirma uma operação por arraste.
- O schema v1 adiciona dimensões de referência vetorial, constraints, wrapping, clipping e tag semântica por nó. O motor aplica constraints recursivamente no resize; o renderizador compartilhado resolve auto layout e wrapping.
- `public/semantic.js` converte a mesma árvore em elementos HTML com CSS de flexbox/constraints. `src/core/export-code.js` incorpora fontes locais, gera HTML com o runtime de protótipo/motion e componentes React/Tailwind TSX. `/code?format=html|react|tailwind&frame=...` é a entrada compartilhada da interface, CLI e MCP. A exportação antiga de protótipo SVG continua em `/prototype`.
- Paper.js é uma dependência do motor, não do MCP stdio instalado no Wendler. Esbuild é usado apenas para validar os arquivos TSX gerados nos testes.
