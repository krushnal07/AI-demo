// services/twoWayTalk.js
// Two-way-talk gateway — same audio pipeline as the existing talkToCamera
// batch-upload path in controllers/settingController.js, but live over a
// WebSocket instead of a single multer file upload:
//
//   Browser mic --(compressed audio, e.g. webm/opus, over WS)--> this gateway
//     -> buffer ALL chunks
//     -> ffmpeg: AAC/ADTS (default) or pcm_alaw, 8kHz, mono, volume=2  (see OUTPUT_CODEC)
//     -> 640-byte packets, paced 15-20ms
//     -> MQTT torque/rx/{deviceId}/56 --> camera case 56 --> speaker
//
// Matches the proven audio-relay path in services/mqttHelper.js's case-56
// handler exactly (same ffmpeg params, same chunking/pacing, same topic) —
// that path never sends anything on topic 57, so this gateway doesn't either.

const { WebSocketServer } = require("ws");
const url = require("url");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const { mqttClient } = require("./mqttClient");
const commonConfig = require("../utils/commonConfig.js");

const topicSend = "torque/rx/"; // backend -> camera (matches settingController.js's appTopicSend)

// --- Tunables --------------------------------------------------------------
// Camera RTSP caps show PCMA + PCMU @ 8kHz -> G.711 is the most likely codec.
const OUTPUT_CODEC = "alaw"; // "alaw" (G.711 PCMA) | "mulaw" (G.711 PCMU) | "aac" (ADTS)
const SAMPLE_RATE = 8000; // G.711 is 8kHz
// 640-byte G.711 packets bursted faster than real-time so the whole clip fills
// the camera's jitter buffer quickly. Smaller packets paced at real-time starve
// that buffer -> garbled audio.
const TALK_FRAME_BYTES = 640;
// ffmpeg "volume" gain. The browser mic is quieter (echo-cancel/noise-suppress/
// AGC + opus->alaw resample) than a raw mobile-recorder capture, so bump it.
// Too high clips.
const VOLUME_GAIN = 2;
const AAC_BITRATE = "64k"; // (AAC path only)
const AAC_FRAME_MS = Math.round((1024 / SAMPLE_RATE) * 1000); // AAC-LC = 1024 samples/frame
const AAC_PACE_MS = Math.max(20, AAC_FRAME_MS - 15);
const SESSION_MAX_MS = 5 * 60 * 1000; // hard cap so a hung mic can't stream forever
// ---------------------------------------------------------------------------

// ffmpeg output args for the selected codec. Input (pipe:0) is whatever the
// browser MediaRecorder produced (webm/opus); ffmpeg auto-detects it.
function ffmpegOutputArgs(codec) {
    if (codec === "aac") {
        return [
            "-acodec", "aac",
            "-ac", "1",
            "-ar", String(SAMPLE_RATE),
            "-b:a", AAC_BITRATE,
            "-af", `volume=${VOLUME_GAIN}`,
            "-f", "adts", // raw AAC stream (self-delimiting frames)
            "pipe:1",
        ];
    }
    if (codec === "mulaw") {
        return [
            "-acodec", "pcm_mulaw", // G.711 PCMU
            "-ac", "1",
            "-ar", String(SAMPLE_RATE),
            "-af", `volume=${VOLUME_GAIN}`,
            "-f", "mulaw",
            "pipe:1",
        ];
    }
    // G.711 A-law / PCMA
    return [
        "-acodec", "pcm_alaw",
        "-ac", "1",
        "-ar", String(SAMPLE_RATE),
        "-af", `volume=${VOLUME_GAIN}`,
        "-f", "alaw",
        "pipe:1",
    ];
}

// Split an ADTS/AAC byte stream into individual frames so each MQTT message
// carries ONE complete AAC frame (the camera's decoder needs whole frames;
// arbitrary byte slicing causes beeping/garble). ADTS frame_length is a
// 13-bit field at bytes 3-5 of each 7-byte header.
function splitAdtsFrames(buf) {
    const frames = [];
    let i = 0;
    while (i + 7 <= buf.length) {
        if (buf[i] !== 0xff || (buf[i + 1] & 0xf0) !== 0xf0) {
            i++; // not a sync word — resync
            continue;
        }
        const frameLen =
            ((buf[i + 3] & 0x03) << 11) | (buf[i + 4] << 3) | ((buf[i + 5] & 0xe0) >> 5);
        if (frameLen < 7 || i + frameLen > buf.length) break; // truncated tail
        frames.push(buf.subarray(i, i + frameLen));
        i += frameLen;
    }
    return frames;
}

// Packetize ffmpeg output for MQTT: per-ADTS-frame for AAC, fixed size for G.711.
function packetize(buf, codec) {
    if (codec === "aac") return splitAdtsFrames(buf);
    const out = [];
    for (let off = 0; off < buf.length; off += TALK_FRAME_BYTES) {
        out.push(buf.subarray(off, off + TALK_FRAME_BYTES));
    }
    return out;
}

/** Authenticate a WS upgrade using the same JWT cookie scheme as authMiddleware. */
async function authenticateUpgrade(req) {
    const cookieHeader = req.headers.cookie || "";
    let token = cookieHeader
        .split(";")
        .map((c) => c.trim())
        .find((c) => c.startsWith("token="))
        ?.slice("token=".length);

    // Fallback to token query parameter
    if (!token) {
        const { query } = url.parse(req.url, true);
        token = query.token;
    }

    if (!token) throw new Error("No auth token found in cookie or query parameter");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) throw new Error("User not found");

    const tokenValid = (user.tokens || []).some((t) => t.token === token);
    if (!tokenValid) throw new Error("Token revoked");

    return user;
}

