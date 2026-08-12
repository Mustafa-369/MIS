-- ================= 2a. Two new roles (additive to the existing 7) =================
INSERT INTO role (code, name, description) VALUES
  ('engineer','Engineer','Create/edit items, BOMs, routings, drawings; apply the Developed stamp'),
  ('store','Store','Stock receipts, issues, transfers, and replenishment worklists');

-- ================= 2b. Three new departments (additive) =================
INSERT INTO department (code, name) VALUES
  ('HOSE','Hose Assembly'),
  ('SALES','Sales'),
  ('ACCT','Accounts & Finance');

-- Readability rename, name only, code untouched (per spec example).
UPDATE department SET name='Production & Planning' WHERE code='MFG';

-- Dormant / unstaffed departments (update, do NOT delete). Org & Authority's explicit
-- dormant list (Security, Process Engineering, Maintenance, R&D, Documentation, Master
-- Data, Workflow, Cross-functional) plus PPC (superseded by MFG/"Production & Planning")
-- and SCM (superseded by PROC, the single "Procurement / Supply Chain" seat) — none of
-- these have a position seeded against them in Wave 1.
UPDATE department SET is_active=0
  WHERE code IN ('SEC','PPC','PROCENG','MAINT','RND','DOC','MDM','WF','XF','SCM');

-- ================= 2c. Capabilities =================
INSERT INTO capability (code, name) VALUES
  ('rm_cutting','RM Cutting'),
  ('cnc_machining','CNC Machining'),
  ('thread_rolling','Thread Rolling'),
  ('manual_turning','Manual Turning'),
  ('rubber_cutting','Rubber Hose Cutting'),
  ('skiving','Skiving'),
  ('crimping','Crimping'),
  ('ss_ptfe_cutting','SS/PTFE Hose Cutting'),
  ('tig_welding','TIG Welding'),
  ('flaring','Flaring (De-convolution)'),
  ('teflon_lining','Teflon Lining'),
  ('buffing','Buffing');

-- ================= 2d. Positions (job_position) — the seats =================
-- Inserted parents-first (descending authority_level) so each reports_to lookup already
-- resolves; BOARD is root (reports_to stays NULL).
INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'BOARD','Board / Directors', d.id, NULL, 100 FROM department d WHERE d.code='CORP';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'GM','General Manager — Operations', d.id, p.id, 90
  FROM department d, job_position p WHERE d.code='CORP' AND p.code='BOARD';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'SYSADMIN','System Administrator (IT)', d.id, p.id, 85
  FROM department d, job_position p WHERE d.code='CORP' AND p.code='BOARD';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'HPP','Head of Production & Planning', d.id, p.id, 60
  FROM department d, job_position p WHERE d.code='MFG' AND p.code='GM';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'HQE','Head of Quality & Engineering', d.id, p.id, 60
  FROM department d, job_position p WHERE d.code='QA' AND p.code='GM';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'HHA_JDML','Head of Hose Assembly — Jeedimetla', d.id, p.id, 60
  FROM department d, job_position p WHERE d.code='HOSE' AND p.code='GM';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'HHA_RNGJ','Head of Hose Assembly — Ranigunj', d.id, p.id, 60
  FROM department d, job_position p WHERE d.code='HOSE' AND p.code='GM';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'HSALES','Head of Sales — B2B', d.id, p.id, 60
  FROM department d, job_position p WHERE d.code='SALES' AND p.code='GM';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'INVHEAD','Inventory Head — Jeedimetla', d.id, p.id, 55
  FROM department d, job_position p WHERE d.code='WH' AND p.code='GM';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'FIN','Finance & Accounts', d.id, p.id, 50
  FROM department d, job_position p WHERE d.code='ACCT' AND p.code='BOARD';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'TOOLIC','Tool Room In-charge', d.id, p.id, 45
  FROM department d, job_position p WHERE d.code='TOOL' AND p.code='HPP';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'CNCPROG','CNC Programmers', d.id, p.id, 40
  FROM department d, job_position p WHERE d.code='MFG' AND p.code='HPP';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'CNTSALES','Counter Sales + Retail Store', d.id, p.id, 30
  FROM department d, job_position p WHERE d.code='SALES' AND p.code='HSALES';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'HEFSTORE','Hose End-Fittings Store (RNGJ)', d.id, p.id, 30
  FROM department d, job_position p WHERE d.code='WH' AND p.code='HHA_RNGJ';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'CNCOP','CNC Operators', d.id, p.id, 20
  FROM department d, job_position p WHERE d.code='MFG' AND p.code='HPP';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'CUTOP','Cutting Machine Operators', d.id, p.id, 20
  FROM department d, job_position p WHERE d.code='MFG' AND p.code='HPP';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'TRAUBOP','Traub Machine Operators', d.id, p.id, 20
  FROM department d, job_position p WHERE d.code='MFG' AND p.code='HPP';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'WELDER','Welders (weld / flare)', d.id, p.id, 20
  FROM department d, job_position p WHERE d.code='HOSE' AND p.code='HHA_JDML';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'CRIMPER','Crimp Assemblers', d.id, p.id, 20
  FROM department d, job_position p WHERE d.code='HOSE' AND p.code='HHA_RNGJ';

