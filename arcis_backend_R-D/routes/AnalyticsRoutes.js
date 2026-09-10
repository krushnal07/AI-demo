const express = require("express");
const {
  saveAnalyticsImage,getAnalyticsImages,getZoneWiseCounts,getAiDashboard,getLatestAlerts // ✅ Correct import
} = require("../controllers/analyticsimageController"); // ✅ Ensure correct path
// const { getEmailSettings, updateEmailSettings } = require('../controllers/settingsController');
//const { isAuthenticatedUser, authorizeRoles } = require("../middleware/auth");

const router = express.Router();

// ✅ Ensure correct function name
router.route("/analytics").post(saveAnalyticsImage); 
router.route("/getanalyticsimages").get(getAnalyticsImages);
router.route("/getZoneWiseCounts").get(getZoneWiseCounts);
router.route("/ai-dashboard").get(getAiDashboard);
router.route("/latest-alerts").get(getLatestAlerts);
// router.get('/settings', getEmailSettings); // ✅ Correct route
// router.put('/admin/email-settings', updateEmailSettings); // ✅ Correct route
module.exports = router;
