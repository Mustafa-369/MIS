// Fitting code/description decoder — the "honest decode" engine for the Wave-2
// item importer. Extracts only what the description text states (per the
// runAudit_wave2_item_import spec): tube/thread ends, fitting_type, seal and
// gender where the string names them. Never invents a domain fact — anything
// not present in the string is left null for a human to complete later.
//
// `code` is never parsed; only `description` feeds the decode.

// Ends topology per recognised fitting_type. This mirrors how a real DIN/BSP
// fitting catalogue is structured: the fitting_type name determines how the
// scanned size tokens map onto physical ends, not just token count.
//   union2   - a single DIN tube token describes both ends of a tube-to-tube
//              union (Straight Coupling, Bulkhead Connector); duplicate it.
//   sequence - one end per token found, in the order they appear in the text.
//   tee3     - a tee: the DIN token is the run (two identical ends), the
//              non-DIN token is the branch (one end).
//   single   - exactly one end, whatever standard the token is.
const FITTING_RECIPES = {
  'Straight Coupling':    { topology: 'union2',   genderRule: null },
  'Bulkhead Connector':   { topology: 'union2',   genderRule: null },
  'Male Stud Coupling':   { topology: 'sequence', genderRule: 'male-non-din' },
  'Male Stud Branch Tee': { topology: 'tee3',     genderRule: 'male-non-din' },
  'Metric Nut':           { topology: 'single',   genderRule: 'female-din' },
  'Ferrule':              { topology: 'single',   genderRule: null },
  'Hose Adapter':         { topology: 'sequence', genderRule: null },
  'Sealing Plug':         { topology: 'single',   genderRule: 'male-single' },
}
const DEFAULT_RECIPE = { topology: 'sequence', genderRule: null }

