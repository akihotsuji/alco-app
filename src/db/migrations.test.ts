import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { is } from "drizzle-orm";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema.ts";
import { BOTTLE_STATUSES, DRINK_TYPES, PHOTO_KINDS } from "@/shared/constants.ts";

const migrationsDir = path.join(import.meta.dirname, "migrations");

const USER_SCOPED_TABLES = [
  "drink_logs",
  "my_drinks",
  "tasting_notes",
  "ai_usage",
  "legal_consents",
  "age_verifications",
];

const CELLAR_TABLES = [
  "cellars",
  "user_cellar_slots",
  "cellar_members",
  "cellar_invitations",
  "cellar_owner_transfers",
  "cellar_activity",
  "cellar_idempotency",
];

const APP_TABLES = [...USER_SCOPED_TABLES, "bottles", "photos"];

type Journal = { entries: { idx: number; tag: string }[] };

function readJournal(): Journal {
  return JSON.parse(readFileSync(path.join(migrationsDir, "meta", "_journal.json"), "utf8"));
}

function applyMigration(db: DatabaseSync, tag: string) {
  const sqlText = readFileSync(path.join(migrationsDir, `${tag}.sql`), "utf8");
  for (const statement of sqlText.split("--> statement-breakpoint")) {
    if (statement.trim() !== "") db.exec(statement);
  }
}

/**
 * D1 は各 statement を暗黙のトランザクションで実行し、`PRAGMA foreign_keys=OFF` を無視する。
 * 公式: https://developers.cloudflare.com/d1/sql-api/foreign-keys/
 */
function applyMigrationAsD1(db: DatabaseSync, tag: string) {
  const sqlText = readFileSync(path.join(migrationsDir, `${tag}.sql`), "utf8");
  for (const raw of sqlText.split("--> statement-breakpoint")) {
    const statement = raw.trim();
    if (statement === "") {
      continue;
    }
    if (/^PRAGMA\s+foreign_keys\s*=\s*OFF\s*;?$/i.test(statement)) {
      continue;
    }
    db.exec(statement);
  }
}

function applyThrough(db: DatabaseSync, lastExclusiveTag: string) {
  for (const entry of readJournal().entries) {
    if (entry.tag === lastExclusiveTag) {
      break;
    }
    applyMigration(db, entry.tag);
  }
}

function seedPreSharedCellar(db: DatabaseSync) {
  insertUser(db, "u1");
  db.prepare(
    `INSERT INTO bottles (id, user_id, name, drink_type, created_at, updated_at)
     VALUES ('b1', 'u1', 'Vosne', 'wine_red', ?, ?)`,
  ).run(NOW, NOW);
  db.prepare(
    `INSERT INTO photos (id, user_id, r2_key, content_type, byte_size, bottle_id, created_at, updated_at)
     VALUES ('p-bottle', 'u1', 'p-bottle.jpg', 'image/jpeg', 100, 'b1', ?, ?)`,
  ).run(NOW, NOW);
  db.prepare(
    `INSERT INTO photos (id, user_id, r2_key, content_type, byte_size, created_at, updated_at)
     VALUES ('p-loose', 'u1', 'p-loose.jpg', 'image/jpeg', 100, ?, ?)`,
  ).run(NOW, NOW);
  db.prepare(
    `INSERT INTO drink_logs (id, user_id, drunk_at, drunk_on, drink_type, volume_ml, abv_percent, alcohol_g, bottle_id, created_at, updated_at)
     VALUES ('l1', 'u1', ?, '2026-09-10', 'wine_red', 120, 13, 12.5, 'b1', ?, ?)`,
  ).run(NOW, NOW, NOW);
  db.prepare(
    `INSERT INTO tasting_notes (id, user_id, bottle_id, drink_name, drink_type, tasted_on, rating_x10, created_at, updated_at)
     VALUES ('n1', 'u1', 'b1', 'Vosne', 'wine_red', '2026-09-10', 40, ?, ?)`,
  ).run(NOW, NOW);
}

/** journal の順に全マイグレーション SQL を空の SQLite に適用する（wrangler d1 migrations apply の再現） */
function openMigratedDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON;");
  for (const entry of readJournal().entries) {
    applyMigration(db, entry.tag);
  }
  return db;
}

const NOW = 1_700_000_000_000;

function insertUser(db: DatabaseSync, id: string) {
  db.prepare("INSERT INTO user (id, name, email) VALUES (?, ?, ?)").run(
    id,
    "u",
    `${id}@example.com`,
  );
}

