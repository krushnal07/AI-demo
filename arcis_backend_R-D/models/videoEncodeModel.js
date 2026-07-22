const mongoose = require("mongoose");

const videoEncode = mongoose.Schema({
    deviceId: {
        type: String,
        required: [true, "Please Enter Device Id"],
    },
    channel: {
        type: Number, // 101 = main stream, 102 = sub stream
        required: true,
    },
    id: {
        type: Number,
    },
    enabled: {
        type: Boolean,
    },
    videoInputChannelID: {
        type: Number,
    },
    codecType: {
        type: String,
    },
    h264Profile: {
        type: String,
    },
    freeResolution: {
        type: Boolean,
    },
    channelName: {
        type: String,
    },
    bitRateControlType: {
        type: String,
    },
    resolution: {
        type: String,
    },
    constantBitRate: {
        type: Number,
    },
    frameRate: {
        type: Number,
    },
    keyFrameInterval: {
        type: Number,
    },
    ImageTransmissionModel: {
        type: Number,
    },
    gop: {
        type: Number,
    },
    expandChannelNameOverlay: {
        type: Array,
    },
}, { collection: 'videoEncodeSettings', timestamps: true });

videoEncode.index({ deviceId: 1, channel: 1 }, { unique: true });

module.exports = mongoose.model("videoEncode", videoEncode);
