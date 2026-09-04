USE reach_membership;

ALTER TABLE news_items
  ADD COLUMN kind ENUM('news','event') NOT NULL DEFAULT 'news' AFTER id;

CREATE TABLE IF NOT EXISTS news_item_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  news_item_id INT NOT NULL,
  image_file VARCHAR(255) NOT NULL,
  image_mime VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (news_item_id) REFERENCES news_items(id) ON DELETE CASCADE
);
