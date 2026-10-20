# Imhotep

Editor visual self-hosted para pessoas e agentes. Versão 0.2, baseado nas telas em [`design/Imhotep.pen`](design/Imhotep.pen).

## Executar no Linux

Requisitos: **Node.js 24 ou superior** e npm. Não precisa de desktop gráfico, Docker, conta externa ou chave de modelo.

```bash
npm ci
npm start
```

### Acesso direto pelo Tailscale (Windows)

Com o Tailscale conectado no servidor e no Windows:

```bash
npm run start:tailscale
```

O comando detecta o IPv4 privado do servidor e mostra a URL para abrir no Windows. Neste servidor: **http://100.110.182.64:4173**. Não precisa de túnel SSH. A API local continua disponível em **http://127.0.0.1:4173** para CLI/MCP.

O serviço escuta somente em loopback e no IP Tailscale detectado, sem abrir a porta em todas as interfaces. O navegador recebe a interface por HTTP dentro da conexão criptografada do Tailscale. O editor inclui compatibilidade de IDs e cópia de CSS para esse endereço HTTP. A conexão depende das permissões de acesso da sua rede Tailscale. Se o IP do servidor mudar, reinicie este comando.

### Alternativa por SSH

`npm start` mantém o acesso somente local. Pelo Windows, encaminhe a porta:

```bash
ssh -N -L 4173:127.0.0.1:4173 usuario@servidor
```

Depois abra **http://localhost:4173**. Use apenas um modo de inicialização por vez.

Variáveis opcionais:

| Variável                | Padrão                  | Finalidade                                               |
| ----------------------- | ----------------------- | -------------------------------------------------------- |
| `PORT`                  | `4173`                  | Porta HTTP do servidor                                   |
| `IMHOTEP_DATA_DIR`      | `./data`                | Diretório do banco de documentos                         |
| `IMHOTEP_URL`           | `http://127.0.0.1:4173` | URL usada por CLI e MCP                                  |
| `IMHOTEP_PUBLIC_ORIGIN` | sem origem extra        | Origem HTTPS explícita para proxy opcional (sem caminho) |
| `IMHOTEP_AUTHOR`        | `cli`                   | Autor de restaurações pela CLI                           |

Execute os comandos a partir da raiz do repositório. O projeto Orbit é criado somente quando o banco está vazio; ele é um documento real extraído do artboard original, não dados de atividade de agentes.

## O que funciona nesta versão

- Criar e reabrir projetos persistidos no servidor.
- Páginas, seleção múltipla por Shift, arraste, alças de tamanho, grupos, ordem e rotação.
- Auto layout, componentes, variantes, tokens e recursos/fontes locais.
- Prototipagem navegável e animações com timeline/keyframes.
- Kendrick com propostas de edição por CLI de provedor e revisão antes de aplicar.
- Adicionar frames, retângulos, elipses e texto.
- Editar nomes, geometria, cores, borda, raio, opacidade e tipografia.
- Desfazer/refazer edições da sessão e restaurar revisões preservando o histórico.
- Receber operações de agentes em tempo real via SSE, com autoria.
- Inspecionar CSS básico e exportar SVG, PNG e JSON.
- Consultar, editar e renderizar documentos pela CLI/MCP sem navegador.

Atalhos: `V` selecionar, `H` mover, `R` retângulo, `O` elipse, `T` texto, `F` frame, `Delete` excluir, `Ctrl+Z` desfazer, `Ctrl+Shift+Z` refazer e `Shift+1` ajustar. Rolagem move o canvas; `Ctrl` + rolagem altera o zoom. `Alt` + arraste também move o canvas. No macOS, use `Cmd` para desfazer/refazer.

## CLI

Com o servidor ligado:

```bash
npm run cli -- projects list
npm run cli -- create 'Meu canvas'
npm run cli -- inspect ID_DO_PROJETO
npm run cli -- render ID_DO_PROJETO /tmp/frame.png
npm run cli -- render ID_DO_PROJETO /tmp/frame.svg ID_DO_FRAME
npm run cli -- history ID_DO_PROJETO
npm run cli -- export ID_DO_PROJETO /tmp/prototipo.html
npm run cli -- export ID_DO_PROJETO /tmp/Design.tsx
npm run cli -- backup create
npm run cli -- validate examples/orbit.json
```

Para editar, consulte a revisão com `inspect` e salve um pedido JSON como este em `/tmp/operacao.json`:

```json
{
  "baseRevision": 0,
  "operationId": "codex-operacao-001",
  "author": "codex",
  "operations": [
    {
      "type": "update_node",
      "id": "ID_DO_ELEMENTO",
      "changes": { "fill": "#328BFF", "x": 120 }
    }
  ]
}
```

```bash
npm run cli -- apply ID_DO_PROJETO /tmp/operacao.json
npm run cli -- restore ID_DO_PROJETO REVISAO_ALVO REVISAO_ATUAL
```

O ID da operação deve ser único por pedido. Reenviar o mesmo pedido é idempotente. Uma revisão desatualizada retorna conflito; consulte novamente o documento antes de decidir reaplicar. Não atualize arquivos do banco diretamente.

## MCP para Claude Code, Codex e OpenCode

Configure um servidor MCP **stdio** no agente usando um caminho absoluto, ajustando-o à sua instalação:

```json
{
  "mcpServers": {
    "imhotep": {
      "command": "node",
      "args": ["/home/faux/Imhotep/src/mcp/index.js"],
      "env": { "IMHOTEP_URL": "http://127.0.0.1:4173" }
    }
  }
}
```

