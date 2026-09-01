import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import moment from "moment";
import {
  FaShieldAlt,
  FaSearch,
  FaRegClock,
  FaCircle,
  FaHistory,
  FaMagic,
  FaExpand,
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

// Times arrive either as a naive ISO string ("2026-08-08T14:59:58.500000") or,
// on newer rows, a real Date serialised with a Z. Reading both as UTC shows the
// recorded wall clock; plain moment() would shift the Z form by the local offset.
const formatTime = (value) => (value ? moment.utc(value).format("hh:mm:ss A") : "");
const formatDateTime = (value) => (value ? moment.utc(value).format("DD-MM-YYYY, hh:mm:ss A") : "");

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

  // AI pass over the current keyword search: which hits are real evidence
  const [refine, setRefine] = useState(null);
  const [refining, setRefining] = useState(false);
  const [onlyRelevant, setOnlyRelevant] = useState(true);

  // { frames, index } while a frame is open full screen
  const [lightbox, setLightbox] = useState(null);

  const [selected, setSelected] = useState(null);
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
        // start across every day; a single day is a deliberate narrowing
        setDate("all");
        setApplied({ date: "all", cameraId: "all", keyword: "" });
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
    setRefine(null);
  }, [fetchAlerts]);

  const runRefine = useCallback(async () => {
    const q = (applied?.keyword || "").trim();
    if (!q) return;
    setRefining(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, limit: 40 });
      if (applied.date && applied.date !== "all" && mode === "archive") params.set("date", applied.date);
      if (applied.cameraId && applied.cameraId !== "all") params.set("camera_id", applied.cameraId);

      const { data } = await axios.get(`${baseUrl}/api/ai-alerts/intel/refine?${params.toString()}`);
      if (!data?.success) throw new Error(data?.message || "Refinement failed");
      setRefine(data);
      setOnlyRelevant(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not refine the search.");
    } finally {
      setRefining(false);
    }
  }, [applied, mode, baseUrl]);

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

  const verdictById = useMemo(() => {
    const map = {};
    (refine?.verdicts || []).forEach((v) => { map[v.id] = v; });
    return map;
  }, [refine]);

  // with the AI pass on, hide the cards it judged not to be evidence
  const visibleAlerts = useMemo(() => {
    if (!refine || !onlyRelevant) return alerts;
    return alerts.filter((a) => verdictById[a._id]?.relevant);
  }, [alerts, refine, onlyRelevant, verdictById]);

  const frames = useMemo(() => selected?.frame_urls || [], [selected]);

  const openAlert = (alert) => {
    setSelected(alert);
    onOpen();
  };

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

          <Button
            mt={2}
            w="100%"
            size="sm"
            variant="outline"
            borderRadius="8px"
            leftIcon={<FaMagic />}
            onClick={runRefine}
            isLoading={refining}
            loadingText="Reading"
            isDisabled={!applied?.keyword}
            title={
              applied?.keyword
                ? "Read the matches and keep only those that evidence the search"
                : "Run a keyword search first"
            }
          >
            AI filter
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

          {refine && (
            <Flex
              align="center"
              gap={3}
              wrap="wrap"
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              borderLeft="3px solid"
              borderLeftColor={accent}
              borderRadius="10px"
              px={4}
              py={3}
              mb={4}
            >
              <Box color={accent} fontSize="13px">
                <FaMagic />
              </Box>
              <Box minW={0} flex="1">
                <Text fontSize="13px" fontWeight="600" color={pageHeading}>
                  {refine.relevant} of {refine.reviewed} matches evidence &ldquo;{refine.query}&rdquo;
                  {refine.truncated ? " (first 40 checked)" : ""}
                </Text>
                {refine.summary && (
                  <Text fontSize="12px" color={subText} mt={0.5}>
                    {refine.summary}
                  </Text>
                )}
              </Box>
              <Button
                size="xs"
                variant={onlyRelevant ? "solid" : "outline"}
                colorScheme="blue"
                borderRadius="7px"
                onClick={() => setOnlyRelevant((v) => !v)}
              >
                {onlyRelevant ? "Showing evidence only" : "Showing all"}
              </Button>
              <Button size="xs" variant="ghost" borderRadius="7px" onClick={() => setRefine(null)}>
                Clear
              </Button>
            </Flex>
          )}

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
          ) : visibleAlerts.length === 0 ? (
            <Flex justify="center" py={20}>
              <Text fontSize="14px" color={subText}>
                {refine && onlyRelevant
                  ? "No loaded alerts evidence the search — switch to \"Showing all\"."
                  : "No alerts for these filters."}
              </Text>
            </Flex>
          ) : (
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing={5}>
              {visibleAlerts.map((alert) => (
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
                  <Box bg="black" position="relative" role="group">
                    <Image
                      src={thumbnailFor(alert)}
                      alt={alert.camera_id}
                      w="100%"
                      h="110px"
                      objectFit="cover"
                      fallbackSrc="https://via.placeholder.com/320x110?text=No+Preview"
                    />
                    <IconButton
                      icon={<FaExpand />}
                      aria-label={`Open ${alert.camera_id} frames full screen`}
                      size="xs"
                      position="absolute"
                      top="8px"
                      right="8px"
                      bg="blackAlpha.700"
                      color="white"
                      borderRadius="6px"
                      opacity={0}
                      _groupHover={{ opacity: 1 }}
                      _focusVisible={{ opacity: 1 }}
                      _hover={{ bg: "blackAlpha.900" }}
                      onClick={(event) => {
                        // the card itself opens the detail modal - go straight to the frames
                        event.stopPropagation();
                        setLightbox({ frames: alert.frame_urls || [], index: 0 });
                      }}
                    />
                  </Box>

                  <Box px={4} py={3}>
                    <Flex gap={1.5} wrap="wrap" align="center">
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
                      {verdictById[alert._id] && (
                        <Badge
                          colorScheme={verdictById[alert._id].relevant ? "green" : "gray"}
                          borderRadius="full"
                          px={2}
                          py={0.5}
                          fontSize="9px"
                          textTransform="none"
                          title={verdictById[alert._id].reason}
                        >
                          {verdictById[alert._id].relevant ? "evidence" : "ruled out"}
                        </Badge>
                      )}
                    </Flex>

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
      <Modal isOpen={isOpen} onClose={closeAlert} isCentered size="5xl">
        <ModalOverlay bg="blackAlpha.700" />
        <ModalContent bg={cardBg} borderRadius="14px" overflow="hidden">
          <ModalCloseButton zIndex={2} />
          <ModalBody p={0}>
            {/* every frame visible at once -- no stepping, no scrolling */}
            <Flex bg="black" align="stretch" gap="1px">
              {frames.map((url, index) => (
                <Box key={url} flex="1 1 0" minW={0} bg="black" position="relative" role="group">
                  <Flex justify="center" align="center" h={{ base: "180px", md: "320px" }}>
                    <Image
                      src={url}
                      alt={captionFor(index, frames.length)}
                      maxH="100%"
                      maxW="100%"
                      objectFit="contain"
                      cursor="zoom-in"
                      onClick={() => setLightbox({ frames, index })}
                    />
                  </Flex>
                  <IconButton
                    icon={<FaExpand />}
                    aria-label={`Open ${captionFor(index, frames.length)} full screen`}
                    size="xs"
                    position="absolute"
                    top="8px"
                    right="8px"
                    bg="blackAlpha.700"
                    color="white"
                    borderRadius="6px"
                    opacity={0}
                    _groupHover={{ opacity: 1 }}
                    _focusVisible={{ opacity: 1 }}
                    _hover={{ bg: "blackAlpha.900" }}
                    onClick={() => setLightbox({ frames, index })}
                  />
                  <Text fontSize="10px" color={subText} textAlign="center" px={2} pb={2} noOfLines={1}>
                    {captionFor(index, frames.length)}
                  </Text>
                </Box>
              ))}
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

      {/* ---- full-screen frame viewer ---- */}
      <Modal isOpen={Boolean(lightbox)} onClose={() => setLightbox(null)} isCentered size="full">
        <ModalOverlay bg="blackAlpha.900" />
        <ModalContent bg="transparent" boxShadow="none" m={0}>
          <ModalCloseButton color="white" size="lg" zIndex={3} />
          <ModalBody p={0} display="flex" alignItems="center" justifyContent="center" position="relative">
            <Image
              src={lightbox?.frames?.[lightbox?.index]}
              alt={`Frame ${(lightbox?.index ?? 0) + 1}`}
              maxH="92vh"
              maxW="94vw"
              objectFit="contain"
            />

            {lightbox?.frames?.length > 1 && (
              <>
                <IconButton
                  icon={<FaChevronLeft />}
                  aria-label="Previous frame"
                  position="absolute"
                  left="24px"
                  top="50%"
                  transform="translateY(-50%)"
                  isRound
                  bg="blackAlpha.700"
                  color="white"
                  _hover={{ bg: "blackAlpha.900" }}
                  isDisabled={lightbox.index === 0}
                  onClick={() => setLightbox((l) => ({ ...l, index: Math.max(0, l.index - 1) }))}
                />
                <IconButton
                  icon={<FaChevronRight />}
                  aria-label="Next frame"
                  position="absolute"
                  right="24px"
                  top="50%"
                  transform="translateY(-50%)"
                  isRound
                  bg="blackAlpha.700"
                  color="white"
                  _hover={{ bg: "blackAlpha.900" }}
                  isDisabled={lightbox.index === lightbox.frames.length - 1}
                  onClick={() => setLightbox((l) => ({ ...l, index: Math.min(l.frames.length - 1, l.index + 1) }))}
                />
                <Text
                  position="absolute"
                  bottom="20px"
                  left="50%"
                  transform="translateX(-50%)"
                  fontSize="12px"
                  color="whiteAlpha.800"
                  bg="blackAlpha.700"
                  px={3}
                  py={1}
                  borderRadius="full"
                >
                  {captionFor(lightbox.index, lightbox.frames.length)}
                </Text>
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default AiAlerts;
