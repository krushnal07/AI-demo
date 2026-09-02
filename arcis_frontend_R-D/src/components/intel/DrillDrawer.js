// src/components/intel/DrillDrawer.js
// Every headline figure resolves back to the documents behind it. A row opens
// to the complete record - all frames, the full description, and the fields
// that make a segment citable - so a count is never the last word.
import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerHeader,
  DrawerBody,
  Box,
  Flex,
  Text,
  Image,
  Badge,
  Button,
  Spinner,
  SimpleGrid,
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";
import { FaChevronDown, FaChevronRight, FaExpand, FaChevronLeft, FaChevronRight as FaNext } from "react-icons/fa";
import { useIntelTheme, MONO_FONT } from "./IntelKit";

const PAGE = 25;

/* Chip colour by enforcement weight, matching the register page. */
const SEVERITY_SCHEME = { critical: "red", high: "orange", medium: "yellow", watch: "blue" };

const fmtTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d) ? "" : d.toISOString().replace("T", " ").slice(0, 19);
};

const fmtOffset = (seconds) => {
  if (seconds == null) return "—";
  const s = Math.max(0, Math.floor(seconds));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
};

/** Full description with the matched term marked, so the reader can judge it. */
const Described = ({ text, match, theme }) => {
  if (!match) {
    return (
      <Text fontSize="12.5px" color={theme.body} whiteSpace="pre-wrap">
        {text}
      </Text>
    );
  }
  const lower = text.toLowerCase();
  const needle = match.toLowerCase();
  const parts = [];
  let from = 0;
  let at = lower.indexOf(needle);
  let key = 0;
  while (at !== -1) {
    if (at > from) parts.push(<React.Fragment key={key++}>{text.slice(from, at)}</React.Fragment>);
    parts.push(
      <Box as="mark" key={key++} bg={theme.panelAlt} color={theme.heading} fontWeight="700" px="2px" borderRadius="2px">
        {text.slice(at, at + needle.length)}
      </Box>
    );
    from = at + needle.length;
    at = lower.indexOf(needle, from);
  }
  parts.push(<React.Fragment key={key++}>{text.slice(from)}</React.Fragment>);
  return (
    <Text fontSize="12.5px" color={theme.body} whiteSpace="pre-wrap">
      {parts}
    </Text>
  );
};

const Field = ({ label, value, theme }) => (
  <Box>
    <Text fontSize="9.5px" letterSpacing="0.06em" textTransform="uppercase" color={theme.muted}>
      {label}
    </Text>
    <Text fontSize="11.5px" color={theme.body} fontFamily={MONO_FONT} wordBreak="break-word">
      {value == null || value === "" ? "—" : String(value)}
    </Text>
  </Box>
);

/** A frame with a hover-revealed expand control. */
const Framed = ({ src, alt, label, theme, onExpand, ...rest }) => (
  <Box position="relative" role="group" flexShrink={0}>
    <Image
      src={src}
      alt={alt}
      borderRadius="6px"
      bg="black"
      cursor="zoom-in"
      onClick={(e) => {
        e.stopPropagation();
        onExpand();
      }}
      fallbackSrc="https://via.placeholder.com/240x150?text=Frame+unavailable"
      {...rest}
    />
    {label && (
      <Badge
        position="absolute"
        top="6px"
        left="6px"
        bg="blackAlpha.700"
        color="white"
        fontSize="9px"
        borderRadius="full"
        px={2}
        textTransform="none"
        pointerEvents="none"
      >
        {label}
      </Badge>
    )}
    <IconButton
      icon={<FaExpand />}
      aria-label={`Open ${alt} full screen`}
      size="xs"
      position="absolute"
      top="6px"
      right="6px"
      bg="blackAlpha.700"
      color="white"
      borderRadius="6px"
      opacity={0}
      _groupHover={{ opacity: 1 }}
      _focusVisible={{ opacity: 1, outline: "2px solid", outlineColor: theme.s1 }}
      _hover={{ bg: "blackAlpha.900" }}
      onClick={(e) => {
        e.stopPropagation();
        onExpand();
      }}
    />
  </Box>
);

