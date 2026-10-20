# Plano do Imhotep — estado verificado

Atualizado em 20/10/2026, versão 0.4. O documento de visão é a referência de produto; esta matriz distingue entregas demonstradas de evolução ainda pendente.

| Marco                 | Entrega atual                                                                                                                                           | Evidência                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 0 — Referência visual | Layout do editor e modais baseado no Pencil, oito expressões originais do Kendrick, respiração, olhar pelo cursor e transições                          | `design/Imhotep.pen`, `test:interface`, `test:persona`                                |
| 1 — Motor headless    | Documento validado, SQLite, revisão/idempotência, CLI/MCP, renderização SVG/PNG sem GUI, backups/restauração                                            | `npm test`, `test:browser`                                                            |
| 2 — Editor            | Páginas, camadas, seleção, arraste/resize, tipografia, assets/fontes, componentes/tokens, booleanas, nós/alças Bézier, constraints, wrapping e clipping | `test:workbench`, `test:design`, testes de geometria/layout/fontes/componentes        |
| 3 — IA em tempo real  | API/SSE, autoria e conflito explícito; propostas com comparação antes/depois; Wendler ligado ao motor e à seleção ativa                                 | `test:browser`, `tests/proposal.test.js`, `test:wendler` com Kyle real                |
| 4 — Prototype         | Conexões criadas por arraste e editáveis, múltiplos fluxos/telas iniciais, teclado/mouse/atraso, overlays, hotspots e exportação navegável              | `test:flows`, exemplo `connected-flow.json`                                           |
| 5 — Dev               | Medidas/CSS, SVG/PNG/JSON, HTML semântico responsivo com protótipo/motion, React/TSX e Tailwind/TSX visuais                                             | `test:browser`, `test:workbench`, `test:flows`, `test:design`                         |
| 6 — Motion            | Keyframes por campos, scrub/reprodução, easing, acionamento por interação e mesma execução no HTML offline                                              | `test:workbench`, `test:flows`                                                        |
| Operação              | Tailscale privado, backup verificado antes da atualização e serviço systemd do usuário habilitado com reinício automático                               | `GET /api/health`, `GET /api/integrations/wendler`, `systemctl --user status imhotep` |

As três pendências citadas na entrega 0.3 — booleanas, alças Bézier e exportação responsiva — foram implementadas e verificadas na [versão 0.4](RELEASE_0.4.md).

## Critérios A–F do documento original

- **A — Headless:** demonstrado por subprocessos CLI/MCP, PNG real e reabertura após reinício.
- **B — Tempo real:** demonstrado por SSE, edição real do Kyle no Wendler, autoria, restauração e rejeição de revisão desatualizada. Conflitos são rejeitados, sem mesclagem automática.
- **C — Prototipagem:** demonstrado com três frames, conexão arrastável, preview, exportação offline, reabertura e consulta do grafo com seus fluxos pelo MCP.
- **D — Design/Dev:** formas, importação SVG, edição gráfica de âncoras/alças Bézier, booleanas, fonte/layout, constraints/wrapping, CSS e exportação semântica responsiva estão testados. Os componentes React/Tailwind compilam; o HTML foi executado offline em 1000 e 390 pixels.
- **E — Motion:** keyframes editáveis e persistidos, reprodução, acionamento no protótipo e HTML offline demonstrados.
- **F — Autonomia:** Linux sem desktop, dados próprios, ausência de conta externa de design, backup restaurável, provedor selecionável e execução do serviço após logout.

## Evolução ainda pendente da visão completa

Esta versão fecha os fluxos básicos dos marcos 1–6, com as limitações abaixo. Não equivale à abrangência completa de um editor profissional.

1. Geometria avançada adicional: catálogo completo de formas parametrizáveis, gradientes/efeitos/máscaras e clipping além dos limites retangulares/arredondados de frames. Booleanas e nós/alças Bézier foram entregues na 0.4.
2. Produtividade: réguas/guias/snapping, painéis redimensionáveis e versões nomeadas. Constraints responsivos, wrapping e recorte de frames foram entregues na 0.4.
3. Protótipo avançado: variáveis/condições, troca de variante por interação, scroll/drag/eventos customizados, rolar até elemento e transições físicas mais completas.
4. Motion avançado: cores/stroke, spring, editor gráfico de curvas, stagger, sequências e motion paths/morphing.
5. Geração de aplicações: estado/interações em React/Tailwind, props e rotas de aplicação, além de comparação visual com documentos mais variados. HTML semântico responsivo e componentes React/TSX/Tailwind visuais foram entregues na 0.4; eventos e motion executáveis estão no HTML.
6. Compatibilidade: importador geral `.pen`, `.fig`, plugins e aplicativo desktop. O arquivo Pencil fornecido foi usado como referência; não existe importação geral disfarçada de recurso pronto.
7. Colaboração corporativa: autenticação multiusuário, autorização por projeto/agente, presença visual compartilhada e mesclagem de operações compatíveis.
8. Operação em escala: rotação/compactação de snapshots e backups, armazenamento externo e validação de carga com documentos grandes.

Claude Code e OpenCode continuam dependentes da disponibilidade/login de suas CLIs e cotas. A chamada verificada nesta versão foi pelo executor Codex do Wendler com seu modelo já configurado; isso não certifica contas indisponíveis de outros provedores.
