# runAudit · Wave 2 · Item Import — Expected-Result Fixture

**The release gate for `0003_item_register.sql`.** The importer decodes 11 real
fitting codes into the item register; this fixture is the exact target it
must hit. `main` stays red until every assertion below passes. Companion
machine-readable file: `../../backend/tests/runAudit/fixtures/wave2_item_import_expected.json`
(same source, generated together — no drift).

## How the test runs

1. Apply `0003_item_register.sql` to a clean test schema (with the Wave-1
   `location` + `employee` tables present).
2. Feed the importer the 11 input rows (code + description) below.
3. Assert the resulting `item`, `item_end`, and `item_attribute_value` rows
   match this fixture **exactly** — per-item and in aggregate.
4. Run the negative assertions and the auto-code test.
5. Any mismatch = audit fails = no merge.

## The guiding principle: honest decode

The importer extracts **only what the string states**. It never invents
domain facts. If a description doesn't name the material, gender, or
pressure, those stay `null` for a human to complete — the importer must not
guess them. This is what keeps the test deterministic and the data
trustworthy.

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

See `wave2_item_import_expected.json` for the full per-item expected result,
aggregate assertions, negative assertions, and the auto-code (D14) test.
