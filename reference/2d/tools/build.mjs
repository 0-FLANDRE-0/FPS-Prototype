import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const STYLE_MARKER = '/* @cqb:styles */';
export const SCRIPT_MARKER = '/* @cqb:scripts */';
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function projectPath(root, path) {
  if (typeof path !== 'string' || !path || isAbsolute(path)) {
    throw new Error(`Expected a relative project path: ${path}`);
  }
  const fullPath = resolve(root, path);
  const child = relative(resolve(root), fullPath);
  if (child === '..' || child.startsWith('../') || child.startsWith('..\\')) {
    throw new Error(`Path escapes the project: ${path}`);
  }
  return fullPath;
}

function replaceMarker(template, marker, content) {
  if (template.split(marker).length !== 2) {
    throw new Error(`Template must contain exactly one ${marker}`);
  }
  // A callback keeps literal $&, $`, and $' in source code unchanged.
  return template.replace(marker, () => content);
}

export async function assemble({ root = projectRoot } = {}) {
  const manifest = JSON.parse(await readFile(resolve(root, 'src/manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.styles) ||
      !manifest.styles.length || !Array.isArray(manifest.scripts) || !manifest.scripts.length) {
    throw new Error('Unsupported or incomplete source manifest');
  }
  const paths = [manifest.template, ...manifest.styles, ...manifest.scripts.map((part) => part.path)];
  if (new Set(paths).size !== paths.length) throw new Error('Duplicate source paths in manifest');
  for (const path of paths) {
    projectPath(root, path);
    if (!path.startsWith('src/')) throw new Error(`Source must be inside src/: ${path}`);
  }
  const contents = await Promise.all(paths.map((path) => readFile(projectPath(root, path), 'utf8')));
  const template = contents[0];
  const styles = contents.slice(1, 1 + manifest.styles.length).join('');
  const sourceParts = contents.slice(1 + manifest.styles.length);
  const script = sourceParts.join('');
  // Inline HTML cannot safely contain a literal closing raw-text element tag.
  if (/<\/style[\s/>]/i.test(styles) || /<\/script[\s/>]/i.test(script)) {
    throw new Error('Source contains a closing inline HTML tag; encode it before bundling');
  }
  for (let i = 0; i < sourceParts.length; i++) {
    new Script(sourceParts[i], { filename: manifest.scripts[i].path });
  }
  // Keep one classic script: functions can refer forward across source files,
  // and the legacy global lexical environment and initialization order survive.
  new Script(script, { filename: 'CQB_Tactical.html:script' });
  const withStyles = replaceMarker(template, STYLE_MARKER, styles);
  const scriptIndex = withStyles.indexOf(SCRIPT_MARKER);
  let generatedLine = 1 + (withStyles.slice(0, scriptIndex).match(/\n/g) || []).length;
  const sources = manifest.scripts.map((part, index) => {
    const newlines = (sourceParts[index].match(/\n/g) || []).length;
    const entry = {
      path: part.path,
      role: part.role,
      originalLines: part.originalLines,
      generatedStartLine: generatedLine,
      generatedEndLine: generatedLine + newlines - Number(sourceParts[index].endsWith('\n')),
    };
    generatedLine += newlines;
    return entry;
  });
  const html = replaceMarker(withStyles, SCRIPT_MARKER, script);
  return {
    html,
    script,
    manifest,
    info: { schemaVersion: 1, htmlSha256: sha256(html), bytes: Buffer.byteLength(html), sources },
  };
}

export async function build({ root = projectRoot, outDir = resolve(root, 'dist') } = {}) {
  const result = await assemble({ root });
  await mkdir(outDir, { recursive: true });
  const output = resolve(outDir, 'CQB_Tactical.html');
  const pending = `${output}.${process.pid}.tmp`;
  await writeFile(pending, result.html);
  await rename(pending, output);
  await writeFile(resolve(outDir, 'build-info.json'), JSON.stringify(result.info, null, 2) + '\n');
  return { ...result, output };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await build();
    console.log(`Built ${relative(projectRoot, result.output)} (${result.info.bytes} bytes, ${result.manifest.scripts.length} JS files)`);
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
