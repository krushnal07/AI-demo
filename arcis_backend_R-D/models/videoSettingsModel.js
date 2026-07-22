const mongoose = require("mongoose");

const videoSettings = mongoose.Schema({
    deviceId: {
        type: String,
        required: [true, "Please Enter Device Id"],
    },
    id: {
        type: Number,
    },
    enabled: {
        type: Boolean,
    },
    powerLineFrequencyMode: {
        type: Number,
    },
    brightnessLevel: {
        type: Number,
    },
    contrastLevel: {
        type: Number,
    },
    sharpnessLevel: {
        type: Number,
    },
    saturationLevel: {
        type: Number,
    },
    hueLevel: {
        type: Number,
    },
    flipEnabled: {
        type: Boolean,
    },
    mirrorEnabled: {
        type: Boolean,
    },
    privacyMask: {
        type: Array,
    },
}, { collection: 'videoSettings', timestamps: true });

videoSettings.index({ deviceId: 1 }, { unique: true });

module.exports = mongoose.model("videoSettings", videoSettings);
