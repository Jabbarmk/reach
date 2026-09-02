USE reach_membership;

CREATE TABLE IF NOT EXISTS declarations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  text TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO declarations (text, sort_order)
SELECT * FROM (
  SELECT 'REACH Pravasi Welfare Society-യുടെ ബൈലോയും നിയമാവലികളും ഞാൻ പൂർണ്ണമായി വായിച്ചു മനസ്സിലാക്കുകയും അവ പാലിക്കാൻ ബാധ്യസ്ഥനാണെന്ന് ഉറപ്പുനൽകുകയും ചെയ്യുന്നു.' AS text, 1 AS sort_order
  UNION ALL
  SELECT 'ഈ അപേക്ഷയിൽ ഞാൻ നൽകിയിട്ടുള്ള എല്ലാ വിവരങ്ങളും പൂർണ്ണമായും സത്യസന്ധവും കൃത്യവുമാണെന്ന് സാക്ഷ്യപ്പെടുത്തുന്നു.', 2
  UNION ALL
  SELECT 'ഞാൻ നൽകിയ വിവരങ്ങൾ തൃപ്തികരമല്ലെങ്കിലോ, ആവശ്യമെങ്കിൽ കൂടുതൽ വിവരങ്ങൾ ആവശ്യപ്പെടാനോ അപേക്ഷ നിരസിക്കാനോ സൊസൈറ്റിക്ക് പൂർണ്ണ അധികാരമുണ്ടായിരിക്കും.', 3
  UNION ALL
  SELECT 'തെറ്റായ വിവരങ്ങൾ നൽകിയതായി തെളിയുകയോ, സൊസൈറ്റിയുടെ ലക്ഷ്യങ്ങൾക്കും അച്ചടക്കത്തിനും വിരുദ്ധമായി പ്രവർത്തിക്കുകയോ ചെയ്താൽ, മുൻകൂട്ടി അറിയിപ്പില്ലാതെ എന്റെ അംഗത്വം റദ്ദാക്കാനുള്ള സെൻട്രൽ കമ്മിറ്റിയുടെ തീരുമാനം ഞാൻ അംഗീകരിക്കുന്നു.', 4
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM declarations);
