# Imhotep 0.2 — editor, protótipos, motion e Kendrick

## Estado verificado

A implementação conecta os modos principais ao mesmo documento persistido. A especificação de visão continua sendo o roteiro de longo prazo; esta versão não pretende ter a abrangência de um editor maduro como Figma.

| Área                 | Implementação                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documento / headless | Operações validadas, revisão esperada, histórico SQLite, PNG/SVG sem navegador, CLI e MCP                                                                           |
| Design               | Páginas, camadas, formas, texto, paths Bézier, seleção por Shift, redimensionamento por alças, duplicação, grupos, ordem, rotação e auto layout horizontal/vertical |
| Componentes          | Masters, instâncias, variantes, propagação de estilo/geometria e overrides locais; sincronização explícita e troca de variante                                      |
| Tokens               | Cores, números e strings persistidos com bindings para fill, gap e texto                                                                                            |
| Recursos             | Ícones locais, imagens raster embutidas, importação básica de SVG editável e fontes locais                                                                          |
| Prototype            | Clique, hover e atraso; navegação, overlay, voltar e fechar; transições instantânea, dissolve e slide                                                               |
| Motion               | Keyframes persistidos, scrub, reprodução, easing e exportação HTML/JavaScript animada                                                                               |
| Dev                  | CSS da seleção, SVG, PNG, JSON, componente React visual e HTML com protótipo/motion                                                                                 |
| Kendrick             | Persona vetorial e expressões extraídas do Pencil; CLI de provedor, contexto do projeto/seleção, proposta validada e aprovação explícita                            |
| Dados                | Backups SQLite online a cada seis horas, criação manual com integrity_check e restauração testada em outro diretório                                                |
| Acesso               | Loopback e IPv4 Tailscale explícito                                                                                                                                 |

## Provedores nesta instalação

- **Codex:** instalado, autenticado e testado com chamada real, proposta e aplicação idempotente.
- **Claude Code:** adaptador implementado; a chamada real retornou `usage_limit_reached` e informou limite semanal. Não há simulação de resposta quando o provedor falha.
- **OpenCode:** adaptador implementado, mas a CLI não está instalada aqui. O painel informa indisponibilidade; não foi validado com uma conta real.

Os processos recebem contexto para gerar propostas estruturadas. Claude Code é iniciado sem ferramentas; OpenCode recebe permissões negadas; Codex usa sandbox de leitura. A integração Codex também passou por teste real da interface completa via endereço Tailscale. O editor não aplica comandos de shell devolvidos pelos modelos. A integração segue o modo [não interativo do Codex](https://learn.chatgpt.com/docs/non-interactive-mode) e a [CLI do OpenCode](https://opencode.ai/docs/cli/).

## Limites e compatibilidade

- SVG importado aceita formas básicas, texto e paths. Scripts, referências externas, transforms, filtros e `use` são rejeitados. Não é um importador SVG completo.
- A edição de curvas permite alterar a geometria SVG; não há editor de alças Bézier nem operações booleanas gráficas nesta versão.
- Auto layout tem direção, padding e gap. Não há flex wrapping ou layout responsivo completo.
- Variantes são masters alternativos de um conjunto; sincronizar uma instância reconstrói sua subárvore e descarta overrides locais daquela instância.
- Animações suportam x, y, width, height, opacity e rotation com easing linear/quadrático. Não há spring físico, animação de paths ou editor de curvas avançado.
- React exporta a composição visual em SVG. O HTML exportado carrega o runtime de navegação e motion sem depender do servidor. Não há geração de uma aplicação React responsiva completa.
- As fontes locais são incorporadas ao projeto; o servidor converte glifos em paths para exportações. Fontes variáveis usam o desenho padrão na conversão headless; eixos e pesos variáveis adicionais ainda não são preservados por essa conversão.
- Clipping avançado, máscaras, efeitos, constraints, `.fig`, importação geral `.pen`, plugin API e desktop nativo permanecem fora desta versão.
- Workspace privado único: ainda não há autenticação multiusuário, autorização por projeto ou verificação de identidade dos autores declarados pela API.
- Backups são cópias completas sem rotação automática. É preciso monitorar o espaço e mantê-los em armazenamento independente para proteção contra falha do disco.

## Recuperação do workspace

Na tela Workspace, crie e baixe um backup verificado. Para restaurar o banco inteiro: pare o serviço, preserve o diretório atual como cópia de segurança, crie um diretório vazio, coloque o backup nele com o nome `imhotep.sqlite` e execute com `IMHOTEP_DATA_DIR=/caminho/restaurado npm run start:tailscale`. O banco contém documentos, revisões e sessões. Para restaurar somente um projeto, importe seu JSON no painel Workspace; isso cria outro projeto sem substituir o original.

## Validação reproduzível

```bash
npm test
npm run test:browser
npm run test:workbench
npm run test:kendrick
npm run test:kendrick:browser
IMHOTEP_TEST_PROVIDER=claude npm run test:kendrick
npm run test:kendrick:browser
```

`test:kendrick` usa uma chamada real ao provedor e pode consumir a cota da conta conectada. Os demais testes usam armazenamento temporário. O teste de backups restaura dados e histórico; o de fontes usa o arquivo local incluído no repositório.

## Refinamento da interface

O atalho compacto do Kendrick segue o posicionamento da referência Pencil, imediatamente acima da barra de ferramentas. Abre uma conversa flutuante que preserva o inspetor e o rascunho e acompanha a seleção. `Ctrl+K` (ou `Cmd+K`) abre e fecha a conversa. O mascote usa os vetores originais com respiração, piscadas naturais e movimento sutil dos olhos. Os estados thinking/attention/success/offline vêm de sessões reais, sem atividade simulada.

Navegação, painéis, modais e cartões recebem transições curtas; `prefers-reduced-motion` é respeitado. O modal de canvas oferece formatos e dimensões funcionais. O editor de keyframes usa campos de tempo, propriedade e valor em vez de JSON. `npm run test:interface` verifica posição do atalho, mudanças reais de transform na respiração, piscadas naturais, rascunho, contexto, teclado, presets e redução de movimento.
