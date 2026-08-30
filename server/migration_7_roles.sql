USE reach_membership;

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(30) NOT NULL UNIQUE,
  label VARCHAR(50) NOT NULL,
  screens TEXT NOT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO roles (name, label, screens, is_system, sort_order) VALUES
  ('admin', 'Admin', '["overview","members","approvals","payments","events","settings","users","form"]', 1, 1),
  ('staff', 'Staff', '["overview","members","approvals"]', 1, 2),
  ('accounts', 'Accounts', '["overview","members","payments"]', 1, 3);

-- Was ENUM('admin','staff','accounts'); now references roles.name so new roles can be added freely.
ALTER TABLE admins MODIFY role VARCHAR(30) NOT NULL DEFAULT 'admin';