// One combined scan, left to right, so end order matches the order tokens
// appear in the description. More specific alternatives are tried first at
// each position so a bare-number match never steals digits that belong to a
// DIN/BSP/BSPT/NPT/metric token.
const TOKEN_RE =
  /(?<din>\b\d+[LS]\b)|(?<bspp>G(?:\d+-\d+\/\d+|\d+\/\d+|\d+)"?)|(?<bspt>R(?:\d+\/\d+)"?)|(?<npt>NPT(?:\d+-\d+\/\d+|\d+\/\d+|\d+)"?)|(?<metric>M\d+\s*[xX]\s*\d+(?:\.\d+)?)|(?<bare>(?<![\S])\d+(?![\S]))/g

function scanTokens(description) {
  const tokens = []
  let metricThread = null
  for (const m of description.matchAll(TOKEN_RE)) {
    if (m.groups.din) {
      tokens.push({ standard: 'din_metric_dko', sizeValue: m.groups.din })
    } else if (m.groups.bspp) {
      tokens.push({ standard: 'bspp', sizeValue: m.groups.bspp.replace(/"$/, '') })
    } else if (m.groups.bspt) {
      tokens.push({ standard: 'bspt', sizeValue: m.groups.bspt.replace(/"$/, '') })
    } else if (m.groups.npt) {
      tokens.push({ standard: 'npt', sizeValue: m.groups.npt.replace(/"$/, '') })
    } else if (m.groups.metric) {
      const [, a, b] = m.groups.metric.match(/M(\d+)\s*[xX]\s*(\d+(?:\.\d+)?)/)
      metricThread = `M${a}x${b}`
    } else if (m.groups.bare) {
      tokens.push({ standard: 'din_metric_dko', sizeValue: m.groups.bare, seriesUnknown: true })
    }
  }
  return { tokens, metricThread }
}

function hasConeSeal(description) {
  return /Straight\s*-\s*Union|24°?\s*Taper/i.test(description)
}

function hasEdOringSeal(description) {
  return /\bED\b/.test(description)
}

function matchFittingType(description, fittingTypeOptions) {
  const candidates = [...fittingTypeOptions].sort((a, b) => b.length - a.length)
  const lower = description.toLowerCase()
  for (const option of candidates) {
    if (lower.includes(option.toLowerCase())) return option
  }
  return null
}

function baseEnd(token) {
  return {
    connection_standard: token.standard,
    size_value: token.sizeValue,
    size_basis: token.standard === 'din_metric_dko' ? 'tube_od_mm_series' : 'nominal_inch',
    thread: token.standard === 'din_metric_dko' ? null : token.sizeValue,
    gender: null,
    seal_type: null,
  }
}

function applyGenderRule(ends, genderRule) {
  if (!genderRule) return
  if (genderRule === 'female-din') {
    for (const end of ends) if (end.connection_standard === 'din_metric_dko') end.gender = 'female'
  } else if (genderRule === 'male-single') {
    if (ends.length === 1) ends[0].gender = 'male'
  } else if (genderRule === 'male-non-din') {
    for (const end of ends) if (end.connection_standard !== 'din_metric_dko') end.gender = 'male'
  }
}

function applySeals(ends, { coneSeal, edOring }) {
  if (coneSeal) {
    for (const end of ends) if (end.connection_standard === 'din_metric_dko') end.seal_type = '24_cone'
  }
  if (edOring) {
    const nonDin = ends.filter((e) => e.connection_standard !== 'din_metric_dko')
    const targets = nonDin.length > 0 ? nonDin : ends
    for (const end of targets) end.seal_type = 'ed_oring'
  }
}

function applyMetricThread(ends, metricThread) {
  if (!metricThread) return
  for (const end of ends) if (end.connection_standard === 'din_metric_dko') end.thread = metricThread
}

function buildEnds(tokens, topology) {
  if (topology === 'union2') {
    if (tokens.length !== 1) {
      throw new Error(`union2 topology expects exactly 1 size token, found ${tokens.length}`)
    }
    const end = baseEnd(tokens[0])
    return [{ ...end }, { ...end }]
  }
  if (topology === 'tee3') {
    const din = tokens.find((t) => t.standard === 'din_metric_dko')
    const branch = tokens.find((t) => t.standard !== 'din_metric_dko')
    if (!din || !branch) throw new Error('tee3 topology expects one DIN run token and one branch token')
    const runEnd = baseEnd(din)
    return [{ ...runEnd }, { ...runEnd }, baseEnd(branch)]
  }
  if (topology === 'single') {
    if (tokens.length !== 1) {
      throw new Error(`single topology expects exactly 1 size token, found ${tokens.length}`)
    }
    return [baseEnd(tokens[0])]
  }
  // sequence: one end per token, in the order found
  return tokens.map(baseEnd)
}

/**
 * Decode a fitting's description into item/ends/fitting_type. `code` is
 * accepted only for pass-through (verbatim, never parsed).
 * `fittingTypeOptions` is the controlled list of fitting_type values from
 * attribute_option — matching against it, not free text, is what keeps
 * fitting_type a typed slot rather than an invented string.
 */
export function decodeFitting({ code = null, description }, { fittingTypeOptions }) {
  if (!description || !description.trim()) {
    throw new Error('description is required to decode a fitting')
  }
  const trimmed = description.trim()

  const fittingType = matchFittingType(trimmed, fittingTypeOptions)
  if (!fittingType) {
    throw new Error(`could not determine fitting_type from description: "${trimmed}"`)
  }

  const recipe = FITTING_RECIPES[fittingType] || DEFAULT_RECIPE
  const { tokens, metricThread } = scanTokens(trimmed)
  const coneSeal = hasConeSeal(trimmed)
  const edOring = hasEdOringSeal(trimmed)

  const ends = buildEnds(tokens, recipe.topology)
  applyMetricThread(ends, metricThread)
  applySeals(ends, { coneSeal, edOring })
  applyGenderRule(ends, recipe.genderRule)

  ends.forEach((end, i) => {
    end.end_seq = i + 1
  })

  return {
    code,
    name: trimmed,
    category: 'fitting',
    base_uom: 'pc',
    status: 'active',
    material: null,
    procurement_mode: 'in_app',
    fitting_type: fittingType,
    ends,
  }
}
