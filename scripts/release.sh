#!/usr/bin/env bash
# Publish the artifacts of `bun run build:stable` as a GitHub Release.
#
# The running app looks for `<channel>-<platform>-<arch>-update.json` under
# release.baseUrl in electrobun.config.ts, which is GitHub's
# /releases/latest/download redirect. So "shipping an update" is exactly this:
# create a release whose assets include that json and the tarball beside it.
# Nothing else points at a version number.
set -euo pipefail
cd "$(dirname "$0")/.."

version=$(node -p "require('./package.json').version")
tag="v${version}"

if [ ! -f artifacts/stable-macos-arm64-update.json ]; then
  echo "artifacts/ has no stable build — run: bun run build:stable" >&2
  exit 1
fi

# The version in package.json is not what the updater compares; the hash inside
# update.json is. But a tag that repeats a shipped version makes the release
# list a lie, so refuse rather than overwrite.
if gh release view "$tag" >/dev/null 2>&1; then
  echo "Release $tag already exists. Bump \"version\" in package.json and electrobun.config.ts first." >&2
  exit 1
fi

gh release create "$tag" artifacts/* --title "Orbit Lite $version" --generate-notes
echo "Published $tag — running apps will see it on their next launch."