INSERT INTO job_position (code, title, department_id, reports_to, authority_level)
  SELECT 'STORETEAM','Store Team members', d.id, p.id, 20
  FROM department d, job_position p WHERE d.code='WH' AND p.code='INVHEAD';

-- ================= 2e. Department heads (update department.head_position_id) =================
-- Only the 10 active departments get a head; SCM stays dormant (superseded by PROC).
UPDATE department d JOIN job_position p ON p.code='BOARD'    SET d.head_position_id=p.id WHERE d.code='CORP';
UPDATE department d JOIN job_position p ON p.code='HPP'      SET d.head_position_id=p.id WHERE d.code='MFG';
UPDATE department d JOIN job_position p ON p.code='HQE'      SET d.head_position_id=p.id WHERE d.code='QA';
UPDATE department d JOIN job_position p ON p.code='HQE'      SET d.head_position_id=p.id WHERE d.code='ENG';
UPDATE department d JOIN job_position p ON p.code='HHA_JDML' SET d.head_position_id=p.id WHERE d.code='HOSE';
UPDATE department d JOIN job_position p ON p.code='INVHEAD'  SET d.head_position_id=p.id WHERE d.code='WH';
UPDATE department d JOIN job_position p ON p.code='TOOLIC'   SET d.head_position_id=p.id WHERE d.code='TOOL';
UPDATE department d JOIN job_position p ON p.code='HSALES'   SET d.head_position_id=p.id WHERE d.code='SALES';
UPDATE department d JOIN job_position p ON p.code='GM'       SET d.head_position_id=p.id WHERE d.code='PROC';
UPDATE department d JOIN job_position p ON p.code='FIN'      SET d.head_position_id=p.id WHERE d.code='ACCT';

-- ================= 2f. Position -> roles (position_role) — position drives roles (WD-03) =================
INSERT INTO position_role (position_id, role_id)
SELECT p.id, r.id FROM (
  SELECT 'BOARD' AS pcode, 'admin' AS rcode
  UNION ALL SELECT 'GM','admin'
  UNION ALL SELECT 'GM','procurement'
  UNION ALL SELECT 'SYSADMIN','admin'
  UNION ALL SELECT 'HPP','planner'
  UNION ALL SELECT 'HPP','operator'
  UNION ALL SELECT 'HPP','viewer'
  UNION ALL SELECT 'HQE','quality'
  UNION ALL SELECT 'HQE','engineer'
  UNION ALL SELECT 'HQE','viewer'
  UNION ALL SELECT 'HHA_JDML','planner'
  UNION ALL SELECT 'HHA_JDML','operator'
  UNION ALL SELECT 'HHA_JDML','viewer'
  UNION ALL SELECT 'HHA_RNGJ','planner'
  UNION ALL SELECT 'HHA_RNGJ','operator'
  UNION ALL SELECT 'HHA_RNGJ','viewer'
  UNION ALL SELECT 'HSALES','sales'
  UNION ALL SELECT 'HSALES','viewer'
  UNION ALL SELECT 'INVHEAD','store'
  UNION ALL SELECT 'INVHEAD','procurement'
  UNION ALL SELECT 'INVHEAD','viewer'
  UNION ALL SELECT 'FIN','viewer'
  UNION ALL SELECT 'TOOLIC','store'
  UNION ALL SELECT 'TOOLIC','procurement'
  UNION ALL SELECT 'TOOLIC','operator'
  UNION ALL SELECT 'TOOLIC','viewer'
  UNION ALL SELECT 'CNCPROG','engineer'
  UNION ALL SELECT 'CNCPROG','operator'
  UNION ALL SELECT 'CNTSALES','sales'
  UNION ALL SELECT 'CNTSALES','store'
  UNION ALL SELECT 'HEFSTORE','store'
  UNION ALL SELECT 'HEFSTORE','operator'
  UNION ALL SELECT 'CNCOP','operator'
  UNION ALL SELECT 'CUTOP','operator'
  UNION ALL SELECT 'TRAUBOP','operator'
  UNION ALL SELECT 'WELDER','operator'
  UNION ALL SELECT 'CRIMPER','operator'
  UNION ALL SELECT 'STORETEAM','store'
  UNION ALL SELECT 'STORETEAM','operator'
) v
JOIN job_position p ON p.code = v.pcode
JOIN role r ON r.code = v.rcode;

