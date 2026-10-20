# Imhotep 0.4 — vetores editáveis e código responsivo

Esta entrega conclui as três pendências citadas na entrega anterior: operações booleanas, edição gráfica de nós/alças Bézier e exportação responsiva. Todas passam pelo documento persistido, com validação, revisão esperada e histórico.

## Geometria

Selecione duas ou mais formas com Shift. Na seção **Geometria** do inspetor, use **Unir**, **Subtrair**, **Intersectar** ou **Excluir sobreposição**. Na subtração, a primeira forma selecionada é a base. Retângulos, elipses e paths fechados podem ser combinados quando pertencem ao mesmo pai e página. O resultado é um path editável, incluindo contornos separados e furos. Uma operação com resultado vazio preserva os originais e informa o motivo. Instâncias e geometria compartilhada por componentes precisam ser desvinculadas antes de combinar, para preservar referências.

**Editar nós e alças** converte a geometria em curvas normalizadas e abre os controles no canvas. Arraste âncoras e alças; Shift espelha a alça oposta. Os botões inserem um nó por subdivisão da curva, suavizam/convertem um nó em canto e excluem nós respeitando o mínimo do contorno. Cada arraste concluído gera uma única operação; atualização concorrente cancela o arraste. Dimensões de referência preservam a escala dos paths ao redimensionar.

O motor usa as [operações geométricas do Paper.js](https://paperjs.org/reference/pathitem/). A interface de nós usa o mesmo path persistido; nenhuma edição depende de manter o navegador aberto. `boolean_nodes {ids,id,operation:unite|subtract|intersect|exclude}` e `normalize_path {id}` também estão disponíveis em lotes da CLI/MCP e propostas do Kendrick.

## Layout e exportação

O inspetor inclui constraints horizontais/verticais, quebra de linha no auto layout, recorte do frame e escolha de elemento HTML. Constraints são aplicados também ao redimensionar frames no motor; o renderizador headless usa a mesma distribuição de auto layout e wrapping.

O Dev Mode oferece:

- **HTML responsivo:** elementos nativos, fontes locais incorporadas, auto layout em flexbox, wrapping e constraints em CSS; inclui o runtime de navegação e motion suportados e funciona sem rede.
- **React / TSX:** componente visual semântico com estilos e fontes incorporados, exportando o frame/componente selecionado ou o primeiro frame. Não envolve a tela inteira em um único SVG.
- **Tailwind / TSX:** mesma estrutura semântica com utilitários Tailwind para a estrutura; geometria e estilos específicos permanecem explícitos. Não exige inferir tokens inexistentes.

Paths e ícones continuam vetoriais em SVG dentro do HTML/React, preservando curvas e furos. Texto, frames e botões são elementos nativos. O autor define responsividade usando auto layout/constraints: posicionamento livre sem regras continua seguindo suas coordenadas. Componentes React/Tailwind são visuais; eventos e motion executáveis são exportados no HTML. CSS global do documento não é injetado na página consumidora do componente React.

O preview/export de protótipo SVG continua disponível na seção **Protótipo**. A CLI `export projeto arquivo.html` passa a gerar o HTML semântico responsivo; `.tsx` gera React. `export_code` no MCP aceita `html`, `react` e `tailwind`, com `frameId` opcional. HTML seleciona frames raiz; React/Tailwind também exportam componentes internos.

## Evidências

```bash
npm test
npm run test:design
npm run test:browser
npm run test:workbench
npm run test:flows
npm run test:interface
npm run test:persona
```

Os testes de geometria rasterizam as quatro booleanas e verificam pixels em áreas exclusivas e sobrepostas; também verificam coordenadas e subdivisão Bézier. Os de layout verificam constraints aninhados, wrapping e clipping. O teste de navegador cria uma booleana, desfaz, arrasta uma alça, insere um nó e reabre o documento; depois executa o HTML sem rede em 1000 e 390 pixels, verifica reflow e navegação, compila React/Tailwind TSX e baixa o HTML pela interface.

Arquivos de conferência ficam em `artifacts/vector-handles.png`, `artifacts/responsive-1000.png` e `artifacts/responsive-390.png`. O roteiro de longo prazo continua distinguido das entregas verificadas em [PLAN_STATUS.md](PLAN_STATUS.md).
