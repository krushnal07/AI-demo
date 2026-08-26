const express = require("express");
const { getAiAlerts, getAiAlertFilters } = require("../controllers/aiAlertController");

const router = express.Router();

// keep /filters above the list route so it is never read as a query case
router.route("/filters").get(getAiAlertFilters);
router.route("/").get(getAiAlerts);

module.exports = router;
