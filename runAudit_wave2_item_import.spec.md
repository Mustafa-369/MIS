# runAudit · Wave 2 · Item Import — Expected-Result Fixture

**The release gate for `0002_item_register.sql`.** The importer decodes your 11 real fitting codes into the item register; this fixture is the exact target it must hit. `main` stays red until every assertion below passes. Companion machine-readable file: `wave2_item_import_expected.json` (same source, generated together — no drift).

## How the test runs

1. Apply `0002_item_register.sql` to a clean test schema (with the Wave-1 `location` + `employee` tables present).
2. Feed the importer the 11 input rows (code + description) below.
3. Assert the resulting `item`, `item_end`, and `item_attribute_value` rows match this fixture **exactly** — per-item and in aggregate.
4. Run the negative assertions and the auto-code test.
5. Any mismatch = audit fails = no merge.

## The guiding principle: honest decode

The importer extracts **only what the string states**. It never invents domain facts. If a description doesn't name the material, gender, or pressure, those stay `null` for a human to complete — the importer must not guess them. This is what keeps the test deterministic and the data trustworthy.

## Import rules (applied to every row)

- **category** — fitting (all 11)
- **base_uom** — pc  (fitting category default — discrete pieces)
- **status** — active  (imported items are live catalogue, not drafts)
- **material** — null  (not in the code-string; human-completed later)
- **code** — preserved verbatim (never normalised, never parsed)
- **name** — the original description text, trimmed
- **flags** — schema defaults — is_stockable=1, is_purchasable=1, is_sellable=0, is_manufacturable=0, critical=0
- **procurement_mode** — in_app (default)
- **body_attributes** — only fitting_type is decodable from the string -> one item_attribute_value per item, stored as value_option_id (never value_text)
- **ends** — one item_end row per physical port; standard decides size_basis
- **unstated_scalars** — pressure_rating, plating, seal_material, unit_weight, make, origin, gender(where not stated), material -> NOT created / null

## Decode rules (string → schema)

| Token in code / description | Produces |
|---|---|
| `<n>L` / `<n>S` | din_metric_dko · size_basis=tube_od_mm_series · size_value=`<n>L`/`<n>S` |
| bare `<n>` (ferrule) | din_metric_dko · tube_od_mm_series · size_value=`<n>` · series flagged unknown |
| `G<size>` | bspp · nominal_inch · size_value & thread = `G<size>` |
| `R<size>` | bspt · nominal_inch · size_value & thread = `R<size>` — **never** merged with NPT |
| `NPT<size>` | npt · nominal_inch |
| `M<a>x<b>` | metric thread on the relevant end |
| `[ Straight - Union ]` | seal_type=24_cone on the tube ends |
| `[ With 24° Taper ]` | seal_type=24_cone |
| `[ED]` | seal_type=ed_oring on the stud/port end |
| `Male Stud …` | stud/port end gender=male |
| `… Nut` | gender=female |
| `… Sealing Plug` | gender=male |
| leading noun phrase | fitting_type option |

## Per-item expected result

### `WA06L` — Straight Coupling
*Input:* `Straight Coupling [ Straight - Union ] - 6L [ M12 x 1.5 ]`  
*Why:* Tube-to-tube union: two identical 6L DIN ends, 24° cone seal, M12x1.5 nut thread.

**item:** code=`WA06L` · category=fitting · base_uom=pc · material=— · status=active · flags[stk=1,pur=1,sell=0,mfg=0,crit=0]

**item_end:**

| seq | standard | size_value | size_basis | thread | gender | seal_type |
|---|---|---|---|---|---|---|
| 1 | din_metric_dko | 6L | tube_od_mm_series | M12x1.5 | — | 24_cone |
| 2 | din_metric_dko | 6L | tube_od_mm_series | M12x1.5 | — | 24_cone |

**item_attribute_value:** fitting_type → option `Straight Coupling` (stored in `value_option_id`)

### `WD06L` — Bulkhead Connector
*Input:* `Bulkhead Connector [ With 24° Taper ] - 6L [ M12 x 1.5 ]`  
*Why:* Panel pass-through: two 6L DIN ends, 24° cone seal.

**item:** code=`WD06L` · category=fitting · base_uom=pc · material=— · status=active · flags[stk=1,pur=1,sell=0,mfg=0,crit=0]

**item_end:**

| seq | standard | size_value | size_basis | thread | gender | seal_type |
|---|---|---|---|---|---|---|
| 1 | din_metric_dko | 6L | tube_od_mm_series | M12x1.5 | — | 24_cone |
| 2 | din_metric_dko | 6L | tube_od_mm_series | M12x1.5 | — | 24_cone |