function initTwoWayTalk(server) {
    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (req, socket, head) => {
        const { pathname, query } = url.parse(req.url, true);
        if (pathname !== "/ws/talk" && pathname !== "/api/ws/talk") return; // let other upgrade handlers (if any) deal with it

        console.log("[talk] Upgrade request received:", req.url);

        authenticateUpgrade(req)
            .then((user) => {
                console.log(`[talk] Upgrade successful for user: ${user.username}`);
                wss.handleUpgrade(req, socket, head, (ws) => {
                    ws.user = user;
                    ws.deviceId = (query.deviceId || "").toString();
                    // Optional per-session codec override (?codec=alaw|mulaw|aac) for A/B testing.
                    const q = (query.codec || "").toString().toLowerCase();
                    ws.codec = ["alaw", "mulaw", "aac"].includes(q) ? q : OUTPUT_CODEC;
                    wss.emit("connection", ws, req);
                });
            })
            .catch((err) => {
                console.error("[talk] Upgrade rejected:", err.message);
                socket.write(
                    "HTTP/1.1 401 Unauthorized\r\n" +
                    "Content-Type: text/plain\r\n" +
                    "Connection: close\r\n\r\n" +
                    `WebSocket Upgrade Rejected: ${err.message}`
                );
                socket.destroy();
            });
    });

    wss.on("connection", (ws) => {
        const deviceId = ws.deviceId;
        if (!deviceId) {
            ws.close(1008, "deviceId required");
            return;
        }

        const audioTopic = `${topicSend}${deviceId}/${commonConfig.MSG_TYPE_AUDIO}`; // .../56
        const codec = ws.codec || OUTPUT_CODEC; // per-session (?codec=) or default

        let closed = false;
        let bursting = false;
        const chunks = []; // raw compressed audio (webm/opus) chunks from the browser

        console.log(`[talk] session start: ${ws.user?.username} -> ${deviceId} (codec=${codec})`);

        // Safety cap.
        const killTimer = setTimeout(() => {
            console.warn(`[talk] session ${deviceId} hit max duration, closing`);
            ws.close(1000, "max duration");
        }, SESSION_MAX_MS);

        // Stream the converted audio out to the camera, ONE codec frame per MQTT
        // message (ADTS frame for AAC, 640B for A-law), then "Streamend".
        const streamToCamera = (audioBuffer) => {
            const queue = packetize(audioBuffer, codec);
            console.log(`[talk] ${deviceId}: converted ${audioBuffer.length} bytes -> ${queue.length} ${codec} frames`);

            const sendNext = () => {
                if (queue.length === 0) {
                    mqttClient.publish(audioTopic, "Streamend", { qos: 0 });
                    console.log(`[talk] session end: ${deviceId} (Streamend sent)`);
                    return;
                }
                mqttClient.publish(audioTopic, Buffer.from(queue.shift()), { qos: 0 });
                // AAC paces by frame; G.711 paced closer to real-time (60/70ms) to prevent buffer overflow.
                const delay = codec === "aac" ? AAC_PACE_MS : (queue.length > 30 ? 60 : 70);
                setTimeout(sendNext, delay);
            };

            sendNext();
        };

        // Buffer all -> ffmpeg pcm_alaw / 8kHz / mono / volume=2 -> 640-byte packets.
        const burstToCamera = () => {
            if (bursting) return;
            bursting = true;
            clearTimeout(killTimer);

            const audioBuffer = Buffer.concat(chunks);
            chunks.length = 0;

            if (audioBuffer.length === 0) {
                console.warn(`[talk] ${deviceId}: no audio captured, skipping`);
                return;
            }

            console.log(`[talk] ${deviceId}: converting ${audioBuffer.length} bytes via ffmpeg`);

            const ffmpeg = spawn(ffmpegPath, [
                "-hide_banner",
                "-loglevel", "error",
                "-i", "pipe:0",
                ...ffmpegOutputArgs(codec),
            ]);

            let outputBuffer = Buffer.alloc(0);
            ffmpeg.stdout.on("data", (d) => { outputBuffer = Buffer.concat([outputBuffer, d]); });
            ffmpeg.stderr.on("data", (d) => console.error(`[talk] ffmpeg(${deviceId}):`, d.toString().trim()));
            ffmpeg.on("error", (err) => console.error(`[talk] ffmpeg spawn error (${deviceId}):`, err.message));
            ffmpeg.on("close", (code) => {
                if (code !== 0) {
                    console.error(`[talk] ${deviceId}: ffmpeg exited ${code}, no audio sent`);
                    return;
                }
                streamToCamera(outputBuffer);
            });

            // Feed the buffered compressed audio to ffmpeg.
            ffmpeg.stdin.write(audioBuffer);
            ffmpeg.stdin.end();
        };

        const endStream = () => {
            if (closed) return;
            closed = true;
            burstToCamera();
        };

        ws.on("message", (data, isBinary) => {
            if (closed) return;
            // Control messages arrive as text.
            if (!isBinary) {
                if (data.toString() === "stop") {
                    endStream();
                    ws.close(1000, "stopped");
                }
                return;
            }
            // Binary = compressed audio chunk (webm/opus) from MediaRecorder. Buffer it.
            chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data));
        });

        ws.on("close", () => endStream());
        ws.on("error", (err) => {
            console.warn(`[talk] ws error (${deviceId}):`, err.message);
            endStream();
        });
    });

    console.log("🎙  Two-way-talk WS gateway ready at /ws/talk");
    return wss;
}

module.exports = { initTwoWayTalk };
