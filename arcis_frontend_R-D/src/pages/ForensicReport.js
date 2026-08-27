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
  Spinner,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
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

  const [selected, setSelected] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const baseUrl = process.env.REACT_APP_BASE_URL || process.env.REACT_APP_URL;

  const pageBg = useColorModeValue("gray.50", "gray.900");
  const cardBg = useColorModeValue("#FFFFFF", "gray.800");
  const cardBorder = useColorModeValue("rgba(226,232,240,0.9)", "whiteAlpha.200");
  const softShadow = useColorModeValue("0 1px 3px rgba(0,0,0,0.06)", "dark-lg");
  const inputBg = useColorModeValue("white", "gray.700");
  const headBg = useColorModeValue("gray.50", "gray.700");
  const rowHover = useColorModeValue("gray.50", "whiteAlpha.100");
  const pageHeading = useColorModeValue("gray.800", "whiteAlpha.900");
  const subText = useColorModeValue("gray.500", "gray.400");
  const accent = useColorModeValue("#3F77A5", "#63B3ED");
  const bodyText = useColorModeValue("gray.600", "gray.300");

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
  }, [fetchRows]);

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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const frames = useMemo(() => selected?.frame_urls || [], [selected]);

  const openRow = (row) => {
    setSelected(row);
    onOpen();
  };

  return (
    <Box bg={pageBg} minH="100vh" pt={{ base: "70px", md: "0" }} pb={{ base: "100px", md: 6 }} px={{ base: 3, md: 6 }}>
      {/* ---------------- Header ---------------- */}
      <Flex align="center" gap={3} py={5} wrap="wrap">
        <Box color={accent} fontSize="18px">
          <FaFileAlt />
        </Box>
        <Text fontSize="18px" fontWeight="700" color={pageHeading}>
          Forensic Report
        </Text>
        <Text fontSize="12px" color={subText}>
          {total.toLocaleString()} segment{total === 1 ? "" : "s"}
        </Text>
        <Button
          ml="auto"
          size="sm"
          leftIcon={<FaDownload />}
          onClick={handleExport}
          isLoading={exporting}
          loadingText="Exporting"
          isDisabled={!total}
        >
          Export CSV
        </Button>
      </Flex>

      {/* ---------------- Filters ---------------- */}
      <Flex
        gap={3}
        mb={4}
        wrap="wrap"
        bg={cardBg}
        border="1px solid"
        borderColor={cardBorder}
        borderRadius="12px"
        p={3}
        align="flex-end"
      >
        <Box minW="150px">
          <Text fontSize="10px" fontWeight="700" letterSpacing="0.08em" color={subText} mb={1}>
            DATE
          </Text>
          <Select
            size="sm"
            bg={inputBg}
            borderRadius="8px"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setApplied((prev) => ({ ...prev, date: e.target.value }));
            }}
          >
            <option value="all">All Dates</option>
            {dates.map((d) => (
              <option key={d.date} value={d.date}>
                {d.date} ({d.count})
              </option>
            ))}
          </Select>
        </Box>

        <Box minW="170px">
          <Text fontSize="10px" fontWeight="700" letterSpacing="0.08em" color={subText} mb={1}>
            CAMERA
          </Text>
          <Select
            size="sm"
            bg={inputBg}
            borderRadius="8px"
            value={cameraId}
            onChange={(e) => {
              setCameraId(e.target.value);
              setApplied((prev) => ({ ...prev, cameraId: e.target.value }));
            }}
          >
            <option value="all">All Cameras</option>
            {cameras.map((cam) => (
              <option key={cam} value={cam}>
                {cam}
              </option>
            ))}
          </Select>
        </Box>

        {/* <Box minW="160px">
          <Text fontSize="10px" fontWeight="700" letterSpacing="0.08em" color={subText} mb={1}>
            CONFIDENCE
          </Text>
          <Select
            size="sm"
            bg={inputBg}
            borderRadius="8px"
            value={confidence}
            onChange={(e) => {
              setConfidence(e.target.value);
              setApplied((prev) => ({ ...prev, confidence: e.target.value }));
            }}
          >
            <option value="all">Any</option>
            {confidences.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Box> */}

        {/* <Box minW="140px">
          <Text fontSize="10px" fontWeight="700" letterSpacing="0.08em" color={subText} mb={1}>
            MOTION GATED
          </Text>
          <Select
            size="sm"
            bg={inputBg}
            borderRadius="8px"
            value={gated}
            onChange={(e) => {
              setGated(e.target.value);
              setApplied((prev) => ({ ...prev, gated: e.target.value }));
            }}
          >
            <option value="all">Any</option>
            <option value="true">Gated only</option>
            <option value="false">Not gated</option>
          </Select>
        </Box> */}

        <Box flex="1" minW="200px">
          <Text fontSize="10px" fontWeight="700" letterSpacing="0.08em" color={subText} mb={1}>
            KEYWORD
          </Text>
          <Input
            size="sm"
            bg={inputBg}
            borderRadius="8px"
            placeholder="e.g. bus, person, GJ27"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters();
            }}
          />
        </Box>

        <Button size="sm" colorScheme="blue" borderRadius="8px" leftIcon={<FaSearch />} onClick={() => applyFilters()}>
          Search
        </Button>
      </Flex>

      {error && (
        <Box bg="red.50" borderRadius="10px" p={3} mb={4}>
          <Text fontSize="13px" color="red.600">
            {error}
          </Text>
        </Box>
      )}

      {/* ---------------- Table ---------------- */}
      <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="12px" boxShadow={softShadow} overflow="hidden">
        <TableContainer overflowX="auto">
          <Table size="sm" variant="simple">
            <Thead bg={headBg}>
              <Tr>
                {COLUMNS.map((col) => (
                  <Th
                    key={col.key}
                    fontSize="10px"
                    color={subText}
                    cursor={col.sortable ? "pointer" : "default"}
                    onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                    whiteSpace="nowrap"
                  >
                    <Flex align="center" gap={1.5}>
                      {col.label}
                      {col.sortable && <Box fontSize="9px">{sortIcon(col.key)}</Box>}
                    </Flex>
                  </Th>
                ))}
              </Tr>
            </Thead>
            <Tbody>
              {loading ? (
                <Tr>
                  <Td colSpan={COLUMNS.length}>
                    <Flex justify="center" py={10}>
                      <Spinner color={accent} />
                    </Flex>
                  </Td>
                </Tr>
              ) : rows.length === 0 ? (
                <Tr>
                  <Td colSpan={COLUMNS.length}>
                    <Flex justify="center" py={10}>
                      <Text fontSize="13px" color={subText}>
                        No segments match these filters.
                      </Text>
                    </Flex>
                  </Td>
                </Tr>
              ) : (
                rows.map((row) => (
                  <Tr key={row._id} _hover={{ bg: rowHover }} cursor="pointer" onClick={() => openRow(row)}>
                    <Td whiteSpace="nowrap">
                      <Text fontSize="12px" fontWeight="600" color={pageHeading}>
                        {fmtTime(row.start_time)}
                      </Text>
                      <Text fontSize="11px" color={subText}>
                        {fmtDate(row.start_time)}
                      </Text>
                    </Td>
                    <Td fontSize="12px" color={bodyText} whiteSpace="nowrap">
                      {durationSec(row) == null ? "—" : `${durationSec(row)}s`}
                    </Td>
                    <Td fontSize="12px" color={bodyText} whiteSpace="nowrap">
                      {row.camera_id}
                    </Td>
                    <Td fontSize="12px" color={bodyText} whiteSpace="nowrap">
                      {row.location || "—"}
                    </Td>
                    <Td fontSize="12px" color={bodyText}>
                      {row.segment_id ?? "—"}
                    </Td>
                    <Td whiteSpace="nowrap">
                      {/* only ANPR rows carry a plate; everything else stays blank */}
                      {row.ocr_raw ? (
                        <>
                          <Text fontSize="12px" fontWeight="600" fontFamily="mono" color={pageHeading}>
                            {row.ocr_raw}
                          </Text>
                          {row.ocr_confidence != null && (
                            <Text fontSize="10px" color={subText}>
                              {Math.round(row.ocr_confidence * 100)}%
                              {row.recognized ? "" : " · unrecognised"}
                            </Text>
                          )}
                        </>
                      ) : null}
                    </Td>
                    {/* <Td fontSize="12px" color={bodyText} whiteSpace="nowrap">
                      {row.motion_score != null ? row.motion_score.toFixed(3) : "—"}
                      {row.motion_gated && (
                        <Badge ml={1.5} colorScheme="purple" fontSize="9px" borderRadius="full" px={1.5}>
                          gated
                        </Badge>
                      )}
                    </Td> */}
                    {/* <Td whiteSpace="nowrap">
                      <Badge
                        colorScheme={CONFIDENCE_TONE[row.anchor_confidence] || "gray"}
                        fontSize="9px"
                        borderRadius="full"
                        px={2}
                        textTransform="none"
                      >
                        {row.anchor_confidence || "—"}
                      </Badge>
                    </Td> */}
                    <Td>
                      <Image
                        src={sheetFor(row)}
                        alt={`${row.camera_id} segment ${row.segment_id}`}
                        w="104px"
                        h="58px"
                        objectFit="cover"
                        borderRadius="6px"
                        bg="black"
                        fallbackSrc="https://via.placeholder.com/104x58?text=No+Frame"
                      />
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </TableContainer>
      </Box>

      {/* ---------------- Pagination ---------------- */}
      {total > 0 && (
        <Flex justify="space-between" align="center" mt={4} wrap="wrap" gap={2}>
          <Text fontSize="12px" color={subText}>
            Page {page} of {totalPages} — showing {rows.length} of {total.toLocaleString()}
          </Text>
          <Flex gap={2}>
            <Button size="sm" variant="outline" borderColor={cardBorder} onClick={() => fetchRows(page - 1)} isDisabled={page <= 1 || loading}>
              Previous
            </Button>
            <Button size="sm" variant="outline" borderColor={cardBorder} onClick={() => fetchRows(page + 1)} isDisabled={page >= totalPages || loading}>
              Next
            </Button>
          </Flex>
        </Flex>
      )}

      {/* ---------------- Row detail ---------------- */}
      <Modal isOpen={isOpen} onClose={onClose} isCentered size="5xl" scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.700" />
        <ModalContent bg={cardBg} borderRadius="14px" overflow="hidden">
          <ModalCloseButton zIndex={3} color="white" />
          <ModalBody p={0}>
            <Flex direction={{ base: "column", md: "row" }} align="stretch">
              {/* ---- left: every frame stacked, scrolling vertically ---- */}
              <Box
                bg="black"
                flex={{ base: "none", md: "0 0 62%" }}
                maxH={{ base: "320px", md: "460px" }}
                overflowY="auto"
              >
                {frames.length === 0 ? (
                  <Flex justify="center" align="center" h={{ base: "320px", md: "460px" }}>
                    <Text fontSize="13px" color="whiteAlpha.700">
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
                      >
                        {frameLabel(i, frames.length)} · {i + 1} of {frames.length}
                      </Badge>
                    </Box>
                  ))
                )}
              </Box>

              {/* ---- right: everything else, scrolls on its own ---- */}
              <Box flex="1" p={5} maxH={{ base: "none", md: "460px" }} overflowY="auto">
                <Text fontSize="15px" fontWeight="700" color={pageHeading} pr={6}>
                  {selected?.camera_id}
                </Text>
                <Text fontSize="12px" color={subText} mt={0.5}>
                  {fmtDate(selected?.start_time)} · {fmtTime(selected?.start_time)} → {fmtTime(selected?.end_time)}
                  {durationSec(selected || {}) != null ? ` (${durationSec(selected)}s)` : ""}
                </Text>

                {/* <Flex gap={2} mt={2} wrap="wrap">
                  <Badge
                    colorScheme={CONFIDENCE_TONE[selected?.anchor_confidence] || "gray"}
                    fontSize="9px"
                    borderRadius="full"
                    px={2}
                    textTransform="none"
                  >
                    {selected?.anchor_confidence || "—"}
                  </Badge>
                  {selected?.motion_gated && (
                    <Badge colorScheme="purple" fontSize="9px" borderRadius="full" px={2}>
                      motion gated
                    </Badge>
                  )}
                </Flex> */}

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
                    <Flex key={label} justify="space-between" gap={4} py={1.5} borderBottom="1px solid" borderColor={cardBorder}>
                      <Text fontSize="11px" color={subText} flexShrink={0}>
                        {label}
                      </Text>
                      <Text fontSize="12px" color={bodyText} textAlign="right" wordBreak="break-word">
                        {value == null || value === "" ? "—" : String(value)}
                      </Text>
                    </Flex>
                  ))}
                </Box>

                <Text fontSize="10px" fontWeight="700" letterSpacing="0.06em" color={subText} mt={4}>
                  OBSERVATION
                </Text>
                <Text fontSize="13px" color={bodyText} mt={1} whiteSpace="pre-wrap">
                  {selected?.description}
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
