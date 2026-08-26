import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import moment from "moment";
import {
  FaShieldAlt,
  FaSearch,
  FaRegClock,
  FaCircle,
  FaHistory,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import {
  Box,
  Flex,
  Text,
  Input,
  Select,
  Button,
  Badge,
  Image,
  IconButton,
  Spinner,
  SimpleGrid,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useColorModeValue,
} from "@chakra-ui/react";

const PAGE_SIZE = 24;

// start_time / end_time are naive ISO strings ("2026-08-08T14:59:58.500000"),
// so moment parses them as local time and the clock reads exactly as recorded.
const formatTime = (value) => (value ? moment(value).format("hh:mm:ss A") : "");
const formatDateTime = (value) => (value ? moment(value).format("DD-MM-YYYY, hh:mm:ss A") : "");

// frame_urls is always [frame1, frame2, contact sheet]
const captionFor = (index, total) =>
  index === total - 1 ? `Contact sheet — ${total} of ${total}` : `Frame ${index + 1} — ${index + 1} of ${total}`;

const thumbnailFor = (alert) => {
  const frames = alert.frame_urls || [];
  return frames[frames.length - 1] || frames[0] || "";
};

const AiAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [cameras, setCameras] = useState([]);
  const [dates, setDates] = useState([]);

  const [mode, setMode] = useState("archive"); // "archive" browses one day, "live" spans all
  const [date, setDate] = useState("");
  const [cameraId, setCameraId] = useState("all");
  const [keyword, setKeyword] = useState("");
  // what is actually being fetched, as opposed to what is typed
  const [applied, setApplied] = useState(null);

  const [selected, setSelected] = useState(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const baseUrl = process.env.REACT_APP_BASE_URL || process.env.REACT_APP_URL;

  // --- Theme tokens (match the Events page) ---
  const pageBg = useColorModeValue("gray.50", "gray.900");
  const panelBg = useColorModeValue("#FFFFFF", "gray.800");
  const cardBg = useColorModeValue("#FFFFFF", "gray.800");
  const cardBorder = useColorModeValue("rgba(226,232,240,0.9)", "whiteAlpha.200");
  const softShadow = useColorModeValue("0 1px 3px rgba(0,0,0,0.06)", "dark-lg");
  const hoverShadow = useColorModeValue("0 8px 24px rgba(0,0,0,0.10)", "dark-lg");
  const inputBg = useColorModeValue("white", "gray.700");
  const pageHeading = useColorModeValue("gray.800", "whiteAlpha.900");
  const subText = useColorModeValue("gray.500", "gray.400");
  const labelColor = useColorModeValue("gray.500", "gray.400");
  const accent = useColorModeValue("#3F77A5", "#63B3ED");
  const accentTint = useColorModeValue("#EBF3FA", "whiteAlpha.200");
  const bodyText = useColorModeValue("gray.600", "gray.300");

  // --- Filter options for the browser panel ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${baseUrl}/api/ai-alerts/filters`);
        if (cancelled || !data?.success) return;
        setCameras(data.cameras || []);
        setDates(data.dates || []);
        // default to the most recent day that actually holds footage
        const newest = data.dates?.[0]?.date || "";
        setDate(newest);
        setApplied({ date: newest, cameraId: "all", keyword: "" });
      } catch (err) {
        if (!cancelled) setError("Could not load filter options.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  // --- Alerts for the applied filters ---
  const fetchAlerts = useCallback(
    async (targetPage) => {
      if (!applied) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: targetPage, limit: PAGE_SIZE });
        // "live" deliberately drops the day filter and shows the newest first
        if (applied.date && applied.date !== "all" && mode === "archive") params.set("date", applied.date);
        if (applied.cameraId && applied.cameraId !== "all") params.set("camera_id", applied.cameraId);
        if (applied.keyword) params.set("q", applied.keyword);

        const { data } = await axios.get(`${baseUrl}/api/ai-alerts?${params.toString()}`);
        if (!data?.success) throw new Error(data?.message || "Request failed");

        setTotal(data.total || 0);
        setPage(data.page || 1);
        setAlerts((prev) => (targetPage > 1 ? [...prev, ...data.data] : data.data));
      } catch (err) {
        setError(err.response?.data?.message || err.message || "Could not load alerts.");
      } finally {
        setLoading(false);
      }
    },
    [applied, mode, baseUrl]
  );

  useEffect(() => {
    fetchAlerts(1);
  }, [fetchAlerts]);

  const applyFilters = useCallback(
    (overrides = {}) => {
      setApplied({ date, cameraId, keyword: keyword.trim(), ...overrides });
    },
    [date, cameraId, keyword]
  );

  // selects commit immediately; the keyword waits for the button or Enter
  const handleDateChange = (event) => {
    const value = event.target.value;
    setDate(value);
    setApplied((prev) => ({ ...prev, date: value }));
  };

  const handleCameraChange = (event) => {
    const value = event.target.value;
    setCameraId(value);
    setApplied((prev) => ({ ...prev, cameraId: value }));
  };

  const frames = useMemo(() => selected?.frame_urls || [], [selected]);

  const openAlert = (alert) => {
    setSelected(alert);
    setFrameIndex(0);
    onOpen();
  };

  const showPrevFrame = () => setFrameIndex((i) => Math.max(0, i - 1));
  const showNextFrame = () => setFrameIndex((i) => Math.min(frames.length - 1, i + 1));

  const closeAlert = () => {
    setSelected(null);
    onClose();
  };

  const hasMore = alerts.length < total;

  const labelStyle = {
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.08em",
    color: labelColor,
    mb: 1.5,
  };

  return (
    <Box bg={pageBg} minH="100vh" pt={{ base: "70px", md: "0" }} pb={{ base: "100px", md: 6 }}>
      <Flex align="flex-start" gap={0} direction={{ base: "column", lg: "row" }}>
        {/* ---------------- Historical browser ---------------- */}
        <Box
          w={{ base: "100%", lg: "260px" }}
          flexShrink={0}
          bg={panelBg}
          borderRight="1px solid"
          borderColor={cardBorder}
          p={5}
          minH={{ base: "auto", lg: "100vh" }}
        >
          <Text {...labelStyle}>HISTORICAL BROWSER</Text>

          <Box mt={5}>
            <Text {...labelStyle}>BROWSE DATE</Text>
            <Select
              size="sm"
              bg={inputBg}
              borderRadius="8px"
              value={date}
              onChange={handleDateChange}
              isDisabled={mode === "live"}
            >
              {dates.length === 0 && <option value="">No footage</option>}
              <option value="all">All Dates</option>
              {dates.map((d) => (
                <option key={d.date} value={d.date}>
                  {d.date} ({d.count})
                </option>
              ))}
            </Select>
          </Box>

          <Box mt={4}>
            <Text {...labelStyle}>CAMERA ID</Text>
            <Select size="sm" bg={inputBg} borderRadius="8px" value={cameraId} onChange={handleCameraChange}>
              <option value="all">All Cameras</option>
              {cameras.map((cam) => (
                <option key={cam} value={cam}>
                  {cam}
                </option>
              ))}
            </Select>
          </Box>

          <Box mt={4}>
            <Text {...labelStyle}>OBJECT / KEYWORD</Text>
            <Input
              size="sm"
              bg={inputBg}
              borderRadius="8px"
              placeholder="e.g. car, person, fire"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyFilters();
              }}
            />
          </Box>

          <Button
            mt={4}
            w="100%"
            size="sm"
            colorScheme="green"
            borderRadius="8px"
            leftIcon={<FaSearch />}
            onClick={() => applyFilters()}
            isLoading={loading && page === 1}
          >
            Search Archive
          </Button>

          <Flex mt={4} gap={2}>
            <Button
              flex={1}
              size="sm"
              borderRadius="8px"
              variant={mode === "live" ? "solid" : "outline"}
              colorScheme={mode === "live" ? "blue" : "gray"}
              leftIcon={<FaCircle size={8} />}
              onClick={() => setMode("live")}
            >
              Live
            </Button>
            <Button
              flex={1}
              size="sm"
              borderRadius="8px"
              variant={mode === "archive" ? "solid" : "outline"}
              colorScheme={mode === "archive" ? "blue" : "gray"}
              leftIcon={<FaHistory size={11} />}
              onClick={() => setMode("archive")}
            >
              Archive
            </Button>
          </Flex>

          <Box mt={8}>
            <Text {...labelStyle}>ACTIVE MONITORING</Text>
            <Text fontSize="12px" color={subText} mt={1}>
              {mode === "live"
                ? "Showing the newest alerts across all days."
                : "Browsing recorded footage for the selected day."}
            </Text>
          </Box>
        </Box>

        {/* ---------------- Alert grid ---------------- */}
        <Box flex={1} p={{ base: 4, md: 6 }} w="100%">
          <Flex align="center" gap={3} mb={5} wrap="wrap">
            <Box color={accent} fontSize="18px">
              <FaShieldAlt />
            </Box>
            <Text fontSize="18px" fontWeight="700" color={pageHeading}>
              Alert Dashboard
            </Text>
            <Badge
              bg={accentTint}
              color={accent}
              borderRadius="full"
              px={2.5}
              py={0.5}
              fontSize="11px"
              textTransform="none"
            >
              {mode === "live" ? "Live View" : "Archive View"}
            </Badge>
            {total > 0 && (
              <Text fontSize="12px" color={subText}>
                {alerts.length} of {total} alerts
              </Text>
            )}
          </Flex>

          {error && (
            <Box bg="red.50" borderRadius="10px" p={4} mb={4}>
              <Text fontSize="13px" color="red.600">
                {error}
              </Text>
            </Box>
          )}

          {loading && page === 1 ? (
            <Flex justify="center" py={20}>
              <Spinner size="lg" color={accent} />
            </Flex>
          ) : alerts.length === 0 ? (
            <Flex justify="center" py={20}>
              <Text fontSize="14px" color={subText}>
                No alerts for these filters.
              </Text>
            </Flex>
          ) : (
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing={5}>
              {alerts.map((alert) => (
                <Box
                  key={alert._id}
                  bg={cardBg}
                  border="1px solid"
                  borderColor={cardBorder}
                  borderRadius="14px"
                  overflow="hidden"
                  boxShadow={softShadow}
                  cursor="pointer"
                  transition="transform 0.2s ease, box-shadow 0.2s ease"
                  _hover={{ transform: "translateY(-3px)", boxShadow: hoverShadow }}
                  onClick={() => openAlert(alert)}
                >
                  <Box bg="black">
                    <Image
                      src={thumbnailFor(alert)}
                      alt={alert.camera_id}
                      w="100%"
                      h="110px"
                      objectFit="cover"
                      fallbackSrc="https://via.placeholder.com/320x110?text=No+Preview"
                    />
                  </Box>

                  <Box px={4} py={3}>
                    <Badge
                      bg={accentTint}
                      color={accent}
                      borderRadius="full"
                      px={2.5}
                      py={0.5}
                      fontSize="10px"
                      fontWeight="600"
                    >
                      {(alert.camera_id || "").toUpperCase()}
                    </Badge>

                    <Flex align="center" gap={1.5} mt={2.5}>
                      <Box color={subText} fontSize="11px">
                        <FaRegClock />
                      </Box>
                      <Text fontSize="13px" fontWeight="700" color={pageHeading}>
                        {formatTime(alert.start_time)}
                      </Text>
                    </Flex>

                    {/* <Text fontSize="12px" color={bodyText} mt={2} noOfLines={3}>
                      {alert.description}
                    </Text> */}
                  </Box>
                </Box>
              ))}
            </SimpleGrid>
          )}

          {hasMore && !loading && (
            <Flex justify="center" mt={8}>
              <Button size="sm" variant="outline" borderColor={cardBorder} onClick={() => fetchAlerts(page + 1)}>
                Load more
              </Button>
            </Flex>
          )}

          {loading && page > 1 && (
            <Flex justify="center" mt={8}>
              <Spinner size="md" color={accent} />
            </Flex>
          )}
        </Box>
      </Flex>

      {/* ---------------- Detail modal ---------------- */}
      <Modal isOpen={isOpen} onClose={closeAlert} isCentered size="3xl" scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.700" />
        <ModalContent bg={cardBg} borderRadius="14px" overflow="hidden">
          <ModalCloseButton zIndex={2} />
          <ModalBody p={0}>
            {/* one frame at a time -- the arrows step through them, nothing scrolls */}
            <Box position="relative" bg="black">
              <Flex justify="center" align="center" h="380px">
                <Image
                  src={frames[frameIndex]}
                  alt={captionFor(frameIndex, frames.length)}
                  maxH="380px"
                  maxW="100%"
                  objectFit="contain"
                />
              </Flex>

              {frames.length > 1 && (
                <>
                  <IconButton
                    aria-label="Previous frame"
                    icon={<FaChevronLeft />}
                    size="sm"
                    isRound
                    position="absolute"
                    left="12px"
                    top="50%"
                    transform="translateY(-50%)"
                    bg="blackAlpha.600"
                    color="white"
                    _hover={{ bg: "blackAlpha.800" }}
                    onClick={showPrevFrame}
                    isDisabled={frameIndex === 0}
                  />
                  <IconButton
                    aria-label="Next frame"
                    icon={<FaChevronRight />}
                    size="sm"
                    isRound
                    position="absolute"
                    right="12px"
                    top="50%"
                    transform="translateY(-50%)"
                    bg="blackAlpha.600"
                    color="white"
                    _hover={{ bg: "blackAlpha.800" }}
                    onClick={showNextFrame}
                    isDisabled={frameIndex === frames.length - 1}
                  />
                </>
              )}
            </Box>

            <Flex align="center" justify="center" gap={2} py={2.5}>
              {frames.map((url, index) => (
                <Box
                  key={url}
                  as="button"
                  aria-label={captionFor(index, frames.length)}
                  boxSize="7px"
                  borderRadius="full"
                  bg={index === frameIndex ? accent : cardBorder}
                  onClick={() => setFrameIndex(index)}
                />
              ))}
              <Text fontSize="11px" color={subText} ml={2}>
                {captionFor(frameIndex, frames.length)}
              </Text>
            </Flex>

            <Box px={5} py={4}>
              <Flex align="center" gap={2} wrap="wrap">
                <Badge bg="orange.100" color="orange.700" borderRadius="full" px={2.5} py={0.5} fontSize="10px">
                  FOOTAGE ARCHIVE
                </Badge>
                <Badge bg={accentTint} color={accent} borderRadius="full" px={2.5} py={0.5} fontSize="10px">
                  {(selected?.camera_id || "").toUpperCase()}
                </Badge>
                <Text fontSize="12px" color={subText} ml="auto">
                  {formatDateTime(selected?.start_time)}
                </Text>
              </Flex>

              {/* <Text fontSize="13px" color={bodyText} mt={3} whiteSpace="pre-wrap">
                {selected?.description}
              </Text> */}

              <Flex mt={3} gap={4} wrap="wrap">
                <Text fontSize="11px" color={subText}>
                  Location: {selected?.location || "—"}
                </Text>
                <Text fontSize="11px" color={subText}>
                  Segment: {selected?.segment_id ?? "—"}
                </Text>
                <Text fontSize="11px" color={subText}>
                  Motion score: {selected?.motion_score ?? "—"}
                </Text>
              </Flex>
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default AiAlerts;
