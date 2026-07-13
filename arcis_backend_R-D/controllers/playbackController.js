const { BlobServiceClient, BlobSASPermissions } = require("@azure/storage-blob");

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_CONTAINER_NAME;

// Lazily-created singletons (one client per process)
let _containerClient = null;
const getContainerClient = () => {
    if (!_containerClient) {
        if (!CONNECTION_STRING || !CONTAINER_NAME) {
            throw new Error(
                "Azure storage is not configured (AZURE_STORAGE_CONNECTION_STRING / AZURE_CONTAINER_NAME)"
            );
        }
        const service = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
        _containerClient = service.getContainerClient(CONTAINER_NAME);
    }
    return _containerClient;
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
 *   prefix      (optional)  override blob prefix (default: DVR/<camera_id>/)
 *   expiry      (optional)  SAS validity in minutes (default 120)
 *
 * Returns a JSON playlist of { name, url, startTime, endTime, sizeBytes }.
 * The actual video bytes stream straight from Azure to the browser via SAS.
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

        const container = getContainerClient();

        // Step 3 + 4: list blobs under the camera's folder and keep those in-window
        const segments = [];
        for await (const blob of container.listBlobsFlat({ prefix })) {
            const startTime = parseTimestampFromName(blob.name);
            if (!startTime) continue;
            if (startTime < fromDate || startTime > toDate) continue;
            segments.push({ name: blob.name, startTime, sizeBytes: blob.properties?.contentLength || 0 });
        }

        // Oldest -> newest for sequential playback
        segments.sort((a, b) => a.startTime - b.startTime);

        // Step 5 + 6: sign a time-limited read-only SAS URL for each segment
        const expiresOn = new Date(Date.now() + expiryMinutes * 60 * 1000);
        const startsOn = new Date(Date.now() - 5 * 60 * 1000); // clock-skew guard

        const playlist = await Promise.all(
            segments.map(async (seg, i) => {
                const blobClient = container.getBlobClient(seg.name);
                const url = await blobClient.generateSasUrl({
                    permissions: BlobSASPermissions.parse("r"),
                    startsOn,
                    expiresOn,
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
