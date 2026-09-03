/**
 * Traffic-offence taxonomy for the Crime Branch console.
 *
 * The describer writes numbered sections. Two carry enforcement value:
 *   7. TRAFFIC VIOLATIONS - what it judged to be an offence
 *   5. NOTABLE EVENTS     - near-misses, unsafe carriage, pedestrians in the carriageway
 *
 * Roughly 60% of those sections say "none observed", so every count here is
 * taken from sections that actually report something - never from a raw
 * keyword hit against the whole description.
 */

/** Sections the current describer emits, used to find where one ends. */
const SECTION_NAMES = [
  "ALERTS",
  "SCENE",
  "TRAFFIC AND PEOPLE",
  "CHANGES ACROSS THE CLIP",
  "VEHICLES IDENTIFIED",
  "VEHICLES",
  "REGISTRATIONS READ",
  "NOTABLE EVENTS",
  "PEOPLE",
  "CROWD AND CONGESTION",
  "TRAFFIC VIOLATIONS",
  "PATTERN OF ACTIVITY",
  "QUIET PERIODS",
  "PERSON-OBJECT",
  "PERSON-PERSON",
];

/**
 * Offence categories, ordered by enforcement weight.
 * `severity` drives the console's colour and sort order:
 *   critical - collision or a direct danger to life
 *   high     - a chargeable moving violation
 *   medium   - obstruction or a rule breach with lower immediate risk
 *   watch    - context an officer should see but cannot charge
 */
const VIOLATION_CATEGORIES = [
  {
    key: "collision",
    label: "Collision / near-miss",
    severity: "critical",
    section: "both",
    match: ["collision", "near-miss", "near miss", "crash", "hit and run", "hit-and-run", "struck", "rear-ended"],
  },
  {
    key: "red_light",
    label: "Red-light jumping",
    severity: "high",
    section: "violations",
    match: ["red light", "red-light", "red signal", "run the red", "jump the signal", "jumps the signal",
            "signal violation", "against the signal", "red phase"],
  },
  {
    key: "no_helmet",
    label: "Riding without helmet",
    severity: "high",
    section: "violations",
    match: ["helmet", "helmetless"],
  },
  {
    key: "wrong_side",
    label: "Wrong-side / contraflow",
    severity: "high",
    section: "violations",
    match: ["wrong side", "wrong-side", "wrong way", "wrong-way", "against the flow", "contraflow",
            "contrary to", "opposing traffic"],
  },
  {
    key: "unsafe_carriage",
    label: "Unsafe carriage / triple riding",
    severity: "high",
    section: "both",
    match: ["triple", "three riders", "three people on", "three on a", "overload", "unrestrained",
            "standing passengers", "standing in its open", "open cargo", "open rear", "unsafe carriage",
            "pillion"],
  },
  {
    key: "stop_line",
    label: "Stop-line / zebra encroachment",
    severity: "medium",
    // violations section only: "crosses the zebra" is ordinary movement, not an
    // offence, so the phrases below all describe stopping ON or over it
    section: "violations",
    match: ["stop line", "stop-line", "over the line", "stopped on the zebra", "stopped over the zebra",
            "stopped on or", "on the zebra", "across the zebra", "over the zebra", "encroach",
            "blocking the pedes", "obstructing pedestrians"],
  },
  {
    key: "lane_footpath",
    label: "Lane / footpath violation",
    severity: "medium",
    section: "violations",
    match: ["lane discipline", "straddling", "footpath", "sidewalk", "pavement", "wrong lane",
            "between lanes", "lane change"],
  },
  {
    key: "obstruction",
    label: "Obstructive stopping",
    severity: "medium",
    section: "both",
    match: ["obstruct", "blocking", "illegal parking", "illegally parked", "no-parking",
            "stopped in", "parked on"],
  },
  {
    key: "pedestrian_risk",
    label: "Pedestrian in carriageway",
    severity: "watch",
    section: "both",
    match: ["jaywalk", "outside the zebra", "outside the marked", "outside a marked", "across the live",
            "live carriageway", "crossing the carriageway", "between moving vehicles"],
  },
  {
    key: "emergency",
    label: "Emergency vehicle transit",
    severity: "watch",
    section: "both",
    match: ["ambulance", "fire brigade", "fire engine", "emergency lights", "police vehicle", "siren"],
  },
];

/** Pull one numbered section's text out of a description. */
const sectionOf = (description, name) => {
  const body = String(description || "").replace(/\s+/g, " ").trim();
  const stop = "(?=\\s\\d{1,2}\\.\\s+(?:" + SECTION_NAMES.join("|") + ")|$)";
  const re = new RegExp("\\d{1,2}\\.\\s*" + name + "\\b[^a-zA-Z0-9]{0,4}(.*?)" + stop, "i");
  const m = body.match(re);
  return m ? m[1].replace(/^[:\-\s]+/, "").trim() : null;
};

