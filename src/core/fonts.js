import { readFileSync } from "node:fs";
import { layoutDocument } from "../../public/renderer.js";
import * as fontkit from "fontkit";
import { escapeXml } from "../../public/renderer.js";
import { assert } from "./document.js";
const builtins = new Map(
  ["Inter", "Manrope", "JetBrainsMono"].map((name) => [
    name === "JetBrainsMono" ? "JetBrains Mono" : name,
    fontkit.create(
      readFileSync(
        new URL(`../../public/fonts/${name}.woff2`, import.meta.url),
      ),
    ),
  ]),
);
// Font data remains part of the document; no arbitrary filesystem paths are accepted.
export function outlineFonts(document) {
  const doc = layoutDocument(document),
    fonts = new Map(builtins);
  for (const f of doc.fonts || []) {
    try {
      fonts.set(
        f.id,
        fontkit.create(Buffer.from(f.data.split(",")[1], "base64")),
      );
    } catch {
      assert(false, `Arquivo de fonte inválido: ${f.name}`);
    }
  }
  for (const n of doc.nodes) {
    if (n.type !== "text" || !fonts.has(n.fontFamily)) continue;
    const base = fonts.get(n.fontFamily);
    const font = base,
      scale = (n.fontSize || 16) / font.unitsPerEm;
    let paths = [];
    for (const [lineIndex, line] of (n.text || "").split("\n").entries()) {
      const run = font.layout(line);
      let x = 0,
        y = (n.fontSize || 16) + lineIndex * (n.fontSize || 16) * 1.4;
      run.glyphs.forEach((glyph, index) => {
        const p = run.positions[index];
        paths.push(
          `<path d="${escapeXml(glyph.path.toSVG())}" transform="translate(${x + p.xOffset * scale} ${y - p.yOffset * scale}) scale(${scale} ${-scale})" fill="${escapeXml(n.fill || "#242735")}"/>`,
        );
        x += p.xAdvance * scale;
      });
    }
    n.fontOutline = paths.join("");
  }
  return doc;
}
