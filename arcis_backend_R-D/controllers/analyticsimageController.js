const mongoose = require("mongoose");
const AnalyticsImage = require("../models/analyticsimage");
const Camera = require("../models/cameraModel");
const District = require("../models/district");
const StreamDetails = require("../models/streamModel");
const { sendMailattachment } = require("../utils/sendEmail");
const semaphore = require("../utils/semaphore");
const User = require("../models/userModel");
// const Settings = require("../models/Settings"); // Assuming Settings model is not used in the provided code
// Roles allowed to receive live AI-event alerts. Mirrors the frontend's
// rolePermissions[role]["AI Events"] table in src/components/Sidebar.js.
const ALERT_ROLES = ["MasterAdmin", "CEO", "DistrictLevel", "AssemblyLevel"];

const messageMapping = {
  1: "Facial recognition",
  2: "Human Detection",
  3: "Fire & Smoke Detection",
  4: "Automatic Number Plate Recognition",
  5: "PPE kit Violation",
  6: "Object Detection",
  7: "Detecting phone usage while driving",
  8: "Monitoring head movements",
  9: "Eyes closing",
  10: "Yawning while driving",
  11: "No Seatbelt usage",
  12: "Identifying conversations with passengers",
  13: "Emotion detection",
  14: "No_Uniform",
  15: "Smoking Detection",
  16: "Unauthorized Entry detection",
  17: "Line Crossing",
  18: "Vactant Parking",
  19: "HeatMap for crowd",
  20: "Head count",
  21: "Person counting and Time analyisis in Tickt Kiosk",
  22: "Crowd Object Detection",
  23: "UnAuthorized Parking",
  24: "Human Activity detection",
  25: "Person counting and Time analysis in Ticket scanning area",
  // 26:"line crossing",
  27:"entry/exit",
  28:"Pre-stamped",
  29:"Medical PPE kit violation",
  30:"Gender Detection",
  31: "Object detection (Pen,Watch,Mobile)",
  32:"Fall Detection",
  33:"Sack Loading",
  34:"Sack Unloading",
  35:"Tampering Detection",
  36: "Handwash Violation",
  38: "Gloves Violation",
  39:"Mobile Detection",
  40: "Max Person",
  41: "Box Detection",
  42:"Idle WorkStation",
  104:"vacant booth",
  103:"evm proximity violation",
  101:"crowd detection (outdoor)",
  102:"crowd detection (indoor)",
  201:"Max Person Detected In Question Paper Room",
  202:"Movement at entry / exit Gate",
  203:"Camera Tampering Detected",
  204:"Camera Offline Detected",
  205:"Movement Detected In Classroom Before/After Exam Hours",
  206:"Suspecious Movement",
  207:"Crowd / Unusual Gathering Detected",
  208:"Unauthorized item(s) detected",
  209:"Invigilator Inactivity Detected",
  210:"Loitering At Passage"
};

function renderSendTime(currentsendtime){
    let somevariable = currentsendtime.split("-");
    if(somevariable.length != 7 || somevariable[0].length != 4){
      return new Date("Nothing")
    }
    return new Date(Date.UTC(
      parseInt(somevariable[0]),
      parseInt(somevariable[1]) - 1,
      parseInt(somevariable[2]),
      parseInt(somevariable[3]),
      parseInt(somevariable[4]),
      parseInt(somevariable[5]),
    ));
}

// Time interval for sending emails (15 minutes in milliseconds)
const EMAIL_INTERVAL = 15 * 60 * 1000;
let intervalStartTime = Date.now(); // Initialize interval start time
let lastAnalyticsImage = null; // Variable to hold the last analytics image


