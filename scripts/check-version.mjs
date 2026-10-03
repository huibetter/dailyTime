import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const tauriConfig = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const cargoToml = readFileSync('src-tauri/Cargo.toml', 'utf8');
const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];

const versions = {
  package: packageJson.version,
  tauri: tauriConfig.version,
  cargo: cargoVersion,
};
const uniqueVersions = new Set(Object.values(versions));
if (uniqueVersions.size !== 1 || [...uniqueVersions][0] === undefined) {
  console.error('版本号不一致:', versions);
  process.exit(1);
}
console.log(`版本号一致：${packageJson.version}`);
