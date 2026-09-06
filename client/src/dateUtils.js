// The server sends DATE columns (validity_start/end, published_on, entry_date, paid_on, …)
// as plain 'YYYY-MM-DD' strings. `new Date('YYYY-MM-DD')` parses that as UTC midnight, so
// formatting it with toLocaleDateString in the viewer's local timezone shows the previous
// calendar day for anyone west of UTC. Parse the components directly into a local Date instead.
export function parseLocalDate(dateOnly) {
  const [y, m, d] = String(dateOnly).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(dateOnly, opts) {
  if (!dateOnly) return '';
  const dt = parseLocalDate(dateOnly);
  return opts ? dt.toLocaleDateString('en-IN', opts) : dt.toLocaleDateString('en-IN');
}
