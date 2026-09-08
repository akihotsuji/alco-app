import { stdin, stdout } from "node:process";

const workersDevUrl = /https?:\/\/[^\s]*workers\.dev[^\s]*/gi;

/** 公開 Actions ログに workers.dev URL を残さない */
export function redactWranglerLog(input: string): string {
  return input.replace(workersDevUrl, "[redacted-url]");
}

const isCli = process.argv[1] !== undefined && import.meta.filename === process.argv[1];

if (isCli) {
  const chunks: string[] = [];
  stdin.setEncoding("utf8");
  stdin.on("data", (chunk) => {
    chunks.push(String(chunk));
  });
  stdin.on("end", () => {
    stdout.write(redactWranglerLog(chunks.join("")));
  });
}
