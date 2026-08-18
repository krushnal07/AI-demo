import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import ReactApexChart from "react-apexcharts";
import { Box, Flex, Text, Grid, Spinner, Input, useColorMode, useColorModeValue } from "@chakra-ui/react";
import {
  BsCameraVideoFill,
  BsCpu,
  BsGeoAltFill,
  BsBroadcast,
  BsLightningChargeFill,
} from "react-icons/bs";

const SERIES_COLORS = [
  "#38BDF8", "#F472B6", "#FBBF24", "#34D399", "#A78BFA",
  "#F87171", "#FDBA74", "#4ADE80", "#22D3EE", "#60A5FA",
];

const fmt = (n) => (n ?? 0).toLocaleString("en-IN");

// Small reusable panel (mode-aware)
const Panel = ({ title, subtitle, children, ...rest }) => {
  const panel = useColorModeValue("#FFFFFF", "#0F1626");
  const border = useColorModeValue("#E2E8F0", "#1E293B");
  const sub = useColorModeValue("#64748B", "#7C8BA5");
  return (
    <Box bg={panel} border="1px solid" borderColor={border} borderRadius="14px" p={4} {...rest}>
      {title && (
        <Text fontSize="11px" fontWeight="700" letterSpacing="0.12em" color={sub} textTransform="uppercase" mb={subtitle ? 0 : 3}>
          {title}
        </Text>
      )}
      {subtitle && <Text fontSize="11px" color={sub} mb={3}>{subtitle}</Text>}
      {children}
    </Box>
  );
};

const KpiCard = ({ icon, value, label, accent }) => {
  const panel = useColorModeValue("#FFFFFF", "#0F1626");
  const border = useColorModeValue("#E2E8F0", "#1E293B");
  const text = useColorModeValue("#1A202C", "#E2E8F0");
  const sub = useColorModeValue("#64748B", "#7C8BA5");
  return (
    <Flex bg={panel} border="1px solid" borderColor={border} borderRadius="14px" p={4} align="center" gap={4}
      position="relative" overflow="hidden">
      <Box position="absolute" top={0} left={0} bottom={0} w="3px" bg={accent} />
      <Flex align="center" justify="center" boxSize="44px" borderRadius="12px" bg={`${accent}22`} color={accent} flexShrink={0}>
        {icon}
      </Flex>
      <Box>
        <Text fontSize="28px" fontWeight="800" color={text} lineHeight="1.1">{value}</Text>
        <Text fontSize="10px" fontWeight="700" letterSpacing="0.1em" color={sub} textTransform="uppercase">{label}</Text>
      </Box>
    </Flex>
  );
};

