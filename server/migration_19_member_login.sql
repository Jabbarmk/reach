USE reach_membership;

-- Member Login: applicants/members can log in with a one-time code sent to their
-- registered e-mail, then view their own application status, membership card, and
-- payment history (read-only). No password is stored — each login issues a fresh OTP.
CREATE TABLE IF NOT EXISTS member_otps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  consumed_at TIMESTAMP NULL DEFAULT NULL,
  attempts TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);
CREATE INDEX idx_member_otps_application ON member_otps(application_id);
