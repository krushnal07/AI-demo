import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import moment from "moment";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { FaDownload, FaFilePdf } from "react-icons/fa";
import {
  Box as ChakraBox,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  HStack,
  Button,
  Select,
  Input,
  Flex,
  Text,
  Spinner,
  VStack,
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
  Tab,
  Icon,
  Grid,
  RadioGroup,
  Radio,
  Box,
  Link as ChakraLink,
  Image,
  useColorMode,
  useColorModeValue,
   Heading
} from "@chakra-ui/react";
import * as XLSX from "xlsx";
import { Link as RouterLink, useLocation } from "react-router-dom";


// --- Helper Styles ---
const tableHeaderRowStyle = {
  position: "sticky",
  top: 0,
  zIndex: 1,
  borderRadius: "5px"
};

const tableHeaderStyle = {
  padding: "8px 10px",
  verticalAlign: "middle",
  textAlign: "center",
  position: "relative",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const tableDataStyle = {
  padding: "8px 10px", // Adjust padding as needed
  verticalAlign: "middle", // Crucial for vertical alignment
  textAlign: "center", // Center text horizontally within the cell
  whiteSpace: "nowrap", // Prevent text from wrapping, good for fixed-width columns
  overflow: "hidden",   // Hide overflowing content
  textOverflow: "ellipsis", // Add ellipsis for overflowing text
  position: "relative",
  //  fontSize: "14px", // Keep font size consistent with header if desired
  // Added for consistent border in the body if you decide to add it back
  borderBottom: "1px solid #6c8aa5ff",
};
const downloadButtonStyle = {
  backgroundColor: "#c8d6e5",
  color: "black",
  border: "none",
  padding: "8px 12px",
  cursor: "pointer",
  fontSize: "14px",
  display: "flex",
  alignItems: "center",
  gap: "5px",
  borderRadius: "5px",
};

const tableContainerStyle = {
  maxHeight: "calc(180vh - 500px)",
  overflowY: "auto",
  overflowX: "auto",
  border: "1px solid #b3b8d6ff",
  borderRadius: "5px",

};

// --- End Helper Styles ---
const VerticalLine = () => (
  <span
    style={{
      position: "absolute",
      right: "0",
      top: "50%",
      transform: "translateY(-50%)",
      height: "60%",
      width: "2px",
      backgroundColor: "#3F77A5",
    }}
  ></span>
);

const Boxes = () => {
  // Main Data State
  const [allFetchedCameras, setAllFetchedCameras] = useState([]);
  const [displayedCameras, setDisplayedCameras] = useState([]);
  
  // Filter States
  const [searchDeviceId, setSearchDeviceId] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [loading, setLoading] = useState(false);
  const [districtsList, setDistrictsList] = useState([]);
  const [selectedDistrictName, setSelectedDistrictName] = useState("");
  const [assembliesList, setAssembliesList] = useState([]);
  const [selectedAssemblyValue, setSelectedAssemblyValue] = useState("");
  const [psOption, setPsOption] = useState("camera"); // 'ps' or 'camera'
  const [fromTime, setFromTime] = useState('');
  const [toTime, setToTime] = useState('');
  
  // Date and Time Filter States
  // 1. Set Default to TODAY
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState(moment().format("HH:mm"));
  const text = useColorModeValue('gray.500', 'gray.400');

  // Stream Modal
  const {
    isOpen: isStreamModalOpen,
    onOpen: onStreamModalOpen,
    onClose: onStreamModalClose,
  } = useDisclosure();
  const [selectedCamera, setSelectedCamera] = useState(null);

  const { colorMode } = useColorMode();
   const location = useLocation();

  // --- 1. Fetch Data from Downtime API ---
const fetchReportData = useCallback(async () => {
    setLoading(true);
    const DOWNTIME_API = `${process.env.REACT_APP_URL}/api/downtime/report`;
    const MASTER_LIST_API = `${process.env.REACT_APP_URL}/api/camera/getcurrentUserCameras`;
    const userEmail = localStorage.getItem("email") || ""; 

    try {
      const [downtimeRes, masterRes] = await Promise.all([
        axios.get(DOWNTIME_API, { params: { date: selectedDate } }),
        axios.post(MASTER_LIST_API, { email: userEmail })
      ]);

      const downtimeData = downtimeRes.data.data || [];
      const masterCameras = Array.isArray(masterRes.data) ? masterRes.data : [];

      // Create a map of raw intervals for each camera ID
      const downtimeMap = {};
      downtimeData.forEach(item => {
          const deviceId = item.camera_id;
          if (!downtimeMap[deviceId]) downtimeMap[deviceId] = [];
          
          downtimeMap[deviceId].push({
              start: item.start_time,
              end: (item.close_time && item.close_time !== 'null') ? item.close_time : null
          });
      });

      const consolidatedData = masterCameras.map((cam) => {
          const deviceId = cam.deviceId;
          let loc = "N/A";
          if (Array.isArray(cam.locations) && cam.locations.length > 0) {
              loc = cam.locations[0];
          } else if (typeof cam.locations === 'string') {
              loc = cam.locations;
          }

          return {
              DeviceId: deviceId,
              rowDate: selectedDate,
              district: cam.dist_name || "N/A",
              assembly: cam.accName || "N/A",
              ps_id: cam.ps_id || "N/A",
              location: loc,
               operatorName: cam.operatorName,
          operatorMobile: cam.operatorMobile,

              // Store the raw intervals for dynamic calculation later
              offlineIntervals: downtimeMap[deviceId] || [], 
          };
      });

      setAllFetchedCameras(consolidatedData);
    } catch (error) {
      console.error("Error fetching data:", error);
      setAllFetchedCameras([]);
    } finally {
      setLoading(false);
    }
}, [selectedDate]);

  // Fetch on mount and when date/time changes
  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // --- 2. Extract Districts/Assemblies for Filters ---
  useEffect(() => {
    const districts = [
      ...new Set(allFetchedCameras.map((c) => c.district).filter(Boolean)),
    ];
    setDistrictsList(districts.sort());
    if (!districts.includes(selectedDistrictName)) {
        setSelectedDistrictName("");
    }
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
    setSelectedAssemblyValue("");
  }, [selectedDistrictName, allFetchedCameras]);

  // --- 3. Filtering Logic ---
  useEffect(() => {
    let data = [...allFetchedCameras];
    
    // 1. FILTER BY DATE (Strict Mode)
    // Only show rows that match the selected date from the filter input
    if (selectedDate) {
        data = data.filter((c) => c.rowDate === selectedDate);
    }

    if (selectedDistrictName) {
      data = data.filter((c) => c.district === selectedDistrictName);
    }
    if (selectedAssemblyValue) {
      data = data.filter((c) => c.assembly === selectedAssemblyValue);
    }
    
    // Search Logic
    if (searchDeviceId) {
      const searchLower = searchDeviceId.toLowerCase();
      if (psOption === "ps") {
        data = data.filter((c) => c.ps_id?.toLowerCase().includes(searchLower));
      } else {
        data = data.filter((c) => c.DeviceId?.toLowerCase().includes(searchLower));
      }
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
    psOption,
    selectedDate // Dependency ensures re-render when date changes
  ]);

  // --- 4. Handlers ---
  const handleDateChange = (event) => {
  const newDate = event.target.value;
  const today = moment().format("YYYY-MM-DD");

  setSelectedDate(newDate);
  setCurrentPage(1);

  if (newDate === today) {
    // If today, set to current HH:mm
    setEndTime(moment().format("HH:mm"));
  } else {
    // If past date, set to 23:59 (Full Day)
    setEndTime("23:59");
  }
  // Start time usually stays 00:00 as per your requirement
  setStartTime("00:00"); 
};
  const handleStartTimeChange = (event) => { setStartTime(event.target.value); setCurrentPage(1); };
  const handleEndTimeChange = (event) => { setEndTime(event.target.value); setCurrentPage(1); };

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

  const handleAssemblyChange = (event) => {
    setSelectedAssemblyValue(event.target.value);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSelectedDistrictName("");
    setSelectedAssemblyValue("");
    setSearchDeviceId("");
    setPsOption("camera");
    setSelectedDate(moment().format("YYYY-MM-DD"));
    setStartTime("00:00");
    setEndTime(moment().format("HH:mm"));
    setCurrentPage(1);
  };

  const handleViewStream = (camera) => {
    setSelectedCamera(camera);
    onStreamModalOpen();
  };

  const handleCloseModal = () => {
    onStreamModalClose();
    setSelectedCamera(null);
  };

  // --- 5. Calculation Logic ---
const calculateDurationStats = (intervals = []) => {
    const dateStr = selectedDate || moment().format("YYYY-MM-DD");
    
    // 1. Define the Search Window
    const windowStart = moment(`${dateStr} ${startTime}`, "YYYY-MM-DD HH:mm");
    let windowEnd = moment(`${dateStr} ${endTime}`, "YYYY-MM-DD HH:mm");
    if (windowEnd.isBefore(windowStart)) windowEnd.add(1, 'day');

    const totalMs = windowEnd.diff(windowStart);
    const totalMinutes = Math.floor(totalMs / 60000);
    
    let offlineMinutesSum = 0;
    let actualOfflineMs = 0;

    // 2. Process intervals to match Downtime Report Logic
    intervals.forEach(interval => {
        const formats = ['DD-MM-YYYY HH:mm:ss', 'YYYY-MM-DD HH:mm:ss'];
        const start = moment(interval.start, formats);
        const end = interval.end ? moment(interval.end, formats) : windowEnd;

        const overlapStart = moment.max(windowStart, start);
        const overlapEnd = moment.min(windowEnd, end);
        const diffMs = overlapEnd.diff(overlapStart);

        // Only count entries >= 60 seconds
        if (diffMs >= 60000) {
            // Floor individual entries to match Downtime Report sums
            offlineMinutesSum += Math.floor(diffMs / 60000);
            actualOfflineMs += diffMs;
        }
    });

    let onlineMinutes = totalMinutes - offlineMinutesSum;
    let offlineMinutes = offlineMinutesSum;

    // 3. THE FIX: Apply 60-second rule to the calculated RESULTS
    const actualOnlineMs = totalMs - actualOfflineMs;
    
    // If the camera was only "Online" for a few seconds (less than 60s),
    // don't show it as 1 minute online. Force it to 0 and move the minute to Offline.
    if (actualOnlineMs < 60000 && onlineMinutes > 0) {
        offlineMinutes += onlineMinutes;
        onlineMinutes = 0;
    }

    // Vice versa: If total offline time is actually less than 60s, force it to 0
    if (actualOfflineMs < 60000 && offlineMinutes > 0) {
        onlineMinutes += offlineMinutes;
        offlineMinutes = 0;
    }

    // 4. Formatter for HH:mm
    const format = (mins) => {
        if (mins <= 0) return "00:00";
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    return {
        total: format(totalMinutes),
        online: format(onlineMinutes),
        offline: format(offlineMinutes)
    };
};
 const handleCSVExport = useCallback(() => {
  // Filter data based on current selection
  let data = [...allFetchedCameras];
  
  if (selectedDate) data = data.filter((c) => c.rowDate === selectedDate);
  if (selectedDistrictName) data = data.filter((c) => c.district === selectedDistrictName);
  if (selectedAssemblyValue) data = data.filter((c) => c.assembly === selectedAssemblyValue);

  const dataToExport = data.map((camera) => {
   const stats = calculateDurationStats(camera.offlineIntervals);
    
    return {
      "Device Id": camera.DeviceId,
      District: camera.district,
      Assembly: camera.assembly,
      
       "Vehicle No.": camera.location,
       "Driver Name": camera.operatorName,
       "Driver Mobile.": camera.operatorMobile,
      "Date": camera.rowDate,
      "Total Time": stats.total,
      "Online Time": stats.online,
      "Offline Time": stats.offline,
    };
  });

  if (dataToExport.length === 0) {
    alert("No data to export.");
    return;
  }

  // --- DYNAMIC FILENAME LOGIC ---
  let fileName = "Consolidation_Report";
  if (selectedDistrictName) fileName += `_${selectedDistrictName}`;
  if (selectedAssemblyValue) fileName += `_${selectedAssemblyValue}`;
  if (selectedDate) fileName += `_${selectedDate}`;
  fileName += ".xlsx";
  // ------------------------------

  const ws = XLSX.utils.json_to_sheet(dataToExport);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Camera Data");
  XLSX.writeFile(wb, fileName);
}, [allFetchedCameras, selectedDistrictName, selectedAssemblyValue, selectedDate, startTime, endTime]);

 const handlePDFExport = useCallback(() => {
  let data = [...allFetchedCameras];

  if (selectedDate) data = data.filter((c) => c.rowDate === selectedDate);
  if (selectedDistrictName) data = data.filter((c) => c.district === selectedDistrictName);
  if (selectedAssemblyValue) data = data.filter((c) => c.assembly === selectedAssemblyValue);

  if (data.length === 0) {
    alert("No data to export.");
    return;
  }

  // --- DYNAMIC FILENAME LOGIC ---
  let fileName = "Consolidation_Report";
  if (selectedDistrictName) fileName += `_${selectedDistrictName}`;
  if (selectedAssemblyValue) fileName += `_${selectedAssemblyValue}`;
  if (selectedDate) fileName += `_${selectedDate}`;
  fileName += ".pdf";
  // ------------------------------

  const pdf = new jsPDF("l", "mm", "a4");
  pdf.setFontSize(14);
  pdf.text("Online Offline Report", 14, 15);

  pdf.setFontSize(10);
  pdf.text(
    `Date: ${selectedDate || "All"} | District: ${selectedDistrictName || "All"} | Assembly: ${selectedAssemblyValue || "All"}`,
    14,
    22
  );
  

  const tableBody = data.map((camera) => {
    const stats = calculateDurationStats(camera.offlineIntervals);
    return [
      camera.DeviceId,
      camera.district,
      camera.assembly,
      // camera.ps_id,
      camera.location,
      camera.operatorName,
      camera.operatorMobile,
      camera.rowDate,
      stats.total,
      stats.online,
      stats.offline,
    ];
  });

  autoTable(pdf, {
    startY: 28,
    head: [[
      "Device Id", "District", "Assembly", "Vehicle No","Driver Name","Driver MobileNo.","Date", "Total Time", "Online Time", "Offline Time",
    ]],
    body: tableBody,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [22, 160, 133], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
  });

  pdf.save(fileName);
}, [allFetchedCameras, selectedDistrictName, selectedAssemblyValue, selectedDate, startTime, endTime]);
  
  // --- Theme Variables ---
  const buttonGradientColor = useColorModeValue(
    "linear-gradient(93.5deg,#CDDEEB ,  #9CBAD2 94.58%)",
    "linear-gradient(93.5deg, #2A2A2A 0.56%, #030711 50.58%)"
  );
  const radioButtonColor = useColorModeValue("#9CBAD2", "#CDDEEB");
  const createFilterHandler = (setter) => (e) => { setter(e.target.value); setCurrentPage(1); };

  return (
    <div style={{ fontFamily: "Arial, sans-serif" }}>
      <ChakraBox
        borderRadius="lg"
       // p={4}
        h={"fit-content"}
        flexDirection="column"
        gap={4}
        display="flex"
      >
        {/* Header Row */}
         <Flex justify="space-between" align="center" >
         <Text fontWeight={400} fontSize="26px" color={text}>
                                            Consolidated Camera Report
                                           </Text>

           <HStack
           // bg="gray.100"
            
            border="2px solid"  
             borderColor="blue.400"
           // p="4px"
            borderRadius="full"
            spacing={0}
          >
            {/* Route View */}
            <Box
              as={RouterLink}
              to="/DowntimeReport"
              px={4}
              py={1.5}
               borderColor="blue.400"
              borderRadius="full"
              fontSize="sm"
              fontWeight="medium"
              bg={location.pathname === "/DowntimeReport" ? "gray.300" : "transparent"}
              boxShadow={location.pathname === "/DowntimeReport" ? "sm" : "none"}
              color={location.pathname === "/DowntimeReport" ? "blue.600" : "gray.600"}
              _hover={{ textDecoration: "none" }}
            >
              Downtime Report
            </Box>
        
            {/* List View */}
            <Box
              as={RouterLink}
              to="/CameraReport"
              px={4}
              py={1.5}
              borderRadius="full"
              fontSize="sm"
              fontWeight="medium"
              bg={location.pathname === "/CameraReport" ? "gray.300" : "transparent"}
              boxShadow={location.pathname === "/CameraReport" ? "sm" : "none"}
              color={location.pathname === "/CameraReport" ? "blue.600" : "gray.600"}
              _hover={{ textDecoration: "none" }}
            >
              Consolidated Camera Report
            </Box>
          </HStack>
          </Flex>
      

        {/* Filter Row */}
       <Grid
  templateColumns={{
    base: "1fr",
    md: "repeat(3, 1fr)",
    lg: "repeat(7, 1fr)",
  }}
  gap={4}
  alignItems="center"
//  p={4}
>
  {/* District */}
  <Select
    placeholder="Select District"
    bg={buttonGradientColor}
    borderRadius="12px"
    height="34px"
    fontSize="12px"
    value={selectedDistrictName}
    onChange={handleDistrictChange}
    color={useColorModeValue("black", "white")}
    sx={{
      "> option": {
        bg: useColorModeValue("white", "gray.700"),
        color: useColorModeValue("black", "white"),
      },
    }}
  >
    {districtsList.map((d) => (
      <option key={d} value={d}>{d}</option>
    ))}
  </Select>

  {/* Assembly */}
  <Select
    placeholder="Select Assembly"
    bg={buttonGradientColor}
    borderRadius="12px"
    height="34px"
    fontSize="12px"
    value={selectedAssemblyValue}
    onChange={handleAssemblyChange}
    isDisabled={!selectedDistrictName || assembliesList.length === 0}
    color={useColorModeValue("black", "white")}
    sx={{
      "> option": {
        bg: useColorModeValue("white", "gray.700"),
        color: useColorModeValue("black", "white"),
      },
    }}
  >
    {assembliesList.map((a) => (
      <option key={a} value={a}>{a}</option>
    ))}
  </Select>

  {/* Camera ID Search (PS removed) */}
  <Input
    placeholder="Search Camera ID"
    bg={buttonGradientColor}
    borderRadius="12px"
    height="34px"
    fontSize="12px"
    value={searchDeviceId}
    onChange={handleSearchDeviceIdChange}
    color={useColorModeValue("black", "white")}
    _placeholder={{ color: useColorModeValue("gray.600", "gray.400") }}
    borderColor="transparent"
  />

  {/* Date */}
 {/* Date */}
<Input
  type="date"
  value={selectedDate}
  onChange={handleDateChange} // Use the new function here
  bg={buttonGradientColor}
  borderRadius="12px"
  height="34px"
  fontSize="12px"
  color={useColorModeValue("black", "white")}
  borderColor="transparent"
/>

{/* From Time */}
<Input
  type="time"
  value={startTime}
  onChange={(e) => { setStartTime(e.target.value); setCurrentPage(1); }} // Changed from setFromTime
  bg={buttonGradientColor}
  borderRadius="12px"
  height="34px"
  fontSize="12px"
  color={useColorModeValue("black", "white")}
  borderColor="transparent"
/>

{/* To Time */}
<Input
  type="time"
  value={endTime}
  onChange={(e) => { setEndTime(e.target.value); setCurrentPage(1); }} // Changed from setToTime
  bg={buttonGradientColor}
  borderRadius="12px"
  height="34px"
  fontSize="12px"
  color={useColorModeValue("black", "white")}
  borderColor="transparent"
/>

  {/* Download */}
<HStack
  spacing={2}
  gridColumn={{ base: "span 1", md: "span 3", lg: "span 1" }}
>
  {/* XLSX Button */}
  <Button
    bg={buttonGradientColor}
    borderRadius="12px"
    height="34px"
    fontSize="12px"
    color={useColorModeValue("black", "white")}
    size="sm"
    leftIcon={<FaDownload size={12} />}
    _hover={{
      bg: useColorModeValue(
        "linear-gradient(93.5deg, #8EABC5 , #C4D7E7 94.58%)",
        "linear-gradient(93.5deg, #1F1F1F 0.56%, #010307 50.58%)"
      ),
    }}
    onClick={handleCSVExport}
    isLoading={loading === "excel"}
    loadingText="Downloading..."
  >
    XLSX
  </Button>

  {/* PDF Button */}
  <Button
    bg={buttonGradientColor}
    borderRadius="12px"
    height="34px"
    fontSize="12px"
    color={useColorModeValue("black", "white")}
    size="sm"
    leftIcon={<FaFilePdf size={12} />}
    _hover={{
      bg: useColorModeValue(
        "linear-gradient(93.5deg, #8EABC5 , #C4D7E7 94.58%)",
        "linear-gradient(93.5deg, #1F1F1F 0.56%, #010307 50.58%)"
      ),
    }}
    onClick={handlePDFExport}
    isLoading={loading === "pdf"}
    loadingText="Downloading..."
  >
    PDF
  </Button>
</HStack>
</Grid>

        {loading ? (
          <Flex justifyContent="center" alignItems="center" height="200px" flexDirection="column" gap={2}>
            <Spinner size="xl" color="blue.500" />
            <Text>Fetching Report Data...</Text>
          </Flex>
        ) : (
          <>
            <div style={tableContainerStyle}>
              <Table
                variant="simple"
                size="sm"
                borderRadius="15"
              >
                <Thead>
                  <Tr style={tableHeaderRowStyle} bg={buttonGradientColor}>
                    <Th style={tableHeaderStyle}>Sr No.<VerticalLine /></Th>
                    
                    <Th style={tableHeaderStyle}>District<VerticalLine /></Th>
                    <Th style={tableHeaderStyle}>Assembly<VerticalLine /></Th>
                   
                    <Th style={tableHeaderStyle}>Vehicle No.<VerticalLine /></Th>
                    <Th style={tableHeaderStyle}>Driver Name<VerticalLine /></Th>
                    <Th style={tableHeaderStyle}>Driver Mobile<VerticalLine /></Th>
                    <Th style={tableHeaderStyle}>Device Id<VerticalLine /></Th>
                    <Th style={tableHeaderStyle}>Total Time<VerticalLine /></Th>
                    <Th style={tableHeaderStyle}>Online Time<VerticalLine /></Th>
                    <Th style={tableHeaderStyle}>Offline Time</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {displayedCameras.length > 0 ? (
                    displayedCameras.map((camera, index) => {
                      // Calculate stats based on the Offline Ms aggregated in fetch
                      const stats = calculateDurationStats(camera.offlineIntervals);

                      return (
                        <Tr key={`${camera.DeviceId}-${index}`}>
                          <Td style={tableDataStyle}>
                            {(currentPage - 1) * itemsPerPage + index + 1}
                            <VerticalLine />
                          </Td>
                          
                          <Td style={tableDataStyle}>
                            {camera.district || "N/A"}
                            <VerticalLine />
                          </Td>
                          <Td style={tableDataStyle}>
                            {camera.assembly || "N/A"}
                            <VerticalLine />
                          </Td>
                          
                          <Td style={tableDataStyle} title={camera.location || "N/A"}>
                            {camera.location || "N/A"}
                            <VerticalLine />
                          </Td>
                          <Td style={tableDataStyle} title={camera.location || "N/A"}>
                            {camera.operatorName || "N/A"}
                            <VerticalLine />
                          </Td>
                          <Td style={tableDataStyle} title={camera.location || "N/A"}>
                            {camera.operatorMobile || "N/A"}
                            <VerticalLine />
                          </Td>
                          <Td style={tableDataStyle}>
                            {camera.DeviceId || "N/A"}
                            <VerticalLine />
                          </Td>
                          {/* Calculated Columns */}
                          <Td style={tableDataStyle}>
                            {stats.total}
                            <VerticalLine />
                          </Td>
                          <Td style={tableDataStyle} color="green.500">
                            {stats.online}
                            <VerticalLine />
                          </Td>
                          <Td style={tableDataStyle} color="red.500">
                            {stats.offline}
                          </Td>
                        </Tr>
                      );
                    })
                  ) : (
                    <Tr>
                      <Td colSpan="9" textAlign="center" style={tableDataStyle} p={5}>
                        No Records found for selected date.
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </div>

            {allFetchedCameras.length > 0 && (
              <Flex justifyContent="right" mt={4} alignItems="right">
                {/* Previous Button */}
                <Button
                  onClick={() => handlePageChange(currentPage - 1)}
                  isDisabled={currentPage === 1}
                  mr={2}
                  size="sm"
                  variant="ghost"
                  _hover="#9CBAD2"
                  bg={buttonGradientColor}
                >
                  Previous
                </Button>

                {/* Pagination Logic */}
                {(() => {
                  // Calculate total based on *filtered* length
                  const totalFiltered = allFetchedCameras
                    .filter(c => selectedDate ? c.rowDate === selectedDate : true)
                    .filter(c => selectedDistrictName ? c.district === selectedDistrictName : true)
                    .filter(c => selectedAssemblyValue ? c.assembly === selectedAssemblyValue : true)
                    .filter(c => {
                       if (!searchDeviceId) return true;
                       const lower = searchDeviceId.toLowerCase();
                       return psOption === "ps" 
                         ? c.ps_id?.toLowerCase().includes(lower) 
                         : c.DeviceId?.toLowerCase().includes(lower);
                    }).length;

                  const totalPages = Math.ceil(totalFiltered / itemsPerPage);
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
                      <Text key={`ellipsis-${idx}`} mx={2} alignSelf="center">...</Text>
                    ) : (
                      <Button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        size="sm"
                        variant="ghost"
                        mx={1}
                        fontWeight={currentPage === page ? "bold" : "normal"}
                        textDecoration={currentPage === page ? "underline" : "none"}
                        _hover="#9CBAD2"
                        bg={currentPage === page ? "rgba(0,0,0,0.1)" : buttonGradientColor}
                      >
                        {page}
                      </Button>
                    )
                  );
                })()}

                {/* Next Button */}
                <Button
                  onClick={() => handlePageChange(currentPage + 1)}
                  isDisabled={displayedCameras.length < itemsPerPage}
                  ml={2}
                  size="sm"
                  variant="ghost"
                  _hover="#9CBAD2"
                  bg={buttonGradientColor}
                >
                  Next
                </Button>
              </Flex>
            )}
          </>
        )}
      </ChakraBox>

      {/* Modal JSX */}
      <Modal
        isOpen={isStreamModalOpen}
        onClose={handleCloseModal}
        size="4xl"
        isCentered
      >
        <ModalOverlay />
        <ModalContent bg="white" color="Black" borderRadius="lg">
          <ModalHeader>Camera: {selectedCamera?.DeviceId}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
             <Text>Stream not available in Report View.</Text>
          </ModalBody>
          <ModalFooter>
            <Button onClick={handleCloseModal}>Close</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};  

export default Boxes;
