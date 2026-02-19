#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const hashFile = path.join(rootDir, "src/canvas-host/a2ui/.bundle.hash");
const outputFile = path.join(rootDir, "src/canvas-host/a2ui/a2ui.bundle.js");
const rendererDir = path.join(rootDir, "vendor/a2ui/renderers/lit");
const appDir = path.join(rootDir, "apps/shared/OpenClawKit/Tools/CanvasA2UI");

function failWithHint(message) {
  console.error(message);
  console.error("A2UI bundling failed. Re-run with: pnpm canvas:a2ui:bundle");
  console.error("If this persists, verify pnpm deps and try again.");
  process.exit(1);
}

async function walk(entryPath, out) {
  const st = await stat(entryPath);
  if (st.isDirectory()) {
    const entries = await readdir(entryPath);
    for (const entry of entries) {
      await walk(path.join(entryPath, entry), out);
    }
    return;
  }
  out.push(entryPath);
}

function normalize(p) {
  return p.split(path.sep).join("/");
}

async function computeHash(inputs) {
  const files = [];
  for (const inputPath of inputs) {
    await walk(inputPath, files);
  }
  files.sort((a, b) => normalize(a).localeCompare(normalize(b)));

  const hash = createHash("sha256");
  for (const filePath of files) {
    const rel = normalize(path.relative(rootDir, filePath));
    hash.update(rel);
    hash.update("\0");
    hash.update(await readFile(filePath));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: rootDir,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function main() {
  const sourcesMissing = !existsSync(rendererDir) || !existsSync(appDir);
  if (sourcesMissing) {
    if (existsSync(outputFile)) {
      console.log("A2UI sources missing; keeping prebuilt bundle.");
      return;
    }
    failWithHint(`A2UI sources missing and no prebuilt bundle found at: ${outputFile}`);
  }

  const inputPaths = [
    path.join(rootDir, "package.json"),
    path.join(rootDir, "pnpm-lock.yaml"),
    rendererDir,
    appDir,
  ];

  const currentHash = await computeHash(inputPaths);
  if (existsSync(hashFile) && existsSync(outputFile)) {
    const previousHash = (await readFile(hashFile, "utf8")).trim();
    if (previousHash === currentHash) {
      console.log("A2UI bundle up to date; skipping.");
      return;
    }
  }

  run("pnpm", ["-s", "exec", "tsc", "-p", path.join(rendererDir, "tsconfig.json")]);
  run("rolldown", ["-c", path.join(appDir, "rolldown.config.mjs")]);

  await mkdir(path.dirname(hashFile), { recursive: true });
  await writeFile(hashFile, `${currentHash}\n`, "utf8");
}

main().catch((error) => failWithHint(error instanceof Error ? error.message : String(error)));