function insertMyDrink(db: DatabaseSync, id: string, userId: string) {
  db.prepare(
    "INSERT INTO my_drinks (id, user_id, name, drink_type, volume_ml, abv_percent, created_at, updated_at) VALUES (?, ?, 'いつもの', 'beer', 350, 5, ?, ?)",
  ).run(id, userId, NOW, NOW);
}

function insertPersonalCellar(db: DatabaseSync, userId: string, cellarId = `c-${userId}`) {
  const existing = db
    .prepare("SELECT personal_cellar_id AS id FROM user_cellar_slots WHERE user_id = ?")
    .get(userId) as { id: string } | undefined;
  if (existing) {
    return existing.id;
  }
  db.prepare(
    "INSERT INTO cellars (id, kind, name, owner_user_id, revision, created_at, updated_at) VALUES (?, 'personal', '自分のセラー', ?, 1, ?, ?)",
  ).run(cellarId, userId, NOW, NOW);
  db.prepare(
    "INSERT INTO cellar_members (id, cellar_id, user_id, joined_at) VALUES (?, ?, ?, ?)",
  ).run(`m-${cellarId}`, cellarId, userId, NOW);
  db.prepare(
    "INSERT INTO user_cellar_slots (user_id, personal_cellar_id, shared_cellar_id) VALUES (?, ?, NULL)",
  ).run(userId, cellarId);
  return cellarId;
}

function insertBottle(db: DatabaseSync, id: string, userId: string, drinkType = "wine") {
  const cellarId = insertPersonalCellar(db, userId);
  db.prepare(
    "INSERT INTO bottles (id, cellar_id, created_by, updated_by, version, name, drink_type, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)",
  ).run(id, cellarId, userId, userId, "b", drinkType, NOW, NOW);
}

function insertLog(
  db: DatabaseSync,
  id: string,
  userId: string,
  refs: { myDrinkId?: string; bottleId?: string } = {},
) {
  db.prepare(
    "INSERT INTO drink_logs (id, user_id, drunk_at, drunk_on, drink_type, volume_ml, abv_percent, alcohol_g, my_drink_id, bottle_id, created_at, updated_at) VALUES (?, ?, ?, '2026-01-01', 'beer', 350, 5, 14, ?, ?, ?, ?)",
  ).run(id, userId, NOW, refs.myDrinkId ?? null, refs.bottleId ?? null, NOW, NOW);
}

function insertNote(db: DatabaseSync, id: string, userId: string, bottleId: string | null) {
  db.prepare(
    "INSERT INTO tasting_notes (id, user_id, bottle_id, drink_name, drink_type, tasted_on, rating_x10, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(id, userId, bottleId, "n", "wine", "2026-01-01", 40, NOW, NOW);
}

function insertPhoto(
  db: DatabaseSync,
  id: string,
  userId: string,
  owner: { bottleId?: string; noteId?: string; logId?: string } = {},
) {
  const cellarId = owner.bottleId
    ? ((
        db.prepare("SELECT cellar_id AS id FROM bottles WHERE id = ?").get(owner.bottleId) as
          | { id: string }
          | undefined
      )?.id ?? null)
    : null;
  db.prepare(
    "INSERT INTO photos (id, user_id, cellar_id, uploaded_by, r2_key, content_type, byte_size, bottle_id, tasting_note_id, drink_log_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    id,
    owner.bottleId ? null : userId,
    cellarId,
    userId,
    `${id}.jpg`,
    "image/jpeg",
    100,
    owner.bottleId ?? null,
    owner.noteId ?? null,
    owner.logId ?? null,
    NOW,
    NOW,
  );
}

function count(db: DatabaseSync, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get() as { n: number };
  return row.n;
}

function photoIds(db: DatabaseSync): string[] {
  return (db.prepare("SELECT id FROM photos ORDER BY id").all() as { id: string }[]).map(
    (r) => r.id,
  );
}

describe("マイグレーション（src/db/migrations）", () => {
  it("journal の tag と SQL ファイルが 1:1 で一致し、idx が連番である", () => {
    const journal = readJournal();
    const sqlFiles = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.replace(/\.sql$/, ""))
      .sort();
    expect(journal.entries.map((e) => e.tag).sort()).toEqual(sqlFiles);
    expect(journal.entries.map((e) => e.idx)).toEqual(journal.entries.map((_, i) => i));
  });

  it("0002 は opened を sealed に直し opened_on を落とす", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
    applyMigration(db, "0000_init");
    applyMigration(db, "0001_better_auth_account_issuer");
    insertUser(db, "u1");
    db.prepare(
      "INSERT INTO bottles (id, user_id, name, drink_type, status, opened_on, created_at, updated_at) VALUES ('b1', 'u1', 'b', 'wine', 'opened', '2026-09-01', ?, ?)",
    ).run(NOW, NOW);
    applyMigration(db, "0002_bottles_drop_opened");
    const row = db.prepare("SELECT status FROM bottles WHERE id = 'b1'").get() as {
      status: string;
    };
    expect(row.status).toBe("sealed");
    const cols = db.prepare("PRAGMA table_info('bottles')").all() as { name: string }[];
    expect(cols.map((c) => c.name)).not.toContain("opened_on");
    db.close();
  });

  it("Auth 4 テーブル + アプリ / セラー / 削除処理テーブルが作成される", () => {
    const db = openMigratedDb();
    const rows = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    expect(rows.map((r) => r.name)).toEqual(
      [
        "account",
        "session",
        "user",
        "verification",
        ...APP_TABLES,
        ...CELLAR_TABLES,
        "account_deletion_photo_tasks",
        "account_deletion_records",
        "account_deletion_requests",
        "photo_object_reservations",
      ].sort(),
    );
    db.close();
  });
});

