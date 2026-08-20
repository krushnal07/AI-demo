import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import axios from "axios";
import {
  Box,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  HStack,
  VStack,
  Button,
  Select,
  Input,
  InputGroup,
  InputLeftElement,
  Flex,
  Text,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  IconButton,
  Tooltip,
  Image,
  useColorModeValue,
  Collapse,
  SimpleGrid,
  Badge,
} from "@chakra-ui/react";
import * as XLSX from "xlsx";
import { FaDownload, FaChevronDown, FaChevronUp, FaFilePdf } from "react-icons/fa";
import { MdSearch } from "react-icons/md";
import { TbLayoutGrid, TbList, TbEye, TbPlayerPlay } from "react-icons/tb";
import { BsVolumeMute, BsVolumeUp } from "react-icons/bs";
import { Link as RouterLink, useLocation } from "react-router-dom";
import jsPDF from "jspdf";
import "jspdf-autotable";

import Player from "../components/Player";
import SimpleFLVPlayer from "../components/SimpleFLVPlayer";
import CameraPTZ from "../components/CameraPTZ";
import CameraSettingsModal from "../components/Modals/CameraSettingsModal";
import MobileHeader from "../components/MobileHeader";
import NoCameraFound from "../components/NoCameraFound";

// --- API Fetching Function (Unchanged Business Logic) ---
const getYourCamerasAPI = async (userEmail) => {
  const API_URL = `${process.env.REACT_APP_URL}/api/camera/getcurrentUserCameras`;

  const generateStreamUrl = (camera) => {
    // 1. Check for SSAN Cameras
    if (camera.deviceId && camera.deviceId.startsWith("SSAN")) {
      return `wss://ptz.vmukti.com/live-record/${camera.deviceId}.flv`;
    }

    // 2. Existing logic
    if (camera.plan === "LIVE" && camera.p2purl && camera.token) {
      return `https://${camera.deviceId}.${camera.p2purl}/flv/live_ch0_0.flv?verify=${camera.token}`;
    }
    if (camera.mediaUrl) {
      return `wss://${camera.mediaUrl}/jessica/DVR/${camera.deviceId}.flv`;
    }
    return "";
  };

  try {
    const response = await axios.post(API_URL, { email: userEmail });
    if (response.data && Array.isArray(response.data)) {
      return response.data.map((camera) => {
        let locationString = "N/A";
        if (
          camera.locations &&
          Array.isArray(camera.locations) &&
          camera.locations.length > 0
        ) {
          const firstLocation = camera.locations[0];
          locationString =
            typeof firstLocation === "string"
              ? firstLocation
              : firstLocation?.loc_name || "N/A";
        }
        return {
          DeviceId: camera.deviceId,
          district: camera.dist_name,
          assembly: camera.accName,
          ps_id: camera.ps_id,
          location: locationString,
          Status: camera.status,
          last_checked:
            camera.last_checked ||
            camera.lastSeen ||
            camera.updatedAt ||
            new Date().toISOString(),
          user_email: userEmail,
          name: camera.name,
          operatorName: camera.operatorName,
          operatorMobile: camera.operatorMobile,
          streamUrl: generateStreamUrl(camera),
          ...camera,
          location_Type: camera.location_Type || "N/A",
        };
      });
    } else {
      return [];
    }
  } catch (error) {
    console.error(
      "Error fetching cameras:",
      error.response ? error.response.data : error.message
    );
    return [];
  }
};
// --- End API Fetching Function ---

