USE reach_membership;

-- Remove serial-number prefixes ("1. ", "10. " etc.) from all field labels.
UPDATE form_fields SET label = TRIM(REGEXP_REPLACE(label, '^[0-9]+\\.\\s*', '')) WHERE label REGEXP '^[0-9]+\\.';

-- Tracks who physically collected the payment (may differ from who logged it in the system).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS collected_by VARCHAR(60) DEFAULT NULL;
