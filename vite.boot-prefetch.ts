import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { IndexHtmlTransformContext, Plugin } from "vite";

type RollupInput = string | string[] | Record<string, string>;
import { PWA_VITE_ENVIRONMENT } from "./src/shared/pwa.ts";

export const BOOT_PREFETCH_ENTRY = "bootPrefetch";
export const BOOT_PREFETCH_DEV_SRC = "/src/client/boot-prefetch.ts";

const BOOT_SCRIPT_RE =
  /\s*<script type="module" src="\/src\/client\/boot-prefetch\.ts"><\/script>/;

const root = fileURLToPath(new URL(".", import.meta.url));
const bootPath = resolve(root, "src/client/boot-prefetch.ts");

function isClientEnvironment(name: string): boolean {
  return name === PWA_VITE_ENVIRONMENT;
}

export function addBootPrefetchInput(
  input: RollupInput | undefined,
  extraPath = bootPath,
): RollupInput {
  if (input === undefined) {
    return { [BOOT_PREFETCH_ENTRY]: extraPath };
  }
  if (typeof input === "string") {
    return { main: input, [BOOT_PREFETCH_ENTRY]: extraPath };
  }
  if (Array.isArray(input)) {
    return input.includes(extraPath) ? input : [...input, extraPath];
  }
  if (input[BOOT_PREFETCH_ENTRY] === extraPath) {
    return input;
  }
  return { ...input, [BOOT_PREFETCH_ENTRY]: extraPath };
}

export function stripBootPrefetchScript(html: string): string {
  return html.replace(BOOT_SCRIPT_RE, "");
}

export function injectBootPrefetchScript(html: string, fileName: string): string {
  const href = fileName.startsWith("/") ? fileName : `/${fileName}`;
  if (html.includes(`src="${href}"`)) {
    return html;
  }
  const tag = `<script type="module" src="${href}"></script>`;
  return html.replace('<script type="module"', `${tag}\n    <script type="module"`);
}

function bootPrefetchFileName(ctx: IndexHtmlTransformContext): string | undefined {
  const bundle = ctx.bundle;
  if (!bundle) {
    return undefined;
  }
  for (const item of Object.values(bundle)) {
    if (item.type === "chunk" && item.name === BOOT_PREFETCH_ENTRY && item.isEntry) {
      return item.fileName;
    }
  }
  return undefined;
}

export function alcoBootPrefetch(): Plugin[] {
  return [
    {
      name: "alco-boot-prefetch-entry",
      apply: "build",
      applyToEnvironment(environment) {
        return isClientEnvironment(environment.name);
      },
      options(options) {
        options.input = addBootPrefetchInput(options.input);
        return options;
      },
      transformIndexHtml: {
        order: "pre",
        handler(html) {
          return stripBootPrefetchScript(html);
        },
      },
    },
    {
      name: "alco-boot-prefetch-inject",
      apply: "build",
      enforce: "post",
      applyToEnvironment(environment) {
        return isClientEnvironment(environment.name);
      },
      transformIndexHtml: {
        order: "post",
        handler(html, ctx) {
          const fileName = bootPrefetchFileName(ctx);
          if (!fileName) {
            return html;
          }
          return injectBootPrefetchScript(html, fileName);
        },
      },
    },
  ];
}
