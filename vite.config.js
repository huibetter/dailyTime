import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
let appCommit = 'unknown';

try {
  appCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() || 'unknown';
} catch {
  // Git is optional when building from a packaged source archive.
}

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
    'import.meta.env.VITE_APP_COMMIT': JSON.stringify(appCommit),
  },
});
