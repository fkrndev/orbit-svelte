#!/usr/bin/env bash
# Publish a stable build as a GitHub Release — which is the whole of "shipping
# an update": the running app polls <release.baseUrl>/stable-<os>-<arch>-update.json,
# and that URL is GitHub's redirect to the newest release. There is no version
# string anywhere else to bump.
#
#   bun run release           publish whatever is in artifacts/ already
#   bun run release patch     bump 0.1.0 -> 0.1.1, rebuild, publish
#   bun run release minor     bump 0.1.0 -> 0.2.0, rebuild, publish
#   bun run release 1.4.2     set that exact version, rebuild, publish
#
# The bump has to happen *before* the build, because the version is baked into
# the bundle. Doing it after leaves an app that reports the version it replaced,
# which is why bumping and building live in here together rather than being two
# things to remember in the right order.
set -euo pipefail
cd "$(dirname "$0")/.."

bump="${1:-}"

if [ -n "$bump" ]; then
  version=$(node -e '
    const fs = require("fs")
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"))
    const arg = process.argv[1]
    let next
    if (/^\d+\.\d+\.\d+/.test(arg)) {
      next = arg
    } else {
      const [major, minor, patch] = pkg.version.split(".").map(Number)
      if (arg === "major") next = `${major + 1}.0.0`
      else if (arg === "minor") next = `${major}.${minor + 1}.0`
      else if (arg === "patch") next = `${major}.${minor}.${patch + 1}`
      else { console.error(`Unknown bump: ${arg}`); process.exit(1) }
    }
    // Rewritten as text, not re-serialised: JSON.stringify would reformat the
    // whole file and bury the one-line change in a whole-file diff.
    const src = fs.readFileSync("package.json", "utf8")
    fs.writeFileSync("package.json", src.replace(/"version": "[^"]+"/, `"version": "${next}"`))
    process.stdout.write(next)
  ' "$bump")
  echo "Version -> $version"
  bun run build:stable
else
  version=$(node -p "require('./package.json').version")
fi

tag="v${version}"

if [ ! -f artifacts/stable-macos-arm64-update.json ]; then
  echo "artifacts/ has no stable build — run: bun run build:stable" >&2
  exit 1
fi

if gh release view "$tag" >/dev/null 2>&1; then
  echo "Release $tag already exists. Ship the next one with: bun run release patch" >&2
  exit 1
fi

# artifacts/* rather than a named list: a build that found a previous release
# also emits stable-macos-arm64-<prevHash>.patch, and leaving that behind is
# what turns a 8 KB delta update into an 22 MB full download.
gh release create "$tag" artifacts/* --title "Orbit Lite $version" --generate-notes

echo "Published $tag — running apps pick it up on their next launch."
