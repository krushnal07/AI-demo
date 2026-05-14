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

  // --- Theme Colors ---
  const cardBorderColor = useColorModeValue("gray.200", "whiteAlpha.400");
  const chartBg = useColorModeValue("#F7FAFC", "gray.700");
  const textColor = useColorModeValue("gray.500", "gray.400");
  const chartCenterTextColor = useColorModeValue("#1A202C", "#F7FAFC");
  const cardBg = useColorModeValue("white", "gray.800");
  const subTextColor = useColorModeValue("gray.600", "gray.300");
  const isFetching = useRef(false);

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
      const cardRes = await getDistrictCameraStats(email, district.districtAssemblyCode);
      if (cardRes?.success && cardRes.data) {
        setTotalCameras(cardRes.data.totalCamera ?? totalCameras);
        setOnlineCameras(cardRes.data.onlineCamera ?? onlineCameras);
        setOfflineCameras(cardRes.data.offlineCamera ?? offlineCameras);
        setIsLiveCountValue(cardRes.data.isLiveCount ?? isLiveCountValue);
      }

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
      <MobileHeader title="FSV Dashboard" />

      {/* Top Cards */}
      <Box mt={{ base: 4, md: 0 }} mb={4}>
        <Flex justify="space-between" align="center" mb={2}>
          <Text fontWeight={400} fontSize="26px" color={textColor}>Dashboard</Text>
        </Flex>

        <Grid templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }} gap={3}>
          <CustomCard title="Total Cameras" value={totalCameras} color="#1C4ED8" IconComponent={BsCameraVideoFill} layout="vertical" />
          <CustomCard title="Online Cameras" value={onlineCameras} color="#65A30D" IconComponent={BsPlayCircleFill} layout="vertical" />
          <CustomCard title="Inactive Cameras" value={totalCameras - isLiveCountValue} color="#EF4444" IconComponent={BsWifiOff} layout="vertical" />
          <CustomCard title="Installed Cameras" value={isLiveCountValue} color="#8B5CF6" IconComponent={BsHddNetwork} layout="vertical" />
        </Grid>
      </Box>

      {/* Main Content */}
      <Grid templateColumns={{ base: "1fr", lg: "70% 28%" }} gap={2}>
        <Box bg={chartBg} p={6} borderRadius="16px">
          <Text fontSize="lg" fontWeight="bold" color={textColor} mb={6}>District wise FSV Camera Status</Text>
          <Box width="100%" height="400px">
            <DistrictBarChart chartData={allDistrictStats} />
          </Box>
        </Box>

        <Box bg={chartBg} p={6} borderRadius="16px" height="fit-content">
          <Heading size="md" mb={4} color={textColor}>{displayDistName}</Heading>
          <VStack spacing={2} align="stretch">
            <CustomCard title="Total" value={displayTotal} color="#1C4ED8" IconComponent={BsCameraVideoFill} layout="horizontal" />
            <CustomCard title="Online" value={displayOnline} color="#65A30D" IconComponent={BsPlayCircleFill} layout="horizontal" />
            <CustomCard title="Inactive" value={displayInactive} color="#EF4444" IconComponent={BsWifiOff} layout="horizontal" />
            <CustomCard title="Installed" value={displayConnected} color="#8B5CF6" IconComponent={BsHddNetwork} layout="horizontal" />
          </VStack>
        </Box>
      </Grid>

      {/* Assembly Section */}
      <Box borderWidth="1px" borderRadius="md" p={3} mb={2} bg={cardBg} shadow="sm">
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
      </Box>

      <Box bg={chartBg} p={2} borderRadius="16px">
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
      </Box>
    </Box>
  );
};

export default Dash;