import { execSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(".");
const args = process.argv.slice(2);

function readArg(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0 || !args[index + 1]) return fallback;
  return args[index + 1];
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const configPath = join(root, "src-tauri", "tauri.conf.json");
if (!existsSync(configPath)) {
  fail("Run this script from the Ceres repository root.");
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const version = config.version;
const productName = config.productName;
const nsisDir = join(
  root,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "nsis",
);

if (!existsSync(nsisDir)) {
  fail("NSIS bundle not found. Run `npm run tauri build` first.");
}

const candidates = readdirSync(nsisDir).filter(
  (name) =>
    name.endsWith(".exe") &&
    name.includes("setup") &&
    !name.toLowerCase().includes("uninstall"),
);
if (candidates.length === 0) {
  fail("No NSIS setup executable found in " + nsisDir);
}

const fileName =
  candidates.find((name) => name.includes(`${productName}_${version}`)) ??
  candidates[0];
const filePath = join(nsisDir, fileName);

let keyPath = process.env.TAURI_SIGNING_PRIVATE_KEY_PATH;
if (!keyPath) {
  const defaultKey = join(homedir(), ".tauri", "ceres.key");
  if (existsSync(defaultKey)) keyPath = defaultKey;
}
if (!keyPath || !existsSync(keyPath)) {
  fail(
    "Updater signing key not found. Set TAURI_SIGNING_PRIVATE_KEY_PATH or " +
      "generate a key with `npx tauri signer generate -w $HOME\\.tauri\\ceres.key`.",
  );
}

const signCommand = [
  "npx tauri signer sign",
  `--private-key-path ${JSON.stringify(keyPath)}`,
  `--app-version ${JSON.stringify(version)}`,
  JSON.stringify(filePath),
].join(" ");

let output;
try {
  output = execSync(signCommand, {
    cwd: root,
    encoding: "utf8",
    env: process.env,
  });
} catch (caught) {
  fail(caught.stderr || caught.message || "Failed to sign the installer.");
}
const signatureMatch = output.match(/Public signature:\s*(\S+)/);
if (!signatureMatch) {
  fail("Could not read the signature from the signer output.");
}

const releaseTag = `v${version}`;
const urlBase =
  readArg("--url-base", "https://github.com/xlcblues/Ceres/releases/download");
const notes = readArg("--notes", "Ceres update");
const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature: signatureMatch[1],
      url: `${urlBase}/${releaseTag}/${fileName}`,
    },
  },
};

const outPath = join(root, "src-tauri", "target", "release", "bundle", "latest.json");
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Update manifest written to ${outPath}`);
console.log("Upload these files as assets on the GitHub release:");
console.log(`  - ${filePath}`);
console.log(`  - ${outPath} (must be named latest.json)`);
