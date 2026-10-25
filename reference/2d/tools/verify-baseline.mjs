import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assemble, projectRoot, projectPath, sha256 } from './build.mjs';

export async function verifyBaseline({ root = projectRoot } = {}) {
  const { html, manifest } = await assemble({ root });
  const baseline = await readFile(projectPath(root, manifest.baseline.path));
  if (sha256(baseline) !== manifest.baseline.sha256) {
    throw new Error('The preserved baseline HTML changed');
  }
  const generated = Buffer.from(html);
  if (!generated.equals(baseline)) {
    throw new Error('Generated HTML differs from the preserved baseline; inspect the source change');
  }
  return { bytes: generated.length, sha256: sha256(generated), gitBlob: manifest.baseline.gitBlob };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await verifyBaseline();
    console.log(`Baseline identical: ${result.bytes} bytes, SHA-256 ${result.sha256}`);
  } catch (error) {
    console.error(`Baseline verification failed: ${error.message}`);
    process.exitCode = 1;
  }
}
