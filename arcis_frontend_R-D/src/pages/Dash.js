// src/pages/Dash.js
import React, { useEffect, useState, useRef } from "react";
import ReactApexChart from "react-apexcharts";
import {
  Box,
  Button,
  Grid,
  Text,
  VStack,
  useColorModeValue,
  Flex,
  Heading,
  SimpleGrid,
  Menu,
  MenuButton,
  MenuList,
  MenuItem
} from "@chakra-ui/react";
import { ChevronDownIcon } from "@chakra-ui/icons";
import CustomCard from "../components/CustomCard";
import {
  BsCameraVideoFill,
  BsPlayCircleFill,
  BsWifiOff,
  BsHddNetwork
} from "react-icons/bs";
import DistrictBarChart from "../components/CameraStatusChart";

import {
  getUserCameraStats,
  getdistrictwiseAccess,
  getDistrictCameraStats,
  getAllDistrictStatsForUser,
  getAssemblyCameraStats,
  getYourCameras,
} from "../actions/cameraActions";
import MobileHeader from "../components/MobileHeader";

/* ✅ UPDATED FOR ONLINE / INACTIVE */
const getRadialChartOptions = (online, inactive, centerTextColor) => ({
  chart: {
    type: "radialBar",
    sparkline: { enabled: true }
  },
  plotOptions: {
    radialBar: {
      dataLabels: {
        total: {
          show: true,
          fontSize: "11px",
          formatter: () => `${online}/${inactive}`,
          color: centerTextColor
        }
      },
      track: {
        background: "#EDF2F7",
        strokeWidth: "95%"
      }
    }
  },
  labels: ["Online", "Inactive"], // Changed label back to Online
  colors: [
    online > 0 ? "#65A30D" : "transparent", // Green for Online
    inactive > 0 ? "#EF4444" : "transparent"   // Red for Inactive
  ],
  stroke: {
    lineCap: online > 0 && inactive > 0 ? "round" : "butt"
  }
});

