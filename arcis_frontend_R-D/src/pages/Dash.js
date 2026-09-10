// src/pages/Dash.js
import React, { useEffect, useState, useRef } from "react";
import ReactApexChart from "react-apexcharts";
import {
  Box,
  Flex,
  Text,
  Grid,
  SimpleGrid,
  useColorModeValue,
} from "@chakra-ui/react";
import CustomCard from "../components/CustomCard";
import {
  TbCamera,
  TbWifi,
  TbWifiOff,
  TbActivity,
} from "react-icons/tb";
import { BsWifiOff, BsPlayCircleFill } from "react-icons/bs";

import {
  getUserCameraStats,
  getdistrictwiseAccess,
  getAllDistrictStatsForUser,
  getYourCameras,
} from "../actions/cameraActions";
import MobileHeader from "../components/MobileHeader";

const Dash = () => {
  // --- States ---
  const [totalCameras, setTotalCameras] = useState(0);
  const [onlineCameras, setOnlineCameras] = useState(0);
  const [offlineCameras, setOfflineCameras] = useState(0);
  const [isLiveCountValue, setIsLiveCountValue] = useState(0);

  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [allDistrictStats, setAllDistrictStats] = useState([]);
  const [offlineList, setOfflineList] = useState([]); // offline cameras (location + id)
  const [onlineList, setOnlineList] = useState([]); // online cameras (location + id)
  const [camView, setCamView] = useState("offline"); // "offline" | "online"

  // --- Theme Colors ---
  const cardBg = useColorModeValue("#FFFFFF", "#1C1A1A");
  const borderColor = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.08)");
  const headingColor = useColorModeValue("#1A2E3D", "#FFFFFF");
  const subtextColor = useColorModeValue("#64748B", "#94A3B8");
  const axisColor = useColorModeValue("#64748B", "#94A3B8");
  const gridColor = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.06)");
  const itemBorderColor = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.06)");
  const itemBg = useColorModeValue("#F0F5FA", "rgba(255, 255, 255, 0.04)");
  const itemHoverBg = useColorModeValue("#E7EFF7", "rgba(255, 255, 255, 0.07)");
  const liveBadgeBg = useColorModeValue("rgba(16, 185, 129, 0.1)", "rgba(16, 185, 129, 0.15)");
  const chartTheme = useColorModeValue("light", "dark");
  const isFetching = useRef(false);

  // Percentage calculation (safe divide-by-zero)
  const pct = (n) => (totalCameras > 0 ? Math.round((n / totalCameras) * 100) : 0);

  // --- Data Fetching ---
  const fetchData = async () => {
    const email = localStorage.getItem("email");
    if (!email || isFetching.current) return;

    isFetching.current = true;
    try {
      if (!selectedDistrict) {
        const res = await getUserCameraStats(email);
        if (res?.success && res.cameraStats) {
          const s = res.cameraStats;
          if (typeof s.totalCameras === "number") setTotalCameras(s.totalCameras);
          if (typeof s.onlineCameras === "number") setOnlineCameras(s.onlineCameras);
          if (typeof s.offlineCameras === "number") setOfflineCameras(s.offlineCameras);
          if (typeof s.isLiveCount === "number") setIsLiveCountValue(s.isLiveCount);
        }
      }

      const distRes = await getAllDistrictStatsForUser(email);
      if (distRes?.success && Array.isArray(distRes.data) && distRes.data.length > 0) {
        setAllDistrictStats(
          distRes.data.filter(
            (d) => (d.onlineCamera || 0) > 0 || (d.offlineCamera || 0) > 0
          )
        );
      }

      if (districts.length === 0) {
        const menuRes = await getdistrictwiseAccess(email);
        if (menuRes?.success && menuRes.matchedDistricts)
          setDistricts(menuRes.matchedDistricts);
      }

      // Online / Offline camera lists for the side panel
      const camList = await getYourCameras(email);
      if (Array.isArray(camList)) {
        const toRow = (c) => {
          const loc = c.locations?.[0];
          return {
            deviceId: c.deviceId || "N/A",
            location:
              (typeof loc === "string" ? loc : loc?.loc_name) ||
              c.name ||
              "N/A",
            district: c.dist_name || "",
            assembly: c.accName || "",
          };
        };
        const isOnline = (c) => c.status === true || c.status === "online";
        const byLoc = (a, b) => a.location.localeCompare(b.location);

        setOfflineList(camList.filter((c) => !isOnline(c)).map(toRow).sort(byLoc));
        setOnlineList(camList.filter(isOnline).map(toRow).sort(byLoc));
      }
    } catch (error) {
      console.error("Network error - retaining last known counts");
    } finally {
      isFetching.current = false;
    }
  };

  useEffect(() => {
    fetchData();
    const pollingInterval = setInterval(fetchData, 20000);
    return () => clearInterval(pollingInterval);
  }, [selectedDistrict]);

  const activeList = camView === "online" ? onlineList : offlineList;

  return (
    <Box
      w="100%"
      h={{ base: "auto", lg: "100%" }}
      display="flex"
      flexDirection="column"
      maxW={{ base: "100%", "2xl": "1920px" }}
      mx="auto"
      px={{ base: 3, sm: 4, md: 5, lg: 6, xl: 8, "2xl": 10 }}
      pt={{ base: 3, md: 3, lg: 4, "2xl": 5 }}
      pb={{ base: 6, md: 8, lg: 10, xl: 12, "2xl": 14 }}
      fontFamily="'Manrope', sans-serif"
    >
      <MobileHeader title="Dashboard" />

      {/* 1. VMS DASHBOARD CONTAINER (Header Row) */}
      <Flex
        justify="space-between"
        align="center"
        wrap="wrap"
        gap="8px"
        mb={{ base: "10px", md: "12px", lg: "clamp(8px, 1.5vh, 14px)", xl: "clamp(10px, 1.8vh, 16px)" }}
      >
        {/* Titles */}
        <Box>
          <Text
            fontFamily="'Manrope', sans-serif"
            fontWeight="800"
            fontSize={{ base: "18px", sm: "20px", md: "22px", xl: "24px", "2xl": "26px" }}
            lineHeight="1.2"
            letterSpacing="0px"
            color={headingColor}
          >
            VMS Dashboard
          </Text>
          <Text
            fontFamily="'Manrope', sans-serif"
            fontWeight="400"
            fontSize={{ base: "11px", sm: "12px", xl: "13px" }}
            lineHeight="1.4"
            letterSpacing="0px"
            color={subtextColor}
            mt="2px"
          >
            Real-time camera monitoring
          </Text>
        </Box>

        {/* Live Badge */}
        <Flex
          align="center"
          gap="6px"
          px={{ base: "8px", sm: "10px" }}
          py={{ base: "2px", sm: "3px" }}
          borderRadius="999px"
          bg={liveBadgeBg}
          userSelect="none"
        >
          <Box
            as="span"
            boxSize={{ base: "5px", sm: "6px" }}
            borderRadius="full"
            bg="#10B981"
            boxShadow="0 0 0 2px rgba(16, 185, 129, 0.25)"
          />
          <Text
            fontFamily="'Manrope', sans-serif"
            fontWeight="700"
            fontSize={{ base: "10px", sm: "11px" }}
            lineHeight="16.5px"
            letterSpacing="0.33px"
            color="#10B981"
            whiteSpace="nowrap"
          >
            Live · auto-refresh 20s
          </Text>
        </Flex>
      </Flex>

      {/* 2. KPI CONTAINER (4 Cards Grid) */}
      <SimpleGrid
        columns={{ base: 1, sm: 2, lg: 4 }}
        spacing={{ base: "10px", sm: "12px", md: "14px", lg: "clamp(12px, 1.8vh, 16px)", "2xl": "clamp(14px, 2vh, 20px)" }}
        mb={{ base: "12px", md: "14px", lg: "clamp(12px, 1.8vh, 16px)", "2xl": "clamp(14px, 2vh, 20px)" }}
      >
        <CustomCard
          title="TOTAL CAMERAS"
          value={totalCameras}
          color="#3F77A5"
          iconBg="#3F77A516"
          subtextColor="#3F77A5"
          IconComponent={TbCamera}
          subtitle="All regions"
        />
        <CustomCard
          title="ONLINE CAMERAS"
          value={onlineCameras}
          color="#10B981"
          iconBg="#10B98116"
          subtextColor="#10B981"
          IconComponent={TbWifi}
          subtitle={`${pct(onlineCameras)}% of total`}
        />
        <CustomCard
          title="OFFLINE CAMERAS"
          value={offlineCameras}
          color="#DB7B3A"
          iconBg="#DB7B3A16"
          subtextColor="#DB7B3A"
          IconComponent={TbWifiOff}
          subtitle={`${pct(offlineCameras)}% of total`}
        />
        <CustomCard
          title="CONNECTED CAMERAS"
          value={isLiveCountValue}
          color="#F59E0B"
          iconBg="#F59E0B16"
          subtextColor="#F59E0B"
          IconComponent={TbActivity}
          subtitle={`${pct(isLiveCountValue)}% of total`}
        />
      </SimpleGrid>

      {/* 3. ANALYTICS CONTAINER (2 Column Grid) */}
      <Grid
        flex="1"
        minHeight="0"
        templateColumns={{ base: "1fr", lg: "1fr 1fr" }}
        gap={{ base: "12px", md: "14px", lg: "clamp(12px, 2vh, 16px)", "2xl": "clamp(16px, 2.5vh, 20px)" }}
        alignItems="stretch"
      >
        {/* CARD 1: CAMERA STATUS (Horizontal Bar Chart) */}
        <Box
          bg={cardBg}
          p={{ base: "14px", md: "16px", "2xl": "clamp(16px, 2vh, 20px)" }}
          borderRadius="14px"
          borderWidth="1px"
          borderStyle="solid"
          borderColor={borderColor}
          boxShadow="0px 1px 6px 0px rgba(26, 46, 61, 0.07)"
          display="flex"
          flexDirection="column"
          height="100%"
        >
          <Box mb="6px">
            <Text
              fontFamily="'Manrope', sans-serif"
              fontWeight="700"
              fontSize={{ base: "14px", md: "15px", "2xl": "17px" }}
              lineHeight="22.5px"
              letterSpacing="0px"
              color={headingColor}
            >
              Camera Status
            </Text>
            <Text
              fontFamily="'Manrope', sans-serif"
              fontWeight="400"
              fontSize={{ base: "11px", md: "12px", "2xl": "13px" }}
              lineHeight="18px"
              letterSpacing="0px"
              color={subtextColor}
              mt="2px"
            >
              Total, online and offline cameras
            </Text>
          </Box>

          <Box flex="1" minHeight="0" width="100%">
            <ReactApexChart
              type="bar"
              height="100%"
              series={[
                {
                  name: "Cameras",
                  data: [totalCameras, onlineCameras, offlineCameras],
                },
              ]}
              options={{
                chart: {
                  type: "bar",
                  toolbar: { show: false },
                  background: "transparent",
                  fontFamily: "'Manrope', sans-serif",
                  animations: { easing: "easeinout", speed: 500 },
                  parentHeightOffset: 0,
                },
                theme: { mode: chartTheme },
                plotOptions: {
                  bar: {
                    horizontal: true,
                    distributed: true,
                    borderRadius: 6,
                    borderRadiusApplication: "end",
                    barHeight: "45%",
                    dataLabels: { position: "center" },
                  },
                },
                colors: ["#3F77A5", "#10B981", "#DB7B3A"],
                dataLabels: {
                  enabled: false,
                },
                xaxis: {
                  categories: ["Total", "Online", "Offline"],
                  min: 0,
                  max: Math.max(totalCameras, 4),
                  tickAmount: Math.min(Math.max(totalCameras, 2), 6),
                  forceNiceScale: true,
                  decimalsInFloat: 0,
                  labels: {
                    style: {
                      colors: axisColor,
                      fontSize: "11px",
                      fontFamily: "'Manrope', sans-serif",
                    },
                    formatter: (v) => {
                      const num = typeof v === "number" ? v : parseFloat(v);
                      if (!isNaN(num) && Number.isInteger(num)) {
                        return num.toString();
                      }
                      return "";
                    },
                  },
                  axisBorder: { show: false },
                  axisTicks: { show: false },
                },
                yaxis: {
                  labels: {
                    style: {
                      colors: [axisColor, axisColor, axisColor],
                      fontSize: "12px",
                      fontWeight: 600,
                      fontFamily: "'Manrope', sans-serif",
                    },
                  },
                },
                grid: {
                  padding: {
                    top: -16,
                    bottom: 0,
                    left: 8,
                    right: 12,
                  },
                  borderColor: gridColor,
                  strokeDashArray: 3,
                  xaxis: { lines: { show: true } },
                  yaxis: { lines: { show: false } },
                },
                legend: {
                  show: true,
                  position: "bottom",
                  horizontalAlign: "center",
                  markers: { radius: 3, width: 10, height: 10 },
                  fontSize: "12px",
                  fontWeight: 600,
                  fontFamily: "'Manrope', sans-serif",
                  labels: { colors: axisColor },
                  itemMargin: { horizontal: 10, vertical: 4 },
                },
                tooltip: {
                  theme: chartTheme,
                  y: { formatter: (v) => (v ?? 0).toLocaleString("en-IN") },
                },
                responsive: [
                  {
                    breakpoint: 600,
                    options: {
                      plotOptions: { bar: { barHeight: "52%" } },
                      xaxis: { labels: { style: { fontSize: "10px" } } },
                      yaxis: { labels: { style: { fontSize: "11px" } } },
                      legend: { fontSize: "11px", itemMargin: { horizontal: 6, vertical: 2 } },
                    },
                  },
                ],
              }}
            />
          </Box>
        </Box>

        {/* CARD 2: OFFLINE / ONLINE CAMERAS LIST */}
        <Box
          bg={cardBg}
          p={{ base: "14px", md: "16px", "2xl": "clamp(16px, 2vh, 20px)" }}
          borderRadius="14px"
          borderWidth="1px"
          borderStyle="solid"
          borderColor={borderColor}
          boxShadow="0px 1px 6px 0px rgba(26, 46, 61, 0.07)"
          display="flex"
          flexDirection="column"
          height="100%"
        >
          {/* Header Row with Toggle Badges */}
          <Flex justify="space-between" align="center" mb={{ base: "8px", md: "10px", "2xl": "12px" }} wrap="wrap" gap="8px">
            <Text
              fontFamily="'Manrope', sans-serif"
              fontWeight="700"
              fontSize={{ base: "14px", md: "15px", "2xl": "17px" }}
              lineHeight="22.5px"
              letterSpacing="0px"
              color={headingColor}
            >
              {camView === "online" ? "Online Cameras" : "Offline Cameras"}
            </Text>

            {/* Offline & Online toggle badges */}
            <Flex align="center" gap="6px">
              {/* Offline Badge Button */}
              <Box
                as="button"
                onClick={() => setCamView("offline")}
                px={{ base: "8px", sm: "10px" }}
                py={{ base: "2px", sm: "3px" }}
                borderRadius="999px"
                cursor="pointer"
                transition="all 0.15s ease"
                bg={camView === "offline" ? "rgba(239, 68, 68, 0.1)" : "transparent"}
                border="1px solid"
                borderColor={camView === "offline" ? "#DB7B3A" : "transparent"}
                color="#DB7B3A"
                fontFamily="'Manrope', sans-serif"
                fontWeight="700"
                fontSize={{ base: "10px", sm: "11px" }}
                lineHeight="16.5px"
                letterSpacing="0.33px"
                _hover={{ bg: "rgba(239, 68, 68, 0.15)" }}
              >
                Offline {offlineList.length}
              </Box>

              {/* Online Badge Button */}
              <Box
                as="button"
                onClick={() => setCamView("online")}
                px={{ base: "8px", sm: "10px" }}
                py={{ base: "2px", sm: "3px" }}
                borderRadius="999px"
                cursor="pointer"
                transition="all 0.15s ease"
                bg={camView === "online" ? "rgba(16, 185, 129, 0.1)" : "transparent"}
                border="1px solid"
                borderColor={camView === "online" ? "#10B981" : "transparent"}
                color="#10B981"
                fontFamily="'Manrope', sans-serif"
                fontWeight="700"
                fontSize={{ base: "10px", sm: "11px" }}
                lineHeight="16.5px"
                letterSpacing="0.33px"
                _hover={{ bg: "rgba(16, 185, 129, 0.15)" }}
              >
                Online {onlineList.length}
              </Box>
            </Flex>
          </Flex>

          {/* Locations List (Scrollable if more than 5 cameras) */}
          <Box
            flex="1"
            minHeight="0"
            overflowY="auto"
            display="flex"
            flexDirection="column"
            gap={{ base: "6px", md: "8px" }}
            pr="4px"
            css={{
              "&::-webkit-scrollbar": { width: "4px" },
              "&::-webkit-scrollbar-thumb": {
                background: "rgba(100, 116, 139, 0.3)",
                borderRadius: "4px",
              },
            }}
          >
            {activeList.length === 0 ? (
              <Flex
                direction="column"
                align="center"
                justify="center"
                h="130px"
                gap={2}
                color={subtextColor}
              >
                <Box
                  as={camView === "online" ? BsWifiOff : BsPlayCircleFill}
                  boxSize="24px"
                  color={camView === "online" ? "#DB7B3A" : "#10B981"}
                />
                <Text fontSize="13px" fontWeight="500">
                  {camView === "online"
                    ? "No online cameras found"
                    : "No offline cameras found"}
                </Text>
              </Flex>
            ) : (
              activeList.map((cam, i) => (
                <Flex
                  key={`${cam.deviceId}-${i}`}
                  minH={{ base: "44px", md: "48px", "2xl": "52px" }}
                  px={{ base: "10px", md: "12px", "2xl": "14px" }}
                  py={{ base: "6px", md: "7px" }}
                  borderRadius="9px"
                  borderWidth="1px"
                  borderStyle="solid"
                  borderColor={itemBorderColor}
                  bg={itemBg}
                  justify="space-between"
                  align="center"
                  transition="background 0.15s ease"
                  _hover={{
                    bg: itemHoverBg,
                  }}
                >
                  {/* Left Column: Location & Device ID */}
                  <Box minW="0" pr={2}>
                    <Text
                      fontFamily="'Manrope', sans-serif"
                      fontWeight="600"
                      fontSize={{ base: "12px", md: "13px", "2xl": "14px" }}
                      lineHeight="1.3"
                      letterSpacing="0px"
                      color={headingColor}
                      isTruncated
                      title={cam.location}
                    >
                      {cam.location}
                    </Text>
                    <Text
                      fontFamily="'Manrope', sans-serif"
                      fontWeight="400"
                      fontSize={{ base: "10px", md: "11px", "2xl": "12px" }}
                      lineHeight="1.3"
                      letterSpacing="0px"
                      color={subtextColor}
                      isTruncated
                      title={cam.deviceId}
                    >
                      {cam.deviceId}
                    </Text>
                  </Box>

                  {/* Right Column: Status Dot & Badge */}
                  <Flex align="center" gap={{ base: "4px", md: "5px" }} flexShrink={0} ml={2}>
                    <Box
                      boxSize={{ base: "7px", md: "8px" }}
                      borderRadius="full"
                      bg={camView === "online" ? "#10B981" : "#DB7B3A"}
                    />
                    <Text
                      fontFamily="'Manrope', sans-serif"
                      fontWeight="700"
                      fontSize={{ base: "9px", md: "10px", "2xl": "11px" }}
                      lineHeight="1"
                      letterSpacing="0px"
                      color={camView === "online" ? "#10B981" : "#DB7B3A"}
                    >
                      {camView === "online" ? "ONLINE" : "OFFLINE"}
                    </Text>
                  </Flex>
                </Flex>
              ))
            )}
          </Box>
        </Box>
      </Grid>
    </Box>
  );
};

export default Dash;
