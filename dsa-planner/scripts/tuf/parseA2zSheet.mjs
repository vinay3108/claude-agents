/**
 * Parse the A2Z sheet out of a takeUforward page (Next.js RSC flight data).
 *
 * The page embeds `sheet_syllabus` as { fields: [[...column names]], rows: [[fieldSetIndex, ...values]] }.
 * Problems are rows of type "item" with layoutType "practice". The outline tree
 * (`syllabusOutline.nodes`) gives each item's section path.
 */

const FLIGHT_CHUNK = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g

/** Join the RSC flight chunks into one string. */
export function readFlight(html) {
  let out = ''
  for (const m of html.matchAll(FLIGHT_CHUNK)) {
    try {
      out += JSON.parse(`"${m[1]}"`)
    } catch {
      // A malformed chunk only loses that chunk; keep the rest.
    }
  }
  return out
}

/** Read the JSON value (object or array) that starts at `start`, honouring strings. */
function readJsonValue(text, start) {
  const open = text[start]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (c === '\\') i++
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === open) depth++
    else if (c === close && --depth === 0) return JSON.parse(text.slice(start, i + 1))
  }
  throw new Error('Unterminated JSON value in page data')
}

function valueAfterKey(flight, key) {
  const at = flight.indexOf(`"${key}":`)
  if (at === -1) throw new Error(`"${key}" not found: the page layout may have changed`)
  return readJsonValue(flight, at + key.length + 3)
}

/** id -> ["Step", "Sub-step"] for every problem in the outline tree. */
function sectionPaths(nodes, trail = [], out = new Map()) {
  for (const node of nodes ?? []) {
    if (node.kind === 'problem') out.set(node.id, trail)
    else sectionPaths(node.children, [...trail, node.label], out)
  }
  return out
}

const LEETCODE = /^https:\/\/leetcode\.com\/problems\/([a-z0-9-]+)\/?/
const TUF_ORIGIN = 'https://takeuforward.org'

const absolute = (url) => {
  if (typeof url !== 'string' || !url || url.startsWith('$')) return null
  try {
    const u = new URL(url, TUF_ORIGIN)
    return u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

export function parseA2zSheet(html) {
  const flight = readFlight(html)
  const syllabus = valueAfterKey(flight, 'sheet_syllabus')
  const outline = valueAfterKey(flight, 'syllabusOutline')
  const paths = sectionPaths(outline.nodes)

  const problems = []
  for (const row of syllabus.rows ?? []) {
    const fields = syllabus.fields?.[row[0]]
    if (!fields) continue
    const rec = Object.fromEntries(fields.map((name, i) => [name, row[i + 1]]))
    if (rec.type !== 'item' || rec.layoutType !== 'practice') continue

    const leetcodeUrl = absolute(rec.leetcode_link)
    const path = paths.get(rec.id) ?? []
    problems.push({
      id: rec.id,
      slug: rec.slug,
      title: rec.label,
      difficulty: typeof rec.difficulty === 'string' ? rec.difficulty : null,
      step: path[0] ?? null,
      subStep: path[1] ?? null,
      status: rec.status === 'solved' ? 'solved' : rec.status === 'attempted' ? 'attempted' : 'unsolved',
      tufUrl: `${TUF_ORIGIN}/learning/dsa/${rec.slug}?source=strivers-a2z-dsa-sheet`,
      leetcodeUrl: leetcodeUrl && LEETCODE.test(leetcodeUrl) ? leetcodeUrl : null,
      leetcodeSlug: leetcodeUrl?.match(LEETCODE)?.[1] ?? null,
      videoUrl: absolute(rec.yt_video),
      articleUrl: absolute(rec.free_blog_link),
    })
  }

  // Keep the sheet order and drop duplicates (an item can appear in two sections).
  const seen = new Set()
  const unique = problems.filter((p) => !seen.has(p.id) && seen.add(p.id))
  return {
    summary: {
      problems: unique.length,
      sections: new Set(unique.map((p) => p.step)).size,
      solved: unique.filter((p) => p.status === 'solved').length,
      withLeetCode: unique.filter((p) => p.leetcodeSlug).length,
    },
    problems: unique,
  }
}
