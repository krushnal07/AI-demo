import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { FaDownload, FaCamera } from "react-icons/fa";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
  Button,
  IconButton,
  useDisclosure,
  Text,
  Box,
  Flex,
  Grid,
  Image,
  Badge,
  Spinner,
  Select,
  Input,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  useColorModeValue,
} from "@chakra-ui/react";
import moment from "moment";
import MobileHeader from "../components/MobileHeader";

const AnalyticsImage = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [firstLoadComplete, setFirstLoadComplete] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedSubEvent, setSelectedSubEvent] = useState("");
  const [selectedCamera, setSelectedCamera] = useState("");
  const [modalImage, setModalImage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(25);
  const tableRef = useRef(null);
  const email = localStorage.getItem("email");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [selectedZone, setSelectedZone] = useState("");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [eventCounts, setEventCounts] = useState({});
  const [totalEventCount, setTotalEventCount] = useState(0);
  const [genderCounts, setGenderCounts] = useState({ male: 0, female: 0 });
  const [zoneEventMap] = useState({
    "Parking": { 3: "Fire and Smoke detection", 4: "ANPR", 5: "PPE kit detection", 15: "Smoker detection in no smoking zone", 23: "UnAuthorized Parking", 18: "Vactant Parking Counter", 22: "crowd object detection" },
    "Entry & Ticket area": { 24: "Human activity detection", 3: "Fire and Smoke detection", 15: "Smoker detection in no smoking zone", 5: "PPE kit detection", 19: "Heatmap for crowd", 20: "Head count", 21: "Person counting and Time analyisis in Tickt Kiosk", 22: "crowd object detection", 25: "Person counting and Time analysis in Ticket scanning area" },
    "Paasage Area": { 24: "Human activity detection", 3: "Fire and Smoke detection", 15: "Smoker detection in no smoking zone", 5: "PPE kit detection", 19: "Heatmap for crowd", 20: "Head count", 22: "crowd object detection" },
    "Staff Opertions": { 15: "Smoker detection in no smoking zone", 5: "PPE kit detection", 1: "Facial recognition", 16: "Unauthorized person Detection" },
    "Platform": { 24: "Human activity detection", 3: "Fire and Smoke detection", 17: "Line crossing detection", 15: "Smoker detection in no smoking zone", 5: "PPE kit detection", 19: "Heatmap for crowd", 20: "Head count", 21: "Person counting and Time analyisis in Tickt Kiosk ", 22: "crowd object detection" },
    "Tunnel": { 3: "Fire and Smoke detection", 5: "PPE kit detection", 22: "crowd object detection", 31: "Object detection (Pen,Watch,Mobile)" },
  });

  const [cameraIds, setCameraIds] = useState([]);
  const [personNames, setPersonNames] = useState([]);
  const [selectedPersonName, setSelectedPersonName] = useState("");
  const [isFilterChange, setIsFilterChange] = useState(false);

  // --- Design System Color Tokens Matching Listview ---
  const titleColor = useColorModeValue("#1A2E3D", "#FFFFFF");
  const pageHeading = titleColor;
  const subtextColor = useColorModeValue("#64748B", "#94A3B8");
  const subText = subtextColor;
  const cardBg = useColorModeValue("#FFFFFF", "#1C222D");
  const cardBorder = useColorModeValue("#E2E8F0", "rgba(255, 255, 255, 0.08)");
  const softShadow = useColorModeValue("0 1px 3px rgba(0,0,0,0.06)", "dark-lg");
  const inputBg = useColorModeValue("white", "gray.700");
  const accent = useColorModeValue("#3F77A5", "#63B3ED");
  const accentTint = useColorModeValue("#EBF3FA", "whiteAlpha.200");
  const tableHeaderBg = useColorModeValue("#F0F5FA", "#202734");
  const tableHeaderColor = useColorModeValue("#4A607A", "#94A3B8");
  const tableBorderColor = useColorModeValue("#F1F5F9", "rgba(255, 255, 255, 0.06)");
  const rowAltBg = useColorModeValue("#F8FAFC", "#161C26");
  const tableRowHoverBg = useColorModeValue("#EDF4FA80", "rgba(255, 255, 255, 0.04)");
  const tableTextColor = useColorModeValue("#4A5568", "#CBD5E1");
  const actionBtnBg = useColorModeValue("#3F77A512", "#3F77A522");

  // Calculate total event count whenever eventCounts or selectedEvent changes
  useEffect(() => {
    if (selectedEvent) {
      const total = Object.values(eventCounts).reduce((sum, dateEvents) => {
        return sum + (dateEvents[selectedEvent] || 0);
      }, 0);
      setTotalEventCount(total);
    } else {
      setTotalEventCount(0);
    }
  }, [eventCounts, selectedEvent]);

  // Use useCallback to memoize fetchData
  const fetchData = useCallback(async () => {
    if (!firstLoadComplete || isFilterChange) {
      setLoading(true);
    }
    try {
      const formattedDate = selectedDate ? moment(selectedDate).format("DD/MM/YYYY") : moment().format("DD/MM/YYYY");
      const url = `${process.env.REACT_APP_URL || process.env.REACT_APP_LOCAL_URL}/api/Analytics/getanalyticsimages?email=${email}&date=${formattedDate}`;
      const response = await axios.get(url);

      if (response.data && response.data.data) {
        const analyticsData = response.data.data;
        if (Array.isArray(analyticsData)) {
          const validData = analyticsData.filter(
            (item) => item && item.imgurl && item.sendtime && item.cameradid && item.cameraDetails?.deviceId
          );
          setData(validData);
          setCameraIds([...new Set(validData.map((item) => item.cameradid))]);
          setPersonNames([...new Set(validData.map((item) => item.person_name).filter(Boolean))].sort());
        } else {
          setData([]);
          setCameraIds([]);
          setPersonNames([]);
        }
      } else {
        setData([]);
        setCameraIds([]);
        setPersonNames([]);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Error fetching data");
    } finally {
      if (!firstLoadComplete) {
        setLoading(false);
        setFirstLoadComplete(true);
      } else if (isFilterChange) {
        setLoading(false);
        setIsFilterChange(false);
      }
    }
  }, [email, selectedDate, firstLoadComplete, isFilterChange]);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 300000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  const filterData = useCallback(
    (date, event, camera, zone, subEvent, personName) => {
      setFilteredData(() => {
        let filtered = data;

        if (date) {
          const targetDate = moment.utc(date);
          filtered = filtered.filter((item) => {
            if (!item.sendtime) return false;
            const itemSendTime = moment.utc(item.sendtime);
            return itemSendTime.format("YYYY-MM-DD") === targetDate.format("YYYY-MM-DD");
          });
        }

        if (camera) {
          filtered = filtered.filter((item) => item.cameradid === camera);
        }

        if (zone) {
          const zoneEventIds = Object.keys(zoneEventMap[zone]).map(Number);
          filtered = filtered.filter((item) => zoneEventIds.includes(item.an_id));
        }

        if (event) {
          filtered = filtered.filter((item) => item.an_id === parseInt(event, 10));
        }

        if (event === "1" && subEvent) {
          filtered = filtered.filter((item) => {
            if (subEvent === "known") return item.person_name && item.person_name !== "Unknown";
            if (subEvent === "unknown") return !item.person_name || item.person_name === "Unknown";
            return true;
          });
        }

        if (personName) {
          filtered = filtered.filter((item) => item.person_name === personName);
          filtered = [...filtered].sort(
            (a, b) => moment.utc(a.sendtime).valueOf() - moment.utc(b.sendtime).valueOf()
          );
        }

        const counts = {};
        let latestGenderRecord = { timestamp: null, male: 0, female: 0 };

        filtered.forEach((item) => {
          if (!item.sendtime) return;
          const itemDate = moment.utc(item.sendtime).format("YYYY-MM-DD");
          const eventId = item.an_id.toString();
          if (!counts[itemDate]) counts[itemDate] = {};
          if (!counts[itemDate][eventId]) counts[itemDate][eventId] = 0;
          counts[itemDate][eventId]++;

          if (item.an_id === 30) {
            const itemTimestamp = moment(item.sendtime);
            if (!latestGenderRecord.timestamp || itemTimestamp.isAfter(latestGenderRecord.timestamp)) {
              latestGenderRecord = {
                timestamp: itemTimestamp,
                male: item.male_count ? parseInt(item.male_count, 10) : 0,
                female: item.female_count ? parseInt(item.female_count, 10) : 0,
              };
            }
          }
        });

        setEventCounts(counts);
        setGenderCounts({ male: latestGenderRecord.male, female: latestGenderRecord.female });
        setCurrentPage(1);
        return filtered;
      });
    },
    [data, zoneEventMap]
  );

  useEffect(() => {
    if (data.length > 0) {
      filterData(selectedDate, selectedEvent, selectedCamera, selectedZone, selectedSubEvent, selectedPersonName);
    }
  }, [data, selectedDate, selectedEvent, selectedCamera, selectedZone, filterData, selectedSubEvent, selectedPersonName]);

  const defaultEventMap = {
    40: "Max Person",
    
    1:"facial recognition",
    
    43:"Intruder",
    42:"Idle WorkStation",
    17:"line crossing",
    100:"Heatmap"
  };
  const countEmailEventMap = {};
  const countEmails = ["count@vmukti.com", "maheshwara@gmail.com", "Lakshmi@gmail.com", "roopa@gmail.com"];
  const fullZoneEventMap = {
    default: countEmails.includes(email) ? countEmailEventMap : defaultEventMap,
  };
  const currentEventMap = selectedZone ? zoneEventMap[selectedZone] : fullZoneEventMap.default;

  const handleDateChange = (event) => {
    setSelectedDate(event.target.value);
    setIsFilterChange(true);
    fetchData();
  };
  const handleEventChange = (event) => {
    setSelectedEvent(event.target.value);
    if (event.target.value !== "1") {
      setSelectedPersonName("");
    }
    setIsFilterChange(true);
    fetchData();
  };
  const handleCameraChange = (event) => {
    setSelectedCamera(event.target.value);
    setIsFilterChange(true);
    fetchData();
  };
  const handlePersonNameChange = (event) => {
    setSelectedPersonName(event.target.value);
  };
  const handleImageClick = (imgUrl) => {
    setModalImage(imgUrl);
    onOpen();
  };
  const closeModal = () => {
    setModalImage(null);
    onClose();
  };

  const exportToPDF = async () => {
    setPdfLoading(true);
    try {
      const countUsers = ["count@vmukti.com", "maheshwara@gmail.com", "Lakshmi@gmail.com", "roopa@gmail.com"];
      const isCountUser = countUsers.includes(email?.toLowerCase());
      const pdf = new jsPDF("l", "mm", "a4");
      pdf.setFontSize(18);
      pdf.text("Analytics Image Data", 15, 15);
      pdf.setFontSize(12);

      let startY = 30;
      if (selectedEvent === "30") {
        pdf.setFontSize(11);
        pdf.text(`Latest Male Count: ${genderCounts.male}`, 15, 35);
        pdf.text(`Latest Female Count: ${genderCounts.female}`, 80, 35);
        startY = 40;
      }

      const headers = [
        isCountUser
          ? ["S.No", "Location", "Camera ID", "Detection Time", "Detection Image", "Analytics Type", "Count"]
          : ["S.No", "Location", "Camera ID", "Detection Time", "Detection Image", "Analytics Type"],
      ];

      const body = [];
      const imagePromises = [];
      const imageSize = 30;
      const limitedData = filteredData.slice(0, 500);

      for (const [index, item] of limitedData.entries()) {
        if (!item) continue;
        const rowData = [
          (index + 1).toString(),
          item.cameraDetails?.locations?.[0]?.toString() || "N/A",
          item.cameradid?.toString() || "N/A",
          item.sendtime ? moment.utc(item.sendtime).format("DD-MM-YYYY HH:mm:ss") : "N/A",
          "",
          currentEventMap[item.an_id] || "No Event Occurred",
        ];
        if (isCountUser) rowData.push(item.ImgCount?.toString() || "0");
        body.push(rowData);

        if (item.imgurl) {
          imagePromises.push(
            toDataURL(item.imgurl)
              .then(({ base64Url }) => ({ index, base64Url: base64Url || null }))
              .catch((err) => {
                console.error("Image Conversion Error:", err);
                return { index, base64Url: null };
              })
          );
        }
      }

      const images = await Promise.all(imagePromises);

      pdf.autoTable({
        head: headers,
        body,
        startY,
        theme: "grid",
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: { 4: { cellWidth: imageSize, minCellHeight: imageSize } },
        headStyles: { fillColor: [200, 214, 229], textColor: [0, 0, 0], fontStyle: "bold" },
        didDrawCell: function (dataArg) {
          if (dataArg.column.index === 4 && dataArg.section === "body") {
            const imageObj = images.find((img) => img.index === dataArg.row.index);
            if (imageObj?.base64Url) {
              try {
                pdf.addImage(imageObj.base64Url, "JPEG", dataArg.cell.x + 2, dataArg.cell.y + 2, imageSize - 4, imageSize - 4);
              } catch (imgError) {
                console.error("Error adding image to PDF:", imgError);
              }
            }
          }
        },
      });

      pdf.save("Analytics_Image_Data.pdf");
    } finally {
      setPdfLoading(false);
    }
  };

  const toDataURL = useCallback((url) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 200;
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
        if (height > MAX_HEIGHT) {
          width *= MAX_HEIGHT / width;
          height = MAX_HEIGHT;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve({ base64Url: canvas.toDataURL("image/jpeg", 0.7) });
      };
      img.onerror = (error) => reject(error);
      img.src = url;
    });
  }, []);

  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredData.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(filteredData.length / recordsPerPage);

  const getVisiblePageNumbers = () => {
    const visiblePages = [];
    visiblePages.push(1);
    if (currentPage > 3) visiblePages.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      visiblePages.push(i);
    }
    if (totalPages - 2 > currentPage) visiblePages.push("...");
    if (totalPages > 1) visiblePages.push(totalPages);
    return visiblePages;
  };
  const visiblePages = getVisiblePageNumbers();
  const goToPage = (pageNumber) => {
    if (typeof pageNumber === "number" && pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const showCountColumn = (anId) => selectedEvent !== "" && (anId === 20 || anId === 21);
  const showNumberPlateColumn = (evt) => evt === "4";
  const showPersonNameColumn = (evt) => evt === "1";
  const showGenderCountColumns = (evt) => evt === "30";
  const isCountUser = ["count@vmukti.com", "maheshwara@gmail.com", "Lakshmi@gmail.com", "roopa@gmail.com"].includes(email);
  const shouldShowPagination = filteredData.length > recordsPerPage;

  const noEventBadgeBg = useColorModeValue("#F1F5F9", "rgba(255, 255, 255, 0.08)");
  const noEventBadgeColor = useColorModeValue("#64748B", "#94A3B8");
  const eventBadgeBg = useColorModeValue("#FFF7ED", "rgba(234, 88, 12, 0.15)");
  const eventBadgeColor = useColorModeValue("#D97706", "#FDBA74");

  const thStyle = {
    py: "14px",
    px: "18px",
    fontFamily: "Manrope, sans-serif",
    fontWeight: "700",
    fontSize: "13px",
    color: tableHeaderColor,
    textTransform: "none",
    letterSpacing: "0px",
    whiteSpace: "nowrap",
  };
  const tdStyle = {
    py: "14px",
    px: "18px",
    fontFamily: "Manrope, sans-serif",
    fontSize: "13px",
    color: tableTextColor,
    borderColor: tableBorderColor,
  };

  const getAnalyticsBadgeStyle = (label) => {
    if (!label || label === "No Event") {
      return { bg: noEventBadgeBg, color: noEventBadgeColor };
    }
    return { bg: eventBadgeBg, color: eventBadgeColor };
  };

  const colCount =
    6 +
    (showNumberPlateColumn(selectedEvent) ? 1 : 0) +
    (showPersonNameColumn(selectedEvent) ? 1 : 0) +
    (showCountColumn(parseInt(selectedEvent)) ? 1 : 0) +
    (showGenderCountColumns(selectedEvent) ? 2 : 0) +
    (isCountUser ? 1 : 0);

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
      <MobileHeader title="Analytics Image Data" />

      {/* Image modal */}
      <Modal isOpen={isOpen} onClose={closeModal} isCentered size="4xl">
        <ModalOverlay bg="blackAlpha.700" />
        <ModalContent bg={cardBg} borderRadius="16px" overflow="hidden">
          <ModalCloseButton zIndex={2} />
          <ModalBody display="flex" justifyContent="center" alignItems="center" p={4}>
            <Image src={modalImage} alt="Enlarged view" maxW="100%" maxH="80vh" borderRadius="10px" />
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Header */}
      <Flex
        justify="space-between"
        align={{ base: "flex-start", sm: "center" }}
        mb={4}
        direction={{ base: "column", sm: "row" }}
        gap={3}
      >
        <Box>
          <Text
            fontFamily="'Manrope', sans-serif"
            fontWeight={800}
            fontSize={{ base: "20px", md: "22px" }}
            lineHeight="1.2"
            color={pageHeading}
          >
            Analytics Reports
          </Text>
          <Text
            fontFamily="'Manrope', sans-serif"
            fontSize="13px"
            color={subText}
            mt="2px"
          >
            AI detection records with snapshots, filterable by event, date and camera
          </Text>
        </Box>
        <Button
          leftIcon={<FaDownload size={13} />}
          onClick={exportToPDF}
          isLoading={pdfLoading}
          loadingText="Exporting…"
          bg={accent}
          color="white"
          _hover={{ opacity: 0.9 }}
          size="sm"
          borderRadius="10px"
          fontWeight="600"
        >
          Export PDF
        </Button>
      </Flex>

      {/* Big Container enclosing Filters, Summary, Table and Pagination */}
      <Box
        bg={cardBg}
        border="1px solid"
        borderColor={cardBorder}
        borderRadius="16px"
        boxShadow={softShadow}
        p={{ base: 4, md: 6 }}
        mb={{ base: 6, md: 8 }}
      >
        {/* Filters */}
        <Grid
          templateColumns={{
            base: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(3, 1fr)",
            lg: "repeat(4, 1fr)",
          }}
          gap="20px"
          mb={selectedEvent ? "20px" : "24px"}
        >
          {/* Event Type */}
          <Box>
            <Text
              fontFamily="Manrope, sans-serif"
              fontWeight="700"
              fontSize="10px"
              lineHeight="15px"
              letterSpacing="0.7px"
              textTransform="uppercase"
              color={subText}
              mb="8px"
            >
              EVENT TYPE
            </Text>
            <Select
              value={selectedEvent}
              onChange={handleEventChange}
              bg={inputBg}
              borderColor={cardBorder}
              borderWidth="1px"
              borderRadius="8px"
              h="38px"
              fontFamily="Manrope, sans-serif"
              fontWeight="400"
              fontSize="12px"
              lineHeight="100%"
              letterSpacing="0px"
              color={pageHeading}
              placeholder="All Events"
              _focus={{ borderColor: "#3F77A5", boxShadow: "0 0 0 1px #3F77A5" }}
            >
              {(selectedZone ? Object.entries(zoneEventMap[selectedZone]) : Object.entries(currentEventMap)).map(([key, value]) => (
                <option
                  key={key}
                  value={key}
                  style={{
                    fontFamily: "Manrope, sans-serif",
                    fontWeight: "400",
                    fontSize: "12px",
                  }}
                >
                  {value}
                </option>
              ))}
            </Select>
          </Box>

          {selectedEvent === "1" && (
            <Box>
              <Text
                fontFamily="Manrope, sans-serif"
                fontWeight="700"
                fontSize="10px"
                lineHeight="15px"
                letterSpacing="0.7px"
                textTransform="uppercase"
                color={subText}
                mb="8px"
              >
                RECOGNITION TYPE
              </Text>
              <Select
                value={selectedSubEvent}
                onChange={(e) => setSelectedSubEvent(e.target.value)}
                bg={inputBg}
                borderColor={cardBorder}
                borderWidth="1px"
                borderRadius="8px"
                h="38px"
                fontFamily="Manrope, sans-serif"
                fontWeight="400"
                fontSize="12px"
                lineHeight="100%"
                letterSpacing="0px"
                color={pageHeading}
                _focus={{ borderColor: "#3F77A5", boxShadow: "0 0 0 1px #3F77A5" }}
              >
                <option value="" style={{ fontFamily: "Manrope, sans-serif", fontSize: "12px" }}>All</option>
                <option value="known" style={{ fontFamily: "Manrope, sans-serif", fontSize: "12px" }}>Known</option>
                <option value="unknown" style={{ fontFamily: "Manrope, sans-serif", fontSize: "12px" }}>Unknown</option>
              </Select>
            </Box>
          )}

          {/* Date */}
          <Box>
            <Text
              fontFamily="Manrope, sans-serif"
              fontWeight="700"
              fontSize="10px"
              lineHeight="15px"
              letterSpacing="0.7px"
              textTransform="uppercase"
              color={subText}
              mb="8px"
            >
              SELECT DATE
            </Text>
            <Input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              bg={inputBg}
              borderColor={cardBorder}
              borderWidth="1px"
              borderRadius="8px"
              h="38px"
              fontFamily="Manrope, sans-serif"
              fontWeight="400"
              fontSize="12px"
              lineHeight="100%"
              letterSpacing="0px"
              color={pageHeading}
              _focus={{ borderColor: "#3F77A5", boxShadow: "0 0 0 1px #3F77A5" }}
            />
          </Box>

          {/* Camera ID */}
          <Box>
            <Text
              fontFamily="Manrope, sans-serif"
              fontWeight="700"
              fontSize="10px"
              lineHeight="15px"
              letterSpacing="0.7px"
              textTransform="uppercase"
              color={subText}
              mb="8px"
            >
              CAMERA ID
            </Text>
            <Select
              value={selectedCamera}
              onChange={handleCameraChange}
              bg={inputBg}
              borderColor={cardBorder}
              borderWidth="1px"
              borderRadius="8px"
              h="38px"
              fontFamily="Manrope, sans-serif"
              fontWeight="400"
              fontSize="12px"
              lineHeight="100%"
              letterSpacing="0px"
              color={pageHeading}
              placeholder="All Cameras"
              _focus={{ borderColor: "#3F77A5", boxShadow: "0 0 0 1px #3F77A5" }}
            >
              {cameraIds.map((cameraId) => (
                <option
                  key={cameraId}
                  value={cameraId}
                  style={{
                    fontFamily: "Manrope, sans-serif",
                    fontWeight: "400",
                    fontSize: "12px",
                  }}
                >
                  {cameraId}
                </option>
              ))}
            </Select>
          </Box>

          {selectedEvent === "1" && (
            <Box>
              <Text
                fontFamily="Manrope, sans-serif"
                fontWeight="700"
                fontSize="10px"
                lineHeight="15px"
                letterSpacing="0.7px"
                textTransform="uppercase"
                color={subText}
                mb="8px"
              >
                PERSON NAME
              </Text>
              <Select
                value={selectedPersonName}
                onChange={handlePersonNameChange}
                bg={inputBg}
                borderColor={cardBorder}
                borderWidth="1px"
                borderRadius="8px"
                h="38px"
                fontFamily="Manrope, sans-serif"
                fontWeight="400"
                fontSize="12px"
                lineHeight="100%"
                letterSpacing="0px"
                color={pageHeading}
                placeholder="All Persons"
                _focus={{ borderColor: "#3F77A5", boxShadow: "0 0 0 1px #3F77A5" }}
              >
                {personNames.map((name) => (
                  <option
                    key={name}
                    value={name}
                    style={{
                      fontFamily: "Manrope, sans-serif",
                      fontWeight: "400",
                      fontSize: "12px",
                    }}
                  >
                    {name}
                  </option>
                ))}
              </Select>
            </Box>
          )}
        </Grid>

        {/* Event count summary */}
        {selectedEvent && (
          <Flex
            bg={accentTint}
            border="1px solid"
            borderColor={cardBorder}
            borderRadius="12px"
            p={4}
            mb={5}
            justify="space-between"
            align="center"
            wrap="wrap"
            gap={3}
          >
            <Text fontWeight="700" color={pageHeading}>
              {currentEventMap[selectedEvent] || "Event"} Summary
            </Text>
            <Flex align="center" gap={4} wrap="wrap">
              {selectedEvent === "30" && (
                <>
                  <Text fontSize="14px" color={subText}>
                    Male: <b style={{ color: "#3182ce" }}>{genderCounts.male}</b>
                  </Text>
                  <Text fontSize="14px" color={subText}>
                    Female: <b style={{ color: "#d53f8c" }}>{genderCounts.female}</b>
                  </Text>
                </>
              )}
              <Badge bg={accent} color="white" borderRadius="full" px={3} py={1} fontSize="13px" textTransform="none">
                Total Records: {totalEventCount}
              </Badge>
            </Flex>
          </Flex>
        )}

        {/* Table View matching Listview Layout & Typography */}
        <Box
          borderRadius="10px"
          overflow="hidden"
          border="1px solid"
          borderColor={tableBorderColor}
        >
          <Box overflowX="auto">
            <Table variant="simple" size="md" ref={tableRef}>
              <Thead
                position="sticky"
                top={0}
                zIndex={2}
                bg={tableHeaderBg}
              >
                <Tr borderBottom="1px solid" borderColor={tableBorderColor}>
                  <Th sx={thStyle}>S.No</Th>
                  <Th sx={thStyle}>Location</Th>
                  <Th sx={thStyle}>Camera ID</Th>
                  <Th sx={thStyle}>Detection Time</Th>
                  <Th sx={thStyle} textAlign="center">Image</Th>
                  <Th sx={thStyle} textAlign="center">Analytics Type</Th>
                  {showNumberPlateColumn(selectedEvent) && <Th sx={thStyle}>Number Plate</Th>}
                  {showPersonNameColumn(selectedEvent) && <Th sx={thStyle}>Person Name</Th>}
                  {showCountColumn(parseInt(selectedEvent)) && <Th sx={thStyle}>Count</Th>}
                  {showGenderCountColumns(selectedEvent) && (
                    <>
                      <Th sx={thStyle}>Male Count</Th>
                      <Th sx={thStyle}>Female Count</Th>
                    </>
                  )}
                  {isCountUser && <Th sx={thStyle}>Count</Th>}
                </Tr>
              </Thead>
              <Tbody>
                {loading ? (
                  <Tr>
                    <Td colSpan={colCount} textAlign="center" py={12} borderColor={tableBorderColor}>
                      <Flex direction="column" align="center" gap={3}>
                        <Spinner size="lg" color={accent} thickness="3px" />
                        <Text color={subtextColor} fontFamily="Manrope, sans-serif">Loading…</Text>
                      </Flex>
                    </Td>
                  </Tr>
                ) : error ? (
                  <Tr>
                    <Td colSpan={colCount} textAlign="center" py={12} color="red.500" borderColor={tableBorderColor} fontFamily="Manrope, sans-serif">
                      {error}
                    </Td>
                  </Tr>
                ) : filteredData.length === 0 ? (
                  <Tr>
                    <Td colSpan={colCount} textAlign="center" py={12} color={subtextColor} borderColor={tableBorderColor} fontFamily="Manrope, sans-serif">
                      No records found for the selected filters.
                    </Td>
                  </Tr>
                ) : (
                  currentRecords.map((item, index) => {
                    const anId = item.an_id;
                    const isEvenRow = index % 2 === 1;
                    return (
                      <Tr
                        key={item._id}
                        bg={isEvenRow ? rowAltBg : cardBg}
                        borderBottom="1px solid"
                        borderColor={tableBorderColor}
                        _hover={{ bg: tableRowHoverBg }}
                        transition="background 0.15s ease"
                      >
                        {/* S.No */}
                        <Td sx={tdStyle} fontWeight="600" color={titleColor}>
                          {indexOfFirstRecord + index + 1}
                        </Td>

                        {/* Location */}
                        <Td sx={tdStyle} fontWeight="600" color={titleColor}>
                          {item.cameraDetails?.locations?.[0] || "N/A"}
                        </Td>

                        {/* Camera ID (Styled blue 700 matching Listview DeviceId) */}
                        <Td sx={tdStyle} fontWeight="700" color="#3F77A5">
                          {item.cameradid}
                        </Td>

                        {/* Detection Time */}
                        <Td sx={tdStyle} whiteSpace="nowrap">
                          {item.an_id === 20 || item.an_id === 30
                            ? moment(item.sendtime).subtract(5, "hours").subtract(30, "minutes").add(5, "hours").add(30, "minutes").format("DD-MM-YYYY HH:mm:ss")
                            : moment(item.sendtime).subtract(5, "hours").subtract(30, "minutes").format("DD-MM-YYYY HH:mm:ss")}
                        </Td>

                        {/* Image */}
                        <Td sx={tdStyle} textAlign="center">
                          {item.imgurl ? (
                            <IconButton
                              aria-label="View Image"
                              icon={<FaCamera size="14px" />}
                              size="sm"
                              h="30px"
                              w="30px"
                              minW="30px"
                              borderRadius="7px"
                              borderWidth="1px"
                              borderColor={cardBorder}
                              bg={actionBtnBg}
                              color="#3F77A5"
                              onClick={() => handleImageClick(item.imgurl)}
                              _hover={{
                                bg: "#3F77A5",
                                color: "#FFFFFF",
                                borderColor: "#3F77A5",
                                transform: "translateY(-1px)",
                                boxShadow: "0 2px 6px rgba(63, 119, 165, 0.35)",
                              }}
                              transition="all 0.15s ease"
                            />
                          ) : (
                            <Text color={subtextColor}>—</Text>
                          )}
                        </Td>

                        {/* Analytics Type */}
                        <Td sx={tdStyle} textAlign="center">
                          {(() => {
                            const label = currentEventMap[anId] || "No Event";
                            const badgeStyle = getAnalyticsBadgeStyle(label);
                            return (
                              <Badge
                                {...badgeStyle}
                                borderRadius="full"
                                px="12px"
                                py="3px"
                                fontSize="12px"
                                textTransform="none"
                                fontWeight="600"
                                fontFamily="Manrope, sans-serif"
                              >
                                {label}
                              </Badge>
                            );
                          })()}
                        </Td>

                        {showNumberPlateColumn(selectedEvent) && (
                          <Td sx={tdStyle}>{item.numberplateid || "N/A"}</Td>
                        )}
                        {showPersonNameColumn(selectedEvent) && (
                          <Td sx={tdStyle}>{item.person_name || "N/A"}</Td>
                        )}
                        {showCountColumn(anId) && (
                          <Td sx={tdStyle} fontWeight="600">{item.ImgCount}</Td>
                        )}
                        {showGenderCountColumns(selectedEvent) && (
                          <>
                            <Td sx={tdStyle}>{item.male_count || 0}</Td>
                            <Td sx={tdStyle}>{item.female_count || 0}</Td>
                          </>
                        )}
                        {isCountUser && (
                          <Td sx={tdStyle} fontWeight="600">{item.ImgCount}</Td>
                        )}
                      </Tr>
                    );
                  })
                )}
              </Tbody>
            </Table>
          </Box>
        </Box>

        {/* Pagination */}
        {shouldShowPagination && filteredData.length > 0 && (
          <Flex justify="center" align="center" mt={6} gap={1} wrap="wrap">
            <Button size="sm" variant="outline" borderColor={cardBorder} onClick={() => goToPage(currentPage - 1)} isDisabled={currentPage === 1} mr={1}>
              Prev
            </Button>
            {visiblePages.map((page, index) =>
              typeof page === "number" ? (
                <Button
                  key={index}
                  size="sm"
                  minW="38px"
                  variant={currentPage === page ? "solid" : "outline"}
                  bg={currentPage === page ? accent : "transparent"}
                  color={currentPage === page ? "white" : "inherit"}
                  borderColor={cardBorder}
                  _hover={currentPage === page ? { bg: accent } : { bg: tableRowHoverBg }}
                  onClick={() => goToPage(page)}
                >
                  {page}
                </Button>
              ) : (
                <Text key={index} px={1} color={subText}>
                  …
                </Text>
              )
            )}
            <Button size="sm" variant="outline" borderColor={cardBorder} onClick={() => goToPage(currentPage + 1)} isDisabled={currentPage === totalPages} ml={1}>
              Next
            </Button>
          </Flex>
        )}
      </Box>
    </Box>
  );
};

export default AnalyticsImage;
