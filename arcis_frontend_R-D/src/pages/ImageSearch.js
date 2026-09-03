// src/pages/ImageSearch.js
//
// Find Related Images - face search against the standalone service at
// /api/search. Entirely frontend: the PNG/JPEG the officer picks is posted
// straight to the service as multipart/form-data. Nothing is uploaded to our
// own backend, converted to a URL, or staged in cloud storage first.
//
// The response shape below is the service's own contract (its bundled UI
// renders exactly these fields):
//   { faces_found: number,
//     results: [ { bbox:[x1,y1,x2,y2], det_score, skip_reason, matches:[
//       { person_name, similarity, images:[ {url, location, timestamp} ] } ] } ] }
// Errors come back as { detail: "..." } with 400/422.
//
// The service also accepts an optional `location` field; we deliberately do not
// send one, so a search covers every location. Only `file` is required.
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Box,
  Flex,
  Text,
  Button,
  Input,
  Image,
  Badge,
  Spinner,
  SimpleGrid,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";
import { FaSearch, FaUpload, FaTimes, FaRedo, FaExclamationTriangle, FaUserCheck } from "react-icons/fa";
import { MdImageSearch } from "react-icons/md";
import { Panel, SectionLabel, useIntelTheme, MONO_FONT } from "../components/intel/IntelKit";

const API_URL = process.env.REACT_APP_FACE_SEARCH_URL || "https://vmschatbot.vmukti.com:21143/api/search";

// Stored images may come back as a path rather than an absolute URL. The
// service's own page can use them as-is because it is same-origin; we are not,
// so resolve everything against the service origin.
const API_ORIGIN = (() => {
  try {
    return new URL(API_URL).origin;
  } catch {
    return "";
  }
})();

const resolveUrl = (u) => {
  if (!u) return "";
  try {
    return new URL(u, API_ORIGIN).href;
  } catch {
    return u;
  }
};

const ACCEPT = ["image/png", "image/jpeg", "image/jpg"];
const MAX_BYTES = 15 * 1024 * 1024;

const pad = (n) => String(n).padStart(2, "0");
const toInput = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// datetime-local yields "YYYY-MM-DDTHH:mm"; the service's examples carry seconds
const withSeconds = (v) => (v && v.length === 16 ? `${v}:00` : v);

const defaultStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return toInput(d);
};

const defaultEnd = () => {
  const d = new Date();
  d.setHours(23, 59, 0, 0);
  return toInput(d);
};

const fmtTime = (iso) => {
  if (!iso) return "unknown time";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
};

