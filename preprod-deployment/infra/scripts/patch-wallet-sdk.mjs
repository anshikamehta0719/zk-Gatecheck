import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetFile = path.resolve(
  __dirname,
  '../../node_modules/@midnight-ntwrk/wallet-sdk-dust-wallet/dist/v1/RunningV1Variant.js',
);

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  const targetRegex = /Effect\.flatMap\(\(\{ changes, protocolVersion \}\) => pipe\(Effect\.forEach.*?Effect\.forkScoped\)\)/s;
  if (targetRegex.test(content)) {
    content = content.replace(targetRegex, 'Effect.asVoid');
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('Successfully patched RunningV1Variant.js: removed unbounded fiber memory leak!');
  } else {
    console.log('RunningV1Variant.js already patched or pattern not found.');
  }
} else {
  console.warn('RunningV1Variant.js not found at:', targetFile);
}
