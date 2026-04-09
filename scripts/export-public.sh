#!/usr/bin/env bash
#
# scripts/export-public.sh — copy allowlisted paths into a clean dest dir.
#
# Used by .github/workflows/mirror-public.yml to populate the public repo
# checkout with exactly the files that should be exported. Allowlist is
# explicit (positive) so a new internal file never leaks unless someone
# adds it here on purpose.
#
# Usage:
#   ./scripts/export-public.sh <dest-dir>
#
# The dest dir is wiped (except .git) before the copy.

set -euo pipefail

DEST="${1:?usage: export-public.sh <dest-dir>}"

if [[ ! -d "$DEST" ]]; then
	echo "error: dest dir '$DEST' does not exist" >&2
	exit 1
fi

# --- Wipe dest (keep .git) ---
find "$DEST" -mindepth 1 -maxdepth 1 -not -name '.git' -exec rm -rf {} +

# --- Allowlist: every path that goes into the public repo ---
ALLOW=(
	# Source
	"packages"
	"modules"
	"examples"
	"docs"
	"scripts/export-public.sh"

	# .github (workflows + templates)
	# ci.yml is the single workflow file — its job-level `if:` gates
	# pick the right jobs (mirror / release / deploy-docs) per repo.
	".github/workflows/ci.yml"
	".github/ISSUE_TEMPLATE"
	".github/PULL_REQUEST_TEMPLATE.md"
	".github/CODEOWNERS"
	".github/FUNDING.yml"

	# Changesets
	".changeset"

	# Community files
	"README.md"
	"LICENSE"
	"CONTRIBUTING.md"
	"CODE_OF_CONDUCT.md"
	"SECURITY.md"
	"CHANGELOG.md"

	# Project config
	"package.json"
	"pnpm-workspace.yaml"
	"pnpm-lock.yaml"
	"tsconfig.base.json"
	"turbo.json"
	"biome.json"
	".nvmrc"
	".node-version"
	".gitignore"
	".gitattributes"
)

# --- Copy each allowlisted path ---
for path in "${ALLOW[@]}"; do
	if [[ ! -e "$path" ]]; then
		# Optional file — skip silently
		continue
	fi
	target_dir="$DEST/$(dirname "$path")"
	mkdir -p "$target_dir"
	cp -R "$path" "$DEST/$path"
done

# --- Belt-and-braces deny: nuke anything that might have hitched a ride ---
# Internal directories and files that must never reach the public mirror.
DENY=(
	".ai"
	".claude"
	".cursor"
	".vscode"
	"nextvm-framework-concept-v2_3.md"
	"PUBLIC_REPO_SETUP.md"
	"scratchpad"
	".turbo"
	"node_modules"
	"dist"
	".vitepress/cache"
	".vitepress/dist"
)

for pattern in "${DENY[@]}"; do
	find "$DEST" -name "$pattern" -prune -exec rm -rf {} + 2>/dev/null || true
done

# --- Sanity check: list what we exported ---
echo "Exported to $DEST:"
find "$DEST" -mindepth 1 -maxdepth 1 -not -name '.git' | sort
