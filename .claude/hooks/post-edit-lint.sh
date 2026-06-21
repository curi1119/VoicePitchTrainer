#!/usr/bin/env bash
# PostToolUse (Write|Edit): .ts/.tsx ファイル編集後に ESLint + Prettier を実行する

file=$(node -e "
  let d = '';
  process.stdin.on('data', c => d += c);
  process.stdin.on('end', () => {
    const j = JSON.parse(d);
    process.stdout.write(j.tool_input?.file_path || j.tool_response?.filePath || '');
  });
")

[[ "$file" =~ \.(tsx|ts)$ ]] || exit 0

cd "$(git rev-parse --show-toplevel)/pitch-trainer" && bun run lint && bun run format