O objeto externo da configuração varia conforme o cliente; `command`, `args` e `env` descrevem o processo a cadastrar. O adaptador implementa JSON-RPC por linhas em stdio e anuncia as ferramentas `list_projects`, `get_document_tree`, `get_revision_history`, `render_frame`, `apply_patch`, `restore_revision`, `list_pages`, `get_prototype_graph`, `get_animation_timeline` e `list_assets`. `render_frame` devolve texto SVG ou imagem PNG. O protocolo e as chamadas são exercitados por subprocessos nos testes. O Codex do Wendler também descobriu as ferramentas e executou uma edição real pelo MCP; Claude Code/OpenCode continuam dependendo de teste individual no ambiente de cada conta.

O servidor HTTP precisa estar em execução. O agente pode operar com todos os navegadores fechados. O MCP permite operações estruturadas. Para conversar e solicitar propostas ao provedor, use o painel Kendrick no editor. O adaptador recebe o contexto e registra as sessões mesmo se o navegador for fechado.

## Dados, concorrência e acesso

`data/imhotep.sqlite` guarda documentos e snapshots. As gravações passam por uma transação SQLite com revisão esperada, ID idempotente, autoria e validação de hierarquia e propriedades. Um lote inválido não altera o documento. Restaurar cria uma nova revisão. SSE transmite operações concluídas; ao reconectar, o navegador busca o estado persistido. Não há mesclagem automática: uma edição concorrente deve ser revista antes de reaplicar.

Esta versão é para **um workspace privado em um servidor confiável**. Os clientes locais com acesso à API podem acessar todos os projetos. Não há contas, isolamento por projeto ou autorização por agente ainda. O serviço valida Host e Origin, exige JSON nas gravações e não habilita CORS. Para usar outro número de porta no túnel, mantenha o mesmo número nos dois lados. No modo Tailscale, Host e Origin aceitam também o IPv4 privado detectado na mesma porta. Nomes de domínio adicionais não são aceitos automaticamente. HTTPS via Tailscale Serve pode ser configurado pelo administrador com `IMHOTEP_PUBLIC_ORIGIN` definido para a origem HTTPS exata; não é necessário para o acesso por IP documentado acima.

O serviço cria backups SQLite online a cada seis horas em `backups/` (ou `IMHOTEP_BACKUP_DIR`). O painel Workspace cria, verifica e baixa backups manualmente. A restauração integral foi testada em outro diretório; veja [as instruções de recuperação](docs/RELEASE_0.2.md). Importar um JSON de projeto cria uma cópia independente.

## Verificação

```bash
npm test
npx playwright install chromium
npm run test:browser
npm audit
```

Os testes de núcleo/API exercitam atomicidade, rejeição de conflito, idempotência, exclusão de subárvore, validação, restauração, persistência após reinício, SSE, exportação PNG e subprocessos CLI/MCP. O teste de navegador usa um banco temporário e cobre edição, arraste, atualização de agente ao vivo, reabertura, desfazer/refazer, exportação, preview, histórico, criação de canvas e reenvio idempotente após perda da resposta HTTP. Capturas são gravadas em `artifacts/`.

## Kendrick e modos do editor

Abra **Kendrick** na navegação lateral ou **Agentes** na barra superior. Escolha o provedor instalado e envie a solicitação. O modelo recebe o documento e a seleção; a resposta vira uma proposta validada. Revise o lote e clique em **Aplicar proposta**. Se o documento mudar nesse intervalo, a revisão esperada impede que a proposta sobrescreva edições recentes.

Codex está instalado e foi testado com chamada real nesta instalação. Claude Code também está instalado, mas a conta atingiu a cota semanal; o erro é exibido no painel. OpenCode depende de instalação e login próprios. O processo usa a configuração de modelo do provedor, sem chaves embutidas no projeto.

O botão **Protótipo** cria conexões e abre o fluxo navegável. **Motion** edita keyframes por campos de tempo, propriedade e valor, oferece scrub e reprodução e permite acioná-los nas interações do protótipo. **Dev** exporta a composição visual React/SVG e o HTML com navegação/motion. **Workspace** gerencia páginas, importação de projeto e backups.

Consulte [a integração Wendler e os fluxos da versão 0.3](docs/RELEASE_0.3.md), [o estado completo do plano](docs/PLAN_STATUS.md) e [os limites da base 0.2](docs/RELEASE_0.2.md). Os modos principais estão conectados ao motor, mas recursos avançados como alças Bézier, booleanos, layout responsivo e permissões multiusuário ainda não estão implementados.

Veja também [arquitetura](docs/ARCHITECTURE.md), [mapa do design](docs/DESIGN_MAP.md) e [visão de produto](docs/IMHOTEP_PROJETO.md).

## Wendler e inicialização automática

Com os dois serviços em execução, cadastre a integração persistente:

```bash
npm run connect:wendler
```

O instalador confirma as 14 ferramentas no executor do Wendler. Abra **Wendler** na lateral do editor para conferir a conexão e copiar o contexto do projeto. O agente consulta a seleção real, renderiza e altera o documento pela mesma API; o canvas recebe as operações por SSE e mantém a autoria no histórico. `npm run test:wendler` verifica uma chamada real do Kyle em um projeto demonstrativo e consome a cota da conta conectada.

Para manter o Imhotep ativo após logout e reiniciar em caso de falha, pare uma instância manual existente e execute `npm run service:install`. O serviço systemd de usuário usa o acesso Tailscale e o banco atuais. Consulte logs com `journalctl --user -u imhotep` e confira o linger do usuário na instalação. [Detalhes operacionais e parâmetros do instalador](docs/RELEASE_0.3.md).

`npm run test:flows` verifica conexão por arraste, fluxos nomeados, acionamento de animação, navegação/teclado, exportação offline, seleção pelo MCP e comparação de propostas. [connected-flow.json](examples/connected-flow.json) é um projeto importável com três telas, dois fluxos e motion por clique.
