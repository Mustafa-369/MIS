-- locations
INSERT INTO location (code, name, kind) VALUES
  ('JDML','Jeedimetla','site'),
  ('RNGJ','Ranigunj','site');

-- roles (baseline; positions get mapped to these once the org chart is loaded)
INSERT INTO role (code, name, description) VALUES
  ('admin','Administrator','Full access'),
  ('sales','Sales','Order booking'),
  ('planner','Planner','PPC & scheduling'),
  ('operator','Operator','Shop-floor entry'),
  ('quality','Quality','Inspections & gates'),
  ('procurement','Procurement','Purchasing'),
  ('viewer','Viewer','Read-only');

-- departments (names only; heads & reporting come with the org chart in Wave 1)
INSERT INTO department (code, name) VALUES
  ('CORP','Corporate Management'), ('ENG','Engineering'), ('PROCENG','Process Engineering'),
  ('PPC','Production Planning'),   ('MFG','Manufacturing'), ('QA','Quality'),
  ('WH','Warehouse'),              ('PROC','Procurement'),  ('SCM','Supply Chain'),
  ('MAINT','Maintenance'),         ('TOOL','Tool Room'),    ('RND','R&D'),
  ('DOC','Documentation'),         ('MDM','Master Data'),   ('WF','Workflow & Approvals'),
  ('SEC','Security'),              ('XF','Cross-functional');

-- work centres (resolve location by code)
INSERT INTO work_center (code, name, kind, metric_mode, location_id)
  SELECT 'CNC','CNC machining','cnc','oee', id FROM location WHERE code='JDML';
INSERT INTO work_center (code, name, kind, metric_mode, location_id)
  SELECT 'TURN','Manual turning','manual_turning','utilisation', id FROM location WHERE code='JDML';
INSERT INTO work_center (code, name, kind, metric_mode, location_id)
  SELECT 'HOSE1','Hose Unit 1 (crimp)','hose_unit1','yield', id FROM location WHERE code='RNGJ';
INSERT INTO work_center (code, name, kind, metric_mode, location_id)
  SELECT 'HOSE2','Hose Unit 2 (weld/flare/line/buff)','hose_unit2','yield', id FROM location WHERE code='JDML';

-- positions, cost_centres, position_role: intentionally empty until the org chart (Wave 1).