describe("0010_shared_cellar と D1 の外部キー", () => {
  it("同一接続なら PRAGMA foreign_keys=OFF が効き、ボトル写真と紐付けは残る", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
    applyThrough(db, "0010_shared_cellar");
    seedPreSharedCellar(db);
    applyMigration(db, "0010_shared_cellar");
    expect(photoIds(db)).toEqual(["p-bottle", "p-loose"]);
    expect(
      (db.prepare("SELECT bottle_id AS id FROM drink_logs WHERE id = 'l1'").get() as { id: string })
        .id,
    ).toBe("b1");
    expect(
      (
        db.prepare("SELECT bottle_id AS id FROM tasting_notes WHERE id = 'n1'").get() as {
          id: string;
        }
      ).id,
    ).toBe("b1");
    db.close();
  });

  it("D1 相当（foreign_keys=OFF 無効）では DROP bottles が CASCADE し、写真と記録・ノートの紐付けが消える", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON;");
    applyThrough(db, "0010_shared_cellar");
    seedPreSharedCellar(db);
    applyMigrationAsD1(db, "0010_shared_cellar");
    expect(photoIds(db)).toEqual(["p-loose"]);
    expect(db.prepare("SELECT id FROM photos WHERE id = 'p-bottle'").get()).toBeUndefined();
    expect(
      (db.prepare("SELECT id FROM bottles WHERE id = 'b1'").get() as { id: string } | undefined)
        ?.id,
    ).toBe("b1");
    expect(
      (
        db.prepare("SELECT bottle_id AS id FROM drink_logs WHERE id = 'l1'").get() as {
          id: string | null;
        }
      ).id,
    ).toBeNull();
    expect(
      (
        db.prepare("SELECT bottle_id AS id FROM tasting_notes WHERE id = 'n1'").get() as {
          id: string | null;
        }
      ).id,
    ).toBeNull();
    db.close();
  });

  it("0010 より後のマイグレーションは bottles / photos を CASCADE 付きのまま DROP しない", () => {
    let afterSharedCellar = false;
    for (const entry of readJournal().entries) {
      if (!afterSharedCellar) {
        afterSharedCellar = entry.tag === "0010_shared_cellar";
        continue;
      }
      const sqlText = readFileSync(path.join(migrationsDir, `${entry.tag}.sql`), "utf8");
      expect(sqlText, entry.tag).not.toMatch(/DROP TABLE `bottles`/i);
      expect(sqlText, entry.tag).not.toMatch(/DROP TABLE `photos`/i);
    }
  });
});

