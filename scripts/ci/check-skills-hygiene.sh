#!/usr/bin/env bash
set -euo pipefail

canonical="ai/.agent/skills"
link_path=".agents/skills"
expected_link="../ai/.agent/skills"

if [[ ! -d "$canonical" ]]; then
  echo "ERROR: canonical skills directory missing at $canonical"
  exit 1
fi

if [[ ! -L "$link_path" ]]; then
  echo "ERROR: $link_path must be a symlink"
  exit 1
fi

actual_link="$(readlink "$link_path")"
if [[ "$actual_link" != "$expected_link" ]]; then
  echo "ERROR: $link_path must point to $expected_link (got: $actual_link)"
  exit 1
fi

repo_root="$(pwd)"
resolved_link="$(cd "$(dirname "$link_path")" && cd "$actual_link" && pwd)"
resolved_canonical="$repo_root/$canonical"
if [[ "$resolved_link" != "$resolved_canonical" ]]; then
  echo "ERROR: $link_path does not resolve to canonical path"
  echo "  resolved link: $resolved_link"
  echo "  canonical   : $resolved_canonical"
  exit 1
fi

filtered=()
while IFS= read -r dir; do
  [[ -z "$dir" ]] && continue
  if [[ "$dir" == "ai/.agent/skills" ]]; then
    continue
  fi
  filtered+=("$dir")
done < <(
  find . \
    \( -path './.git' -o -path './node_modules' -o -path './.next' \) -prune -o \
    -type d -name skills -print | sed 's#^\./##' | sort
)

if [[ ${#filtered[@]} -gt 0 ]]; then
  echo "ERROR: duplicate skills directories detected outside $canonical:"
  for dir in "${filtered[@]}"; do
    echo "  - $dir"
  done
  exit 1
fi

echo "Skills hygiene check passed"
