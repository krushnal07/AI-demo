import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Flex,
  Grid,
  Icon,
  Text,
  VStack,
  HStack,
  Collapse,
  Button,
  useColorModeValue,
  Center,
  Spinner,
  Alert,
  AlertIcon,
  SimpleGrid,
  GridItem,
  IconButton
} from "@chakra-ui/react";
import {
  FaRegPlayCircle,
  FaChevronDown,
  FaChevronUp,
  FaSort,
  FaSortUp,
  FaSortDown
} from "react-icons/fa";
import axios from "axios";

const BASE_URL = `${process.env.REACT_APP_URL}/api/camera`;

const Dashboard = () => {
  const userEmail = localStorage.getItem("email");

  const [filterType, setFilterType] = useState("All");
  const [globalStats, setGlobalStats] = useState({ total: 0, online: 0, offline: 0, live: 0 });
  const [districtData, setDistrictData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [loadingAssemblies, setLoadingAssemblies] = useState({});
  const tabTextColor = useColorModeValue("black", "white");

  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const text = useColorModeValue('gray.500', 'gray.400');
  const userThemeColor = useColorModeValue("#CDDEEB", "#1a202c");
  const tableHeaderBg = useColorModeValue(
    "linear-gradient(93.5deg,#CDDEEB ,  #9CBAD2 94.58%)"
    , // light mode
    "linear-gradient(93.5deg, #2A2A2A 0.56%, #030711 50.58%)");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const activeTabBg = useColorModeValue(
    "linear-gradient(94deg, #9CBAD2 0.56%, #CDDEEB 94.58%)",
    "linear-gradient(to bottom, rgba(22, 59, 116, 0.60) 0%, rgba(3, 7, 17, 0.60) 100%)"
  );

  // Helper for retrying API calls
  const withRetry = async (fn, retries = 3, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  };

  const fetchAllData = useCallback(async (isInitial = false) => {
    if (!userEmail) return;

    try {
      if (isInitial) setLoading(true);
      setError(null);

      const res = await withRetry(() => axios.get(`${BASE_URL}/getUserCameraStats1`, {
        params: { email: userEmail, locationType: filterType }
      }));

      if (res.data.success) {
        const stats = res.data.cameraStats;
        setGlobalStats({
          total: stats.totalCameras,
          online: stats.onlineCameras,
          offline: stats.offlineCameras,
          live: stats.isLiveCount
        });

        const districtsFromBackend = res.data.districts || [];
        const initialData = districtsFromBackend.map(d => ({
          name: d.dist_name,
          code: d.districtAssemblyCode,
          stats: null,
          assemblies: null
        }));

        setDistrictData(initialData);
        fetchStatsForEveryDistrict(initialData, filterType);
      }
    } catch (err) {
      console.error("Dashboard Load Error:", err);
      const msg = err.response?.data?.message || "Failed to load dashboard data. Please check your connection.";
      setError(msg);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [userEmail, filterType]);

  useEffect(() => {
    fetchAllData(true);
    const interval = setInterval(() => {
      fetchAllData(false);
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const fetchStatsForEveryDistrict = (districtsList, currentFilter) => {
    const batchSize = 5;
    const processBatch = async (index) => {
      if (index >= districtsList.length) return;
      const batch = districtsList.slice(index, index + batchSize);

      await Promise.all(batch.map(async (dist) => {
        try {
          const res = await withRetry(() => axios.get(`${BASE_URL}/districtcamerastats`, {
            params: { email: userEmail, districtCode: dist.code, locationType: currentFilter }
          }));
          if (res.data.success && res.data.data) {
            const data = res.data.data;
            setDistrictData(prevData => prevData.map(item =>
              item.code === dist.code ? {
                ...item,
                stats: { total: data.totalCamera, online: data.onlineCamera, offline: data.offlineCamera, connected: data.isLiveCount }
              } : item
            ));
          }
        } catch (err) {
          console.error(`Error fetching stats for district ${dist.name}:`, err);
        }
      }));

      processBatch(index + batchSize);
    };

    processBatch(0);
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return districtData;
    return [...districtData].sort((a, b) => {
      let aVal, bVal;

      if (sortConfig.key === 'name') {
        aVal = a.name || "";
        bVal = b.name || "";
        return sortConfig.direction === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      } else if (sortConfig.key === 'inactive') {
        // Special logic for sorting Inactive (Total - Connected)
        aVal = a.stats ? (a.stats.total - a.stats.connected) : -1;
        bVal = b.stats ? (b.stats.total - b.stats.connected) : -1;
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      } else {
        aVal = a.stats ? a.stats[sortConfig.key] : -1;
        bVal = b.stats ? b.stats[sortConfig.key] : -1;
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });
  }, [districtData, sortConfig]);

  const toggleRow = async (districtName) => {
    const isExpanding = !expandedRows[districtName];
    setExpandedRows(prev => ({ ...prev, [districtName]: isExpanding }));
    const district = districtData.find(d => d.name === districtName);
    if (isExpanding && district && !district.assemblies) {
      setLoadingAssemblies(prev => ({ ...prev, [districtName]: true }));
      try {
        const res = await axios.get(`${BASE_URL}/getAssemblyCameraStats`, {
          params: { email: userEmail, dist_name: districtName, locationType: filterType }
        });

        if (res.data.success) {
          const assemblyList = res.data.assemblies.map(a => ({
            name: a.assemblyName,
            stats: { total: a.totalCamera, online: a.onlineCamera, offline: a.offlineCamera, connected: a.isLiveCount }
          }));
          setDistrictData(prev => prev.map(item => item.name === districtName ? { ...item, assemblies: assemblyList } : item));
        }
      } finally {
        setLoadingAssemblies(prev => ({ ...prev, [districtName]: false }));
      }
    }
  };

  const StatCard = ({ label, value, icon, color }) => (
    <Flex bg={userThemeColor} p={3} borderRadius="xl" align="center" gap={3} minH="70px" boxShadow="sm">
      <Center w="36px" h="36px" borderRadius="lg" bg={color} color="white">
        <Icon as={icon} boxSize={4} />
      </Center>
      <Box>
        <Text fontSize="13px" fontWeight="600" color="gray.500" mb={-1}>{label}</Text>
        <Text fontSize="lg" fontWeight="bold">{value}</Text>
      </Box>
    </Flex>
  );

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <Icon as={FaSort} ml={1} color="gray.400" />;
    return sortConfig.direction === 'asc' ? <Icon as={FaSortUp} ml={1} /> : <Icon as={FaSortDown} ml={1} />;
  };

  const MetricCell = ({ label, value, colorDot }) => (
    <HStack spacing={2} borderLeft={{ base: "none", md: "2px solid" }} borderColor="blue.100" pl={{ base: 0, md: 4 }} align="center">
      <Box w="6px" h="6px" borderRadius="full" bg={colorDot} />
      <VStack align="start" spacing={0}>
        <Text fontSize="9px" color="gray.500" display={{ base: "block", md: "none" }}>{label}</Text>
        <Text fontWeight="600" fontSize="13px">
          {value !== undefined && value !== null ? value : <Spinner size="xs" />}
        </Text>
      </VStack>
    </HStack>
  );

  const GRID_TEMPLATE = {
    base: "repeat(2, 1fr)",
    md: "1.5fr 1fr 1fr 1fr 1fr 1.2fr"
  };

  if (loading && !districtData.length) return <Flex minH="100vh" align="center" justify="center"><Spinner size="xl" color="blue.500" /></Flex>;

  return (
    <Box minH="100vh" overflowY="auto" pb={{ base: "120px", md: "20px" }}>
      {error && <Alert status="error" mb={4} borderRadius="md"><AlertIcon /> {error}</Alert>}

      <Flex mb={4} flexDirection={{ base: "column", md: "row" }} justifyContent="space-between" alignItems={{ base: "flex-start", md: "center" }} gap={4}>
        <Text fontWeight={400} fontSize={{ base: "18px", md: "24px" }} color={text}>Camera Status Dashboard</Text>
      </Flex>

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={{ base: 2, md: 3 }} mb={5}>
        <StatCard label="Total" value={globalStats.total} icon={FaRegPlayCircle} color="blue.600" />
        <StatCard label="Online" value={globalStats.online} icon={FaRegPlayCircle} color="green.500" />
        {/* Changed Offline to Inactive: Total - Live */}
        <StatCard label="Inactive" value={globalStats.total - globalStats.live} icon={FaRegPlayCircle} color="red.500" />
        <StatCard label="Installed" value={globalStats.live} icon={FaRegPlayCircle} color="purple.500" />
      </SimpleGrid>

      <Box borderRadius="lg" border="1px solid" borderColor={borderColor} overflow="hidden" boxShadow="sm">
        <Box bg={tableHeaderBg} px={6} py={2} display={{ base: "none", md: "block" }}>
          <Grid templateColumns={GRID_TEMPLATE.md} alignItems="center" gap={4}>
            <Button variant="ghost" size="sm" justifyContent="flex-start" p={0} onClick={() => handleSort('name')} _hover={{ bg: 'transparent' }}>
              <Text fontSize="xs" fontWeight="bold">District Name</Text>
              <SortIcon columnKey="name" />
            </Button>
            <Button variant="ghost" size="sm" justifyContent="flex-start" p={0} onClick={() => handleSort('total')} _hover={{ bg: 'transparent' }}>
              <MetricCell label="Total" value="Total" colorDot="blue.500" />
              <SortIcon columnKey="total" />
            </Button>
            <Button variant="ghost" size="sm" justifyContent="flex-start" p={0} onClick={() => handleSort('online')} _hover={{ bg: 'transparent' }}>
              <MetricCell label="Online" value="Online" colorDot="green.400" />
              <SortIcon columnKey="online" />
            </Button>
            {/* Changed Offline to Inactive */}
            <Button variant="ghost" size="sm" justifyContent="flex-start" p={0} onClick={() => handleSort('inactive')} _hover={{ bg: 'transparent' }}>
              <MetricCell label="Inactive" value="Inactive" colorDot="red.400" />
              <SortIcon columnKey="inactive" />
            </Button>
            <Button variant="ghost" size="sm" justifyContent="flex-start" p={0} onClick={() => handleSort('connected')} _hover={{ bg: 'transparent' }}>
              <MetricCell label="Connected" value="Installed" colorDot="purple.500" />
              <SortIcon columnKey="connected" />
            </Button>
          </Grid>
        </Box>

        <VStack align="stretch" spacing={0}>
          {sortedData.map((district, idx) => (
            <Box key={idx} borderBottom="1px solid" borderColor={borderColor}>
              <Box px={{ base: 4, md: 6 }} py={2}>
                <Grid templateColumns={GRID_TEMPLATE} alignItems="center" gap={{ base: 2, md: 4 }}>
                  <GridItem colSpan={{ base: 2, md: 1 }}>
                    <Text fontWeight="bold" fontSize="13px" color="blue.600" >{district.name} </Text>
                  </GridItem>
                  <MetricCell label="Total" value={district.stats?.total} colorDot="blue.600" />
                  <MetricCell label="Online" value={district.stats?.online} colorDot="green.400" />
                  {/* Changed Offline to Inactive calculation */}
                  <MetricCell 
                    label="Inactive" 
                    value={district.stats ? (district.stats.total - district.stats.connected) : null} 
                    colorDot="red.400" 
                  />
                  <MetricCell label="Connected" value={district.stats?.connected} colorDot="purple.400" />
                  <GridItem colSpan={{ base: 2, md: 1 }} display="flex" justifyContent={{ base: "center", md: "flex-end" }}>
                    <Button
                      size="xs" variant="outline" colorScheme="blue" onClick={() => toggleRow(district.name)}
                      rightIcon={expandedRows[district.name] ? <FaChevronUp /> : <FaChevronDown />}
                      w={{ base: "full", md: "auto" }} h="24px"
                    >
                      Locations
                    </Button>
                  </GridItem>
                </Grid>
              </Box>

              <Collapse in={expandedRows[district.name]} animateOpacity>
                <Box py={1} >
                  {loadingAssemblies[district.name] ? (
                    <Center p={4}><Spinner size="sm" /></Center>
                  ) : district.assemblies?.map((ass, i) => (
                    <Box key={i} px={{ base: 4, md: 6 }} py={1.5} borderTop="1px dashed" borderColor={borderColor}>
                      <Grid templateColumns={GRID_TEMPLATE} gap={{ base: 2, md: 4 }} alignItems="center">
                        <GridItem colSpan={{ base: 2, md: 1 }}>
                          <Text fontSize="11px" fontWeight="500" pl={4} borderLeft="2px solid" borderColor="blue.200">{ass.name}</Text>
                        </GridItem>
                        <MetricCell label="Total" value={ass.stats.total} colorDot="blue.500" />
                        <MetricCell label="Online" value={ass.stats.online} colorDot="green.400" />
                        {/* Changed Offline to Inactive calculation */}
                        <MetricCell 
                            label="Inactive" 
                            value={ass.stats.total - ass.stats.connected} 
                            colorDot="red.400" 
                        />
                        <MetricCell label="Connected" value={ass.stats.connected} colorDot="purple.400" />
                      </Grid>
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Box>
          ))}
        </VStack>
      </Box>
    </Box>
  );
};

export default Dashboard;