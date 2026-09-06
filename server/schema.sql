CREATE DATABASE IF NOT EXISTS reach_membership CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE reach_membership;

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reference_no VARCHAR(30) NOT NULL UNIQUE,
  membership_id VARCHAR(30) DEFAULT NULL UNIQUE,

  -- Membership plan
  membership_type ENUM('two_year','lifetime') NOT NULL,
  membership_fee INT NOT NULL,
  validity_start DATE DEFAULT NULL,
  validity_end DATE DEFAULT NULL,

  -- Personal information
  name VARCHAR(120) NOT NULL,
  father_name VARCHAR(120) NOT NULL,
  house_name VARCHAR(120) NOT NULL,
  place VARCHAR(120) NOT NULL,
  post_office VARCHAR(120) NOT NULL,
  panchayath VARCHAR(120) NOT NULL,
  blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NOT NULL,
  date_of_birth DATE NOT NULL,
  aadhaar_number VARCHAR(60) NOT NULL,
  qualification VARCHAR(120) NOT NULL,

  -- Expat status
  is_expat TINYINT(1) NOT NULL,

  -- Expat details
  phone_abroad VARCHAR(25) DEFAULT NULL,
  id_card_number_abroad VARCHAR(60) DEFAULT NULL,
  working_country VARCHAR(80) DEFAULT NULL,
  city VARCHAR(80) DEFAULT NULL,

  -- Retired details
  retired_year SMALLINT DEFAULT NULL,
  phone_india VARCHAR(25) DEFAULT NULL,

  -- Common
  whatsapp_number VARCHAR(25) NOT NULL,
  email VARCHAR(120) NOT NULL,
  current_job VARCHAR(120) NOT NULL,
  years_abroad DECIMAL(4,1) NOT NULL DEFAULT 0,

  -- Emergency contact
  emergency_name VARCHAR(120) NOT NULL,
  emergency_phone VARCHAR(25) NOT NULL,

  -- Status
  status ENUM('Submitted','Pending Verification','Correction Requested','Approved','Rejected','Payment Pending','Active','Expired') NOT NULL DEFAULT 'Pending Verification',
  payment_status ENUM('Unpaid','Paid') NOT NULL DEFAULT 'Unpaid',
  payment_note VARCHAR(255) DEFAULT NULL,
  admin_note TEXT DEFAULT NULL,
  consent_accepted TINYINT(1) NOT NULL DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  doc_type ENUM('photo','aadhaar','id_card_abroad') NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  size_bytes INT NOT NULL,
  ocr_status ENUM('not_applicable','success','failed','skipped') DEFAULT 'not_applicable',
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  action VARCHAR(60) NOT NULL,
  detail VARCHAR(255) DEFAULT NULL,
  actor VARCHAR(60) NOT NULL DEFAULT 'system',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
);
