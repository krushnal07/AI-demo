const express = require("express");
const { getPlayback } = require("../controllers/playbackController");

const router = express.Router();

// Returns a JSON playlist of Azure SAS video URLs for a camera + time window
router.get("/", getPlayback);

module.exports = router;
