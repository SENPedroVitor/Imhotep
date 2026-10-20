import { backup, DatabaseSync } from "node:sqlite";
import { mkdir, readdir, stat, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import { assert } from "./document.js";
export class Backups {
  constructor(store, directory) {
    this.store = store;
    this.directory = resolve(directory);
    this.pending = null;
  }
  async list() {
    await mkdir(this.directory, { recursive: true });
    const names = (await readdir(this.directory)).filter((n) =>
      /^imhotep-[\w-]+\.sqlite$/.test(n),
    );
    return Promise.all(
      names
        .sort()
        .reverse()
        .map(async (name) => ({
          name,
          bytes: (await stat(join(this.directory, name))).size,
        })),
    );
  }
  async create() {
    if (this.pending) return this.pending;
    this.pending = this.run().finally(() => (this.pending = null));
    return this.pending;
  }
  async run() {
    await mkdir(this.directory, { recursive: true });
    const name = `imhotep-${new Date().toISOString().replace(/[^\dT]/g, "")}-${randomUUID().slice(0, 8)}.sqlite`;
    const file = join(this.directory, name);
    await backup(this.store.db, file);
    const check = new DatabaseSync(file, { readOnly: true });
    try {
      assert(
        check.prepare("PRAGMA integrity_check").get().integrity_check === "ok",
        "Backup não passou na verificação de integridade",
        500,
      );
    } finally {
      check.close();
    }
    return { name, verified: true };
  }
  async read(name) {
    assert(/^imhotep-[\w-]+\.sqlite$/.test(name), "Nome de backup inválido");
    assert(
      (await this.list()).some((b) => b.name === name),
      "Backup não encontrado",
      404,
    );
    return readFile(join(this.directory, name));
  }
  async close() {
    if (this.pending) await this.pending;
  }
}
