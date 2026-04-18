#!/usr/bin/env bash
# Build and push dist/ to the gh-pages branch.
# Run from project root: ./scripts/deploy.sh  (or: npm run deploy)

set -e

cd "$(dirname "$0")/.."

echo "🔨 Building…"
npm run build

echo "🌿 Preparing gh-pages worktree…"
rm -rf .gh-pages-tmp
git fetch origin gh-pages 2>/dev/null || true
git worktree add -B gh-pages .gh-pages-tmp origin/gh-pages 2>/dev/null || \
  git worktree add -B gh-pages .gh-pages-tmp

cd .gh-pages-tmp
git rm -rf . 2>/dev/null || true
cp -R ../dist/* .
touch .nojekyll

echo "📤 Committing and pushing…"
git add -A
git commit -m "deploy: $(date -u +%Y-%m-%dT%H:%M:%SZ)" || echo "nothing to commit"
git push -u origin gh-pages --force

cd ..
git worktree remove .gh-pages-tmp

echo "✅ Deployed. Site: https://albertliu16888.github.io/frozen-castle/"
