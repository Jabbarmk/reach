USE reach_membership;

-- Whole years only, no more "5.0" style decimals anywhere it's displayed.
ALTER TABLE applications MODIFY years_abroad INT NOT NULL DEFAULT 0;
