// Month periods for the Monthly Budget, written as "YYYY-MM" so they sort and
// compare as plain strings. Kept apart from the route because this is the part
// that only runs at a month boundary — once a month, in the wild.

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_ABBR = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function isPeriod(value) {
  return typeof value === "string" && PERIOD_RE.test(value);
}

// Day labels are stored as "16 Aug (Saturday)" with no year, so a section saved
// before periods existed has to be dated from its own entries: the month they
// name, in the year that places it at or before the month being opened.
// Returns null when nothing in the section says which month it belongs to.
function inferPeriod(items, period) {
  const year = Number(period.slice(0, 4));
  const monthIdx = Number(period.slice(5, 7)) - 1;
  for (let i = (items || []).length - 1; i >= 0; i--) {
    const match = String((items[i] && items[i].day) || "").match(/(\d{1,2})\s+([A-Za-z]{3})/);
    if (!match) continue;
    const idx = MONTH_ABBR.indexOf(match[2].toLowerCase());
    if (idx < 0) continue;
    return `${idx > monthIdx ? year - 1 : year}-${String(idx + 1).padStart(2, "0")}`;
  }
  return null;
}

// What opening `period` means for the live monthly section:
//   archive — the period to file the current entries under, or null
//   reset   — clear the entries and the note (the budget amount carries over)
//   period  — the period the live section should carry afterwards
function planRollover(section, period) {
  const stored = isPeriod(section.period) ? section.period : inferPeriod(section.items, period);
  const hasContent =
    (section.items || []).length > 0 ||
    Number(section.budget) > 0 ||
    String(section.description || "").trim() !== "";

  if (stored && stored < period) {
    // An empty month is not worth a record — just move the section forward.
    return { archive: hasContent ? stored : null, reset: true, period };
  }
  // Either the section was never stamped (adopt the month the client is in) or
  // it is already at or ahead of it (a clock disagreement — leave it alone
  // rather than reopening a month that has moved on).
  return { archive: null, reset: false, period: stored || period };
}

module.exports = { PERIOD_RE, isPeriod, inferPeriod, planRollover };
