import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.join(import.meta.dirname, "../..");
const wranglerSource = readFileSync(path.join(repoRoot, "wrangler.jsonc"), "utf8");

function parseJsonc(source: string): unknown {
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped) as unknown;
}

type D1Binding = {
  binding: string;
  database_name: string;
  database_id: string;
  migrations_dir: string;
};

type R2Binding = {
  binding: string;
  bucket_name: string;
};

type WranglerEnv = {
  name: string;
  ai?: { binding: string };
  d1_databases?: D1Binding[];
  r2_buckets?: R2Binding[];
  triggers?: { crons?: string[] };
};

type WranglerConfig = {
  name: string;
  d1_databases?: D1Binding[];
  r2_buckets?: R2Binding[];
  env: {
    dev: WranglerEnv;
    production: WranglerEnv;
  };
};

const wrangler = parseJsonc(wranglerSource) as WranglerConfig;

const SECRET_KEY_PATTERN =
  /better_auth|api[_-]?token|password|private[_-]?key|secret/i;

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }
    return keys;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      keys.push(key);
      collectKeys(nested, keys);
    }
  }
  return keys;
}

describe("wrangler.jsonc env split", () => {
  it("keeps top-level free of D1 and R2 so bare deploy is not prod or dev", () => {
    expect(wrangler.name).toBe("alco-app");
    expect(wrangler.d1_databases).toBeUndefined();
    expect(wrangler.r2_buckets).toBeUndefined();
  });

  it("points env.dev and env.production at different Worker, D1, and R2 names", () => {
    const { dev, production } = wrangler.env;

    expect(dev.name).toBe("alco-app-dev");
    expect(production.name).toBe("alco-app-prod");

    expect(dev.d1_databases).toHaveLength(1);
    expect(production.d1_databases).toHaveLength(1);
    const devDb = dev.d1_databases?.[0];
    const prodDb = production.d1_databases?.[0];
    expect(devDb?.binding).toBe("DB");
    expect(prodDb?.binding).toBe("DB");
    expect(devDb?.database_name).toBe("alco-app-dev");
    expect(prodDb?.database_name).toBe("alco-app-prod");
    expect(devDb?.migrations_dir).toBe("src/db/migrations");
    expect(prodDb?.migrations_dir).toBe("src/db/migrations");
    expect(devDb?.database_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(prodDb?.database_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(prodDb?.database_id).not.toBe(devDb?.database_id);

    expect(dev.r2_buckets).toHaveLength(1);
    expect(production.r2_buckets).toHaveLength(1);
    expect(dev.r2_buckets?.[0]?.binding).toBe("PHOTOS");
    expect(production.r2_buckets?.[0]?.binding).toBe("PHOTOS");
    expect(dev.r2_buckets?.[0]?.bucket_name).toBe("alco-app-photos-dev");
    expect(production.r2_buckets?.[0]?.bucket_name).toBe("alco-app-photos-prod");

    expect(dev.ai?.binding).toBe("AI");
    expect(production.ai?.binding).toBe("AI");
    expect(dev.triggers?.crons).toEqual(["0 18 * * *"]);
    expect(production.triggers?.crons).toEqual(["0 18 * * *"]);
  });

  it("does not store secret values in wrangler.jsonc", () => {
    expect(JSON.stringify(wrangler)).not.toMatch(SECRET_KEY_PATTERN);
    for (const key of collectKeys(wrangler)) {
      expect(key).not.toMatch(SECRET_KEY_PATTERN);
    }
  });
});
