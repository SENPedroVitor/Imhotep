# Imhotep

Editor visual self-hosted para pessoas e agentes. Primeiro incremento funcional, baseado nas telas em [`design/Imhotep.pen`](design/Imhotep.pen).

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
- Selecionar camadas, arrastar elementos, mover o canvas e alterar zoom.
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

O objeto externo da configuração varia conforme o cliente; `command`, `args` e `env` descrevem o processo a cadastrar. O adaptador implementa JSON-RPC por linhas em stdio e anuncia as ferramentas `list_projects`, `get_document_tree`, `get_revision_history`, `render_frame`, `apply_patch` e `restore_revision`. `render_frame` devolve texto SVG ou imagem PNG. Os clientes reais Claude Code/Codex/OpenCode ainda precisam de um teste individual de compatibilidade; o protocolo e as chamadas foram exercitados por subprocesso nos testes.

O servidor HTTP precisa estar em execução. O agente pode operar com todos os navegadores fechados. O MCP não inicia agentes nem executa comandos enviados por documentos.

## Dados, concorrência e acesso

`data/imhotep.sqlite` guarda documentos e snapshots. As gravações passam por uma transação SQLite com revisão esperada, ID idempotente, autoria e validação de hierarquia e propriedades. Um lote inválido não altera o documento. Restaurar cria uma nova revisão. SSE transmite operações concluídas; ao reconectar, o navegador busca o estado persistido. Não há mesclagem automática: uma edição concorrente deve ser revista antes de reaplicar.

Esta versão é para **um workspace privado em um servidor confiável**. Os clientes locais com acesso à API podem acessar todos os projetos. Não há contas, isolamento por projeto ou autorização por agente ainda. O serviço valida Host e Origin, exige JSON nas gravações e não habilita CORS. Para usar outro número de porta no túnel, mantenha o mesmo número nos dois lados. No modo Tailscale, Host e Origin aceitam também o IPv4 privado detectado na mesma porta. Nomes de domínio adicionais não são aceitos automaticamente. HTTPS via Tailscale Serve pode ser configurado pelo administrador com `IMHOTEP_PUBLIC_ORIGIN` definido para a origem HTTPS exata; não é necessário para o acesso por IP documentado acima.

Para fazer um backup consistente, pare o servidor e copie **todo o diretório de dados**. Para restaurar, mantenha o serviço parado, recoloque esse diretório e inicie novamente. Não copie somente o `.sqlite` enquanto o serviço estiver rodando: arquivos WAL podem conter gravações pendentes. Backups automáticos e restauração assistida ainda não foram implementados.

## Verificação

```bash
npm test
npx playwright install chromium
npm run test:browser
npm audit
```

Os testes de núcleo/API exercitam atomicidade, rejeição de conflito, idempotência, exclusão de subárvore, validação, restauração, persistência após reinício, SSE, exportação PNG e subprocessos CLI/MCP. O teste de navegador usa um banco temporário e cobre edição, arraste, atualização de agente ao vivo, reabertura, desfazer/refazer, exportação, preview, histórico, criação de canvas e reenvio idempotente após perda da resposta HTTP. Capturas são gravadas em `artifacts/`.

## Escopo atual e próximos incrementos

Esta entrega cobre o núcleo headless e um editor inicial conectado ao mesmo motor. A interface segue a organização e os tokens das telas aprovadas; ainda não implementa todas as telas do arquivo Pencil.

Ainda faltam: múltiplas páginas por projeto, redimensionamento por alças, seleção múltipla, reordenação de camadas, auto layout, componentes e variantes, caminhos vetoriais editáveis, bibliotecas/fontes gerenciadas, protótipos interativos, timeline de motion, geração React e gerenciamento de sessões reais de agentes. O botão Motion fica desabilitado. Preview é visual; não simula interações de protótipo.

A extração do artboard Orbit é específica para este arquivo, não um importador geral de `.pen`. Efeitos, clipping, auto layout e outros recursos avançados do Pencil ainda não têm equivalência no modelo v1. Inter, Manrope e JetBrains Mono usam fallback se não estiverem instaladas no sistema; o navegador e o renderizador headless podem apresentar diferenças tipográficas. Os quatro PNGs ausentes continuam opcionais nesta versão. Os ícones do artboard usam uma cópia local do Lucide com licença em [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

Veja [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DESIGN_MAP.md`](docs/DESIGN_MAP.md) e a visão de produto em [`docs/IMHOTEP_PROJETO.md`](docs/IMHOTEP_PROJETO.md).
