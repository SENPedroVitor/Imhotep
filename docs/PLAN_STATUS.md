# Plano do Imhotep — estado verificado

Atualizado em 20/10/2026, versão 0.3. O documento de visão é a referência de produto; esta matriz distingue entregas demonstradas de evolução ainda pendente.

| Marco                 | Entrega atual                                                                                                                                  | Evidência                                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 0 — Referência visual | Layout do editor e modais baseado no Pencil, oito expressões originais do Kendrick, respiração, olhar pelo cursor e transições                 | `design/Imhotep.pen`, `test:interface`, `test:persona`                                |
| 1 — Motor headless    | Documento validado, SQLite, revisão/idempotência, CLI/MCP, renderização SVG/PNG sem GUI, backups/restauração                                   | `npm test`, `test:browser`                                                            |
| 2 — Editor            | Páginas, camadas, múltipla seleção, arraste, resize, tipografia, vetores SVG, assets/fontes, componentes/variantes/tokens e auto layout básico | `test:workbench`, testes de fontes/componentes                                        |
| 3 — IA em tempo real  | API/SSE, autoria e conflito explícito; propostas com comparação antes/depois; Wendler ligado ao motor e à seleção ativa                        | `test:browser`, `tests/proposal.test.js`, `test:wendler` com Kyle real                |
| 4 — Prototype         | Conexões criadas por arraste e editáveis, múltiplos fluxos/telas iniciais, teclado/mouse/atraso, overlays, hotspots e exportação navegável     | `test:flows`, exemplo `connected-flow.json`                                           |
| 5 — Dev               | Medidas/CSS, SVG/PNG/JSON, componente React visual e HTML executável com protótipo/motion                                                      | `test:browser`, `test:workbench`, `test:flows`                                        |
| 6 — Motion            | Keyframes por campos, scrub/reprodução, easing, acionamento por interação e mesma execução no HTML offline                                     | `test:workbench`, `test:flows`                                                        |
| Operação              | Tailscale privado, backup verificado antes da atualização e serviço systemd do usuário habilitado com reinício automático                      | `GET /api/health`, `GET /api/integrations/wendler`, `systemctl --user status imhotep` |

## Critérios A–F do documento original

- **A — Headless:** demonstrado por subprocessos CLI/MCP, PNG real e reabertura após reinício.
- **B — Tempo real:** demonstrado por SSE, edição real do Kyle no Wendler, autoria, restauração e rejeição de revisão desatualizada. Conflitos são rejeitados, sem mesclagem automática.
- **C — Prototipagem:** demonstrado com três frames, conexão arrastável, preview, exportação offline, reabertura e consulta do grafo com seus fluxos pelo MCP.
- **D — Design/Dev:** formas, SVG editável, fonte/layout, CSS e exportação estão testados. Edição gráfica de nós/alças Bézier ainda não está implementada; paths são editados como geometria SVG.
- **E — Motion:** keyframes editáveis e persistidos, reprodução, acionamento no protótipo e HTML offline demonstrados.
- **F — Autonomia:** Linux sem desktop, dados próprios, ausência de conta externa de design, backup restaurável, provedor selecionável e execução do serviço após logout.

## Evolução ainda pendente da visão completa

Esta versão fecha os fluxos básicos dos marcos 1–6, com as limitações abaixo. Não equivale à abrangência completa de um editor profissional.

1. Geometria avançada: alças Bézier no canvas, booleanas, todas as formas parametrizáveis, gradientes/efeitos/máscaras e clipping avançado.
2. Layout e produtividade: constraints responsivos, wrapping, réguas/guias/snapping, painéis redimensionáveis e versões nomeadas.
3. Protótipo avançado: variáveis/condições, troca de variante por interação, scroll/drag/eventos customizados, rolar até elemento e transições físicas mais completas.
4. Motion avançado: cores/stroke, spring, editor gráfico de curvas, stagger, sequências e motion paths/morphing.
5. Código de produção: HTML/React/TSX/Tailwind responsivo com layout semântico e equivalência visual validada por gerador. O React atual é composição SVG estática.
6. Compatibilidade: importador geral `.pen`, `.fig`, plugins e aplicativo desktop. O arquivo Pencil fornecido foi usado como referência; não existe importação geral disfarçada de recurso pronto.
7. Colaboração corporativa: autenticação multiusuário, autorização por projeto/agente, presença visual compartilhada e mesclagem de operações compatíveis.
8. Operação em escala: rotação/compactação de snapshots e backups, armazenamento externo e validação de carga com documentos grandes.

Claude Code e OpenCode continuam dependentes da disponibilidade/login de suas CLIs e cotas. A chamada verificada nesta versão foi pelo executor Codex do Wendler com seu modelo já configurado; isso não certifica contas indisponíveis de outros provedores.
