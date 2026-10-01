#!/usr/bin/env node

// The package version is the release identity. Keep the changelog in sync
// and reject a production change that reuses the previous release version.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const command = process.argv[2];
const baseIndex = process.argv.indexOf("--base");
const base = baseIndex === -1 ? null : process.argv[baseIndex + 1];

function fail(message) {
  console.error(`Release check failed: ${message}`);
  process.exit(1);
}

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) fail(`expected a stable SemVer X.Y.Z, got ${JSON.stringify(value)}`);
  return match.slice(1).map(Number);
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
parseVersion(version);

const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
const unreleasedHeading = /^## \[Unreleased\]\s*$/m.exec(changelog);
if (!unreleasedHeading) fail("CHANGELOG.md needs an Unreleased section");

const heading = /^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})\s*$/gm.exec(changelog);
if (!heading) fail("CHANGELOG.md needs a dated release section");
if (heading[1] !== version) {
  fail(`package.json is ${version} but latest changelog release is ${heading[1]}`);
}
if (changelog.slice(unreleasedHeading.index + unreleasedHeading[0].length, heading.index).trim()) {
  fail("move all Unreleased notes into the dated release section before deploying");
}
if (!changelog.includes(`[Unreleased]: https://github.com/shariski/kerf/compare/v${version}...HEAD`)) {
  fail(`update the Unreleased comparison link to v${version}`);
}
if (!changelog.includes(`[${version}]: https://github.com/shariski/kerf/releases/tag/v${version}`)) {
  fail(`add the v${version} release link to CHANGELOG.md`);
}

const releaseDate = heading[2];
if (new Date(`${releaseDate}T00:00:00Z`).toISOString().slice(0, 10) !== releaseDate) {
  fail(`invalid release date ${releaseDate}`);
}

const sectionStart = heading.index + heading[0].length;
const nextHeading = changelog.slice(sectionStart).search(/^## \[/m);
const sectionEnd = nextHeading === -1 ? changelog.length : sectionStart + nextHeading;
const notes = changelog.slice(sectionStart, sectionEnd).split(/^\[Unreleased\]:/m)[0].trim();
if (!notes || !/^### /m.test(notes)) fail(`CHANGELOG.md has no notes for ${version}`);

if (command === "version") {
  console.log(version);
} else if (command === "notes") {
  console.log(notes);
} else if (command === "check") {
  if (base) {
    let previousVersion;
    try {
      const previous = execFileSync("git", ["show", `${base}:package.json`], {
        encoding: "utf8",
      });
      previousVersion = JSON.parse(previous).version;
    } catch {
      fail(`cannot read package.json at base ${base}`);
    }
    if (compareVersions(version, previousVersion) <= 0) {
      fail(`version ${version} must be newer than ${previousVersion} at ${base}`);
    }
  }
  console.log(`Release ${version} and changelog are in sync.`);
} else {
  fail("usage: node scripts/release.mjs check [--base <git-ref>] | version | notes");
}
