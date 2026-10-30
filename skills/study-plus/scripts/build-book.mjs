#!/usr/bin/env node
// Build study/<topic>/book.html from the graph and its existing lecture files.

import { readFileSync, readdirSync, writeFileSync, existsSync, unlinkSync, realpathSync, statSync, lstatSync, copyFileSync, renameSync } from 'node:fs';
import { join, resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseBookData } from './book-data.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const AM = resolve(here, '..', '..', 'answer-me-with-html', 'scripts', 'am.mjs');
const CLIENT = join(here, 'book-client.js');

function die(message) {
  console.error(message);
  process.exit(1);
}

function findTopic(arg) {
  const studyPath = resolve('study');
  let studyStat;
  try {
    studyStat = lstatSync(studyPath);
  } catch (error) {
    if (error.code === 'ENOENT') die('No study/ folder here. Pass a topic folder under workspace study/.');
    die(`Cannot inspect workspace study/ folder: ${error.message}`);
  }
  if (studyStat.isSymbolicLink()) die(`Refusing to use symlink as workspace study/ folder: ${studyPath}`);
  let studyRoot;
  try {
    studyRoot = realpathSync(studyPath);
  } catch (error) {
    die(`Cannot resolve workspace study/ folder: ${error.message}`);
  }
  if (!statSync(studyRoot).isDirectory()) die(`Workspace study/ path is not a directory: ${studyRoot}`);

  let topicPath = arg ? resolve(arg) : '';
  if (!arg) {
    const hits = readdirSync(studyRoot).filter((name) => existsSync(join(studyRoot, name, 'graph.md')));
    if (hits.length !== 1) die(`Pass a topic folder under workspace study/. Found ${hits.length} topics under study/: ${hits.join(', ') || 'none'}.`);
    topicPath = join(studyRoot, hits[0]);
  }

  let topicDir;
  try {
    topicDir = realpathSync(topicPath);
  } catch (error) {
    die(`Cannot resolve topic folder ${topicPath}: ${error.message}`);
  }
  const topicRelative = relative(studyRoot, topicDir);
  if (!statSync(topicDir).isDirectory() || !topicRelative || topicRelative === '..' || topicRelative.startsWith(`..${sep}`) || isAbsolute(topicRelative)) {
    die(`Topic folder must be a real directory at least one level below workspace study/: ${topicPath}`);
  }
  return topicDir;
}

function build() {
  const dir = findTopic(process.argv[2]);
  const graphPath = join(dir, 'graph.md');
  const lectureDir = join(dir, 'lectures');
  if (!existsSync(graphPath)) die(`graph.md not found at ${graphPath}`);
  if (!existsSync(lectureDir)) die(`No lectures folder found at ${lectureDir}`);
  if (!existsSync(AM)) die(`am CLI not found at ${AM}. Install answer-me-with-html next to study-plus.`);
  if (!existsSync(CLIENT)) die(`book-client.js not found at ${CLIENT}. Install the study-plus runtime scripts first.`);

  const files = readdirSync(lectureDir)
    .filter((name) => name.endsWith('.md') && !name.startsWith('.'))
    .sort()
    .map((name) => ({ name, text: readFileSync(join(lectureDir, name), 'utf8') }));
  let book;
  try {
    book = parseBookData(readFileSync(graphPath, 'utf8'), files, { topicFallback: dir.split(/[\\/]/).pop() });
  } catch (error) {
    die(error.message);
  }

  const draft = [
    '---',
    'template: doc',
    `title: ${JSON.stringify(book.title)}`,
    ...(book.goal ? [`subtitle: ${JSON.stringify(book.goal)}`] : []),
    '---',
    '',
    book.units.map((unit) => `## ${unit.section}. ${unit.title}\n\n${unit.body}`).join('\n\n'),
    '',
  ].join('\n');
  const outPath = join(dir, 'book.html');
  const backupPath = join(dir, 'book.html.bak');
  const guardPath = (path, what) => {
    try {
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) die(`Refusing to overwrite symlink book ${what}: ${path}`);
      if (!stat.isFile()) die(`Refusing to overwrite non-regular book ${what}: ${path}`);
    } catch (error) {
      if (error.code !== 'ENOENT') die(`Cannot inspect book ${what} ${path}: ${error.message}`);
    }
  };
  guardPath(outPath, 'output');
  guardPath(backupPath, 'backup');
  // Render beside book.html: a failed build must never damage the current book.
  const tmpPath = join(dir, `.book.new-${process.pid}.html`);
  const draftPath = join(dir, `.book.draft-${process.pid}.md`);
  writeFileSync(draftPath, draft, { encoding: 'utf8', flag: 'wx' });

  let run;
  try {
    // Book builds stay offline: without this the renderer may start a weekly update check.
    run = spawnSync(process.execPath, [AM, 'render', draftPath, '-o', tmpPath, '--no-open', '--template', 'doc', '--theme', 'shadcn', '--mode', 'light', '--style', 'off'], { stdio: 'inherit', env: { ...process.env, AM_NO_UPDATE_CHECK: '1' } });
  } finally {
    if (existsSync(draftPath)) unlinkSync(draftPath);
  }

  try {
    if (run.error) throw new Error(`Could not run am render: ${run.error.message}`);
    if (run.status !== 0) throw new Error(`am render failed with exit ${run.status ?? 'unknown'}`);

    const payload = {
      title: book.title,
      goal: book.goal,
      lang: book.lang,
      chapters: book.chapters.map(({ n, name, description, count }) => ({ n, name, description, count })),
      units: book.units.map(({ concept, title, chapter, section, index, status }) => ({ concept, title, chapter, section, index, status })),
    };
    const json = JSON.stringify(payload).replace(/</g, '\\u003c');
    const client = readFileSync(CLIENT, 'utf8');
    const html = readFileSync(tmpPath, 'utf8');
    const scriptText = `\n${client}\n`;
    const hash = createHash('sha256').update(scriptText, 'utf8').digest('base64');
    const csp = /(<meta http-equiv="Content-Security-Policy" content="[^"]*?script-src )/;
    if (!csp.test(html)) throw new Error('No Content-Security-Policy script-src entry found in the rendered page.');
    const out = html
      .replace(csp, `$1'sha256-${hash}' `)
      .replace('</head>', `<script>${scriptText}</script>\n</head>`)
      .replace('</body>', `<script type="application/json" id="bk-book">${json}</script>\n</body>`);
    writeFileSync(tmpPath, out, 'utf8');

    if (existsSync(outPath)) copyFileSync(outPath, backupPath);
    renameSync(tmpPath, outPath);
  } catch (error) {
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
    die(error.message);
  }

  if (book.orphans.length) console.warn(`Orphan lecture files excluded (concept number is not in graph.md): ${book.orphans.join(', ')}`);
  console.log(`book: ${outPath} (${book.units.length} sections, ${book.chapters.length} chapters)`);
}

build();
