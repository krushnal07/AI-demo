const { Storage } = require("@google-cloud/storage");

const KEY_FILE = process.env.GCS_KEY_FILE;
const BUCKET_NAME = process.env.GCS_BUCKET_NAME;

// Lazily-created singletons (one client per process)
let _bucket = null;
const getBucket = () => {
    if (!_bucket) {
        if (!KEY_FILE || !BUCKET_NAME) {
            throw new Error(
                "GCS storage is not configured (GCS_KEY_FILE / GCS_BUCKET_NAME)"
            );
        }
        const storage = new Storage({ keyFilename: KEY_FILE });
        _bucket = storage.bucket(BUCKET_NAME);
    }
    return _bucket;
};

// Parse the recording start time out of a filename like:
//   VSPL-149178-ARCIS_2026-07-01-17-41-10.mp4
// Returns a Date (treated as UTC wall-clock) or null if it doesn't match.
const parseTimestampFromName = (name) => {
    const m = name.match(/_(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.mp4$/i);
    if (!m) return null;
    const [, y, mo, d, h, mi, s] = m.map(Number);
    return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
};

/**
 * GET /api/playback
 * Query params:
 *   camera_id   (required)  e.g. VSPL-149178-ARCIS
 *   minutes     (optional)  last N minutes (default 60) — used when from/to absent
 *   from, to    (optional)  ISO strings or epoch ms; overrides `minutes`
 *   prefix      (optional)  override object prefix (default: DVR/<camera_id>/)
 *   expiry      (optional)  signed URL validity in minutes (default 120)
 *
 * Returns a JSON playlist of { name, url, startTime, endTime, sizeBytes }.
 * The actual video bytes stream straight from GCS to the browser via the signed URL.
 */
exports.getPlayback = async (req, res) => {
    try {
        const cameraId = req.query.camera_id || req.query.deviceId;
        if (!cameraId) {
            return res.status(400).json({ success: false, message: "camera_id is required" });
        }

        // Time window
        const toDate = req.query.to ? new Date(isNaN(req.query.to) ? req.query.to : Number(req.query.to)) : new Date();
        let fromDate;
        if (req.query.from) {
            fromDate = new Date(isNaN(req.query.from) ? req.query.from : Number(req.query.from));
        } else {
            const minutes = Math.max(1, parseInt(req.query.minutes) || 60);
            fromDate = new Date(toDate.getTime() - minutes * 60 * 1000);
        }

        const expiryMinutes = Math.max(1, parseInt(req.query.expiry) || 120);
        const prefix = req.query.prefix || `DVR/${cameraId}/`;

        const bucket = getBucket();

        // Step 3 + 4: list objects under the camera's folder and keep those in-window
        const [files] = await bucket.getFiles({ prefix });
        const segments = [];
        for (const file of files) {
            const startTime = parseTimestampFromName(file.name);
            if (!startTime) continue;
            if (startTime < fromDate || startTime > toDate) continue;
            segments.push({ name: file.name, startTime, sizeBytes: Number(file.metadata?.size) || 0, file });
        }

        // Oldest -> newest for sequential playback
        segments.sort((a, b) => a.startTime - b.startTime);

        // Step 5 + 6: sign a time-limited read-only URL for each segment
        const expires = Date.now() + expiryMinutes * 60 * 1000;

        const playlist = await Promise.all(
            segments.map(async (seg, i) => {
                const [url] = await seg.file.getSignedUrl({
                    version: "v4",
                    action: "read",
                    expires,
                });
                // Estimate end time from the next segment's start (fallback 5 min)
                const next = segments[i + 1];
                const endTime = next ? next.startTime : new Date(seg.startTime.getTime() + 5 * 60 * 1000);
                return {
                    name: seg.name.split("/").pop(),
                    url,
                    startTime: seg.startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    durationSec: Math.round((endTime - seg.startTime) / 1000),
                    sizeBytes: seg.sizeBytes,
                };
            })
        );

        return res.json({
            success: true,
            cameraId,
            from: fromDate.toISOString(),
            to: toDate.toISOString(),
            count: playlist.length,
            segments: playlist,
        });
    } catch (error) {
        console.error("Playback API Error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
