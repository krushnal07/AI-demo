const AiAlert = require("../models/aiAlert");
const { coordsFor } = require("../constants/siteCoordinates");
const {
  VIOLATION_CATEGORIES,
  CATEGORY_BY_KEY,
  classify,
  plateReadable,
  sectionOf,
  reportsNothing,
} = require("../constants/trafficRules");

/* ---------------------------------------------------------------------------
 * Crime Branch intelligence over activities_hackathon.
 *
 * Traffic-enforcement oriented throughout. The describer writes numbered
 * sections; "7. TRAFFIC VIOLATIONS" and "5. NOTABLE EVENTS" are the two with
 * charging value. Both are heavily negated - 249 of 256 raw "collision" hits
 * were "No collisions observed" - so counts come from trafficRules.classify(),
 * never from a keyword match against the whole description.
 *
 * The corpus is walked once per refresh and cached; a per-request scan of every
 * description would be far too slow.
 * ------------------------------------------------------------------------- */

const CACHE_TTL_MS = 10 * 60 * 1000;
let cache = { at: 0, data: null, building: null };

const NIGHT_HOURS = [21, 22, 23, 0, 1, 2, 3, 4];
const escapeRegex = (v) => String(v).replace(/[^a-zA-Z0-9 _-]/g, (m) => "\\" + m);

const excerptAround = (text, term, width) => {
  const body = String(text || "").replace(/\s+/g, " ");
  const span = width || 340;
  if (!term) return body.slice(0, span);
  const at = body.toLowerCase().indexOf(String(term).toLowerCase());
  if (at === -1) return body.slice(0, span);
  const from = Math.max(0, at - Math.floor(span / 2));
  return (from > 0 ? "..." : "") + body.slice(from, from + span) + "...";
};

/** The most serious offence in a segment, for a one-chip summary. */
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, watch: 3 };
const primaryOffence = (keys) =>
  keys.length
    ? [...keys].sort(
        (a, b) => SEVERITY_ORDER[CATEGORY_BY_KEY[a].severity] - SEVERITY_ORDER[CATEGORY_BY_KEY[b].severity]
      )[0]
    : null;

async function build() {
  const docs = await AiAlert.find(
    {},
    { description: 1, location: 1, camera_id: 1, timestamp: 1, start_time: 1, motion_score: 1 }
  ).lean();

  const offences = VIOLATION_CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    severity: c.severity,
    segments: 0,
    sites: new Set(),
  }));
  const byKey = offences.reduce((acc, o) => { acc[o.key] = o; return acc; }, {});

  const sites = new Map();
  const hours = new Array(24).fill(0);
  const violationHours = new Array(24).fill(0);

  let withViolation = 0;
  let withNotable = 0;
  let plateAttempted = 0;
  let plateLegible = 0;

  for (const d of docs) {
    const loc = d.location || d.camera_id || "Unknown";
    const verdict = classify(d.description);

    let s = sites.get(loc);
    if (!s) {
      s = { location: loc, camera_id: d.camera_id, segments: 0, violations: 0, night: 0, offences: {} };
      sites.set(loc, s);
    }
    s.segments += 1;

    if (verdict.hasViolation) { withViolation += 1; s.violations += 1; }
    if (verdict.hasNotable) withNotable += 1;

    const reg = sectionOf(d.description, "REGISTRATIONS READ");
    if (!reportsNothing(reg)) {
      plateAttempted += 1;
      if (plateReadable(d.description)) plateLegible += 1;
    }

    for (const key of verdict.categories) {
      byKey[key].segments += 1;
      byKey[key].sites.add(loc);
      s.offences[key] = (s.offences[key] || 0) + 1;
    }

    if (d.timestamp instanceof Date && !isNaN(d.timestamp)) {
      const h = d.timestamp.getUTCHours();
      hours[h] += 1;
      if (verdict.categories.length) violationHours[h] += 1;
      if (NIGHT_HOURS.includes(h)) s.night += 1;
    }
  }

  const siteList = [...sites.values()]
    .map((s) => {
      const ranked = Object.entries(s.offences).sort((a, b) => b[1] - a[1]);
      const geo = coordsFor(s.location);
      return {
        ...s,
        rate: s.segments ? +((s.violations / s.segments) * 100).toFixed(1) : 0,
        topOffence: ranked.length
          ? { key: ranked[0][0], label: CATEGORY_BY_KEY[ranked[0][0]].label, n: ranked[0][1] }
          : null,
        lat: geo ? geo.lat : null,
        lng: geo ? geo.lng : null,
        label: geo ? geo.label : s.location,
        spread: geo ? geo.spread : null,
      };
    })
    .sort((a, b) => b.violations - a.violations);

  const register = offences
    .map((o) => ({ ...o, sites: o.sites.size }))
    .filter((o) => o.segments > 0)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.segments - a.segments);

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      segments: docs.length,
      sites: siteList.length,
      withViolation,
      violationRate: docs.length ? +((withViolation / docs.length) * 100).toFixed(1) : 0,
      withNotable,
      chargeable: register
        .filter((r) => r.severity === "high" || r.severity === "critical")
        .reduce((n, r) => n + r.segments, 0),
      plateAttempted,
      plateLegible,
    },
    register,
    sites: siteList,
    hours,
    violationHours,
  };
}

