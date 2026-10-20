import { assert } from "../core/document.js";

// Selection is ephemeral presence, never a document revision. Each tab owns a lease.
export class Presence {
  constructor() {
    this.clients = new Map();
  }
  prune() {
    const cutoff = Date.now() - 90000;
    for (const [id, entry] of this.clients)
      if (entry.updatedAt < cutoff) this.clients.delete(id);
  }
  update(project, input) {
    this.prune();
    assert(/^[\w-]{1,100}$/.test(input.clientId || ""), "Cliente inválido");
    assert(
      project.document.pages.some((p) => p.id === input.pageId),
      "Página inválida",
    );
    assert(
      Array.isArray(input.nodeIds) &&
        input.nodeIds.length <= 200 &&
        new Set(input.nodeIds).size === input.nodeIds.length &&
        input.nodeIds.every((id) =>
          project.document.nodes.some(
            (n) => n.id === id && n.pageId === input.pageId,
          ),
        ),
      "Seleção inválida",
    );
    assert(
      this.clients.has(input.clientId) || this.clients.size < 100,
      "Limite de clientes ativos",
      429,
    );
    const entry = {
      clientId: input.clientId,
      projectId: project.id,
      pageId: input.pageId,
      nodeIds: input.nodeIds,
      updatedAt: Date.now(),
    };
    this.clients.set(input.clientId, entry);
    return entry;
  }
  list(project) {
    this.prune();
    return [...this.clients.values()]
      .filter((c) => c.projectId === project.id)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((c) => ({
        ...c,
        nodeIds: c.nodeIds.filter((id) =>
          project.document.nodes.some((n) => n.id === id),
        ),
        nodes: project.document.nodes.filter((n) => c.nodeIds.includes(n.id)),
      }));
  }
}
