-- =====================================================================
--  Migration : 0003_item_register.sql
--  Wave      : 2  ·  Item register (pillar 3 of 4)
--  Engine    : MySQL 8.0.46 · InnoDB · utf8mb4
--  Depends on: 0000 (location) and 0001 (employee).
--  Forward-only. The migration runner tracks applied migrations; this
--  file is not written to be re-run (no IF NOT EXISTS).
--
--  Design authority: decisions D1–D14 + FD-02, and the standard-driven,
--  ends-based fitting model locked in the Wave-2 design chat.
--
--  External references verified against the Wave-0/Wave-1 schema before
--  this migration was applied:
--    (a) item_location.location_id  -> location(id)  [0000_wave0_foundation.sql, BIGINT UNSIGNED PK]
--    (b) validation_record.stamped_by -> employee(id) [0001_wave1_people_machines.sql, BIGINT UNSIGNED PK]
--  Both confirmed; no renaming needed.
-- =====================================================================


-- =====================================================================
--  GROUP 1 · REFERENCE REGISTERS
-- =====================================================================

-- 1. item_category ----------------------------------------------------
--    The 8 buckets. Category drives the attribute template (see
--    category_attribute) and, later, whether lots are mandatory.
CREATE TABLE item_category (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code          VARCHAR(32)     NOT NULL,
  name          VARCHAR(120)    NOT NULL,
  lot_mandatory TINYINT(1)      NOT NULL DEFAULT 0,   -- refined in W4 when lots arrive
  sort_order    INT             NOT NULL DEFAULT 0,
  is_active     TINYINT(1)      NOT NULL DEFAULT 1,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_item_category_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 2. material ---------------------------------------------------------
--    First-class register (D6): cost is per grade, salvage is per
--    material. Density feeds weight-costing in W3.5 (nullable now).
CREATE TABLE material (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code         VARCHAR(32)     NOT NULL,
  name         VARCHAR(120)    NOT NULL,
  grade        VARCHAR(60)     NULL,
  standard     VARCHAR(60)     NULL,
  density      DECIMAL(8,3)    NULL,   -- g/cc
  salvage_rate DECIMAL(12,2)   NULL,   -- INR/kg, populated later (CN-04)
  is_active    TINYINT(1)      NOT NULL DEFAULT 1,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_material_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. unit_of_measure --------------------------------------------------
--    The base UoM is the "money-and-count" unit. Per-item purchase-unit
--    conversion (D5, bar in lengths -> kg) lives on `item`, not here.
CREATE TABLE unit_of_measure (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code       VARCHAR(16)     NOT NULL,
  name       VARCHAR(60)     NOT NULL,
  dimension  ENUM('weight','length','count','volume','other') NOT NULL,
  is_active  TINYINT(1)      NOT NULL DEFAULT 1,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_uom_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- =====================================================================
--  GROUP 2 · ATTRIBUTE ENGINE (D1, Option C)
--  Typed registry: define once, list controlled values, template per
--  category, store into the right typed slot. Kills coercion hazard
--  and enumeration drift.
-- =====================================================================

-- 4. attribute_definition ---------------------------------------------
CREATE TABLE attribute_definition (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code            VARCHAR(48)     NOT NULL,
  label           VARCHAR(120)    NOT NULL,
  data_type       ENUM('number','text','boolean','option') NOT NULL,
  uom_id          BIGINT UNSIGNED NULL,             -- for numeric attributes (e.g. unit_weight -> kg)
  validation_json JSON            NULL,             -- {min,max,pattern,...} enforced by the engine
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attr_def_code (code),
  KEY idx_attr_def_uom (uom_id),
  CONSTRAINT fk_attr_def_uom FOREIGN KEY (uom_id)
    REFERENCES unit_of_measure (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 5. attribute_option -------------------------------------------------
--    Controlled list for data_type = 'option'. One canonical value, so
--    "SS316 / ss-316 / 316SS" can never coexist.
CREATE TABLE attribute_option (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  attribute_id BIGINT UNSIGNED NOT NULL,
  value        VARCHAR(120)    NOT NULL,
  label        VARCHAR(120)    NULL,
  sort_order   INT             NOT NULL DEFAULT 0,
  is_active    TINYINT(1)      NOT NULL DEFAULT 1,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attr_option (attribute_id, value),
  CONSTRAINT fk_attr_option_def FOREIGN KEY (attribute_id)
    REFERENCES attribute_definition (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 6. category_attribute -----------------------------------------------
--    The template: which attributes a category shows, required vs
--    optional, and display order. This IS the grid's column set.
CREATE TABLE category_attribute (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id  BIGINT UNSIGNED NOT NULL,
  attribute_id BIGINT UNSIGNED NOT NULL,
  is_required  TINYINT(1)      NOT NULL DEFAULT 0,
  sort_order   INT             NOT NULL DEFAULT 0,
  created_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cat_attr (category_id, attribute_id),
  KEY idx_cat_attr_attr (attribute_id),
  CONSTRAINT fk_cat_attr_category FOREIGN KEY (category_id)
    REFERENCES item_category (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_cat_attr_def FOREIGN KEY (attribute_id)
    REFERENCES attribute_definition (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- =====================================================================
--  GROUP 3 · CORE
-- =====================================================================

-- 7. item -------------------------------------------------------------
--    The master row. Custom one-offs are NOT here (D12) — they live as
--    order lines. Nature is capability flags (D3), never a rigid enum.
CREATE TABLE item (
  id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code                     VARCHAR(24)     NOT NULL,        -- auto-generated + editable (D14); legacy codes kept verbatim; never parsed
  name                     VARCHAR(255)    NOT NULL,
  category_id              BIGINT UNSIGNED NOT NULL,
  material_id              BIGINT UNSIGNED NULL,
  base_uom_id              BIGINT UNSIGNED NOT NULL,        -- the money-and-count unit (kg for bar, D5)
  purchase_uom_id          BIGINT UNSIGNED NULL,            -- only if bought in a different unit
  purchase_to_stock_factor DECIMAL(16,6)   NULL,            -- stock units per purchase unit (e.g. kg per length)
  procurement_mode         ENUM('bulk','in_app') NOT NULL DEFAULT 'in_app',
  is_stockable             TINYINT(1)      NOT NULL DEFAULT 1,
  is_purchasable           TINYINT(1)      NOT NULL DEFAULT 1,
  is_sellable               TINYINT(1)      NOT NULL DEFAULT 0,
  is_manufacturable        TINYINT(1)      NOT NULL DEFAULT 0,   -- Y = has/will have a BOM (W3). "Assembly" means this is Y.
  critical                 TINYINT(1)      NOT NULL DEFAULT 0,   -- Y forces a 2nd Director sign-off at the QC gate (D8; enforced W5)
  status                   ENUM('draft','active','obsolete') NOT NULL DEFAULT 'draft',
  is_active                TINYINT(1)      NOT NULL DEFAULT 1,   -- soft-delete (never hard-erase, N-07)
  hsn_code                 VARCHAR(12)     NULL,            -- identity, NOT tax (N-05)
  design_file_ref          VARCHAR(255)    NULL,            -- W5 document-vault seam
  notes                    TEXT            NULL,
  created_at               TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at               TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_item_code (code),
  KEY idx_item_category (category_id),
  KEY idx_item_material (material_id),
  KEY idx_item_status (status),
  CONSTRAINT fk_item_category FOREIGN KEY (category_id)
    REFERENCES item_category (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_item_material FOREIGN KEY (material_id)
    REFERENCES material (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_item_base_uom FOREIGN KEY (base_uom_id)
    REFERENCES unit_of_measure (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_item_purchase_uom FOREIGN KEY (purchase_uom_id)
    REFERENCES unit_of_measure (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 8. item_alias -------------------------------------------------------
--    Customer / vendor names that resolve back to one item (FD-02, F3).
--    party_id is nullable with NO FK yet — the party register is the
--    next Wave-2 round; add the FK in that migration.
CREATE TABLE item_alias (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id    BIGINT UNSIGNED NOT NULL,
  alias_text VARCHAR(255)    NOT NULL,
  party_id   BIGINT UNSIGNED NULL,                 -- FK deferred to the party-register migration
  alias_type ENUM('customer_name','customer_part_no','vendor_code','other') NOT NULL DEFAULT 'other',
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_item_alias_item (item_id),
  KEY idx_item_alias_text (alias_text),
  CONSTRAINT fk_item_alias_item FOREIGN KEY (item_id)
    REFERENCES item (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 9. item_location ----------------------------------------------------
--    Presence + reorder policy per (item, location) — D7. Two sites
--    replenish independently, so policy is never global. Bins are W4.
CREATE TABLE item_location (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id       BIGINT UNSIGNED NOT NULL,
  location_id   BIGINT UNSIGNED NOT NULL,           -- location(id) [Wave 0, 0000_wave0_foundation.sql]
  reorder_point DECIMAL(16,3)   NULL,
  reorder_qty   DECIMAL(16,3)   NULL,
  is_primary    TINYINT(1)      NOT NULL DEFAULT 0,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_item_location (item_id, location_id),
  KEY idx_item_location_loc (location_id),
  CONSTRAINT fk_item_location_item FOREIGN KEY (item_id)
    REFERENCES item (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_item_location_location FOREIGN KEY (location_id)
    REFERENCES location (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 10. item_end --------------------------------------------------------
--     The ends model. A fitting is a body + a set of ends; each end
--     carries its OWN connection standard, and the standard decides the
--     size language (DIN -> tube OD mm + L/S; JIC/ORFS -> dash;
--     BSP/NPT -> nominal inch). Handles cross-standard fittings
--     (WF35L-24 = DIN end + BSPP end), tees (3 ends), plugs (1 end).
--
--     connection_standard is an ENUM by deliberate choice: it is a
--     small, stable, safety-critical vocabulary (BSPT 55 deg vs NPT
--     60 deg must never merge). Adding a standard is an intentional
--     migration, like adding NPT was — not routine data entry.
CREATE TABLE item_end (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id             BIGINT UNSIGNED NOT NULL,
  end_seq             TINYINT UNSIGNED NOT NULL,          -- 1 = End A, 2 = End B, 3 = End C ...
  connection_standard ENUM('din_metric_dko','bspp','bspt','jic','orfs','npt','sae_flange') NOT NULL,
  size_value          VARCHAR(32)     NULL,               -- '35L' (DIN) | 'G1-1/2' (BSP) | '-24' (JIC/ORFS)
  size_basis          ENUM('tube_od_mm_series','nominal_inch','dash','flange_code') NULL,
  thread              VARCHAR(48)     NULL,               -- 'M42x2', '1-3/8-12 UN', 'G1-1/2'
  gender              ENUM('male','female','neutral') NULL,
  seal_type           VARCHAR(48)     NULL,               -- '24_cone','dko','oring','flat_face','thread_seal','bonded'
  created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_item_end_seq (item_id, end_seq),
  KEY idx_item_end_standard (connection_standard),
  CONSTRAINT fk_item_end_item FOREIGN KEY (item_id)
    REFERENCES item (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 11. validation_record ----------------------------------------------
--     The "Developed" stamp (D9). One per item (0..1). Design file lands
--     in the W5 vault; the ref is nullable until then. In practice a
--     CNC-fitting concept; only the ~2 documented items get stamped.
CREATE TABLE validation_record (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id         BIGINT UNSIGNED NOT NULL,
  stamped_by      BIGINT UNSIGNED NOT NULL,             -- employee(id) [Wave 1, 0001_wave1_people_machines.sql]
  stamped_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  design_file_ref VARCHAR(255)    NULL,
  notes           VARCHAR(255)    NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_validation_item (item_id),
  KEY idx_validation_stamped_by (stamped_by),
  CONSTRAINT fk_validation_item FOREIGN KEY (item_id)
    REFERENCES item (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_validation_stamped_by FOREIGN KEY (stamped_by)
    REFERENCES employee (id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 12. item_attribute_value -------------------------------------------
--     The actual body-attribute values, stored in the RIGHT typed slot.
--     Exactly one value_* is set, matching the attribute's data_type
--     (enforced by the engine; the CHECK below only blocks empty rows).
--     value_num is indexed for future "all fittings >= 400 bar" queries.
CREATE TABLE item_attribute_value (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id         BIGINT UNSIGNED NOT NULL,
  attribute_id    BIGINT UNSIGNED NOT NULL,
  value_num       DECIMAL(20,6)   NULL,
  value_text      VARCHAR(255)    NULL,
  value_bool      TINYINT(1)      NULL,
  value_option_id BIGINT UNSIGNED NULL,
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_item_attr (item_id, attribute_id),
  KEY idx_iav_attr (attribute_id),
  KEY idx_iav_num (value_num),
  KEY idx_iav_option (value_option_id),
  CONSTRAINT fk_iav_item FOREIGN KEY (item_id)
    REFERENCES item (id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_iav_attr FOREIGN KEY (attribute_id)
    REFERENCES attribute_definition (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_iav_option FOREIGN KEY (value_option_id)
    REFERENCES attribute_option (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT chk_iav_not_empty CHECK (
    value_num IS NOT NULL OR value_text IS NOT NULL
    OR value_bool IS NOT NULL OR value_option_id IS NOT NULL
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


-- =====================================================================
--  SEED · REFERENCE DATA + FITTING TEMPLATE
--  (Business items — the 11 sample fittings — are loaded/verified by
--   the runAudit import test, NOT seeded here.)
-- =====================================================================

-- item_category (the 8 locked buckets) --------------------------------
INSERT INTO item_category (code, name, sort_order) VALUES
  ('raw_material',      'Raw material',      1),
  ('fitting',           'Fitting',           2),
  ('hose',              'Hose',              3),
  ('finished_assembly', 'Finished assembly', 4),
  ('consumable',        'Consumable',        5),
  ('maintenance_spare', 'Maintenance spare', 6),
  ('packaging',         'Packaging',         7),
  ('tooling',           'Tooling',           8);

-- material ------------------------------------------------------------
INSERT INTO material (code, name, grade, standard, density) VALUES
  ('SS304',   'Stainless steel 304', '304', 'ASTM A276', 7.930),
  ('SS316',   'Stainless steel 316', '316', 'ASTM A276', 7.980),
  ('MS',      'Mild steel',          NULL,  'IS 2062',   7.850),
  ('PTFE',    'PTFE',                NULL,  NULL,        2.200),
  ('BRASS',   'Brass',               NULL,  NULL,        8.500),
  ('RUBBER',  'Rubber compound',     NULL,  NULL,        NULL);

-- unit_of_measure -----------------------------------------------------
INSERT INTO unit_of_measure (code, name, dimension) VALUES
  ('kg',   'Kilogram', 'weight'),
  ('m',    'Metre',    'length'),
  ('pc',   'Piece',    'count'),
  ('L',    'Litre',    'volume'),
  ('set',  'Set',      'count'),
  ('roll', 'Roll',     'count'),
  ('coil', 'Coil',     'count'),
  ('pair', 'Pair',     'count');

-- attribute_definition (fitting BODY attributes) ----------------------
-- Note: end properties (standard/size/thread/gender/seal) are structural
-- columns on item_end, NOT attributes. Series (L/S) is folded into the
-- DIN end's size_value, so it is not a separate attribute either.
INSERT INTO attribute_definition (code, label, data_type, uom_id) VALUES
  ('fitting_type',   'Fitting type',   'option', NULL),
  ('pressure_rating','Pressure rating (bar)', 'number', NULL),
  ('plating',        'Plating / finish', 'option', NULL),
  ('seal_material',  'Seal material',  'option', NULL),
  ('unit_weight',    'Unit weight',    'number',
     (SELECT id FROM unit_of_measure WHERE code = 'kg')),
  ('make',           'Make / brand',   'text',   NULL),
  ('origin',         'Country of origin', 'text', NULL);

-- attribute_option (controlled lists) ---------------------------------
SET @attr_fitting_type  := (SELECT id FROM attribute_definition WHERE code = 'fitting_type');
SET @attr_plating       := (SELECT id FROM attribute_definition WHERE code = 'plating');
SET @attr_seal_material := (SELECT id FROM attribute_definition WHERE code = 'seal_material');

INSERT INTO attribute_option (attribute_id, value, sort_order) VALUES
  (@attr_fitting_type, 'Straight Coupling',     1),
  (@attr_fitting_type, 'Bulkhead Connector',    2),
  (@attr_fitting_type, 'Male Stud Coupling',    3),
  (@attr_fitting_type, 'Male Stud Branch Tee',  4),
  (@attr_fitting_type, 'Metric Nut',            5),
  (@attr_fitting_type, 'Ferrule',               6),
  (@attr_fitting_type, 'Hose Adapter',          7),
  (@attr_fitting_type, 'Sealing Plug',          8),
  (@attr_fitting_type, 'Cap',                   9),
  (@attr_fitting_type, 'Body',                 10);

INSERT INTO attribute_option (attribute_id, value, sort_order) VALUES
  (@attr_plating, 'None',       1),
  (@attr_plating, 'Zinc',       2),
  (@attr_plating, 'Passivated', 3),
  (@attr_plating, 'Chrome',     4);

INSERT INTO attribute_option (attribute_id, value, sort_order) VALUES
  (@attr_seal_material, 'None',        1),
  (@attr_seal_material, 'NBR',         2),
  (@attr_seal_material, 'FKM (Viton)', 3),
  (@attr_seal_material, 'PTFE',        4);

-- category_attribute (the FITTING template) ---------------------------
SET @cat_fitting := (SELECT id FROM item_category WHERE code = 'fitting');

INSERT INTO category_attribute (category_id, attribute_id, is_required, sort_order)
SELECT @cat_fitting, ad.id, x.is_required, x.sort_order
FROM (
  SELECT 'fitting_type'    AS code, 1 AS is_required, 1 AS sort_order UNION ALL
  SELECT 'pressure_rating',        0, 2 UNION ALL
  SELECT 'plating',                0, 3 UNION ALL
  SELECT 'seal_material',          0, 4 UNION ALL
  SELECT 'unit_weight',            0, 5 UNION ALL
  SELECT 'make',                   0, 6 UNION ALL
  SELECT 'origin',                 0, 7
) AS x
JOIN attribute_definition ad ON ad.code = x.code;

-- =====================================================================
--  END OF MIGRATION 0003_item_register.sql
-- =====================================================================
