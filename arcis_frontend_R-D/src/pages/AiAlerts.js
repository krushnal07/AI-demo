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
  FaFilter,
  FaArchive,
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
  Collapse,
  useBreakpointValue,
} from "@chakra-ui/react";

const PAGE_SIZE = 24;

const formatTime = (value) => (value ? moment.utc(value).format("hh:mm:ss A") : "");
const formatDateTime = (value) => (value ? moment.utc(value).format("DD-MM-YYYY, hh:mm:ss A") : "");

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

  const [mode, setMode] = useState("archive");
  const [date, setDate] = useState("");
  const [cameraId, setCameraId] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [applied, setApplied] = useState(null);

  const [refine, setRefine] = useState(null);
  const [refining, setRefining] = useState(false);
  const [onlyRelevant, setOnlyRelevant] = useState(true);

  const [lightbox, setLightbox] = useState(null);
  const [selected, setSelected] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Mobile filter panel toggle
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isMobile = useBreakpointValue({ base: true, lg: false });

  const baseUrl = process.env.REACT_APP_BASE_URL || process.env.REACT_APP_URL;

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const pageBg      = useColorModeValue("#F4F6F9", "#0E1319");
  const panelBg     = useColorModeValue("#FFFFFF", "#161C24");
  const cardBg      = useColorModeValue("#FFFFFF", "#161C24");
  const cardBorder  = useColorModeValue("#E4E9F0", "#242C36");
  const softShadow  = useColorModeValue(
    "0 1px 2px rgba(16,24,40,.04), 0 8px 20px -8px rgba(16,24,40,.10)",
    "0 1px 2px rgba(0,0,0,.4), 0 12px 28px -12px rgba(0,0,0,.6)"
  );
  const hoverShadow = useColorModeValue(
    "0 8px 28px rgba(16,24,40,.14)",
    "0 8px 28px rgba(0,0,0,.55)"
  );
  const inputBg     = useColorModeValue("white", "#1C232C");
  const pageHeading = useColorModeValue("#0F172A", "#F1F5F9");
  const subText     = useColorModeValue("#7C8AA0", "#75828F");
  const bodyText    = useColorModeValue("#475569", "#B6C2D1");
  const labelColor  = useColorModeValue("#7C8AA0", "#75828F");
  const trackBg     = useColorModeValue("#EEF2F7", "#232B35");
  const panelAlt    = useColorModeValue("#F7F9FC", "#1C232C");
  const accent      = useColorModeValue("#2a78d6", "#3987e5");
  const accentTint  = useColorModeValue("rgba(42,120,214,0.10)", "rgba(57,135,229,0.15)");
  const critColor   = "#d03b3b";
  const borderStr   = useColorModeValue("#D3DBE6", "#2E3844");

  // ── Filter options ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${baseUrl}/api/ai-alerts/filters`);
        if (cancelled || !data?.success) return;
        setCameras(data.cameras || []);
        setDates(data.dates || []);
        setDate("all");
        setApplied({ date: "all", cameraId: "all", keyword: "" });
      } catch (err) {
        if (!cancelled) setError("Could not load filter options.");
      }
    })();
    return () => { cancelled = true; };
  }, [baseUrl]);

  // ── Alerts fetch ──────────────────────────────────────────────────────────
  const fetchAlerts = useCallback(
    async (targetPage) => {
      if (!applied) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: targetPage, limit: PAGE_SIZE });
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

  const visibleAlerts = useMemo(() => {
    if (!refine || !onlyRelevant) return alerts;
    return alerts.filter((a) => verdictById[a._id]?.relevant);
  }, [alerts, refine, onlyRelevant, verdictById]);

  const frames = useMemo(() => selected?.frame_urls || [], [selected]);

  const openAlert = (alert) => { setSelected(alert); onOpen(); };
  const closeAlert = () => { setSelected(null); onClose(); };

  const hasMore = alerts.length < total;

  // ── Shared label style ────────────────────────────────────────────────────
  const labelStyle = {
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: labelColor,
    mb: 1.5,
  };

  // ── Filter panel (shared between sidebar and mobile drawer) ───────────────
  const filterContent = (
    <>
      {/* Mode toggle */}
      <Box mb={2.5}>
        <Text {...labelStyle}>View Mode</Text>
        <Flex gap={2}>
          <Button
            flex={1}
            size="sm"
            borderRadius="8px"
            variant={mode === "live" ? "solid" : "outline"}
            colorScheme={mode === "live" ? "blue" : "gray"}
            leftIcon={<FaCircle size={7} />}
            fontSize="12px"
            fontWeight="600"
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
            leftIcon={<FaArchive size={10} />}
            fontSize="12px"
            fontWeight="600"
            onClick={() => setMode("archive")}
          >
            Archive
          </Button>
        </Flex>
      </Box>

      {/* Date */}
      <Box mb={2}>
        <Text {...labelStyle}>Browse Date</Text>
        <Select
          size="sm"
          bg={inputBg}
          borderRadius="8px"
          borderColor={cardBorder}
          value={date}
          onChange={handleDateChange}
          isDisabled={mode === "live"}
          fontSize="13px"
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

      {/* Camera */}
      <Box mb={2}>
        <Text {...labelStyle}>Camera</Text>
        <Select
          size="sm"
          bg={inputBg}
          borderRadius="8px"
          borderColor={cardBorder}
          value={cameraId}
          onChange={handleCameraChange}
          fontSize="13px"
        >
          <option value="all">All Cameras</option>
          {cameras.map((cam) => (
            <option key={cam} value={cam}>{cam}</option>
          ))}
        </Select>
      </Box>

      {/* Keyword */}
      <Box mb={2.5}>
        <Text {...labelStyle}>Object / Keyword</Text>
        <Input
          size="sm"
          bg={inputBg}
          borderRadius="8px"
          borderColor={cardBorder}
          placeholder="e.g. car, person, fire"
          value={keyword}
          fontSize="13px"
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
        />
      </Box>

      {/* Actions */}
      <Button
        w="100%"
        size="sm"
        colorScheme="blue"
        borderRadius="8px"
        leftIcon={<FaSearch />}
        onClick={() => { applyFilters(); if (isMobile) setFiltersOpen(false); }}
        isLoading={loading && page === 1}
        mb={1.5}
        fontWeight="600"
      >
        Search Archive
      </Button>
      <Button
        w="100%"
        size="sm"
        variant="outline"
        borderRadius="8px"
        borderColor={borderStr}
        leftIcon={<FaMagic />}
        onClick={runRefine}
        isLoading={refining}
        loadingText="Reading…"
        isDisabled={!applied?.keyword}
        fontWeight="600"
        title={
          applied?.keyword
            ? "Read the matches and keep only those that evidence the search"
            : "Run a keyword search first"
        }
      >
        AI Filter
      </Button>

      {/* Status note */}
      <Box mt={3} p={2.5} bg={panelAlt} borderRadius="8px" border="1px solid" borderColor={cardBorder}>
        <Text fontSize="10px" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color={labelColor} mb={1}>
          Active Mode
        </Text>
        <Flex align="center" gap={1.5}>
          <Box
            boxSize="7px"
            borderRadius="full"
            bg={mode === "live" ? "#0ca30c" : accent}
            boxShadow={mode === "live" ? "0 0 0 3px rgba(12,163,12,0.2)" : "none"}
          />
          <Text fontSize="12px" color={bodyText} fontWeight="600">
            {mode === "live" ? "Live" : "Archive"}
          </Text>
        </Flex>
        <Text fontSize="11px" color={subText} mt={1} lineHeight="1.5">
          {mode === "live"
            ? "Showing the newest alerts across all days."
            : "Browsing recorded footage for the selected day."}
        </Text>
      </Box>
    </>
  );

  return (
    <Box
      bg={pageBg}
      h="calc(100vh - 56px)"
      maxH="calc(100vh - 56px)"
      display="flex"
      flexDirection="column"
      overflow="hidden"
      overscrollBehavior="none"
    >

      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <Box
        bg={panelBg}
        borderBottom="1px solid"
        borderColor={cardBorder}
        boxShadow={softShadow}
        px={{ base: 4, md: 6 }}
        py={{ base: 3, md: 3.5 }}
        mb={0}
        flexShrink={0}
        position="relative"
        overflow="hidden"
      >
        {/* gradient accent bar */}
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          h="3px"
          bgGradient={`linear(to-r, ${accent}, #3987e5, #63b3ed)`}
        />

        <Flex align="center" gap={3.5} wrap="wrap">
          {/* icon box */}
          <Flex
            align="center"
            justify="center"
            boxSize="38px"
            borderRadius="10px"
            bg={accentTint}
            color={accent}
            fontSize="17px"
            flexShrink={0}
          >
            <FaShieldAlt />
          </Flex>

          <Box minW={0}>
            <Text
              fontSize={{ base: "20px", md: "23px" }}
              fontWeight="800"
              color={pageHeading}
              letterSpacing="-0.025em"
              lineHeight="1.15"
            >
              Alert Dashboard
            </Text>
            <Text fontSize="12.5px" color={bodyText} mt={0.5}>
              {mode === "live"
                ? "Showing the newest alerts across all camera sites."
                : "Browse and search recorded alert footage by date and camera."}
            </Text>
          </Box>

          <Flex ml="auto" align="center" gap={2} flexShrink={0} wrap="wrap">
            {/* Live/Archive badge */}
            <Badge
              px={2.5}
              py={0.5}
              borderRadius="full"
              fontSize="11px"
              fontWeight="600"
              textTransform="none"
              bg={mode === "live" ? "rgba(12,163,12,0.12)" : accentTint}
              color={mode === "live" ? "#0ca30c" : accent}
            >
              {mode === "live" ? "● Live" : "Archive"}
            </Badge>

            {total > 0 && (
              <Text fontSize="12px" color={subText} display={{ base: "none", md: "block" }}>
                {alerts.length.toLocaleString()} / {total.toLocaleString()} alerts
              </Text>
            )}

            {/* Mobile filter toggle */}
            {isMobile && (
              <Button
                size="sm"
                variant="outline"
                borderRadius="8px"
                borderColor={borderStr}
                leftIcon={<FaFilter />}
                fontSize="12px"
                fontWeight="600"
                onClick={() => setFiltersOpen((v) => !v)}
              >
                Filters
              </Button>
            )}
          </Flex>
        </Flex>

        {/* Mobile filter collapse */}
        {isMobile && (
          <Collapse in={filtersOpen} animateOpacity>
            <Box mt={4} pt={4} borderTop="1px solid" borderColor={cardBorder}>
              {filterContent}
            </Box>
          </Collapse>
        )}
      </Box>

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      <Flex
        flex={1}
        minH={0}
        align="stretch"
        gap={0}
        direction={{ base: "column", lg: "row" }}
        overflow="hidden"
      >

        {/* ── Desktop sidebar (Historical Browser: fixed / non-scrollable) ─── */}
        {!isMobile && (
          <Box
            w="260px"
            flexShrink={0}
            bg={panelBg}
            borderRight="1px solid"
            borderColor={cardBorder}
            px={4}
            py={3.5}
            h="100%"
            overflow="hidden"
          >
            {/* Sidebar header */}
            <Flex align="center" gap={2} mb={3}>
              <Box color={accent} fontSize="12px">
                <FaHistory />
              </Box>
              <Text
                fontSize="10px"
                fontWeight="700"
                letterSpacing="0.12em"
                textTransform="uppercase"
                color={labelColor}
              >
                Historical Browser
              </Text>
            </Flex>

            {filterContent}
          </Box>
        )}

        {/* ── Alert grid (Only image section is scrollable) ────────────────── */}
        <Box
          flex={1}
          minH={0}
          h="100%"
          overflowY="auto"
          p={{ base: 4, md: 6 }}
          pb={{ base: 12, md: 8 }}
          w="100%"
          sx={{
            "&::-webkit-scrollbar": { width: "6px" },
            "&::-webkit-scrollbar-track": { background: "transparent" },
            "&::-webkit-scrollbar-thumb": { background: cardBorder, borderRadius: "4px" },
          }}
        >

          {/* AI refine banner */}
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
              boxShadow={softShadow}
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
                {onlyRelevant ? "Evidence only" : "Show all"}
              </Button>
              <Button size="xs" variant="ghost" borderRadius="7px" onClick={() => setRefine(null)}>
                Clear
              </Button>
            </Flex>
          )}

          {/* Error */}
          {error && (
            <Flex
              align="center"
              gap={3}
              bg={cardBg}
              border="1px solid"
              borderColor={cardBorder}
              borderLeft="3px solid"
              borderLeftColor={critColor}
              borderRadius="10px"
              px={4}
              py={3}
              mb={4}
              boxShadow={softShadow}
            >
              <Text fontSize="13px" color={critColor}>{error}</Text>
            </Flex>
          )}

          {/* Loading state (first page) */}
          {loading && page === 1 ? (
            <Flex justify="center" align="center" direction="column" gap={3} py={20}>
              <Spinner size="lg" color={accent} thickness="3px" />
              <Text fontSize="13px" color={subText}>Loading alerts…</Text>
            </Flex>

          ) : visibleAlerts.length === 0 ? (
            /* Empty state */
            <Flex
              direction="column"
              align="center"
              justify="center"
              py={20}
              gap={3}
              textAlign="center"
            >
              <Flex
                align="center"
                justify="center"
                boxSize="52px"
                borderRadius="14px"
                bg={accentTint}
                color={accent}
                fontSize="22px"
              >
                <FaShieldAlt />
              </Flex>
              <Box>
                <Text fontSize="15px" fontWeight="700" color={pageHeading}>
                  No alerts found
                </Text>
                <Text fontSize="13px" color={subText} mt={1} maxW="360px">
                  {refine && onlyRelevant
                    ? "No loaded alerts evidence the search — switch to \"Show all\"."
                    : "No alerts match these filters. Try adjusting the date or camera."}
                </Text>
              </Box>
            </Flex>

          ) : (
            /* Alert grid */
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing={4}>
              {visibleAlerts.map((alert) => (
                <Box
                  key={alert._id}
                  bg={cardBg}
                  border="1px solid"
                  borderColor={cardBorder}
                  borderRadius="12px"
                  overflow="hidden"
                  boxShadow={softShadow}
                  cursor="pointer"
                  transition="transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease"
                  _hover={{
                    transform: "translateY(-3px)",
                    boxShadow: hoverShadow,
                    borderColor: borderStr,
                  }}
                  onClick={() => openAlert(alert)}
                  role="group"
                >
                  {/* Thumbnail */}
                  <Box bg="black" position="relative">
                    <Image
                      src={thumbnailFor(alert)}
                      alt={alert.camera_id}
                      w="100%"
                      h="110px"
                      objectFit="cover"
                      display="block"
                      fallbackSrc="https://via.placeholder.com/320x110?text=No+Preview"
                    />
                    {/* Expand icon */}
                    <IconButton
                      icon={<FaExpand />}
                      aria-label={`Open ${alert.camera_id} frames full screen`}
                      size="xs"
                      position="absolute"
                      top="7px"
                      right="7px"
                      bg="blackAlpha.700"
                      color="white"
                      borderRadius="6px"
                      opacity={0}
                      _groupHover={{ opacity: 1 }}
                      _focusVisible={{ opacity: 1 }}
                      _hover={{ bg: "blackAlpha.900" }}
                      transition="opacity 0.15s ease"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightbox({ frames: alert.frame_urls || [], index: 0 });
                      }}
                    />
                    {/* Mode badge overlay */}
                    <Badge
                      position="absolute"
                      bottom="7px"
                      left="7px"
                      bg="blackAlpha.700"
                      color="white"
                      fontSize="9px"
                      fontWeight="600"
                      textTransform="uppercase"
                      borderRadius="full"
                      px={2}
                      py={0.5}
                      letterSpacing="0.05em"
                    >
                      {mode === "live" ? "Live" : "Archive"}
                    </Badge>
                  </Box>

                  {/* Card body */}
                  <Box px={3.5} py={3}>
                    <Flex gap={1.5} wrap="wrap" align="center" mb={2}>
                      <Badge
                        bg={accentTint}
                        color={accent}
                        borderRadius="full"
                        px={2.5}
                        py={0.5}
                        fontSize="10px"
                        fontWeight="700"
                        textTransform="uppercase"
                        letterSpacing="0.05em"
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

                    <Flex align="center" gap={1.5}>
                      <Box color={subText} fontSize="11px">
                        <FaRegClock />
                      </Box>
                      <Text fontSize="13px" fontWeight="700" color={pageHeading} letterSpacing="-0.01em">
                        {formatTime(alert.start_time)}
                      </Text>
                    </Flex>

                    {alert.location && (
                      <Text fontSize="11px" color={subText} mt={1} noOfLines={1}>
                        {alert.location}
                      </Text>
                    )}
                  </Box>
                </Box>
              ))}
            </SimpleGrid>
          )}

          {/* Load more */}
          {hasMore && !loading && (
            <Flex justify="center" mt={8}>
              <Button
                size="sm"
                variant="outline"
                borderColor={borderStr}
                borderRadius="8px"
                fontWeight="600"
                px={6}
                onClick={() => fetchAlerts(page + 1)}
                _hover={{ borderColor: accent, color: accent }}
              >
                Load more ({total - alerts.length} remaining)
              </Button>
            </Flex>
          )}

          {/* Inline spinner for subsequent pages */}
          {loading && page > 1 && (
            <Flex justify="center" mt={8}>
              <Spinner size="md" color={accent} thickness="3px" />
            </Flex>
          )}
        </Box>
      </Flex>

      {/* ── Detail modal ─────────────────────────────────────────────────── */}
      <Modal isOpen={isOpen} onClose={closeAlert} isCentered size="5xl">
        <ModalOverlay bg="blackAlpha.800" backdropFilter="blur(4px)" />
        <ModalContent bg={cardBg} borderRadius="14px" overflow="hidden" boxShadow="dark-lg">
          <ModalCloseButton zIndex={2} color={subText} _hover={{ color: pageHeading }} />
          <ModalBody p={0}>
            {/* Frames strip */}
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
                  <Text fontSize="10px" color="whiteAlpha.600" textAlign="center" px={2} pb={2} noOfLines={1}>
                    {captionFor(index, frames.length)}
                  </Text>
                </Box>
              ))}
            </Flex>

            {/* Metadata strip */}
            <Box px={5} py={4}>
              <Flex align="center" gap={2} wrap="wrap" mb={3}>
                <Badge
                  bg="rgba(251,146,60,0.15)"
                  color="#ea580c"
                  borderRadius="full"
                  px={2.5}
                  py={0.5}
                  fontSize="10px"
                  fontWeight="700"
                  textTransform="uppercase"
                  letterSpacing="0.06em"
                >
                  Footage Archive
                </Badge>
                <Badge
                  bg={accentTint}
                  color={accent}
                  borderRadius="full"
                  px={2.5}
                  py={0.5}
                  fontSize="10px"
                  fontWeight="700"
                  textTransform="uppercase"
                  letterSpacing="0.06em"
                >
                  {(selected?.camera_id || "").toUpperCase()}
                </Badge>
                <Text fontSize="12px" color={subText} ml="auto" fontWeight="500">
                  {formatDateTime(selected?.start_time)}
                </Text>
              </Flex>

              <Flex gap={4} wrap="wrap">
                <Box>
                  <Text fontSize="10px" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color={labelColor} mb={0.5}>
                    Location
                  </Text>
                  <Text fontSize="12px" color={bodyText}>{selected?.location || "—"}</Text>
                </Box>
                <Box>
                  <Text fontSize="10px" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color={labelColor} mb={0.5}>
                    Segment
                  </Text>
                  <Text fontSize="12px" color={bodyText}>{selected?.segment_id ?? "—"}</Text>
                </Box>
                <Box>
                  <Text fontSize="10px" fontWeight="700" letterSpacing="0.1em" textTransform="uppercase" color={labelColor} mb={0.5}>
                    Motion Score
                  </Text>
                  <Text fontSize="12px" color={bodyText}>{selected?.motion_score ?? "—"}</Text>
                </Box>
              </Flex>
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* ── Full-screen lightbox ─────────────────────────────────────────── */}
      <Modal isOpen={Boolean(lightbox)} onClose={() => setLightbox(null)} isCentered size="full">
        <ModalOverlay bg="blackAlpha.950" />
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
