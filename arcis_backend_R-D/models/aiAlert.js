const mongoose = require("mongoose");

// Read-only view over the activities_hackathon collection written by the AI
// pipeline. `embedding` (768 floats per document) is intentionally left out of
// the schema so it can never be selected into an API response by accident.
const aiAlertSchema = new mongoose.Schema(
  {
    camera_id: { type: String },
    segment_id: { type: Number },
    anchor_confidence: { type: String },
    cumulative_minutes: { type: Number },
    description: { type: String },
    // naive ISO strings, e.g. "2026-08-08T14:59:58.800000" (no zone suffix)
    start_time: { type: String },
    end_time: { type: String },
    // always [frame1, frame2, contact sheet]
    frame_urls: { type: [String] },
    location: { type: String },
    motion_gated: { type: Boolean },
    motion_score: { type: Number },
    source_video: { type: String },
    timestamp: { type: Date },
    video_offset_seconds: { type: Number },
  },
  { collection: "activities_hackathon" }
);

aiAlertSchema.index({ timestamp: -1 });
aiAlertSchema.index({ camera_id: 1, timestamp: -1 });

module.exports = mongoose.model("AiAlert", aiAlertSchema);