const DrillDrawer = ({ drill, onClose, baseUrl }) => {
  const [body, setBody] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [state, setState] = useState(null); // null | observed | negated
  const [openId, setOpenId] = useState(null);
  // { frames, index } while a frame is open full screen
  const [lightbox, setLightbox] = useState(null);
  const [error, setError] = useState(null);

  const t = useIntelTheme();
  const isOpen = Boolean(drill);

  useEffect(() => {
    setPage(1);
    setState(drill?.state || null);
    setBody(null);
    setOpenId(null);
    setLightbox(null);
  }, [drill]);

  const fetchPage = useCallback(async () => {
    if (!drill) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ facet: drill.facet, page, limit: PAGE });
      if (drill.value) params.set("value", drill.value);
      if (state) params.set("state", state);
      const { data } = await axios.get(`${baseUrl}/api/ai-alerts/intel/drill?${params.toString()}`);
      if (!data?.success) throw new Error(data?.message || "Request failed");
      setBody(data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Could not load records.");
    } finally {
      setLoading(false);
    }
  }, [drill, page, state, baseUrl]);

  useEffect(() => {
    if (isOpen) fetchPage();
  }, [isOpen, fetchPage]);

  const total = body?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE));
  // the classifier only returns affirmative matches, so there is no split to offer

  return (
    <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="xl">
      <DrawerOverlay bg="blackAlpha.600" />
      <DrawerContent bg={t.panel}>
        <DrawerCloseButton />
        <DrawerHeader borderBottom="1px solid" borderColor={t.border} pb={3}>
          <Text fontSize="15px" fontWeight="700" color={t.heading}>
            {drill?.title || "Records"}
          </Text>
          <Flex gap={2} align="center" mt={1} wrap="wrap">
            <Text fontSize="11.5px" color={t.muted} fontWeight="400">
              {loading && !body ? "loading…" : `${total.toLocaleString()} record${total === 1 ? "" : "s"}`}
              {body?.observed != null && state === null ? ` · ${body.observed} observed` : ""}
            </Text>
          </Flex>
        </DrawerHeader>

        <DrawerBody px={4} py={3}>
          {error && (
            <Text fontSize="13px" color={t.critical}>
              {error}
            </Text>
          )}

          {loading && (
            <Flex justify="center" py={8}>
              <Spinner color={t.s1} />
            </Flex>
          )}

          {!loading && body && body.items.length === 0 && (
            <Text fontSize="13px" color={t.muted} py={6} textAlign="center">
              No records for this selection.
            </Text>
          )}

          {!loading &&
            body?.items.map((it) => {
              const open = openId === it.id;
              return (
                <Box key={it.id} borderTop="1px solid" borderColor={t.border} _first={{ borderTop: "none" }}>
                  {/* ---- collapsed row ---- */}
                  <Flex
                    gap={3}
                    py={3}
                    align="flex-start"
                    cursor="pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenId(open ? null : it.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setOpenId(open ? null : it.id);
                      }
                    }}
                    _hover={{ bg: t.panelAlt }}
                    _focusVisible={{ outline: "2px solid", outlineColor: t.s1, outlineOffset: "-2px" }}
                    borderRadius="6px"
                    px={1}
                  >
                    <Box color={t.muted} fontSize="10px" pt="5px" flexShrink={0}>
                      {open ? <FaChevronDown /> : <FaChevronRight />}
                    </Box>
                    {it.frame && (
                      <Framed
                        src={it.frame}
                        alt={`${it.camera_id} segment ${it.segment_id}`}
                        theme={t}
                        w="92px"
                        h="52px"
                        objectFit="cover"
                        onExpand={() => setLightbox({ frames: it.frames?.length ? it.frames : [it.frame], index: 0 })}
                      />
                    )}
                    <Box minW={0} flex="1">
                      <Flex gap={2} align="center" wrap="wrap" mb={1}>
                        <Text fontFamily={MONO_FONT} fontSize="10.5px" color={t.muted}>
                          {it.location || it.camera_id}
                        </Text>
                        <Text fontFamily={MONO_FONT} fontSize="10.5px" color={t.muted}>
                          {fmtTime(it.start_time || it.timestamp)}
                        </Text>
                        {(it.offences || []).map((o) => (
                          <Badge
                            key={o.key}
                            colorScheme={SEVERITY_SCHEME[o.severity] || "gray"}
                            fontSize="9px"
                            borderRadius="full"
                            px={2}
                            textTransform="none"
                          >
                            {o.label}
                          </Badge>
                        ))}
                      </Flex>
                      <Text fontSize="12px" color={t.body} noOfLines={open ? undefined : 2}>
                        {it.truncatedStart ? "…" : ""}
                        {it.snippet}…
                      </Text>
                    </Box>
                  </Flex>

                  {/* ---- expanded: the complete record ---- */}
                  {open && (
                    <Box pb={4} pl={1} pr={1}>
                      {it.frames?.length > 0 && (
                        <Flex gap={2} mb={3} wrap="wrap">
                          {it.frames.map((url, i) => (
                            <Framed
                              key={url}
                              src={url}
                              alt={`frame ${i + 1}`}
                              label={i === it.frames.length - 1 && it.frames.length > 1 ? "contact sheet" : `frame ${i + 1}`}
                              theme={t}
                              h="170px"
                              objectFit="contain"
                              onExpand={() => setLightbox({ frames: it.frames, index: i })}
                            />
                          ))}
                        </Flex>
                      )}

                      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3} mb={3}>
                        <Field label="Camera" value={it.camera_id} theme={t} />
                        <Field label="Segment" value={it.segment_id} theme={t} />
                        <Field label="Source video" value={it.source_video} theme={t} />
                        <Field label="Offset" value={fmtOffset(it.video_offset_seconds)} theme={t} />
                        <Field label="Start" value={fmtTime(it.start_time)} theme={t} />
                        <Field label="End" value={fmtTime(it.end_time)} theme={t} />
                        <Field label="Motion score" value={it.motion_score} theme={t} />
                      </SimpleGrid>

                      {it.violationText && (
                        <>
                          <Text fontSize="9.5px" letterSpacing="0.06em" textTransform="uppercase" color={t.muted} mb={1}>
                            Traffic violations reported
                          </Text>
                          <Box bg={t.panelAlt} border="1px solid" borderColor={t.border} borderLeft="3px solid" borderLeftColor={t.s2} borderRadius="7px" p={3} mb={3}>
                            <Text fontSize="12.5px" color={t.heading}>{it.violationText}</Text>
                          </Box>
                        </>
                      )}

                      {it.notableText && (
                        <>
                          <Text fontSize="9.5px" letterSpacing="0.06em" textTransform="uppercase" color={t.muted} mb={1}>
                            Notable events
                          </Text>
                          <Box bg={t.panelAlt} border="1px solid" borderColor={t.border} borderLeft="3px solid" borderLeftColor={t.s4} borderRadius="7px" p={3} mb={3}>
                            <Text fontSize="12.5px" color={t.body}>{it.notableText}</Text>
                          </Box>
                        </>
                      )}

                      <Text fontSize="9.5px" letterSpacing="0.06em" textTransform="uppercase" color={t.muted} mb={1}>
                        Full description
                      </Text>
                      <Box bg={t.panelAlt} border="1px solid" borderColor={t.border} borderRadius="7px" p={3}>
                        <Described text={it.description || it.snippet} match={null} theme={t} />
                      </Box>
                    </Box>
                  )}
                </Box>
              );
            })}

          {!loading && total > PAGE && (
            <Flex justify="space-between" align="center" mt={4} pt={3} borderTop="1px solid" borderColor={t.border}>
              <Text fontSize="11.5px" color={t.muted}>
                Page {page} of {pages}
              </Text>
              <Flex gap={2}>
                <Button size="xs" variant="outline" borderColor={t.border} isDisabled={page <= 1} onClick={() => { setPage((p) => p - 1); setOpenId(null); }}>
                  Previous
                </Button>
                <Button size="xs" variant="outline" borderColor={t.border} isDisabled={page >= pages} onClick={() => { setPage((p) => p + 1); setOpenId(null); }}>
                  Next
                </Button>
              </Flex>
            </Flex>
          )}
        </DrawerBody>
      </DrawerContent>

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
                  icon={<FaNext />}
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
                  fontFamily={MONO_FONT}
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
    </Drawer>
  );
};

export default DrillDrawer;
