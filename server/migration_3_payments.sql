USE reach_membership;

-- Member deactivate/reactivate + soft delete (Deleted Members)
ALTER TABLE applications
  MODIFY status ENUM('Submitted','Pending Verification','Correction Requested','Approved','Rejected','Payment Pending','Active','Expired','Deactivated') NOT NULL DEFAULT 'Pending Verification';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS deleted_at DATETIME DEFAULT NULL;

-- CMS-editable required fields: date of birth optional, blood group defaultable
ALTER TABLE applications
  MODIFY date_of_birth DATE NULL,
  MODIFY blood_group VARCHAR(10) NOT NULL DEFAULT '';

-- Payment records
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  method VARCHAR(50) NOT NULL,
  paid_on DATE NOT NULL,
  note VARCHAR(255) DEFAULT NULL,
  receipt_doc_id INT DEFAULT NULL,
  recorded_by VARCHAR(60) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

ALTER TABLE documents MODIFY doc_type ENUM('photo','aadhaar','id_card_abroad','payment_receipt') NOT NULL;

INSERT IGNORE INTO option_lists (list_key, value, sort_order) VALUES
 ('payment_method','Cash',1),('payment_method','Bank Transfer',2),('payment_method','Google Pay',3),
 ('payment_method','UPI',4),('payment_method','Cheque',5);
