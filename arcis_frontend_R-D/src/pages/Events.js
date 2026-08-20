import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import moment from "moment";
import { MdChevronLeft, MdChevronRight, MdSearch } from "react-icons/md";
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
  SimpleGrid,
  Image,
  Spinner,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
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
  const [recordsPerPage] = useState(24);
  const email = localStorage.getItem("email");
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [cameraIds, setCameraIds] = useState([]);
  const [eventOptions] = useState({
    40: "Max person",
    1: "facial Recognition",
    43: "Intruder",
    42: "Idle WorkStation",
    17: "line crossing",
    100: "heatmap",
  });

  // --- Theme Tokens ---
  const cardBg = useColorModeValue("#FFFFFF", "#1C222D");
  const cardBorder = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.08)");
  const titleColor = useColorModeValue("#1A2E3D", "#FFFFFF");
  const placeholderColor = useColorModeValue("#94A3B8", "#64748B");
  const subtextColor = useColorModeValue("#64748B", "#94A3B8");
  const dateTileBg = useColorModeValue("#FFFFFF", "#18202C");
  const dateTileBorder = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.1)");

  // Event color mapping
  const getEventColor = (anId) => {
    switch (String(anId)) {
      case "40": // Max person
        return { bg: "#000000", text: "#FBBF24" };
      case "1": // facial Recognition
        return { bg: "#000000", text: "#A78BFA" };
      case "43": // Intruder
        return { bg: "#000000", text: "#FF4D4F" };
      case "42": // Idle WorkStation
        return { bg: "#000000", text: "#FB923C" };
      case "17": // line crossing
        return { bg: "#000000", text: "#34D399" };
      default:
        return { bg: "#000000", text: "#60A5FA" };
    }
  };

  // --- Data fetching (preserved) ---
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

  // --- Filtering (preserved) ---
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
  const totalPages = Math.ceil(filteredData.length / recordsPerPage) || 1;

  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // --- Week date strip component ---
  const DateSelector = () => {
    const [weekStart, setWeekStart] = useState(selectedDate.clone().startOf("week"));
    const days = [];
    for (let i = 0; i < 7; i++) days.push(weekStart.clone().add(i, "days"));

    return (
      <Flex align="center" gap="6px" pt="8px">
        {/* Previous Button */}
        <Box
          as="button"
          onClick={() => setWeekStart(weekStart.clone().subtract(1, "week"))}
          w="23px"
          h="23px"
          borderRadius="6px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          color="#64748B"
          _hover={{ bg: "#3F77A515", color: "#3F77A5" }}
          transition="all 0.15s ease"
        >
          <MdChevronLeft size="18px" />
        </Box>

        {/* Date Boxes */}
        <Flex gap="6px" align="center" flexWrap="wrap">
          {days.map((day) => {
            const isSelected = selectedDate.isSame(day, "day");
            const isFuture = day.isAfter(moment(), "day");
            return (
              <Box
                key={day.format("YYYY-MM-DD")}
                onClick={() => !isFuture && handleDateChange(day)}
                w="46px"
                h="46px"
                borderRadius="9px"
                borderWidth="1px"
                borderColor={isSelected ? "#3F77A5" : dateTileBorder}
                bg={isSelected ? "#3F77A5" : dateTileBg}
                cursor={isFuture ? "not-allowed" : "pointer"}
                opacity={isFuture ? 0.4 : 1}
                display="flex"
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                gap="1px"
                transition="all 0.15s ease"
                _hover={isFuture || isSelected ? {} : { borderColor: "#3F77A5" }}
              >
                {/* SUN text layout */}
                <Text
                  fontFamily="Manrope, sans-serif"
                  fontWeight="500"
                  fontSize="9px"
                  lineHeight="13.5px"
                  letterSpacing="0px"
                  textAlign="center"
                  color={isSelected ? "#FFFFFF" : subtextColor}
                  textTransform="uppercase"
                >
                  {day.format("ddd")}
                </Text>
                {/* Day number layout */}
                <Text
                  fontFamily="Manrope, sans-serif"
                  fontWeight="500"
                  fontSize="14px"
                  lineHeight="14px"
                  letterSpacing="0px"
                  textAlign="center"
                  color={isSelected ? "#FFFFFF" : titleColor}
                >
                  {day.format("D")}
                </Text>
              </Box>
            );
          })}
        </Flex>

        {/* Next Button */}
        <Box
          as="button"
          onClick={() => setWeekStart(weekStart.clone().add(1, "week"))}
          w="23px"
          h="23px"
          borderRadius="6px"
          display="flex"
          alignItems="center"
          justifyContent="center"
          color="#64748B"
          _hover={{ bg: "#3F77A515", color: "#3F77A5" }}
          transition="all 0.15s ease"
        >
          <MdChevronRight size="18px" />
        </Box>
      </Flex>
    );
  };

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
      {/* Image Modal */}
      <Modal isOpen={isOpen} onClose={closeModal} isCentered size="4xl">
        <ModalOverlay bg="blackAlpha.700" />
        <ModalContent bg={cardBg} borderRadius="16px" overflow="hidden">
          <ModalCloseButton zIndex={2} />
          <ModalBody display="flex" justifyContent="center" alignItems="center" p={4}>
            <Image src={modalImage} alt="Enlarged view" maxW="100%" maxH="80vh" borderRadius="10px" />
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* ========================================================================= */}
      {/* 1. CLOUD EVENT HEADER CONTAINER                                           */}
      {/* ========================================================================= */}
      <Flex
        justifyContent="space-between"
        alignItems={{ base: "flex-start", md: "center" }}
        flexWrap="wrap"
        gap="12px"
        mb="16px"
      >
        {/* Title & Subtitle */}
        <Box>
          <Text
            fontFamily="Manrope, sans-serif"
            fontWeight="800"
            fontSize="22px"
            lineHeight="26.4px"
            letterSpacing="0px"
            color={titleColor}
          >
            Cloud Events
          </Text>
          <Text
            fontFamily="Manrope, sans-serif"
            fontWeight="400"
            fontSize="13px"
            lineHeight="19.5px"
            letterSpacing="0px"
            color="#64748B"
            pt="4px"
          >
            AI detection snapshots captured across your cameras
          </Text>
        </Box>

        {/* Event Badge Container */}
        <Box
          h="23px"
          px="10px"
          py="3px"
          borderRadius="999px"
          bg="#3F77A51A"
          display="inline-flex"
          alignItems="center"
        >
          <Text
            fontFamily="Manrope, sans-serif"
            fontWeight="700"
            fontSize="11px"
            lineHeight="16.5px"
            letterSpacing="0.33px"
            color="#3F77A5"
          >
            {filteredData.length} event{filteredData.length === 1 ? "" : "s"} · {selectedDate.format("DD MMM YYYY")}
          </Text>
        </Box>
      </Flex>

      {/* ========================================================================= */}
      {/* 2. DATE & FILTER CONTAINER                                                */}
      {/* ========================================================================= */}
      <Box
        w="100%"
        borderRadius="14px"
        p="20px"
        borderWidth="1px"
        borderColor={cardBorder}
        bg={cardBg}
        boxShadow="0px 1px 6px 0px #1A2E3D12"
        mb="20px"
      >
        <Flex
          wrap="wrap"
          justifyContent="space-between"
          alignItems="flex-start"
          gap="24px"
        >
          {/* Select Date Container */}
          <Box flex="1" minW={{ base: "100%", lg: "392px" }}>
            <Text
              fontFamily="Manrope, sans-serif"
              fontWeight="700"
              fontSize="10px"
              lineHeight="15px"
              letterSpacing="0.7px"
              textTransform="uppercase"
              color={subtextColor}
            >
              SELECT DATE
            </Text>
            <DateSelector />
          </Box>

          {/* Event Type and Camera Search */}
          <Flex
            gap="20px"
            direction={{ base: "column", sm: "row" }}
            alignItems={{ base: "stretch", sm: "flex-start" }}
            flexWrap="wrap"
          >
            {/* Event Type Container */}
            <Box w={{ base: "100%", sm: "168px" }}>
              <Text
                fontFamily="Manrope, sans-serif"
                fontWeight="700"
                fontSize="10px"
                lineHeight="15px"
                letterSpacing="0.7px"
                textTransform="uppercase"
                color={subtextColor}
                mb="8px"
              >
                EVENT TYPE
              </Text>
              <Select
                placeholder="All events"
                value={selectedEvent}
                onChange={handleEventChange}
                h="39px"
                borderRadius="8px"
                borderWidth="1px"
                borderColor={cardBorder}
                bg={dateTileBg}
                fontFamily="Manrope, sans-serif"
                fontWeight="400"
                fontSize="12px"
                lineHeight="100%"
                letterSpacing="0px"
                color={titleColor}
                _focus={{ borderColor: "#3F77A5" }}
              >
                {Object.entries(eventOptions).map(([key, value]) => (
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

            {/* Camera ID Container */}
            <Box w={{ base: "100%", sm: "193px" }}>
              <Text
                fontFamily="Manrope, sans-serif"
                fontWeight="700"
                fontSize="10px"
                lineHeight="15px"
                letterSpacing="0.7px"
                textTransform="uppercase"
                color={subtextColor}
                mb="8px"
              >
                CAMERA ID
              </Text>
              <InputGroup w="100%" h="36px">
                <InputLeftElement h="36px" pointerEvents="none" pl="8px">
                  <MdSearch size="16px" color="#94A3B8" />
                </InputLeftElement>
                <Input
                  placeholder="Search Camera ID"
                  value={cameraSearchTerm}
                  onChange={handleCameraSearchChange}
                  h="36px"
                  pl="32px"
                  pr="12px"
                  borderRadius="8px"
                  borderWidth="1px"
                  borderColor={cardBorder}
                  bg={cardBg}
                  fontFamily="Manrope, sans-serif"
                  fontWeight="400"
                  fontSize="12px"
                  lineHeight="100%"
                  letterSpacing="0px"
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
            </Box>
          </Flex>
        </Flex>
      </Box>

      {/* ========================================================================= */}
      {/* 3. STREAM EVENT CONTAINER                                                 */}
      {/* ========================================================================= */}
      {loading && !firstLoadComplete ? (
        <Flex direction="column" align="center" justify="center" py={20} gap={3}>
          <Spinner size="xl" color="#3F77A5" thickness="3px" />
          <Text fontFamily="Manrope, sans-serif" fontSize="13px" color="#64748B">
            Loading events…
          </Text>
        </Flex>
      ) : error ? (
        <Flex justify="center" py={20}>
          <Text fontFamily="Manrope, sans-serif" color="red.500" fontSize="14px">
            {error}
          </Text>
        </Flex>
      ) : filteredData.length === 0 ? (
        <Flex direction="column" align="center" justify="center" py={20} gap={2}>
          <Text fontFamily="Manrope, sans-serif" fontSize="16px" fontWeight="700" color={titleColor}>
            No events found
          </Text>
          <Text fontFamily="Manrope, sans-serif" fontSize="13px" color="#64748B">
            Try a different date, event type, or camera.
          </Text>
        </Flex>
      ) : (
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="16px" pt="10px" w="100%">
          {currentRecords.map((item) => {
            const eventColor = getEventColor(item.an_id);

            return (
              <Box
                key={item._id}
                borderRadius="10px"
                borderWidth="1px"
                borderColor={cardBorder}
                bg={cardBg}
                boxShadow="0px 1px 4px 0px #1A2E3D0F"
                overflow="hidden"
                display="flex"
                flexDirection="column"
                transition="transform 0.2s ease, box-shadow 0.2s ease"
                _hover={{
                  transform: "translateY(-3px)",
                  boxShadow: "0px 8px 20px rgba(26, 46, 61, 0.12)",
                }}
              >
                {/* Snapshot Image Container */}
                <Box position="relative" overflow="hidden" bg="black" h="150px" w="100%">
                  <Image
                    src={item.imgurl}
                    alt="Analytics"
                    w="100%"
                    h="100%"
                    objectFit="cover"
                    cursor="pointer"
                    transition="transform 0.3s ease"
                    _hover={{ transform: "scale(1.05)" }}
                    onClick={() => handleImageClick(item.imgurl)}
                    fallbackSrc="https://via.placeholder.com/300x180?text=No+Preview"
                  />
                  {/* Event Badge Container */}
                  <Box
                    position="absolute"
                    top="8px"
                    left="8px"
                    h="22.5px"
                    px="10px"
                    py="3px"
                    borderRadius="999px"
                    bg="rgba(0, 0, 0, 0.90)"
                    border="1px solid rgba(255, 255, 255, 0.15)"
                    display="inline-flex"
                    alignItems="center"
                    zIndex="2"
                    boxShadow="0 2px 5px rgba(0,0,0,0.5)"
                  >
                    <Text
                      fontFamily="Manrope, sans-serif"
                      fontWeight="700"
                      fontSize="11px"
                      lineHeight="16.5px"
                      letterSpacing="0.33px"
                      color={eventColor.text}
                    >
                      {currentEventMap[item.an_id] || "Event"}
                    </Text>
                  </Box>
                </Box>

                {/* Bottom Details Section */}
                <Box
                  p="9px 11px"
                  minH="52px"
                  display="flex"
                  flexDirection="column"
                  justifyContent="center"
                  borderTop="1px solid"
                  borderColor={cardBorder}
                >
                  {/* Camera DID */}
                  <Text
                    fontFamily="Manrope, sans-serif"
                    fontWeight="600"
                    fontSize="11px"
                    lineHeight="16.5px"
                    letterSpacing="0px"
                    color={titleColor}
                    noOfLines={1}
                    title={item.cameradid}
                  >
                    {item.cameradid || "Unknown camera"}
                  </Text>

                  {/* Formatted Timestamp */}
                  <Text
                    fontFamily="Manrope, sans-serif"
                    fontWeight="400"
                    fontSize="10px"
                    lineHeight="15px"
                    letterSpacing="0px"
                    color={subtextColor}
                    mt="2px"
                  >
                    {item.an_id === 20 || item.an_id === 30
                      ? moment(item.sendtime)
                          .subtract(5, "hours")
                          .subtract(30, "minutes")
                          .add(5, "hours")
                          .add(30, "minutes")
                          .format("DD-MM-YYYY HH:mm:ss")
                      : moment(item.sendtime)
                          .subtract(5, "hours")
                          .subtract(30, "minutes")
                          .format("DD-MM-YYYY HH:mm:ss")}
                  </Text>
                </Box>
              </Box>
            );
          })}
        </SimpleGrid>
      )}

      {/* ========================================================================= */}
      {/* 4. PAGINATION CONTAINER                                                   */}
      {/* ========================================================================= */}
      {filteredData.length > recordsPerPage && (
        <Flex
          minH="44px"
          pt="20px"
          justifyContent="center"
          alignItems="center"
          gap="12px"
          w="100%"
          fontFamily="Manrope, sans-serif"
        >
          {/* Previous Button */}
          <Button
            onClick={() => goToPage(currentPage - 1)}
            isDisabled={currentPage === 1 || totalPages <= 1}
            h="32px"
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
            fontSize="13px"
            lineHeight="19.5px"
            letterSpacing="0px"
            color={subtextColor}
            px="4px"
          >
            {totalPages > 0 ? `${currentPage} / ${totalPages}` : "1 / 1"}
          </Text>

          {/* Next Button */}
          <Button
            onClick={() => goToPage(currentPage + 1)}
            isDisabled={currentPage === totalPages || totalPages <= 1}
            h="32px"
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
      )}
    </Box>
  );
};

export default Events;
