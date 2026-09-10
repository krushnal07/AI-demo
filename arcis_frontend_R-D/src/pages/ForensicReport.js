import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import moment from "moment";
import {
  FaFileAlt,
  FaSearch,
  FaDownload,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaMagic,
} from "react-icons/fa";
import {
  Box,
  Flex,
  Grid,
  Text,
  Input,
  Select,
  Button,
  Badge,
  Image,
  Spinner,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useColorModeValue,
} from "@chakra-ui/react";

const PAGE_SIZE = 50;
// safety cap so an export can never walk the whole collection unbounded
const EXPORT_MAX = 2000;
const EXPORT_CHUNK = 200;

// Times arrive in two shapes: older rows hold a naive ISO string
// ("2026-08-08T04:20:58.500000"), newer ones a real Date serialised with a Z.
// Reading both as UTC shows the recorded wall clock either way -- plain
// moment() would treat the naive form as local and shift the Z form.
const asMoment = (value) => (value ? moment.utc(value) : null);
const fmtDate = (value) => (value ? moment.utc(value).format("DD-MM-YYYY") : "—");
const fmtTime = (value) => (value ? moment.utc(value).format("HH:mm:ss") : "—");

// segments are nominally 30s; derive it rather than assuming
const durationSec = (row) => {
  const start = asMoment(row.start_time);
  const end = asMoment(row.end_time);
  if (!start || !end) return null;
  const secs = end.diff(start, "seconds", true);
  return Number.isFinite(secs) && secs >= 0 ? Math.round(secs) : null;
};

// where in the source file this segment sits -- the forensic locator
const fmtOffset = (seconds) => {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
};

// frame_urls is [frame1, frame2, contact sheet]. The sheet is a single image
// holding every frame of the segment, so it is what a one-cell preview shows.
const sheetFor = (row) => {
  const frames = row?.frame_urls || [];
  return frames[frames.length - 1] || frames[0] || "";
};

// frame_urls is [frame1, frame2, contact sheet]
const frameLabel = (index, total) => (index === total - 1 ? "Contact sheet" : `Frame ${index + 1}`);

const CONFIDENCE_TONE = {
  ocr_verified: "green",
  per_segment_ocr: "blue",
  ocr_unverified: "orange",
  none: "gray",
};

const COLUMNS = [
  { key: "timestamp", label: "Date / Time", sortable: true },
  { key: "duration", label: "Duration", sortable: false },
  { key: "camera_id", label: "Camera", sortable: true },
  { key: "location", label: "Location", sortable: true },
  { key: "segment_id", label: "Segment", sortable: true },
  { key: "ocr_raw", label: "Plate (OCR)", sortable: true },

 
  { key: "preview", label: "Preview", sortable: false },
];

/**
 * Marks every occurrence of the searched term inside a description, so a
 * keyword hit can be located in a 7,000-character block of prose rather
 * than hunted for. Case-insensitive; returns the text untouched when there
 * is nothing to search for.
 */
const highlight = (text, term, tone) => {
  const body = String(text || "");
  const needle = String(term || "").trim().toLowerCase();
  if (!needle || !body) return body;

  const haystack = body.toLowerCase();
  const out = [];
  let from = 0;
  let at = haystack.indexOf(needle);
  let key = 0;

  while (at !== -1) {
    if (at > from) out.push(<React.Fragment key={key++}>{body.slice(from, at)}</React.Fragment>);
    out.push(
      <Box
        as="mark"
        key={key++}
        bg={tone}
        color="inherit"
        fontWeight="700"
        px="2px"
        borderRadius="3px"
      >
        {body.slice(at, at + needle.length)}
      </Box>
    );
    from = at + needle.length;
    at = haystack.indexOf(needle, from);
  }

  if (from === 0) return body; // no match, keep it a plain string
  out.push(<React.Fragment key={key++}>{body.slice(from)}</React.Fragment>);
  return out;
};