// Retry logic for email sending (No changes needed here as per requirement)
async function sendMailWithRetry(analyticsImageToSend, retries = 3, delay = 2000) { // Modified to accept single analytics image
  if (!analyticsImageToSend) {
    console.log("No analytics image to send.");
    return; // Exit if no image to send
  }

  try {
    // const settings = await Settings.findOne(); // Assuming Settings model is not used in the provided code, removed it
    // if (!settings || !settings.emailEnabled) {  // Assuming Settings model is not used in the provided code, removed it
    //     console.log("Email functionality is disabled.");
    //     return; // Do not attempt to send an email
    // }

    if (!process.env.EMAIL_TO) { // Basic check if email is configured, replace with proper settings check if needed
      console.log("Email functionality is disabled or EMAIL_TO not configured.");
      return;
    }


    const streamDetail = await StreamDetails.findOne({ deviceId: analyticsImageToSend.cameradid });

    if (!streamDetail || !streamDetail.email) {
      console.error(`No email found for the camera device: ${analyticsImageToSend.cameradid}`);
      return;
    }


    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`Attempt ${attempt} of ${retries}: Sending email...`);

        // Send the email with attachment (if image URL exists) - Now sending single image
        await sendMailattachment({
          analyticsImage: analyticsImageToSend, // Pass the single analytics image
          recipientEmail: process.env.EMAIL_TO // Recipient email
        });

        console.log("Email sent successfully.");
        return; // Stop retrying if email is sent successfully
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error.message);

        if (attempt === retries) {
          console.error("Max retry attempts reached. Email sending failed.");
          throw error; // Rethrow the error if max retries are reached
        }

        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay)); // Wait before retrying
      }
    }


  } catch (error) {
    // Handle any errors outside the retry loop
    console.error("Error in sendMailWithRetry function:", error.message);
  }
}


const saveAnalyticsImage = async (req, res) => {
  try {
    await semaphore.acquire(); // Ensure only one request processes at a time

    const { cameradid, sendtime, imgurl, vidurl, an_id, ImgCount, numberplateid, person_name, male_count, female_count } = req.body;

    if (!cameradid || !sendtime || !imgurl || !an_id || !ImgCount) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // Optional short clip for the event. Like imgurl we only store the URL --
    // the device hosts the file.
    if (vidurl && !vidurl.startsWith("http://") && !vidurl.startsWith("https://")) {
      return res.status(400).json({
        success: false,
        message: "vidurl must be an http(s) URL",
        recievedVidurl: `${vidurl}`
      });
    }

    let newCorrectTime = renderSendTime(sendtime);

    if (newCorrectTime == 'Invalid Date'){
      return res.status(535).json({ 
        success: false, 
        message: "Server does not read this Date and Time",
        suggestion: `Send the date in format YYYY-mm-DD-HH-MM-SS-000`, 
        recievedTimeString: `${sendtime}` });
    }

    const streamDetail = await StreamDetails.findOne({ deviceId: cameradid });

    if (!streamDetail) {
      return res.status(404).json({ success: false, message: "Camera ID not found in streamdetails table" });
    }

    const analyticsImage = new AnalyticsImage({
      cameradid,
      sendtime: newCorrectTime,
      msg: messageMapping[an_id] || "No Event Occurred",
      imgurl,
      vidurl,
      an_id,
      ImgCount,
      numberplateid: numberplateid,
      person_name: person_name,
      male_count: male_count,
      female_count: female_count
    });

    await analyticsImage.save();

    lastAnalyticsImage = analyticsImage; // Store the latest image, overwriting the previous one

    const currentTime = Date.now();
    const intervalEndTime = intervalStartTime + EMAIL_INTERVAL;


    if (currentTime >= intervalEndTime) {
      // Send only the last image if available
      if (lastAnalyticsImage) {
        sendMailWithRetry(lastAnalyticsImage).catch(err => { // Send the last image
          console.error("Failed to send batched email:", err);
        });
        lastAnalyticsImage = null; // Clear the last image after sending
      }

      intervalStartTime = intervalEndTime; // Update interval start time for the next interval

    }


    res.status(201).json({ success: true, message: "Data saved successfully, email sending in background if interval reached", data: analyticsImage });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  } finally {
    semaphore.release();
  }
};
const getAnalyticsImages = async (req, res) => {
  try {
    // Step 1: Get email and date from query parameters
    const { email, date } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    // Validate the date format (dd/mm/yyyy)
    const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ message: "Invalid date format. Use dd/mm/yyyy." });
    }

    // --- Start of Corrected Logic ---

    // Step 2: Find the user to get their accessible regions
    const user = await User.findOne({ email }, { UserAccessibleRegions: 1 }).lean();

    if (!user || !user.UserAccessibleRegions?.length) {
      // User is valid but has no permissions, return empty array
      return res.status(200).json({ message: "User has no accessible regions.", data: [] });
    }

    const regionCodes = user.UserAccessibleRegions;

    // Step 3: Get the full camera documents the user has access to.
    // We need their details (like CameraName) to return to the frontend.
    const accessibleCameras = await Camera.find(
        { districtAssemblyCode: { $in: regionCodes } },
        { deviceId: 1, CameraName: 1, email: 1, _id: 0 ,locations:1 } // Add any other fields the frontend needs
    ).lean();
    
    if (!accessibleCameras.length) {
        return res.status(200).json({ message: "No cameras found in user's accessible regions.", data: [] });
    }
    
    // Create a list of device IDs from the cameras found
    const accessibleDeviceIds = accessibleCameras.map(cam => cam.deviceId);
    
    // Create a Map for fast lookups to add camera details later
    const cameraDetailsMap = new Map(accessibleCameras.map(cam => [cam.deviceId, cam]));

    // Step 4: Fetch the analytics images based on camera IDs and date
    const [day, month, year] = date.split("/");
    const startDate = new Date(`${year}-${month}-${day}T00:00:00.000Z`); // UTC start of day
    const endDate = new Date(`${year}-${month}-${day}T23:59:59.999Z`);   // UTC end of day

    const analyticsImages = await AnalyticsImage.find({
        cameradid: { $in: accessibleDeviceIds }, // Filter by user's cameras
        sendtime: {                              // Filter by selected date
            $gte: startDate,
            $lte: endDate,
        },
    })
    .sort({ sendtime: -1 })
    .lean(); // Use .lean() for better performance

    // Step 5: Manually attach the camera details to each analytics image
    // This replicates what the $lookup was supposed to do.
    const responseData = analyticsImages.map(image => {
        return {
            ...image,
            cameraDetails: cameraDetailsMap.get(image.cameradid) || null // Get details from map
        };
    });

    // --- End of Corrected Logic ---

    return res
      .status(200)
      .json({ message: "Records fetched successfully", data: responseData });

  } catch (error) {
    console.error("Error fetching analytics images:", error);
    return res
      .status(500)
      .json({ message: "Error fetching data", error: error.message });
  }
};

