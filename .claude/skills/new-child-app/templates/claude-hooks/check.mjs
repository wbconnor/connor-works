// Claude Code Stop hook: when Claude finishes a turn that changed files, type-check and run
// the unit tests. Exit code 2 sends failures back to Claude so it keeps working on them.
import { execFileSync } from 'node:child_process';

let input = '';
for await (const chunk of process.stdin) input += chunk;

// Already continuing because of this hook: don't loop forever
if (JSON.parse(input).stop_hook_active) process.exit(0);

const cwd = process.env.CLAUDE_PROJECT_DIR;
const run = (command, args) => execFileSync(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();

// Skip conversational turns with no file changes
if (run('git', ['status', '--porcelain']).trim() === '') process.exit(0);

for (const [label, args] of [
  ['Type-check', ['typecheck']],
  ['Unit tests', ['test']],
]) {
  try {
    run('pnpm', args);
  } catch (error) {
    process.stderr.write(`${label} failed:\n${error.stdout ?? ''}${error.stderr ?? ''}`);
    process.exit(2);
  }
}
