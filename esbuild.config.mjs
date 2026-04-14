import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { readFileSync, writeFileSync, existsSync } from "fs";

const prod = process.argv[2] === "production";

// ─── libhangul hanja.txt 데이터 로드 ────────────────────────────────────────
// 출처: https://github.com/libhangul/libhangul (LGPL-2.1)
// 빌드 시 한 번 다운로드하여 번들에 포함. dev 모드는 캐시 재사용.

const HANJA_CACHE = ".hanja-data-cache.json";
const HANJA_TXT_URL =
  "https://raw.githubusercontent.com/libhangul/libhangul/main/data/hanja/hanja.txt";

async function fetchHanjaMeanings() {
  console.log("[hanja] libhangul/hanja.txt 다운로드 중...");
  const res = await fetch(HANJA_TXT_URL);
  if (!res.ok) throw new Error(`hanja.txt 다운로드 실패: HTTP ${res.status}`);

  const map = Object.create(null);
  for (const line of (await res.text()).split("\n")) {
    if (line.startsWith("#") || !line.trim()) continue;
    const c1 = line.indexOf(":");
    if (c1 === -1) continue;
    const c2 = line.indexOf(":", c1 + 1);
    if (c2 === -1) continue;
    const korean = line.slice(0, c1);
    const hanja  = line.slice(c1 + 1, c2);
    const meaning = line.slice(c2 + 1).trim();
    if (korean && hanja && meaning) {
      map[`${korean}:${hanja}`] = meaning;
    }
  }
  return map;
}

async function getHanjaMeanings() {
  if (!prod && existsSync(HANJA_CACHE)) {
    console.log("[hanja] 캐시 사용:", HANJA_CACHE);
    return JSON.parse(readFileSync(HANJA_CACHE, "utf8"));
  }
  const map = await fetchHanjaMeanings();
  writeFileSync(HANJA_CACHE, JSON.stringify(map));
  console.log(`[hanja] ${Object.keys(map).length}개 항목 로드 완료`);
  return map;
}

const hanjaMeanings = await getHanjaMeanings();

const hanjaDataPlugin = {
  name: "hanja-data",
  setup(build) {
    build.onResolve({ filter: /^hanja-data$/ }, (args) => ({
      path: args.path,
      namespace: "hanja-data-ns",
    }));
    build.onLoad({ filter: /.*/, namespace: "hanja-data-ns" }, () => ({
      contents: `export default ${JSON.stringify(hanjaMeanings)};`,
      loader: "js",
    }));
  },
};

const context = await esbuild.context({
  entryPoints: ["main.ts"],
  bundle: true,
  plugins: [hanjaDataPlugin],
  external: [
    "obsidian",
    "electron",
    "@codemirror/autocomplete",
    "@codemirror/collab",
    "@codemirror/commands",
    "@codemirror/language",
    "@codemirror/lint",
    "@codemirror/search",
    "@codemirror/state",
    "@codemirror/view",
    "@lezer/common",
    "@lezer/highlight",
    "@lezer/lr",
    ...builtins,
  ],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: prod,
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
