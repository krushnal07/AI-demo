const AiAlert = require("../models/aiAlert");

// The documents carry a 768-float `embedding`. It is not in the schema, but be
// explicit here too so a schema change can never leak it into a list response.
const LIST_PROJECTION = "-embedding";

// Whitelisted so a caller cannot sort by an arbitrary (unindexed) field.
const SORTABLE = [
  "timestamp",
  "camera_id",
  "location",
  "segment_id",
  "motion_score",
  "anchor_confidence",
  "video_offset_seconds",
];

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 24;

// user input goes into a $regex, so neutralise the pattern metacharacters
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// `timestamp` is a real Date whose UTC value matches the naive `start_time`
// string, so a plain UTC day window lines up with the recorded day.
const dayWindow = (date) => {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);
  if (isNaN(start.getTime())) return null;
  return { $gte: start, $lte: end };
};

const buildFilter = ({ date, camera_id, q, confidence, gated }) => {
  const filter = {};

  if (camera_id && camera_id !== "all") filter.camera_id = camera_id;
  if (confidence && confidence !== "all") filter.anchor_confidence = confidence;
  if (gated === "true") filter.motion_gated = true;
  else if (gated === "false") filter.motion_gated = false;

  if (date) {
    const window = dayWindow(date);
    if (!window) return { error: "Invalid date. Use YYYY-MM-DD." };
    filter.timestamp = window;
  }

  if (q && q.trim()) {
    const rx = { $regex: escapeRegex(q.trim()), $options: "i" };
    // ocr_raw/plate_number included so a plate can actually be searched for
    filter.$or = [
      { description: rx },
      { location: rx },
      { camera_id: rx },
      { ocr_raw: rx },
      { plate_number: rx },
    ];
  }

  return { filter };
};

/**
 * GET /api/ai-alerts
 * Query: date=YYYY-MM-DD, camera_id, q, confidence, gated, sort, order, page, limit
 * Omitting `date` gives the newest alerts across every day (the "Live" view).
 */
const getAiAlerts = async (req, res) => {
  try {
    const { filter, error } = buildFilter(req.query);
    if (error) return res.status(400).json({ success: false, message: error });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));

    const sortField = SORTABLE.includes(req.query.sort) ? req.query.sort : "timestamp";
    const sortOrder = req.query.order === "asc" ? 1 : -1;
    // _id breaks ties so paging stays stable on non-unique sort keys
    const sort = { [sortField]: sortOrder, _id: sortOrder };

    const [data, total] = await Promise.all([
      AiAlert.find(filter)
        .select(LIST_PROJECTION)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AiAlert.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      data,
    });
  } catch (err) {
    console.error("Error fetching AI alerts:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/ai-alerts/filters
 * Cameras and the days that actually hold data, for the browser panel.
 */
const getAiAlertFilters = async (req, res) => {
  try {
    const [cameras, confidences, dates] = await Promise.all([
      AiAlert.distinct("camera_id"),
      AiAlert.distinct("anchor_confidence"),
      AiAlert.aggregate([
        { $match: { timestamp: { $ne: null } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: -1 } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      cameras: cameras.filter(Boolean).sort(),
      confidences: confidences.filter(Boolean).sort(),
      dates: dates.map((d) => ({ date: d._id, count: d.count })),
    });
  } catch (err) {
    console.error("Error fetching AI alert filters:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAiAlerts, getAiAlertFilters };