const Dash = () => {
  // --- States ---
  const [totalCameras, setTotalCameras] = useState(0);
  const [onlineCameras, setOnlineCameras] = useState(0);
  const [offlineCameras, setOfflineCameras] = useState(0);
  const [isLiveCountValue, setIsLiveCountValue] = useState(0);

  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [allDistrictStats, setAllDistrictStats] = useState([]);
  const [assemblyChartData, setAssemblyChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [rotationIndex, setRotationIndex] = useState(0);
  const [offlineList, setOfflineList] = useState([]); // offline cameras (location + id)
  const [onlineList, setOnlineList] = useState([]); // online cameras (location + id)
  const [camView, setCamView] = useState("offline"); // "offline" | "online"

  // --- Theme Colors ---
  const cardBorderColor = useColorModeValue("gray.200", "whiteAlpha.400");
  const chartBg = useColorModeValue("#FFFFFF", "gray.800");
  const chartBorder = useColorModeValue("rgba(226,232,240,0.9)", "whiteAlpha.200");
  const textColor = useColorModeValue("gray.500", "gray.400");
  const headingColor = useColorModeValue("gray.800", "white");
  const chartCenterTextColor = useColorModeValue("#1A202C", "#F7FAFC");
  const cardBg = useColorModeValue("white", "gray.800");
  const subTextColor = useColorModeValue("gray.600", "gray.300");
  const pillBg = useColorModeValue("white", "gray.800");
  const pillBorder = useColorModeValue("rgba(226,232,240,0.9)", "whiteAlpha.200");
  const rowHoverBg = useColorModeValue("gray.50", "whiteAlpha.100");
  const axisColor = useColorModeValue("#64748B", "#94A3B8");
  const gridColor = useColorModeValue("#E2E8F0", "#2D3748");
  const chartTheme = useColorModeValue("light", "dark");
  const isFetching = useRef(false);

  // Percentage of total cameras (guards divide-by-zero)
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
          if (typeof s.totalCameras === 'number') setTotalCameras(s.totalCameras);
          if (typeof s.onlineCameras === 'number') setOnlineCameras(s.onlineCameras);
          if (typeof s.offlineCameras === 'number') setOfflineCameras(s.offlineCameras);
          if (typeof s.isLiveCount === 'number') setIsLiveCountValue(s.isLiveCount);
        }
      }

      const distRes = await getAllDistrictStatsForUser(email);
      if (distRes?.success && Array.isArray(distRes.data) && distRes.data.length > 0) {
        setAllDistrictStats(distRes.data.filter(d => (d.onlineCamera || 0) > 0 || (d.offlineCamera || 0) > 0));
      }

      if (districts.length === 0) {
        const menuRes = await getdistrictwiseAccess(email);
        if (menuRes?.success && menuRes.matchedDistricts) setDistricts(menuRes.matchedDistricts);
      }

      // Online / Offline camera lists (location + device id) for the side panel
      const camList = await getYourCameras(email);
      if (Array.isArray(camList)) {
        const toRow = (c) => {
          const loc = c.locations?.[0];
          return {
            deviceId: c.deviceId || "N/A",
            location: (typeof loc === "string" ? loc : loc?.loc_name) || c.name || "N/A",
            district: c.dist_name || "",
            assembly: c.accName || "",
          };
        };
        // Mirror the server's definition: online === stream.status === true.
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

  useEffect(() => {
    let interval;
    if (allDistrictStats.length > 0) {
      interval = setInterval(() => {
        setRotationIndex(prev => (prev + 1) % allDistrictStats.length);
      }, 20000);
    }
    return () => clearInterval(interval);
  }, [allDistrictStats]);

  const handleDistrictSelect = async district => {
    setSelectedDistrict(district);
    const email = localStorage.getItem("email");

    if (!district) {
      setAssemblyChartData([]);
      fetchData(); 
      return;
    }

    try {
      setIsLoading(true);
      // NOTE: Do NOT update the top cards here. The four top cards always show the
      // overall (all-region) totals. Selecting a district only updates the
      // assembly gauge charts below.
      const asmRes = await getAssemblyCameraStats(email, district.dist_name);
      if (asmRes?.success && asmRes.assemblies) {
        setAssemblyChartData(asmRes.assemblies.filter(a => a.onlineCamera + a.offlineCamera > 0));
      }
    } catch (e) {
      console.error("District fetch failed - retaining counts");
    } finally {
      setIsLoading(false);
    }
  };

  // Sidebar calculation
  const currentSidebarData = allDistrictStats.length > 0 ? allDistrictStats[rotationIndex] : null;

  const displayDistName = currentSidebarData
    ? currentSidebarData.districtName
    : selectedDistrict ? selectedDistrict.dist_name : "All Districts";

  const displayTotal = currentSidebarData
    ? currentSidebarData.totalCameras || (currentSidebarData.onlineCamera + currentSidebarData.offlineCamera)
    : totalCameras;

  const displayOnline = currentSidebarData ? currentSidebarData.onlineCamera : onlineCameras;
  const displayConnected = currentSidebarData ? currentSidebarData.isLiveCount : isLiveCountValue;
  const displayInactive = displayTotal - displayConnected;

  return (
    <Box maxW="1600px" mx="auto" pt={{ base: "70px", md: "0" }} mb={{ base: "100px", md: "5" }} px={{ base: 2, md: 0 }}>
      <MobileHeader title="Dashboard" />

      {/* Top Cards */}
      <Box mt={{ base: 4, md: 0 }} mb={5}>
        <Flex justify="space-between" align={{ base: "flex-start", md: "center" }} mb={4} direction={{ base: "column", md: "row" }} gap={2}>
          <Box>
            <Text fontWeight={700} fontSize="28px" color={headingColor} lineHeight="1.2"> VMS Dashboard</Text>
            <Text fontSize="14px" color={textColor}>Real-time  camera monitoring </Text>
          </Box>
          <Flex align="center" gap={2} bg={pillBg} px={3} py={1.5} borderRadius="full" border="1px solid" borderColor={pillBorder}>
            <Box as="span" boxSize="8px" borderRadius="full" bg="#22C55E" boxShadow="0 0 0 3px rgba(34,197,94,0.2)" />
            <Text fontSize="12px" fontWeight="600" color={textColor}>Live · auto-refresh 20s</Text>
          </Flex>
        </Flex>

        <Grid templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }} gap={4}>
          <CustomCard title="Total Cameras" value={totalCameras} color="#1C4ED8" IconComponent={BsCameraVideoFill} layout="vertical" subtitle="All regions" />
          <CustomCard title="Online Cameras" value={onlineCameras} color="#16A34A" IconComponent={BsPlayCircleFill} layout="vertical" subtitle={`${pct(onlineCameras)}% of total`} />
          <CustomCard title="Offline Cameras" value={offlineCameras} color="#EF4444" IconComponent={BsWifiOff} layout="vertical" subtitle={`${pct(offlineCameras)}% of total`} />
          <CustomCard title="Connected Cameras" value={isLiveCountValue} color="#8B5CF6" IconComponent={BsHddNetwork} layout="vertical" subtitle={`${pct(isLiveCountValue)}% of total`} />
        </Grid>
      </Box>

      {/* Main Content */}
      <Grid templateColumns={{ base: "1fr", lg: "60% 1fr" }} gap={4} alignItems="stretch">
        <Box
          bg={chartBg}
          p={{ base: 4, md: 6 }}
          borderRadius="16px"
          border="1px solid"
          borderColor={chartBorder}
          boxShadow={useColorModeValue("0 1px 3px rgba(0,0,0,0.06)", "dark-lg")}
        >
          <Flex justify="space-between" align="center" mb={5} wrap="wrap" gap={2}>
            <Box>
              <Text fontSize="lg" fontWeight="700" color={headingColor}> Camera Status</Text>
              <Text fontSize="13px" color={textColor}>Total, online and offline cameras </Text>
            </Box>
          </Flex>
          <Box width="100%" height={{ base: "260px", md: "300px" }}>
            <ReactApexChart
              type="bar"
              height="100%"
              series={[{ name: "Cameras", data: [totalCameras, onlineCameras, offlineCameras] }]}
              options={{
                chart: { type: "bar", toolbar: { show: false }, background: "transparent", fontFamily: "inherit", animations: { easing: "easeinout", speed: 600 } },
                theme: { mode: chartTheme },
                plotOptions: {
                  bar: {
                    horizontal: true,
                    distributed: true,
                    borderRadius: 8,
                    borderRadiusApplication: "end",
                    barHeight: "55%",
                    dataLabels: { position: "center" },
                  },
                },
                colors: ["#1C4ED8", "#16A34A", "#EF4444"],
                dataLabels: {
                  enabled: true,
                  style: { fontSize: "13px", fontWeight: 800, colors: ["#fff"] },
                  formatter: (v) => (v ?? 0).toLocaleString("en-IN"),
                },
                xaxis: {
                  categories: ["Total", "Online", "Offline"],
                  labels: { style: { colors: axisColor, fontSize: "11px" }, formatter: (v) => Math.round(v) },
                  axisBorder: { show: false },
                  axisTicks: { show: false },
                },
                yaxis: { labels: { style: { colors: axisColor, fontSize: "13px", fontWeight: 700 } } },
                grid: { borderColor: gridColor, strokeDashArray: 4, xaxis: { lines: { show: true } }, yaxis: { lines: { show: false } } },
                legend: {
                  show: true,
                  position: "bottom",
                  markers: { radius: 12 },
                  fontSize: "12px",
                  fontWeight: 600,
                  labels: { colors: axisColor },
                  itemMargin: { horizontal: 12 },
                },
                tooltip: { theme: chartTheme, y: { formatter: (v) => (v ?? 0).toLocaleString("en-IN") } },
              }}
            />
          </Box>
        </Box>

        {/* Offline cameras list */}
        <Box
          bg={chartBg}
          borderRadius="16px"
          border="1px solid"
          borderColor={chartBorder}
          boxShadow={useColorModeValue("0 1px 3px rgba(0,0,0,0.06)", "dark-lg")}
          display="flex"
          flexDirection="column"
          overflow="hidden"
        >
          <Flex align="center" justify="space-between" p={4} borderBottom="1px solid" borderColor={chartBorder} gap={2} wrap="wrap">
            <Flex align="center" gap={2}>
              <Box color={camView === "online" ? "#16A34A" : "#EF4444"} as={camView === "online" ? BsPlayCircleFill : BsWifiOff} boxSize="18px" />
              <Text fontSize="md" fontWeight="700" color={headingColor}>
                {camView === "online" ? "Online Cameras" : "Offline Cameras"}
              </Text>
            </Flex>

            {/* Online / Offline toggle */}
            <Flex bg={rowHoverBg} borderRadius="full" p="3px" gap="3px">
              <Box as="button" onClick={() => setCamView("offline")} px={3} py={1} borderRadius="full"
                fontSize="11px" fontWeight="700" transition="all 0.15s"
                bg={camView === "offline" ? "#EF4444" : "transparent"}
                color={camView === "offline" ? "white" : textColor}>
                Offline {offlineList.length}
              </Box>
              <Box as="button" onClick={() => setCamView("online")} px={3} py={1} borderRadius="full"
                fontSize="11px" fontWeight="700" transition="all 0.15s"
                bg={camView === "online" ? "#16A34A" : "transparent"}
                color={camView === "online" ? "white" : textColor}>
                Online {onlineList.length}
              </Box>
            </Flex>
          </Flex>

          <Box overflowY="auto" maxH={{ base: "260px", md: "300px" }} px={2} py={2} flex="1"
            css={{ "&::-webkit-scrollbar": { width: "6px" }, "&::-webkit-scrollbar-thumb": { background: "rgba(150,150,150,0.4)", borderRadius: "3px" } }}>
            {(camView === "online" ? onlineList : offlineList).length === 0 ? (
              <Flex direction="column" align="center" justify="center" h="100%" py={8} gap={2} color={textColor}>
                <Box as={camView === "online" ? BsWifiOff : BsPlayCircleFill} boxSize="26px" color={camView === "online" ? "#EF4444" : "#16A34A"} />
                <Text fontSize="sm">{camView === "online" ? "No cameras online" : "All cameras are online"}</Text>
              </Flex>
            ) : (
              (camView === "online" ? onlineList : offlineList).map((cam, i) => (
                <Flex
                  key={`${cam.deviceId}-${i}`}
                  align="center"
                  justify="space-between"
                  gap={2}
                  px={3}
                  py={2.5}
                  borderRadius="10px"
                  _hover={{ bg: rowHoverBg }}
                >
                  <Box minW={0}>
                    <Text fontSize="13px" fontWeight="600" color={headingColor} isTruncated title={cam.location}>
                      {cam.location}
                    </Text>
                    <Text fontSize="11px" color={textColor} isTruncated title={cam.deviceId}>
                      {cam.deviceId}
                    </Text>
                  </Box>
                  <Box boxSize="8px" borderRadius="full" bg={camView === "online" ? "#16A34A" : "#EF4444"} flexShrink={0} />
                </Flex>
              ))
            )}
          </Box>
        </Box>
      </Grid>

      {/* Assembly Section */}
      {/* <Box borderWidth="1px" borderRadius="md" p={3} mb={2} bg={cardBg} shadow="sm">
        <Flex align="center" justify="space-between" wrap="wrap" gap={2}>
          <Text fontSize={{ base: "md", md: "lg" }} fontWeight="bold" color={textColor}>All Assembly Status</Text>
          <Menu>
            <MenuButton as={Button} rightIcon={<ChevronDownIcon />} size="sm" variant="outline" minW="140px">
              {selectedDistrict ? selectedDistrict.dist_name : "Select District"}
            </MenuButton>
            <MenuList maxH="300px" overflowY="auto" bg={cardBg} borderColor={cardBorderColor} zIndex="dropdown">
              <MenuItem onClick={() => handleDistrictSelect(null)}>All Districts</MenuItem>
              {districts.map((d, i) => (
                <MenuItem key={i} onClick={() => handleDistrictSelect(d)}>{d.dist_name}</MenuItem>
              ))}
            </MenuList>
          </Menu>
        </Flex>
      </Box> */}

      {/* <Box bg={chartBg} p={2} borderRadius="16px">
        {selectedDistrict && (
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 5 }} spacing={2}>
            {assemblyChartData.map((asm, index) => {
              const asmTotal = asm.onlineCamera + asm.offlineCamera;
              const asmOnline = asm.onlineCamera || 0;
              const asmConnected = asm.isLiveCount || 0;
              const asmInactive = asmTotal - asmConnected;

              return (
                <VStack key={index} bg={cardBg} p={2} borderRadius="20px" shadow="sm" border="1px solid" borderColor="gray.100" color={subTextColor}>
                  <Text fontWeight="800" fontSize="xs" textAlign="center" mb={-2}>{asm.assemblyName}</Text>
                  <Box w="100%" h="180px">
                    <ReactApexChart
                      options={getRadialChartOptions(
                        asmOnline, // Using Online data
                        asmInactive, // Using Calculated Inactive data
                        chartCenterTextColor
                      )}
                      series={[
                        asmTotal === 0 ? 0 : Math.round((asmOnline / asmTotal) * 100),
                        asmTotal === 0 ? 0 : Math.round((asmInactive / asmTotal) * 100)
                      ]}
                      type="radialBar"
                      height="100%"
                    />
                  </Box>
                </VStack>
              );
            })}
          </SimpleGrid>
        )}
      </Box> */}
    </Box>
  );
};

export default Dash;