**item_attribute_value:** fitting_type → option `Bulkhead Connector` (stored in `value_option_id`)

### `WF35L-24` — Male Stud Coupling
*Input:* `Male Stud Coupling [ Straight Stud Fittings ] - 35L X G1-1/2"`  
*Why:* THE cross-standard case: End A DIN 35L tube, End B BSPP G1-1/2 male stud. Proves two standards on one body.

**item:** code=`WF35L-24` · category=fitting · base_uom=pc · material=— · status=active · flags[stk=1,pur=1,sell=0,mfg=0,crit=0]

**item_end:**

| seq | standard | size_value | size_basis | thread | gender | seal_type |
|---|---|---|---|---|---|---|
| 1 | din_metric_dko | 35L | tube_od_mm_series | — | — | — |
| 2 | bspp | G1-1/2 | nominal_inch | G1-1/2 | male | — |

end 1: tube end; nut thread not in string

**item_attribute_value:** fitting_type → option `Male Stud Coupling` (stored in `value_option_id`)

### `WF20S-16` — Male Stud Coupling
*Input:* `Male Stud Coupling [ Straight Stud Fittings ] - 20S X G1"`  
*Why:* DIN heavy (S) series + BSPP male stud.

**item:** code=`WF20S-16` · category=fitting · base_uom=pc · material=— · status=active · flags[stk=1,pur=1,sell=0,mfg=0,crit=0]

**item_end:**

| seq | standard | size_value | size_basis | thread | gender | seal_type |
|---|---|---|---|---|---|---|
| 1 | din_metric_dko | 20S | tube_od_mm_series | — | — | — |
| 2 | bspp | G1 | nominal_inch | G1 | male | — |

end 1: heavy series

**item_attribute_value:** fitting_type → option `Male Stud Coupling` (stored in `value_option_id`)

### `WG06S-2` — Male Stud Coupling
*Input:* `Male Stud Coupling [ED] [ Straight Stud Fittings ] - 6S X G1/8"`  
*Why:* ED (elastomer O-ring) seal lands on the BSP stud end, not the DIN end.

**item:** code=`WG06S-2` · category=fitting · base_uom=pc · material=— · status=active · flags[stk=1,pur=1,sell=0,mfg=0,crit=0]

**item_end:**

| seq | standard | size_value | size_basis | thread | gender | seal_type |
|---|---|---|---|---|---|---|
| 1 | din_metric_dko | 6S | tube_od_mm_series | — | — | — |
| 2 | bspp | G1/8 | nominal_inch | G1/8 | male | ed_oring |

end 2: ED soft seal on the stud end

**item_attribute_value:** fitting_type → option `Male Stud Coupling` (stored in `value_option_id`)

### `WJ22L-12` — Male Stud Branch Tee
*Input:* `Male Stud Branch Tee - 22L X R3/4"`  
*Why:* THREE ends (run 22L + 22L, branch R3/4). Proves +end. R = BSPT, kept SEPARATE from NPT.

**item:** code=`WJ22L-12` · category=fitting · base_uom=pc · material=— · status=active · flags[stk=1,pur=1,sell=0,mfg=0,crit=0]

**item_end:**

| seq | standard | size_value | size_basis | thread | gender | seal_type |
|---|---|---|---|---|---|---|
| 1 | din_metric_dko | 22L | tube_od_mm_series | — | — | — |
| 2 | din_metric_dko | 22L | tube_od_mm_series | — | — | — |
| 3 | bspt | R3/4 | nominal_inch | R3/4 | male | — |

end 1: run end · end 2: run end · end 3: branch stud

**item_attribute_value:** fitting_type → option `Male Stud Branch Tee` (stored in `value_option_id`)

### `NT25S` — Metric Nut
*Input:* `Metric Nut - 25S [ M36 x 2.0 ]`  
*Why:* Single end. A nut is internally threaded -> gender female.

**item:** code=`NT25S` · category=fitting · base_uom=pc · material=— · status=active · flags[stk=1,pur=1,sell=0,mfg=0,crit=0]

**item_end:**

| seq | standard | size_value | size_basis | thread | gender | seal_type |
|---|---|---|---|---|---|---|
| 1 | din_metric_dko | 25S | tube_od_mm_series | M36x2.0 | female | — |

**item_attribute_value:** fitting_type → option `Metric Nut` (stored in `value_option_id`)

