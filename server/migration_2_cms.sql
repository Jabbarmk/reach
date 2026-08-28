USE reach_membership;

-- ===== Users =====
ALTER TABLE admins
  ADD COLUMN full_name VARCHAR(100) DEFAULT NULL,
  ADD COLUMN role ENUM('admin','staff','accounts') NOT NULL DEFAULT 'admin',
  ADD COLUMN screens TEXT DEFAULT NULL,
  ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

UPDATE admins SET full_name = 'Admin User', role = 'admin' WHERE username = 'admin';

-- ===== Settings (key/value JSON store) =====
CREATE TABLE IF NOT EXISTS settings (
  name VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ===== Membership plans =====
CREATE TABLE IF NOT EXISTS membership_plans (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  fee INT NOT NULL,
  validity_type ENUM('range','lifetime') NOT NULL DEFAULT 'range',
  validity_start DATE DEFAULT NULL,
  validity_end DATE DEFAULT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0
);

INSERT IGNORE INTO membership_plans (code, name, fee, validity_type, validity_start, validity_end, sort_order) VALUES
  ('two_year', 'Two-Year Membership', 300, 'range', '2027-01-01', '2028-12-31', 1),
  ('lifetime', 'Lifetime Membership', 2000, 'lifetime', NULL, NULL, 2);

-- ===== Option lists =====
CREATE TABLE IF NOT EXISTS option_lists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  list_key VARCHAR(40) NOT NULL,
  value VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_list_value (list_key, value)
);

INSERT IGNORE INTO option_lists (list_key, value, sort_order) VALUES
  ('panchayath','Kalpetta Municipality',1),('panchayath','Mananthavady Municipality',2),('panchayath','Sulthan Bathery Municipality',3),
  ('panchayath','Ambalavayal Grama Panchayat',4),('panchayath','Edavaka Grama Panchayat',5),('panchayath','Kaniyambetta Grama Panchayat',6),
  ('panchayath','Kottathara Grama Panchayat',7),('panchayath','Meenangadi Grama Panchayat',8),('panchayath','Meppadi Grama Panchayat',9),
  ('panchayath','Muppainad Grama Panchayat',10),('panchayath','Mullankolly Grama Panchayat',11),('panchayath','Muttil Grama Panchayat',12),
  ('panchayath','Nenmeni Grama Panchayat',13),('panchayath','Noolpuzha Grama Panchayat',14),('panchayath','Padinharathara Grama Panchayat',15),
  ('panchayath','Panamaram Grama Panchayat',16),('panchayath','Poothadi Grama Panchayat',17),('panchayath','Pozhuthana Grama Panchayat',18),
  ('panchayath','Pulpally Grama Panchayat',19),('panchayath','Thariode Grama Panchayat',20),('panchayath','Thavinjal Grama Panchayat',21),
  ('panchayath','Thirunelly Grama Panchayat',22),('panchayath','Thondernad Grama Panchayat',23),('panchayath','Vellamunda Grama Panchayat',24),
  ('panchayath','Vengappally Grama Panchayat',25),('panchayath','Vythiri Grama Panchayat',26);

INSERT IGNORE INTO option_lists (list_key, value, sort_order) VALUES
  ('qualification','Below SSLC',1),('qualification','SSLC',2),('qualification','Plus Two / Pre-Degree',3),
  ('qualification','ITI / Diploma',4),('qualification','Degree',5),('qualification','Post Graduation',6),
  ('qualification','Professional Degree',7),('qualification','Other',8);

INSERT IGNORE INTO option_lists (list_key, value, sort_order) VALUES
  ('blood_group','A+',1),('blood_group','A-',2),('blood_group','B+',3),('blood_group','B-',4),
  ('blood_group','AB+',5),('blood_group','AB-',6),('blood_group','O+',7),('blood_group','O-',8);

INSERT IGNORE INTO option_lists (list_key, value, sort_order) VALUES
  ('country','United Arab Emirates',1),('country','Saudi Arabia',2),('country','Qatar',3),('country','Kuwait',4),
  ('country','Oman',5),('country','Bahrain',6),('country','India',7),('country','Australia',8),('country','Austria',9),
  ('country','Bangladesh',10),('country','Belgium',11),('country','Brazil',12),('country','Brunei',13),('country','Canada',14),
  ('country','China',15),('country','Denmark',16),('country','Egypt',17),('country','Ethiopia',18),('country','Finland',19),
  ('country','France',20),('country','Germany',21),('country','Greece',22),('country','Hong Kong',23),('country','Indonesia',24),
  ('country','Iran',25),('country','Iraq',26),('country','Ireland',27),('country','Israel',28),('country','Italy',29),
  ('country','Japan',30),('country','Jordan',31),('country','Kenya',32),('country','Lebanon',33),('country','Libya',34),
  ('country','Malaysia',35),('country','Maldives',36),('country','Mauritius',37),('country','Mexico',38),('country','Morocco',39),
  ('country','Myanmar',40),('country','Nepal',41),('country','Netherlands',42),('country','New Zealand',43),('country','Nigeria',44),
  ('country','Norway',45),('country','Pakistan',46),('country','Philippines',47),('country','Poland',48),('country','Portugal',49),
  ('country','Romania',50),('country','Russia',51),('country','Singapore',52),('country','South Africa',53),('country','South Korea',54),
  ('country','Spain',55),('country','Sri Lanka',56),('country','Sudan',57),('country','Sweden',58),('country','Switzerland',59),
  ('country','Taiwan',60),('country','Tanzania',61),('country','Thailand',62),('country','Turkey',63),('country','Uganda',64),
  ('country','Ukraine',65),('country','United Kingdom',66),('country','United States',67),('country','Vietnam',68),('country','Yemen',69),
  ('country','Zambia',70),('country','Zimbabwe',71);

