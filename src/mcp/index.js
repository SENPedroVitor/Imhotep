#!/usr/bin/env node
// MCP stdio adapter: newline-delimited JSON-RPC, all writes use the server API.
import { createInterface } from "node:readline";
import { request, baseUrl } from "../cli/client.js";
const projectSchema = {
  type: "string",
  description: "ID do projeto autorizado neste servidor local",
};
const tools = [
  ...[
    "list_pages",
    "get_prototype_graph",
    "get_animation_timeline",
    "list_assets",
  ].map((name) => ({
    name,
    description: {
      list_pages: "Lista páginas do projeto",
      get_prototype_graph: "Consulta conexões e transições persistidas",
      get_animation_timeline: "Consulta animações e keyframes persistidos",
      list_assets: "Lista imagens, vetores, ícones e fontes locais",
    }[name],
    inputSchema: {
      type: "object",
      properties: { projectId: projectSchema },
      required: ["projectId"],
      additionalProperties: false,
    },
  })),

  {
    name: "list_projects",
    description: "Lista projetos persistidos no servidor",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "get_document_tree",
    description: "Consulta documento e revisão atual",
    inputSchema: {
      type: "object",
      properties: { projectId: projectSchema },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "get_revision_history",
    description: "Consulta autoria e revisões",
    inputSchema: {
      type: "object",
      properties: { projectId: projectSchema },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "render_frame",
    description: "Renderiza documento ou frame em SVG ou PNG sem navegador",
    inputSchema: {
      type: "object",
      properties: {
        projectId: projectSchema,
        frameId: { type: "string" },
        format: { type: "string", enum: ["svg", "png"] },
      },
      required: ["projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "apply_patch",
    description:
      "Aplica lote transacional. Exige revisão atual, autoria e ID idempotente. Operações: create_node {node}, update_node {id,changes}, delete_node {id}, rename_project {name}, set_project_data {field:pages|tokens|interactions|animations|fonts,value}, create_component {id}, instantiate_component {componentId,id,pageId,x,y}, reorder_node {id,index}, rename_page {id,name}, delete_page {id}.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: projectSchema,
        baseRevision: { type: "integer", minimum: 0 },
        operationId: { type: "string" },
        author: { type: "string" },
        operations: {
          type: "array",
          minItems: 1,
          maxItems: 200,
          items: { type: "object" },
        },
      },
      required: [
        "projectId",
        "baseRevision",
        "operationId",
        "author",
        "operations",
      ],
      additionalProperties: false,
    },
  },
  {
    name: "restore_revision",
    description: "Restaura snapshot como nova revisão preservando histórico",
    inputSchema: {
      type: "object",
      properties: {
        projectId: projectSchema,
        baseRevision: { type: "integer" },
        restoreRevision: { type: "integer" },
        operationId: { type: "string" },
        author: { type: "string" },
      },
      required: [
        "projectId",
        "baseRevision",
        "restoreRevision",
        "operationId",
        "author",
      ],
      additionalProperties: false,
    },
  },
];
async function call(name, args) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) throw new Error("Ferramenta desconhecida");
  if (!args || typeof args !== "object" || Array.isArray(args))
    throw new Error("Argumentos inválidos");
  for (const k of tool.inputSchema.required ?? [])
    if (!(k in args)) throw new Error(`Falta ${k}`);
  for (const k of Object.keys(args))
    if (!(k in tool.inputSchema.properties))
      throw new Error(`Argumento inválido: ${k}`);
  const path = `/api/projects/${encodeURIComponent(args.projectId)}`;
  if (name === "list_projects")
    return {
      content: [
        { type: "text", text: JSON.stringify(await request("/api/projects")) },
      ],
    };
  if (name === "render_frame") {
    const query = new URLSearchParams({ format: args.format || "svg" });
    if (args.frameId) query.set("frame", args.frameId);
    const res = await fetch(`${baseUrl()}${path}/render?${query}`);
    if (!res.ok) throw new Error((await res.json()).error);
    if (args.format === "png")
      return {
        content: [
          {
            type: "image",
            data: Buffer.from(await res.arrayBuffer()).toString("base64"),
            mimeType: "image/png",
          },
        ],
      };
    return { content: [{ type: "text", text: await res.text() }] };
  }
  if (
    [
      "list_pages",
      "get_prototype_graph",
      "get_animation_timeline",
      "list_assets",
    ].includes(name)
  ) {
    const { document } = await request(path);
    const value =
      name === "list_pages"
        ? document.pages
        : name === "get_prototype_graph"
          ? document.interactions
          : name === "get_animation_timeline"
            ? document.animations
            : {
                nodes: document.nodes.filter((n) =>
                  ["image", "path", "icon"].includes(n.type),
                ),
                fonts: (document.fonts || []).map(({ data, ...font }) => font),
              };
    return { content: [{ type: "text", text: JSON.stringify(value) }] };
  }
  let result;
  if (name === "get_document_tree") result = await request(path);
  if (name === "get_revision_history")
    result = await request(`${path}/history`);
  if (name === "apply_patch" || name === "restore_revision") {
    const { projectId, ...body } = args;
    result = await request(
      `${path}/${name === "apply_patch" ? "operations" : "restore"}`,
      body,
    );
  }
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
}
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  let msg;
  try {
    msg = JSON.parse(line);
    if (msg.id === undefined) continue;
    let result;
    if (msg.method === "initialize") {
      const version = msg.params?.protocolVersion;
      result = {
        protocolVersion: ["2024-11-05", "2025-03-26", "2025-06-18"].includes(
          version,
        )
          ? version
          : "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "imhotep", version: "0.1.0" },
      };
    } else if (msg.method === "ping") result = {};
    else if (msg.method === "tools/list") result = { tools };
    else if (msg.method === "tools/call") {
      try {
        result = await call(msg.params.name, msg.params.arguments ?? {});
      } catch (e) {
        result = {
          isError: true,
          content: [{ type: "text", text: e.message }],
        };
      }
    } else {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: msg.id,
          error: { code: -32601, message: "Método desconhecido" },
        }) + "\n",
      );
      continue;
    }
    process.stdout.write(
      JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }) + "\n",
    );
  } catch (e) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: msg?.id ?? null,
        error: { code: -32700, message: "JSON-RPC inválido" },
      }) + "\n",
    );
  }
}
