USE reach_membership;

CREATE TABLE IF NOT EXISTS news_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tag VARCHAR(60) NOT NULL DEFAULT 'Announcement',
  title VARCHAR(200) NOT NULL,
  body TEXT NOT NULL,
  image_file VARCHAR(255) NULL,
  image_mime VARCHAR(100) NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  published_on DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed with the homepage's previous hardcoded announcements so the section isn't empty after migrating.
INSERT INTO news_items (tag, title, body, published_on)
SELECT * FROM (
  SELECT 'Announcement' AS tag, 'By-Law & Official Logo Unveiled' AS title,
    'REACH Pravasi Welfare Society ബൈലോയും ലോഗോയും ഔദ്യോഗികമായി പ്രകാശനം ചെയ്തു.' AS body, CURDATE() AS published_on
  UNION ALL
  SELECT 'Membership Drive', 'Membership Drive 2026',
    'മെമ്പര്‍ഷിപ്പ് കാമ്പയിന്‍ 2026 സെപ്റ്റംബര്‍ 5 മുതല്‍ 20 വരെ (ഓണ്‍ലൈനില്‍ മാത്രം)', CURDATE()
  UNION ALL
  SELECT 'Committees', 'Regional Committees Formation',
    'പഞ്ചായത്ത്/മുൻസിപ്പൽ സമിതികളുടെ രൂപീകരണം ഉടന്‍.', CURDATE()
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM news_items);
