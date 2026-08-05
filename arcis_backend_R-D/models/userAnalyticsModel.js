const mongoose = require("mongoose");

const userAnalytics = mongoose.Schema({
    person_name: {
        type: String,
        required: [true, "Please Enter Person Name"],
    },
    image_url: {
        type: String,
        required: [true, "Please Enter Image Url"],
    },
    roll_no_emp_id: {
        type: String,
    },
    faces_detected: {
        type: Number,
    },
    created_date: {
        type: String,
    },
}, { collection: 'useranalytics' });

userAnalytics.index({ person_name: 1 }, { unique: true });

module.exports = mongoose.model("useranalytics", userAnalytics);