### `FL10` — Ferrule
*Input:* `Ferrule - 10`  
*Why:* Minimal end: size only, no thread/gender/seal. Series unknown -> data-quality flag, not an invention.

**item:** code=`FL10` · category=fitting · base_uom=pc · material=— · status=active · flags[stk=1,pur=1,sell=0,mfg=0,crit=0]

**item_end:**

| seq | standard | size_value | size_basis | thread | gender | seal_type |
|---|---|---|---|---|---|---|
| 1 | din_metric_dko | 10 | tube_od_mm_series | — | — | — |

end 1: series (L/S) not in string -> flag for completion

**item_attribute_value:** fitting_type → option `Ferrule` (stored in `value_option_id`)

### `O-1106-06` — Hose Adapter
*Input:* `Straight Connector - Hose Adapter [ G3/8" X G3/8" ]`  
*Why:* All-BSP two-end adapter (no DIN). Gender not stated -> null.

**item:** code=`O-1106-06` · category=fitting · base_uom=pc · material=— · status=active · flags[stk=1,pur=1,sell=0,mfg=0,crit=0]

**item_end:**

| seq | standard | size_value | size_basis | thread | gender | seal_type |
|---|---|---|---|---|---|---|
| 1 | bspp | G3/8 | nominal_inch | G3/8 | — | — |
| 2 | bspp | G3/8 | nominal_inch | G3/8 | — | — |

**item_attribute_value:** fitting_type → option `Hose Adapter` (stored in `value_option_id`)

### `O-1108-04` — Hose Adapter
*Input:* `Straight Connector - Hose Adapter [ G1/2" X G1/4" ]`  
*Why:* Unequal two-end BSP adapter (G1/2 x G1/4).

**item:** code=`O-1108-04` · category=fitting · base_uom=pc · material=— · status=active · flags[stk=1,pur=1,sell=0,mfg=0,crit=0]

**item_end:**

| seq | standard | size_value | size_basis | thread | gender | seal_type |
|---|---|---|---|---|---|---|
| 1 | bspp | G1/2 | nominal_inch | G1/2 | — | — |
| 2 | bspp | G1/4 | nominal_inch | G1/4 | — | — |

**item_attribute_value:** fitting_type → option `Hose Adapter` (stored in `value_option_id`)

### `VSTI-24` — Sealing Plug
*Input:* `Allen Key Sealing Plug - ED [ G1-1/2" ]`  
*Why:* Single male BSP end, ED seal. 'Allen key' = internal-hex drive -> item.notes, not an end.

**item:** code=`VSTI-24` · category=fitting · base_uom=pc · material=— · status=active · flags[stk=1,pur=1,sell=0,mfg=0,crit=0]

**item_end:**

| seq | standard | size_value | size_basis | thread | gender | seal_type |
|---|---|---|---|---|---|---|
| 1 | bspp | G1-1/2 | nominal_inch | G1-1/2 | male | ed_oring |

**item_attribute_value:** fitting_type → option `Sealing Plug` (stored in `value_option_id`)

## Aggregate assertions

- **11** item rows, every one `category = fitting`.
- **20** item_end rows total.
- **11** item_attribute_value rows (one fitting_type each).
- Ends by standard: din_metric_dko=**11**, bspp=**8**, bspt=**1**, npt=**0**.
- Gender: **5** male ends, **1** female end.
- Seal: **4** × 24_cone, **2** × ed_oring.

## Negative assertions (the five bug-class guards)

- No dash size ever lands on a DIN end (size_basis for din_metric_dko is ALWAYS tube_od_mm_series).
- BSPT (R3/4 on WJ22L-12) is stored as connection_standard='bspt', NEVER 'npt' and NEVER merged.
- fitting_type is stored in value_option_id, NEVER in value_text (typed-slot rule; guards coercion hazard).
- WF35L-24 yields exactly 2 ends and WJ22L-12 exactly 3 — no end is dropped (guards silent-drop).
- Codes are byte-for-byte preserved: 'WF35L-24' stays 'WF35L-24' (no case-fold, no re-generation).
- No item gets a material, pressure_rating, plating, gender(unstated), etc. that wasn't in its string.

## Supplementary: auto-code test (D14)

Prove auto-generation + editability (D14) for un-coded rows (none of the 11 are un-coded).

*Input:* code=`(blank)`, description=`Sealing Plug - ED [ G1/4" ]`

*Assert:*
- A non-empty code is generated and is UNIQUE against all existing codes.
- The generated code is subsequently editable (update to a new unique value succeeds).
- The item still imports with 1 BSPP end (G1/4, male, ed_oring) and fitting_type=Sealing Plug.