const Listview = () => {
  const [allFetchedCameras, setAllFetchedCameras] = useState([]);
  const [displayedCameras, setDisplayedCameras] = useState([]);
  const [userEmail, setUserEmail] = useState("");
  const [searchDeviceId, setSearchDeviceId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [loading, setLoading] = useState(false);
  const [camerasTab] = useState("My Cameras");
  const [districtsList, setDistrictsList] = useState([]);
  const [selectedDistrictName, setSelectedDistrictName] = useState("");
  const [assembliesList, setAssembliesList] = useState([]);
  const [selectedAssemblyValue, setSelectedAssemblyValue] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedLocationType, setSelectedLocationType] = useState("all");
  const [psOption] = useState("camera");

  const [expandedRows, setExpandedRows] = useState({});
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [isMuted, setIsMuted] = useState(true);

  const {
    isOpen: isStreamModalOpen,
    onOpen: onStreamModalOpen,
    onClose: onStreamModalClose,
  } = useDisclosure();
  const playerRef = useRef(null);
  const location = useLocation();

  // --- Design System Color Tokens Matching Reference ---
  const switcherBg = useColorModeValue("#F1F5F9", "#18202C");
  const cardBg = useColorModeValue("#FFFFFF", "#1C222D");
  const cardBorder = useColorModeValue("#E2E8F0", "rgba(255, 255, 255, 0.08)");
  const titleColor = useColorModeValue("#1A2E3D", "#FFFFFF");
  const placeholderColor = useColorModeValue("#94A3B8", "#64748B");
  const subtextColor = useColorModeValue("#64748B", "#94A3B8");
  const tableHeaderBg = useColorModeValue("#F0F5FA", "#202734");
  const tableHeaderColor = useColorModeValue("#4A607A", "#94A3B8");
  const tableBorderColor = useColorModeValue("#F1F5F9", "rgba(255, 255, 255, 0.06)");
  const rowAltBg = useColorModeValue("#F8FAFC", "#161C26");
  const tableRowHoverBg = useColorModeValue("#EDF4FA80", "rgba(255, 255, 255, 0.04)");
  const tableTextColor = useColorModeValue("#4A5568", "#CBD5E1");
  const modalBg = useColorModeValue("#FFFFFF", "#1C222D");
  const modalSectionBg = useColorModeValue("#F8FAFC", "#18202C");
  const actionBtnBg = useColorModeValue("#3F77A512", "#3F77A522");

  const handleCloseModal = () => {
    onStreamModalClose();
    setSelectedCamera(null);
    setIsMuted(true);
  };

  useEffect(() => {
    const email = localStorage.getItem("email");
    if (email) setUserEmail(email);
  }, []);

  const fetchAllUserCameras = useCallback(
    async (isInitial = false) => {
      if (!userEmail) return;

      if (isInitial) setLoading(true);

      try {
        const response = await getYourCamerasAPI(userEmail);
        if (Array.isArray(response)) {
          if (isInitial) {
            setAllFetchedCameras(response);
          } else {
            setAllFetchedCameras((prevCameras) =>
              prevCameras.map((oldCam) => {
                const updatedCam = response.find(
                  (newCam) => newCam.DeviceId === oldCam.DeviceId
                );
                return updatedCam
                  ? { ...oldCam, status: updatedCam.status }
                  : oldCam;
              })
            );
          }
        }
      } catch (err) {
        console.error("Status refresh failed:", err);
      } finally {
        if (isInitial) setLoading(false);
      }
    },
    [userEmail]
  );

  useEffect(() => {
    fetchAllUserCameras(true);
    const intervalId = setInterval(() => {
      fetchAllUserCameras(false);
    }, 60000);
    return () => clearInterval(intervalId);
  }, [fetchAllUserCameras]);

  useEffect(() => {
    const districts = [
      ...new Set(allFetchedCameras.map((c) => c.district).filter(Boolean)),
    ];
    setDistrictsList(districts.sort());
  }, [allFetchedCameras]);

  useEffect(() => {
    if (selectedDistrictName) {
      const cams = allFetchedCameras.filter(
        (c) => c.district === selectedDistrictName
      );
      const assemblies = [
        ...new Set(cams.map((c) => c.assembly).filter(Boolean)),
      ];
      setAssembliesList(assemblies.sort());
    } else {
      setAssembliesList([]);
    }
  }, [selectedDistrictName, allFetchedCameras]);

  // Combined Filtering Logic
  useEffect(() => {
    let data = [...allFetchedCameras];

    if (camerasTab === "Live Cameras") {
      data = data.filter((c) => c.status === true);
    }

    if (selectedDistrictName) {
      data = data.filter((c) => c.district === selectedDistrictName);
    }

    if (selectedAssemblyValue) {
      data = data.filter((c) => c.assembly === selectedAssemblyValue);
    }

    if (selectedStatus) {
      const isOnline = selectedStatus === "online";
      data = data.filter((c) => c.status === isOnline);
    }

    if (searchDeviceId) {
      const term = searchDeviceId.toLowerCase();
      data = data.filter(
        (c) =>
          String(c.DeviceId || "").toLowerCase().includes(term) ||
          String(c.name || "").toLowerCase().includes(term) ||
          String(c.location || "").toLowerCase().includes(term)
      );
    }

    if (selectedLocationType !== "all") {
      data = data.filter((c) => c.location_Type === selectedLocationType);
    }

    const end = currentPage * itemsPerPage;
    const start = end - itemsPerPage;
    setDisplayedCameras(data.slice(start, end));
  }, [
    allFetchedCameras,
    searchDeviceId,
    currentPage,
    itemsPerPage,
    selectedDistrictName,
    selectedAssemblyValue,
    selectedStatus,
    camerasTab,
    selectedLocationType,
  ]);

  const handleViewStream = (camera) => {
    setSelectedCamera(camera);
    onStreamModalOpen();
  };

  const handleSearchDeviceIdChange = (event) => {
    setSearchDeviceId(event.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const handleDistrictChange = (event) => {
    setSelectedDistrictName(event.target.value);
    setSelectedAssemblyValue("");
    setCurrentPage(1);
  };

  const handleStatusChange = (event) => {
    setSelectedStatus(event.target.value);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSelectedDistrictName("");
    setSelectedAssemblyValue("");
    setSelectedLocationType("all");
    setSelectedStatus("");
    setSearchDeviceId("");
    setCurrentPage(1);
  };

  const isAnyFilterActive = useMemo(() => {
    return (
      Boolean(selectedDistrictName) ||
      Boolean(selectedAssemblyValue) ||
      selectedLocationType !== "all" ||
      Boolean(selectedStatus) ||
      Boolean(searchDeviceId)
    );
  }, [
    selectedDistrictName,
    selectedAssemblyValue,
    selectedLocationType,
    selectedStatus,
    searchDeviceId,
  ]);

  const getFilteredDataForExportAndCount = useCallback(() => {
    let data = [...allFetchedCameras];

    if (camerasTab === "Live Cameras") {
      data = data.filter((c) => c.status === true);
    }

    if (selectedDistrictName) {
      data = data.filter((c) => c.district === selectedDistrictName);
    }

    if (selectedAssemblyValue) {
      data = data.filter((c) => c.assembly === selectedAssemblyValue);
    }

    if (selectedStatus) {
      const isOnline = selectedStatus === "online";
      data = data.filter((c) => c.status === isOnline);
    }

    if (searchDeviceId) {
      const term = searchDeviceId.toLowerCase();
      data = data.filter(
        (c) =>
          String(c.DeviceId || "").toLowerCase().includes(term) ||
          String(c.name || "").toLowerCase().includes(term) ||
          String(c.location || "").toLowerCase().includes(term)
      );
    }

    if (selectedLocationType !== "all") {
      data = data.filter((c) => c.location_Type === selectedLocationType);
    }

    return data;
  }, [
    allFetchedCameras,
    camerasTab,
    selectedDistrictName,
    selectedAssemblyValue,
    selectedStatus,
    searchDeviceId,
    selectedLocationType,
  ]);

  const totalItemsAfterFilters = useMemo(() => {
    return getFilteredDataForExportAndCount().length;
  }, [getFilteredDataForExportAndCount]);

  const totalPages = Math.max(1, Math.ceil(totalItemsAfterFilters / itemsPerPage));

  const totalCount = allFetchedCameras.length;
  const onlineCount = allFetchedCameras.filter((c) => c.status === true).length;
  const offlineCount = allFetchedCameras.filter((c) => c.status === false).length;

  const toggleMoreInfo = (id) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePDFExport = useCallback(() => {
    const filteredData = getFilteredDataForExportAndCount();

    if (filteredData.length === 0) {
      alert("No data found for the current filters.");
      return;
    }

    const dataToExport = filteredData.map((camera, index) => ({
      "Sr No.": index + 1,
      Location: camera.district || "N/A",
      "Camera Location Name": camera.assembly || camera.location || "N/A",
      "Device Id": camera.DeviceId,
      "Operator Name": camera.operatorName || "N/A",
      "Operator Mobile No.": camera.operatorMobile || "N/A",
      Status: camera.status ? "Online" : "Offline",
    }));

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Camera Status Report", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

    const tableColumn = Object.keys(dataToExport[0]);
    const tableRows = dataToExport.map((item) => Object.values(item));

    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: "grid",
      headStyles: { fillColor: [63, 119, 165], textColor: [255, 255, 255] },
    });

    doc.save(`Camera_Report_${new Date().getTime()}.pdf`);
  }, [getFilteredDataForExportAndCount]);

  const handleCSVExport = useCallback(() => {
    const filteredData = getFilteredDataForExportAndCount();

    if (filteredData.length === 0) {
      alert("No data found for the current filters.");
      return;
    }

    const dataToExport = filteredData.map((camera, index) => ({
      "Sr No.": index + 1,
      Location: camera.district || "N/A",
      "Camera Location Name": camera.assembly || camera.location || "N/A",
      "Device Id": camera.DeviceId,
      "Operator Name": camera.operatorName || "N/A",
      "Operator Mobile No.": camera.operatorMobile || "N/A",
      Status: camera.status ? "Online" : "Offline",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cameras");
    XLSX.writeFile(workbook, `Camera_Report_${new Date().getTime()}.xlsx`);
  }, [getFilteredDataForExportAndCount]);

  // Mobile Metric Cell Component
  const MobileMetricCell = ({ label, value, colorDot }) => (
    <HStack spacing={2} borderLeft="2px solid" borderColor="blue.100" pl={3} align="center">
      <Box w="7px" h="7px" borderRadius="full" bg={colorDot} flexShrink={0} />
      <VStack align="start" spacing={0} overflow="hidden">
        <Text fontSize="10px" color={subtextColor} fontFamily="Manrope, sans-serif">
          {label}
        </Text>
        <Text fontWeight="600" fontSize="xs" color={titleColor} isTruncated maxW="120px" fontFamily="Manrope, sans-serif">
          {value || "N/A"}
        </Text>
      </VStack>
    </HStack>
  );

  return (
    <Box
      maxW="1440px"
      w="100%"
      mx="auto"
      px={{ base: "12px", sm: "16px", md: "20px", lg: "24px" }}
      py={{ base: "12px", md: "16px" }}
      fontFamily="Manrope, sans-serif"
      mb={{ base: "20", md: "6" }}
    >
      {/* Mobile Header */}
      <MobileHeader title="List View" />

      {/* ========================================================================= */}
      {/* 1. TOP HEADER ROW (Title, Segmented View Switcher, Export Buttons)         */}
      {/* ========================================================================= */}
      <Flex
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap="12px"
        mb="8px"
      >
        {/* Left: Title & Segmented View Switcher */}
        <HStack spacing={4} align="center">
          <Text
            fontFamily="Manrope, sans-serif"
            fontWeight="800"
            fontSize={{ base: "20px", md: "22px" }}
            lineHeight="26.4px"
            letterSpacing="0px"
            color={titleColor}
          >
            List View
          </Text>

          {/* Segmented View Switcher */}
          <HStack
            h="34px"
            p="3px"
            bg={switcherBg}
            border="1px solid"
            borderColor={cardBorder}
            borderRadius="9px"
            spacing="3px"
            ml={2}
          >
            <Tooltip label="Grid View" hasArrow placement="top">
              <Box
                as={RouterLink}
                to="/cameras"
                h="26px"
                px="8px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                borderRadius="6px"
                bg={
                  location.pathname.toLowerCase() === "/cameras"
                    ? cardBg
                    : "transparent"
                }
                boxShadow={
                  location.pathname.toLowerCase() === "/cameras"
                    ? "0 1px 3px rgba(0, 0, 0, 0.08)"
                    : "none"
                }
                color={
                  location.pathname.toLowerCase() === "/cameras"
                    ? "#3F77A5"
                    : "#64748B"
                }
                _hover={{
                  textDecoration: "none",
                  color:
                    location.pathname.toLowerCase() === "/cameras"
                      ? "#3F77A5"
                      : titleColor,
                }}
                transition="all 0.18s cubic-bezier(0.4, 0, 0.2, 1)"
              >
                <TbLayoutGrid size="17px" />
              </Box>
            </Tooltip>
            <Tooltip label="List View" hasArrow placement="top">
              <Box
                as={RouterLink}
                to="/listview"
                h="26px"
                px="8px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                borderRadius="6px"
                bg={
                  location.pathname.toLowerCase() === "/listview"
                    ? cardBg
                    : "transparent"
                }
                boxShadow={
                  location.pathname.toLowerCase() === "/listview"
                    ? "0 1px 3px rgba(0, 0, 0, 0.08)"
                    : "none"
                }
                color={
                  location.pathname.toLowerCase() === "/listview"
                    ? "#3F77A5"
                    : "#64748B"
                }
                _hover={{
                  textDecoration: "none",
                  color:
                    location.pathname.toLowerCase() === "/listview"
                      ? "#3F77A5"
                      : titleColor,
                }}
                transition="all 0.18s cubic-bezier(0.4, 0, 0.2, 1)"
              >
                <TbList size="18px" />
              </Box>
            </Tooltip>
          </HStack>
        </HStack>

        {/* Right Side: XLSX & PDF Export Buttons */}
        <HStack spacing={2} flexShrink={0}>
          <Button
            leftIcon={<FaDownload size="12px" />}
            h="34px"
            px="12px"
            borderRadius="8px"
            borderWidth="1px"
            borderColor={cardBorder}
            bg={cardBg}
            color="#3F77A5"
            fontFamily="Manrope, sans-serif"
            fontWeight="700"
            fontSize="12px"
            _hover={{ bg: "#3F77A512", borderColor: "#3F77A5" }}
            onClick={handleCSVExport}
          >
            XLSX
          </Button>

          <Button
            leftIcon={<FaFilePdf size="12px" />}
            h="34px"
            px="12px"
            borderRadius="8px"
            borderWidth="1px"
            borderColor={cardBorder}
            bg={cardBg}
            color="#3F77A5"
            fontFamily="Manrope, sans-serif"
            fontWeight="700"
            fontSize="12px"
            _hover={{ bg: "#3F77A512", borderColor: "#3F77A5" }}
            onClick={handlePDFExport}
          >
            PDF
          </Button>
        </HStack>
      </Flex>

      {/* ========================================================================= */}
      {/* 2. STATUS COUNTERS BAR                                                    */}
      {/* ========================================================================= */}
      <Flex gap="16px" align="center" flexWrap="wrap" mb="14px">
        {/* Total Cameras */}
        <HStack
          spacing="6px"
          cursor="pointer"
          onClick={() => setSelectedStatus("")}
          opacity={!selectedStatus ? 1 : 0.65}
          _hover={{ opacity: 1 }}
          transition="opacity 0.15s"
        >
          <Box w="8px" h="8px" borderRadius="full" bg="#3F77A5" />
          <Text
            fontFamily="Manrope, sans-serif"
            fontWeight="600"
            fontSize="12px"
            color={subtextColor}
          >
            Total Cameras ({totalCount})
          </Text>
        </HStack>

        {/* Online */}
        <HStack
          spacing="6px"
          cursor="pointer"
          onClick={() =>
            setSelectedStatus(selectedStatus === "online" ? "" : "online")
          }
          opacity={selectedStatus === "online" || !selectedStatus ? 1 : 0.5}
          _hover={{ opacity: 1 }}
          transition="opacity 0.15s"
        >
          <Box w="8px" h="8px" borderRadius="full" bg="#10B981" />
          <Text
            fontFamily="Manrope, sans-serif"
            fontWeight="600"
            fontSize="12px"
            color={selectedStatus === "online" ? "#10B981" : subtextColor}
          >
            Online ({onlineCount})
          </Text>
        </HStack>

        {/* Offline */}
        <HStack
          spacing="6px"
          cursor="pointer"
          onClick={() =>
            setSelectedStatus(selectedStatus === "offline" ? "" : "offline")
          }
          opacity={selectedStatus === "offline" || !selectedStatus ? 1 : 0.5}
          _hover={{ opacity: 1 }}
          transition="opacity 0.15s"
        >
          <Box w="8px" h="8px" borderRadius="full" bg="#EF4444" />
          <Text
            fontFamily="Manrope, sans-serif"
            fontWeight="600"
            fontSize="12px"
            color={selectedStatus === "offline" ? "#EF4444" : subtextColor}
          >
            Offline ({offlineCount})
          </Text>
        </HStack>
      </Flex>

      {/* ========================================================================= */}
      {/* 3. MAIN WHITE CONTAINER WITH CURVED/ROUNDED BORDERS (Reference Design)     */}
      {/* ========================================================================= */}
      <Box
        bg={cardBg}
        borderRadius="16px"
        borderWidth="1px"
        borderColor={cardBorder}
        boxShadow="0px 2px 10px rgba(0, 0, 0, 0.04)"
        p={{ base: "14px", md: "20px" }}
        overflow="hidden"
      >
        {/* --- Top Filter Toolbar inside the Container --- */}
        <Flex
          justify="space-between"
          align={{ base: "stretch", md: "center" }}
          direction={{ base: "column", md: "row" }}
          gap="12px"
          mb="18px"
          flexWrap="wrap"
        >
          {/* Left: SEARCH label + Filters + Search Bar */}
          <Flex
            align="center"
            gap="12px"
            flexWrap="wrap"
            flex="1"
          >
            {/* Select Location Field */}
            <Select
              placeholder="Select Location"
              value={selectedDistrictName}
              onChange={handleDistrictChange}
              w={{ base: "100%", sm: "160px" }}
              h="36px"
              borderRadius="8px"
              borderWidth="1px"
              borderColor={cardBorder}
              bg={cardBg}
              fontFamily="Manrope, sans-serif"
              fontSize="13px"
              fontWeight="500"
              color={titleColor}
              _focus={{ borderColor: "#3F77A5", boxShadow: "0 0 0 1px #3F77A5" }}
            >
              {districtsList.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>

            {/* Select Status Field */}
            <Select
              placeholder="Select Status"
              value={selectedStatus}
              onChange={handleStatusChange}
              w={{ base: "100%", sm: "135px" }}
              h="36px"
              borderRadius="8px"
              borderWidth="1px"
              borderColor={cardBorder}
              bg={cardBg}
              fontFamily="Manrope, sans-serif"
              fontSize="13px"
              fontWeight="500"
              color={titleColor}
              _focus={{ borderColor: "#3F77A5", boxShadow: "0 0 0 1px #3F77A5" }}
            >
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </Select>

            {/* Search Camera Input with Q / Search icon */}
            <InputGroup w={{ base: "100%", sm: "240px", md: "320px" }} h="36px">
              <InputLeftElement h="36px" pointerEvents="none" pl="10px">
                <MdSearch size="18px" color="#94A3B8" />
              </InputLeftElement>
              <Input
                placeholder="Search Camera ID"
                value={searchDeviceId}
                onChange={handleSearchDeviceIdChange}
                h="36px"
                pl="34px"
                pr="12px"
                borderRadius="8px"
                borderWidth="1px"
                borderColor={cardBorder}
                bg={cardBg}
                fontFamily="Manrope, sans-serif"
                fontSize="13px"
                fontWeight="500"
                color={titleColor}
                _placeholder={{ color: placeholderColor }}
                _focus={{
                  borderColor: "#3F77A5",
                  boxShadow: "0 0 0 1px #3F77A5",
                }}
              />
            </InputGroup>
          </Flex>

          {/* Right: Clear Filters Link Button */}
          <Flex align="center" justify={{ base: "flex-end", md: "center" }}>
            <Button
              variant="unstyled"
              h="auto"
              p={0}
              color="#718096"
              fontFamily="Manrope, sans-serif"
              fontSize="13px"
              fontWeight="600"
              _hover={{ color: "#3182CE", textDecoration: "underline" }}
              onClick={handleClearFilters}
              isDisabled={!isAnyFilterActive}
              opacity={isAnyFilterActive ? 1 : 0.4}
              cursor={isAnyFilterActive ? "pointer" : "default"}
            >
              Clear Filters
            </Button>
          </Flex>
        </Flex>

        {/* --- Main Table / Content Section --- */}
        {loading ? (
          <Flex
            justifyContent="center"
            alignItems="center"
            minH="300px"
            direction="column"
            gap={3}
          >
            <Spinner size="xl" thickness="3px" color="#3F77A5" />
            <Text fontSize="13px" color={subtextColor} fontFamily="Manrope, sans-serif">
              Loading cameras...
            </Text>
          </Flex>
        ) : displayedCameras.length === 0 ? (
          <Box py={8}>
            <NoCameraFound
              title="Cameras"
              description="No cameras match your selected filters. Try changing or clearing filters."
            />
          </Box>
        ) : (
          <>
            {/* Mobile View Cards (< md) */}
            <VStack
              display={{ base: "flex", md: "none" }}
              spacing={3}
              align="stretch"
            >
              {displayedCameras.map((camera, index) => {
                const rowId = `${camera.DeviceId}-${index}`;
                const isOnline = Boolean(camera.status);
                return (
                  <Box
                    key={rowId}
                    borderRadius="10px"
                    borderWidth="1px"
                    borderColor={tableBorderColor}
                    bg={index % 2 === 1 ? rowAltBg : cardBg}
                    p={4}
                  >
                    <Flex justify="space-between" align="center" mb={3}>
                      <HStack spacing={2} align="center">
                        <Box
                          w="8px"
                          h="8px"
                          borderRadius="full"
                          bg={isOnline ? "#10B981" : "#EF4444"}
                        />
                        <Text
                          fontWeight="700"
                          color={titleColor}
                          fontSize="sm"
                          fontFamily="Manrope, sans-serif"
                        >
                          {camera.district || "N/A"}
                        </Text>
                        <Badge
                          colorScheme={isOnline ? "green" : "red"}
                          borderRadius="full"
                          px={2}
                          fontSize="10px"
                          textTransform="capitalize"
                        >
                          {isOnline ? "Online" : "Offline"}
                        </Badge>
                      </HStack>

                      <Tooltip label="View Live Stream" hasArrow placement="top">
                        <IconButton
                          aria-label="View Stream"
                          icon={<TbPlayerPlay size="15px" />}
                          size="sm"
                          h="30px"
                          w="30px"
                          minW="30px"
                          borderRadius="7px"
                          borderWidth="1px"
                          borderColor={cardBorder}
                          bg={actionBtnBg}
                          color="#3F77A5"
                          onClick={() => handleViewStream(camera)}
                          isDisabled={!camera.streamUrl}
                          _hover={{
                            bg: "#3F77A5",
                            color: "#FFFFFF",
                            borderColor: "#3F77A5",
                          }}
                          _disabled={{
                            opacity: 0.35,
                            cursor: "not-allowed",
                            bg: "transparent",
                            borderColor: cardBorder,
                            color: subtextColor,
                          }}
                        />
                      </Tooltip>
                    </Flex>

                    <SimpleGrid columns={2} spacing={3} mb={3}>
                      <MobileMetricCell
                        label="Location Name"
                        value={camera.assembly || camera.location}
                        colorDot="blue.500"
                      />
                      <MobileMetricCell
                        label="Device Id"
                        value={camera.DeviceId}
                        colorDot="purple.500"
                      />
                      <MobileMetricCell
                        label="Operator Name"
                        value={camera.operatorName}
                        colorDot="green.400"
                      />
                      <MobileMetricCell
                        label="Operator Mobile"
                        value={camera.operatorMobile}
                        colorDot="orange.400"
                      />
                    </SimpleGrid>

                    <Collapse in={expandedRows[rowId]}>
                      <Box
                        p={3}
                        mb={3}
                        borderRadius="8px"
                        bg={tableHeaderBg}
                        border="1px dashed"
                        borderColor={cardBorder}
                      >
                        <VStack align="stretch" spacing={2}>
                          <HStack justify="space-between">
                            <Text fontSize="xs" color={subtextColor} fontFamily="Manrope, sans-serif">
                              Driver Name:
                            </Text>
                            <Text fontSize="xs" fontWeight="600" color={titleColor} fontFamily="Manrope, sans-serif">
                              {camera.operatorName || "N/A"}
                            </Text>
                          </HStack>
                          <HStack justify="space-between">
                            <Text fontSize="xs" color={subtextColor} fontFamily="Manrope, sans-serif">
                              Contact:
                            </Text>
                            <Text fontSize="xs" fontWeight="600" color={titleColor} fontFamily="Manrope, sans-serif">
                              {camera.operatorMobile || "N/A"}
                            </Text>
                          </HStack>
                        </VStack>
                      </Box>
                    </Collapse>

                    <Button
                      w="full"
                      size="xs"
                      h="28px"
                      variant="outline"
                      borderColor={cardBorder}
                      color={subtextColor}
                      borderRadius="6px"
                      fontFamily="Manrope, sans-serif"
                      fontWeight="600"
                      onClick={() => toggleMoreInfo(rowId)}
                      rightIcon={
                        expandedRows[rowId] ? <FaChevronUp /> : <FaChevronDown />
                      }
                      _hover={{ bg: tableHeaderBg, color: titleColor }}
                    >
                      {expandedRows[rowId] ? "Less Info" : "More Info"}
                    </Button>
                  </Box>
                );
              })}
            </VStack>

            {/* Desktop Table View matching Reference Screenshot (md and up) */}
            <Box
              display={{ base: "none", md: "block" }}
              borderRadius="10px"
              overflow="hidden"
              border="1px solid"
              borderColor={tableBorderColor}
            >
              <Box overflowX="auto" maxH="calc(100vh - 330px)">
                <Table variant="simple" size="md">
                  <Thead
                    position="sticky"
                    top={0}
                    zIndex={2}
                    bg={tableHeaderBg}
                  >
                    <Tr borderBottom="1px solid" borderColor={tableBorderColor}>
                      <Th
                        py="14px"
                        px="18px"
                        fontFamily="Manrope, sans-serif"
                        fontWeight="700"
                        fontSize="13px"
                        color={tableHeaderColor}
                        textTransform="none"
                        letterSpacing="0px"
                      >
                        Location
                      </Th>
                      {/* <Th
                        py="14px"
                        px="18px"
                        fontFamily="Manrope, sans-serif"
                        fontWeight="700"
                        fontSize="13px"
                        color={tableHeaderColor}
                        textTransform="none"
                        letterSpacing="0px"
                      >
                        Camera Location Name
                      </Th> */}
                      <Th
                        py="14px"
                        px="18px"
                        fontFamily="Manrope, sans-serif"
                        fontWeight="700"
                        fontSize="13px"
                        color={tableHeaderColor}
                        textTransform="none"
                        letterSpacing="0px"
                      >
                        Device Id
                      </Th>
                      <Th
                        py="14px"
                        px="18px"
                        fontFamily="Manrope, sans-serif"
                        fontWeight="700"
                        fontSize="13px"
                        color={tableHeaderColor}
                        textTransform="none"
                        letterSpacing="0px"
                      >
                        Operator Name
                      </Th>
                      <Th
                        py="14px"
                        px="18px"
                        fontFamily="Manrope, sans-serif"
                        fontWeight="700"
                        fontSize="13px"
                        color={tableHeaderColor}
                        textTransform="none"
                        letterSpacing="0px"
                      >
                        Operator Mobile No.
                      </Th>
                      <Th
                        py="14px"
                        px="18px"
                        fontFamily="Manrope, sans-serif"
                        fontWeight="700"
                        fontSize="13px"
                        color={tableHeaderColor}
                        textTransform="none"
                        letterSpacing="0px"
                        textAlign="center"
                      >
                        Status
                      </Th>
                      <Th
                        py="14px"
                        px="18px"
                        fontFamily="Manrope, sans-serif"
                        fontWeight="700"
                        fontSize="13px"
                        color={tableHeaderColor}
                        textTransform="none"
                        letterSpacing="0px"
                        textAlign="center"
                      >
                        Actions
                      </Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {displayedCameras.map((camera, index) => {
                      const rowId = `${camera.DeviceId}-${index}`;
                      const isOnline = Boolean(camera.status);
                      const isEvenRow = index % 2 === 1;

                      return (
                        <Tr
                          key={rowId}
                          bg={isEvenRow ? rowAltBg : cardBg}
                          borderBottom="1px solid"
                          borderColor={tableBorderColor}
                          _hover={{ bg: tableRowHoverBg }}
                          transition="background 0.15s ease"
                        >
                          {/* Location */}
                          <Td
                            py="14px"
                            px="18px"
                            fontFamily="Manrope, sans-serif"
                            fontSize="13px"
                            fontWeight="600"
                            color={titleColor}
                          >
                            {camera.district || "N/A"}
                          </Td>

                          {/* Camera Location Name - Commented out */}
                          {/* <Td
                            py="14px"
                            px="18px"
                            fontFamily="Manrope, sans-serif"
                            fontSize="13px"
                            color={tableTextColor}
                          >
                            {camera.assembly || camera.location || "Loc-1"}
                          </Td> */}

                          {/* Device Id (Styled blue as in reference) */}
                          <Td
                            py="14px"
                            px="18px"
                            fontFamily="Manrope, sans-serif"
                            fontSize="13px"
                            fontWeight="700"
                            color="#3F77A5"
                          >
                            {camera.DeviceId || "N/A"}
                          </Td>

                          {/* Operator Name */}
                          <Td
                            py="14px"
                            px="18px"
                            fontFamily="Manrope, sans-serif"
                            fontSize="13px"
                            color={tableTextColor}
                          >
                            {camera.operatorName || "N/A"}
                          </Td>

                          {/* Operator Mobile No. */}
                          <Td
                            py="14px"
                            px="18px"
                            fontFamily="Manrope, sans-serif"
                            fontSize="13px"
                            color={tableTextColor}
                          >
                            {camera.operatorMobile || "N/A"}
                          </Td>

                          {/* Status */}
                          <Td py="14px" px="18px" textAlign="center">
                            <HStack spacing={1.5} justify="center">
                              <Box
                                w="7px"
                                h="7px"
                                borderRadius="full"
                                bg={isOnline ? "#10B981" : "#EF4444"}
                                boxShadow={
                                  isOnline
                                    ? "0 0 6px rgba(16, 185, 129, 0.5)"
                                    : "none"
                                }
                              />
                              <Text
                                fontSize="12px"
                                fontWeight="600"
                                fontFamily="Manrope, sans-serif"
                                color={isOnline ? "#10B981" : "#EF4444"}
                              >
                                {isOnline ? "Online" : "Offline"}
                              </Text>
                            </HStack>
                          </Td>

                          {/* Actions (Stream Preview button matching reference icon box) */}
                          <Td py="14px" px="18px" textAlign="center">
                            <Tooltip label="View Live Stream" hasArrow placement="top">
                              <IconButton
                                aria-label="View Live Stream"
                                icon={<TbPlayerPlay size="15px" />}
                                size="sm"
                                h="30px"
                                w="30px"
                                minW="30px"
                                borderRadius="7px"
                                borderWidth="1px"
                                borderColor={cardBorder}
                                bg={actionBtnBg}
                                color="#3F77A5"
                                onClick={() => handleViewStream(camera)}
                                isDisabled={!camera.streamUrl}
                                _hover={{
                                  bg: "#3F77A5",
                                  color: "#FFFFFF",
                                  borderColor: "#3F77A5",
                                  transform: "translateY(-1px)",
                                  boxShadow: "0 2px 6px rgba(63, 119, 165, 0.35)",
                                }}
                                _disabled={{
                                  opacity: 0.35,
                                  cursor: "not-allowed",
                                  bg: "transparent",
                                  borderColor: cardBorder,
                                  color: subtextColor,
                                }}
                                transition="all 0.15s ease"
                              />
                            </Tooltip>
                          </Td>
                        </Tr>
                      );
                    })}
                  </Tbody>
                </Table>
              </Box>
            </Box>
          </>
        )}

        {/* --- Pagination Controls at Bottom matching Reference Screenshot --- */}
        {!loading && displayedCameras.length > 0 && (
          <Flex
            justifyContent="center"
            alignItems="center"
            gap="6px"
            mt="20px"
            pt="12px"
            fontFamily="Manrope, sans-serif"
          >
            {/* Prev Button */}
            <Button
              onClick={() => handlePageChange(currentPage - 1)}
              isDisabled={currentPage === 1}
              h="34px"
              px="14px"
              borderRadius="8px"
              borderWidth="1px"
              borderColor={cardBorder}
              bg={cardBg}
              color={tableTextColor}
              fontFamily="Manrope, sans-serif"
              fontWeight="600"
              fontSize="12px"
              _hover={{ bg: tableHeaderBg, borderColor: "#3F77A5" }}
              _disabled={{ opacity: 0.45, cursor: "not-allowed" }}
            >
              Prev
            </Button>

            {/* Page Number Buttons */}
            {(() => {
              const pageNumbers = [];
              const delta = 1;

              for (let i = 1; i <= totalPages; i++) {
                if (
                  i === 1 ||
                  i === totalPages ||
                  (i >= currentPage - delta && i <= currentPage + delta)
                ) {
                  pageNumbers.push(i);
                } else if (
                  (i === currentPage - delta - 1 && i > 1) ||
                  (i === currentPage + delta + 1 && i < totalPages)
                ) {
                  if (pageNumbers[pageNumbers.length - 1] !== "...") {
                    pageNumbers.push("...");
                  }
                }
              }

              return pageNumbers.map((page, idx) =>
                page === "..." ? (
                  <Text key={`ellipsis-${idx}`} mx={1} color={subtextColor} fontSize="12px">
                    ...
                  </Text>
                ) : (
                  <Button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    h="34px"
                    minW="34px"
                    px="10px"
                    borderRadius="8px"
                    borderWidth={currentPage === page ? "0px" : "1px"}
                    borderColor={cardBorder}
                    bg={currentPage === page ? "#3F77A5" : cardBg}
                    color={currentPage === page ? "white" : tableTextColor}
                    fontFamily="Manrope, sans-serif"
                    fontWeight={currentPage === page ? "700" : "600"}
                    fontSize="12px"
                    _hover={{
                      bg: currentPage === page ? "#2B5273" : tableHeaderBg,
                    }}
                  >
                    {page}
                  </Button>
                )
              );
            })()}

            {/* Next Button */}
            <Button
              onClick={() => handlePageChange(currentPage + 1)}
              isDisabled={currentPage >= totalPages}
              h="34px"
              px="14px"
              borderRadius="8px"
              borderWidth="1px"
              borderColor={cardBorder}
              bg={cardBg}
              color={tableTextColor}
              fontFamily="Manrope, sans-serif"
              fontWeight="600"
              fontSize="12px"
              _hover={{ bg: tableHeaderBg, borderColor: "#3F77A5" }}
              _disabled={{ opacity: 0.45, cursor: "not-allowed" }}
            >
              Next
            </Button>
          </Flex>
        )}
      </Box>

      {/* ========================================================================= */}
      {/* 4. STREAM & PTZ MODAL                                                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isStreamModalOpen}
        onClose={handleCloseModal}
        size="4xl"
        isCentered
      >
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
        <ModalContent
          bg={modalBg}
          color={titleColor}
          borderRadius="12px"
          borderWidth="1px"
          borderColor={cardBorder}
          overflow="hidden"
          boxShadow="0 10px 30px rgba(0,0,0,0.2)"
        >
          <ModalHeader
            borderBottom="1px solid"
            borderColor={cardBorder}
            py={3}
            px={5}
            fontFamily="Manrope, sans-serif"
            fontSize="16px"
            fontWeight="700"
          >
            <Flex justifyContent="space-between" alignItems="center">
              <HStack spacing={2}>
                <Box
                  w="8px"
                  h="8px"
                  borderRadius="full"
                  bg={selectedCamera?.status ? "#10B981" : "#EF4444"}
                />
                <Text>
                  Live Stream:{" "}
                  <Text as="span" color="#3F77A5">
                    {selectedCamera?.DeviceId}
                  </Text>
                </Text>
              </HStack>
            </Flex>
          </ModalHeader>
          <ModalCloseButton top="12px" right="14px" />

          <ModalBody p={5}>
            {isStreamModalOpen && selectedCamera && (
              <Flex
                direction={{ base: "column", lg: "row" }}
                gap={4}
                alignItems="flex-start"
              >
                {/* Video Player Section */}
                <Box
                  flex="1"
                  width="100%"
                  position="relative"
                  borderRadius="10px"
                  overflow="hidden"
                  bg="black"
                >
                  {selectedCamera.DeviceId &&
                  selectedCamera.DeviceId.startsWith("SSAN") ? (
                    <SimpleFLVPlayer
                      url={selectedCamera.streamUrl}
                      muted={isMuted}
                      style={{
                        width: "100%",
                        height: "450px",
                        borderRadius: "10px",
                      }}
                    />
                  ) : (
                    <Player
                      ref={playerRef}
                      device={selectedCamera}
                      initialPlayUrl={selectedCamera.streamUrl}
                      muted={isMuted}
                      style={{
                        width: "100%",
                        height: "450px",
                        borderRadius: "10px",
                      }}
                      showControls={false}
                    />
                  )}

                  {/* Mute Toggle Overlay */}
                  <IconButton
                    position="absolute"
                    bottom="20px"
                    right="20px"
                    zIndex="20"
                    size="md"
                    bg="rgba(0,0,0,0.6)"
                    _hover={{ bg: "black" }}
                    color="white"
                    borderRadius="full"
                    icon={
                      isMuted ? (
                        <BsVolumeMute fontSize="22px" />
                      ) : (
                        <BsVolumeUp fontSize="22px" />
                      )
                    }
                    onClick={() => setIsMuted(!isMuted)}
                    aria-label="Toggle Mute"
                  />

                  {/* Device Info Overlay */}
                  <Box
                    position="absolute"
                    bottom="0"
                    left="0"
                    right="0"
                    bg="rgba(0, 0, 0, 0.55)"
                    backdropFilter="blur(2px)"
                    p={2.5}
                    zIndex="10"
                  >
                    <Text
                      color="white"
                      fontSize="13px"
                      fontWeight="600"
                      fontFamily="Manrope, sans-serif"
                    >
                      {selectedCamera.district || "N/A"} /{" "}
                      {selectedCamera.DeviceId}
                    </Text>
                  </Box>
                </Box>

                {/* PTZ Controls Side Panel */}
                <Box
                  w={{ base: "100%", lg: "220px" }}
                  p={4}
                  borderRadius="10px"
                  bg={modalSectionBg}
                  borderWidth="1px"
                  borderColor={cardBorder}
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                >
                  <Text
                    fontWeight="700"
                    fontSize="13px"
                    color={titleColor}
                    fontFamily="Manrope, sans-serif"
                    mb={3}
                  >
                    PTZ Controls
                  </Text>
                  <CameraPTZ
                    deviceId={selectedCamera.DeviceId}
                    onZoomIn={() => playerRef.current?.zoomIn()}
                    onZoomOut={() => playerRef.current?.zoomOut()}
                    onFullscreen={() => playerRef.current?.handleFullscreen()}
                    position="static"
                    transform="none"
                  />
                </Box>
              </Flex>
            )}
          </ModalBody>

          <ModalFooter borderTop="1px solid" borderColor={cardBorder} py={3} px={5}>
            <Button
              onClick={handleCloseModal}
              h="34px"
              px="16px"
              borderRadius="8px"
              borderWidth="1px"
              borderColor={cardBorder}
              bg={cardBg}
              color={titleColor}
              fontFamily="Manrope, sans-serif"
              fontWeight="600"
              fontSize="12px"
              _hover={{ bg: tableHeaderBg }}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Camera Settings Modal */}
      {selectedCamera && (
        <CameraSettingsModal
          isOpen={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          deviceId={selectedCamera.DeviceId}
          cameraName={selectedCamera.name}
          productType={selectedCamera.productType}
        />
      )}
    </Box>
  );
};

export default Listview;
