USE reach_membership;

CREATE TABLE IF NOT EXISTS ledger_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kind ENUM('received','expense') NOT NULL,
  name VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_kind_name (kind, name)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  kind ENUM('received','expense') NOT NULL,
  category_id INT NULL,
  category_name VARCHAR(80) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  entry_date DATE NOT NULL,
  method VARCHAR(50) DEFAULT NULL,
  note VARCHAR(255) DEFAULT NULL,
  recorded_by VARCHAR(60) NOT NULL,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES ledger_categories(id) ON DELETE SET NULL,
  INDEX idx_kind_date (kind, entry_date),
  INDEX idx_deleted (deleted_at)
);

INSERT IGNORE INTO ledger_categories (kind, name, sort_order) VALUES
  ('received','Donation',1),('received','Event Income',2),('received','Other Income',3),
  ('expense','Rent',1),('expense','Stationery',2),('expense','Event Expense',3),('expense','Utilities',4),('expense','Other Expense',5);

UPDATE roles SET screens = JSON_ARRAY_APPEND(screens, '$', 'ledger')
  WHERE name IN ('admin','accounts') AND NOT JSON_CONTAINS(screens, '"ledger"');
