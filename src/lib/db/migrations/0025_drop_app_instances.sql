-- Remove the deprecated app_instances table.
-- IF EXISTS guards against fresh databases that never had this table.
DROP TABLE IF EXISTS app_instances;
