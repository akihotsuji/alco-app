import { defineConfig } from "drizzle-kit";

// generate 専用。適用は wrangler（`pnpm db:migrate:local`）が行うので DB 接続情報は持たない。
// out は wrangler.jsonc の env.dev.d1_databases[].migrations_dir と一致させる
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  strict: true,
  verbose: true,
});
