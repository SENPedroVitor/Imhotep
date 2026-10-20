# Mapeamento do design Imhotep

Fonte: `design/Imhotep.pen`, formato 2.19. Inventário estrutural; a fidelidade visual ainda precisa de verificação por renderização.

## Telas e referências

| ID | Tela | Dimensões |
| --- | --- | --- |
| bi8Au | 01 · Design Studio — Design / Refined | 1440 × 900 |
| fYiPq | 02 · Design Studio — Dev inspection | 1440 × 900 |
| CNLLv | 03 · Design Studio — Motion Studio | 1440 × 900 |
| lvTpW | 04 · Design Studio — AI Workspace | 1440 × 900 |
| GTnvH | 05 · Design Studio — Local libraries | 1440 × 900 |
| JSIrU | 06 · Design Studio — Server projects | 1440 × 900 |
| v8PtF | 07 · Design Studio — Vector editing | 1440 × 900 |
| n5Y6q | 08 · Design Studio — Light / Refined | 1440 × 900 |
| yXe4I | 00 · Studio — Reusable controls | 1440 × 450 |
| q8t7wG | 09 · Início — Escolher canvas | 1440 × 900 |
| N6S6G | 10 · Conectar agentes de IA — Configuração local | 1440 × 900 |
| ebgR0 | 11 · Criar canvas e projeto / Refined | 1440 × 900 |
| PciLD | 12 · Conectar servidor Linux / Refined | 1440 × 900 |
| E4cHLM | 13 · Agentes — Sessões e estados / Refined | 1440 × 900 |
| HZ8v8 | 14 · Revisar alterações da IA / Refined | 1440 × 900 |
| PWBUK | 15 · Configurações do workspace / Refined | 1440 × 900 |
| t3v3z | 16 · Editor de componentes e variantes / Refined | 1440 × 900 |
| mhxwL | 17 · Variáveis e design tokens / Refined | 1440 × 900 |
| uD5Av | 18 · Fontes e recursos locais / Refined | 1440 × 900 |
| iWQw7 | 19 · Prototipação e preview / Refined | 1440 × 900 |
| S8YHN | 20 · Exportação de código e assets / Refined | 1440 × 900 |
| G4r6x | 21 · Histórico e restauração / Refined | 1440 × 900 |
| PpnvA | 22 · Resolver conflitos de edição / Refined | 1440 × 900 |
| ILxcM | 23 · Recuperação — Servidor offline / Refined | 1440 × 900 |
| bnk2r | 24 · Canvas vazio — Primeiro frame / Refined | 1440 × 900 |
| b4iN0 | 25 · Carregamento — Abrindo projeto / Refined | 1440 × 900 |
| c8NkIb | 26 · Segurança — Acesso negado / Refined | 1440 × 900 |
| v7Ecor | 27 · Agente — CLI não encontrada / Refined | 1440 × 900 |
| wDR2F | 28 · Recursos — Arquivo ausente / Refined | 1440 × 900 |
| pI5kS | 29 · Chat no canvas / Refined | 1440 × 900 |
| lUM6o | Kendrick · Persona IA e expressões | 1600 × 1540 |

## Recursos externos referenciados

- `Imhotep-assets/claude.png`
- `Imhotep-assets/neutral.png`
- `Imhotep-assets/openai.png`
- `Imhotep-assets/opencode.png`

Esses arquivos não acompanham o anexo recebido. Preservar os caminhos relativos ao arquivo `.pen`.

## Tipografia

Inter, Manrope e JetBrains Mono. Os arquivos de fontes e suas licenças ainda precisam ser verificados.

## Tokens

- `studio-bg`: `#17181B`
- `studio-panel`: `#202125`
- `studio-accent`: `#328BFF`
- `studio-text`: `#ECEEF2`
- `studio-muted`: `#9699A3`
- `studio-stroke`: `#323338`
- `studio-font`: `Inter`

## Componentes reutilizáveis

14 definições marcadas como reutilizáveis no documento.

## Sequência proposta

1. Conferir recursos e renderizar as telas existentes para validar a referência visual.
2. Implementar o núcleo de documento, operações validadas, persistência e renderização headless com CLI/MCP.
3. Conectar a interface existente ao núcleo e sincronizar operações reais.

O arquivo de design contém estados de interface e conteúdo ilustrativo; isso não comprova integrações ou funcionalidades implementadas.
