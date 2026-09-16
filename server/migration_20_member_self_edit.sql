USE reach_membership;

-- Member login is now e-mail + Member ID (OTP removed for now; member_otps table is
-- kept in case OTP verification is reinstated later, but no longer written to).

-- Members can request an edit to their own details (all registration fields except
-- membership_type). Requests sit here until an admin approves or rejects them; approval
-- copies `changes` onto the applications row, rejection just closes the request out.
CREATE TABLE IF NOT EXISTS member_edit_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  changes JSON NOT NULL,
  photo_file_name VARCHAR(255) DEFAULT NULL,
  photo_original_name VARCHAR(255) DEFAULT NULL,
  photo_mime_type VARCHAR(80) DEFAULT NULL,
  status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  admin_note VARCHAR(255) DEFAULT NULL,
  reviewed_by VARCHAR(60) DEFAULT NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);
CREATE INDEX idx_member_edit_requests_application ON member_edit_requests(application_id);
CREATE INDEX idx_member_edit_requests_status ON member_edit_requests(status);
