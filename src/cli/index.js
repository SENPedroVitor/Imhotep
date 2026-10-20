#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { request, baseUrl } from "./client.js";
try {
  const [command, projectId, ...args] = process.argv.slice(2);
  let result;
  if (command === "projects" && projectId === "list")
    result = await request("/api/projects");
  else if (command === "create")
    result = await request("/api/projects", {
      name: [projectId, ...args].join(" "),
    });
  else if (command === "inspect")
    result = await request(`/api/projects/${encodeURIComponent(projectId)}`);
  else if (command === "history")
    result = await request(
      `/api/projects/${encodeURIComponent(projectId)}/history`,
    );
  else if (command === "validate") {
    const { validateDocument } = await import("../core/document.js");
    validateDocument(JSON.parse(await readFile(projectId, "utf8")));
    result = { valid: true };
  } else if (command === "apply") {
    const payload = JSON.parse(await readFile(args[0], "utf8"));
    result = await request(
      `/api/projects/${encodeURIComponent(projectId)}/operations`,
      payload,
    );
  } else if (command === "restore") {
    if (!args[1])
      throw new Error("Uso: restore <projeto> <revisão alvo> <revisão atual>");
    result = await request(
      `/api/projects/${encodeURIComponent(projectId)}/restore`,
      {
        restoreRevision: Number(args[0]),
        baseRevision: Number(args[1]),
        operationId: randomUUID(),
        author: process.env.IMHOTEP_AUTHOR || "cli",
      },
    );
  } else if (command === "export") {
    const output = args[0];
    if (!output || !/[.](html|tsx)$/.test(output))
      throw new Error("Informe destino .html ou .tsx");
    const response = await fetch(
      `${baseUrl()}/api/projects/${encodeURIComponent(projectId)}/code?format=${output.endsWith(".tsx") ? "react" : "html"}`,
    );
    if (!response.ok) throw new Error((await response.json()).error);
    await writeFile(output, await response.text());
    result = { output };
  } else if (command === "backup" && projectId === "create")
    result = await request("/api/backups", {});
  else if (command === "timeline")
    result = (await request(`/api/projects/${encodeURIComponent(projectId)}`))
      .document.animations;
  else if (command === "prototype")
    result = (await request(`/api/projects/${encodeURIComponent(projectId)}`))
      .document.interactions;
  else if (command === "render") {
    const output = args[0];
    if (!output || !/\.(png|svg)$/.test(output))
      throw new Error("Informe destino .png ou .svg");
    const format = output.endsWith(".png") ? "png" : "svg";
    const query = new URLSearchParams({ format });
    if (args[1]) query.set("frame", args[1]);
    const res = await fetch(
      `${baseUrl()}/api/projects/${encodeURIComponent(projectId)}/render?${query}`,
    );
    if (!res.ok) throw new Error((await res.json()).error);
    await writeFile(output, Buffer.from(await res.arrayBuffer()));
    result = { output };
  } else
    throw new Error(
      "Comandos: projects list | create <nome> | inspect <id> | apply <id> <pedido.json> | render <id> <arquivo.png|svg> [frame] | history <id> | restore <id> <alvo> <atual> | validate <documento.json>",
    );
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