const AiDashboard = () => {
  const email = localStorage.getItem("email") || "";
  const { colorMode } = useColorMode();

  // --- Mode-aware palette ---
  const bg = useColorModeValue("#F1F5F9", "#0A0F1C");
  const panel = useColorModeValue("#FFFFFF", "#0F1626");
  const panel2 = useColorModeValue("#F8FAFC", "#111A2E");
  const border = useColorModeValue("#E2E8F0", "#1E293B");
  const text = useColorModeValue("#1A202C", "#E2E8F0");
  const sub = useColorModeValue("#64748B", "#7C8BA5");
  const accent = useColorModeValue("#0891B2", "#22D3EE");

  const [date, setDate] = useState(() => {
    const dt = new Date();
    const p = (x) => String(x).padStart(2, "0");
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`; // yyyy-mm-dd for input
  });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(new Date());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch + poll
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    const [y, m, d] = date.split("-");
    const ddmmyyyy = `${d}/${m}/${y}`;

    const load = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_URL}/api/Analytics/ai-dashboard`, {
          params: { email, date: ddmmyyyy },
        });
        if (!cancelled) setData(res.data);
      } catch (e) {
        if (!cancelled) setData((prev) => prev || { success: false });
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
  const totals = dd.totals || { totalAlerts: 0, uniqueCameras: 0, analyticsTypes: 0, districts: 0 };
  const byDistrict = dd.byDistrict || [];
  const byAnalytics = dd.byAnalytics || [];
  const analyticsLabels = dd.analyticsLabels || [];
  const timeline = dd.timeline || [];
  const topCameras = dd.topCameras || [];
  const matrix = dd.matrix || [];
  const liveFeed = dd.liveFeed || [];
  const insights = dd.insights || [];

  // ---- Chart configs (mode-aware) ----
  const analyticsBar = useMemo(() => ({
    options: {
      chart: { type: "bar", background: "transparent", toolbar: { show: false }, fontFamily: "inherit" },
      theme: { mode: colorMode },
      plotOptions: { bar: { borderRadius: 4, columnWidth: "45%", distributed: true } },
      colors: SERIES_COLORS,
      dataLabels: { enabled: true, style: { fontSize: "10px" }, formatter: (v) => fmt(v) },
      xaxis: { categories: byAnalytics.map((a) => a.label), labels: { style: { colors: sub, fontSize: "10px" }, rotate: -15, hideOverlappingLabels: true } },
      yaxis: { labels: { style: { colors: sub, fontSize: "10px" }, formatter: (v) => fmt(Math.round(v)) } },
      grid: { borderColor: border },
      legend: { show: false },
      tooltip: { theme: colorMode },
    },
    series: [{ name: "Alerts", data: byAnalytics.map((a) => a.count) }],
  }), [byAnalytics, colorMode, sub, border]);

  const districtDonut = useMemo(() => ({
    options: {
      chart: { type: "donut", background: "transparent", fontFamily: "inherit" },
      theme: { mode: colorMode },
      labels: byDistrict.map((x) => x.district),
      colors: SERIES_COLORS,
      stroke: { width: 0 },
      legend: { position: "bottom", labels: { colors: sub }, fontSize: "11px" },
      dataLabels: { enabled: true, formatter: (v) => `${Math.round(v)}%`, style: { fontSize: "10px" } },
      plotOptions: { pie: { donut: { size: "62%", labels: { show: true, total: { show: true, label: "Total", color: sub, formatter: () => fmt(totals.totalAlerts) } } } } },
      tooltip: { theme: colorMode, y: { formatter: (v) => fmt(v) } },
    },
    series: byDistrict.map((x) => x.count),
  }), [byDistrict, totals.totalAlerts, colorMode, sub]);

  // The backend's hourly buckets currently land ~5:30 ahead of the real IST
  // hour (an upstream double-offset bug). Realign here by rotating each
  // hour's count back into its correct slot so the chart reads true IST.
  const TIMELINE_HOUR_OFFSET = 6;
  const correctedTimelineCounts = useMemo(() => {
    const counts = timeline.map((t) => t.count || 0);
    if (!counts.length) return [];
    return Array.from({ length: counts.length }, (_, h) => counts[(h + TIMELINE_HOUR_OFFSET) % counts.length]);
  }, [timeline]);

  const timelineArea = useMemo(() => ({
    options: {
      chart: { type: "area", background: "transparent", toolbar: { show: false }, fontFamily: "inherit" },
      theme: { mode: colorMode },
      colors: ["#34D399"],
      stroke: { curve: "smooth", width: 2 },
      fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
      dataLabels: { enabled: false },
      xaxis: { categories: timeline.map((t) => t.label), labels: { style: { colors: sub, fontSize: "10px" }, rotate: 0, hideOverlappingLabels: true }, tickAmount: 12 },
      yaxis: { labels: { style: { colors: sub, fontSize: "10px" }, formatter: (v) => fmt(Math.round(v)) } },
      grid: { borderColor: border },
      tooltip: { theme: colorMode, y: { formatter: (v) => fmt(v) } },
    },
    series: [{ name: "Alerts", data: correctedTimelineCounts }],
  }), [timeline, correctedTimelineCounts, colorMode, sub, border]);

  const topCamBar = useMemo(() => ({
    options: {
      chart: { type: "bar", stacked: true, background: "transparent", toolbar: { show: false }, fontFamily: "inherit" },
      theme: { mode: colorMode },
      colors: SERIES_COLORS,
      plotOptions: { bar: { horizontal: true, barHeight: "55%", borderRadius: 3 } },
      dataLabels: { enabled: false },
      xaxis: { categories: topCameras.map((c) => c.deviceId), labels: { style: { colors: sub, fontSize: "10px" } } },
      yaxis: { labels: { style: { colors: sub, fontSize: "10px" } } },
      grid: { borderColor: border },
      legend: { position: "bottom", labels: { colors: sub }, fontSize: "10px" },
      tooltip: { theme: colorMode },
    },
    series: analyticsLabels.map((label) => ({
      name: label,
      data: topCameras.map((c) => c.byAnalytics[label] || 0),
    })),
  }), [topCameras, analyticsLabels, colorMode, sub, border]);

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
    <Box bg={bg} minH="100vh" color={text} p={{ base: 3, md: 4 }} borderRadius="12px"
      fontFamily="'Segoe UI', system-ui, sans-serif">
      {/* keyframes for the live ticker */}
      <style>{`
        @keyframes ai-marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .ai-marquee-track { display: inline-flex; white-space: nowrap; animation: ai-marquee 100s linear infinite; }
        .ai-marquee-track:hover { animation-play-state: paused; }
        .ai-scroll::-webkit-scrollbar { width: 6px; }
        .ai-scroll::-webkit-scrollbar-thumb { background: ${border}; border-radius: 3px; }
        @keyframes ai-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
      `}</style>

      {/* Top bar */}
      <Flex align="center" justify="space-between" wrap="wrap" gap={3} pb={3} borderBottom="1px solid" borderColor={border}>
        <Flex align="center" gap={3}>
          <Box as={BsCpu} color={accent} boxSize="22px" />
          <Text fontSize={{ base: "16px", md: "20px" }} fontWeight="800" letterSpacing="0.04em">
            ARCIS <Text as="span" color={accent}>AI ALERT COMMAND CENTER</Text>
          </Text>
          <Flex align="center" gap={1.5} bg="#34D39922" color="#34D399" px={2.5} py={1} borderRadius="full" fontSize="10px" fontWeight="700">
            <Box boxSize="7px" borderRadius="full" bg="#34D399" sx={{ animation: "ai-blink 1.2s infinite" }} />
            AI ENGINE · LIVE
          </Flex>
        </Flex>
        <Flex align="center" gap={3}>
          <Input type="date" size="sm" value={date} onChange={(e) => setDate(e.target.value)}
            bg={panel2} border="1px solid" borderColor={border} color={text} borderRadius="8px" w="150px"
            sx={{
              colorScheme: colorMode,
              "&::-webkit-calendar-picker-indicator": { cursor: "pointer", opacity: 1 },
            }} />
          
        </Flex>
      </Flex>

      {/* Live feed ticker */}
      <Flex align="center" gap={3} py={2} mb={4} borderBottom="1px solid" borderColor={border} overflow="hidden">
        <Flex align="center" gap={1.5} color="#F87171" fontSize="11px" fontWeight="800" flexShrink={0}>
          <Box as={BsBroadcast} /> LIVE FEED
        </Flex>
        <Box flex="1" overflow="hidden">
          {liveFeed.length === 0 ? (
            <Text fontSize="12px" color={sub}>No live alerts</Text>
          ) : (
            <Box className="ai-marquee-track">
              {[...liveFeed, ...liveFeed].map((a, i) => (
                <Text as="span" key={i} fontSize="12px" mr={8} color={sub}>
                  <Text as="span" color={accent} fontWeight="700">{a.label}</Text>
                  {"  "}· {a.deviceId} · <Text as="span" color={text}>{a.district}</Text> · {a.time}
                </Text>
              ))}
            </Box>
          )}
        </Box>
      </Flex>

      {loading && !data ? (
        <Flex justify="center" align="center" py={20} gap={3}>
          <Spinner color={accent} size="lg" thickness="3px" />
          <Text color={sub}>Loading command center…</Text>
        </Flex>
      ) : (
        <>
          {/* KPI cards */}
          <Grid templateColumns={{ base: "1fr", sm: "repeat(2,1fr)", lg: "repeat(4,1fr)" }} gap={3} mb={3}>
            <KpiCard icon={<BsLightningChargeFill size={20} />} value={fmt(totals.totalAlerts)} label="Total Alerts" accent="#F87171" />
            <KpiCard icon={<BsCameraVideoFill size={20} />} value={fmt(totals.uniqueCameras)} label="Unique Cameras" accent="#38BDF8" />
            <KpiCard icon={<BsCpu size={20} />} value={fmt(totals.analyticsTypes)} label="AI Analytics Types" accent="#A78BFA" />
            <KpiCard icon={<BsGeoAltFill size={20} />} value={fmt(totals.districts)} label="Locations" accent="#FBBF24" />
          </Grid>

          {/* District percentage cards */}
          {byDistrict.length > 0 && (
            <Grid templateColumns={{ base: "1fr", sm: "repeat(2,1fr)", lg: `repeat(${Math.min(byDistrict.length, 4)},1fr)` }} gap={3} mb={4}>
              {byDistrict.slice(0, 8).map((x, i) => (
                <Box key={x.district} bg={panel} border="1px solid" borderColor={border} borderRadius="12px" p={3}>
                  <Flex justify="space-between" align="center" mb={1}>
                    <Flex align="center" gap={2}>
                      <Box boxSize="8px" borderRadius="full" bg={SERIES_COLORS[i % SERIES_COLORS.length]} />
                      <Text fontSize="11px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color={sub}>{x.district}</Text>
                    </Flex>
                    <Text fontSize="11px" color={sub}>{x.pct}%</Text>
                  </Flex>
                  <Text fontSize="22px" fontWeight="800">{fmt(x.count)}</Text>
                  <Box mt={2} h="4px" bg={border} borderRadius="full" overflow="hidden">
                    <Box h="100%" w={`${x.pct}%`} bg={SERIES_COLORS[i % SERIES_COLORS.length]} borderRadius="full" />
                  </Box>
                </Box>
              ))}
            </Grid>
          )}

          {/* Charts row */}
          <Grid templateColumns={{ base: "1fr", lg: "1fr 1fr 1fr" }} gap={3} mb={3}>
            <Panel title="Alerts by AI Analytics">
              {byAnalytics.length ? <ReactApexChart options={analyticsBar.options} series={analyticsBar.series} type="bar" height={260} />
                : <Text color={sub} fontSize="sm" py={10} textAlign="center">No data</Text>}
            </Panel>
            <Panel title="Alerts by Locations">
              {byDistrict.length ? <ReactApexChart options={districtDonut.options} series={districtDonut.series} type="donut" height={260} />
                : <Text color={sub} fontSize="sm" py={10} textAlign="center">No data</Text>}
            </Panel>
            <Panel title="Alert Timeline · 24h (IST)">
              {timeline.length ? <ReactApexChart options={timelineArea.options} series={timelineArea.series} type="area" height={260} />
                : <Text color={sub} fontSize="sm" py={10} textAlign="center">No data</Text>}
            </Panel>
          </Grid>

          {/* Bottom row */}
          <Grid templateColumns={{ base: "1fr", lg: "0.9fr 1.3fr 1.4fr" }} gap={3}>
            {/* AI insights */}
            <Panel title="◆ ARCIS AI · Generated Insights">
              <Box className="ai-scroll" maxH="300px" overflowY="auto" pr={1}>
                {insights.length === 0 ? (
                  <Text color={sub} fontSize="sm">No insights available.</Text>
                ) : (
                  insights.map((t, i) => (
                    <Flex key={i} gap={2} mb={3} align="flex-start">
                      <Box as={BsLightningChargeFill} color={accent} mt="3px" flexShrink={0} />
                      <Text fontSize="12px" color={text} lineHeight="1.5">{t}</Text>
                    </Flex>
                  ))
                )}
              </Box>
            </Panel>

            {/* Top cameras */}
            <Panel title="Top 10 Cameras · Camera · Location · Alerts">
              {topCameras.length ? <ReactApexChart options={topCamBar.options} series={topCamBar.series} type="bar" height={300} />
                : <Text color={sub} fontSize="sm" py={10} textAlign="center">No data</Text>}
            </Panel>

            {/* Matrix */}
            <Panel title="Locations × Analytics Matrix" overflow="hidden">
              <Box overflowX="auto" className="ai-scroll">
                <Box as="table" w="100%" fontSize="11px" style={{ borderCollapse: "collapse" }}>
                  <Box as="thead">
                    <Box as="tr" color={sub} textAlign="left">
                      <Box as="th" py={2} pr={3} textTransform="uppercase" fontSize="10px">Locations</Box>
                      {analyticsLabels.map((l) => (
                        <Box as="th" key={l} py={2} px={2} textAlign="right" textTransform="uppercase" fontSize="10px" whiteSpace="nowrap">{l}</Box>
                      ))}
                      <Box as="th" py={2} pl={2} textAlign="right" textTransform="uppercase" fontSize="10px">Total</Box>
                    </Box>
                  </Box>
                  <Box as="tbody">
                    {matrix.map((row) => (
                      <Box as="tr" key={row.district} borderTop="1px solid" borderColor={border}>
                        <Box as="td" py={2} pr={3} fontWeight="600" color={text} whiteSpace="nowrap">{row.district}</Box>
                        {analyticsLabels.map((l) => (
                          <Box as="td" key={l} py={2} px={2} textAlign="right" color={sub}>{fmt(row.byAnalytics[l])}</Box>
                        ))}
                        <Box as="td" py={2} pl={2} textAlign="right" fontWeight="800" color={accent}>{fmt(row.total)}</Box>
                      </Box>
                    ))}
                    {matrix.length > 0 && (
                      <Box as="tr" borderTop="2px solid" borderColor={border}>
                        <Box as="td" py={2} pr={3} fontWeight="800" textTransform="uppercase" color="#F59E0B">Total</Box>
                        {analyticsLabels.map((l) => (
                          <Box as="td" key={l} py={2} px={2} textAlign="right" fontWeight="700" color="#F59E0B">{fmt(matrixTotals[l])}</Box>
                        ))}
                        <Box as="td" py={2} pl={2} textAlign="right" fontWeight="800" color="#F59E0B">{fmt(matrixTotals.total)}</Box>
                      </Box>
                    )}
                    {matrix.length === 0 && (
                      <Box as="tr"><Box as="td" py={6} color={sub}>No data</Box></Box>
                    )}
                  </Box>
                </Box>
              </Box>
            </Panel>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default AiDashboard;
