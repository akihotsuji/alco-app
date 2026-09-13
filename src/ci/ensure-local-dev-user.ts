import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ensureLocalDevUser,
  LOCAL_DEV_ORIGIN,
  LOCAL_DEV_USER_FILE,
  waitForHealth,
} from "./local-dev-user.ts";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const origin = process.env.LOCAL_DEV_ORIGIN ?? LOCAL_DEV_ORIGIN;
const wait = process.argv.includes("--wait");

if (wait) {
  const ready = await waitForHealth(origin);
  if (!ready) {
    console.error(`timed out waiting for ${origin}/api/health`);
    process.exit(1);
  }
}

const result = await ensureLocalDevUser(repoRoot, origin);
console.log(
  result.created
    ? `created local dev user (${result.user.email}). credentials: ${LOCAL_DEV_USER_FILE}`
    : `local dev user ready (${result.user.email}). credentials: ${LOCAL_DEV_USER_FILE}`,
);
console.log("do not print the password in chat, commits, or logs.");
