# Imhotep 0.3 — Wendler e fluxos executáveis

O Imhotep agora é uma conexão MCP persistente do Wendler. O Kyle foi testado com uma chamada real: consultou o projeto de demonstração, alterou um texto e a edição apareceu no navegador pelo Tailscale sem recarregar, com autoria `wendler:kyle` no histórico. A conversa de verificação é temporária; o documento demonstrativo permanece editável no Imhotep.

## Usar com o Wendler

No editor, abra **Wendler** na navegação lateral. O painel verifica o serviço e o executor, abre o Wendler e permite copiar o contexto do projeto e da seleção. No Wendler, peça ao agente para abrir o projeto usando a conexão **imhotep**. O MCP oferece 14 ferramentas: projetos, páginas, árvore, nó, seleção, assets, grafo do protótipo, timeline, renderização, exportação, edição transacional e histórico/restauração.

A seleção das abas visíveis é atualizada pelo navegador. Cada aba tem sua própria identificação, e a presença expira após 90 segundos sem atualização; ela não cria revisões no documento. Com o navegador fechado, o agente continua trabalhando pelo documento persistido, sem inventar uma seleção ativa.

As operações diretas do Wendler passam pelo mesmo motor, revisão esperada e histórico da interface. Já o chat Kendrick continua produzindo propostas para revisão explícita antes de aplicar. O comparador mostra propriedades antes/depois a partir do snapshot original da proposta e identifica conflitos com edições posteriores.

## Protótipo e motion

- Arraste o círculo azul da seleção até um frame para criar uma conexão real. O inspetor permite editar ou excluir a conexão e mudar seu gatilho e transição.
- Crie vários fluxos nomeados, cada um com sua tela inicial. O preview permite trocar de fluxo, reiniciar e destacar hotspots.
- Gatilhos: clique, hover, saída do mouse, pressionar, soltar, tecla e atraso. Ações: navegar, voltar, abrir/fechar overlay e executar uma animação persistida.
- Animações referenciadas por interações aguardam seu gatilho. As demais iniciam ao abrir a tela correspondente. Atraso e duração da transição têm valores separados; documentos anteriores preservam seu comportamento.
- O mesmo runtime é incorporado ao HTML exportado: fluxos, navegação, teclado e motion funcionam offline. O runtime para de pedir frames quando não há animação em execução e respeita redução de movimento.
- O JSON [connected-flow](../examples/connected-flow.json) contém três telas, dois fluxos, teclado e animação por clique.

## Instalação nesta máquina

```bash
npm ci
npm run start:tailscale
# Em outro terminal, com o Wendler ativo:
npm run connect:wendler
```

O instalador usa a API de plugins do Wendler. Copia somente os dois módulos Node necessários ao MCP para o volume persistente `wendler-runtime/data/integrations/imhotep`, cadastra a conexão habilitada e confirma a descoberta pelo Codex do Wendler. Não altera outras conexões nem inclui credenciais. Pode ser executado novamente após atualizar as ferramentas.

Parâmetros: `--runtime /caminho/wendler-runtime`, `--api http://127.0.0.1:5274`, `--imhotep http://127.0.0.1:4173`, `--ui https://endereco-privado/`, `--data /caminho/dados-imhotep`. As APIs devem permanecer locais. Esta integração pressupõe rede host no contêiner Wendler, como nesta instalação.

Para inicialização automática em Linux com systemd de usuário:

```bash
npm run service:install
systemctl --user status imhotep
journalctl --user -u imhotep
```

Pare antes uma instância manual que esteja usando a porta. O serviço reinicia em caso de falha e aguarda o Tailscale por novas tentativas. Nesta máquina, o serviço está habilitado e `Linger=yes` já permite execução após logout. O banco e os backups continuam nos diretórios existentes. A configuração é um serviço do usuário, sem sudo.

## Verificação

```bash
npm test
npm run test:browser
npm run test:workbench
npm run test:interface
npm run test:persona
npm run test:flows
# Usa a conta e a cota reais do Wendler; cria/reutiliza somente o projeto demonstrativo:
npm run test:wendler
```

`test:flows` cobre criação por arraste, edição, fluxos, motion por clique e atraso, teclado, overlay por hover, fechar, voltar/reiniciar, exportação sem rede, seleção via MCP, comparação de proposta e persistência após reinício. Os testes comuns usam banco temporário. O teste do Wendler mantém o projeto de demonstração e registra sua identificação em `data/wendler-demo.json`.

Durante a integração, o executor Wendler estava sem acesso à conta (`workspace routing discovery unauthorized (401)`). O cache autorizado da mesma conta foi atualizado pelo método oficial de [autenticação headless/Docker](https://learn.chatgpt.com/docs/auth#fallback-authenticate-locally-and-copy-your-auth-cache), preservando a cópia anterior com permissão restrita. As credenciais ficam fora do repositório. Nenhuma troca de modelo ou alteração nas permissões dos agentes foi necessária.

O status detalhado do plano está em [PLAN_STATUS.md](PLAN_STATUS.md). Os limites de geometria, exportação responsiva e isolamento de usuários da versão anterior continuam descritos e não são removidos por esta integração.