/** True when a section is present but reports nothing worth acting on. */
const reportsNothing = (text) =>
  !text ||
  text.length < 10 ||
  /^(none|no\b|nothing|n\/a|not )/i.test(text) ||
  /^none (observed|detected|noted|visible|apparent|reported|seen)/i.test(text);

/*
 * Section-level filtering is not enough. A substantive section still says
 * things like "No collisions, near-misses or unattended items observed" -
 * 249 of 256 raw "collision" matches were exactly that. So each match is also
 * checked against a short window of text before it.
 */
const NEGATORS = [
  "no ", "no-", "none", "not ", "nothing", "without", "avoided", "cannot",
  "can not", "could not", "unable", "n/a", "absent", "free of", "clear of",
];
const NEG_WINDOW = 55;

/** True when a negation sits close in front of the match. */
const negatedAt = (text, index) => {
  const before = text.slice(Math.max(0, index - NEG_WINDOW), index);
  return NEGATORS.some((w) => before.includes(w));
};

/**
 * Does this text affirmatively report the category, at any occurrence?
 * A phrase negated in one clause but affirmed in another still counts.
 */
const affirms = (text, phrases) => {
  for (const phrase of phrases) {
    let at = text.indexOf(phrase);
    while (at !== -1) {
      if (!negatedAt(text, at)) return true;
      at = text.indexOf(phrase, at + phrase.length);
    }
  }
  return false;
};

/**
 * Classify one document.
 * Returns { hasViolation, hasNotable, hasAlert, texts, categories: [key] }
 */
const classify = (description) => {
  const violations = sectionOf(description, "TRAFFIC VIOLATIONS");
  const notable = sectionOf(description, "NOTABLE EVENTS");
  const alerts = sectionOf(description, "ALERTS");

  const vText = reportsNothing(violations) ? null : violations;
  const nText = reportsNothing(notable) ? null : notable;
  const aText = reportsNothing(alerts) ? null : alerts;

  const haystack = [vText, nText, aText].filter(Boolean).join(" ").toLowerCase();
  const vOnly = (vText || "").toLowerCase();

  const categories = [];
  for (const cat of VIOLATION_CATEGORIES) {
    const target = cat.section === "violations" ? vOnly : haystack;
    if (!target) continue;
    if (affirms(target, cat.match)) categories.push(cat.key);
  }

  return {
    hasViolation: Boolean(vText),
    hasNotable: Boolean(nText),
    hasAlert: Boolean(aText),
    violationText: vText,
    notableText: nText,
    alertText: aText,
    categories,
  };
};

/*
 * Registration legibility.
 *
 * The describer is verbose about failure and phrases it many ways - "None
 * legible", "too small or blurred to read reliably", "beyond legible
 * resolution", "characters are not reliably readable". Matching a couple of
 * spellings of "not legible" wrongly passed most of those as readable, so a
 * plate only counts as READ when the text actually offers characters and does
 * not disclaim them.
 */
const PLATE_FAIL = new RegExp(
  [
    "no(?:ne|t)? (?:\\w+ ){0,2}legible",
    "il+egible",
    "un-?readable",
    "not (?:\\w+ ){0,2}read(?:able)?",
    "cannot be (?:read|resolved|determined|made out)",
    "could not be (?:read|resolved|determined)",
    "unable to (?:read|resolve|determine)",
    "beyond (?:\\w+ ){0,2}(?:legible|readable) resolution",
    "too (?:small|blurred|distant|low)",
    "blurred",
    "motion blur",
    "not (?:clearly |reliably )?(?:visible|discernible|resolvable|readable)",
    "characters (?:are |cannot|could not)",
    "no plates? (?:were )?read",
    "not confirmed",
    "low confidence",
  ].join("|"),
  "i"
);

/** An Indian-format registration with actual characters, e.g. GJ 01 AB 1234. */
const PLATE_SHAPE = /\b[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{1,4}\b/;

/**
 * True only when the section gives readable characters. Partial reads that the
 * describer itself hedges ("approximately", "partial") are NOT counted - an
 * unusable plate is worse than none on an enforcement console.
 */
const plateReadable = (description) => {
  const reg = sectionOf(description, "REGISTRATIONS READ");
  if (reportsNothing(reg)) return false;
  if (PLATE_FAIL.test(reg)) return false;
  if (/partial|approximately|appears to read|possibly|unsure/i.test(reg)) return false;
  return PLATE_SHAPE.test(reg.toUpperCase());
};

const CATEGORY_BY_KEY = VIOLATION_CATEGORIES.reduce((acc, c) => { acc[c.key] = c; return acc; }, {});

module.exports = {
  VIOLATION_CATEGORIES,
  affirms,
  negatedAt,
  CATEGORY_BY_KEY,
  SECTION_NAMES,
  sectionOf,
  reportsNothing,
  classify,
  plateReadable,
};
