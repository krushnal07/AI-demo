const mongoose = require("mongoose");

const imageSettings = mongoose.Schema({
    deviceId: {
        type: String,
        required: [true, "Please Enter Device Id"],
    },
    irCutFilter: {
        type: Object,
    },
    imageStyle: {
        type: Number,
    },
    lowlightMode: {
        type: String,
    },
    sceneMode: {
        type: String,
    },
    manualSharpness: {
        type: Object,
    },
    denoise3d: {
        type: Object,
    },
    WDR: {
        type: Object,
    },
    exposureMode: {
        type: String,
    },
    awbMode: {
        type: String,
    },
    BLcompensationMode: {
        type: String,
    },
    videoMode: {
        type: Object,
    },
}, { collection: 'imageSettings', timestamps: true });

imageSettings.index({ deviceId: 1 }, { unique: true });

module.exports = mongoose.model("imageSettings", imageSettings);
