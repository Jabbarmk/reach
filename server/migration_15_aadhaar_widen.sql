USE reach_membership;

-- aadhaar_number was left at its original Aadhaar-only width after being generalized to a
-- free-text ID card field, so longer formats (e.g. UAE Emirates ID "784-1969-5961949-3")
-- overflowed and crashed the application-submit insert (ER_DATA_TOO_LONG).
ALTER TABLE applications MODIFY aadhaar_number VARCHAR(60) NOT NULL;