const getZoneWiseCounts = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const zoneMappings = {
      'Parking': [3, 4, 5, 15, 18, 22, 23],
      'Entry & Ticket area': [3, 5, 15, 19, 20, 21, 22, 24, 25],
      'Passage Area': [3, 5, 15, 19, 20, 22, 24],
      'Staff Operations': [1, 5, 15, 16],
      'Platform': [3, 5, 15, 17, 19, 20, 21, 22, 24],
      'Tunnel': [3, 5, 22]
    };

    // Optimized MongoDB query with indexing
    const cameras = await AnalyticsImage.aggregate([
      {
        $match: { cameradid: { $exists: true } } // Filter early
      },
      {
        $lookup: {
          from: "cameradetails",
          localField: "cameradid",
          foreignField: "deviceId",
          as: "cameraDetails"
        }
      },
      {
        $match: { "cameraDetails.email": email } // Filter after lookup
      },
      {
        $group: { _id: "$an_id", count: { $sum: 1 } } // Aggregate counts
      }
    ]);

    // Convert to map for quick lookup
    const anIdCounts = Object.fromEntries(cameras.map(({ _id, count }) => [_id, count]));

    // Calculate zone-wise counts efficiently
    const zoneCounts = Object.entries(zoneMappings).map(([zone, ids]) => ({
      zone,
      totalCameras: ids.reduce((sum, id) => sum + (anIdCounts[id] || 0), 0)
    }));

    res.status(200).json({ success: true, zoneCounts });
  } catch (error) {
    console.error('Error fetching zone counts:', error);
    res.status(500).json({ message: "Error fetching zone counts", error: error.message });
  }
};

