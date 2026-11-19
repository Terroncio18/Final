/** Reproducible download + preparation. No remote requests during map interaction. */
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import { officialFuelSources } from "./official-fuel-sources.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const split = arg.indexOf("=");
    return split < 0
      ? [arg.replace(/^--/, ""), true]
      : [arg.slice(0, split).replace(/^--/, ""), arg.slice(split + 1)];
  }),
);
if (args.list || !args.source) {
  for (const source of officialFuelSources)
    console.log(`${source.id}: ${source.label}`);
  console.log(
    "Use --source=all|canarias|<id> --edition=YYYYMMDD [--archive=local.zip]",
  );
  process.exit(args.list ? 0 : 1);
}
if (!/^\d{8}$/.test(args.edition ?? ""))
  throw new Error(
    "Pass --edition=YYYYMMDD (download edition, not observation year).",
  );
const sources = officialFuelSources.filter(
  (source) =>
    args.source === "all" ||
    (args.source === "canarias" && source.id.startsWith("canarias-")) ||
    args.source === source.id,
);
if (!sources.length) throw new Error(`Unknown official source: ${args.source}`);
if (args.archive && sources.length !== 1)
  throw new Error("--archive requires a single source.");
const dataDir = resolve(process.env.FUEL_DATA_DIR ?? "data/fuels");
for (const source of sources) {
  const id = `${source.id}-${args.edition}`;
  try {
    await readFile(join(dataDir, "datasets", id, "manifest.json"));
    console.log(`Already prepared: ${id}`);
    continue;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const rawDir = join(dataDir, "raw", id);
  await mkdir(rawDir, { recursive: true });
  let expected;
  if (source.hitsUrl && !args.archive) {
    const response = await fetch(source.hitsUrl, {
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) throw new Error(`WFS count: HTTP ${response.status}`);
    const xml = await response.text();
    expected = Number(xml.match(/numberMatched="(\d+)"/)?.[1]);
    if (!Number.isInteger(expected) || expected <= 0)
      throw new Error("WFS did not confirm its feature count.");
  } else if (source.hitsUrl) {
    expected = Number(args["expected-features"]);
    if (!Number.isInteger(expected) || expected <= 0)
      throw new Error(
        "Local WFS archive needs --expected-features=<verified count>.",
      );
  }
  const archive = args.archive
    ? resolve(args.archive)
    : join(rawDir, "source.zip");
  if (!args.archive) {
    console.log(`Downloading ${source.url}`);
    if (source.rangeMember) {
      const selected = spawnSync(
        process.env.PYTHON ?? "python",
        [
          fileURLToPath(new URL("download-fuel-member.py", import.meta.url)),
          source.url,
          source.member,
          archive,
        ],
        { stdio: "inherit" },
      );
      if (selected.error) throw selected.error;
      if (selected.status !== 0)
        throw new Error(
          "Range extraction failed; install Python 3 or use --archive=<downloaded full ZIP>.",
        );
    } else {
      const response = await fetch(source.url, {
        signal: AbortSignal.timeout(600000),
      });
      if (!response.ok || !response.body)
        throw new Error(`Download: HTTP ${response.status}`);
      await pipeline(
        Readable.fromWeb(response.body),
        createWriteStream(archive + ".tmp"),
      );
      await rename(archive + ".tmp", archive);
    }
  }
  const bytes = await readFile(archive);
  if (bytes[0] !== 80 || bytes[1] !== 75)
    throw new Error("Expected ZIP, received a web page or invalid download.");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const stem = source.member.replace(/\.shp$/i, "");
  const allowed = new Set(
    source.member.endsWith(".shp")
      ? ["shp", "dbf", "prj", "cpg"].map((ext) => `${stem}.${ext}`)
      : [source.member],
  );
  const files = unzipSync(bytes, {
    filter: (file) => allowed.has(basename(file.name.replaceAll("\\", "/"))),
  });
  const found = new Set();
  for (const [name, content] of Object.entries(files)) {
    const safe = basename(name.replaceAll("\\", "/"));
    if (found.has(safe)) throw new Error(`Ambiguous archive member ${safe}`);
    found.add(safe);
    await writeFile(join(rawDir, safe), content);
  }
  const required = source.member.endsWith(".shp")
    ? [source.member, `${stem}.dbf`, `${stem}.prj`]
    : [source.member];
  if (required.some((name) => !found.has(name)))
    throw new Error(`Missing source components: ${required.join(", ")}`);
  const options = {
    input: join(rawDir, source.member),
    id,
    label: source.label,
    url: source.url,
    date: source.date,
    attribution: source.attribution,
    license: source.license,
    priority: source.priority,
    "legend-url": source.legendUrl,
    "archive-sha256": hash,
    "archive-mode":
      source.rangeMember && !args.archive
        ? "range-selected original member; local ZIP subset"
        : "local or full downloaded ZIP",
    ...(source.field ? { field: source.field } : {}),
    ...(source.excludedValues
      ? { "exclude-values": source.excludedValues.join(",") }
      : {}),
    ...(expected ? { "expected-features": expected } : {}),
  };
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("prepare-fuels.mjs", import.meta.url)),
      ...Object.entries(options).map(([key, value]) => `--${key}=${value}`),
    ],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Preparation failed: ${id}`);
  await writeFile(
    join(rawDir, "download.json"),
    JSON.stringify(
      {
        ...source,
        retrievedAt: new Date().toISOString(),
        sha256: hash,
        expectedFeatures: expected,
      },
      null,
      2,
    ),
  );
}
