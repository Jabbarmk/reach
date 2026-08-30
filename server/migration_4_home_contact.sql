USE reach_membership;

ALTER TABLE applications ADD COLUMN IF NOT EXISTS home_contact_number VARCHAR(25) DEFAULT NULL;

INSERT IGNORE INTO form_fields (field_key, step, label, field_type, required, visible, is_core, options_key, sort_order)
VALUES ('home_contact_number', 'expat', 'Home Contact Number', 'phone', 1, 1, 1, NULL, 15);
