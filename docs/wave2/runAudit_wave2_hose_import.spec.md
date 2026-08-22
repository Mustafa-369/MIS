# runAudit · Wave 2 · Hose + End-Fitting Import — Expected-Result Fixture

**The release gate for `0004_hose_endfitting_attributes.sql`.** The importer
decodes 11 real hose and hose-end-fitting rows onto the item register this
migration extends. Companion machine-readable file:
`../../backend/tests/runAudit/fixtures/wave2_hose_import_expected.json`
(same source, generated together — no drift).

> Note: no `runAudit_wave2_hose_import.spec.md` existed anywhere in the repo
> or in the round's inputs — only the JSON fixture and the migration were
> committed. This document was written from the JSON fixture plus the
> migration's locked decisions (H4, H9, EF2, EF3, EF6, R1, R2) to describe
> the decode rules the importer actually implements.

## How the test runs

1. Apply `0004_hose_endfitting_attributes.sql` on top of the item register
   (`0003_item_register.sql`) — purely additive, nothing dropped or altered
   in a breaking way.
2. Feed the importer the 11 input rows (kind + code + description) below.
3. Assert the resulting `item`, `item_end`, and `item_attribute_value` rows
   match the fixture exactly — per-item and in aggregate.
4. Run the negative assertions.

## The guiding principle: honest decode, extended

Same rule as the item importer: extract only what the string states. Two
kinds of exception are still honest, not invented:
- **Reference lookups from a recognised, stated token** — e.g. `R1/1SN`'s
  225 bar working pressure, or a `DKO` end's `dko` seal. The fact is stated
  *through* the standard's name, which the string does name.
- **Structural defaults for a fitting family** — e.g. a Camlock/Flange
  defaults to `Single-piece` / `Straight` / `Weld (TIG)` because those are
  physically true of that coupler family absent a stated override, not a
  guess about this particular part.

Anything not implied by a recognised token stays null (e.g. no
`pressure_rating` is ever written on a fitting — R1 rule).

## Import rules

- **hose** — category=hose · base_uom=metre · one item row, **zero**
  `item_end` rows (raw hose isn't terminated).
- **end-fitting** — category=fitting · base_uom=pc · `is_manufacturable=1`
  · exactly two `item_end` rows: one `end_kind='hose'` (bore only, no
  connection standard — it crimps/welds onto the hose) and one
  `end_kind='connection'` (the port that mates to the machine).
- **code** — existing supplier code kept verbatim; blank code auto-generates
  (D14), and the result is still editable afterwards.
- **material** — resolved to the material register where the string names
  it (SS304/SS316/PTFE/Brass); a rubber-class hose_standard (R1/R2 or
  4SP/4SH family) implies material=Rubber; an end-fitting with no material
  named defaults to MS (mild steel, the default construction material for
  crimp/weld hydraulic fittings in this catalogue).
- **bore** — stored as the canonical dash number (`size_reference.dash`),
  never the raw inch string, so a 1/2" hose and a 1/2" fitting hose-end
  compare equal automatically (R2).
- **hose_family** — carries the pressure class: `R1/R2` = braided,
  `4SP/4SH` = spiral, `INDUSTRIAL` = SS/PTFE/camlock/flange stock. No
  separate `pressure_rating` attribute is ever written on a fitting (R1).

## Decode rules — hose

| Token | Produces |
|---|---|
| A brand/series/hose_standard/hose_construction option, as an in-order word sequence anywhere in the text (words may be non-contiguous, e.g. "SS **304** Corrugated" -> series "SS Corrugated") | that option, preferring the most specific (most words, then longest) match |
| A named standard (`R1/1SN`, `Convoluted`, ...) vs. a generic wire-count token (`1W/B`, `2W/B`) both present | the named standard wins (checked first by specificity) |
| Trailing `<n>"` / `<a>/<b>"` / `<a>-<b>/<c>"` | the hose's bore, looked up against `size_reference.inch` to get the canonical dash |
| Recognised `hose_standard` | `working_pressure` (bar) and default `hose_construction`, from a fixed industry table, only when the standard has one |
| `hose_standard` prefix `R1`/`R2` | `hose_family = R1/R2` |
| `hose_standard` prefix `4SP`/`4SH` | `hose_family = 4SP/4SH` |
| anything else | `hose_family = INDUSTRIAL` |
| `SS 304` / `SS 316` / `PTFE` / `Brass` | that material; else Rubber if hose_family is R1/R2 or 4SP/4SH, else null |

## Decode rules — end-fitting

| Token | Produces |
|---|---|
| `Camlock` | `connection_standard=camlock`, `fitting_type=Camlock` |
| `Flange` (+ `ASA <n>`) | `connection_standard=sae_flange`, `fitting_type=Flange`, size_value carries the ASA class |
| `TC` | `connection_standard=tc_triclamp`, `fitting_type=TC` |
| `DKO` + `<bore>-[M<a>x<b>]-L<n>` | `connection_standard=din_metric_dko`, thread=`M<a>x<b>`, size_value=`M<a>x<b>-L<n>`, `seal_type=dko` |
| `<bore> x <size>` + `NPT` | `connection_standard=npt`, thread=`<size> NPT` |
| `<bore> x <size>` + `BSPT` | `connection_standard=bspt`, thread=`R<size>` (never merged with NPT) |
| `<bore> x <size>` + `BSP` | `connection_standard=bspp`, thread=`G<size>` |
| `Female` / `Male` | end gender (only on the connection end) |
| leading `1+1+1` / `1+1` / else | `fitting_construction` = Three-piece / Two-piece / Single-piece (default) |
| `<n>deg` / else | `bend_angle` = that number / Straight (default) |
| `fitting_type == Hose End-Fitting` | `termination_method=Crimp`, `hose_family=R1/R2` |
| `fitting_type` is Camlock/Flange/TC | `termination_method=Weld (TIG)`, `hose_family=INDUSTRIAL` |

See `wave2_hose_import_expected.json` for the full per-item expected result
and the aggregate and negative assertions.
