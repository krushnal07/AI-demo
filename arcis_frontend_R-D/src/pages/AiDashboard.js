import React, { useEffect, useMemo, useState, useRef } from "react";
import axios from "axios";
import ReactApexChart from "react-apexcharts";
import {
  Box,
  Flex,
  Text,
  Grid,
  SimpleGrid,
  Spinner,
  Input,
  useColorMode,
  useColorModeValue,
  Icon,
} from "@chakra-ui/react";
import {
  TbBolt,
  TbCamera,
  TbActivity,
  TbMapPin,
  TbPlayerPlay,
  TbCalendar,
} from "react-icons/tb";
import { BsLightningChargeFill } from "react-icons/bs";

const fmt = (n) => (n ?? 0).toLocaleString("en-IN");

const LOCATION_COLORS = [
  "#0EA5E9",
  "#DB7B3A",
  "#10B981",
  "#8B5CF6",
  "#F59E0B",
  "#6366F1",
  "#EC4899",
  "#14B8A6",
];

const ANALYTICS_PALETTE = [
  "#0284C7", // Sky Blue (Intruder)
  "#EC4899", // Pink (Event 49)
  "#F59E0B", // Amber / Golden Yellow (Facial recognition)
  "#10B981", // Emerald Green (Line Crossing)
  "#8B5CF6", // Purple (Heatmap)
  "#DB7B3A", // Warm Orange (Box Detection / Object Detection)
  "#14B8A6", // Teal (Human Detection)
  "#6366F1", // Indigo (ANPR)
  "#06B6D4", // Cyan (Max Person)
  "#EAB308", // Yellow
];

const KNOWN_EVENT_COLORS = {
  intruder: "#0284C7", // Sky Blue
  event49: "#EC4899", // Pink
  facialrecognition: "#F59E0B", // Amber / Yellow
  linecrossing: "#10B981", // Emerald Green
  heatmap: "#8B5CF6", // Purple
  heatmapforcrowd: "#8B5CF6",
  humandetection: "#14B8A6", // Teal
  fireandsmokedetection: "#EF4444", // Red
  firesmokedetection: "#EF4444",
  automaticnumberplaterecognition: "#6366F1", // Indigo
  anpr: "#6366F1",
  boxdetection: "#DB7B3A", // Orange
  cameraofflinedetected: "#64748B", // Slate
  cameratamperingdetected: "#DC2626", // Dark Red
  crowdunusualgatheringdetected: "#D97706", // Amber
  loiteringatpassage: "#A855F7", // Purple
  maxperson: "#06B6D4", // Cyan
  maxpersondetectedinquestionpaperroom: "#06B6D4",
  movementdetectedinclassroombeforeafterexamhours: "#EAB308",
  movementatentryexitgate: "#10B981",
  suspeciousmovement: "#F43F5E",
  suspiciousmovement: "#F43F5E",
  unauthorizeditemsdetected: "#F472B6",
  unauthorizedentrydetection: "#F97316",
  objectdetection: "#DB7B3A",
  noeventoccurred: "#94A3B8",
};

const normalizeEventKey = (s) =>
  s ? s.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, "") : "";

