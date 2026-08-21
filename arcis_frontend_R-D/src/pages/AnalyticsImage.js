import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { FaDownload } from "react-icons/fa";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
  Button,
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
  TableContainer,
  useColorModeValue,
} from "@chakra-ui/react";
import moment from "moment";

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

  // --- Theme tokens (match dashboard) ---
  const pageHeading = useColorModeValue("gray.800", "white");
  const subText = useColorModeValue("gray.500", "gray.400");
  const cardBg = useColorModeValue("#FFFFFF", "gray.800");
  const cardBorder = useColorModeValue("rgba(226,232,240,0.9)", "whiteAlpha.200");
  const softShadow = useColorModeValue("0 1px 3px rgba(0,0,0,0.06)", "dark-lg");
  const inputBg = useColorModeValue("white", "gray.700");
  const accent = useColorModeValue("#3F77A5", "#63B3ED");
  const accentTint = useColorModeValue("#EBF3FA", "whiteAlpha.200");
  const tableHeadBg = useColorModeValue("#F1F5F9", "gray.700");
  const rowHover = useColorModeValue("gray.50", "whiteAlpha.100");
  const zebra = useColorModeValue("gray.50", "whiteAlpha.50");

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

  // Event ids actually present in the data returned for the selected date (+ camera, if chosen)
  const availableEventIds = useMemo(() => {
    const ids = new Set();
    data.forEach((item) => {
      if (item?.an_id === undefined || item?.an_id === null) return;
      if (selectedCamera && item.cameradid !== selectedCamera) return;
      ids.add(item.an_id.toString());
    });
    return ids;
  }, [data, selectedCamera]);

  // Only the event types that exist in the DB for this date are offered in the dropdown
  const eventOptions = Object.entries(currentEventMap).filter(([key]) => availableEventIds.has(key));

  // Clear the selection if the chosen event has no records for the new date/camera
  useEffect(() => {
    if (selectedEvent && !availableEventIds.has(selectedEvent)) {
      setSelectedEvent("");
      setSelectedSubEvent("");
      setSelectedPersonName("");
    }
  }, [availableEventIds, selectedEvent]);

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

  const thStyle = {
    py: 3,
    px: 3,
    textAlign: "center",
    textTransform: "none",
    fontSize: "12px",
    fontWeight: "700",
    color: pageHeading,
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
  };
  const tdStyle = { py: 2.5, px: 3, textAlign: "center", fontSize: "13px", borderColor: cardBorder };

  const colCount =
    6 +
    (showNumberPlateColumn(selectedEvent) ? 1 : 0) +
    (showPersonNameColumn(selectedEvent) ? 1 : 0) +
    (showCountColumn(parseInt(selectedEvent)) ? 1 : 0) +
    (showGenderCountColumns(selectedEvent) ? 2 : 0) +
    (isCountUser ? 1 : 0);

  return (
    <Box maxW="1600px" mx="auto" pt={{ base: "70px", md: "0" }} mb={{ base: "100px", md: "6" }} px={{ base: 3, md: 0 }}>
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
      <Flex justify="space-between" align={{ base: "flex-start", md: "center" }} mb={5} direction={{ base: "column", md: "row" }} gap={3}>
        <Box>
          <Text fontWeight={700} fontSize="28px" color={pageHeading} lineHeight="1.2">
            Analytics Image Data
          </Text>
          <Text fontSize="14px" color={subText}>
            AI detection records with snapshots, filterable by event, date and camera
          </Text>
        </Box>
        <Button
          leftIcon={<FaDownload size={14} />}
          onClick={exportToPDF}
          isLoading={pdfLoading}
          loadingText="Exporting…"
          bg={accent}
          color="white"
          _hover={{ opacity: 0.9 }}
          size="md"
          borderRadius="10px"
        >
          Export PDF
        </Button>
      </Flex>

      {/* Filter bar */}
      <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" boxShadow={softShadow} p={4} mb={5}>
        <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" }} gap={4}>
          <Box>
            <Text fontSize="12px" fontWeight="600" color={subText} mb={1.5} textTransform="uppercase" letterSpacing="0.05em">
              Event Type
            </Text>
            <Select
              value={selectedEvent}
              onChange={handleEventChange}
              bg={inputBg}
              borderColor={cardBorder}
              borderRadius="10px"
              placeholder={eventOptions.length ? "All Events" : "No events for this date"}
              isDisabled={eventOptions.length === 0}
            >
              {eventOptions.map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </Select>
          </Box>

          {selectedEvent === "1" && (
            <Box>
              <Text fontSize="12px" fontWeight="600" color={subText} mb={1.5} textTransform="uppercase" letterSpacing="0.05em">
                Recognition Type
              </Text>
              <Select value={selectedSubEvent} onChange={(e) => setSelectedSubEvent(e.target.value)} bg={inputBg} borderColor={cardBorder} borderRadius="10px">
                <option value="">All</option>
                <option value="known">Known</option>
                <option value="unknown">Unknown</option>
              </Select>
            </Box>
          )}

          <Box>
            <Text fontSize="12px" fontWeight="600" color={subText} mb={1.5} textTransform="uppercase" letterSpacing="0.05em">
              Date
            </Text>
            <Input type="date" value={selectedDate} onChange={handleDateChange} bg={inputBg} borderColor={cardBorder} borderRadius="10px" />
          </Box>

          <Box>
            <Text fontSize="12px" fontWeight="600" color={subText} mb={1.5} textTransform="uppercase" letterSpacing="0.05em">
              Camera ID
            </Text>
            <Select value={selectedCamera} onChange={handleCameraChange} bg={inputBg} borderColor={cardBorder} borderRadius="10px" placeholder="All Cameras">
              {cameraIds.map((cameraId) => (
                <option key={cameraId} value={cameraId}>
                  {cameraId}
                </option>
              ))}
            </Select>
          </Box>

          {selectedEvent === "1" && (
            <Box>
              <Text fontSize="12px" fontWeight="600" color={subText} mb={1.5} textTransform="uppercase" letterSpacing="0.05em">
                Person Name
              </Text>
              <Select value={selectedPersonName} onChange={handlePersonNameChange} bg={inputBg} borderColor={cardBorder} borderRadius="10px" placeholder="All Persons">
                {personNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </Select>
            </Box>
          )}
        </Grid>
      </Box>

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

      {/* Table */}
      <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" boxShadow={softShadow} overflow="hidden">
        <TableContainer overflowX="auto">
          <Table size="sm" ref={tableRef}>
            <Thead bg={tableHeadBg} position="sticky" top={0} zIndex={1}>
              <Tr>
                <Th sx={thStyle}>S.No</Th>
                <Th sx={thStyle}>Location</Th>
                <Th sx={thStyle}>Camera ID</Th>
                <Th sx={thStyle}>Detection Time</Th>
                <Th sx={thStyle}>Image</Th>
                <Th sx={thStyle}>Analytics Type</Th>
                {/* <Th sx={thStyle}>Person Name</Th> */}
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
                  <Td colSpan={colCount} textAlign="center" py={12} borderColor={cardBorder}>
                    <Flex direction="column" align="center" gap={3}>
                      <Spinner size="lg" color={accent} thickness="3px" />
                      <Text color={subText}>Loading…</Text>
                    </Flex>
                  </Td>
                </Tr>
              ) : error ? (
                <Tr>
                  <Td colSpan={colCount} textAlign="center" py={12} color="red.500" borderColor={cardBorder}>
                    {error}
                  </Td>
                </Tr>
              ) : filteredData.length === 0 ? (
                <Tr>
                  <Td colSpan={colCount} textAlign="center" py={12} color={subText} borderColor={cardBorder}>
                    No records found for the selected filters.
                  </Td>
                </Tr>
              ) : (
                currentRecords.map((item, index) => {
                  const anId = item.an_id;
                  return (
                    <Tr key={item._id} bg={index % 2 !== 0 ? zebra : "transparent"} _hover={{ bg: rowHover }}>
                      <Td sx={tdStyle}>{indexOfFirstRecord + index + 1}</Td>
                      <Td sx={tdStyle}>{item.cameraDetails?.locations?.[0] || "N/A"}</Td>
                      <Td sx={tdStyle}>{item.cameradid}</Td>
                      <Td sx={tdStyle} whiteSpace="nowrap">
                        {item.an_id === 20 || item.an_id === 30
                          ? moment(item.sendtime).subtract(5, "hours").subtract(30, "minutes").add(5, "hours").add(30, "minutes").format("DD-MM-YYYY HH:mm:ss")
                          : moment(item.sendtime).subtract(5, "hours").subtract(30, "minutes").format("DD-MM-YYYY HH:mm:ss")}
                      </Td>
                      <Td sx={tdStyle}>
                        <Image
                          src={item.imgurl}
                          alt="Analytics"
                          boxSize="50px"
                          objectFit="cover"
                          borderRadius="8px"
                          cursor="pointer"
                          mx="auto"
                          transition="transform 0.2s ease"
                          _hover={{ transform: "scale(1.08)" }}
                          onClick={() => handleImageClick(item.imgurl)}
                          fallbackSrc="https://via.placeholder.com/50?text=—"
                        />
                      </Td>
                      <Td sx={tdStyle}>
                        <Badge bg={accentTint} color={accent} borderRadius="full" px={2.5} py={0.5} textTransform="none" fontWeight="600">
                          {currentEventMap[anId] || "No Event"}
                        </Badge>
                      </Td>
                       {/* <Td sx={tdStyle}>{item.person_name}</Td> */}
                      {showNumberPlateColumn(selectedEvent) && <Td sx={tdStyle}>{item.numberplateid || "N/A"}</Td>}
                      {showPersonNameColumn(selectedEvent) && <Td sx={tdStyle}>{item.person_name || "N/A"}</Td>}
                      {showCountColumn(anId) && <Td sx={tdStyle}>{item.ImgCount}</Td>}
                      {showGenderCountColumns(selectedEvent) && (
                        <>
                          <Td sx={tdStyle}>{item.male_count || 0}</Td>
                          <Td sx={tdStyle}>{item.female_count || 0}</Td>
                        </>
                      )}
                      {isCountUser && <Td sx={tdStyle}>{item.ImgCount}</Td>}
                    </Tr>
                  );
                })
              )}
            </Tbody>
          </Table>
        </TableContainer>
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
                _hover={currentPage === page ? { bg: accent } : { bg: rowHover }}
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
  );
};

export default AnalyticsImage;
