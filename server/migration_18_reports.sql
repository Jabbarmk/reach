USE reach_membership;

-- New "Reports" screen (Dashboard > Reports): registration & payment reports by country and
-- Panchayath/Municipality with filters, Excel and PDF export. Admin and Accounts get it by
-- default; other roles/users can be granted it from the Users screen.
UPDATE roles SET screens = JSON_ARRAY_APPEND(screens, '$', 'reports')
  WHERE name IN ('admin','accounts') AND NOT JSON_CONTAINS(screens, '"reports"');
