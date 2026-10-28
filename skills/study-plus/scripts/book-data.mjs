const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into', 'nor', 'of', 'on', 'or', 'over', 'the', 'to', 'up', 'via', 'with']);

function titleCase(text) {
  if (/[\u4e00-\u9fff]/.test(text)) return text;
  const words = text.split(' ');
  return words.map((word, at) => {
    const match = word.match(/^([^\w$]*)([\w$][\w$'’-]*)(.*)$/);
    if (!match) return word;
    const [, lead, core, tail] = match;
    if (core.includes('$') || (core.length > 1 && core === core.toUpperCase())) return word;
    const opens = at === 0 || /[:—–?!]$/.test(words[at - 1]);
    if (!opens && SMALL.has(core.toLowerCase())) return lead + core.toLowerCase() + tail;
    return lead + core[0].toUpperCase() + core.slice(1) + tail;
  }).join(' ');
}

function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function readConceptTable(text, errors) {
  const lines = text.split(/\r?\n/);
  const headerAt = lines.findIndex((line) => {
    if (!line.trim().startsWith('|')) return false;
    const headers = cells(line).map((value) => value.toLowerCase());
    return headers.includes('#') && headers.includes('concept');
  });
  if (headerAt < 0) {
    errors.push('graph.md has no concept table with # and Concept headers.');
    return { headers: [], rows: [] };
  }

  const headers = cells(lines[headerAt]).map((value) => value.toLowerCase());
  const headerIndexes = new Map();
  headers.forEach((header, index) => {
    if (headerIndexes.has(header)) errors.push(`Concept table has duplicate ${header} headers.`);
    else headerIndexes.set(header, index);
  });
  const rows = [];
  for (const line of lines.slice(headerAt + 1)) {
    if (!line.trim().startsWith('|')) break;
    const values = cells(line);
    if (values.every((value) => /^:?-+:?$/.test(value))) continue;
    const numberText = values[headerIndexes.get('#')] ?? '';
    const number = /^\d+$/.test(numberText) ? Number(numberText) : 0;
    if (!number) {
      errors.push(`Concept table row ${rows.length + 1} has invalid # value "${numberText}". Use consecutive positive integers starting at 1.`);
      continue;
    }
    rows.push({
      number,
      name: values[headerIndexes.get('concept')] ?? '',
      chapterText: values[headerIndexes.get('chapter')] ?? '',
      sectionText: values[headerIndexes.get('section')] ?? '',
      blockText: values[headerIndexes.get('block')] ?? '',
    });
  }
  if (!rows.length) errors.push('graph.md has no concept rows.');

  const seen = new Set();
  rows.forEach((row, index) => {
    if (seen.has(row.number)) errors.push(`Concept number ${row.number} appears more than once in the concept table.`);
    seen.add(row.number);
    const expected = index + 1;
    if (row.number !== expected) errors.push(`Concept table row ${index + 1} is numbered ${row.number}; concept numbers must be consecutive in learning order starting at 1.`);
    if (!row.name) errors.push(`Concept ${row.number} has no name in the Concept column.`);
  });
  return { headers, rows };
}

function readChapterList(text, heading, errors) {
  const headingAt = text.search(new RegExp(`^##\\s+${heading}\\s*$`, 'mi'));
  if (headingAt < 0) return null;
  const section = text.slice(headingAt).replace(new RegExp(`^##\\s+${heading}\\s*\\r?\\n`, 'i'), '').split(/^##\s/m)[0];
  const chapters = [];
  for (const line of section.split(/\r?\n/)) {
    if (!/^\s*\d+\./.test(line)) continue;
    const match = line.match(/^\s*(\d+)\.\s*(.+?):\s*(.+?)\s*$/);
    if (!match) {
      errors.push(`## ${heading} entry "${line.trim()}" is incomplete. Use "N. <title>: <scope>".`);
      continue;
    }
    chapters.push({ n: Number(match[1]), name: match[2].trim(), description: match[3].trim() });
  }
  if (!chapters.length) errors.push(`## ${heading} has no chapter metadata. Add entries as "N. <title>: <scope>".`);

  const seen = new Set();
  chapters.forEach((chapter, index) => {
    if (seen.has(chapter.n)) errors.push(`## ${heading} repeats chapter number ${chapter.n}.`);
    seen.add(chapter.n);
    if (chapter.n !== index + 1) errors.push(`## ${heading} entry ${index + 1} is numbered ${chapter.n}; chapter numbers must be consecutive starting at 1.`);
    if (!chapter.name || !chapter.description) errors.push(`Chapter ${chapter.n} needs both a title and a scope description.`);
  });
  return chapters;
}

function graphMetadata(text, topicFallback) {
  const firstHeading = text.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim() || '';
  const headingTopic = firstHeading.replace(/^Topic:\s*/i, '');
  const topic = (headingTopic.toLowerCase() === 'topic' ? '' : headingTopic || topicFallback || 'Topic').trim();
  const book = (text.match(/^Book:\s*(.+?)\s*$/mi)?.[1] || '').trim();
  const goal = (text.match(/^Goal:\s*(.*?)\s*$/mi)?.[1] || '').trim();
  return { topic, title: book || topic, goal };
}

function graphError(errors) {
  return new Error(`Invalid graph.md:\n${errors.map((error) => `- ${error}`).join('\n')}`);
}

function parseGraph(text, topicFallback) {
  const errors = [];
  const metadata = graphMetadata(text, topicFallback);
  const table = readConceptTable(text, errors);
  const chapterHeadings = readChapterList(text, 'Chapters', errors);
  const structureHeadings = chapterHeadings ? null : readChapterList(text, 'Structure', errors);
  const hasChapter = table.headers.includes('chapter');
  const hasSection = table.headers.includes('section');
  const hasBlock = table.headers.includes('block');
  let chapters;
  let mappings = new Map();

  if (hasChapter || hasSection) {
    if (!hasChapter || !hasSection) errors.push('The new concept table requires both Chapter and Section columns.');
    if (!chapterHeadings && table.rows.some((row) => /^\d+$/.test(row.chapterText) && Number(row.chapterText) > 1)) {
      errors.push('A multi-chapter graph needs a ## Chapters list with each chapter title and scope.');
    }
    chapters = chapterHeadings || [{ n: 1, name: metadata.title, description: '' }];
    const chapterByNumber = new Map(chapters.map((chapter) => [chapter.n, chapter]));
    const positions = new Map();
    for (const row of table.rows) {
      if (!/^\d+$/.test(row.chapterText)) {
        errors.push(`Concept ${row.number} has invalid or missing Chapter value "${row.chapterText}". Use a positive chapter number.`);
        continue;
      }
      if (!/^\d+$/.test(row.sectionText)) {
        errors.push(`Concept ${row.number} has invalid or missing Section value "${row.sectionText}". Use a positive section number.`);
        continue;
      }
      const chapter = Number(row.chapterText);
      const section = Number(row.sectionText);
      if (chapter < 1) errors.push(`Concept ${row.number} has invalid Chapter ${chapter}. Chapter numbers start at 1.`);
      if (section < 1) errors.push(`Concept ${row.number} has invalid Section ${section}. Section numbers start at 1 in each chapter.`);
      if (!chapterByNumber.has(chapter)) {
        errors.push(`Concept ${row.number} refers to Chapter ${chapter}, which is not listed under ## Chapters.`);
        continue;
      }
      const key = `${chapter}:${section}`;
      if (positions.has(key)) errors.push(`Concepts ${positions.get(key)} and ${row.number} both use Chapter ${chapter}, Section ${section}.`);
      else positions.set(key, row.number);
      mappings.set(row.number, { chapter, section });
    }
    for (const chapter of chapters) {
      const sectionNumbers = table.rows
        .map((row) => mappings.get(row.number))
        .filter((mapping) => mapping?.chapter === chapter.n)
        .map((mapping) => mapping.section)
        .sort((a, b) => a - b);
      sectionNumbers.forEach((section, index) => {
        if (section !== index + 1) errors.push(`Chapter ${chapter.n} has nonconsecutive Section numbering at ${section}. Sections must start at 1 with no gaps.`);
      });
    }
  } else if (chapterHeadings || structureHeadings) {
    const legacy = !chapterHeadings;
    chapters = chapterHeadings || structureHeadings;
    if (legacy && !hasBlock) errors.push('## Structure requires a Block column to map concepts to chapters.');
    const chapterByNumber = new Map(chapters.map((chapter) => [chapter.n, chapter]));
    for (const row of table.rows) {
      const value = legacy ? row.blockText : row.chapterText;
      const field = legacy ? 'Block' : 'Chapter';
      if (!/^\d+$/.test(value)) {
        errors.push(`Concept ${row.number} has invalid or missing ${field} value "${value}". Use a positive chapter number.`);
        continue;
      }
      const chapter = Number(value);
      if (chapter < 1) errors.push(`Concept ${row.number} has invalid ${field} ${chapter}. Chapter numbers start at 1.`);
      if (!chapterByNumber.has(chapter)) {
        errors.push(`Concept ${row.number} refers to ${field} ${chapter}, which has no matching entry under ## ${legacy ? 'Structure' : 'Chapters'}.`);
        continue;
      }
      const section = table.rows.filter((candidate) => {
        const mapped = legacy ? candidate.blockText : candidate.chapterText;
        return /^\d+$/.test(mapped) && Number(mapped) === chapter && candidate.number < row.number;
      }).length + 1;
      mappings.set(row.number, { chapter, section });
    }
  } else {
    chapters = [{ n: 1, name: metadata.title, description: '' }];
    table.rows.forEach((row, index) => mappings.set(row.number, { chapter: 1, section: index + 1 }));
  }

  if (errors.length) throw graphError(errors);
  return { ...metadata, chapters, rows: table.rows, mappings };
}

function parseLecture(file) {
  const filename = file.name || 'lecture.md';
  const text = String(file.text ?? '').replace(/^\uFEFF/, '');
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) throw new Error(`${filename}: malformed frontmatter. Start with --- and close it with --- on its own line.`);
  const fields = new Map();
  for (const line of frontmatter[1].split(/\r?\n/)) {
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const match = line.match(/^([A-Za-z][\w-]*):\s*(.*?)\s*$/);
    if (!match) throw new Error(`${filename}: malformed frontmatter line "${line}". Use key: value.`);
    const key = match[1].toLowerCase();
    if (fields.has(key)) throw new Error(`${filename}: duplicate frontmatter field "${key}".`);
    fields.set(key, match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, double, single) => double ?? single));
  }
  if (/^---\r?\n(?:[A-Za-z][\w-]*:.*\r?\n)+---(?:\r?\n|$)/m.test(text.slice(frontmatter[0].length))) {
    throw new Error(`${filename}: contains a second frontmatter block.`);
  }
  const status = fields.get('status');
  if (status !== undefined && status !== 'draft') throw new Error(`${filename}: frontmatter status must be "draft" or absent.`);
  if (status === 'draft' && fields.get('date')) throw new Error(`${filename}: a draft has no teaching date.`);
  if (status !== 'draft' && !fields.get('date')) throw new Error(`${filename}: frontmatter needs a non-empty date field.`);
  const conceptText = fields.get('concept') || '';
  if (!/^\d+$/.test(conceptText) || Number(conceptText) < 1) {
    throw new Error(`${filename}: frontmatter concept must be a positive integer.`);
  }
  const body = text.slice(frontmatter[0].length);
  const title = body.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim() || '';
  if (!title) throw new Error(`${filename}: has no first-level title.`);
  return {
    filename,
    concept: Number(conceptText),
    status: status === 'draft' ? 'draft' : 'lecture',
    title,
    display: titleCase(title),
    body: body.replace(/^#\s+.+?\s*$(?:\r?\n)?/m, '').replace(/^(?:\r?\n)+/, ''),
  };
}

function demote(body) {
  return body.replace(/^(#{1,6})\s/gm, (_, marks) => '#'.repeat(Math.min(6, marks.length + 1)) + ' ');
}

/** Parse a graph and its lecture files into ordered book chapters and sections. */
export function parseBookData(graphText, lectureFiles, { topicFallback = '' } = {}) {
  const graph = parseGraph(graphText, topicFallback);
  if (!lectureFiles.length) throw new Error('No lecture files found. Add Markdown lectures under the topic lectures/ folder.');

  const lectures = lectureFiles.map(parseLecture);
  const byConcept = new Map();
  for (const lecture of lectures) {
    if (byConcept.has(lecture.concept)) {
      throw new Error(`${lecture.filename}: concept ${lecture.concept} is already mapped by ${byConcept.get(lecture.concept).filename}. Each concept must have one lecture file.`);
    }
    byConcept.set(lecture.concept, lecture);
  }

  const conceptNumbers = new Set(graph.rows.map((row) => row.number));
  const orphans = lectures.filter((lecture) => !conceptNumbers.has(lecture.concept)).map((lecture) => lecture.filename);
  const units = [];
  const chapters = [];
  for (const chapter of graph.chapters) {
    const chapterUnits = graph.rows
      .map((row) => {
        const mapping = graph.mappings.get(row.number);
        const lecture = byConcept.get(row.number);
        if (!lecture || mapping?.chapter !== chapter.n) return null;
        return {
          concept: row.number,
          title: row.name,
          chapter: chapter.n,
          section: mapping.section,
          status: lecture.status,
          body: demote(lecture.body).trim(),
          sourceTitle: lecture.title,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.section - b.section);
    if (!chapterUnits.length) continue;
    chapters.push({ n: chapter.n, name: titleCase(chapter.name), description: chapter.description, count: chapterUnits.length });
    units.push(...chapterUnits);
  }

  if (!units.length) throw new Error(`No lecture files match concepts in graph.md.${orphans.length ? ` Orphan lecture files: ${orphans.join(', ')}.` : ''}`);
  units.forEach((unit, index) => { unit.index = index; });
  const cjk = units.map((unit) => `${unit.sourceTitle}${unit.body}`).join(' ').match(/[\u4e00-\u9fff]/g) || [];
  return {
    title: graph.title,
    goal: graph.goal,
    lang: cjk.length > 30 ? 'zh' : 'en',
    chapters,
    units,
    orphans,
  };
}