const csvCell = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const ForensicReport = () => {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const [cameras, setCameras] = useState([]);
  const [confidences, setConfidences] = useState([]);
  const [dates, setDates] = useState([]);

  const [date, setDate] = useState("all");
  const [cameraId, setCameraId] = useState("all");
  const [confidence, setConfidence] = useState("all");
  const [gated, setGated] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [applied, setApplied] = useState(null);

  const [sort, setSort] = useState("timestamp");
  const [order, setOrder] = useState("desc");

  // AI pass over the current keyword search: which hits are real evidence
  const [refine, setRefine] = useState(null);
  const [refining, setRefining] = useState(false);
  const [onlyRelevant, setOnlyRelevant] = useState(true);

  const [selected, setSelected] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const baseUrl = process.env.REACT_APP_BASE_URL || process.env.REACT_APP_URL;

  // --- Design System Color Tokens Matching Analytics Image ---
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
  const bodyText = useColorModeValue("#475569", "#B6C2D1");
  const markBg = useColorModeValue("#FEF08A", "#7C6F1E");
  const borderStr = useColorModeValue("#D3DBE6", "#2E3844");

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

  // shared query string, used by both the table and the export
  const buildParams = useCallback(
    (extra = {}) => {
      const params = new URLSearchParams({ sort, order, ...extra });
      if (applied?.date && applied.date !== "all") params.set("date", applied.date);
      if (applied?.cameraId && applied.cameraId !== "all") params.set("camera_id", applied.cameraId);
      if (applied?.confidence && applied.confidence !== "all") params.set("confidence", applied.confidence);
      if (applied?.gated && applied.gated !== "all") params.set("gated", applied.gated);
      if (applied?.keyword) params.set("q", applied.keyword);
      return params;
    },
    [applied, sort, order]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${baseUrl}/api/ai-alerts/filters`);
        if (cancelled || !data?.success) return;
        setCameras(data.cameras || []);
        setConfidences(data.confidences || []);
        setDates(data.dates || []);
        setApplied({ date: "all", cameraId: "all", confidence: "all", gated: "all", keyword: "" });
      } catch (err) {
        if (!cancelled) setError("Could not load filter options.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseUrl]);

  const fetchRows = useCallback(
    async (targetPage) => {
      if (!applied) return;
      setLoading(true);
      setError(null);
      try {
        const params = buildParams({ page: targetPage, limit: PAGE_SIZE });
        const { data } = await axios.get(`${baseUrl}/api/ai-alerts?${params.toString()}`);
        if (!data?.success) throw new Error(data?.message || "Request failed");
        setRows(data.data || []);
        setTotal(data.total || 0);
        setPage(data.page || 1);
      } catch (err) {
        setError(err.response?.data?.message || err.message || "Could not load the report.");
      } finally {
        setLoading(false);
      }
    },
    [applied, baseUrl, buildParams]
  );

  useEffect(() => {
    fetchRows(1);
    setRefine(null);
  }, [fetchRows]);

  const runRefine = useCallback(async () => {
    const q = (applied?.keyword || "").trim();
    if (!q) return;
    setRefining(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q, limit: 40 });
      if (applied.date && applied.date !== "all") params.set("date", applied.date);
      if (applied.cameraId && applied.cameraId !== "all") params.set("camera_id", applied.cameraId);
      if (applied.confidence && applied.confidence !== "all") params.set("confidence", applied.confidence);
      if (applied.gated && applied.gated !== "all") params.set("gated", applied.gated);

      const { data } = await axios.get(`${baseUrl}/api/ai-alerts/intel/refine?${params.toString()}`);
      if (!data?.success) throw new Error(data?.message || "Refinement failed");
      setRefine(data);
      setOnlyRelevant(true);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not refine the search.");
    } finally {
      setRefining(false);
    }
  }, [applied, baseUrl]);

  const applyFilters = (overrides = {}) =>
    setApplied({ date, cameraId, confidence, gated, keyword: keyword.trim(), ...overrides });

  const toggleSort = (key) => {
    if (sort === key) setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setOrder("desc");
    }
  };

  const sortIcon = (key) => {
    if (sort !== key) return <FaSort opacity={0.35} />;
    return order === "asc" ? <FaSortUp /> : <FaSortDown />;
  };

  // Walk the filtered set in chunks so the CSV covers more than one page.
  const handleExport = async () => {
    setExporting(true);
    try {
      const collected = [];
      for (let p = 1; collected.length < EXPORT_MAX; p += 1) {
        const params = buildParams({ page: p, limit: EXPORT_CHUNK });
        const { data } = await axios.get(`${baseUrl}/api/ai-alerts?${params.toString()}`);
        if (!data?.success || !data.data?.length) break;
        collected.push(...data.data);
        if (collected.length >= (data.total || 0)) break;
      }

      // header and row must stay in the same order and length, or every
      // column in the exported file shifts
      const header = [
        "Date", "Start", "End", "Duration (s)", "Camera", "Location", "Segment",
        "Source video", "Offset (s)", "Motion score",
        "Plate (OCR)", "OCR confidence", "Recognised plate",
        "Observation", "Contact sheet", "Frame URLs",
      ];
      const lines = collected.slice(0, EXPORT_MAX).map((r) =>
        [
          fmtDate(r.start_time), fmtTime(r.start_time), fmtTime(r.end_time), durationSec(r),
          r.camera_id, r.location, r.segment_id, r.source_video, r.video_offset_seconds,
          r.motion_score,
          r.ocr_raw, r.ocr_confidence, r.plate_number,
          r.description, sheetFor(r), (r.frame_urls || []).join(" | "),
        ].map(csvCell).join(",")
      );

      const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `forensic-report-${moment().format("YYYYMMDD-HHmmss")}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setError(err.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const verdictById = useMemo(() => {
    const map = {};
    (refine?.verdicts || []).forEach((v) => { map[v.id] = v; });
    return map;
  }, [refine]);

  // when the AI pass is on, hide rows it judged not to be evidence
  const visibleRows = useMemo(() => {
    if (!refine || !onlyRelevant) return rows;
    return rows.filter((r) => verdictById[r._id]?.relevant);
  }, [rows, refine, onlyRelevant, verdictById]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const frames = useMemo(() => selected?.frame_urls || [], [selected]);

  const getVisiblePageNumbers = () => {
    const visiblePages = [];
    visiblePages.push(1);
    if (page > 3) visiblePages.push("...");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      visiblePages.push(i);
    }
    if (totalPages - 2 > page) visiblePages.push("...");
    if (totalPages > 1) visiblePages.push(totalPages);
    return visiblePages;
  };
  const visiblePages = getVisiblePageNumbers();

  const goToPage = (pageNumber) => {
    if (typeof pageNumber === "number" && pageNumber >= 1 && pageNumber <= totalPages) {
      fetchRows(pageNumber);
    }
  };

  const openRow = (row) => {
    setSelected(row);
    onOpen();
  };

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
            Forensic Report
          </Text>
          <Text
            fontFamily="'Manrope', sans-serif"
            fontSize="13px"
            color={subText}
            mt="2px"
          >
            Segment-level archive — click any row to view frames and metadata
          </Text>
        </Box>
        <Flex align="center" gap={3}>
          {total > 0 && (
            <Text fontSize="12px" color={subText} display={{ base: "none", md: "block" }}>
              {total.toLocaleString()} segment{total === 1 ? "" : "s"}
            </Text>
          )}
          <Button
            leftIcon={<FaDownload size={13} />}
            onClick={handleExport}
            isLoading={exporting}
            loadingText="Exporting…"
            isDisabled={!total}
            bg={accent}
            color="white"
            _hover={{ opacity: 0.9 }}
            size="sm"
            borderRadius="10px"
            fontFamily="'Manrope', sans-serif"
            fontWeight="700"
            fontSize="12px"
            lineHeight="18px"
            letterSpacing="0px"
            textAlign="center"
          >
            Export CSV
          </Button>
        </Flex>
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
          mb="24px"
          alignItems="flex-end"
        >
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
              DATE
            </Text>
            <Select
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setApplied((prev) => ({ ...prev, date: e.target.value }));
              }}
              bg={inputBg}
              borderColor={cardBorder}
              borderWidth="1px"
              borderRadius="8px"
              h="38px"
              fontFamily="Manrope, sans-serif"
              fontWeight="400"
              fontSize="12px"
              color={pageHeading}
              _focus={{ borderColor: "#3F77A5", boxShadow: "0 0 0 1px #3F77A5" }}
            >
              <option value="all">All Dates</option>
              {dates.map((d) => (
                <option key={d.date} value={d.date}>
                  {d.date} ({d.count})
                </option>
              ))}
            </Select>
          </Box>

          {/* Camera */}
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
              CAMERA
            </Text>
            <Select
              value={cameraId}
              onChange={(e) => {
                setCameraId(e.target.value);
                setApplied((prev) => ({ ...prev, cameraId: e.target.value }));
              }}
              bg={inputBg}
              borderColor={cardBorder}
              borderWidth="1px"
              borderRadius="8px"
              h="38px"
              fontFamily="Manrope, sans-serif"
              fontWeight="400"
              fontSize="12px"
              color={pageHeading}
              _focus={{ borderColor: "#3F77A5", boxShadow: "0 0 0 1px #3F77A5" }}
            >
              <option value="all">All Cameras</option>
              {cameras.map((cam) => (
                <option key={cam} value={cam}>
                  {cam}
                </option>
              ))}
            </Select>
          </Box>

          {/* Keyword */}
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
              OBJECT / KEYWORD
            </Text>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFilters();
              }}
              placeholder="e.g. bus, person, GJ27"
              bg={inputBg}
              borderColor={cardBorder}
              borderWidth="1px"
              borderRadius="8px"
              h="38px"
              fontFamily="Manrope, sans-serif"
              fontWeight="400"
              fontSize="12px"
              color={pageHeading}
              _focus={{ borderColor: "#3F77A5", boxShadow: "0 0 0 1px #3F77A5" }}
            />
          </Box>

          {/* Action Buttons */}
          <Flex gap="10px" align="flex-end" h="100%">
            <Button
              flex={1}
              h="38px"
              bg={accent}
              color="white"
              borderRadius="8px"
              fontFamily="'Manrope', sans-serif"
              fontWeight="700"
              fontSize="12px"
              lineHeight="18px"
              letterSpacing="0px"
              textAlign="center"
              leftIcon={<FaSearch size={12} />}
              onClick={() => applyFilters()}
              _hover={{ opacity: 0.9 }}
            >
              Search
            </Button>
            <Button
              flex={1}
              h="38px"
              variant="outline"
              borderColor={cardBorder}
              borderRadius="8px"
              fontFamily="'Manrope', sans-serif"
              fontWeight="700"
              fontSize="12px"
              lineHeight="18px"
              letterSpacing="0px"
              textAlign="center"
              leftIcon={<FaMagic size={12} />}
              onClick={runRefine}
              isLoading={refining}
              loadingText="Reading…"
              isDisabled={!applied?.keyword}
              title={
                applied?.keyword
                  ? "Read the matches and keep only those that evidence the search"
                  : "Run a keyword search first"
              }
              _hover={{ borderColor: accent, color: accent }}
            >
              AI Filter
            </Button>
          </Flex>
        </Grid>

        {/* AI Refine Summary Banner */}
        {refine && (
          <Flex
            bg={accentTint}
            border="1px solid"
            borderColor={cardBorder}
            borderLeft="3px solid"
            borderLeftColor={accent}
            borderRadius="12px"
            p={4}
            mb={5}
            justify="space-between"
            align="center"
            wrap="wrap"
            gap={3}
          >
            <Flex align="center" gap={3} minW={0} flex="1">
              <Box color={accent} fontSize="14px">
                <FaMagic />
              </Box>
              <Box minW={0}>
                <Text fontSize="13px" fontWeight="700" color={pageHeading} fontFamily="Manrope, sans-serif">
                  {refine.relevant} of {refine.reviewed} matches evidence &ldquo;{refine.query}&rdquo;
                  {refine.truncated ? " (first 40 checked)" : ""}
                </Text>
                {refine.summary && (
                  <Text fontSize="12px" color={subText} mt={0.5} fontFamily="Manrope, sans-serif">
                    {refine.summary}
                  </Text>
                )}
              </Box>
            </Flex>
            <Flex align="center" gap={2}>
              <Button
                size="xs"
                variant={onlyRelevant ? "solid" : "outline"}
                bg={onlyRelevant ? accent : "transparent"}
                color={onlyRelevant ? "white" : "inherit"}
                borderColor={cardBorder}
                borderRadius="8px"
                fontFamily="'Manrope', sans-serif"
                fontWeight="700"
                fontSize="12px"
                lineHeight="18px"
                letterSpacing="0px"
                textAlign="center"
                onClick={() => setOnlyRelevant((v) => !v)}
              >
                {onlyRelevant ? "Showing evidence only" : "Showing all rows"}
              </Button>
              <Button
                size="xs"
                variant="ghost"
                borderRadius="8px"
                fontFamily="'Manrope', sans-serif"
                fontWeight="700"
                fontSize="12px"
                lineHeight="18px"
                letterSpacing="0px"
                textAlign="center"
                onClick={() => setRefine(null)}
              >
                Clear
              </Button>
            </Flex>
          </Flex>
        )}

        {error && (
          <Box bg="red.50" border="1px solid" borderColor="red.200" borderRadius="10px" p={3} mb={5}>
            <Text fontSize="13px" color="red.600" fontFamily="Manrope, sans-serif">
              {error}
            </Text>
          </Box>
        )}

        {/* Table View matching AnalyticsImage Layout & Typography */}
        <Box
          borderRadius="10px"
          overflow="hidden"
          border="1px solid"
          borderColor={tableBorderColor}
        >
          <Box overflowX="auto">
            <Table variant="simple" size="md">
              <Thead position="sticky" top={0} zIndex={2} bg={tableHeaderBg}>
                <Tr borderBottom="1px solid" borderColor={tableBorderColor}>
                  {COLUMNS.map((col) => (
                    <Th
                      key={col.key}
                      sx={thStyle}
                      cursor={col.sortable ? "pointer" : "default"}
                      onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                      _hover={col.sortable ? { color: accent } : undefined}
                    >
                      <Flex align="center" gap={1.5}>
                        {col.label}
                        {col.sortable && <Box fontSize="11px">{sortIcon(col.key)}</Box>}
                      </Flex>
                    </Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {loading ? (
                  <Tr>
                    <Td colSpan={COLUMNS.length} textAlign="center" py={12} borderColor={tableBorderColor}>
                      <Flex direction="column" align="center" gap={3}>
                        <Spinner size="lg" color={accent} thickness="3px" />
                        <Text color={subtextColor} fontFamily="Manrope, sans-serif" fontSize="13px">Loading…</Text>
                      </Flex>
                    </Td>
                  </Tr>
                ) : error ? (
                  <Tr>
                    <Td colSpan={COLUMNS.length} textAlign="center" py={12} color="red.500" borderColor={tableBorderColor} fontFamily="Manrope, sans-serif">
                      {error}
                    </Td>
                  </Tr>
                ) : visibleRows.length === 0 ? (
                  <Tr>
                    <Td colSpan={COLUMNS.length} textAlign="center" py={12} color={subtextColor} borderColor={tableBorderColor} fontFamily="Manrope, sans-serif" fontSize="13px">
                      {refine && onlyRelevant
                        ? "No rows on this page evidence the search — switch to \"Showing all rows\"."
                        : "No segments match these filters."}
                    </Td>
                  </Tr>
                ) : (
                  visibleRows.map((row, index) => {
                    const isEvenRow = index % 2 === 1;
                    return (
                      <Tr
                        key={row._id}
                        bg={isEvenRow ? rowAltBg : cardBg}
                        borderBottom="1px solid"
                        borderColor={tableBorderColor}
                        _hover={{ bg: tableRowHoverBg }}
                        transition="background 0.15s ease"
                        cursor="pointer"
                        onClick={() => openRow(row)}
                      >
                        {/* Date / Time */}
                        <Td sx={tdStyle} whiteSpace="nowrap">
                          <Text fontSize="13px" fontWeight="600" color={titleColor} fontFamily="Manrope, sans-serif">
                            {fmtTime(row.start_time)}
                          </Text>
                          <Text fontSize="11px" color={subtextColor} fontFamily="Manrope, sans-serif">
                            {fmtDate(row.start_time)}
                          </Text>
                        </Td>

                        {/* Duration */}
                        <Td sx={tdStyle} whiteSpace="nowrap">
                          {durationSec(row) == null ? "—" : `${durationSec(row)}s`}
                        </Td>

                        {/* Camera ID (styled blue #3F77A5 matching Listview/AnalyticsImage) */}
                        <Td sx={{ ...tdStyle, color: "#3F77A5", fontWeight: "700" }} whiteSpace="nowrap">
                          {row.camera_id}
                        </Td>

                        {/* Location */}
                        <Td sx={tdStyle} fontWeight="600" color={titleColor} whiteSpace="nowrap">
                          {row.location || "—"}
                        </Td>

                        {/* Segment */}
                        <Td sx={tdStyle}>
                          {row.segment_id ?? "—"}
                        </Td>

                        {/* Plate (OCR) */}
                        <Td sx={tdStyle} whiteSpace="nowrap">
                          {verdictById[row._id] && (
                            <Badge
                              colorScheme={verdictById[row._id].relevant ? "green" : "gray"}
                              fontSize="10px"
                              borderRadius="full"
                              px={2}
                              py={0.5}
                              mb={1}
                              textTransform="none"
                              title={verdictById[row._id].reason}
                              fontFamily="Manrope, sans-serif"
                            >
                              {verdictById[row._id].relevant ? "evidence" : "ruled out"}
                            </Badge>
                          )}
                          {row.ocr_raw ? (
                            <>
                              <Text fontSize="12px" fontWeight="700" fontFamily="mono" color={titleColor}>
                                {row.ocr_raw}
                              </Text>
                              {row.ocr_confidence != null && (
                                <Text fontSize="11px" color={subtextColor} fontFamily="Manrope, sans-serif">
                                  {Math.round(row.ocr_confidence * 100)}%
                                  {row.recognized ? "" : " · unrecognised"}
                                </Text>
                              )}
                            </>
                          ) : (
                            <Text color={subtextColor}>—</Text>
                          )}
                        </Td>

                        {/* Preview Image */}
                        <Td sx={tdStyle}>
                          <Box
                            display="inline-flex"
                            alignItems="center"
                            justifyContent="center"
                            w="64px"
                            h="38px"
                            borderRadius="8px"
                            overflow="hidden"
                            border="1px solid"
                            borderColor={cardBorder}
                            bg={actionBtnBg}
                            cursor="pointer"
                            transition="all 0.2s ease"
                            _hover={{
                              transform: "scale(1.06)",
                              boxShadow: "0 4px 12px rgba(63, 119, 165, 0.25)",
                              borderColor: "#3F77A5",
                            }}
                          >
                            <Image
                              src={sheetFor(row)}
                              alt={`${row.camera_id} segment ${row.segment_id}`}
                              w="100%"
                              h="100%"
                              objectFit="cover"
                              fallback={
                                <Box
                                  display="flex"
                                  alignItems="center"
                                  justifyContent="center"
                                  w="100%"
                                  h="100%"
                                  color="#3F77A5"
                                  bg={actionBtnBg}
                                >
                                  <FaFileAlt size="14px" />
                                </Box>
                              }
                            />
                          </Box>
                        </Td>
                      </Tr>
                    );
                  })
                )}
              </Tbody>
            </Table>
          </Box>
        </Box>

        {/* Pagination matching AnalyticsImage */}
        {total > 0 && (
          <Flex
            justify={{ base: "center", sm: "space-between" }}
            align="center"
            mt={6}
            wrap="wrap"
            gap={3}
          >
            <Text fontSize="13px" color={subtextColor} fontFamily="Manrope, sans-serif">
              Page {page} of {totalPages} &mdash; {rows.length.toLocaleString()} of {total.toLocaleString()} segments
            </Text>
            <Flex justify="center" align="center" gap={1} wrap="wrap">
              <Button
                size="sm"
                variant="outline"
                borderColor={cardBorder}
                onClick={() => fetchRows(page - 1)}
                isDisabled={page <= 1 || loading}
                mr={1}
                fontFamily="'Manrope', sans-serif"
                fontWeight="700"
                fontSize="12px"
                lineHeight="18px"
                letterSpacing="0px"
                textAlign="center"
                _hover={{ bg: tableRowHoverBg }}
              >
                Prev
              </Button>
              {visiblePages.map((p, idx) =>
                typeof p === "number" ? (
                  <Button
                    key={idx}
                    size="sm"
                    minW="38px"
                    variant={page === p ? "solid" : "outline"}
                    bg={page === p ? accent : "transparent"}
                    color={page === p ? "white" : "inherit"}
                    borderColor={cardBorder}
                    _hover={page === p ? { bg: accent } : { bg: tableRowHoverBg }}
                    onClick={() => goToPage(p)}
                    fontFamily="'Manrope', sans-serif"
                    fontWeight="700"
                    fontSize="12px"
                    lineHeight="18px"
                    letterSpacing="0px"
                    textAlign="center"
                  >
                    {p}
                  </Button>
                ) : (
                  <Text key={idx} px={1} color={subtextColor} fontFamily="Manrope, sans-serif">
                    …
                  </Text>
                )
              )}
              <Button
                size="sm"
                variant="outline"
                borderColor={cardBorder}
                onClick={() => fetchRows(page + 1)}
                isDisabled={page >= totalPages || loading}
                ml={1}
                fontFamily="'Manrope', sans-serif"
                fontWeight="700"
                fontSize="12px"
                lineHeight="18px"
                letterSpacing="0px"
                textAlign="center"
                _hover={{ bg: tableRowHoverBg }}
              >
                Next
              </Button>
            </Flex>
          </Flex>
        )}
      </Box>

      {/* ── Row detail modal ─────────────────────────────────────────── */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(4px)" />
        <ModalContent
          bg={cardBg}
          borderRadius="16px"
          overflow="hidden"
          border="1px solid"
          borderColor={cardBorder}
          boxShadow={softShadow}
          maxW={{ base: "94vw", md: "80vw" }}
          w={{ base: "94vw", md: "80vw" }}
          h={{ base: "90vh", md: "80vh" }}
          my="auto"
          fontFamily="Manrope, sans-serif"
        >
          <ModalCloseButton zIndex={3} color="white" />
          <ModalBody p={0} display="flex" overflow="hidden">
            <Flex direction={{ base: "column", md: "row" }} align="stretch" w="100%" h="100%" minH={0}>
              {/* ---- left: every frame stacked, scrolling vertically ---- */}
              <Box
                bg="black"
                flex={{ base: "0 0 45%", md: "0 0 62%" }}
                h={{ base: "45%", md: "100%" }}
                minH={0}
                overflowY="auto"
              >
                {frames.length === 0 ? (
                  <Flex justify="center" align="center" h="100%">
                    <Text fontSize="13px" color="whiteAlpha.700" fontFamily="Manrope, sans-serif">
                      No frames for this segment
                    </Text>
                  </Flex>
                ) : (
                  frames.map((url, i) => (
                    <Box key={url} position="relative" borderBottom={i < frames.length - 1 ? "1px solid" : "none"} borderColor="whiteAlpha.300">
                      <Image
                        src={url}
                        alt={`${selected?.camera_id} ${frameLabel(i, frames.length)}`}
                        w="100%"
                        objectFit="contain"
                        fallbackSrc="https://via.placeholder.com/640x360?text=Frame+unavailable"
                      />
                      <Badge
                        position="absolute"
                        top="8px"
                        left="8px"
                        bg="blackAlpha.700"
                        color="white"
                        fontSize="9px"
                        borderRadius="full"
                        px={2}
                        textTransform="none"
                        fontFamily="Manrope, sans-serif"
                      >
                        {frameLabel(i, frames.length)} · {i + 1} of {frames.length}
                      </Badge>
                    </Box>
                  ))
                )}
              </Box>

              {/* ---- right: everything else, scrolls on its own ---- */}
              <Box flex="1" p={{ base: 5, md: 6 }} h={{ base: "55%", md: "100%" }} minH={0} overflowY="auto">
                <Text fontSize="16px" fontWeight="800" color={titleColor} pr={6} fontFamily="Manrope, sans-serif">
                  {selected?.camera_id}
                </Text>
                <Text fontSize="12px" color={subtextColor} mt={0.5} fontFamily="Manrope, sans-serif">
                  {fmtDate(selected?.start_time)} · {fmtTime(selected?.start_time)} → {fmtTime(selected?.end_time)}
                  {durationSec(selected || {}) != null ? ` (${durationSec(selected)}s)` : ""}
                </Text>

                <Box mt={4}>
                  {[
                    ["Segment", selected?.segment_id],
                    ["Location", selected?.location],
                    ["Plate (OCR)", selected?.ocr_raw],
                    [
                      "OCR confidence",
                      selected?.ocr_raw && selected?.ocr_confidence != null
                        ? `${Math.round(selected.ocr_confidence * 100)}%`
                        : null,
                    ],
                    ["Recognised plate", selected?.plate_number],
                    ["Source video", selected?.source_video],
                    ["Offset in source", fmtOffset(selected?.video_offset_seconds)],
                    ["Motion score", selected?.motion_score],
                    ["Cumulative minutes", selected?.cumulative_minutes],
                  ].map(([label, value]) => (
                    <Flex key={label} justify="space-between" gap={4} py={2} borderBottom="1px solid" borderColor={tableBorderColor}>
                      <Text fontSize="12px" color={subtextColor} flexShrink={0} fontFamily="Manrope, sans-serif">
                        {label}
                      </Text>
                      <Text fontSize="12px" color={tableTextColor} fontWeight="500" textAlign="right" wordBreak="break-word" fontFamily="Manrope, sans-serif">
                        {value == null || value === "" ? "—" : String(value)}
                      </Text>
                    </Flex>
                  ))}
                </Box>

                <Flex align="center" gap={2} mt={5} mb={1.5}>
                  <Text fontSize="10px" fontWeight="700" letterSpacing="0.06em" color={subtextColor} fontFamily="Manrope, sans-serif">
                    OBSERVATION
                  </Text>
                  {applied?.keyword && (
                    <Badge bg={markBg} color={titleColor} fontSize="10px" borderRadius="full" px={2} textTransform="none" fontFamily="Manrope, sans-serif">
                      {applied.keyword}
                    </Badge>
                  )}
                </Flex>
                <Text fontSize="13px" color={tableTextColor} lineHeight="1.7" whiteSpace="pre-wrap" fontFamily="Manrope, sans-serif">
                  {highlight(selected?.description, applied?.keyword, markBg)}
                </Text>
              </Box>
            </Flex>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ForensicReport;