/** GET /api/ai-alerts/intel/summary (?refresh=1) */
const getSummary = async (req, res) => {
  try {
    const fresh = req.query.refresh === "1";
    const stale = Date.now() - cache.at > CACHE_TTL_MS;

    if (!fresh && cache.data && !stale) {
      return res.status(200).json({ success: true, cached: true, ...cache.data });
    }
    if (!cache.building) {
      cache.building = build()
        .then((data) => { cache = { at: Date.now(), data, building: null }; return data; })
        .catch((err) => { cache.building = null; throw err; });
    }
    const data = await cache.building;
    return res.status(200).json({ success: true, cached: false, ...data });
  } catch (err) {
    console.error("intel summary failed:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /intel/offences - the taxonomy, for filter controls. */
const getOffences = (req, res) =>
  res.status(200).json({
    success: true,
    offences: VIOLATION_CATEGORIES.map((c) => ({ key: c.key, label: c.label, severity: c.severity })),
  });

/* ---------------------------------------------------------------------------
 * Drill-down: every figure resolves back to the segments behind it.
 * GET /intel/drill?facet=offence|site|violations|notable|hour|night|segments|phrase
 * ------------------------------------------------------------------------- */
const buildDrillQuery = (facet, value, only) => {
  switch (facet) {
    case "offence":
      return { query: {}, offence: value };
    case "violations":
      return { query: {}, requires: "violation" };
    case "notable":
      return { query: {}, requires: "notable" };
    case "plates":
      // only=unreadable gives the failures, which are the useful half for
      // deciding whether a camera can support a prosecution
      return { query: {}, requires: only === "unreadable" ? "plate_unreadable" : "plate_readable" };
    case "site": {
      const base = { location: value };
      if (only === "violations") return { query: base, requires: "violation" };
      if (only === "night") {
        return { query: { ...base, $expr: { $or: NIGHT_HOURS.map((h) => ({ $eq: [{ $hour: "$timestamp" }, h] })) } } };
      }
      return { query: base };
    }
    case "hour": {
      const h = parseInt(value, 10);
      if (!(h >= 0 && h <= 23)) return null;
      return { query: { $expr: { $eq: [{ $hour: "$timestamp" }, h] } } };
    }
    case "night":
      return { query: { $expr: { $or: NIGHT_HOURS.map((h) => ({ $eq: [{ $hour: "$timestamp" }, h] })) } } };
    case "segments":
      return { query: {} };
    case "phrase":
      return { query: { description: { $regex: escapeRegex(value), $options: "i" } }, term: value };
    default:
      return null;
  }
};

const shapeItem = (d, verdict, term) => {
  const raw = String(d.description || "").replace(/\s+/g, " ");
  // lead with the enforcement text, not the scene description
  const lead = verdict.violationText || verdict.notableText || verdict.alertText;
  return {
    id: d._id,
    camera_id: d.camera_id,
    location: d.location,
    segment_id: d.segment_id,
    start_time: d.start_time,
    end_time: d.end_time,
    timestamp: d.timestamp,
    motion_score: d.motion_score,
    source_video: d.source_video || null,
    video_offset_seconds: d.video_offset_seconds,
    frame: (d.frame_urls || [])[0] || null,
    frames: d.frame_urls || [],
    offences: verdict.categories.map((k) => ({
      key: k, label: CATEGORY_BY_KEY[k].label, severity: CATEGORY_BY_KEY[k].severity,
    })),
    primary: primaryOffence(verdict.categories),
    violationText: verdict.violationText,
    notableText: verdict.notableText,
    plateText: (() => {
      const reg = sectionOf(d.description, "REGISTRATIONS READ");
      return reportsNothing(reg) ? null : reg;
    })(),
    snippet: term ? excerptAround(raw, term, 260) : lead ? lead.slice(0, 260) : raw.slice(0, 220),
    description: raw,
  };
};

const getDrill = async (req, res) => {
  try {
    const facet = String(req.query.facet || "");
    const spec = buildDrillQuery(facet, req.query.value, req.query.only);
    if (!spec) return res.status(400).json({ success: false, message: "Unknown facet: " + facet });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));

    const projection = {
      camera_id: 1, location: 1, description: 1, start_time: 1, end_time: 1, timestamp: 1,
      segment_id: 1, frame_urls: 1, motion_score: 1, source_video: 1, video_offset_seconds: 1,
    };

    const docs = await AiAlert.find(spec.query, projection).sort({ timestamp: -1 }).limit(20000).lean();

    const matched = [];
    for (const d of docs) {
      const verdict = classify(d.description);
      if (spec.offence && !verdict.categories.includes(spec.offence)) continue;
      if (spec.requires === "violation" && !verdict.hasViolation) continue;
      if (spec.requires === "notable" && !verdict.hasNotable) continue;
      if (spec.requires === "plate_readable" || spec.requires === "plate_unreadable") {
        const reg = sectionOf(d.description, "REGISTRATIONS READ");
        if (reportsNothing(reg)) continue; // no attempt recorded at all
        const readable = plateReadable(d.description);
        if (spec.requires === "plate_readable" && !readable) continue;
        if (spec.requires === "plate_unreadable" && readable) continue;
      }
      matched.push(shapeItem(d, verdict, spec.term));
    }

    const start = (page - 1) * limit;
    return res.status(200).json({
      success: true,
      facet,
      value: req.query.value || null,
      total: matched.length,
      page,
      limit,
      items: matched.slice(start, start + limit),
    });
  } catch (err) {
    console.error("drill failed:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** GET /intel/concordance?term=&limit= - the sentence, so a reader can judge it. */
const getConcordance = async (req, res) => {
  try {
    const term = String(req.query.term || "").trim();
    if (!term) return res.status(400).json({ success: false, message: "term is required" });
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const docs = await AiAlert.find(
      { description: { $regex: escapeRegex(term), $options: "i" } },
      { description: 1, location: 1, camera_id: 1, start_time: 1, timestamp: 1 }
    ).limit(limit * 2).lean();

    const needle = term.toLowerCase();
    const hits = [];
    for (const d of docs) {
      const raw = String(d.description || "").replace(/\s+/g, " ");
      const at = raw.toLowerCase().indexOf(needle);
      if (at === -1) continue;
      const before = raw.slice(Math.max(0, at - 90), at);
      hits.push({
        location: d.location,
        camera_id: d.camera_id,
        timestamp: d.timestamp,
        negated: /\b(no|not|nothing|without|cannot|unable)\b[^.]{0,45}$/i.test(before),
        before,
        match: raw.slice(at, at + term.length),
        after: raw.slice(at + term.length, at + term.length + 120),
      });
      if (hits.length >= limit) break;
    }

    return res.status(200).json({
      success: true, term, count: hits.length,
      observed: hits.filter((h) => !h.negated).length, hits,
    });
  } catch (err) {
    console.error("concordance failed:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/* ---------------------------------------------------------------------------
 * AI-assisted refinement. The key lives only in the backend env.
 * ------------------------------------------------------------------------- */
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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
    const limit = Math.min(40, Math.max(1, parseInt(req.query.limit, 10) || 40));
    const filter = { description: { $regex: escapeRegex(q), $options: "i" } };
    if (req.query.camera_id && req.query.camera_id !== "all") filter.camera_id = req.query.camera_id;
    if (req.query.date && req.query.date !== "all") {
      const start = new Date(req.query.date + "T00:00:00.000Z");
      const end = new Date(req.query.date + "T23:59:59.999Z");
      if (!isNaN(start.getTime())) filter.timestamp = { $gte: start, $lte: end };
    }

    // Callers that pair this with /intel/trace (which reads oldest-first) pass
    // order=asc so both cover the same 40 segments; default stays newest-first.
    const order = req.query.order === "asc" ? 1 : -1;

    const docs = await AiAlert.find(filter, {
      description: 1, camera_id: 1, location: 1, start_time: 1,
    }).sort({ timestamp: order }).limit(limit).lean();

    if (!docs.length) {
      return res.status(200).json({
        success: true, query: q, reviewed: 0, relevant: 0, verdicts: [],
        summary: "Nothing matched that search.",
      });
    }

    const items = docs.map((d, i) => ({ n: i + 1, id: String(d._id), text: excerptAround(d.description, q) }));
    const prompt =
      'A traffic-enforcement officer searched CCTV scene descriptions for: "' + q + '"\n\n' +
      "For each excerpt decide whether it actually EVIDENCES that at the scene. Descriptions " +
      'frequently mention a thing only to rule it out ("No collisions or near-misses observed") ' +
      "or to list what was checked for - neither is evidence.\n\n" +
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
      return res.status(502).json({
        success: false,
        message: payload.error?.message || "Model request failed (" + upstream.status + ")",
      });
    }

    const raw = payload.choices?.[0]?.message?.content || "";
    const slice = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    let parsed;
    try {
      parsed = JSON.parse(slice);
    } catch (err) {
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
      success: true, query: q, model: payload.model, ms: Date.now() - started,
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

/* ---------------------------------------------------------------------------
 * Movement trace. GET /intel/trace?q=&offence=&limit=
 * ------------------------------------------------------------------------- */
const getTrace = async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const offence = String(req.query.offence || "").trim();
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 80));

    const counts = await AiAlert.aggregate([
      { $group: { _id: "$location", segments: { $sum: 1 }, camera_id: { $first: "$camera_id" } } },
    ]);

    const sites = counts
      .map((row) => {
        const c = coordsFor(row._id);
        if (!c) return null;
        return {
          location: row._id, camera_id: row.camera_id, segments: row.segments,
          lat: c.lat, lng: c.lng, label: c.label, spread: c.spread,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.segments - a.segments);

    const unmapped = counts.filter((r) => !coordsFor(r._id)).map((r) => r._id);

    if (!q && !offence) {
      return res.status(200).json({
        success: true, mode: null, sites, unmapped, sightings: [], legs: [], visited: [],
      });
    }

    const filter = q ? { description: { $regex: escapeRegex(q), $options: "i" } } : {};
    const docs = await AiAlert.find(filter, {
      camera_id: 1, location: 1, description: 1, start_time: 1, timestamp: 1,
      segment_id: 1, frame_urls: 1, source_video: 1, video_offset_seconds: 1,
    }).sort({ timestamp: 1 }).limit(offence ? 20000 : limit).lean();

    const sightings = [];
    for (const d of docs) {
      const verdict = classify(d.description);
      if (offence && !verdict.categories.includes(offence)) continue;
      const c = coordsFor(d.location) || {};
      sightings.push({
        id: d._id,
        location: d.location,
        label: c.label || d.location,
        camera_id: d.camera_id,
        segment_id: d.segment_id,
        lat: c.lat ?? null,
        lng: c.lng ?? null,
        spread: c.spread || null,
        timestamp: d.timestamp,
        start_time: d.start_time,
        source_video: d.source_video || null,
        video_offset_seconds: d.video_offset_seconds,
        frame: (d.frame_urls || [])[0] || null,
        frames: d.frame_urls || [],
        offences: verdict.categories.map((k) => ({
          key: k, label: CATEGORY_BY_KEY[k].label, severity: CATEGORY_BY_KEY[k].severity,
        })),
        primary: primaryOffence(verdict.categories),
        excerpt: verdict.violationText || verdict.notableText || excerptAround(d.description, q, 200),
      });
      if (sightings.length >= limit) break;
    }

    const legs = [];
    for (let i = 1; i < sightings.length; i++) {
      const from = sightings[i - 1];
      const to = sightings[i];
      if (!from.lat || !to.lat || from.location === to.location) continue;
      const minutes =
        from.timestamp && to.timestamp
          ? Math.round((new Date(to.timestamp) - new Date(from.timestamp)) / 60000)
          : null;
      legs.push({ from: from.location, to: to.location, minutes, at: to.timestamp });
    }

    return res.status(200).json({
      success: true,
      mode: offence ? "offence" : "phrase",
      term: offence ? CATEGORY_BY_KEY[offence]?.label || offence : q,
      sites, unmapped, sightings, legs,
      visited: [...new Set(sightings.map((x) => x.location))],
      truncated: sightings.length === limit,
    });
  } catch (err) {
    console.error("trace failed:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getSummary, getConcordance, getDrill, refineSearch, getTrace, getOffences };
