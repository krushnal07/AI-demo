const AiAlert = require("../models/aiAlert");

/* ---------------------------------------------------------------------------
 * Crime-intelligence aggregations over activities_hackathon.
 *
 * Every figure here comes from scanning the `description` text, so the whole
 * corpus is walked ONCE per refresh and the result cached. Doing it per-request
 * would mean ~60 regex countDocuments calls against 5k long documents.
 * ------------------------------------------------------------------------- */

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache = { at: 0, data: null, building: null };

/* Signals the console tracks, grouped the way an officer would read them. */
const SIGNALS = [
  ["Traffic offence", "red light"],
  ["Traffic offence", "helmet"],
  ["Traffic offence", "illegal parking"],
  ["Traffic offence", "speeding"],
  ["Traffic offence", "wrong-side"],
  ["Hazard", "debris"],
  ["Hazard", "puddle"],
  ["Hazard", "smoke"],
  ["Hazard", "fire"],
  ["Hazard", "flood"],
  ["Hazard", "pothole"],
  ["Hazard", "obstruction"],
  ["Person behaviour", "loiter"],
  ["Person behaviour", "fight"],
  ["Person behaviour", "altercation"],
  ["Person behaviour", "following"],
  ["Person behaviour", "gathering"],
  ["Person behaviour", "running"],
  ["Property & weapon", "theft"],
  ["Property & weapon", "snatch"],
  ["Property & weapon", "robbery"],
  ["Property & weapon", "weapon"],
  ["Property & weapon", "knife"],
  ["Property & weapon", "stick"],
  ["Property & weapon", "unattended"],
  ["Property & weapon", "abandoned"],
  ["Incident", "accident"],
  ["Incident", "collision"],
  ["Incident", "injur"],
  ["Incident", "ambulance"],
  ["Response", "police"],
];

const ENTITIES = [
  "car", "motorcycle", "pedestrian", "auto-rickshaw", "bus", "crowd",
  "signal", "scooter", "helmet", "number plate", "bicycle", "truck",
  "police", "traffic jam",
];

const SECTIONS = [
  ["PERSON-OBJECT", "person-object"],
  ["VEHICLES:", "vehicles:"],
  ["TEXT:", "text:"],
  ["PEOPLE:", "people:"],
  ["ANOMALY:", "anomaly:"],
  ["ENVIRONMENT & LOCATION", "environment & location"],
  ["ALERTS & ANOMALIES", "alerts & anomalies"],
  ["TEMPORAL CHANGES", "temporal changes"],
];

const MIX_TERMS = ["car", "motorcycle", "auto-rickshaw", "bus"];

const NEG_WORDS = ["no ", "none", "not ", "nothing", "without", "absent", "no-"];
const NEG_WINDOW = 45;

const STOP = new Set((
  "the a an and or of in on at to is are was were be been being with for from by as it its this that these those " +
  "there here no not none any some all both each few more most other such only own same so than too very can will " +
  "just don should now camera cameras scene frame frames image images video visible appears appear seen see shows " +
  "show observed observe recorded record time times area areas location locations text overlay indicated suggests " +
  "typical general individuals individual person persons people activities activity detected detection their they " +
  "them his her he she we you i also however but which who whom whose what when where why how one two three four " +
  "five six seven eight nine ten multiple several various numerous many left right moving move parked stationary " +
  "near front background foreground due making mostly appears"
).split(/\s+/));

/** True when a negation sits just before the match - "no accident", "nothing suggesting a collision". */
const isNegated = (text, index) => {
  const start = Math.max(0, index - NEG_WINDOW);
  const before = text.slice(start, index);
  return NEG_WORDS.some((w) => before.includes(w));
};

const flaggedAnomaly = (text) => {
  const i = text.indexOf("anomaly:");
  if (i === -1) return false;
  const after = text.slice(i + 8, i + 40).trim();
  return !/^(none|no\b|nothing|n\/a)/.test(after);
};

const topN = (map, n) =>
  [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ term: k, count: v }));

const bump = (map, key, by) => map.set(key, (map.get(key) || 0) + (by || 1));