// ---------------------------------------------------------------------------
// AI Dashboard — single aggregated payload for the command-center page.
// GET /api/Analytics/ai-dashboard?email=<email>&date=dd/mm/yyyy
// Joins alerts (AnalyticsImage) -> Camera -> District to produce every card,
// chart, table and the live feed in one call.
// ---------------------------------------------------------------------------
const getAiDashboard = async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    // Date: accept dd/mm/yyyy, default to today (UTC)
    let date = req.query.date;
    if (!date || !/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
      const now = new Date();
      const p = (n) => String(n).padStart(2, "0");
      date = `${p(now.getUTCDate())}/${p(now.getUTCMonth() + 1)}/${now.getUTCFullYear()}`;
    }

    const emptyPayload = {
      success: true,
      date,
      totals: { totalAlerts: 0, uniqueCameras: 0, analyticsTypes: 0, districts: 0 },
      byDistrict: [],
      byAnalytics: [],
      analyticsLabels: [],
      timeline: [],
      topCameras: [],
      topLocations: [],
      matrix: [],
      liveFeed: [],
      insights: [],
    };

    const user = await User.findOne({ email }, { UserAccessibleRegions: 1 }).lean();
    if (!user || !user.UserAccessibleRegions?.length) {
      return res.status(200).json(emptyPayload);
    }
    const regionCodes = user.UserAccessibleRegions;

    // Cameras (for device list + location) and Districts (for names)
    const [cameras, districts] = await Promise.all([
      Camera.find(
        { districtAssemblyCode: { $in: regionCodes } },
        { deviceId: 1, districtAssemblyCode: 1, locations: 1, name: 1, _id: 0 }
      ).lean(),
      District.find(
        { districtAssemblyCode: { $in: regionCodes } },
        { districtAssemblyCode: 1, dist_name: 1, _id: 0 }
      ).lean(),
    ]);

    if (!cameras.length) return res.status(200).json(emptyPayload);

    const distByCode = new Map(districts.map((d) => [d.districtAssemblyCode, d.dist_name]));
    const camMap = new Map(
      cameras.map((c) => {
        const loc = c.locations?.[0];
        return [
          c.deviceId,
          {
            district: distByCode.get(c.districtAssemblyCode) || "Unknown",
            location: (typeof loc === "string" ? loc : loc?.loc_name) || c.name || c.deviceId,
          },
        ];
      })
    );
    const deviceIds = cameras.map((c) => c.deviceId);

    // Alerts for the day
    const [day, month, year] = date.split("/");
    const startDate = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    const endDate = new Date(`${year}-${month}-${day}T23:59:59.999Z`);

    const alerts = await AnalyticsImage.find(
      { cameradid: { $in: deviceIds }, sendtime: { $gte: startDate, $lte: endDate } },
      { cameradid: 1, an_id: 1, sendtime: 1, msg: 1, _id: 0 }
    ).lean();

    // Resolve a human-readable event name: prefer the stored msg, then the
    // an_id mapping, and only fall back to the id if nothing else is available.
    const labelFor = (a) => {
      if (a.msg && a.msg !== "No Event Occurred") return a.msg;
      return messageMapping[a.an_id] || `Event ${a.an_id}`;
    };

    // Aggregate in memory
    const IST = 5.5 * 3600 * 1000;
    const byDistrict = {};
    const byAnalytics = {};
    const matrix = {};
    const camAgg = {};
    const locAgg = {};
    const timelineMap = {};
    const uniqueCams = new Set();

    for (const a of alerts) {
      const cam = camMap.get(a.cameradid) || { district: "Unknown", location: a.cameradid };
      const label = labelFor(a);
      uniqueCams.add(a.cameradid);

      byDistrict[cam.district] = (byDistrict[cam.district] || 0) + 1;
      byAnalytics[label] = (byAnalytics[label] || 0) + 1;

      (matrix[cam.district] = matrix[cam.district] || {})[label] =
        (matrix[cam.district]?.[label] || 0) + 1;

      const c = (camAgg[a.cameradid] = camAgg[a.cameradid] || {
        deviceId: a.cameradid,
        district: cam.district,
        location: cam.location,
        total: 0,
        byAnalytics: {},
      });
      c.total++;
      c.byAnalytics[label] = (c.byAnalytics[label] || 0) + 1;

      // The same location name can exist in more than one district, so key on both.
      const locKey = `${cam.district}||${cam.location}`;
      const l = (locAgg[locKey] = locAgg[locKey] || {
        location: cam.location,
        district: cam.district,
        cameras: new Set(),
        total: 0,
        byAnalytics: {},
      });
      l.cameras.add(a.cameradid);
      l.total++;
      l.byAnalytics[label] = (l.byAnalytics[label] || 0) + 1;

      const istHour = new Date(new Date(a.sendtime).getTime() + IST).getUTCHours();
      const slot = (timelineMap[istHour] = timelineMap[istHour] || { count: 0, byAnalytics: {} });
      slot.count++;
      slot.byAnalytics[label] = (slot.byAnalytics[label] || 0) + 1;
    }

    const total = alerts.length;
    const analyticsLabels = Object.keys(byAnalytics).sort((a, b) => byAnalytics[b] - byAnalytics[a]);

    const byDistrictArr = Object.entries(byDistrict)
      .map(([district, count]) => ({ district, count, pct: total ? +((count / total) * 100).toFixed(1) : 0 }))
      .sort((a, b) => b.count - a.count);

    const byAnalyticsArr = analyticsLabels.map((label) => ({ label, count: byAnalytics[label] }));

    const topCameras = Object.values(camAgg).sort((a, b) => b.total - a.total).slice(0, 10);

    const topLocations = Object.values(locAgg)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
      .map((l) => ({ ...l, cameras: l.cameras.size }));

    const timeline = [];
    for (let h = 0; h < 24; h++) {
      const slot = timelineMap[h] || { count: 0, byAnalytics: {} };
      const byAnalyticsHour = {};
      analyticsLabels.forEach((l) => (byAnalyticsHour[l] = slot.byAnalytics[l] || 0));
      timeline.push({
        hour: h,
        label: `${String(h).padStart(2, "0")}:00`,
        count: slot.count,
        byAnalytics: byAnalyticsHour,
      });
    }

    const matrixRows = Object.keys(matrix)
      .map((district) => {
        const row = { district, total: 0, byAnalytics: {} };
        analyticsLabels.forEach((l) => {
          const v = matrix[district][l] || 0;
          row.byAnalytics[l] = v;
          row.total += v;
        });
        return row;
      })
      .sort((a, b) => b.total - a.total);

    const liveFeed = [...alerts]
      .sort((a, b) => new Date(b.sendtime) - new Date(a.sendtime))
      .slice(0, 30)
      .map((a) => {
        const cam = camMap.get(a.cameradid) || { district: "Unknown" };
        return {
          label: labelFor(a),
          deviceId: a.cameradid,
          district: cam.district,
          time: new Date(new Date(a.sendtime).getTime() + IST).toISOString().substring(11, 19),
        };
      });

    // Insights
    const peak = timeline.reduce((m, t) => (t.count > m.count ? t : m), { count: -1, label: "" });
    const insights = [];
    if (byDistrictArr[0])
      insights.push(`${byDistrictArr[0].district} leads all districts with ${byDistrictArr[0].count.toLocaleString()} alerts — ${byDistrictArr[0].pct}% of total traffic.`);
    if (peak.count > 0)
      insights.push(`Peak activity at ${peak.label} hrs IST with ${peak.count.toLocaleString()} alerts — align control-room staffing to this window.`);
    if (topLocations[0])
      insights.push(`${topLocations[0].location} (${topLocations[0].district}) is the single busiest location: ${topLocations[0].total.toLocaleString()} alerts across ${topLocations[0].cameras} camera(s).`);
    if (byAnalyticsArr[0] && total)
      insights.push(`"${byAnalyticsArr[0].label}" dominates the AI analytics mix with ${byAnalyticsArr[0].count.toLocaleString()} detections (${((byAnalyticsArr[0].count / total) * 100).toFixed(1)}%).`);
    if (uniqueCams.size)
      insights.push(`Average load is ${(total / uniqueCams.size).toFixed(1)} alerts per active camera in this window.`);
    if (byDistrictArr.length > 1) {
      const q = byDistrictArr[byDistrictArr.length - 1];
      insights.push(`${q.district} is the quietest district (${q.count.toLocaleString()} alerts).`);
    }

    return res.status(200).json({
      success: true,
      date,
      totals: {
        totalAlerts: total,
        uniqueCameras: uniqueCams.size,
        analyticsTypes: analyticsLabels.length,
        districts: byDistrictArr.length,
      },
      byDistrict: byDistrictArr,
      byAnalytics: byAnalyticsArr,
      analyticsLabels,
      timeline,
      topCameras,
      topLocations,
      matrix: matrixRows,
      liveFeed,
      insights,
    });
  } catch (error) {
    console.error("AI Dashboard error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------------------------------------------------------------------------
// Polling endpoint for live alert notifications.
// GET /api/Analytics/latest-alerts?email=<email>&afterId=<mongo ObjectId>
// First call (no afterId) only hands back a cursor, so the caller doesn't get
// the whole history dumped as "new". Every call after that returns whatever
// landed in the DB since that cursor, oldest first, plus the next cursor.
// ---------------------------------------------------------------------------
const getLatestAlerts = async (req, res) => {
  try {
    const { email, afterId } = req.query;
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const user = await User.findOne({ email }, { UserAccessibleRegions: 1, role: 1 }).lean();
    if (!user) {
      return res.status(200).json({ success: true, data: [], cursor: afterId || null });
    }

    // role is stored as an array on the user document
    const roles = Array.isArray(user.role) ? user.role : [user.role];
    if (!roles.some((r) => ALERT_ROLES.includes(r))) {
      return res.status(403).json({ success: false, message: "Not permitted to receive AI event alerts" });
    }

    // Every role, MasterAdmin included, only sees its accessible regions.
    if (!user.UserAccessibleRegions?.length) {
      return res.status(200).json({ success: true, data: [], cursor: afterId || null });
    }

    const cameras = await Camera.find(
      { districtAssemblyCode: { $in: user.UserAccessibleRegions } },
      { deviceId: 1, name: 1, locations: 1, _id: 0 }
    ).lean();
    if (!cameras.length) return res.status(200).json({ success: true, data: [], cursor: afterId || null });

    const deviceIds = cameras.map((c) => c.deviceId);
    const camMap = new Map(
      cameras.map((c) => {
        const loc = c.locations?.[0];
        return [c.deviceId, (typeof loc === "string" ? loc : loc?.loc_name) || c.name || c.deviceId];
      })
    );

    // Establish a baseline cursor only — nothing here is "new" yet.
    if (!afterId || !mongoose.Types.ObjectId.isValid(afterId)) {
      const latest = await AnalyticsImage.findOne({ cameradid: { $in: deviceIds } })
        .sort({ _id: -1 })
        .select("_id")
        .lean();
      return res.status(200).json({ success: true, data: [], cursor: latest?._id || null });
    }

    const alerts = await AnalyticsImage.find({
      cameradid: { $in: deviceIds },
      _id: { $gt: new mongoose.Types.ObjectId(afterId) },
    })
      .sort({ _id: 1 })
      .limit(50)
      .lean();

    const data = alerts.map((a) => ({
      id: a._id,
      cameradid: a.cameradid,
      location: camMap.get(a.cameradid) || a.cameradid,
      eventType: messageMapping[a.an_id] || a.msg || "No Event Occurred",
      sendtime: a.sendtime,
      imgurl: a.imgurl,
      vidurl: a.vidurl,
    }));

    const cursor = alerts.length ? alerts[alerts.length - 1]._id : afterId;

    return res.status(200).json({ success: true, data, cursor });
  } catch (error) {
    console.error("Error fetching latest alerts:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
module.exports = { saveAnalyticsImage, getAnalyticsImages, getZoneWiseCounts, getAiDashboard, getLatestAlerts };