const getEventColor = (eventName, fallbackIdx = 0) => {
  if (!eventName) return "#94A3B8";
  const key = normalizeEventKey(eventName);
  if (KNOWN_EVENT_COLORS[key]) return KNOWN_EVENT_COLORS[key];

  let hash = 0;
  for (let i = 0; i < eventName.length; i++) {
    hash = (hash << 5) - hash + eventName.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % ANALYTICS_PALETTE.length;
  return ANALYTICS_PALETTE[idx] || ANALYTICS_PALETTE[fallbackIdx % ANALYTICS_PALETTE.length];
};

const AiDashboard = () => {
  const email = localStorage.getItem("email") || "";
  const { colorMode } = useColorMode();

  // --- Theme Colors ---
  const cardBg = useColorModeValue("#FFFFFF", "#1C222D");
  const borderColor = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.08)");
  const headingColor = useColorModeValue("#1A2E3D", "#FFFFFF");
  const subtextColor = useColorModeValue("#64748B", "#94A3B8");
  const gridColor = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.06)");
  const chartTheme = useColorModeValue("light", "dark");
  const tickerBg = useColorModeValue("#3F77A5", "#2B5273");
  const dateInputRef = useRef(null);

  const [date, setDate] = useState(() => {
    const dt = new Date();
    const p = (x) => String(x).padStart(2, "0");
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`; // yyyy-mm-dd
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch + poll with dynamic date filter
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    const [y, m, d] = date.split("-");
    const ddmmyyyy = `${d}/${m}/${y}`;

    const load = async () => {
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_URL}/api/Analytics/ai-dashboard`,
          {
            params: { email, date: ddmmyyyy },
          }
        );
        if (!cancelled) {
          setData(res.data || {});
        }
      } catch (e) {
        if (!cancelled) {
          setData({
            success: false,
            totals: { totalAlerts: 0, uniqueCameras: 0, analyticsTypes: 0, districts: 0 },
            byDistrict: [],
            byAnalytics: [],
            analyticsLabels: [],
            timeline: [],
            topCameras: [],
            matrix: [],
            liveFeed: [],
            insights: [],
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setLoading(true);
    load();
    const poll = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [email, date]);

  const dd = data || {};
  const totals = dd.totals || {
    totalAlerts: 0,
    uniqueCameras: 0,
    analyticsTypes: 0,
    districts: 0,
  };
  const byDistrict = dd.byDistrict || [];
  const byAnalytics = dd.byAnalytics || [];
  const analyticsLabels = dd.analyticsLabels || [];
  const timeline = dd.timeline || [];
  const topCameras = dd.topCameras || dd.topLocations || [];
  const topLocations = dd.topLocations || [];
  const matrix = dd.matrix || [];
  const liveFeed = dd.liveFeed || [];
  const insights = dd.insights || [];

  // Formatted date string (e.g., 08/10/2026)
  const displayDate = useMemo(() => {
    if (!date) return "";
    const [y, m, d] = date.split("-");
    return `${d}/${m}/${y}`;
  }, [date]);

  // Chart 1: Alerts by AI Analytics (Vertical Bar Chart)
  const analyticsBar = useMemo(() => {
    const categories = byAnalytics.map((a) => a.label);
    const seriesData = byAnalytics.map((a) => a.count);
    const maxVal = Math.max(...seriesData, 4);
    const count = categories.length || 1;
    const colors = categories.map((cat, idx) => getEventColor(cat, idx));

    return {
      options: {
        chart: {
          type: "bar",
          background: "transparent",
          toolbar: { show: false },
          fontFamily: "'Manrope', sans-serif",
          parentHeightOffset: 0,
        },
        theme: { mode: chartTheme },
        plotOptions: {
          bar: {
            borderRadius: 4,
            borderRadiusApplication: "end",
            columnWidth: count > 5 ? "36%" : count > 3 ? "42%" : "48%",
            distributed: true,
          },
        },
        colors: colors.length ? colors : ANALYTICS_PALETTE,
        dataLabels: { enabled: false },
        xaxis: {
          categories,
          labels: {
            rotate: count > 3 ? -35 : 0,
            rotateAlways: false,
            hideOverlappingLabels: false,
            trim: true,
            maxHeight: 50,
            style: {
              colors: subtextColor,
              fontSize: count > 5 ? "10px" : "11px",
              fontFamily: "'Manrope', sans-serif",
            },
          },
          axisBorder: { show: false },
          axisTicks: { show: false },
        },
        yaxis: {
          min: 0,
          max: maxVal,
          tickAmount: Math.min(Math.max(maxVal, 2), 6),
          forceNiceScale: true,
          decimalsInFloat: 0,
          labels: {
            style: {
              colors: subtextColor,
              fontSize: "11px",
              fontFamily: "'Manrope', sans-serif",
            },
            formatter: (v) => {
              const n = typeof v === "number" ? v : parseFloat(v);
              return !isNaN(n) && Number.isInteger(n) ? n.toString() : "";
            },
          },
        },
        grid: {
          borderColor: gridColor,
          strokeDashArray: 3,
          yaxis: { lines: { show: true } },
          xaxis: { lines: { show: false } },
        },
        legend: { show: false },
        tooltip: {
          theme: chartTheme,
          y: { formatter: (v) => fmt(v) },
        },
      },
      series: [{ name: "Alerts", data: seriesData }],
    };
  }, [byAnalytics, chartTheme, gridColor, subtextColor]);

  // Chart 2: Alerts by Locations (Circular Pie / Donut Chart)
  const districtPie = useMemo(() => {
    const labels = byDistrict.map((x) => x.district);
    const series = byDistrict.map((x) => x.count);
    const totalCount = series.reduce((a, b) => a + b, 0) || totals.totalAlerts || 0;

    return {
      options: {
        chart: {
          type: "donut",
          background: "transparent",
          fontFamily: "'Manrope', sans-serif",
        },
        theme: { mode: chartTheme },
        labels,
        colors: LOCATION_COLORS,
        stroke: { width: 0 },
        legend: { show: false },
        dataLabels: { enabled: false },
        plotOptions: {
          pie: {
            donut: {
              size: "75%",
              labels: {
                show: true,
                total: {
                  show: true,
                  label: "Total",
                  color: subtextColor,
                  fontSize: "12px",
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 500,
                  formatter: () => fmt(totalCount),
                },
                value: {
                  show: true,
                  fontSize: "28px",
                  fontFamily: "'Manrope', sans-serif",
                  fontWeight: 800,
                  color: headingColor,
                  offsetY: 2,
                  formatter: () => fmt(totalCount),
                },
              },
            },
          },
        },
        tooltip: {
          theme: chartTheme,
          y: { formatter: (v) => fmt(v) },
        },
      },
      series: series.length > 0 ? series : [0],
    };
  }, [byDistrict, totals.totalAlerts, chartTheme, headingColor, subtextColor]);

  // Chart 3: Alert Timeline 24H (Area Chart)
  const TIMELINE_HOUR_OFFSET = 6;
  const correctedTimelineCounts = useMemo(() => {
    const counts = timeline.map((t) => t.count || 0);
    if (!counts.length) return [];
    return Array.from(
      { length: counts.length },
      (_, h) => counts[(h + TIMELINE_HOUR_OFFSET) % counts.length]
    );
  }, [timeline]);

  const timelineArea = useMemo(() => {
    const maxVal = Math.max(...correctedTimelineCounts, 4);

    return {
      options: {
        chart: {
          type: "area",
          background: "transparent",
          toolbar: { show: false },
          fontFamily: "'Manrope', sans-serif",
          parentHeightOffset: 0,
        },
        theme: { mode: chartTheme },
        colors: ["#10B981"],
        stroke: { curve: "smooth", width: 2.5 },
        fill: {
          type: "gradient",
          gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.35,
            opacityTo: 0.02,
          },
        },
        dataLabels: { enabled: false },
        xaxis: {
          categories: timeline.map((t) => t.label),
          labels: {
            style: {
              colors: subtextColor,
              fontSize: "10px",
              fontFamily: "'Manrope', sans-serif",
            },
            rotate: 0,
            hideOverlappingLabels: true,
          },
          tickAmount: 4,
          axisBorder: { show: false },
          axisTicks: { show: false },
        },
        yaxis: {
          min: 0,
          max: maxVal,
          tickAmount: Math.min(Math.max(maxVal, 2), 6),
          forceNiceScale: true,
          decimalsInFloat: 0,
          labels: {
            style: {
              colors: subtextColor,
              fontSize: "10px",
              fontFamily: "'Manrope', sans-serif",
            },
            formatter: (v) => {
              const n = typeof v === "number" ? v : parseFloat(v);
              return !isNaN(n) && Number.isInteger(n) ? n.toString() : "";
            },
          },
        },
        grid: {
          borderColor: gridColor,
          strokeDashArray: 3,
          yaxis: { lines: { show: true } },
          xaxis: { lines: { show: false } },
        },
        tooltip: {
          theme: chartTheme,
          y: { formatter: (v) => fmt(v) },
        },
      },
      series: [{ name: "Alerts", data: correctedTimelineCounts }],
    };
  }, [timeline, correctedTimelineCounts, chartTheme, gridColor, subtextColor]);

  // Chart 4: Top 10 Locations · Alerts divided by Event (Stacked Horizontal Bar Chart)
  const topCamBar = useMemo(() => {
    // Prefer topLocations if available, otherwise fall back to topCameras
    const locations = (topLocations.length ? topLocations : topCameras).slice(0, 10);

    // Format categories: e.g. "sindhubhavan · Ahmedabad", "ambawadi · surat"
    const categories = locations.map((loc) => {
      const locationName =
        loc.location && loc.location !== "Unknown"
          ? loc.location.trim()
          : (loc.deviceId || "");
      const districtName =
        loc.district && loc.district !== "Unknown" ? loc.district.trim() : "";
      if (locationName && districtName) {
        if (locationName.toLowerCase().includes(districtName.toLowerCase())) {
          return locationName;
        }
        return `${locationName} · ${districtName}`;
      }
      return locationName || districtName || loc.deviceId || "Unknown";
    });

    // Find all distinct event types across these locations with positive counts
    const eventTotals = {};
    locations.forEach((loc) => {
      const byAn = loc.byAnalytics || {};
      Object.entries(byAn).forEach(([event, count]) => {
        if (count > 0) {
          eventTotals[event] = (eventTotals[event] || 0) + count;
        }
      });
    });

    // Sort events following byAnalytics order so the series and colors align 1:1
    const analyticsOrder = byAnalytics.map((a) => a.label);
    const activeEvents = Object.keys(eventTotals).sort((a, b) => {
      const idxA = analyticsOrder.indexOf(a);
      const idxB = analyticsOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return (eventTotals[b] || 0) - (eventTotals[a] || 0);
    });

    // Build stacked series: one series per event type
    const series = activeEvents.map((eventName) => ({
      name: eventName,
      data: locations.map((loc) => loc.byAnalytics?.[eventName] || 0),
    }));

    // Exact same colors for each event as in "Alerts by AI Analytics"
    const colors = activeEvents.map((eventName, idx) => getEventColor(eventName, idx));

    const maxTotal = Math.max(...locations.map((l) => l.total || 0), 4);
    const maxVal = maxTotal <= 100 ? 100 : Math.ceil(maxTotal / 10) * 10;

    return {
      options: {
        chart: {
          type: "bar",
          stacked: true,
          background: "transparent",
          toolbar: { show: false },
          fontFamily: "'Manrope', sans-serif",
          parentHeightOffset: 0,
        },
        theme: { mode: chartTheme },
        colors: colors.length ? colors : ["#0284C7"],
        plotOptions: {
          bar: {
            horizontal: true,
            barHeight: "55%",
            borderRadius: 4,
            borderRadiusApplication: "end",
          },
        },
        dataLabels: { enabled: false },
        xaxis: {
          categories,
          min: 0,
          max: maxVal,
          tickAmount: Math.min(Math.max(Math.round(maxVal / 10), 2), 10),
          forceNiceScale: true,
          decimalsInFloat: 0,
          labels: {
            style: {
              colors: subtextColor,
              fontSize: "10px",
              fontFamily: "'Manrope', sans-serif",
            },
            formatter: (v) => {
              const n = typeof v === "number" ? v : parseFloat(v);
              return !isNaN(n) && Number.isInteger(n) ? n.toString() : "";
            },
          },
          axisBorder: { show: false },
          axisTicks: { show: false },
        },
        yaxis: {
          labels: {
            maxWidth: 170,
            trim: true,
            style: {
              colors: subtextColor,
              fontSize: "10px",
              fontFamily: "'Manrope', sans-serif",
            },
          },
        },
        grid: {
          borderColor: gridColor,
          strokeDashArray: 0,
          xaxis: { lines: { show: false } },
          yaxis: { lines: { show: true } },
        },
        legend: {
          show: true,
          position: "bottom",
          horizontalAlign: "center",
          fontSize: "11px",
          fontFamily: "'Manrope', sans-serif",
          labels: {
            colors: subtextColor,
          },
          markers: {
            radius: 3,
            width: 12,
            height: 12,
          },
          itemMargin: {
            horizontal: 8,
            vertical: 4,
          },
        },
        tooltip: {
          theme: chartTheme,
          shared: true,
          intersect: false,
          y: {
            formatter: (v) => fmt(v),
          },
        },
      },
      series: series.length > 0 ? series : [{ name: "Alerts", data: [0] }],
    };
  }, [topLocations, topCameras, byAnalytics, analyticsLabels, chartTheme, gridColor, subtextColor]);

  // Matrix Totals
  const matrixTotals = useMemo(() => {
    const t = { total: 0 };
    analyticsLabels.forEach((l) => (t[l] = 0));
    matrix.forEach((row) => {
      t.total += row.total;
      analyticsLabels.forEach((l) => (t[l] += row.byAnalytics[l] || 0));
    });
    return t;
  }, [matrix, analyticsLabels]);

  return (
    <Box
      maxW="1440px"
      w="100%"
      mx="auto"
      px={{ base: "12px", sm: "16px", md: "20px", lg: "24px" }}
      py={{ base: "12px", md: "16px" }}
      fontFamily="'Manrope', sans-serif"
      mb={{ base: "20", md: "6" }}
    >
      {/* CSS for marquee ticker */}
      <style>{`
        @keyframes ai-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ai-marquee-track {
          display: inline-flex;
          white-space: nowrap;
          animation: ai-marquee 100s linear infinite;
        }
        .ai-marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>

      {/* ============================================================
          CONTAINER 1: VMUKTI AI ALERT CONTAINER (Header & Live Ticker)
          ============================================================ */}
      <Box mb="18px">
        {/* Top Header Row */}
        <Flex
          justify="space-between"
          align={{ base: "flex-start", sm: "center" }}
          direction={{ base: "column", sm: "row" }}
          gap="10px"
          mb="12px"
        >
          {/* Left: Brand Icon + Title + Date */}
          <Flex align="center" gap="10px">
            {/* 1. Icon container (36x36, border-radius: 10px, background: linear-gradient(135deg, #3F77A5 0%, #8B5CF6 100%)) */}
            <Flex
              w="36px"
              h="36px"
              minW="36px"
              borderRadius="10px"
              bgGradient="linear(135deg, #3F77A5 0%, #8B5CF6 100%)"
              color="#FFFFFF"
              align="center"
              justify="center"
              boxShadow="0 2px 8px rgba(63, 119, 165, 0.25)"
              flexShrink={0}
            >
              <Icon as={BsLightningChargeFill} boxSize="18px" color="#FFFFFF" />
            </Flex>

            {/* 2 & 3. Title and Date container */}
            <Box>
              {/* Title: VMUKTI (#1A2E3D) AI ALERT COMMAND CENTER (#3F77A5), Manrope 800 ExtraBold, 18px, line-height 27px */}
              <Text
                fontFamily="'Manrope', sans-serif"
                fontWeight="800"
                fontSize="18px"
                lineHeight="27px"
                letterSpacing="0px"
              >
                <Text as="span" color={useColorModeValue("#1A2E3D", "#FFFFFF")}>
                  VMUKTI
                </Text>{" "}
                <Text as="span" color="#3F77A5">
                  AI ALERT COMMAND CENTER
                </Text>
              </Text>

              {/* Date container (Manrope 400 Regular, 12px, line-height 18px, color #64748B) */}
              <Box
                position="relative"
                display="inline-flex"
                alignItems="center"
                gap="6px"
                cursor="pointer"
                onClick={() => dateInputRef.current?.showPicker?.()}
                _hover={{ opacity: 0.8 }}
                transition="opacity 0.15s ease"
              >
                <Text
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="400"
                  fontSize="12px"
                  lineHeight="18px"
                  letterSpacing="0px"
                  color={subtextColor}
                  userSelect="none"
                >
                  {displayDate}
                </Text>
                <TbCalendar size="15px" color={subtextColor} />
                <Input
                  ref={dateInputRef}
                  type="date"
                  value={date}
                  onChange={(e) => {
                    if (e.target.value) setDate(e.target.value);
                  }}
                  position="absolute"
                  top={0}
                  left={0}
                  w="100%"
                  h="100%"
                  opacity={0}
                  cursor="pointer"
                  pointerEvents="auto"
                />
              </Box>
            </Box>
          </Flex>

          {/* 4. VMUKTI AI LIVE Badge layout (Height: 29px, Padding: 5px 11px, Border-radius: 6px, Background: #10B98114, Border: 1px solid #10B98128) */}
          <Flex
            h="29px"
            align="center"
            gap="5px"
            px="11px"
            py="5px"
            borderRadius="6px"
            bg="#10B98114"
            border="1px solid"
            borderColor="#10B98128"
            userSelect="none"
          >
            {/* Dot icon (6x6, border-radius: 3px, background: #10B981) */}
            <Box
              w="6px"
              h="6px"
              borderRadius="3px"
              bg="#10B981"
              flexShrink={0}
            />
            {/* Badge Text (Manrope 700 Bold, 11px, line-height 16.5px, color #10B981) */}
            <Text
              fontFamily="'Manrope', sans-serif"
              fontWeight="700"
              fontSize="11px"
              lineHeight="16.5px"
              letterSpacing="0px"
              color="#10B981"
              whiteSpace="nowrap"
            >
              VMUKTI AI · LIVE
            </Text>
          </Flex>
        </Flex>

        {/* 2. Alert container on AI Dashboard (Height: 34.5px, Padding: 9px 16px, Border-radius: 9px, Background: #3F77A5) */}
        <Flex
          w="100%"
          h="34.5px"
          minH="34.5px"
          borderRadius="9px"
          bg={tickerBg}
          align="center"
          px="16px"
          py="9px"
          overflow="hidden"
          boxShadow="0 1px 4px rgba(0, 0, 0, 0.08)"
        >
          <Box flex="1" overflow="hidden">
            {liveFeed.length === 0 ? (
              <Text
                fontFamily="'Manrope', sans-serif"
                fontWeight="400"
                fontSize="11px"
                lineHeight="16.5px"
                letterSpacing="0px"
                color="#FFFFFFCC"
              >
                Monitoring live AI streams... No active alerts detected.
              </Text>
            ) : (
              <Box className="ai-marquee-track">
                {[...liveFeed, ...liveFeed, ...liveFeed].map((a, i) => (
                  <Flex
                    as="span"
                    key={i}
                    align="center"
                    gap="6px"
                    mr="32px"
                    fontFamily="'Manrope', sans-serif"
                    fontWeight="400"
                    fontSize="11px"
                    lineHeight="16.5px"
                    letterSpacing="0px"
                    color="#FFFFFFCC"
                  >
                    <Icon as={TbPlayerPlay} boxSize="10px" color="#FFFFFFB3" />
                    <Text as="span" fontWeight="700" color="#FFFFFF">
                      {a.label}
                    </Text>
                    <Text as="span" color="#FFFFFF80">
                      ·
                    </Text>
                    <Text as="span">{a.deviceId}</Text>
                    <Text as="span" color="#FFFFFF80">
                      ·
                    </Text>
                    <Text as="span">{a.district}</Text>
                    <Text as="span" color="#FFFFFF80">
                      ·
                    </Text>
                    <Text as="span" color="#FFFFFF99">
                      {a.time}
                    </Text>
                  </Flex>
                ))}
              </Box>
            )}
          </Box>
        </Flex>
      </Box>

      {loading && !data ? (
        <Flex justify="center" align="center" py={20} gap={3}>
          <Spinner color="#3F77A5" size="lg" thickness="3px" />
          <Text color={subtextColor} fontSize="14px" fontWeight="600">
            Loading AI Command Center…
          </Text>
        </Flex>
      ) : (
        <>
          {/* ============================================================
              CONTAINER 2: KPI CONTAINER (4 Cards Grid)
              ============================================================ */}
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing="16px" mb="18px">
            {/* Card 1: Total Alerts */}
            <Box
              bg={cardBg}
              h="92px"
              minH="92px"
              p="20px"
              borderRadius="14px"
              borderWidth="3px 1px 1px 1px"
              borderStyle="solid"
              borderColor={borderColor}
              boxShadow="0px 1px 6px 0px rgba(26, 46, 61, 0.07)"
              display="flex"
              alignItems="center"
              gap="14px"
            >
              <Flex
                w="46px"
                h="46px"
                minW="46px"
                borderRadius="12px"
                bg="#F59E0B16"
                color="#F59E0B"
                align="center"
                justify="center"
                flexShrink={0}
              >
                <Icon as={TbBolt} boxSize="22px" />
              </Flex>
              <Box>
                <Text
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="800"
                  fontSize="28px"
                  lineHeight="32px"
                  color={headingColor}
                >
                  {fmt(totals.totalAlerts)}
                </Text>
                <Text
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="600"
                  fontSize="10px"
                  lineHeight="15px"
                  letterSpacing="0.8px"
                  textTransform="uppercase"
                  color={subtextColor}
                >
                  TOTAL ALERTS
                </Text>
              </Box>
            </Box>

            {/* Card 2: Unique Cameras */}
            <Box
              bg={cardBg}
              h="92px"
              minH="92px"
              p="20px"
              borderRadius="14px"
              borderWidth="3px 1px 1px 1px"
              borderStyle="solid"
              borderColor={borderColor}
              boxShadow="0px 1px 6px 0px rgba(26, 46, 61, 0.07)"
              display="flex"
              alignItems="center"
              gap="14px"
            >
              <Flex
                w="46px"
                h="46px"
                minW="46px"
                borderRadius="12px"
                bg="#3F77A516"
                color="#3F77A5"
                align="center"
                justify="center"
                flexShrink={0}
              >
                <Icon as={TbCamera} boxSize="22px" />
              </Flex>
              <Box>
                <Text
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="800"
                  fontSize="28px"
                  lineHeight="32px"
                  color={headingColor}
                >
                  {fmt(totals.uniqueCameras)}
                </Text>
                <Text
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="600"
                  fontSize="10px"
                  lineHeight="15px"
                  letterSpacing="0.8px"
                  textTransform="uppercase"
                  color={subtextColor}
                >
                  UNIQUE CAMERAS
                </Text>
              </Box>
            </Box>

            {/* Card 3: Analytics Types */}
            <Box
              bg={cardBg}
              h="92px"
              minH="92px"
              p="20px"
              borderRadius="14px"
              borderWidth="3px 1px 1px 1px"
              borderStyle="solid"
              borderColor={borderColor}
              boxShadow="0px 1px 6px 0px rgba(26, 46, 61, 0.07)"
              display="flex"
              alignItems="center"
              gap="14px"
            >
              <Flex
                w="46px"
                h="46px"
                minW="46px"
                borderRadius="12px"
                bg="#8B5CF616"
                color="#8B5CF6"
                align="center"
                justify="center"
                flexShrink={0}
              >
                <Icon as={TbActivity} boxSize="22px" />
              </Flex>
              <Box>
                <Text
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="800"
                  fontSize="28px"
                  lineHeight="32px"
                  color={headingColor}
                >
                  {fmt(totals.analyticsTypes)}
                </Text>
                <Text
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="600"
                  fontSize="10px"
                  lineHeight="15px"
                  letterSpacing="0.8px"
                  textTransform="uppercase"
                  color={subtextColor}
                >
                  ANALYTICS TYPES
                </Text>
              </Box>
            </Box>

            {/* Card 4: Locations */}
            <Box
              bg={cardBg}
              h="92px"
              minH="92px"
              p="20px"
              borderRadius="14px"
              borderWidth="3px 1px 1px 1px"
              borderStyle="solid"
              borderColor={borderColor}
              boxShadow="0px 1px 6px 0px rgba(26, 46, 61, 0.07)"
              display="flex"
              alignItems="center"
              gap="14px"
            >
              <Flex
                w="46px"
                h="46px"
                minW="46px"
                borderRadius="12px"
                bg="#DB7B3A16"
                color="#DB7B3A"
                align="center"
                justify="center"
                flexShrink={0}
              >
                <Icon as={TbMapPin} boxSize="22px" />
              </Flex>
              <Box>
                <Text
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="800"
                  fontSize="28px"
                  lineHeight="32px"
                  color={headingColor}
                >
                  {fmt(totals.districts)}
                </Text>
                <Text
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="600"
                  fontSize="10px"
                  lineHeight="15px"
                  letterSpacing="0.8px"
                  textTransform="uppercase"
                  color={subtextColor}
                >
                  LOCATIONS
                </Text>
              </Box>
            </Box>
          </SimpleGrid>

          {/* ============================================================
              CONTAINER 3: LOCATION CONTAINER (Side-by-Side Responsive Cards)
              ============================================================ */}
          <Box mb="18px">
            {byDistrict.length === 0 ? (
              <Flex
                h="52px"
                minH="52px"
                justify="center"
                align="center"
                px="16px"
                py="10px"
                borderRadius="9px"
                border="1px solid"
                borderColor="#3F77A530"
                bg="#3F77A50D"
              >
                <Text
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="600"
                  fontSize="12px"
                  color={subtextColor}
                >
                  No active location alerts recorded.
                </Text>
              </Flex>
            ) : (
              <SimpleGrid
                columns={{
                  base: 1,
                  sm: Math.min(Math.max(byDistrict.length, 1), 2),
                  md: Math.min(Math.max(byDistrict.length, 1), 3),
                  lg: Math.min(Math.max(byDistrict.length, 1), 4),
                }}
                spacing="12px"
              >
                {byDistrict.map((d) => (
                  <Flex
                    key={d.district}
                    h="52px"
                    minH="52px"
                    justify="space-between"
                    align="center"
                    px="16px"
                    py="10px"
                    borderRadius="9px"
                    border="1px solid"
                    borderColor="#3F77A530"
                    bg="#3F77A50D"
                  >
                    {/* Left: Box icon + Location Name + Alert Count */}
                    <Flex align="center" gap="10px">
                      {/* Box icon (10x10, border-radius: 2px, background: #3F77A5) */}
                      <Box
                        w="10px"
                        h="10px"
                        minW="10px"
                        borderRadius="2px"
                        bg="#3F77A5"
                        flexShrink={0}
                      />
                      {/* Location Text (Manrope 700 Bold, 12px, line-height 18px, letter-spacing 0.72px, color #3F77A5) */}
                      <Text
                        fontFamily="'Manrope', sans-serif"
                        fontWeight="700"
                        fontSize="12px"
                        lineHeight="18px"
                        letterSpacing="0.72px"
                        textTransform="uppercase"
                        color="#3F77A5"
                      >
                        {d.district}
                      </Text>
                      {/* Alert Number (Manrope 800 ExtraBold, 20px, line-height 30px, color #1A2E3D) */}
                      <Text
                        fontFamily="'Manrope', sans-serif"
                        fontWeight="800"
                        fontSize="20px"
                        lineHeight="30px"
                        letterSpacing="0px"
                        color={headingColor}
                      >
                        {fmt(d.count)}
                      </Text>
                    </Flex>

                    {/* Right: Percentage (Manrope 600 SemiBold, 12px, line-height 18px, color subtextColor) */}
                    <Text
                      fontFamily="'Manrope', sans-serif"
                      fontWeight="600"
                      fontSize="12px"
                      lineHeight="18px"
                      letterSpacing="0px"
                      color={subtextColor}
                    >
                      {d.pct}%
                    </Text>
                  </Flex>
                ))}
              </SimpleGrid>
            )}
          </Box>

          {/* ============================================================
              CONTAINER 4: ANALYTICS CONTAINER 1 (3 Charts Row)
              ============================================================ */}
          <Grid
            templateColumns={{ base: "1fr", lg: "repeat(3, minmax(0, 1fr))" }}
            gap="16px"
            mb="18px"
            alignItems="stretch"
          >
            {/* Card 1: Alerts by AI Analytics (Height: 267.5px, Padding: 20px, Radius: 14px) */}
            <Box
              bg={cardBg}
              h="267.5px"
              minH="267.5px"
              minW="0"
              w="100%"
              p="20px"
              borderRadius="14px"
              borderWidth="1px"
              borderStyle="solid"
              borderColor={borderColor}
              boxShadow="0px 1px 6px 0px rgba(26, 46, 61, 0.07)"
              display="flex"
              flexDirection="column"
            >
              {/* Text Container (Manrope 700 Bold, 14px, line-height 21px) */}
              <Text
                fontFamily="'Manrope', sans-serif"
                fontWeight="700"
                fontSize="14px"
                lineHeight="21px"
                letterSpacing="0px"
                color={headingColor}
              >
                Alerts by AI Analytics
              </Text>
              {/* Bar Chart (Height: 182px, Padding-top: 12px) */}
              <Box flex="1" h="182px" pt="12px" minW="0" w="100%">
                {byAnalytics.length ? (
                  <ReactApexChart
                    key={`bar-${date}-${byAnalytics.map((a) => a.label).join("_")}`}
                    options={analyticsBar.options}
                    series={analyticsBar.series}
                    type="bar"
                    height="100%"
                  />
                ) : (
                  <Flex justify="center" align="center" h="100%" color={subtextColor}>
                    <Text fontSize="12px">No analytics data</Text>
                  </Flex>
                )}
              </Box>
            </Box>

            {/* Card 2: Alerts by Locations (Height: 267.5px, Padding: 20px, Radius: 14px) */}
            <Box
              bg={cardBg}
              h="267.5px"
              minH="267.5px"
              minW="0"
              w="100%"
              p="20px"
              borderRadius="14px"
              borderWidth="1px"
              borderStyle="solid"
              borderColor={borderColor}
              boxShadow="0px 1px 6px 0px rgba(26, 46, 61, 0.07)"
              display="flex"
              flexDirection="column"
            >
              {/* Text Container (Manrope 700 Bold, 14px, line-height 21px) */}
              <Text
                fontFamily="'Manrope', sans-serif"
                fontWeight="700"
                fontSize="14px"
                lineHeight="21px"
                letterSpacing="0px"
                color={headingColor}
              >
                Alerts by Locations
              </Text>
              {/* Circular Pie Chart centered in container */}
              <Flex
                flex="1"
                h="100%"
                minW="0"
                direction="column"
                justify="center"
                align="center"
                w="100%"
              >
                {byDistrict.length ? (
                  <>
                    <Box w="100%" h="180px" display="flex" alignItems="center" justifyContent="center">
                      <ReactApexChart
                        key={`pie-district-${date}-${byDistrict.length}-${totals.totalAlerts}`}
                        options={districtPie.options}
                        series={districtPie.series}
                        type="donut"
                        height="100%"
                        width="100%"
                      />
                    </Box>
                    {/* Location Legend Badges */}
                    <Flex gap="5px" mt="2px" wrap="wrap" justify="center">
                      {byDistrict.map((d, i) => {
                        const color = LOCATION_COLORS[i % LOCATION_COLORS.length];
                        return (
                          <Flex
                            key={d.district}
                            h="18px"
                            align="center"
                            justify="center"
                            px="8px"
                            py="1px"
                            borderRadius="999px"
                            bg={`${color}1A`}
                          >
                            <Text
                              fontFamily="'Manrope', sans-serif"
                              fontWeight="700"
                              fontSize="10px"
                              lineHeight="12px"
                              letterSpacing="0.3px"
                              color={color}
                            >
                              {d.district}
                            </Text>
                          </Flex>
                        );
                      })}
                    </Flex>
                  </>
                ) : (
                  <Flex justify="center" align="center" h="100%" color={subtextColor}>
                    <Text fontSize="12px">No location data</Text>
                  </Flex>
                )}
              </Flex>
            </Box>

            {/* Card 3: Alert Timeline · 24H (Height: 267.5px, Padding: 20px, Radius: 14px) */}
            <Box
              bg={cardBg}
              h="267.5px"
              minH="267.5px"
              minW="0"
              w="100%"
              p="20px"
              borderRadius="14px"
              borderWidth="1px"
              borderStyle="solid"
              borderColor={borderColor}
              boxShadow="0px 1px 6px 0px rgba(26, 46, 61, 0.07)"
              display="flex"
              flexDirection="column"
            >
              {/* Text Container (Manrope 700 Bold, 14px, line-height 21px) */}
              <Text
                fontFamily="'Manrope', sans-serif"
                fontWeight="700"
                fontSize="14px"
                lineHeight="21px"
                letterSpacing="0px"
                color={headingColor}
              >
                Alert Timeline · 24H
              </Text>
              {/* Area Chart Graph (Height: 182px, Padding-top: 12px) */}
              <Box flex="1" h="182px" pt="12px" minW="0" w="100%">
                {timeline.length ? (
                  <ReactApexChart
                    key={`timeline-${date}-${timeline.length}`}
                    options={timelineArea.options}
                    series={timelineArea.series}
                    type="area"
                    height="100%"
                  />
                ) : (
                  <Flex justify="center" align="center" h="100%" color={subtextColor}>
                    <Text fontSize="12px">No timeline data</Text>
                  </Flex>
                )}
              </Box>
            </Box>
          </Grid>

          {/* ============================================================
              CONTAINER 5: ANALYTICS CONTAINER 2 (Bottom Row: 3 Panels)
              ============================================================ */}
          <Grid
            templateColumns={{ base: "1fr", lg: "repeat(3, minmax(0, 1fr))" }}
            gap="16px"
            alignItems="stretch"
          >
            {/* Panel 1: VMukti AI · Insights (Height: 267.5px, Padding: 20px, Radius: 14px) */}
            <Box
              bg={cardBg}
              h="267.5px"
              minH="267.5px"
              minW="0"
              w="100%"
              p="20px"
              borderRadius="14px"
              borderWidth="1px"
              borderStyle="solid"
              borderColor={borderColor}
              boxShadow="0px 1px 6px 0px rgba(26, 46, 61, 0.07)"
              display="flex"
              flexDirection="column"
            >
              {/* Title & Icon (Manrope 700 Bold, 14px, line-height 21px, gap 6px, Icon #F59E0B) */}
              <Flex align="center" gap="6px">
                <Icon as={BsLightningChargeFill} color="#F59E0B" boxSize="13px" />
                <Text
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="700"
                  fontSize="14px"
                  lineHeight="21px"
                  letterSpacing="0px"
                  color={headingColor}
                >
                  VMukti AI · Insights
                </Text>
              </Flex>

              {/* Insights List Container (Height: 182px, Padding-top: 12px, Gap: 8px) */}
              <Box
                flex="1"
                h="182px"
                pt="12px"
                minW="0"
                w="100%"
                overflowY="auto"
                pr="4px"
                display="flex"
                flexDirection="column"
                gap="8px"
                css={{
                  "&::-webkit-scrollbar": { width: "4px" },
                  "&::-webkit-scrollbar-thumb": {
                    background: "rgba(100, 116, 139, 0.3)",
                    borderRadius: "4px",
                  },
                }}
              >
                {insights.length === 0 ? (
                  <Flex justify="center" align="center" h="100%" color={subtextColor}>
                    <Text
                      fontFamily="'Manrope', sans-serif"
                      fontSize="12px"
                      lineHeight="18.6px"
                      color={subtextColor}
                    >
                      No automated insights generated for this period.
                    </Text>
                  </Flex>
                ) : (
                  insights.map((txt, i) => (
                    <Flex key={i} gap="7px" align="flex-start">
                      {/* Lightning bullet icon (#F59E0B) */}
                      <Icon
                        as={BsLightningChargeFill}
                        color="#F59E0B"
                        boxSize="10px"
                        mt="4px"
                        flexShrink={0}
                      />
                      {/* Insight text (Manrope 400 Regular, 12px, line-height 18.6px, color #64748B) */}
                      <Text
                        fontFamily="'Manrope', sans-serif"
                        fontWeight="400"
                        fontSize="12px"
                        lineHeight="18.6px"
                        letterSpacing="0px"
                        color={subtextColor}
                      >
                        {txt}
                      </Text>
                    </Flex>
                  ))
                )}
              </Box>
            </Box>

            {/* Panel 2: Top Cameras · Alerts (Height: 267.5px, Padding: 20px, Radius: 14px) */}
            <Box
              bg={cardBg}
              h="267.5px"
              minH="267.5px"
              minW="0"
              w="100%"
              p="20px"
              borderRadius="14px"
              borderWidth="1px"
              borderStyle="solid"
              borderColor={borderColor}
              boxShadow="0px 1px 6px 0px rgba(26, 46, 61, 0.07)"
              display="flex"
              flexDirection="column"
            >
              {/* Title (Manrope 700 Bold, 14px, line-height 21px) */}
              <Text
                fontFamily="'Manrope', sans-serif"
                fontWeight="700"
                fontSize="14px"
                lineHeight="21px"
                letterSpacing="0px"
                color={headingColor}
              >
                TOP 10 LOCATIONS · LOCATION · DISTRICT · ALERTS
              </Text>
              {/* Bar Chart (Height: 182px, Padding-top: 8px) */}
              <Box flex="1" h="182px" pt="8px" minW="0" w="100%">
                {(topLocations.length || topCameras.length) ? (
                  <ReactApexChart
                    key={`toploc-${date}-${topLocations.length || topCameras.length}-${topCamBar.series.map((s) => s.name).join("_")}`}
                    options={topCamBar.options}
                    series={topCamBar.series}
                    type="bar"
                    height="100%"
                  />
                ) : (
                  <Flex justify="center" align="center" h="100%" color={subtextColor}>
                    <Text fontSize="12px">No location alerts data</Text>
                  </Flex>
                )}
              </Box>
            </Box>

            {/* Panel 3: Locations · Analytics Matrix (Height: 267.5px, Padding: 20px, Radius: 14px) */}
            <Box
              bg={cardBg}
              h="267.5px"
              minH="267.5px"
              minW="0"
              w="100%"
              p="20px"
              borderRadius="14px"
              borderWidth="1px"
              borderStyle="solid"
              borderColor={borderColor}
              boxShadow="0px 1px 6px 0px rgba(26, 46, 61, 0.07)"
              display="flex"
              flexDirection="column"
            >
              {/* Title (Manrope 700 Bold, 14px, line-height 21px) */}
              <Text
                fontFamily="'Manrope', sans-serif"
                fontWeight="700"
                fontSize="14px"
                lineHeight="21px"
                letterSpacing="0px"
                color={headingColor}
              >
                Locations · Analytics Matrix
              </Text>

              {/* Summary Matrix Table Container (Height: 182px, Padding-top: 12px, isolated scroll) */}
              <Box
                flex="1"
                h="182px"
                pt="12px"
                minW="0"
                w="100%"
                overflowX="auto"
                overflowY="auto"
                pr="2px"
                css={{
                  "&::-webkit-scrollbar": { width: "4px", height: "4px" },
                  "&::-webkit-scrollbar-thumb": {
                    background: "rgba(100, 116, 139, 0.3)",
                    borderRadius: "4px",
                  },
                }}
              >
                <Box
                  as="table"
                  w="max-content"
                  minW="100%"
                  fontSize="11px"
                  style={{ borderCollapse: "collapse" }}
                >
                  <Box as="thead">
                    <Box as="tr" color={subtextColor} textAlign="left">
                      <Box as="th" py={2} pr={3} fontWeight="600" fontSize="10px" color={subtextColor} whiteSpace="nowrap">
                        Location
                      </Box>
                      {analyticsLabels.map((l) => (
                        <Box
                          as="th"
                          key={l}
                          py={2}
                          px={2}
                          textAlign="center"
                          fontWeight="600"
                          fontSize="10px"
                          color={subtextColor}
                          whiteSpace="nowrap"
                        >
                          {l}
                        </Box>
                      ))}
                      <Box as="th" py={2} pl={2} textAlign="right" fontWeight="600" fontSize="10px" color={subtextColor} whiteSpace="nowrap">
                        Total
                      </Box>
                    </Box>
                  </Box>
                  <Box as="tbody">
                    {matrix.map((row) => (
                      <Box as="tr" key={row.district} borderTop="1px solid" borderColor={borderColor}>
                        <Box as="td" py={2} pr={3} fontWeight="700" color={headingColor} whiteSpace="nowrap">
                          {row.district}
                        </Box>
                        {analyticsLabels.map((l) => (
                          <Box as="td" key={l} py={2} px={2} textAlign="center" color={subtextColor} whiteSpace="nowrap">
                            {fmt(row.byAnalytics[l])}
                          </Box>
                        ))}
                        <Box as="td" py={2} pl={2} textAlign="right" fontWeight="700" color={headingColor} whiteSpace="nowrap">
                          {fmt(row.total)}
                        </Box>
                      </Box>
                    ))}
                    {matrix.length > 0 && (
                      <Box as="tr" borderTop="2px solid" borderColor={borderColor}>
                        <Box as="td" py={2} pr={3} fontWeight="800" color={headingColor} textTransform="uppercase" whiteSpace="nowrap">
                          TOTAL
                        </Box>
                        {analyticsLabels.map((l) => (
                          <Box as="td" key={l} py={2} px={2} textAlign="center" fontWeight="800" color={headingColor} whiteSpace="nowrap">
                            {fmt(matrixTotals[l])}
                          </Box>
                        ))}
                        <Box as="td" py={2} pl={2} textAlign="right" fontWeight="800" color={headingColor} whiteSpace="nowrap">
                          {fmt(matrixTotals.total)}
                        </Box>
                      </Box>
                    )}
                    {matrix.length === 0 && (
                      <Box as="tr">
                        <Box as="td" colSpan={analyticsLabels.length + 2} py={6} textAlign="center" color={subtextColor}>
                          No matrix data available
                        </Box>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            </Box>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default AiDashboard;