-- ===== Form fields =====
CREATE TABLE IF NOT EXISTS form_fields (
  id INT AUTO_INCREMENT PRIMARY KEY,
  field_key VARCHAR(60) NOT NULL UNIQUE,
  step ENUM('personal','expat','retired','details') NOT NULL,
  label VARCHAR(150) NOT NULL,
  field_type VARCHAR(20) NOT NULL, -- text,number,date,select,yesno,phone,email,upload,year
  required TINYINT(1) NOT NULL DEFAULT 1,
  visible TINYINT(1) NOT NULL DEFAULT 1,
  is_core TINYINT(1) NOT NULL DEFAULT 0,
  options_key VARCHAR(40) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

INSERT IGNORE INTO form_fields (field_key, step, label, field_type, required, visible, is_core, options_key, sort_order) VALUES
  ('photo',                'personal', '1. Photo',                          'upload', 1, 1, 1, NULL, 10),
  ('name',                 'personal', '2. Name',                           'text',   1, 1, 1, NULL, 20),
  ('father_name',          'personal', "3. Father's Name",                  'text',   1, 1, 1, NULL, 30),
  ('house_name',           'personal', '4. House Name',                     'text',   1, 1, 1, NULL, 40),
  ('place',                'personal', '5. Place',                          'text',   1, 1, 1, NULL, 50),
  ('post_office',          'personal', '6. Post Office',                    'text',   1, 1, 1, NULL, 60),
  ('panchayath',           'personal', '7. Panchayath / Municipality',      'select', 1, 1, 1, 'panchayath', 70),
  ('blood_group',          'personal', '8. Blood Group',                    'select', 1, 1, 1, 'blood_group', 80),
  ('date_of_birth',        'personal', '9. Date of Birth',                  'date',   1, 1, 1, NULL, 90),
  ('aadhaar_upload',       'personal', 'Aadhaar Card Upload',               'upload', 0, 1, 1, NULL, 100),
  ('aadhaar_number',       'personal', '10. Aadhaar Card Number',           'text',   1, 1, 1, NULL, 110),
  ('qualification',        'personal', '11. Qualification',                 'select', 1, 1, 1, 'qualification', 120),
  ('phone_abroad',         'expat',    '1. Phone Number (Abroad)',          'phone',  1, 1, 1, NULL, 10),
  ('id_card_upload',       'expat',    'ID Card Upload (Abroad)',           'upload', 0, 1, 1, NULL, 20),
  ('id_card_number_abroad','expat',    '4. ID Card Number (Abroad)',        'text',   1, 1, 1, NULL, 30),
  ('working_country',      'expat',    '6. Working Country',                'select', 1, 1, 1, 'country', 40),
  ('city',                 'expat',    '7. City',                           'text',   1, 1, 1, NULL, 50),
  ('retired_year',         'retired',  '1. Retired Year',                   'year',   1, 1, 1, NULL, 10),
  ('phone_india',          'retired',  '2. Phone Number (India)',           'phone',  1, 1, 1, NULL, 20),
  ('whatsapp_number',      'details',  'WhatsApp Number',                   'phone',  1, 1, 1, NULL, 10),
  ('email',                'details',  'E-mail ID',                         'email',  1, 1, 1, NULL, 20),
  ('current_job',          'details',  'Current Job',                       'text',   1, 1, 1, NULL, 30),
  ('years_abroad',         'details',  'Total Years of Working in Abroad',  'number', 1, 1, 1, NULL, 40),
  ('emergency_name',       'details',  'Friend/Family — Name',              'text',   1, 1, 1, NULL, 50),
  ('emergency_phone',      'details',  'Friend/Family — Phone Number',      'phone',  1, 1, 1, NULL, 60);

-- ===== Applications: support dynamic plans, blood groups, custom fields =====
ALTER TABLE applications
  MODIFY membership_type VARCHAR(30) NOT NULL,
  MODIFY blood_group VARCHAR(10) NOT NULL,
  ADD COLUMN custom_data TEXT DEFAULT NULL;
