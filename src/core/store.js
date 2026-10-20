import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import {
  AppError,
  assert,
  id,
  validateDocument,
  applyOperations,
  blankDocument,
} from "./document.js";
export class Store {
  constructor(directory = process.env.IMHOTEP_DATA_DIR || "./data") {
    const path = resolve(directory, "imhotep.sqlite");
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    const version = this.db.prepare("PRAGMA user_version").get().user_version;
    if (version > 1) {
      this.db.close();
      throw new AppError("Banco pertence a uma versão mais recente do Imhotep");
    }
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;",
    );
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,revision INTEGER NOT NULL,document TEXT NOT NULL,updatedAt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS revisions(projectId TEXT NOT NULL,revision INTEGER NOT NULL,document TEXT NOT NULL,author TEXT NOT NULL,operationId TEXT NOT NULL,fingerprint TEXT NOT NULL,summary TEXT NOT NULL,createdAt TEXT NOT NULL,PRIMARY KEY(projectId,revision),UNIQUE(projectId,operationId)); PRAGMA user_version=1;`);
  }
  list() {
    return this.db
      .prepare(
        "SELECT id,name,revision,updatedAt FROM projects ORDER BY updatedAt DESC",
      )
      .all();
  }
  get(projectId) {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE id=?")
      .get(projectId);
    assert(row, "Projeto não encontrado", 404);
    return { ...row, document: JSON.parse(row.document) };
  }
  create(name, document) {
    const doc = validateDocument(document ?? blankDocument(name));
    const projectId = id(),
      now = new Date().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("INSERT INTO projects VALUES(?,?,?,?,?)")
        .run(projectId, doc.name, 0, JSON.stringify(doc), now);
      this.db
        .prepare("INSERT INTO revisions VALUES(?,?,?,?,?,?,?,?)")
        .run(
          projectId,
          0,
          JSON.stringify(doc),
          "system",
          id(),
          "initial",
          "Projeto criado",
          now,
        );
      this.db.exec("COMMIT");
      return this.get(projectId);
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  history(projectId) {
    this.get(projectId);
    return this.db
      .prepare(
        "SELECT revision,author,operationId,summary,createdAt FROM revisions WHERE projectId=? ORDER BY revision DESC LIMIT 100",
      )
      .all(projectId);
  }
  mutate(projectId, request) {
    assert(request && typeof request === "object", "Pedido inválido");
    const { baseRevision, operationId, author, operations, restoreRevision } =
      request;
    assert(
      Number.isInteger(baseRevision) && baseRevision >= 0,
      "Revisão obrigatória",
    );
    assert(
      typeof operationId === "string" && /^[\w-]{1,100}$/.test(operationId),
      "ID de operação inválido",
    );
    assert(
      typeof author === "string" && author.trim() && author.length <= 100,
      "Autor obrigatório",
    );
    assert(
      (operations !== undefined) !== (restoreRevision !== undefined),
      "Informe operações ou revisão para restaurar",
    );
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({ baseRevision, author, operations, restoreRevision }),
      )
      .digest("hex");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const previous = this.db
        .prepare(
          "SELECT fingerprint,document,revision FROM revisions WHERE projectId=? AND operationId=?",
        )
        .get(projectId, operationId);
      if (previous) {
        assert(
          previous.fingerprint === fingerprint,
          "ID de operação reutilizado com outro conteúdo",
          409,
        );
        this.db.exec("COMMIT");
        return {
          projectId,
          revision: previous.revision,
          document: JSON.parse(previous.document),
          author,
          operationId,
          replayed: true,
        };
      }
      const project = this.get(projectId);
      assert(
        project.revision === baseRevision,
        "O projeto mudou. Recarregue antes de editar.",
        409,
      );
      let doc;
      if (restoreRevision !== undefined) {
        assert(
          Number.isInteger(restoreRevision) && restoreRevision >= 0,
          "Revisão de restauração inválida",
        );
        const row = this.db
          .prepare(
            "SELECT document FROM revisions WHERE projectId=? AND revision=?",
          )
          .get(projectId, restoreRevision);
        assert(row, "Revisão não encontrada", 404);
        doc = validateDocument(JSON.parse(row.document));
      } else doc = applyOperations(project.document, operations);
      const revision = project.revision + 1,
        now = new Date().toISOString(),
        json = JSON.stringify(doc);
      const summary =
        restoreRevision !== undefined
          ? `Restaurada revisão ${restoreRevision}`
          : operations.map((op) => op.type).join(", ");
      this.db
        .prepare(
          "UPDATE projects SET name=?,revision=?,document=?,updatedAt=? WHERE id=?",
        )
        .run(doc.name, revision, json, now, projectId);
      this.db
        .prepare("INSERT INTO revisions VALUES(?,?,?,?,?,?,?,?)")
        .run(
          projectId,
          revision,
          json,
          author,
          operationId,
          fingerprint,
          summary,
          now,
        );
      this.db.exec("COMMIT");
      return {
        projectId,
        revision,
        document: doc,
        author,
        operationId,
        summary,
        createdAt: now,
        replayed: false,
      };
    } catch (e) {
      this.db.exec("ROLLBACK");
      if (e instanceof AppError) throw e;
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
