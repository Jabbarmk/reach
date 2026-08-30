USE reach_membership;

ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_number VARCHAR(30) DEFAULT NULL;

-- Backfill receipt numbers for payments recorded before this feature existed, in creation order.
UPDATE payments p
JOIN (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM payments WHERE receipt_number IS NULL
) x ON x.id = p.id
SET p.receipt_number = CONCAT('RCPT-', YEAR(p.created_at), '-', LPAD(x.rn, 4, '0'));
