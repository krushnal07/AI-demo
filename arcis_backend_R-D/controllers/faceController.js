const { BlobServiceClient } = require("@azure/storage-blob");
const axios = require("axios");
const path = require("path");
const UserAnalytics = require("../models/userAnalyticsModel");

const CONNECTION_STRING = process.env.FACE_AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.FACE_AZURE_CONTAINER_NAME;
const FACE_API_URL = process.env.FACE_API_URL;

// Lazily-created singleton (one client per process) - same pattern as playbackController.js,
// but against the face-registration storage account, not the Monibuca recordings one.
let _containerClient = null;
const getContainerClient = () => {
    if (!_containerClient) {
        if (!CONNECTION_STRING || !CONTAINER_NAME) {
            throw new Error(
                "Face storage is not configured (FACE_AZURE_STORAGE_CONNECTION_STRING / FACE_AZURE_CONTAINER_NAME)"
            );
        }
        const service = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
        _containerClient = service.getContainerClient(CONTAINER_NAME);
    }
    return _containerClient;
};

const slugify = (name) => name.trim().replace(/[^a-zA-Z0-9_-]+/g, "_");

const uploadFaceImage = async (personName, file) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const blobName = `live-record/frimages/${slugify(personName)}_${Date.now()}${ext}`;
    const blockBlobClient = getContainerClient().getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: { blobContentType: file.mimetype },
    });
    // Plain public URL (no SAS suffix) - matches the container's existing anonymous-read setup.
    return `https://sdcarddata.blob.core.windows.net/${CONTAINER_NAME}/${blobName}`;
};

// POST /api/face/register
exports.registerFace = async (req, res) => {
    try {
        const { person_name, roll_no_emp_id } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, message: "Image is required" });
        }
        if (!person_name || !person_name.trim()) {
            return res.status(400).json({ success: false, message: "person_name is required" });
        }

        const image_url = await uploadFaceImage(person_name, req.file);

        let faceApiResponse;
        try {
            const apiRes = await axios.post(
                `${FACE_API_URL}/register_face`,
                { person_name, image_url },
                { timeout: 15000 }
            );
            faceApiResponse = apiRes.data;
        } catch (apiError) {
            const status = apiError.response?.status;
            const message = apiError.response?.data?.message || apiError.message;
            return res.status(status === 400 ? 400 : 502).json({
                success: false,
                message: `Face registration service error: ${message}`,
            });
        }

        if (!faceApiResponse.success) {
            // No face detected - don't persist, let the frontend show a distinct message.
            return res.status(200).json(faceApiResponse);
        }

        const record = await UserAnalytics.findOneAndUpdate(
            { person_name },
            {
                $set: {
                    image_url,
                    roll_no_emp_id: roll_no_emp_id || undefined,
                    faces_detected: faceApiResponse.faces_detected,
                    created_date: new Date().toISOString(),
                },
            },
            { upsert: true, new: true }
        );

        res.status(200).json({ ...faceApiResponse, record });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/face/list
exports.listFaces = async (req, res) => {
    try {
        const records = await UserAnalytics.find().sort({ _id: -1 });
        res.status(200).json({ success: true, records });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /api/face/:person_name
exports.deleteFace = async (req, res) => {
    try {
        const { person_name } = req.params;

        try {
            await axios.delete(`${FACE_API_URL}/faces/${encodeURIComponent(person_name)}`, { timeout: 15000 });
        } catch (apiError) {
            // Tolerate "not found on the face service" - still remove our local record below
            // so the table doesn't get stuck with a row it can no longer act on.
            if (apiError.response?.status !== 404) {
                return res.status(502).json({
                    success: false,
                    message: `Face registration service error: ${apiError.response?.data?.detail || apiError.message}`,
                });
            }
        }

        await UserAnalytics.deleteOne({ person_name });
        res.status(200).json({ success: true, message: `Removed ${person_name}` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
