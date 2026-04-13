-- Remove the license table (Community Edition simplification).
-- IF EXISTS guards against fresh databases that never had this table.
DROP TABLE IF EXISTS license;
