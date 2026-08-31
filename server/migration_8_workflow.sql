USE reach_membership;

-- New staged workflow: Pending Verification -> Payment Verified -> Approved -> Active.
-- Old values are kept for historical rows; the new flow simply doesn't create new ones.
ALTER TABLE applications MODIFY status ENUM(
  'Submitted','Pending Verification','Correction Requested','Approved','Rejected',
  'Payment Pending','Payment Verified','Active','Expired','Deactivated'
) NOT NULL DEFAULT 'Pending Verification';