async function build() {
  const docs = await AiAlert.find(
    {},
    { description: 1, location: 1, camera_id: 1, timestamp: 1, motion_score: 1, motion_gated: 1, ocr_raw: 1 }
  ).lean();

  const register = SIGNALS.map(([group, term]) => ({ group, term, total: 0, negated: 0 }));
  const entities = new Map();
  const sections = new Map();
  const vocab = new Map();
  const phrases = new Map();
  const sites = new Map();
  const hours = new Array(24).fill(0);
  const motionBuckets = new Array(10).fill(0);
  let flaggedTotal = 0;
  let plateCount = 0;

  for (const d of docs) {
    const raw = String(d.description || "");
    const text = raw.toLowerCase();
    const loc = d.location || d.camera_id || "Unknown";

    if (d.ocr_raw) plateCount += 1;

    /* --- signals, with a negation window --- */
    for (let i = 0; i < register.length; i++) {
      const hit = text.indexOf(register[i].term);
      if (hit === -1) continue;
      register[i].total += 1;
      if (isNegated(text, hit)) register[i].negated += 1;
    }

    /* --- entities & sections --- */
    for (const e of ENTITIES) if (text.includes(e)) bump(entities, e);
    for (const [label, needle] of SECTIONS) if (text.includes(needle)) bump(sections, label);

    /* --- vocabulary + bigrams --- */
    const words = text.replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter(Boolean);
    const kept = words.filter((w) => w.length > 3 && !STOP.has(w));
    for (let i = 0; i < kept.length; i++) {
      bump(vocab, kept[i]);
      if (i < kept.length - 1) bump(phrases, kept[i] + " " + kept[i + 1]);
    }

    /* --- per-site rollup --- */
    let s = sites.get(loc);
    if (!s) {
      s = { location: loc, camera_id: d.camera_id, total: 0, flagged: 0, night: 0, mix: [0, 0, 0, 0] };
      sites.set(loc, s);
    }
    s.total += 1;

    const isFlagged = flaggedAnomaly(text);
    if (isFlagged) { s.flagged += 1; flaggedTotal += 1; }

    if (d.timestamp instanceof Date && !isNaN(d.timestamp)) {
      const h = d.timestamp.getUTCHours();
      hours[h] += 1;
      if (h >= 21 || h <= 4) s.night += 1;
    }

    MIX_TERMS.forEach((t, i) => { if (text.includes(t)) s.mix[i] += 1; });

    if (typeof d.motion_score === "number") {
      const b = Math.min(9, Math.max(0, Math.floor(d.motion_score * 10)));
      motionBuckets[b] += 1;
    }
  }

  const siteList = [...sites.values()]
    .map((s) => {
      const mixTotal = s.mix.reduce((a, b) => a + b, 0) || 1;
      return {
        ...s,
        rate: s.total ? +((s.flagged / s.total) * 100).toFixed(1) : 0,
        mixPct: s.mix.map((v) => Math.round((v / mixTotal) * 100)),
      };
    })
    .sort((a, b) => b.total - a.total);

  const withNet = register
    .map((r) => ({ ...r, net: r.total - r.negated }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.net - a.net);

  const groups = {};
  for (const r of withNet) {
    if (!groups[r.group]) groups[r.group] = { group: r.group, net: 0, total: 0 };
    groups[r.group].net += r.net;
    groups[r.group].total += r.total;
  }

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      segments: docs.length,
      sites: siteList.length,
      flagged: flaggedTotal,
      flagRate: docs.length ? +((flaggedTotal / docs.length) * 100).toFixed(1) : 0,
      night: hours.reduce((a, v, i) => a + (i >= 21 || i <= 4 ? v : 0), 0),
      plates: plateCount,
      signals: withNet.length,
    },
    register: withNet,
    registerGroups: Object.values(groups).sort((a, b) => b.net - a.net),
    entities: topN(entities, 20),
    sections: [...sections.entries()].map(([term, count]) => ({ term, count })).sort((a, b) => b.count - a.count),
    vocabulary: topN(vocab, 24),
    phrases: topN(phrases, 12),
    sites: siteList,
    hours,
    motionBuckets,
  };
}

