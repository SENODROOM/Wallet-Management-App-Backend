// Month periods for the Monthly Budget, written as "YYYY-MM" so they sort and
// compare as plain strings. Kept apart from the route because this is the part
// that only runs at a month boundary — once a month, in the wild.

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_ABBR = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function isPeriod(value) {
  return typeof value === "string" && PERIOD_RE.test(value);
}

// The month a stored day label names — "16 Aug (Saturday)" -> "2026-08".
// Labels carry no year, so it is resolved against the month being opened: a
// month later than that one belongs to the year before. Null when undated.
function monthOfLabel(day, period) {
  const match = String(day || "").match(/(\d{1,2})\s+([A-Za-z]{3})/);
  if (!match) return null;
  const idx = MONTH_ABBR.indexOf(match[2].toLowerCase());
  if (idx < 0) return null;
  const year = Number(period.slice(0, 4));
  const monthIdx = Number(period.slice(5, 7)) - 1;
  return `${idx > monthIdx ? year - 1 : year}-${String(idx + 1).padStart(2, "0")}`;
}

// An entry the user actually wrote, as opposed to a blank row — the ledger adds
// one for today on every visit, so blank rows are the app talking, not the user.
function hasContent(item) {
  return String((item && item.name) || "").trim() !== "" || Number(item && item.price) !== 0;
}

function modeMonth(items, period) {
  const counts = new Map();
  (items || []).forEach((item) => {
    const month = monthOfLabel(item && item.day, period);
    if (month) counts.set(month, (counts.get(month) || 0) + 1);
  });
  let best = null;
  // Ascending, so an equal count leaves the later month holding the section.
  Array.from(counts.keys())
    .sort()
    .forEach((month) => {
      if (best === null || counts.get(month) >= counts.get(best)) best = month;
    });
  return best;
}

// The month a set of entries is about: the one most of them name. The last
// entry is not a safe guide — a single row dated today drags a whole month of
// spending into the new month — so this counts them. Blank rows only get a say
// when nothing has been written yet.
function inferPeriod(items, period) {
  return modeMonth((items || []).filter(hasContent), period) || modeMonth(items, period);
}

// What opening `period` means for the live monthly section:
//   archives — records to file away, oldest first (usually one, or none)
//   keep     — the entries the live section keeps, or null to leave it alone
//   reset    — clear the note as well (the budget amount always carries over)
//   period   — the period the live section should carry afterwards
function planRollover(section, period) {
  const items = (section.items || []).slice();
  const stored = isPeriod(section.period) ? section.period : null;
  const budget = Number(section.budget) || 0;
  const description = String(section.description || "");
  // Labels are dated against the furthest month in play. A section stamped
  // ahead of the client's clock holds labels that are genuinely ahead of it,
  // and reading those as last year's would archive the month in progress.
  const reference = stored && stored > period ? stored : period;

  // Every entry names its own month, so every entry decides for itself. A
  // section can hold both last month's spending and rows typed after midnight
  // on the 1st, and only the latter stay behind in the live month.
  const keep = [];
  const closed = [];
  items.forEach((item) => {
    const month = monthOfLabel(item && item.day, reference);
    if (month && month >= period) keep.push(item);
    else closed.push(item);
  });

  // Which month is closing: what its own entries say, or failing that the stamp
  // the section carries. Undated entries alone cannot date a section.
  let closing = inferPeriod(closed, reference);
  if (closing && closing >= period) closing = null;
  if (!closing && stored && stored < period) closing = stored;

  if (!closing) {
    // Either nothing says the section is behind (adopt the month the client is
    // in) or it is already at or ahead of it — a clock disagreement, better
    // left alone than made to reopen a month that has moved on.
    return { archives: [], keep: null, reset: false, period: stored || period };
  }

  // Entries from months further back keep their own records rather than being
  // filed under the month that happened to be open last.
  const groups = new Map([[closing, []]]);
  closed.forEach((item) => {
    const month = monthOfLabel(item && item.day, reference) || closing;
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month).push(item);
  });

  // The note was last edited while the most recent of these months was open, so
  // that is the one it describes.
  const noted = Array.from(groups.keys()).sort().pop();

  const archives = Array.from(groups.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, group]) => ({
      period: month,
      items: group,
      budget,
      // The note describes the month that just ended, not an older one that got
      // swept up with it.
      description: month === noted ? description : ""
    }))
    // An empty month is not worth a record — but a budget that was set and
    // never spent still says something about the month it covered.
    .filter(
      (archive) =>
        archive.items.some(hasContent) ||
        (archive.period === noted && (budget > 0 || description.trim() !== ""))
    );

  return { archives, keep, reset: true, period };
}

module.exports = { PERIOD_RE, isPeriod, monthOfLabel, hasContent, inferPeriod, planRollover };
