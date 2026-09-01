import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import moment from "moment";
import { FaMapMarkedAlt, FaSearch, FaExpand, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import {
  Box,
  Flex,
  Text,
  Input,
  Button,
  ButtonGroup,
  Badge,
  Image,
  Spinner,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";
import { Panel, StatTile, SectionLabel, useIntelTheme, MONO_FONT } from "../components/intel/IntelKit";
import GujaratMap from "../components/intel/GujaratMap";

const fmt = (value) => (value ? moment.utc(value).format("DD-MM-YYYY HH:mm:ss") : "—");
const fmtShort = (value) => (value ? moment.utc(value).format("DD MMM HH:mm") : "—");

const MovementMap = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [mode, setMode] = useState("phrase"); // phrase | plate
  const [term, setTerm] = useState("");
  const [active, setActive] = useState(null); // highlighted sighting id
  const [lightbox, setLightbox] = useState(null);

  const t = useIntelTheme();
  const baseUrl = process.env.REACT_APP_BASE_URL || process.env.REACT_APP_URL;

  const load = useCallback(
    async (searchTerm, searchMode) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ limit: 120 });
        const q = (searchTerm ?? "").trim();
        if (q) params.set(searchMode === "plate" ? "plate" : "q", q);

        const { data: body } = await axios.get(`${baseUrl}/api/ai-alerts/intel/trace?${params.toString()}`);
        if (!body?.success) throw new Error(body?.message || "Request failed");
        setData(body);
        setActive(null);
      } catch (err) {
        setError(err.response?.data?.message || err.message || "Could not load the map.");
      } finally {
        setLoading(false);
      }
    },
    [baseUrl]
  );

  useEffect(() => {
    load("", "phrase");
  }, [load]);

  const sites = data?.sites || [];
  const sightings = data?.sightings || [];

  const activeSighting = sightings.find((s) => s.id === active) || null;

  const runSearch = () => load(term, mode);

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
        <Box position="absolute" top={0} left={0} right={0} h="3px" bgGradient={`linear(to-r, ${t.s3}, ${t.s1}, ${t.s2})`} />
        <Flex align="center" gap={3.5} wrap="wrap">
          <Flex align="center" justify="center" boxSize="38px" borderRadius="10px" bg={`${t.s1}1A`} color={t.s1} fontSize="17px" flexShrink={0}>
            <FaMapMarkedAlt />
          </Flex>
          <Box minW={0}>
            <Text fontSize={{ base: "20px", md: "23px" }} fontWeight="800" color={t.heading} letterSpacing="-0.025em" lineHeight="1.15">
              Movement Map
            </Text>
            <Text fontSize="12.5px" color={t.body} mt={0.5}>
              Where a subject was seen and when &mdash; across {sites.length} camera sites in Gujarat.
            </Text>
          </Box>
        </Flex>

        {/* search */}
        <Flex gap={2} mt={4} wrap="wrap" align="center">
          <ButtonGroup size="sm" isAttached variant="outline">
            {[
              ["phrase", "Description"],
              ["plate", "Plate"],
            ].map(([k, label]) => (
              <Button
                key={k}
                borderColor={t.border}
                fontWeight="600"
                fontSize="12px"
                bg={mode === k ? t.panelAlt : "transparent"}
                color={mode === k ? t.heading : t.muted}
                onClick={() => setMode(k)}
              >
                {label}
              </Button>
            ))}
          </ButtonGroup>
          <Input
            size="sm"
            maxW="340px"
            borderRadius="8px"
            borderColor={t.border}
            placeholder={mode === "plate" ? "e.g. GJ01RX7016" : "e.g. white bus, GSRTC, ambulance"}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
            }}
          />
          <Button size="sm" colorScheme="blue" borderRadius="8px" leftIcon={<FaSearch />} onClick={runSearch} isLoading={loading}>
            Trace
          </Button>
          {data?.term && (
            <Button size="sm" variant="ghost" borderRadius="8px" onClick={() => { setTerm(""); load("", mode); }}>
              Clear
            </Button>
          )}
        </Flex>
      </Box>

      {error && (
        <Panel mb={4}>
          <Text fontSize="13px" color={t.critical}>{error}</Text>
        </Panel>
      )}

      {data?.term && (
        <Flex gap={3.5} mb={5} wrap="wrap" sx={{ "& > *": { flex: "1 1 180px" } }}>
          <StatTile label="Sightings" value={sightings.length} note={data.truncated ? "capped at 120" : "in time order"} />
          <StatTile label="Sites visited" value={data.visited?.length || 0} note={`of ${sites.length} cameras`} color={t.s1} />
          <StatTile label="Hops" value={data.legs?.length || 0} note="site-to-site moves" color={t.s2} />
          <StatTile
            label="First seen"
            value={sightings.length ? fmtShort(sightings[0].start_time || sightings[0].timestamp) : "—"}
            note={sightings.length ? sightings[0].label : ""}
          />
        </Flex>
      )}

      {/* map + timeline */}
      <Flex gap={4} direction={{ base: "column", xl: "row" }} align="stretch">
        <Panel
          title="Gujarat"
          sub={data?.term ? `${data.mode === "plate" ? "plate" : "phrase"} · ${data.term}` : "all camera sites"}
          accent={t.s1}
          flex={{ base: "1", xl: "1 1 62%" }}
          minW={0}
        >
          <GujaratMap
            sites={sites}
            sightings={sightings}
            onSelect={setActive}
            height={data?.term ? "560px" : "620px"}
          />

          <Flex gap={4} mt={3} wrap="wrap" align="center">
            <Flex align="center" gap={1.5}>
              <Box boxSize="9px" borderRadius="full" bg="white" border="2px solid" borderColor={t.s1} />
              <Text fontSize="11px" color={t.body}>camera site (size = volume)</Text>
            </Flex>
            <Flex align="center" gap={1.5}>
              <Box boxSize="9px" borderRadius="full" bg={t.s2} />
              <Text fontSize="11px" color={t.body}>seen here</Text>
            </Flex>
            <Text fontSize="11px" color={t.muted}>
              five sites share one city-centre coordinate and are nudged apart
            </Text>
          </Flex>
        </Panel>

        {/* timeline */}
        <Panel
          title="Sightings"
          sub={sightings.length ? `${sightings.length} in time order` : "search to trace"}
          accent={t.s2}
          flex={{ base: "1", xl: "1 1 38%" }}
          minW={0}
        >
          {loading ? (
            <Flex justify="center" py={10}><Spinner color={t.s1} /></Flex>
          ) : !data?.term ? (
            <Text fontSize="12.5px" color={t.muted}>
              Search a description phrase (&ldquo;white bus&rdquo;, &ldquo;GSRTC&rdquo;) or a plate to draw its route
              across the estate.
            </Text>
          ) : sightings.length === 0 ? (
            <Text fontSize="12.5px" color={t.muted}>Nothing matched that search.</Text>
          ) : (
            <Flex direction="column" maxH="640px" overflowY="auto" pr={1}>
              {sightings.map((s, i) => {
                const isActive = s.id === active;
                return (
                  <Flex
                    key={s.id}
                    gap={3}
                    py={2.5}
                    borderTop={i ? "1px solid" : "none"}
                    borderColor={t.border}
                    align="flex-start"
                    bg={isActive ? t.panelAlt : "transparent"}
                    borderRadius="6px"
                    px={1}
                    cursor="pointer"
                    onClick={() => setActive(isActive ? null : s.id)}
                    role="group"
                  >
                    <Text
                      fontFamily={MONO_FONT}
                      fontSize="10px"
                      fontWeight="700"
                      color={t.muted}
                      minW="18px"
                      pt="3px"
                    >
                      {i + 1}
                    </Text>

                    {s.frame && (
                      <Box position="relative" flexShrink={0}>
                        <Image
                          src={s.frame}
                          alt={s.label}
                          w="86px"
                          h="50px"
                          objectFit="cover"
                          borderRadius="5px"
                          bg="black"
                          fallbackSrc="https://via.placeholder.com/86x50?text=—"
                        />
                        <IconButton
                          icon={<FaExpand />}
                          aria-label={`Open ${s.label} frames full screen`}
                          size="xs"
                          position="absolute"
                          top="3px"
                          right="3px"
                          minW="18px"
                          h="18px"
                          bg="blackAlpha.700"
                          color="white"
                          borderRadius="4px"
                          opacity={0}
                          _groupHover={{ opacity: 1 }}
                          _focusVisible={{ opacity: 1 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightbox({ frames: s.frames?.length ? s.frames : [s.frame], index: 0 });
                          }}
                        />
                      </Box>
                    )}

                    <Box minW={0} flex="1">
                      <Flex gap={2} align="center" wrap="wrap">
                        <Text fontSize="12px" fontWeight="600" color={t.heading}>{s.label}</Text>
                        {s.ocr_raw && (
                          <Badge colorScheme="blue" fontSize="9px" borderRadius="full" px={2} textTransform="none">
                            {s.ocr_raw}
                          </Badge>
                        )}
                      </Flex>
                      <Text fontFamily={MONO_FONT} fontSize="10.5px" color={t.muted}>
                        {fmt(s.start_time || s.timestamp)}
                      </Text>
                      <Text fontSize="11.5px" color={t.body} mt={1} noOfLines={isActive ? undefined : 2}>
                        {s.excerpt}
                      </Text>
                      {isActive && s.source_video && (
                        <Text fontFamily={MONO_FONT} fontSize="10px" color={t.muted} mt={1}>
                          {s.source_video} @ {s.video_offset_seconds ?? "—"}s
                        </Text>
                      )}
                    </Box>
                  </Flex>
                );
              })}
            </Flex>
          )}
        </Panel>
      </Flex>

      {/* hops */}
      {data?.legs?.length > 0 && (
        <>
          <SectionLabel note="consecutive moves between sites">Route</SectionLabel>
          <Panel accent={t.s3}>
            <Flex gap={2} wrap="wrap">
              {data.legs.slice(0, 24).map((leg, i) => (
                <Flex
                  key={i}
                  align="center"
                  gap={2}
                  bg={t.panelAlt}
                  border="1px solid"
                  borderColor={t.border}
                  borderRadius="7px"
                  px={2.5}
                  py={1.5}
                >
                  <Text fontSize="11px" color={t.body}>{leg.from}</Text>
                  <Box color={t.s2} fontSize="9px"><FaChevronRight /></Box>
                  <Text fontSize="11px" color={t.heading} fontWeight="600">{leg.to}</Text>
                  {leg.minutes != null && (
                    <Text fontFamily={MONO_FONT} fontSize="10px" color={t.muted}>
                      {leg.minutes >= 1440
                        ? `${Math.round(leg.minutes / 1440)}d`
                        : leg.minutes >= 60
                        ? `${Math.round(leg.minutes / 60)}h`
                        : `${leg.minutes}m`}
                    </Text>
                  )}
                </Flex>
              ))}
            </Flex>
            {activeSighting && (
              <Text fontSize="11.5px" color={t.muted} mt={3}>
                Selected: {activeSighting.label} &middot; {fmt(activeSighting.start_time || activeSighting.timestamp)}
              </Text>
            )}
          </Panel>
        </>
      )}

      {/* full-screen frame viewer */}
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
                  {lightbox.index + 1} / {lightbox.frames.length}
                </Text>
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
};

export default MovementMap;
