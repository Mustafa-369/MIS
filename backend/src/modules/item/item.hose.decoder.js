// Hose + hose-end-fitting decoder — extends the Wave-2 "honest decode"
// importer to two new item kinds:
//   hose        - category=hose, no ends (raw hose isn't terminated).
//   endfitting  - category=fitting, exactly 2 ends: one hose end (crimps/
//                 welds onto the hose, no thread standard) and one
//                 connection end (the port that mates to the machine).
//
// Some fields here are not literal substrings of the input string but are
// derived from a recognised, stated token via a fixed industry-reference
// table (e.g. R1/1SN's 225 bar working pressure, or "DKO ends seal with a
// dko cone") — that's still honest decode: the fact is stated *through* the
// standard's name, not invented. Anything not implied by a recognised token
// stays null.

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function wordsOf(s) {
  return s.trim().split(/\s+/)
}

// True if every word of `words` appears in `text` as a whole word, in order
// (other text may sit between them). Used for brand/series/hose_standard
// matching against the controlled option lists — handles both contiguous
// phrases ("PTFE Convoluted") and split ones ("SS 304 Corrugated" -> "SS
// Corrugated", skipping the material-grade word in between).
function containsWordsInOrder(text, words) {
  let from = 0
  for (const w of words) {
    const re = new RegExp(`\\b${escapeRegExp(w)}\\b`, 'i')
    const m = text.slice(from).match(re)
    if (!m) return false
    from += m.index + m[0].length
  }
  return true
}

// Picks the most specific (most words, then longest) option that appears in
// the text. More specific options are tried first so e.g. "Convoluted"
// (a named standard) wins over the generic "1W/B" wire-count fallback when
// both literally occur in the same description.
function matchControlledOption(text, options) {
  const sorted = [...options].sort((a, b) => {
    const wc = wordsOf(b).length - wordsOf(a).length
    return wc !== 0 ? wc : b.length - a.length
  })
  for (const opt of sorted) {
    if (containsWordsInOrder(text, wordsOf(opt))) return opt
  }
  return null
}