const fmtBytes = (b) =>
  b < 1024 * 1024 ? `${Math.round(b / 1024)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;

/* --------------------------------------------------------------------------
 * Field wrapper - keeps the filters on one baseline.
 * ------------------------------------------------------------------------ */
const Field = ({ label, hint, children }) => {
  const t = useIntelTheme();
  return (
    <Box minW={0}>
      <Flex align="baseline" gap={2} mb={1.5}>
        <Text fontSize="10.5px" fontWeight="700" letterSpacing="0.08em" textTransform="uppercase" color={t.muted}>
          {label}
        </Text>
        {hint && (
          <Text fontSize="10.5px" color={t.muted}>
            {hint}
          </Text>
        )}
      </Flex>
      {children}
    </Box>
  );
};

const ImageSearch = () => {
  const t = useIntelTheme();
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [natural, setNatural] = useState(null); // {w,h} - needed to place bboxes
  const [dragging, setDragging] = useState(false);

  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [searched, setSearched] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  /* ---------------------------------------------------------------- file */
  const acceptFile = useCallback((f) => {
    if (!f) return;
    if (!ACCEPT.includes(f.type)) {
      setError("That file is not a PNG or JPG. Choose a .png, .jpg or .jpeg image.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(`That image is ${fmtBytes(f.size)}. Choose one under ${fmtBytes(MAX_BYTES)}.`);
      return;
    }
    setError(null);
    setData(null);
    setSearched(false);
    setNatural(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(f);
    });
    setFile(f);
  }, []);

  const clearFile = useCallback(() => {
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setFile(null);
    setNatural(null);
    setData(null);
    setSearched(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const resetAll = useCallback(() => {
    clearFile();
    setStartTime(defaultStart());
    setEndTime(defaultEnd());
  }, [clearFile]);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      acceptFile(e.dataTransfer.files?.[0]);
    },
    [acceptFile]
  );

  /* ---------------------------------------------------------- validation */
  const validation = useMemo(() => {
    if (!file) return "Select a PNG or JPG to search with.";
    if (!startTime) return "Choose a start date and time.";
    if (!endTime) return "Choose an end date and time.";
    const a = new Date(startTime).getTime();
    const b = new Date(endTime).getTime();
    if (isNaN(a) || isNaN(b)) return "The date range is not a valid date and time.";
    if (b <= a) return "The end time must be after the start time.";
    return null;
  }, [file, startTime, endTime]);

  /* -------------------------------------------------------------- search */
  const runSearch = useCallback(async () => {
    if (validation || loading) return;
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("start_time", withSeconds(startTime));
      formData.append("end_time", withSeconds(endTime));

      // No Content-Type header - the browser must set the multipart boundary.
      const response = await fetch(API_URL, { method: "POST", body: formData });

      if (!response.ok) {
        // the service reports failures as { detail: ... }
        let detail = `The search service returned HTTP ${response.status}.`;
        try {
          const body = await response.json();
          if (body?.detail) {
            detail =
              typeof body.detail === "string"
                ? body.detail
                : // 422 returns an array of validation objects
                  body.detail.map((d) => d?.msg).filter(Boolean).join("; ") || detail;
          }
        } catch {
          /* body was not JSON - keep the status message */
        }
        throw new Error(detail);
      }

      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error("The search service returned a response that was not valid JSON.");
      }
      if (!result || typeof result !== "object" || !Array.isArray(result.results)) {
        throw new Error("The search service returned an unexpected response.");
      }

      setData(result);
      setSearched(true);
    } catch (err) {
      // fetch rejects with a TypeError for DNS/refused/CORS-blocked requests -
      // the browser will not say which, so name both honestly.
      if (err instanceof TypeError) {
        setError(
          `Could not reach the search service at ${API_ORIGIN}. Either it is unreachable from this machine, ` +
            `or it is refusing this page's origin (${window.location.origin}). If it is CORS, the service itself ` +
            `must send an Access-Control-Allow-Origin header for that origin - it cannot be fixed from the browser.`
        );
      } else {
        setError(err.message || "The search failed.");
      }
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [validation, loading, file, startTime, endTime]);

  /* ------------------------------------------------------------- derived */
  const faces = useMemo(() => data?.results || [], [data]);
  const totalMatches = useMemo(
    () => faces.reduce((n, f) => n + (f.matches?.length || 0), 0),
    [faces]
  );
  const totalImages = useMemo(
    () => faces.reduce((n, f) => n + (f.matches || []).reduce((m, mt) => m + (mt.images?.length || 0), 0), 0),
    [faces]
  );

  const inputStyle = {
    size: "sm",
    borderRadius: "8px",
    borderColor: t.border,
    bg: t.panel,
    fontSize: "13px",
    _hover: { borderColor: t.borderStrong },
    _focusVisible: { borderColor: t.s1, boxShadow: `0 0 0 1px ${t.s1}` },
  };

  return (
    <Box bg={t.page} minH="100vh" pt={{ base: "70px", md: 4 }} pb={{ base: "100px", md: 8 }} px={{ base: 3, md: 6 }}>
      {/* masthead */}
      <Box
        bg={t.panel}
        border="1px solid"
        borderColor={t.border}
        borderRadius="14px"
        boxShadow={t.shadow}
        px={{ base: 4, md: 6 }}
        py={{ base: 4, md: 5 }}
        mb={5}
        position="relative"
        overflow="hidden"
      >
        <Box position="absolute" top={0} left={0} right={0} h="3px" bgGradient={`linear(to-r, ${t.s1}, ${t.s3}, ${t.s4})`} />
        <Flex align="center" gap={3.5} wrap="wrap">
          <Flex
            align="center"
            justify="center"
            boxSize="38px"
            borderRadius="10px"
            bg={`${t.s1}1A`}
            color={t.s1}
            fontSize="19px"
            flexShrink={0}
          >
            <MdImageSearch />
          </Flex>
          <Box minW={0}>
            <Text
              fontSize={{ base: "20px", md: "23px" }}
              fontWeight="800"
              color={t.heading}
              letterSpacing="-0.025em"
              lineHeight="1.15"
            >
              Find Related Images
            </Text>
            <Text fontSize="12.5px" color={t.body} mt={0.5}>
              Upload a photograph &mdash; every stored image of the same face is returned, with where and when it was
              taken.
            </Text>
          </Box>
          {(file || data) && (
            <Button
              ml="auto"
              size="sm"
              variant="outline"
              borderColor={t.border}
              color={t.body}
              borderRadius="9px"
              fontWeight="600"
              fontSize="12px"
              leftIcon={<FaRedo />}
              onClick={resetAll}
              flexShrink={0}
              _hover={{ borderColor: t.s1, color: t.s1 }}
            >
              Reset search
            </Button>
          )}
        </Flex>
      </Box>

      {/* upload + filters */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4} alignItems="stretch">
        <Panel title="Reference image" sub="PNG or JPG" fill>
          {!preview ? (
            <Flex
              direction="column"
              align="center"
              justify="center"
              flex="1"
              minH="260px"
              gap={3}
              px={5}
              py={8}
              textAlign="center"
              borderRadius="11px"
              border="1.5px dashed"
              borderColor={dragging ? t.s1 : t.borderStrong}
              bg={dragging ? `${t.s1}0F` : t.panelAlt}
              transition="border-color .18s ease, background .18s ease"
              cursor="pointer"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <Flex
                align="center"
                justify="center"
                boxSize="46px"
                borderRadius="12px"
                bg={`${t.s1}1A`}
                color={t.s1}
                fontSize="18px"
              >
                <FaUpload />
              </Flex>
              <Box>
                <Text fontSize="14px" fontWeight="700" color={t.heading}>
                  {dragging ? "Drop to use this image" : "Drag an image here"}
                </Text>
                <Text fontSize="12px" color={t.muted} mt={1}>
                  PNG, JPG or JPEG &middot; up to {fmtBytes(MAX_BYTES)}
                </Text>
              </Box>
              <Button
                size="sm"
                colorScheme="blue"
                borderRadius="8px"
                fontSize="12.5px"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                Choose Image
              </Button>
            </Flex>
          ) : (
            <Flex direction="column" flex="1" minH={0} gap={3}>
              <Box
                position="relative"
                borderRadius="11px"
                overflow="hidden"
                bg={t.panelAlt}
                border="1px solid"
                borderColor={t.border}
                flex="1"
                minH="220px"
              >
                <Image
                  src={preview}
                  alt="Selected reference"
                  w="100%"
                  h="100%"
                  maxH="360px"
                  objectFit="contain"
                  display="block"
                  onLoad={(e) => setNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
                />
                {/* detected faces, drawn over the preview once the service replies */}
                {natural &&
                  faces.map((f, i) => {
                    const b = f.bbox;
                    if (!Array.isArray(b) || b.length < 4) return null;
                    const [x1, y1, x2, y2] = b;
                    const colour = f.skip_reason ? t.critical : f.matches?.length ? t.s1 : t.s4;
                    return (
                      <Box
                        key={i}
                        position="absolute"
                        left={`${(x1 / natural.w) * 100}%`}
                        top={`${(y1 / natural.h) * 100}%`}
                        w={`${((x2 - x1) / natural.w) * 100}%`}
                        h={`${((y2 - y1) / natural.h) * 100}%`}
                        border="2px solid"
                        borderColor={colour}
                        borderRadius="3px"
                        pointerEvents="none"
                      >
                        <Text
                          position="absolute"
                          top="-17px"
                          left="-2px"
                          px={1.5}
                          fontSize="10px"
                          fontWeight="700"
                          color="#fff"
                          bg={colour}
                          borderRadius="3px"
                          whiteSpace="nowrap"
                        >
                          Face {i + 1}
                        </Text>
                      </Box>
                    );
                  })}
              </Box>
              <Flex align="center" gap={3} wrap="wrap">
                <Box minW={0} flex="1">
                  <Text fontSize="12.5px" fontWeight="600" color={t.heading} noOfLines={1} title={file?.name}>
                    {file?.name}
                  </Text>
                  <Text fontSize="11px" color={t.muted} fontFamily={MONO_FONT} mt={0.5}>
                    {file ? fmtBytes(file.size) : ""}
                    {natural ? ` · ${natural.w}×${natural.h}` : ""}
                  </Text>
                </Box>
                <Button
                  size="xs"
                  variant="outline"
                  borderRadius="7px"
                  borderColor={t.border}
                  color={t.body}
                  fontSize="11.5px"
                  onClick={() => inputRef.current?.click()}
                  _hover={{ borderColor: t.s1, color: t.s1 }}
                >
                  Replace
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  borderRadius="7px"
                  borderColor={t.border}
                  color={t.body}
                  fontSize="11.5px"
                  leftIcon={<FaTimes />}
                  onClick={clearFile}
                  _hover={{ borderColor: t.critical, color: t.critical }}
                >
                  Remove
                </Button>
              </Flex>
            </Flex>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,image/png,image/jpeg"
            style={{ display: "none" }}
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />
        </Panel>

        <Panel title="Search window" sub="sent with the image" fill>
          <Flex direction="column" flex="1" minH={0} gap={4}>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
              <Field label="Start">
                <Input {...inputStyle} type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </Field>
              <Field label="End">
                <Input
                  {...inputStyle}
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  isInvalid={Boolean(startTime && endTime && new Date(endTime) <= new Date(startTime))}
                />
              </Field>
            </SimpleGrid>

            <Box flex="1" minH={0} />

            {validation && (file || searched) && (
              <Flex align="center" gap={2} color={t.warning} fontSize="12px">
                <FaExclamationTriangle />
                <Text>{validation}</Text>
              </Flex>
            )}

            <Flex gap={2.5} wrap="wrap">
              <Button
                colorScheme="blue"
                borderRadius="9px"
                fontSize="13px"
                fontWeight="700"
                leftIcon={loading ? undefined : <FaSearch />}
                onClick={runSearch}
                isDisabled={Boolean(validation) || loading}
                isLoading={loading}
                loadingText="Searching..."
                flex={{ base: "1", sm: "0 0 auto" }}
              >
                Find Related Images
              </Button>
              {(file || data) && (
                <Button
                  variant="outline"
                  borderRadius="9px"
                  borderColor={t.border}
                  color={t.body}
                  fontSize="13px"
                  fontWeight="600"
                  onClick={resetAll}
                  isDisabled={loading}
                  _hover={{ borderColor: t.s1, color: t.s1 }}
                >
                  Upload another image
                </Button>
              )}
            </Flex>
            <Text fontSize="10.5px" color={t.muted} fontFamily={MONO_FONT}>
              POST {API_URL}
            </Text>
          </Flex>
        </Panel>
      </SimpleGrid>

      {/* loading */}
      {loading && (
        <Panel mt={4}>
          <Flex align="center" gap={3}>
            <Spinner size="sm" color={t.s1} />
            <Text fontSize="13px" color={t.body}>
              Searching for related images&hellip;
            </Text>
          </Flex>
        </Panel>
      )}

      {/* error */}
      {error && !loading && (
        <Flex
          mt={4}
          gap={3.5}
          bg={t.panel}
          border="1px solid"
          borderColor={t.border}
          borderLeft="3px solid"
          borderLeftColor={t.critical}
          borderRadius="10px"
          boxShadow={t.shadow}
          px={4}
          py={3.5}
        >
          <Box color={t.critical} fontSize="14px" mt="1px">
            <FaExclamationTriangle />
          </Box>
          <Box minW={0} flex="1">
            <Text fontSize="13px" fontWeight="700" color={t.heading} mb={0.5}>
              The search could not be completed
            </Text>
            <Text fontSize="12.5px" color={t.body}>
              {error}
            </Text>
            {file && !validation && (
              <Button
                mt={2.5}
                size="xs"
                variant="outline"
                borderRadius="7px"
                borderColor={t.border}
                color={t.body}
                fontSize="11.5px"
                onClick={runSearch}
                _hover={{ borderColor: t.s1, color: t.s1 }}
              >
                Try again
              </Button>
            )}
          </Box>
        </Flex>
      )}

      {/* results */}
      {data && !loading && !error && (
        <>
          <SectionLabel
            note={
              data.faces_found
                ? `${totalMatches} identity match${totalMatches === 1 ? "" : "es"} · ${totalImages} image${
                    totalImages === 1 ? "" : "s"
                  }`
                : undefined
            }
          >
            {data.faces_found
              ? `${data.faces_found} face${data.faces_found === 1 ? "" : "s"} found in the uploaded image`
              : "Result"}
          </SectionLabel>

          {/* no face detected at all */}
          {!data.faces_found && (
            <Panel>
              <Flex direction="column" align="center" textAlign="center" py={8} gap={3}>
                <Flex
                  align="center"
                  justify="center"
                  boxSize="46px"
                  borderRadius="12px"
                  bg={`${t.s4}1A`}
                  color={t.s4}
                  fontSize="18px"
                >
                  <MdImageSearch />
                </Flex>
                <Box>
                  <Text fontSize="15px" fontWeight="700" color={t.heading}>
                    No related images found.
                  </Text>
                  <Text fontSize="12.5px" color={t.body} mt={1} maxW="440px">
                    No face could be detected in this image, so there was nothing to match against. A clear,
                    front-facing photograph works best.
                  </Text>
                </Box>
                <Flex gap={2.5} wrap="wrap" justify="center">
                  <Button
                    size="sm"
                    colorScheme="blue"
                    borderRadius="8px"
                    fontSize="12.5px"
                    onClick={() => inputRef.current?.click()}
                  >
                    Upload another image
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    borderRadius="8px"
                    borderColor={t.border}
                    color={t.body}
                    fontSize="12.5px"
                    onClick={runSearch}
                    _hover={{ borderColor: t.s1, color: t.s1 }}
                  >
                    Search again
                  </Button>
                </Flex>
              </Flex>
            </Panel>
          )}

          {/* one block per detected face */}
          <Flex direction="column" gap={4}>
            {faces.map((face, i) => {
              const matches = face.matches || [];
              const det = Number.isFinite(face.det_score) ? face.det_score.toFixed(2) : null;
              return (
                <Panel
                  key={i}
                  accent={face.skip_reason ? t.critical : matches.length ? t.s1 : t.s4}
                  title={`Face ${i + 1}`}
                  sub={[det ? `detection ${det}` : null, `${matches.length} identity match${matches.length === 1 ? "" : "es"}`]
                    .filter(Boolean)
                    .join(" · ")}
                >
                  {face.skip_reason ? (
                    <Flex align="center" gap={2} color={t.critical} fontSize="12.5px">
                      <FaExclamationTriangle />
                      <Text>{face.skip_reason}</Text>
                    </Flex>
                  ) : matches.length === 0 ? (
                    <Flex direction="column" align="center" textAlign="center" py={6} gap={2}>
                      <Text fontSize="13.5px" fontWeight="700" color={t.heading}>
                        No related images found.
                      </Text>
                      <Text fontSize="12px" color={t.muted} maxW="420px">
                        This face was detected clearly, but no matching identity exists in the database for the
                        selected time window.
                      </Text>
                      <Button
                        mt={1}
                        size="sm"
                        variant="outline"
                        borderRadius="8px"
                        borderColor={t.border}
                        color={t.body}
                        fontSize="12.5px"
                        onClick={resetAll}
                        _hover={{ borderColor: t.s1, color: t.s1 }}
                      >
                        Upload another image
                      </Button>
                    </Flex>
                  ) : (
                    <Flex direction="column" gap={4}>
                      {matches.map((m, j) => {
                        const images = m.images || [];
                        const pct = Number.isFinite(m.similarity) ? (m.similarity * 100).toFixed(1) : null;
                        const strong = Number.isFinite(m.similarity) && m.similarity >= 0.5;
                        return (
                          <Box
                            key={j}
                            border="1px solid"
                            borderColor={t.border}
                            borderRadius="11px"
                            overflow="hidden"
                            bg={t.panelAlt}
                          >
                            <Flex
                              align="center"
                              gap={2.5}
                              px={4}
                              py={2.5}
                              bg={t.panel}
                              borderBottom="1px solid"
                              borderColor={t.border}
                              wrap="wrap"
                            >
                              <Box color={strong ? t.s3 : t.s4} fontSize="13px">
                                <FaUserCheck />
                              </Box>
                              <Text fontSize="13.5px" fontWeight="700" color={t.heading} minW={0} noOfLines={1}>
                                {m.person_name}
                              </Text>
                              {pct && (
                                <Badge
                                  ml="auto"
                                  borderRadius="full"
                                  px={2.5}
                                  py={0.5}
                                  fontSize="11px"
                                  textTransform="none"
                                  bg={strong ? `${t.s3}1F` : `${t.s4}1F`}
                                  color={strong ? t.s3 : t.s4}
                                  fontFamily={MONO_FONT}
                                >
                                  {pct}% similarity
                                </Badge>
                              )}
                              <Text fontSize="11px" color={t.muted} flexShrink={0}>
                                {images.length} image{images.length === 1 ? "" : "s"}
                              </Text>
                            </Flex>

                            {images.length === 0 ? (
                              <Text fontSize="12px" color={t.muted} px={4} py={4}>
                                No stored images for this identity.
                              </Text>
                            ) : (
                              <SimpleGrid columns={{ base: 2, sm: 3, md: 4, xl: 6 }} spacing={3} p={4}>
                                {images.map((img, k) => {
                                  const url = resolveUrl(img.url);
                                  return (
                                    <Box
                                      key={k}
                                      as="button"
                                      textAlign="left"
                                      borderRadius="9px"
                                      overflow="hidden"
                                      border="1px solid"
                                      borderColor={t.border}
                                      bg={t.panel}
                                      transition="transform .16s ease, border-color .16s ease"
                                      _hover={{ transform: "translateY(-2px)", borderColor: t.s1 }}
                                      onClick={() =>
                                        setLightbox({
                                          url,
                                          caption: `${m.person_name}${img.location ? ` — ${img.location}` : ""} — ${fmtTime(
                                            img.timestamp
                                          )}`,
                                        })
                                      }
                                    >
                                      <Box position="relative" bg={t.track} h="112px">
                                        <Image
                                          src={url}
                                          alt={m.person_name}
                                          w="100%"
                                          h="112px"
                                          objectFit="cover"
                                          loading="lazy"
                                          fallback={
                                            <Flex
                                              h="112px"
                                              align="center"
                                              justify="center"
                                              fontSize="10.5px"
                                              color={t.muted}
                                              px={2}
                                              textAlign="center"
                                            >
                                              Image unavailable
                                            </Flex>
                                          }
                                        />
                                      </Box>
                                      <Box px={2.5} py={2}>
                                        {img.location && (
                                          <Text fontSize="11px" fontWeight="600" color={t.heading} noOfLines={1}>
                                            {img.location}
                                          </Text>
                                        )}
                                        <Text fontSize="10.5px" color={t.muted} fontFamily={MONO_FONT} noOfLines={1}>
                                          {fmtTime(img.timestamp)}
                                        </Text>
                                      </Box>
                                    </Box>
                                  );
                                })}
                              </SimpleGrid>
                            )}
                          </Box>
                        );
                      })}
                    </Flex>
                  )}
                </Panel>
              );
            })}
          </Flex>
        </>
      )}

      {/* full-size image */}
      <Modal isOpen={Boolean(lightbox)} onClose={() => setLightbox(null)} isCentered size="full">
        <ModalOverlay bg="blackAlpha.900" />
        <ModalContent bg="transparent" boxShadow="none" m={0}>
          <ModalCloseButton color="white" zIndex={2} />
          <ModalBody
            p={0}
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            onClick={() => setLightbox(null)}
          >
            {lightbox && (
              <>
                <Image
                  src={lightbox.url}
                  alt={lightbox.caption}
                  maxH="86vh"
                  maxW="94vw"
                  objectFit="contain"
                  onClick={(e) => e.stopPropagation()}
                />
                <Text mt={3} fontSize="12.5px" color="whiteAlpha.900" fontFamily={MONO_FONT}>
                  {lightbox.caption}
                </Text>
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default ImageSearch;
