-- =====================================================================
--  Migration : 0004_hose_endfitting_attributes.sql
--  Wave      : 2  ·  Hose + end-fitting templates, add-on parts, size ladder
--  Engine    : MySQL 8.0.46 · InnoDB · utf8mb4
--  Depends on: the item register (0003_item_register in the repo).
--  ADDITIVE ONLY — no table dropped, no column removed, no data disrupted.
--
--  Numbering: this is the next migration after the merged item register.
--  If the repo's item-register file is 0003, keep this 0004; Claude Code
--  confirms the next free number before applying.
--
--  Locked decisions this round:
--   H4  hose_standard is REQUIRED (identifies R1 vs R2, etc.)
--   H9  hose construction (1W/2W/convoluted) is its OWN attribute
--   EF2 bend angle = Straight / 45 / 90 only
--   EF3 construction = piece count (single / 1+1 / 1+1+1)
--   EF6 Camlock + Flange are fitting types; TC is a 7th connection standard
--   R1  rubber-fitting pressure class = hose_family (braided R1/R2 vs
--       spiral 4SP/4SH) -> NO separate pressure field on the fitting.
--       SS/PTFE carried by flange-class + material. (A rule, not DDL.)
--   R2  a shared size_reference ladder (dash <-> inch <-> mm <-> DN) so
--       "1in hose" and "-16 fitting" are known to be the same bore.
--   Add-on (Camlock+Flange, TC+Flange) = a Wave-5 order concept; here the
--       parts are just items. No new table for it.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. size_reference (R2) — the canonical bore ladder. dash = inch x 16.
-- ---------------------------------------------------------------------
CREATE TABLE size_reference (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dash       INT UNSIGNED    NOT NULL,          -- canonical key (bore in 1/16")
  inch       VARCHAR(12)     NOT NULL,          -- human label, e.g. 1-1/2"
  mm         DECIMAL(7,2)    NULL,              -- nominal bore mm
  dn         VARCHAR(10)     NULL,              -- DN label
  sort_order INT             NOT NULL DEFAULT 0,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_size_dash (dash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO size_reference (dash, inch, mm, dn, sort_order) VALUES
  (4,   '1/4"',    6.30, 'DN06', 1),
  (5,   '5/16"',   8.00, 'DN08', 2),
  (6,   '3/8"',   10.00, 'DN10', 3),
  (8,   '1/2"',   12.50, 'DN12', 4),
  (10,  '5/8"',   16.00, 'DN16', 5),
  (12,  '3/4"',   19.00, 'DN19', 6),
  (16,  '1"',     25.00, 'DN25', 7),
  (20,  '1-1/4"', 31.50, 'DN31', 8),
  (24,  '1-1/2"', 38.00, 'DN38', 9),
  (32,  '2"',     51.00, 'DN50', 10),
  (40,  '2-1/2"', 63.00, 'DN63', 11),
  (48,  '3"',     76.00, 'DN76', 12),
  (64,  '4"',    102.00, 'DN100', 13),
  (80,  '5"',    127.00, 'DN125', 14),
  (96,  '6"',    152.00, 'DN150', 15),
  (128, '8"',    203.00, 'DN200', 16),
  (160, '10"',   254.00, 'DN250', 17),
  (192, '12"',   305.00, 'DN300', 18);


-- ---------------------------------------------------------------------
-- 2. item_end — additive columns for the hose-end kind + canonical size,
--    plus TC on the connection-standard list. connection_standard is
--    relaxed to NULL because a HOSE end has no thread standard.
-- ---------------------------------------------------------------------
ALTER TABLE item_end
  ADD COLUMN end_kind ENUM('connection','hose') NOT NULL DEFAULT 'connection' AFTER end_seq,
  ADD COLUMN size_dash INT UNSIGNED NULL AFTER size_basis,
  MODIFY COLUMN connection_standard
    ENUM('din_metric_dko','bspp','bspt','jic','orfs','npt','sae_flange','tc_triclamp','camlock') NULL;

ALTER TABLE item_end
  ADD KEY idx_item_end_size (size_dash),
  ADD CONSTRAINT fk_item_end_size FOREIGN KEY (size_dash)
    REFERENCES size_reference (dash) ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------
-- 3. New attribute definitions (hose body + end-fitting body).
--    NOTE the deliberate split: hose_construction (wire/convolution) is a
--    DIFFERENT attribute from fitting_construction (piece count) — same
--    English word, different meaning, so two definitions, never merged.
-- ---------------------------------------------------------------------
INSERT INTO attribute_definition (code, label, data_type, uom_id) VALUES
  ('brand',                'Brand',                 'option', NULL),
  ('series',               'Series',                'option', NULL),
  ('hose_standard',        'Hose standard',         'option', NULL),
  ('hose_construction',    'Hose construction',     'option', NULL),
  ('bore',                 'Bore (dash)',           'number', NULL),
  ('working_pressure',     'Working pressure (bar)','number', NULL),
  ('hose_family',          'Hose family',           'option', NULL),
  ('bend_angle',           'Bend angle',            'option', NULL),
  ('fitting_construction', 'Construction (pieces)', 'option', NULL),
  ('termination_method',   'Termination method',    'option', NULL);


-- ---------------------------------------------------------------------
-- 4. Controlled option lists.
-- ---------------------------------------------------------------------
SET @a_brand := (SELECT id FROM attribute_definition WHERE code='brand');
INSERT INTO attribute_option (attribute_id, value, sort_order) VALUES
  (@a_brand,'Manuli',1),(@a_brand,'Manuli Ryco',2),(@a_brand,'Polyhose',3),(@a_brand,'Aaliqadr',4);

SET @a_series := (SELECT id FROM attribute_definition WHERE code='series');
INSERT INTO attribute_option (attribute_id, value, sort_order) VALUES
  (@a_series,'Farmaster',1),(@a_series,'Rockmaster',2),(@a_series,'Rubber Hydraulic',3),
  (@a_series,'Equator',4),(@a_series,'Diehard',5),(@a_series,'Silicone Braided',6),
  (@a_series,'SS Corrugated',7),(@a_series,'PTFE Convoluted',8);

SET @a_std := (SELECT id FROM attribute_definition WHERE code='hose_standard');
INSERT INTO attribute_option (attribute_id, value, sort_order) VALUES
  (@a_std,'R1/1SN',1),(@a_std,'R2/2SN',2),(@a_std,'R1AT/1SN',3),(@a_std,'R2AT/2SN',4),
  (@a_std,'4SP',5),(@a_std,'4SH',6),(@a_std,'R3',7),(@a_std,'R6',8),(@a_std,'09 Series',9),
  (@a_std,'Hi-Temp',10),(@a_std,'2W/B Steam',11),(@a_std,'1W/B',12),(@a_std,'2W/B',13),
  (@a_std,'Convoluted',14),(@a_std,'Silicone Braided',15);

SET @a_hcon := (SELECT id FROM attribute_definition WHERE code='hose_construction');
INSERT INTO attribute_option (attribute_id, value, sort_order) VALUES
  (@a_hcon,'1-wire braid',1),(@a_hcon,'2-wire braid',2),(@a_hcon,'4-spiral',3),
  (@a_hcon,'4-spiral heavy',4),(@a_hcon,'Corrugated',5),(@a_hcon,'Convoluted',6),(@a_hcon,'Braided',7);

SET @a_fam := (SELECT id FROM attribute_definition WHERE code='hose_family');
INSERT INTO attribute_option (attribute_id, value, sort_order) VALUES
  (@a_fam,'R1/R2',1),           -- braided pressure class (R1 rule)
  (@a_fam,'4SP/4SH',2),         -- spiral pressure class
  (@a_fam,'LP',3),(@a_fam,'INDUSTRIAL',4);

SET @a_bend := (SELECT id FROM attribute_definition WHERE code='bend_angle');
INSERT INTO attribute_option (attribute_id, value, sort_order) VALUES
  (@a_bend,'Straight',1),(@a_bend,'45',2),(@a_bend,'90',3);

SET @a_fcon := (SELECT id FROM attribute_definition WHERE code='fitting_construction');
INSERT INTO attribute_option (attribute_id, value, sort_order) VALUES
  (@a_fcon,'Single-piece',1),(@a_fcon,'Two-piece (1+1)',2),(@a_fcon,'Three-piece (1+1+1)',3);

SET @a_term := (SELECT id FROM attribute_definition WHERE code='termination_method');
INSERT INTO attribute_option (attribute_id, value, sort_order) VALUES
  (@a_term,'Crimp',1),(@a_term,'Weld (TIG)',2),(@a_term,'Flare',3),(@a_term,'Lining',4);

-- New fitting types (EF6): Camlock + Flange join the existing list.
SET @a_ft := (SELECT id FROM attribute_definition WHERE code='fitting_type');
INSERT INTO attribute_option (attribute_id, value, sort_order) VALUES
  (@a_ft,'Camlock',11),(@a_ft,'Flange',12),(@a_ft,'TC',13),(@a_ft,'Hose End-Fitting',14);


-- ---------------------------------------------------------------------
-- 5. Templates (category_attribute).
--    Hose category gets its columns; the fitting category gains the four
--    end-fitting attributes (shown for all fittings, blank where unused).
-- ---------------------------------------------------------------------
SET @cat_hose    := (SELECT id FROM item_category WHERE code='hose');
SET @cat_fitting := (SELECT id FROM item_category WHERE code='fitting');

INSERT INTO category_attribute (category_id, attribute_id, is_required, sort_order)
SELECT @cat_hose, ad.id, x.req, x.sort
FROM (
  SELECT 'brand' code, 0 req, 1 sort UNION ALL
  SELECT 'series',            0, 2  UNION ALL
  SELECT 'hose_standard',     1, 3  UNION ALL   -- H4 required
  SELECT 'hose_construction', 0, 4  UNION ALL
  SELECT 'bore',              1, 5  UNION ALL
  SELECT 'working_pressure',  0, 6  UNION ALL
  SELECT 'hose_family',       1, 7               -- compatibility key
) x JOIN attribute_definition ad ON ad.code = x.code;

INSERT INTO category_attribute (category_id, attribute_id, is_required, sort_order)
SELECT @cat_fitting, ad.id, 0, x.sort
FROM (
  SELECT 'bend_angle' code, 20 sort UNION ALL
  SELECT 'fitting_construction', 21 UNION ALL
  SELECT 'termination_method',   22 UNION ALL
  SELECT 'hose_family',          23
) x JOIN attribute_definition ad ON ad.code = x.code;

-- =====================================================================
--  END OF MIGRATION 0004_hose_endfitting_attributes.sql
-- =====================================================================
