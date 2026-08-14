import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import moment from "moment";
import { FaChevronLeft, FaChevronRight, FaSearch } from "react-icons/fa";
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
  SimpleGrid,
  Image,
  Badge,
  Spinner,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  IconButton,
  useColorModeValue,
} from "@chakra-ui/react";

const Events = () => {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [firstLoadComplete, setFirstLoadComplete] = useState(false);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(moment());
  const [selectedEvent, setSelectedEvent] = useState("");
  const [cameraSearchTerm, setCameraSearchTerm] = useState("");
  const [modalImage, setModalImage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(25);
  const tableRef = useRef(null);
  const email = localStorage.getItem("email");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [cameraIds, setCameraIds] = useState([]);
  const [eventOptions] = useState({
    40: "Max person",
    
    1: "facial Recognition",
    
    43:"Intruder",
    42:"Idle WorkStation",
    17:"line crossing"
  });

  // --- Theme tokens (match dashboard) ---
  const pageHeading = useColorModeValue("gray.800", "white");
  const subText = useColorModeValue("gray.500", "gray.400");
  const cardBg = useColorModeValue("#FFFFFF", "gray.800");
  const cardBorder = useColorModeValue("rgba(226,232,240,0.9)", "whiteAlpha.200");
  const softShadow = useColorModeValue("0 1px 3px rgba(0,0,0,0.06)", "dark-lg");
  const hoverShadow = useColorModeValue("0 8px 24px rgba(0,0,0,0.10)", "dark-lg");
  const inputBg = useColorModeValue("white", "gray.700");
  const dayHover = useColorModeValue("gray.100", "whiteAlpha.200");
  const accent = useColorModeValue("#3F77A5", "#63B3ED");
  const accentTint = useColorModeValue("#EBF3FA", "whiteAlpha.200");
  const infoBg = useColorModeValue("gray.50", "gray.700");

  // --- Data fetching (unchanged) ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const formattedDate = selectedDate ? selectedDate.format("DD/MM/YYYY") : moment().format("DD/MM/YYYY");
      const url = `${process.env.REACT_APP_URL || process.env.REACT_APP_LOCAL_URL}/api/Analytics/getanalyticsimages?email=${email}&date=${formattedDate}`;
      const response = await axios.get(url);

      if (response.data && response.data.data) {
        const analyticsData = response.data.data;
        if (Array.isArray(analyticsData)) {
          const validData = analyticsData.filter(
            (item) =>
              item &&
              item.imgurl &&
              item.sendtime &&
              item.cameradid &&
              item.cameraDetails?.deviceId &&
              item.cameraDetails?.locations
          );
          setData(validData);
          setCameraIds([...new Set(validData.map((item) => item.cameradid))]);
        } else {
          setData([]);
          setCameraIds([]);
        }
      } else {
        setData([]);
        setCameraIds([]);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Error fetching data");
    } finally {
      setLoading(false);
      setFirstLoadComplete(true);
    }
  }, [email, selectedDate]);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 20000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  // --- Filtering (unchanged) ---
  const filterData = useCallback(() => {
    let filtered = [...data];
    if (cameraSearchTerm) {
      const searchTermLower = cameraSearchTerm.toLowerCase();
      filtered = filtered.filter((item) => item.cameradid?.toLowerCase().includes(searchTermLower));
    }
    if (selectedEvent) {
      filtered = filtered.filter((item) => item.an_id == selectedEvent);
    }
    setCurrentPage(1);
    setFilteredData(filtered);
  }, [data, cameraSearchTerm, selectedEvent]);

  useEffect(() => {
    filterData();
  }, [data, selectedDate, cameraSearchTerm, selectedEvent, filterData]);

  const formatDate = useCallback((dateString) => moment(dateString).format("DD-MM-YYYY HH:mm:ss"), []);

  const handleDateChange = (date) => setSelectedDate(date);
  const handleCameraSearchChange = (event) => setCameraSearchTerm(event.target.value);
  const handleEventChange = (event) => setSelectedEvent(event.target.value);
  const handleImageClick = (imgUrl) => {
    setModalImage(imgUrl);
    onOpen();
  };
  const closeModal = () => {
    setModalImage(null);
    onClose();
  };

  const currentEventMap = eventOptions;
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
  const shouldShowPagination = filteredData.length > recordsPerPage;

  // --- Week date strip ---
  const DateSelector = () => {
    const [weekStart, setWeekStart] = useState(selectedDate.clone().startOf("week"));
    const days = [];
    for (let i = 0; i < 7; i++) days.push(weekStart.clone().add(i, "days"));

    return (
      <Flex align="center" gap={1}>
        <IconButton
          aria-label="Previous week"
          icon={<FaChevronLeft />}
          size="sm"
          variant="ghost"
          onClick={() => setWeekStart(weekStart.clone().subtract(1, "week"))}
        />
        <Flex gap={1}>
          {days.map((day) => {
            const isSelected = selectedDate.isSame(day, "day");
            const isFuture = day.isAfter(moment(), "day");
            return (
              <Flex
                key={day.format("YYYY-MM-DD")}
                direction="column"
                align="center"
                justify="center"
                minW="44px"
                py={1.5}
                borderRadius="10px"
                cursor={isFuture ? "not-allowed" : "pointer"}
                opacity={isFuture ? 0.4 : 1}
                bg={isSelected ? accent : "transparent"}
                color={isSelected ? "white" : "inherit"}
                border="1px solid"
                borderColor={isSelected ? accent : cardBorder}
                transition="all 0.15s ease"
                _hover={isFuture || isSelected ? {} : { bg: dayHover }}
                onClick={() => !isFuture && handleDateChange(day)}
              >
                <Text fontSize="10px" fontWeight="600" textTransform="uppercase" opacity={0.8}>
                  {day.format("ddd")}
                </Text>
                <Text fontSize="15px" fontWeight="700" lineHeight="1.2">
                  {day.format("D")}
                </Text>
              </Flex>
            );
          })}
        </Flex>
        <IconButton
          aria-label="Next week"
          icon={<FaChevronRight />}
          size="sm"
          variant="ghost"
          onClick={() => setWeekStart(weekStart.clone().add(1, "week"))}
        />
      </Flex>
    );
  };

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
      <Flex justify="space-between" align={{ base: "flex-start", md: "center" }} mb={5} direction={{ base: "column", md: "row" }} gap={2}>
        <Box>
          <Text fontWeight={700} fontSize="28px" color={pageHeading} lineHeight="1.2">
            Cloud Events
          </Text>
          <Text fontSize="14px" color={subText}>
            AI detection snapshots captured across your cameras
          </Text>
        </Box>
        <Badge
          px={3}
          py={1.5}
          borderRadius="full"
          bg={accentTint}
          color={accent}
          fontSize="12px"
          fontWeight="600"
          textTransform="none"
        >
          {filteredData.length} event{filteredData.length === 1 ? "" : "s"} · {selectedDate.format("DD MMM YYYY")}
        </Badge>
      </Flex>

      {/* Filter bar */}
      <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" boxShadow={softShadow} p={4} mb={5}>
        <Grid templateColumns={{ base: "1fr", lg: "auto 1fr" }} gap={4} alignItems="end">
          <Box>
            <Text fontSize="12px" fontWeight="600" color={subText} mb={1.5} textTransform="uppercase" letterSpacing="0.05em">
              Select Date
            </Text>
            <DateSelector />
          </Box>

          <Flex gap={3} direction={{ base: "column", sm: "row" }} justify={{ lg: "flex-end" }}>
            <Box minW={{ base: "100%", sm: "200px" }}>
              <Text fontSize="12px" fontWeight="600" color={subText} mb={1.5} textTransform="uppercase" letterSpacing="0.05em">
                Event Type
              </Text>
              <Select
                placeholder="All events"
                value={selectedEvent}
                onChange={handleEventChange}
                bg={inputBg}
                borderColor={cardBorder}
                borderRadius="10px"
                size="md"
              >
                {Object.entries(eventOptions).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </Select>
            </Box>

            <Box minW={{ base: "100%", sm: "220px" }}>
              <Text fontSize="12px" fontWeight="600" color={subText} mb={1.5} textTransform="uppercase" letterSpacing="0.05em">
                Camera ID
              </Text>
              <InputGroup>
                <InputLeftElement pointerEvents="none" color={subText}>
                  <FaSearch size={13} />
                </InputLeftElement>
                <Input
                  type="text"
                  placeholder="Search camera ID"
                  value={cameraSearchTerm}
                  onChange={handleCameraSearchChange}
                  bg={inputBg}
                  borderColor={cardBorder}
                  borderRadius="10px"
                />
              </InputGroup>
            </Box>
          </Flex>
        </Grid>
      </Box>

      {/* Content */}
      {loading && !firstLoadComplete ? (
        <Flex direction="column" align="center" justify="center" py={20} gap={3}>
          <Spinner size="xl" color={accent} thickness="3px" />
          <Text color={subText}>Loading events…</Text>
        </Flex>
      ) : error ? (
        <Flex justify="center" py={20}>
          <Text color="red.500" fontSize="lg">
            {error}
          </Text>
        </Flex>
      ) : filteredData.length === 0 ? (
        <Flex direction="column" align="center" justify="center" py={20} gap={2}>
          <Text fontSize="lg" fontWeight="600" color={pageHeading}>
            No events found
          </Text>
          <Text color={subText}>Try a different date, event type, or camera.</Text>
        </Flex>
      ) : (
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, xl: 4 }} spacing={4}>
          {currentRecords.map((item) => (
            <Box
              key={item._id}
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              borderRadius="14px"
              overflow="hidden"
              boxShadow={softShadow}
              transition="transform 0.2s ease, box-shadow 0.2s ease"
              _hover={{ transform: "translateY(-3px)", boxShadow: hoverShadow }}
            >
              <Box position="relative" overflow="hidden" bg="black">
                <Image
                  src={item.imgurl}
                  alt="Analytics"
                  w="100%"
                  h="180px"
                  objectFit="cover"
                  cursor="pointer"
                  transition="transform 0.3s ease"
                  _hover={{ transform: "scale(1.05)" }}
                  onClick={() => handleImageClick(item.imgurl)}
                  fallbackSrc="https://via.placeholder.com/300x180?text=No+Preview"
                />
                <Badge
                  position="absolute"
                  top="8px"
                  left="8px"
                  bg={accent}
                  color="white"
                  borderRadius="full"
                  px={2.5}
                  py={0.5}
                  fontSize="11px"
                  fontWeight="600"
                  textTransform="none"
                >
                  {currentEventMap[item.an_id] || "Event"}
                </Badge>
              </Box>
              <Box bg={infoBg} px={4} py={3}>
                <Text fontSize="13px" fontWeight="600" color={pageHeading} noOfLines={1} title={item.cameradid}>
                  {item.cameradid || "Unknown camera"}
                </Text>
                <Text fontSize="12px" color={subText} mt={0.5}>
                   {item.an_id === 20 || item.an_id === 30
                                            ? moment(item.sendtime).subtract(5, "hours").subtract(30, "minutes").add(5, "hours").add(30, "minutes").format("DD-MM-YYYY HH:mm:ss")
                                            : moment(item.sendtime).subtract(5, "hours").subtract(30, "minutes").format("DD-MM-YYYY HH:mm:ss")}
                </Text>
              </Box>
            </Box>
          ))}
        </SimpleGrid>
      )}

      {/* Pagination */}
      {shouldShowPagination && filteredData.length > 0 && (
        <Flex justify="center" align="center" mt={8} gap={1} wrap="wrap">
          <Button
            size="sm"
            variant="outline"
            borderColor={cardBorder}
            onClick={() => goToPage(currentPage - 1)}
            isDisabled={currentPage === 1}
            mr={1}
          >
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
                _hover={currentPage === page ? { bg: accent } : { bg: dayHover }}
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

          <Button
            size="sm"
            variant="outline"
            borderColor={cardBorder}
            onClick={() => goToPage(currentPage + 1)}
            isDisabled={currentPage === totalPages}
            ml={1}
          >
            Next
          </Button>
        </Flex>
      )}
    </Box>
  );
};

export default Events;
