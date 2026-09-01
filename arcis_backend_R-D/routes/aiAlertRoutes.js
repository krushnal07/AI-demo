const express = require("express");
const { getAiAlerts, getAiAlertFilters } = require("../controllers/aiAlertController");
const { getSummary, getConcordance, getDrill, refineSearch, getTrace } = require("../controllers/crimeIntelController");

const router = express.Router();

// keep /filters above the list route so it is never read as a query case
router.route("/filters").get(getAiAlertFilters);
// intelligence rollups over the same collection, same API surface
router.route("/intel/summary").get(getSummary);
router.route("/intel/concordance").get(getConcordance);
router.route("/intel/drill").get(getDrill);
router.route("/intel/refine").get(refineSearch);
router.route("/intel/trace").get(getTrace);
router.route("/").get(getAiAlerts);

module.exports = router;
