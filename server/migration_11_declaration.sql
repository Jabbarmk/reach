USE reach_membership;

ALTER TABLE applications ADD COLUMN IF NOT EXISTS declaration_accepted TINYINT(1) NOT NULL DEFAULT 0;
