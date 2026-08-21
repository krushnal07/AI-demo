import {
  Box,
  Flex,
  Grid,
  GridItem,
  HStack,
  IconButton,
  Select,
  SimpleGrid,
  Skeleton,
  SkeletonText,
  Text,
  Tooltip,
  useColorModeValue,
  Spinner,
  Button,
  Input,
  InputGroup,
  InputLeftElement,
} from "@chakra-ui/react";
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  getdistrictwiseAccess,
  getDistrictNameByAssemblyName,
  getYourCameras,
  getAssemblyWiseCameras,
  getDistrictWiseCameras,
} from "../actions/cameraActions";
import Player from "../components/Player";
import SimpleFLVPlayer from "../components/SimpleFLVPlayer";
import NoCameraFound from "../components/NoCameraFound";
import CameraGroupBar from "../components/CameraGroupBar";
import ChatPanel from "./ChatPanel";
import TalkButton from "../components/TalkButton";
import { BsArrowsFullscreen, BsVolumeMute, BsVolumeUp } from "react-icons/bs";
import { MdChevronLeft, MdChevronRight, MdSearch } from "react-icons/md";

function MultipleView() {
  const [gridOption, setGridOption] = useState("2x2");
  const [gridLayout, setGridLayout] = useState("repeat(2, 1fr)");
  const [isLoading, setIsLoading] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef(null);
  const [activePage, setActivePage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(4);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const [camerasTab, setCamerasTab] = useState("My Cameras");
  const [mutedCameras, setMutedCameras] = useState({});

  // Theme Values
  const cardBg = useColorModeValue("#FFFFFF", "#1C222D");
  const cardBorder = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.08)");
  const searchBg = useColorModeValue("#FFFFFF", "#18202C");
  const titleColor = useColorModeValue("#1A2E3D", "#FFFFFF");
  const placeholderColor = useColorModeValue("#94A3B8", "#64748B");
  const subtextColor = useColorModeValue("#64748B", "#94A3B8");
  const btnHoverBg = useColorModeValue("#F8FAFC", "#252D3A");
  const fullscreenBg = useColorModeValue("#E8EFF7", "#0B0F17");
  const cameraBoxBg = useColorModeValue("#F1F5F9", "#000000");

  const [userEmail, setUserEmail] = useState(
    typeof window !== "undefined" ? localStorage.getItem("email") || "" : ""
  );

  // --- Camera Groups (persisted per-user in localStorage) ---
  const groupsKey = `cameraGroups_${userEmail || "guest"}`;

  const readGroups = (key) => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  };

  const [groups, setGroups] = useState(() => readGroups(`cameraGroups_${userEmail || "guest"}`));
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  const prevGroupsKeyRef = useRef(groupsKey);
  useEffect(() => {
    if (prevGroupsKeyRef.current === groupsKey) return;
    prevGroupsKeyRef.current = groupsKey;
    setGroups(readGroups(groupsKey));
    setSelectedGroupId(null);
  }, [groupsKey]);

  const savedGroupsKeyRef = useRef(groupsKey);
  const didInitGroupsRef = useRef(false);
  useEffect(() => {
    if (!didInitGroupsRef.current) {
      didInitGroupsRef.current = true;
      savedGroupsKeyRef.current = groupsKey;
      return;
    }
    if (savedGroupsKeyRef.current !== groupsKey) {
      savedGroupsKeyRef.current = groupsKey;
      return;
    }
    try {
      localStorage.setItem(groupsKey, JSON.stringify(groups));
    } catch (e) {
      /* ignore */
    }
  }, [groups, groupsKey]);

  const [uniqueDistricts, setUniqueDistricts] = useState([]);
  const [assemblies, setAssemblies] = useState([]);
  const [selectedDistrictName, setSelectedDistrictName] = useState("");
  const [selectedAssemblyValue, setSelectedAssemblyValue] = useState("");
  const [selectedLocationType, setSelectedLocationType] = useState("all");

  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingAssemblies, setLoadingAssemblies] = useState(false);
  const [districtError, setDistrictError] = useState("");
  const [assemblyError, setAssemblyError] = useState("");

  const [searchDeviceId, setSearchDeviceId] = useState("");
  const [allFetchedCameras, setAllFetchedCameras] = useState([]);
  const [camerasToDisplay, setCamerasToDisplay] = useState([]);
  const [totalPages, setTotalPages] = useState(1);

  const [autoRefreshInterval, setAutoRefreshInterval] = useState(0);
  const timerId = useRef(null);

  // --- URL GENERATION LOGIC (Production Safe) ---
  const generateStreamUrl = (camera) => {
    if (!camera) return "";
    if (camera.deviceId && camera.deviceId.startsWith("SSAN")) {
      return `wss://ptz.vmukti.com/live-record/${camera.deviceId}.flv`;
    }
    if (camera.plan === "LIVE" && camera.p2purl && camera.token) {
      return `https://${camera.deviceId}.${camera.p2purl}/flv/live_ch0_0.flv?verify=${camera.token}`;
    }
    if (camera.mediaUrl) {
      return `wss://${camera.mediaUrl}/jessica/DVR/${camera.deviceId}.flv`;
    }
    return "";
  };

  // --- Auto Refresh Timer ---
  useEffect(() => {
    if (timerId.current) clearInterval(timerId.current);
    if (autoRefreshInterval > 0 && totalPages > 1) {
      timerId.current = setInterval(() => {
        setActivePage((prevPage) => (prevPage >= totalPages ? 1 : prevPage + 1));
      }, autoRefreshInterval);
    }
    return () => {
      if (timerId.current) clearInterval(timerId.current);
    };
  }, [autoRefreshInterval, totalPages]);

  // --- Fetch Districts ---
  useEffect(() => {
    if (!userEmail) {
      setDistrictError("User email not found.");
      setUniqueDistricts([]);
      setLoadingDistricts(false);
      return;
    }
    const fetchDistricts = async () => {
      setLoadingDistricts(true);
      setDistrictError("");
      try {
        const response = await getdistrictwiseAccess(userEmail);
        if (response?.success && Array.isArray(response.matchedDistricts)) {
          const distinctDistrictsData = [];
          const seenNames = new Set();
          response.matchedDistricts.forEach((d) => {
            if (d.dist_name && d.districtAssemblyCode && !seenNames.has(d.dist_name)) {
              distinctDistrictsData.push({
                name: d.dist_name,
                districtAssemblyCode: d.districtAssemblyCode,
              });
              seenNames.add(d.dist_name);
            }
          });
          setUniqueDistricts(distinctDistrictsData.sort((a, b) => a.name.localeCompare(b.name)));
        } else {
          setDistrictError(response?.message || "No districts found.");
          setUniqueDistricts([]);
        }
      } catch (err) {
        setDistrictError(err.message || "Error fetching districts.");
        setUniqueDistricts([]);
      } finally {
        setLoadingDistricts(false);
      }
    };
    fetchDistricts();
  }, [userEmail]);

  // Reset all mutes to "True" (Default) whenever the page or layout changes
  useEffect(() => {
    setMutedCameras({});
  }, [activePage, itemsPerPage]);

  // --- Mute/Fullscreen Handlers ---
  const toggleMute = (deviceId) => {
    setMutedCameras((prev) => ({
      ...prev,
      [deviceId]: !(prev[deviceId] ?? true),
    }));
  };

  const toggleCameraFullscreen = (deviceId) => {
    const el = document.getElementById(`camera-box-${deviceId}`);
    if (!el) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      document.exitFullscreen?.() || document.webkitExitFullscreen?.();
    } else {
      el.requestFullscreen?.() || el.webkitRequestFullscreen?.();
    }
  };

  const toggleFullScreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!isFullScreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };

  // --- Data Fetching ---
  const fetchCamerasByFilters = async () => {
    if (!userEmail && camerasTab === "My Cameras") {
      setIsLoading(false);
      setAllFetchedCameras([]);
      return;
    }
    if (camerasTab !== "My Cameras") {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setAllFetchedCameras([]);
    try {
      let response;
      if (selectedAssemblyValue && selectedDistrictName) {
        response = await getAssemblyWiseCameras(userEmail, selectedDistrictName, selectedAssemblyValue);
      } else if (selectedDistrictName) {
        response = await getDistrictWiseCameras(userEmail, selectedDistrictName);
      } else {
        response = await getYourCameras(userEmail);
      }

      let fetchedCameras = Array.isArray(response) ? response : [];
      // Sorting: Online first, then priority
      fetchedCameras.sort((a, b) => {
        const aStatus = !!a.status;
        const bStatus = !!b.status;
        if (aStatus && !bStatus) return -1;
        if (!aStatus && bStatus) return 1;
        const aPriority = a.priority ?? 99999;
        const bPriority = b.priority ?? 99999;
        return aPriority - bPriority;
      });

      setAllFetchedCameras(fetchedCameras);
    } catch (err) {
      console.error("Camera Fetch Error:", err);
      setAllFetchedCameras([]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Pagination & Filtering Logic ---
  useEffect(() => {
    if (isLoading) return;

    let camerasToProcess = allFetchedCameras;

    // 1. ROLE-BASED RESTRICTION
    const currentUserRole = localStorage.getItem("role");
    if (currentUserRole === "CEO" || currentUserRole === "ECI") {
      camerasToProcess = camerasToProcess.filter((camera) => !!camera.status);
    }

    // 1b. CAMERA GROUP FILTER
    if (selectedGroupId) {
      const activeGroup = groups.find((g) => g.id === selectedGroupId);
      const groupIds = new Set(activeGroup?.deviceIds || []);
      camerasToProcess = camerasToProcess.filter((camera) => groupIds.has(camera.deviceId));
    }

    // 2. LOCATION TYPE FILTER
    if (selectedLocationType && selectedLocationType !== "all") {
      camerasToProcess = camerasToProcess.filter((camera) => {
        const locationType = camera.location_Type ? camera.location_Type.toLowerCase() : null;
        if (selectedLocationType === "auxiliary") return locationType === "auxiliary";
        return locationType === selectedLocationType;
      });
    }

    // 3. SEARCH LOGIC
    const activeSearch = searchDeviceId.trim();
    if (activeSearch !== "") {
      const term = activeSearch.toLowerCase();
      camerasToProcess = camerasToProcess.filter((c) => {
        const vehicleNo = Array.isArray(c.locations) ? c.locations[0] : c.location || "";
        return (
          String(vehicleNo).toLowerCase().includes(term) ||
          c.deviceId?.toLowerCase().includes(term) ||
          c.name?.toLowerCase().includes(term) ||
          c.operatorName?.toLowerCase().includes(term)
        );
      });
    }

    // 4. Update Pagination
    const calculatedTotalPages = Math.ceil(camerasToProcess.length / itemsPerPage);
    setTotalPages(calculatedTotalPages > 0 ? calculatedTotalPages : 1);

    let currentPageToUse = activePage;
    if (activePage > calculatedTotalPages && calculatedTotalPages > 0)
      currentPageToUse = calculatedTotalPages;
    else if (calculatedTotalPages > 0 && activePage < 1) currentPageToUse = 1;

    if (currentPageToUse !== activePage) setActivePage(currentPageToUse);

    const startIndex = (currentPageToUse - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setCamerasToDisplay(camerasToProcess.slice(startIndex, endIndex));
  }, [
    allFetchedCameras,
    searchDeviceId,
    activePage,
    itemsPerPage,
    isLoading,
    selectedLocationType,
    selectedGroupId,
    groups,
  ]);

  const getResponsivePlayerStyle = () => ({
    width: "100%",
    height: "100%",
    aspectRatio: "16 / 9",
    borderRadius: "10px",
    objectFit: "cover",
  });

  const handleGridChange = (value) => {
    if (value === gridOption) return;

    setGridOption(value);
    let newItemsPerPage = 4;

    switch (value) {
      case "2x2":
        newItemsPerPage = 4;
        setGridLayout("repeat(2, 1fr)");
        break;
      case "3x2":
        newItemsPerPage = 6;
        setGridLayout("repeat(3, 1fr)");
        break;
      case "3x3":
        newItemsPerPage = 9;
        setGridLayout("repeat(3, 1fr)");
        break;
      case "4x3":
        newItemsPerPage = 12;
        setGridLayout("repeat(4, 1fr)");
        break;
      default:
        newItemsPerPage = 4;
        setGridLayout("repeat(2, 1fr)");
    }
    setItemsPerPage(newItemsPerPage);
    setActivePage(1);
  };

  const handleDistrictChange = async (event) => {
    const selectedDistName = event.target.value;
    setSelectedDistrictName(selectedDistName);
    setSelectedAssemblyValue("");
    setSelectedLocationType("all");
    setAssemblies([]);
    setAssemblyError("");
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setActivePage(page);
    }
  };

  useEffect(() => {
    if (activePage !== 1) setActivePage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDistrictName, selectedAssemblyValue, searchDeviceId, selectedLocationType, selectedGroupId]);

  useEffect(() => {
    if (camerasTab === "My Cameras" && userEmail) fetchCamerasByFilters();
    else if (!userEmail && camerasTab === "My Cameras") {
      setIsLoading(false);
      setAllFetchedCameras([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDistrictName, selectedAssemblyValue, userEmail, camerasTab]);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullScreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullScreenChange);
    };
  }, []);

  // Determine grid template configuration dynamically based on selected layout
  const gridStyleConfig = useMemo(() => {
    switch (gridOption) {
      case "2x2":
        return {
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gridTemplateRows: "repeat(2, minmax(0, 1fr))",
        };
      case "3x2":
        return {
          gridTemplateColumns: { base: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" },
          gridTemplateRows: { base: "repeat(3, minmax(0, 1fr))", md: "repeat(2, minmax(0, 1fr))" },
        };
      case "3x3":
        return {
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gridTemplateRows: "repeat(3, minmax(0, 1fr))",
        };
      case "4x3":
        return {
          gridTemplateColumns: { base: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
          gridTemplateRows: { base: "repeat(6, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" },
        };
      default:
        return {
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gridTemplateRows: "repeat(2, minmax(0, 1fr))",
        };
    }
  }, [gridOption]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  return (
    <Box
      maxW="1440px"
      w="100%"
      h="100%"
      maxH="100%"
      mx="auto"
      display="flex"
      flexDirection="column"
      overflow="hidden"
      overscrollBehavior="none"
      px={{ base: "12px", sm: "16px", md: "20px", lg: "24px" }}
      py={{ base: "6px", sm: "8px", md: "10px" }}
      fontFamily="Manrope, sans-serif"
      boxSizing="border-box"
    >
      {/* ========================================================================= */}
      {/* 1. MULTIPLE VIEW TOP CONTROLS CONTAINER                                   */}
      {/* ========================================================================= */}
      <Flex
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap={{ base: "6px", md: "10px" }}
        mb={{ base: "6px", md: "8px" }}
        flexShrink={0}
      >
        {/* Title */}
        <Box minW={{ base: "auto", sm: "140px" }}>
          <Text
            fontFamily="Manrope, sans-serif"
            fontWeight="800"
            fontSize={{ base: "18px", md: "22px" }}
            lineHeight="1.2"
            letterSpacing="0px"
            color={titleColor}
          >
            Multiple View
          </Text>
        </Box>

        {/* Right side Controls */}
        <Flex
          alignItems="center"
          gap={{ base: "6px", sm: "8px", md: "10px" }}
          flexWrap="wrap"
          justifyContent={{ base: "flex-start", md: "flex-end" }}
          flex="1"
        >
          {/* 1. Search Camera Input (First) */}
          <InputGroup w={{ base: "100%", sm: "180px", md: "220px", lg: "247px" }} h="32px">
            <InputLeftElement h="32px" pointerEvents="none" pl="8px">
              <MdSearch size="18px" color="#94A3B8" />
            </InputLeftElement>
            <Input
              placeholder="Search Cameras"
              value={searchDeviceId}
              onChange={(e) => setSearchDeviceId(e.target.value)}
              h="32px"
              pl="34px"
              pr="12px"
              borderRadius="8px"
              borderWidth="1px"
              borderColor={cardBorder}
              bg={cardBg}
              fontFamily="Manrope, sans-serif"
              fontSize="12px"
              fontWeight="400"
              color={titleColor}
              _placeholder={{
                color: placeholderColor,
                fontFamily: "Manrope, sans-serif",
                fontSize: "12px",
              }}
              _focus={{
                borderColor: "#3F77A5",
                boxShadow: "0 0 0 1px #3F77A5",
              }}
            />
          </InputGroup>

          {/* 2. Select Location Dropdown (Second) */}
          <Select
            value={selectedDistrictName}
            onChange={handleDistrictChange}
            placeholder={loadingDistricts ? "Loading..." : "Select Location"}
            isDisabled={loadingDistricts || !userEmail}
            w={{ base: "100%", sm: "130px", md: "140px" }}
            h="32px"
            borderRadius="7px"
            borderWidth="1px"
            borderColor={cardBorder}
            bg={cardBg}
            fontFamily="Manrope, sans-serif"
            fontSize="12px"
            fontWeight="400"
            lineHeight="100%"
            letterSpacing="0px"
            color={titleColor}
            _focus={{ borderColor: "#3F77A5" }}
          >
            {uniqueDistricts.map((d) => (
              <option
                key={d.name}
                value={d.name}
                style={{
                  fontFamily: "Manrope, sans-serif",
                  fontWeight: "400",
                  fontSize: "12px",
                }}
              >
                {d.name}
              </option>
            ))}
          </Select>

          {/* 3. Grid View Switcher Buttons (2x2, 3x2, 3x3, 4x3) */}
          <HStack spacing="4px">
            {["2x2", "3x2", "3x3", "4x3"].map((opt) => {
              const isActive = gridOption === opt;
              return (
                <Button
                  key={opt}
                  onClick={() => handleGridChange(opt)}
                  h="30px"
                  px={{ base: "8px", sm: "12px", md: "14px" }}
                  py="4px"
                  borderRadius="7px"
                  borderWidth="1px"
                  borderColor={isActive ? "#3F77A5" : cardBorder}
                  bg={isActive ? "#3F77A518" : cardBg}
                  color={isActive ? "#3F77A5" : subtextColor}
                  fontFamily="Manrope, sans-serif"
                  fontWeight={isActive ? "700" : "600"}
                  fontSize="12px"
                  _hover={{
                    bg: isActive ? "#3F77A525" : btnHoverBg,
                    borderColor: "#3F77A5",
                  }}
                  transition="all 0.15s ease"
                >
                  {opt}
                </Button>
              );
            })}
          </HStack>

          {/* 4. Auto Refresh Interval */}
          <Select
            value={autoRefreshInterval}
            onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
            w="70px"
            h="30px"
            borderRadius="7px"
            borderWidth="1px"
            borderColor={cardBorder}
            bg={cardBg}
            fontFamily="Manrope, sans-serif"
            fontSize="12px"
            fontWeight="600"
            color={subtextColor}
            _focus={{ borderColor: "#3F77A5" }}
          >
            <option value={0}>Off</option>
            <option value={45000}>45s</option>
            <option value={60000}>60s</option>
          </Select>

          {/* 5. Fullscreen Toggle */}
          <Tooltip label="Fullscreen" hasArrow placement="top">
            <IconButton
              aria-label="Toggle Fullscreen"
              icon={<BsArrowsFullscreen fontSize="14px" color="#3F77A5" />}
              onClick={toggleFullScreen}
              h="30px"
              w="30px"
              minW="30px"
              borderRadius="7px"
              borderWidth="1px"
              borderColor={cardBorder}
              bg={cardBg}
              _hover={{ bg: "#3F77A510", borderColor: "#3F77A5" }}
            />
          </Tooltip>
        </Flex>
      </Flex>

      {/* ========================================================================= */}
      {/* 2. GROUP CONTAINER                                                        */}
      {/* ========================================================================= */}
      <Box w="100%" flexShrink={0} mb={{ base: "6px", md: "8px" }}>
        <CameraGroupBar
          allCameras={allFetchedCameras}
          groups={groups}
          setGroups={setGroups}
          selectedGroupId={selectedGroupId}
          onSelectGroup={setSelectedGroupId}
          generateStreamUrl={generateStreamUrl}
        />
      </Box>

      {/* ========================================================================= */}
      {/* 3. CAMERA STREAM LAYOUT                                                    */}
      {/* ========================================================================= */}
      <Box
        ref={containerRef}
        position="relative"
        width="100%"
        flex="1"
        minH="0"
        bg={isFullScreen ? fullscreenBg : "transparent"}
        p={isFullScreen ? { base: 2, md: 3 } : 0}
        borderRadius={isFullScreen ? "0" : "10px"}
        overflow="hidden"
        display="flex"
        alignItems="center"
        justifyContent="center"
        sx={{
          "&:fullscreen": {
            backgroundColor: `${fullscreenBg} !important`,
          },
          "&:-webkit-full-screen": {
            backgroundColor: `${fullscreenBg} !important`,
          },
        }}
      >
        {isLoading ? (
          <Grid
            w="100%"
            h="100%"
            maxH="100%"
            maxW="100%"
            templateColumns={gridStyleConfig.gridTemplateColumns}
            templateRows={gridStyleConfig.gridTemplateRows}
            gap={{ base: "6px", sm: "8px", md: "10px" }}
          >
            {Array.from({ length: itemsPerPage }).map((_, index) => (
              <Box
                key={index}
                w="100%"
                h="100%"
                minH="0"
                minW="0"
                borderRadius="10px"
                overflow="hidden"
                borderWidth="1px"
                borderColor={cardBorder}
                bg={cardBg}
              >
                <Skeleton height="100%" width="100%" borderRadius="10px" />
              </Box>
            ))}
          </Grid>
        ) : camerasToDisplay.length > 0 ? (
          <Grid
            w="100%"
            h="100%"
            maxH="100%"
            maxW="100%"
            templateColumns={gridStyleConfig.gridTemplateColumns}
            templateRows={gridStyleConfig.gridTemplateRows}
            gap={{ base: "6px", sm: "8px", md: "10px" }}
          >
            {camerasToDisplay.map((camera, index) => {
              const isMuted = mutedCameras[camera.deviceId] ?? true;

              return (
                <Box
                  key={camera.deviceId + "-grid-" + index}
                  id={`camera-box-${camera.deviceId}`}
                  position="relative"
                  w="100%"
                  h="100%"
                  minH="0"
                  minW="0"
                  borderRadius="10px"
                  borderWidth="1px"
                  borderColor={cardBorder}
                  bg={cameraBoxBg}
                  overflow="hidden"
                  transition="transform 0.15s ease, box-shadow 0.15s ease"
                  _hover={{
                    boxShadow: "0 4px 12px rgba(63, 119, 165, 0.15)",
                    borderColor: "#3F77A550",
                  }}
                  sx={{
                    "&:fullscreen": {
                      backgroundColor: `${fullscreenBg} !important`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    },
                    "&:-webkit-full-screen": {
                      backgroundColor: `${fullscreenBg} !important`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  }}
                >
                  <Box position="relative" w="100%" h="100%" overflow="hidden">
                    {camera.deviceId && camera.deviceId.startsWith("SSAN") ? (
                      <SimpleFLVPlayer
                        url={generateStreamUrl(camera)}
                        style={getResponsivePlayerStyle()}
                        muted={isMuted}
                      />
                    ) : (
                      <Player
                        device={camera}
                        initialPlayUrl={generateStreamUrl(camera)}
                        width="100%"
                        style={getResponsivePlayerStyle()}
                        height="100%"
                        showControls={false}
                        showOverlay={false}
                        muted={isMuted}
                      />
                    )}

                    {/* Bottom Details Overlay */}
                    <Box
                      position="absolute"
                      bottom="0"
                      left="0"
                      right="0"
                      bg="linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0, 0, 0, 0.75) 100%)"
                      p={{ base: "4px 8px", md: "6px 12px" }}
                      zIndex="10"
                    >
                      <Text
                        color="#FFFFFF"
                        fontSize={{ base: "10px", md: "11px" }}
                        fontFamily="Manrope, sans-serif"
                        fontWeight="600"
                        noOfLines={1}
                        letterSpacing="0.2px"
                      >
                        {camera.dist_name ? `${camera.dist_name} / ` : ""}
                        {Array.isArray(camera.locations) && camera.locations[0]
                          ? `${camera.locations[0]} / `
                          : ""}
                        {camera.deviceId}
                        {camera.operatorName ? ` / ${camera.operatorName}` : ""}
                      </Text>
                    </Box>

                    {/* Overlay Action Buttons */}
                    <HStack
                      position="absolute"
                      bottom={{ base: "24px", md: "28px" }}
                      right={{ base: "6px", md: "10px" }}
                      zIndex="20"
                      spacing={{ base: "4px", md: "6px" }}
                    >
                      <IconButton
                        size={{ base: "xs", md: "sm" }}
                        variant="solid"
                        bg="rgba(0, 0, 0, 0.6)"
                        _hover={{ bg: "black" }}
                        color="white"
                        borderRadius="full"
                        icon={
                          isMuted ? (
                            <BsVolumeMute fontSize="14px" />
                          ) : (
                            <BsVolumeUp fontSize="14px" />
                          )
                        }
                        onClick={() => toggleMute(camera.deviceId)}
                        aria-label="Mute / Unmute"
                      />
                      <IconButton
                        size={{ base: "xs", md: "sm" }}
                        variant="solid"
                        bg="rgba(0, 0, 0, 0.6)"
                        _hover={{ bg: "black" }}
                        color="white"
                        borderRadius="full"
                        icon={<BsArrowsFullscreen fontSize="12px" />}
                        onClick={() => toggleCameraFullscreen(camera.deviceId)}
                        aria-label="Camera Fullscreen"
                      />
                      <TalkButton deviceId={camera.deviceId} size={{ base: "xs", md: "sm" }} />
                    </HStack>
                  </Box>
                </Box>
              );
            })}
          </Grid>
        ) : (
          <Box py={10}>
            <NoCameraFound title="No Cameras Found" description="Try selecting a different location or clearing search filters." />
          </Box>
        )}
      </Box>

      {/* ========================================================================= */}
      {/* 4. NEXT AND PREVIOUS BUTTON CONTAINER                                      */}
      {/* ========================================================================= */}
      <Flex
        minH={{ base: "32px", md: "36px" }}
        pt={{ base: "4px", md: "6px" }}
        pb={{ base: "2px", md: "4px" }}
        justifyContent="center"
        alignItems="center"
        gap={{ base: "8px", md: "12px" }}
        w="100%"
        flexShrink={0}
        fontFamily="Manrope, sans-serif"
      >
        {/* Previous Button */}
        <Button
          onClick={() => handlePageChange(activePage - 1)}
          isDisabled={activePage === 1 || totalPages <= 1}
          h="30px"
          px="12px"
          gap="6px"
          borderRadius="8px"
          borderWidth="1px"
          borderColor={cardBorder}
          bg={cardBg}
          color="#3F77A5"
          fontFamily="Manrope, sans-serif"
          fontWeight="700"
          fontSize="12px"
          leftIcon={<MdChevronLeft size="18px" color="#3F77A5" />}
          _hover={{ bg: "#3F77A510", borderColor: "#3F77A5" }}
          _disabled={{ opacity: 0.45, cursor: "not-allowed" }}
        >
          Previous
        </Button>

        {/* Page Indicator (1 / n) */}
        <Text
          fontFamily="Manrope, sans-serif"
          fontWeight="600"
          fontSize="12px"
          lineHeight="1"
          letterSpacing="0px"
          color="#64748B"
          px="4px"
        >
          {totalPages > 0 ? `${activePage} / ${totalPages}` : "1 / 1"}
        </Text>

        {/* Next Button */}
        <Button
          onClick={() => handlePageChange(activePage + 1)}
          isDisabled={activePage === totalPages || totalPages <= 1}
          h="30px"
          px="12px"
          gap="6px"
          borderRadius="8px"
          borderWidth="1px"
          borderColor={cardBorder}
          bg={cardBg}
          color="#3F77A5"
          fontFamily="Manrope, sans-serif"
          fontWeight="700"
          fontSize="12px"
          rightIcon={<MdChevronRight size="18px" color="#3F77A5" />}
          _hover={{ bg: "#3F77A510", borderColor: "#3F77A5" }}
          _disabled={{ opacity: 0.45, cursor: "not-allowed" }}
        >
          Next
        </Button>
      </Flex>
    </Box>
  );
}

export default MultipleView;
