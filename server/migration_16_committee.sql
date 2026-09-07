USE reach_membership;

CREATE TABLE IF NOT EXISTS committee_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  committee_level VARCHAR(60) NOT NULL,
  local_body VARCHAR(120) DEFAULT NULL,
  wing VARCHAR(120) NOT NULL,
  designation VARCHAR(60) NOT NULL,
  notes VARCHAR(300) DEFAULT NULL,
  created_by VARCHAR(60) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id),
  INDEX idx_level (committee_level),
  INDEX idx_application (application_id)
);

INSERT IGNORE INTO settings (name, value) VALUES
  ('committee_levels', '["Central Committee","Panchayat Committee","Municipal Committee"]'),
  ('committee_wings', '["Central Executive","Advisory Board","Membership Committee","Finance Committee","Family Welfare Committee","Employment and Entrepreneurship Development Committee","Community and Social Development Committee","Social Security Committee","Media and Public Relations Committee"]'),
  ('committee_designations', '["President","General Secretary","Treasurer","Vice President","Joint Secretary","Executive Member","Convener","Joint Convenor"]');

UPDATE roles SET screens = JSON_ARRAY_APPEND(screens, '$', 'committee')
  WHERE name = 'admin' AND NOT JSON_CONTAINS(screens, '"committee"');