/** GET /api/crime-intel/summary  (?refresh=1 to bypass the cache) */
const getSummary = async (req, res) => {
  try {
    const fresh = req.query.refresh === "1";
    const stale = Date.now() - cache.at > CACHE_TTL_MS;

    if (!fresh && cache.data && !stale) {
      return res.status(200).json({ success: true, cached: true, ...cache.data });
    }
    // collapse concurrent misses onto one build
    if (!cache.building) {
      cache.building = build()
        .then((data) => { cache = { at: Date.now(), data, building: null }; return data; })
        .catch((err) => { cache.building = null; throw err; });
    }
    const data = await cache.building;
    return res.status(200).json({ success: true, cached: false, ...data });
  } catch (err) {
    console.error("crime-intel summary failed:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /api/crime-intel/concordance?term=loiter&limit=20 */
const getConcordance = async (req, res) => {
  try {
    const term = String(req.query.term || "").trim();
    if (!term) return res.status(400).json({ success: false, message: "term is required" });

    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const docs = await AiAlert.find(
      { description: { $regex: safe, $options: "i" } },
      { description: 1, location: 1, camera_id: 1, start_time: 1, timestamp: 1 }
    ).limit(limit * 2).lean();

    const needle = term.toLowerCase();
    const hits = [];
    for (const d of docs) {
      const raw = String(d.description || "").replace(/\s+/g, " ");
      const at = raw.toLowerCase().indexOf(needle);
      if (at === -1) continue;
      hits.push({
        location: d.location,
        camera_id: d.camera_id,
        timestamp: d.timestamp,
        negated: isNegated(raw.toLowerCase(), at),
        before: raw.slice(Math.max(0, at - 90), at),
        match: raw.slice(at, at + term.length),
        after: raw.slice(at + term.length, at + term.length + 120),
      });
      if (hits.length >= limit) break;
    }

    return res.status(200).json({
      success: true,
      term,
      count: hits.length,
      observed: hits.filter((h) => !h.negated).length,
      hits,
    });
  } catch (err) {
    console.error("crime-intel concordance failed:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ---------------------------------------------------------------------------
 * Drill-down: every headline figure on the consoles resolves back to the
 * documents behind it, so a number can always be opened and read.
 * GET /api/ai-alerts/intel/drill?facet=<facet>&value=<v>&state=&page=&limit=
 * ------------------------------------------------------------------------- */
const SIGNAL_GROUPS = SIGNALS.reduce((acc, [group, term]) => {
  (acc[group] = acc[group] || []).push(term);
  return acc;
}, {});

const escapeRegex = (v) => String(v).replace(/[^a-zA-Z0-9 _-]/g, (m) => "\\" + m);

const NIGHT_HOURS = [21, 22, 23, 0, 1, 2, 3, 4];

const buildDrillQuery = (facet, value, only) => {
  switch (facet) {
    case "hour": {
      const h = parseInt(value, 10);
      if (!(h >= 0 && h <= 23)) return null;
      return { query: { $expr: { $eq: [{ $hour: "$timestamp" }, h] } }, terms: [] };
    }
    case "motion": {
      const b = parseInt(value, 10);
      if (!(b >= 0 && b <= 9)) return null;
      const lo = b / 10;
      return {
        query: { motion_score: b === 9 ? { $gte: lo } : { $gte: lo, $lt: (b + 1) / 10 } },
        terms: [],
      };
    }
    case "section":
      return { query: { description: { $regex: escapeRegex(value), $options: "i" } }, terms: [] };
    case "sites": {
      const list = String(value || "").split("|").filter(Boolean);
      if (!list.length) return null;
      return { query: { location: { $in: list } }, terms: [] };
    }
    case "signal":
      return { query: { description: { $regex: escapeRegex(value), $options: "i" } }, terms: [String(value).toLowerCase()] };
    case "group": {
      const terms = SIGNAL_GROUPS[value];
      if (!terms) return null;
      return {
        query: { $or: terms.map((t) => ({ description: { $regex: escapeRegex(t), $options: "i" } })) },
        terms: terms.map((t) => t.toLowerCase()),
      };
    }
    case "site": {
      const base = { location: value };
      if (only === "flagged") {
        return {
          query: { ...base, description: { $regex: "anomaly:", $options: "i" } },
          terms: [],
          postFilter: (t) => flaggedAnomaly(t),
        };
      }
      if (only === "night") {
        return { query: { ...base, $expr: { $or: NIGHT_HOURS.map((h) => ({ $eq: [{ $hour: "$timestamp" }, h] })) } }, terms: [] };
      }
      return { query: base, terms: [] };
    }
    case "flagged":
      return { query: { description: { $regex: "anomaly:", $options: "i" } }, terms: [], postFilter: (t) => flaggedAnomaly(t) };
    case "night":
      // $hour on the stored UTC instant - exact, and pageable in Mongo
      return {
        query: {
          $expr: {
            $or: NIGHT_HOURS.map((h) => ({ $eq: [{ $hour: "$timestamp" }, h] })),
          },
        },
        terms: [],
      };
    case "plates":
      return { query: { ocr_raw: { $nin: [null, ""] } }, terms: [] };
    case "segments":
      return { query: {}, terms: [] };
    default:
      return null;
  }
};

const getDrill = async (req, res) => {
  try {
    const facet = String(req.query.facet || "");
    const value = req.query.value;
    const state = req.query.state; // observed | negated | undefined
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));

    const spec = buildDrillQuery(facet, value, req.query.only);
    if (!spec) return res.status(400).json({ success: false, message: "Unknown facet: " + facet });

    // Facets needing text inspection are filtered in JS, so pull a working set
    // and page it there; the plain ones page in Mongo.
    const needsScan = Boolean(spec.postFilter) || spec.terms.length > 0;

    const projection = {
      camera_id: 1, location: 1, description: 1, start_time: 1, end_time: 1, timestamp: 1,
      segment_id: 1, frame_urls: 1, ocr_raw: 1, plate_number: 1, ocr_confidence: 1,
      recognized: 1, motion_score: 1, motion_gated: 1, anchor_confidence: 1,
      source_video: 1, video_offset_seconds: 1, cumulative_minutes: 1,
    };

    if (!needsScan) {
      const [docs, total] = await Promise.all([
        AiAlert.find(spec.query, projection).sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        AiAlert.countDocuments(spec.query),
      ]);
      return res.status(200).json({
        success: true, facet, value, total, page, limit,
        items: docs.map((d) => shapeItem(d, [])),
      });
    }

    // Cap guards memory; every text facet pre-filters in Mongo first, so the
    // working set is far smaller than the corpus.
    const docs = await AiAlert.find(spec.query, projection).sort({ timestamp: -1 }).limit(20000).lean();
    const matched = [];
    for (const d of docs) {
      const text = String(d.description || "").toLowerCase();
      if (spec.postFilter && !spec.postFilter(text)) continue;
      const item = shapeItem(d, spec.terms);
      if (state === "observed" && item.negated) continue;
      if (state === "negated" && !item.negated) continue;
      matched.push(item);
    }

    const start = (page - 1) * limit;
    return res.status(200).json({
      success: true, facet, value, state: state || null,
      total: matched.length,
      observed: matched.filter((m) => !m.negated).length,
      page, limit,
      items: matched.slice(start, start + limit),
    });
  } catch (err) {
    console.error("crime-intel drill failed:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** Trim a document to what a drill-down list needs, with the match located. */
function shapeItem(d, terms) {
  const raw = String(d.description || "").replace(/\s+/g, " ");
  const lower = raw.toLowerCase();

  let at = -1;
  let hit = "";
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i !== -1 && (at === -1 || i < at)) { at = i; hit = t; }
  }

  const negated = at !== -1 ? isNegated(lower, at) : false;
  const from = at === -1 ? 0 : Math.max(0, at - 90);
  const snippet = raw.slice(from, from + (at === -1 ? 220 : 260));

  return {
    id: d._id,
    camera_id: d.camera_id,
    location: d.location,
    segment_id: d.segment_id,
    start_time: d.start_time,
    end_time: d.end_time,
    timestamp: d.timestamp,
    motion_score: d.motion_score,
    motion_gated: d.motion_gated,
    anchor_confidence: d.anchor_confidence,
    source_video: d.source_video || null,
    video_offset_seconds: d.video_offset_seconds,
    cumulative_minutes: d.cumulative_minutes,
    ocr_raw: d.ocr_raw || null,
    plate_number: d.plate_number || null,
    ocr_confidence: d.ocr_confidence,
    recognized: d.recognized,
    frame: (d.frame_urls || [])[0] || null,
    frames: d.frame_urls || [],
    match: hit || null,
    matchAt: at,
    negated,
    truncatedStart: from > 0,
    snippet,
    // full text so a row can be opened without a second request
    description: raw,
  };
}

/* ---------------------------------------------------------------------------
 * AI-assisted search refinement.
 *
 * A keyword search over these descriptions is mostly noise: "accident" matches
 * 94 documents but ~73 are the describer RULING IT OUT, and others are the
 * prompt template listing what it checked for. This asks a model to read the
 * excerpt around each hit and say whether it actually evidences the thing.
 *
 * The key lives only in the backend env - it is never sent to the browser.
 * GET /api/ai-alerts/intel/refine?q=&date=&camera_id=&confidence=&gated=&limit=
 * ------------------------------------------------------------------------- */
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REFINE_MAX = 40;

/** A window around the first hit, so we send excerpts rather than 7k blobs. */
const excerptAround = (text, term, width) => {
  const body = String(text || "").replace(/\s+/g, " ");
  const span = width || 340;
  const at = body.toLowerCase().indexOf(String(term).toLowerCase());
  if (at === -1) return body.slice(0, span);
  const from = Math.max(0, at - Math.floor(span / 2));
  return (from > 0 ? "..." : "") + body.slice(from, from + span) + "...";
};

const refineSearch = async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      success: false,
      message: "AI refinement is not configured - set OPENROUTER_API_KEY in the backend env.",
    });
  }

  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ success: false, message: "q is required" });

  try {
    const limit = Math.min(REFINE_MAX, Math.max(1, parseInt(req.query.limit, 10) || REFINE_MAX));

    const filter = { description: { $regex: escapeRegex(q), $options: "i" } };
    if (req.query.camera_id && req.query.camera_id !== "all") filter.camera_id = req.query.camera_id;
    if (req.query.confidence && req.query.confidence !== "all") filter.anchor_confidence = req.query.confidence;
    if (req.query.gated === "true") filter.motion_gated = true;
    else if (req.query.gated === "false") filter.motion_gated = false;
    if (req.query.date && req.query.date !== "all") {
      const start = new Date(req.query.date + "T00:00:00.000Z");
      const end = new Date(req.query.date + "T23:59:59.999Z");
      if (!isNaN(start.getTime())) filter.timestamp = { $gte: start, $lte: end };
    }

    const docs = await AiAlert.find(filter, {
      description: 1, camera_id: 1, location: 1, start_time: 1, timestamp: 1, segment_id: 1,
    }).sort({ timestamp: -1 }).limit(limit).lean();

    if (!docs.length) {
      return res.status(200).json({ success: true, query: q, reviewed: 0, relevant: 0, verdicts: [], summary: "Nothing matched that search." });
    }

    const items = docs.map((d, i) => ({ n: i + 1, id: String(d._id), text: excerptAround(d.description, q) }));

    const prompt =
      'A user searched CCTV scene descriptions for: "' + q + '"\n\n' +
      "For each excerpt decide whether it actually EVIDENCES that thing at the scene. " +
      "Many descriptions mention a term only to rule it out (\"no accidents observed\") or " +
      "because the describer is listing what it checked for - neither is evidence.\n\n" +
      "Return ONLY a JSON object:\n" +
      '{"summary":"<one sentence>","verdicts":[{"n":1,"relevant":true,"reason":"<8 words max>"}]}\n\n' +
      items.map((it) => "[" + it.n + "] " + it.text).join("\n\n");

    const started = Date.now();
    const upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "anthropic/claude-haiku-4.5",
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 1600,
      }),
    });

    const payload = await upstream.json();
    if (!upstream.ok || payload.error) {
      console.error("refine upstream failed:", payload.error || upstream.status);
      return res.status(502).json({
        success: false,
        message: payload.error?.message || ("Model request failed (" + upstream.status + ")"),
      });
    }

    const raw = payload.choices?.[0]?.message?.content || "";
    const slice = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);

    let parsed;
    try {
      parsed = JSON.parse(slice);
    } catch (err) {
      // the model is asked for strict JSON; if it drifts, say so rather than guess
      return res.status(502).json({ success: false, message: "Model did not return usable JSON." });
    }

    const byN = new Map(items.map((it) => [it.n, it]));
    const verdicts = (parsed.verdicts || [])
      .filter((v) => byN.has(v.n))
      .map((v) => ({
        id: byN.get(v.n).id,
        relevant: Boolean(v.relevant),
        reason: String(v.reason || "").slice(0, 90),
      }));

    return res.status(200).json({
      success: true,
      query: q,
      model: payload.model,
      ms: Date.now() - started,
      cost: payload.usage?.cost ?? null,
      reviewed: verdicts.length,
      relevant: verdicts.filter((v) => v.relevant).length,
      truncated: docs.length === limit,
      summary: String(parsed.summary || "").slice(0, 300),
      verdicts,
    });
  } catch (err) {
    console.error("refine failed:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getSummary, getConcordance, getDrill, refineSearch };
