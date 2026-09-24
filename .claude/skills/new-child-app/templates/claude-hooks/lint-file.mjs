// Claude Code PostToolUse hook: lint the file Claude just edited.
// Exit code 2 sends the lint output back to Claude so it fixes the problem right away.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

let input = '';
for await (const chunk of process.stdin) input += chunk;

const file = JSON.parse(input).tool_input?.file_path;
if (!file || !/\.(c|m)?[jt]sx?$/.test(file) || !existsSync(file)) process.exit(0);

try {
  execFileSync('pnpm', ['exec', 'eslint', '--no-warn-ignored', file], {
    cwd: process.env.CLAUDE_PROJECT_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (error) {
  process.stderr.write(`ESLint found problems in ${file}:\n${error.stdout ?? ''}${error.stderr ?? ''}`);
  process.exit(2);
}