-- ================= 2g. Machines / stations =================
-- oee_excluded=1 only for AQ21, AQ22. work_center_id, location_id, capability_id
-- resolved by code. 39 machines total (CNC 25 + Turning 3 + Unit 1: 4 + Unit 2: 7).
INSERT INTO machine (code, name, work_center_id, location_id, capability_id, size_range, oee_excluded)
SELECT v.code, v.name, wc.id, loc.id, cap.id, v.size_range, v.oee_excluded
FROM (
  SELECT 'CUT01' AS code, 'Cutting Machine' AS name, 'CNC' AS wc_code, 'JDML' AS loc_code, 'rm_cutting' AS cap_code, NULL AS size_range, 0 AS oee_excluded
  UNION ALL SELECT 'TRAUB01','Traub','CNC','JDML','rm_cutting',NULL,0
  UNION ALL SELECT 'AQ01','CNC Machine AQ01','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ02','CNC Machine AQ02','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ03','CNC Machine AQ03','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ04','CNC Machine AQ04','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ05','CNC Machine AQ05','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ06','CNC Machine AQ06','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ07','CNC Machine AQ07','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ08','CNC Machine AQ08','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ09','CNC Machine AQ09','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ10','CNC Machine AQ10','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ11','CNC Machine AQ11','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ12','CNC Machine AQ12','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ13','CNC Machine AQ13','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ14','CNC Machine AQ14','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ15','CNC Machine AQ15','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ16','CNC Machine AQ16','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ17','CNC Machine AQ17','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ18','CNC Machine AQ18','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ19','CNC Machine AQ19','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ20','CNC Machine AQ20','CNC','JDML','cnc_machining',NULL,0
  UNION ALL SELECT 'AQ21','CNC Machine AQ21 (R&D)','CNC','JDML','cnc_machining',NULL,1
  UNION ALL SELECT 'AQ22','CNC Machine AQ22 (R&D)','CNC','JDML','cnc_machining',NULL,1
  UNION ALL SELECT 'THR01','Thread Rolling','CNC','JDML','thread_rolling',NULL,0
  UNION ALL SELECT 'LATHE01','Lathe 1 (Threading)','TURN','JDML','manual_turning',NULL,0
  UNION ALL SELECT 'LATHE02','Lathe 2','TURN','JDML','manual_turning',NULL,0
  UNION ALL SELECT 'LATHE03','Lathe 3','TURN','JDML','manual_turning',NULL,0
  UNION ALL SELECT 'RCUT01','Rubber Hose Cutting','HOSE1','RNGJ','rubber_cutting',NULL,0
  UNION ALL SELECT 'SKIV01','Skiving 1','HOSE1','RNGJ','skiving',NULL,0
  UNION ALL SELECT 'SKIV02','Skiving 2','HOSE1','RNGJ','skiving',NULL,0
  UNION ALL SELECT 'CRIMP01','Hose Crimper','HOSE1','RNGJ','crimping',NULL,0
  UNION ALL SELECT 'SCUT01','SS/PTFE Hose Cutting','HOSE2','JDML','ss_ptfe_cutting',NULL,0
  UNION ALL SELECT 'TIG01','TIG Welding 1','HOSE2','JDML','tig_welding',NULL,0
  UNION ALL SELECT 'TIG02','TIG Welding 2','HOSE2','JDML','tig_welding',NULL,0
  UNION ALL SELECT 'FLARE01','Flaring (1-2in)','HOSE2','JDML','flaring','1-2in',0
  UNION ALL SELECT 'FLARE02','Flaring (2-3in)','HOSE2','JDML','flaring','2-3in',0
  UNION ALL SELECT 'TLINE01','Teflon Lining','HOSE2','JDML','teflon_lining',NULL,0
  UNION ALL SELECT 'BUFF01','Buffing','HOSE2','JDML','buffing',NULL,0
) v
JOIN work_center wc ON wc.code = v.wc_code
JOIN location loc ON loc.code = v.loc_code
JOIN capability cap ON cap.code = v.cap_code;

-- ================= Employees, app_users, employee_positions: seed NONE =================
-- The owner adds people in the app.
