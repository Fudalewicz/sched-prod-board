// Builds app/ into dist/: stamps the git sha (R6) and fills config.js from the session file outside the repo.
import { cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';

const sha = execSync('git rev-parse --short=12 HEAD').toString().trim();
if (execSync('git status --porcelain app').toString().trim()) throw new Error('app/ has uncommitted changes: commit first, so the sha names this build');
const secretPath = process.env.SESSION_FILE ?? '../session.secret.json';
const { api, session } = JSON.parse(readFileSync(secretPath, 'utf8'));

rmSync('dist', { recursive: true, force: true });
cpSync('app', 'dist', { recursive: true });
const html = readFileSync('dist/index.html', 'utf8').replaceAll('__BUILD_SHA__', sha);
writeFileSync('dist/index.html', html);
writeFileSync('dist/config.js', `export const API = ${JSON.stringify(api)};\nexport const SESSION = ${JSON.stringify(session)};\n`);
console.log(`built dist/ at ${sha}`);