describe("Drizzle スキーマとマイグレーションの同期", () => {
  const tables: SQLiteTable[] = [];
  for (const exported of Object.values<unknown>(schema)) {
    if (is(exported, SQLiteTable)) tables.push(exported);
  }

  it("schema.ts の全テーブルについて列名・NOT NULL・インデックスが DB と一致する（generate 忘れ検知）", () => {
    const db = openMigratedDb();
    expect(tables.length).toBe(23);
    for (const table of tables) {
      const config = getTableConfig(table);
      const info = db.prepare(`PRAGMA table_info("${config.name}")`).all() as {
        name: string;
        notnull: number;
      }[];
      const dbColumns = new Map(info.map((c) => [c.name, c.notnull === 1]));
      const schemaColumns = new Map(config.columns.map((c) => [c.name, c.notNull]));
      expect(dbColumns, config.name).toEqual(schemaColumns);

      const dbIndexes = (
        db.prepare(`PRAGMA index_list("${config.name}")`).all() as {
          name: string;
          origin: string;
        }[]
      )
        // origin 'pk' は主キー用の自動インデックス。'c' が CREATE INDEX 由来
        .filter((i) => i.origin === "c")
        .map((i) => i.name)
        .sort();
      // 列の .unique() も drizzle-kit は CREATE UNIQUE INDEX として出力する
      const schemaIndexes = [
        ...config.indexes.map((i) => i.config.name),
        ...config.columns
          .filter((c) => c.isUnique)
          .map((c) => c.uniqueName ?? `${config.name}_${c.name}_unique`),
      ].sort();
      expect(dbIndexes, config.name).toEqual(schemaIndexes);
    }
    db.close();
  });

  it("created_at / updated_at の列ビルダーはテーブルごとに独立している", () => {
    const timestamped = [
      schema.myDrinks,
      schema.bottles,
      schema.drinkLogs,
      schema.tastingNotes,
      schema.photos,
    ];
    for (const table of timestamped) {
      const { name } = getTableConfig(table);
      expect(table.createdAt.uniqueName, `${name}.createdAt`).toBe(`${name}_created_at_unique`);
      expect(table.updatedAt.uniqueName, `${name}.updatedAt`).toBe(`${name}_updated_at_unique`);
    }
  });

  it("個人スコープのアプリテーブルに user_id があり user.id へ ON DELETE CASCADE の FK を持つ", () => {
    const db = openMigratedDb();
    for (const table of USER_SCOPED_TABLES) {
      const fks = db.prepare(`PRAGMA foreign_key_list("${table}")`).all() as {
        table: string;
        from: string;
        to: string;
        on_delete: string;
      }[];
      const userFk = fks.find((fk) => fk.from === "user_id");
      expect(userFk, table).toMatchObject({ table: "user", to: "id", on_delete: "CASCADE" });
    }
    db.close();
  });

  it("cellars.owner_user_id は RESTRICT、bottles は cellar_id CASCADE で user_id を持たない", () => {
    const db = openMigratedDb();
    const cellarFks = db.prepare("PRAGMA foreign_key_list('cellars')").all() as {
      from: string;
      on_delete: string;
    }[];
    expect(cellarFks.find((fk) => fk.from === "owner_user_id")?.on_delete).toBe("RESTRICT");
    const bottleCols = (db.prepare("PRAGMA table_info('bottles')").all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(bottleCols).not.toContain("user_id");
    expect(bottleCols).toContain("cellar_id");
    db.close();
  });

  it("削除処理テーブルは user CASCADE を持たない", () => {
    const db = openMigratedDb();
    for (const table of [
      "photo_object_reservations",
      "account_deletion_requests",
      "account_deletion_records",
      "account_deletion_photo_tasks",
    ]) {
      const fks = db.prepare(`PRAGMA foreign_key_list("${table}")`).all() as {
        table: string;
      }[];
      expect(
        fks.filter((fk) => fk.table === "user"),
        table,
      ).toEqual([]);
    }
    db.close();
  });
});

describe("制約の挙動", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = openMigratedDb();
    insertUser(db, "u1");
  });

  afterEach(() => {
    db.close();
  });

  it("drink_type は shared の 12 種を受け付け、それ以外は CHECK で拒否する", () => {
    for (const [i, type] of DRINK_TYPES.entries()) {
      expect(() => insertBottle(db, `b${i}`, "u1", type)).not.toThrow();
    }
    expect(() => insertBottle(db, "bad", "u1", "vodka")).toThrow(/CHECK/);
    expect(() => insertBottle(db, "bad", "u1", "Wine")).toThrow(/CHECK/);
  });

  it("bottles.status は 2 値のみ許可し、デフォルトは sealed", () => {
    insertBottle(db, "b1", "u1");
    const row = db.prepare("SELECT status FROM bottles WHERE id = 'b1'").get() as {
      status: string;
    };
    expect(row.status).toBe("sealed");
    for (const status of BOTTLE_STATUSES) {
      expect(() =>
        db.prepare("UPDATE bottles SET status = ? WHERE id = 'b1'").run(status),
      ).not.toThrow();
    }
    expect(() => db.prepare("UPDATE bottles SET status = 'opened' WHERE id = 'b1'").run()).toThrow(
      /CHECK/,
    );
    expect(() =>
      db.prepare("UPDATE bottles SET status = 'finished' WHERE id = 'b1'").run(),
    ).toThrow(/CHECK/);
  });

  it("photos.kind は photo / cutout のみ許可し、デフォルトは photo", () => {
    insertPhoto(db, "p1", "u1");
    const row = db.prepare("SELECT kind FROM photos WHERE id = 'p1'").get() as { kind: string };
    expect(row.kind).toBe("photo");
    for (const kind of PHOTO_KINDS) {
      expect(() =>
        db.prepare("UPDATE photos SET kind = ? WHERE id = 'p1'").run(kind),
      ).not.toThrow();
    }
    expect(() => db.prepare("UPDATE photos SET kind = 'svg' WHERE id = 'p1'").run()).toThrow(
      /CHECK/,
    );
  });

  it("photos の所有者 3 列は最大 1 つ。すべて NULL（未紐付け）は許可する", () => {
    insertBottle(db, "b1", "u1");
    insertNote(db, "n1", "u1", "b1");
    insertLog(db, "l1", "u1");
    expect(() => insertPhoto(db, "p-none", "u1")).not.toThrow();
    expect(() => insertPhoto(db, "p-bottle", "u1", { bottleId: "b1" })).not.toThrow();
    expect(() => insertPhoto(db, "p-note", "u1", { noteId: "n1" })).not.toThrow();
    expect(() => insertPhoto(db, "p-log", "u1", { logId: "l1" })).not.toThrow();
    expect(() => insertPhoto(db, "bad", "u1", { bottleId: "b1", noteId: "n1" })).toThrow(/CHECK/);
    expect(() => insertPhoto(db, "bad", "u1", { bottleId: "b1", logId: "l1" })).toThrow(/CHECK/);
    expect(() => insertPhoto(db, "bad", "u1", { noteId: "n1", logId: "l1" })).toThrow(/CHECK/);
    expect(() =>
      insertPhoto(db, "bad", "u1", { bottleId: "b1", noteId: "n1", logId: "l1" }),
    ).toThrow(/CHECK/);
  });

  it("photos.r2_key は UNIQUE", () => {
    insertPhoto(db, "p1", "u1");
    expect(() =>
      db
        .prepare(
          "INSERT INTO photos (id, user_id, r2_key, content_type, byte_size, created_at, updated_at) VALUES ('p2', 'u1', 'p1.jpg', 'image/jpeg', 1, ?, ?)",
        )
        .run(NOW, NOW),
    ).toThrow(/UNIQUE/);
  });

  it("ai_usage は (user_id, used_on) が主キーで、count のデフォルトは 0", () => {
    db.prepare("INSERT INTO ai_usage (user_id, used_on) VALUES ('u1', '2026-01-01')").run();
    const row = db.prepare("SELECT count FROM ai_usage").get() as { count: number };
    expect(row.count).toBe(0);
    expect(() =>
      db.prepare("INSERT INTO ai_usage (user_id, used_on) VALUES ('u1', '2026-01-01')").run(),
    ).toThrow(/UNIQUE|PRIMARY KEY/);
    expect(() =>
      db.prepare("INSERT INTO ai_usage (user_id, used_on) VALUES ('u1', '2026-01-02')").run(),
    ).not.toThrow();
  });

  it("my_drinks 削除で drink_logs.my_drink_id は SET NULL（ログは残る）", () => {
    insertMyDrink(db, "m1", "u1");
    insertLog(db, "l1", "u1", { myDrinkId: "m1" });
    db.prepare("DELETE FROM my_drinks WHERE id = 'm1'").run();
    const row = db.prepare("SELECT my_drink_id FROM drink_logs WHERE id = 'l1'").get() as {
      my_drink_id: string | null;
    };
    expect(row.my_drink_id).toBeNull();
  });

  it("bottles 削除で記録とノートは SET NULL、ボトル写真は CASCADE", () => {
    insertBottle(db, "b1", "u1");
    insertLog(db, "l1", "u1", { bottleId: "b1" });
    insertNote(db, "n1", "u1", "b1");
    insertPhoto(db, "p-bottle", "u1", { bottleId: "b1" });
    insertPhoto(db, "p-note", "u1", { noteId: "n1" });
    insertPhoto(db, "p-log", "u1", { logId: "l1" });
    db.prepare("DELETE FROM bottles WHERE id = 'b1'").run();
    const log = db.prepare("SELECT bottle_id FROM drink_logs WHERE id = 'l1'").get() as {
      bottle_id: string | null;
    };
    const note = db.prepare("SELECT bottle_id FROM tasting_notes WHERE id = 'n1'").get() as {
      bottle_id: string | null;
    };
    expect(log.bottle_id).toBeNull();
    expect(note.bottle_id).toBeNull();
    expect(photoIds(db)).toEqual(["p-log", "p-note"]);
  });

  it("tasting_notes / drink_logs 削除でそれぞれの写真は CASCADE", () => {
    insertNote(db, "n1", "u1", null);
    insertLog(db, "l1", "u1");
    insertPhoto(db, "p-note", "u1", { noteId: "n1" });
    insertPhoto(db, "p-log", "u1", { logId: "l1" });
    db.prepare("DELETE FROM tasting_notes WHERE id = 'n1'").run();
    expect(photoIds(db)).toEqual(["p-log"]);
    db.prepare("DELETE FROM drink_logs WHERE id = 'l1'").run();
    expect(photoIds(db)).toEqual([]);
  });

  it("存在しない user の個人セラーは FK で拒否する", () => {
    expect(() => insertBottle(db, "b1", "ghost")).toThrow(/FOREIGN KEY/);
  });

  it("オーナーが残っている個人セラーがあると user 削除は RESTRICT で失敗する", () => {
    insertBottle(db, "b1", "u1");
    expect(() => db.prepare("DELETE FROM user WHERE id = 'u1'").run()).toThrow(/FOREIGN KEY/);
  });

  it("個人セラーを消してから user を消すと個人データは消え、共有ボトルと写真は残る", () => {
    insertUser(db, "u2");
    insertMyDrink(db, "m-u1", "u1");
    insertBottle(db, "b-u1", "u1");
    insertLog(db, "l-u1", "u1", { myDrinkId: "m-u1", bottleId: "b-u1" });
    insertNote(db, "n-u1", "u1", "b-u1");
    insertPhoto(db, "p-u1", "u1", { bottleId: "b-u1" });
    insertPhoto(db, "p-note", "u1", { noteId: "n-u1" });
    const sharedId = "shared-1";
    db.prepare(
      "INSERT INTO cellars (id, kind, name, owner_user_id, revision, created_at, updated_at) VALUES (?, 'shared', 'ふたりのセラー', ?, 1, ?, ?)",
    ).run(sharedId, "u2", NOW, NOW);
    db.prepare(
      "INSERT INTO cellar_members (id, cellar_id, user_id, joined_at) VALUES (?, ?, ?, ?)",
    ).run("sm-u2", sharedId, "u2", NOW);
    db.prepare(
      "INSERT INTO cellar_members (id, cellar_id, user_id, joined_at) VALUES (?, ?, ?, ?)",
    ).run("sm-u1", sharedId, "u1", NOW);
    db.prepare(
      "INSERT INTO bottles (id, cellar_id, created_by, updated_by, version, name, drink_type, created_at, updated_at) VALUES ('b-shared', ?, 'u1', 'u1', 1, '共有瓶', 'wine', ?, ?)",
    ).run(sharedId, NOW, NOW);
    insertPhoto(db, "p-shared", "u1", { bottleId: "b-shared" });

    const personalId = (
      db
        .prepare("SELECT personal_cellar_id AS id FROM user_cellar_slots WHERE user_id = 'u1'")
        .get() as {
        id: string;
      }
    ).id;
    db.prepare("DELETE FROM cellar_members WHERE user_id = 'u1' AND cellar_id = ?").run(sharedId);
    db.prepare("DELETE FROM cellars WHERE id = ?").run(personalId);
    db.prepare("DELETE FROM user WHERE id = 'u1'").run();

    expect(count(db, "user")).toBe(1);
    expect(
      (
        db.prepare("SELECT id FROM bottles WHERE id = 'b-shared'").get() as
          | { id: string }
          | undefined
      )?.id,
    ).toBe("b-shared");
    expect(
      (
        db.prepare("SELECT id FROM photos WHERE id = 'p-shared'").get() as
          | { id: string }
          | undefined
      )?.id,
    ).toBe("p-shared");
    expect(db.prepare("SELECT id FROM bottles WHERE id = 'b-u1'").get()).toBeUndefined();
    expect(db.prepare("SELECT id FROM photos WHERE id = 'p-note'").get()).toBeUndefined();
  });
});
