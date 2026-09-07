USE reach_membership;

CREATE TABLE IF NOT EXISTS committee_meetings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  committee_level VARCHAR(60) NOT NULL,
  local_body VARCHAR(120) DEFAULT NULL,
  wing VARCHAR(120) NOT NULL,
  meeting_date DATE NOT NULL,
  meeting_time TIME DEFAULT NULL,
  venue VARCHAR(160) DEFAULT NULL,
  agenda TEXT,
  discussed_points TEXT,
  last_meeting_updates TEXT,
  new_decisions TEXT,
  prepared_by VARCHAR(120) DEFAULT NULL,
  approved_by VARCHAR(120) DEFAULT NULL,
  attachment_file VARCHAR(255) DEFAULT NULL,
  attachment_mime VARCHAR(100) DEFAULT NULL,
  attachment_original_name VARCHAR(255) DEFAULT NULL,
  created_by VARCHAR(60) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_level (committee_level),
  INDEX idx_date (meeting_date)
);

CREATE TABLE IF NOT EXISTS committee_meeting_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id INT NOT NULL,
  application_id INT NOT NULL,
  status ENUM('present','absent') NOT NULL,
  FOREIGN KEY (meeting_id) REFERENCES committee_meetings(id) ON DELETE CASCADE,
  FOREIGN KEY (application_id) REFERENCES applications(id),
  UNIQUE KEY uq_meeting_member (meeting_id, application_id)
);