function inchToken(text) {
  const matches = [...text.matchAll(/(\d+(?:-\d+\/\d+|\/\d+)?)"/g)]
  if (matches.length === 0) return null
  return matches[matches.length - 1][1]
}

function detectMaterial(text) {
  if (/SS\s*304/i.test(text)) return 'SS304'
  if (/SS\s*316/i.test(text)) return 'SS316'
  if (/PTFE/i.test(text)) return 'PTFE'
  if (/Brass/i.test(text)) return 'BRASS'
  return null
}

function classifyHoseFamily(hoseStandard) {
  if (hoseStandard && /^R1|^R2/.test(hoseStandard)) return 'R1/R2'
  if (hoseStandard && /^4SP|^4SH/.test(hoseStandard)) return '4SP/4SH'
  return 'INDUSTRIAL'
}

// Fixed industry reference: working pressure (bar) implied by a recognised
// hose_standard. Standards not listed here (e.g. bare "1W/B") have no safe
// default and stay null rather than guessed.
const PRESSURE_BY_STANDARD = {
  'R1/1SN': 225,
  'R2/2SN': 275,
  '4SP': 420,
  'R1AT/1SN': 225,
  Convoluted: 55,
}

// Fixed industry reference: construction implied by a recognised
// hose_standard, used only when the construction isn't literally named in
// the description (Corrugated/Convoluted/Braided are decoded directly).
const CONSTRUCTION_BY_STANDARD = {
  'R1/1SN': '1-wire braid',
  'R2/2SN': '2-wire braid',
  '4SP': '4-spiral',
  'R1AT/1SN': '1-wire braid',
}

/**
 * Decode a raw hose row. No ends are ever produced for a hose (it isn't
 * terminated yet). `refs` supplies the controlled option lists so matching
 * stays anchored to the DB's typed vocabulary, not free text.
 */
export function decodeHose({ code = null, description }, refs) {
  const trimmed = description.trim()

  const brand = matchControlledOption(trimmed, refs.brandOptions)
  const series = matchControlledOption(trimmed, refs.seriesOptions)
  const hoseStandard = matchControlledOption(trimmed, refs.hoseStandardOptions)
  if (!hoseStandard) throw new Error(`could not determine hose_standard from description: "${trimmed}"`)

  const literalConstruction = matchControlledOption(trimmed, refs.hoseConstructionOptions)
  const hoseConstruction = literalConstruction || CONSTRUCTION_BY_STANDARD[hoseStandard] || null

  const inch = inchToken(trimmed)
  if (!inch) throw new Error(`could not determine bore from description: "${trimmed}"`)

  const hoseFamily = classifyHoseFamily(hoseStandard)
  const workingPressure = Object.prototype.hasOwnProperty.call(PRESSURE_BY_STANDARD, hoseStandard)
    ? PRESSURE_BY_STANDARD[hoseStandard]
    : null

  const explicitMaterial = detectMaterial(trimmed)
  const material = explicitMaterial || (hoseFamily !== 'INDUSTRIAL' ? 'RUBBER' : null)

  const attributes = []
  if (brand) attributes.push({ code: 'brand', type: 'option', value: brand })
  if (series) attributes.push({ code: 'series', type: 'option', value: series })
  attributes.push({ code: 'hose_standard', type: 'option', value: hoseStandard })
  if (hoseConstruction) attributes.push({ code: 'hose_construction', type: 'option', value: hoseConstruction })
  attributes.push({ code: 'bore', type: 'number', value: null, inch })
  if (workingPressure != null) attributes.push({ code: 'working_pressure', type: 'number', value: workingPressure })
  attributes.push({ code: 'hose_family', type: 'option', value: hoseFamily })

  return {
    kind: 'hose',
    code,
    name: trimmed,
    category: 'hose',
    base_uom: 'm',
    status: 'active',
    material,
    isManufacturable: 0,
    ends: [],
    attributes,
  }
}

function detectGender(text) {
  if (/\bFemale\b/i.test(text)) return 'female'
  if (/\bMale\b/i.test(text)) return 'male'
  return null
}

function detectFittingConstruction(text) {
  if (/^1\+1\+1\b/.test(text)) return 'Three-piece (1+1+1)'
  if (/^1\+1\b/.test(text)) return 'Two-piece (1+1)'
  return 'Single-piece'
}

function detectBendAngle(text) {
  const m = text.match(/(\d+)\s*deg/i)
  if (m) return m[1]
  return 'Straight'
}

// Parses the connection end for the recognised coupler families. Each
// family has its own string grammar in this catalogue, so each gets its own
// parse rather than one universal regex.
function parseConnectionEnd(text) {
  if (/Camlock/i.test(text)) {
    const inch = inchToken(text)
    return { standard: 'camlock', fittingType: 'Camlock', inch, sizeValue: `${inch}"`, thread: null }
  }
  if (/Flange/i.test(text)) {
    const inch = inchToken(text)
    const rating = text.match(/ASA\s*(\d+)/i)
    const sizeValue = rating ? `${inch}" ASA${rating[1]}` : `${inch}"`
    return { standard: 'sae_flange', fittingType: 'Flange', inch, sizeValue, thread: null }
  }
  if (/\bTC\b/.test(text)) {
    const inch = inchToken(text)
    return { standard: 'tc_triclamp', fittingType: 'TC', inch, sizeValue: `${inch}"`, thread: null }
  }
  if (/DKO/i.test(text)) {
    const m = text.match(/(\d+(?:\/\d+)?)-\[(M\d+x[\d.]+)\]-L(\d+)/)
    if (!m) throw new Error(`could not parse DKO end from description: "${text}"`)
    const [, boreFraction, metricThread, length] = m
    return {
      standard: 'din_metric_dko',
      fittingType: 'Hose End-Fitting',
      inch: boreFraction,
      sizeValue: `${metricThread}-L${length}`,
      thread: metricThread,
      sealType: 'dko',
    }
  }
  const xMatch = text.match(/(\d+(?:\/\d+)?)\s*[xX]\s*(\d+(?:\/\d+)?)/)
  if (!xMatch) throw new Error(`could not find a hose x connection size in: "${text}"`)
  const [, hoseFraction, connFraction] = xMatch
  if (/NPT/i.test(text)) {
    return {
      standard: 'npt',
      fittingType: 'Hose End-Fitting',
      inch: hoseFraction,
      sizeValue: `${connFraction}"`,
      thread: `${connFraction} NPT`,
    }
  }
  if (/BSPT/i.test(text)) {
    return {
      standard: 'bspt',
      fittingType: 'Hose End-Fitting',
      inch: hoseFraction,
      sizeValue: `${connFraction}"`,
      thread: `R${connFraction}`,
    }
  }
  if (/BSP/i.test(text)) {
    return {
      standard: 'bspp',
      fittingType: 'Hose End-Fitting',
      inch: hoseFraction,
      sizeValue: `${connFraction}"`,
      thread: `G${connFraction}`,
    }
  }
  throw new Error(`could not determine connection standard from description: "${text}"`)
}

/**
 * Decode a hose end-fitting row. Always exactly 2 ends: a hose end (bore
 * only, no thread standard - it crimps/welds onto the hose) and a
 * connection end (the port that mates to the machine).
 */
export function decodeEndFitting({ code = null, description }) {
  const trimmed = description.trim()

  const parsed = parseConnectionEnd(trimmed)
  const gender = detectGender(trimmed)
  const fittingConstruction = detectFittingConstruction(trimmed)
  const bendAngle = detectBendAngle(trimmed)
  const isHoseEndFitting = parsed.fittingType === 'Hose End-Fitting'
  const terminationMethod = isHoseEndFitting ? 'Crimp' : 'Weld (TIG)'
  const hoseFamily = isHoseEndFitting ? 'R1/R2' : 'INDUSTRIAL'
  const material = detectMaterial(trimmed) || 'MS'

  const hoseEnd = {
    end_seq: 1,
    end_kind: 'hose',
    connection_standard: null,
    size_value: null,
    size_basis: 'dash',
    thread: null,
    gender: null,
    seal_type: null,
    inch: parsed.inch,
  }
  const connectionEnd = {
    end_seq: 2,
    end_kind: 'connection',
    connection_standard: parsed.standard,
    size_value: parsed.sizeValue,
    size_basis: null,
    thread: parsed.thread ?? null,
    gender: gender,
    seal_type: parsed.sealType ?? null,
  }

  return {
    kind: 'endfitting',
    code,
    name: trimmed,
    category: 'fitting',
    base_uom: 'pc',
    status: 'active',
    material,
    isManufacturable: 1,
    ends: [hoseEnd, connectionEnd],
    attributes: [
      { code: 'fitting_type', type: 'option', value: parsed.fittingType },
      { code: 'fitting_construction', type: 'option', value: fittingConstruction },
      { code: 'bend_angle', type: 'option', value: bendAngle },
      { code: 'termination_method', type: 'option', value: terminationMethod },
      { code: 'hose_family', type: 'option', value: hoseFamily },
    ],
  }
}
