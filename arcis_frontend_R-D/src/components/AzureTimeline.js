import React, { useEffect, useRef, useState } from "react";
import {
  Box,
  Flex,
  HStack,
  Text,
  Badge,
  IconButton,
  useColorModeValue,
} from "@chakra-ui/react";
import { FiZoomIn, FiZoomOut } from "react-icons/fi";
import { getPlayback } from "../actions/cameraActions";

// Human-readable byte size (for the "Data Consumed" indicator)
const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

/**
 * Azure-backed timeline redesigned for high-tech, responsive, dark/light theme consistency.
 */
const AzureTimeline = ({
  date,
  deviceid,
  onUrlChange,
  onTotalDataChange,
  currentPlayUrl,
  currentVideoTime,
}) => {
  const [segments, setSegments] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(null);
  const [hoveredChunk, setHoveredChunk] = useState({ x: 0, y: 0, time: null });
  const [currentPlaybackTimePosition, setCurrentPlaybackTimePosition] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(200);
  const timelineRef = useRef(null);

  // Theme Tokens (All React Hook calls at top-level component scope)
  const titleColor = useColorModeValue("#1A2E3D", "#FFFFFF");
  const subtextColor = useColorModeValue("#64748B", "#94A3B8");
  const cardBg = useColorModeValue("#FFFFFF", "#18202C");
  const borderColor = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.08)");
  const trackBg = useColorModeValue("#F0F5FA", "#101620");
  const trackBorder = useColorModeValue("#E2E8F0", "rgba(255, 255, 255, 0.08)");
  const gridLineColor = useColorModeValue("rgba(100, 116, 139, 0.2)", "rgba(255, 255, 255, 0.08)");
  const hourTickColor = useColorModeValue("#94A3B8", "#64748B");
  const badgeBg = useColorModeValue("#3F77A514", "#3F77A528");
  const scrollTrackBg = useColorModeValue("#F1F5F9", "#121820");
  const scrollThumbBg = useColorModeValue("#CBD5E1", "#334155");

  // --- Fetch recordings for the selected day ---
  useEffect(() => {
    if (!deviceid || !date) return;
    let cancelled = false;

    (async () => {
      const res = await getPlayback(deviceid, {
        from: `${date}T00:00:00Z`,
        to: `${date}T23:59:59Z`,
      });
      if (cancelled) return;

      const segs = res.segments || [];
      setSegments(segs);
      setHighlightedIndex(null);
      setCurrentPlaybackTimePosition(getCurrentTimePosition());

      if (onTotalDataChange) {
        const totalBytes = segs.reduce((s, x) => s + (x.sizeBytes || 0), 0);
        onTotalDataChange(formatBytes(totalBytes));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, deviceid]);

  // --- Position helpers ---
  const calculatePosition = (time) => {
    const startOfDay = new Date(`${date}T00:00:00Z`);
    const totalDuration = 24 * 60 * 60 * 1000;
    const elapsed = time - startOfDay.getTime();
    return (elapsed / totalDuration) * 100;
  };

  const getCurrentTimePosition = () => {
    const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    if (istNow.toISOString().slice(0, 10) !== date) return null;
    const secs =
      istNow.getUTCHours() * 3600 +
      istNow.getUTCMinutes() * 60 +
      istNow.getUTCSeconds();
    return (secs / (24 * 3600)) * 100;
  };

  const generateHourlyMarkers = () => {
    const startOfDay = new Date(`${date}T00:00:00Z`);
    return Array.from({ length: 24 }, (_, h) => new Date(startOfDay.getTime() + h * 3600 * 1000));
  };

  const fileMarkers = segments.map((seg, index) => {
    const startTime = new Date(seg.startTime);
    const endTime = new Date(seg.endTime);
    const startPercentage = calculatePosition(startTime.getTime());
    const width = calculatePosition(endTime.getTime()) - startPercentage;
    return { startTime, endTime, startPercentage, width, index, url: seg.url };
  });

  // --- Sync red playhead position with currently playing video time ---
  useEffect(() => {
    if (!currentPlayUrl || currentVideoTime === undefined || currentVideoTime === null) return;
    const activeSegment = fileMarkers.find((f) => f.url === currentPlayUrl);
    if (activeSegment) {
      setHighlightedIndex(activeSegment.index);
      const currentExactTimeMs = activeSegment.startTime.getTime() + currentVideoTime * 1000;
      const newPos = calculatePosition(currentExactTimeMs);
      setCurrentPlaybackTimePosition(newPos);
    }
  }, [currentVideoTime, currentPlayUrl, segments]);

  // --- Interaction ---
  const handleFileClick = (index, offsetSeconds = 0) => {
    setHighlightedIndex(index);
    const seg = fileMarkers[index];
    if (seg && onUrlChange) {
      onUrlChange(seg.url, offsetSeconds);
      const exactTimeMs = seg.startTime.getTime() + offsetSeconds * 1000;
      setCurrentPlaybackTimePosition(calculatePosition(exactTimeMs));
    }
  };

  const handleTimelineClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickPercent = ((event.clientX - rect.left) / rect.width) * 100;
    const startOfDay = new Date(`${date}T00:00:00Z`);
    const clickedTime = startOfDay.getTime() + (clickPercent / 100) * 24 * 3600 * 1000;

    let selectedSeg = null;
    let offsetSeconds = 0;

    for (const f of fileMarkers) {
      if (clickedTime >= f.startTime.getTime() && clickedTime <= f.endTime.getTime()) {
        selectedSeg = f;
        offsetSeconds = Math.max(0, (clickedTime - f.startTime.getTime()) / 1000);
        break;
      }
    }

    if (!selectedSeg) {
      let minDiff = Infinity;
      fileMarkers.forEach((f) => {
        const diff = Math.abs(f.startTime.getTime() - clickedTime);
        if (diff < minDiff) {
          minDiff = diff;
          selectedSeg = f;
          offsetSeconds = 0;
        }
      });
    }

    if (selectedSeg) {
      handleFileClick(selectedSeg.index, offsetSeconds);
    }
  };

  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const clickPercent = (x / rect.width) * 100;
    const startOfDay = new Date(`${date}T00:00:00Z`);
    const hoverTime = new Date(startOfDay.getTime() + (clickPercent / 100) * 24 * 3600 * 1000);
    setHoveredChunk({ x, y: event.clientY - rect.top, time: Math.floor(hoverTime.getTime() / 1000) });
  };

  const handleMouseLeave = () => setHoveredChunk({ x: 0, y: 0, time: null });

  // --- Zoom controls with anchored scroll position ---
  const updateZoom = (newZoom) => {
    const clamped = Math.max(100, Math.min(800, newZoom));
    const container = timelineRef.current;
    if (container) {
      const currentPos = currentPlaybackTimePosition !== null ? currentPlaybackTimePosition / 100 : 0.5;
      setZoomLevel(clamped);
      requestAnimationFrame(() => {
        if (container) {
          container.scrollLeft =
            currentPos * container.scrollWidth - container.clientWidth / 2;
        }
      });
    } else {
      setZoomLevel(clamped);
    }
  };

  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      e.preventDefault();
      if (e.deltaY < 0) updateZoom(zoomLevel + 25);
      else updateZoom(zoomLevel - 25);
    }
  };

  return (
    <Box
      w="100%"
      borderTop="1px solid"
      borderColor={borderColor}
      pt="6px"
      mt="6px"
      fontFamily="'Manrope', sans-serif"
      userSelect="none"
    >
      {/* Timeline Header bar */}
      <Flex justify="space-between" align="center" mb="4px" flexWrap="wrap" gap="6px">
        <HStack spacing="6px" align="center">
          <Box w="6px" h="6px" borderRadius="full" bg="#3F77A5" />
          <Text
            fontFamily="'Manrope', sans-serif"
            fontWeight="700"
            fontSize="11px"
            color={titleColor}
          >
            Cloud Playback Timeline
          </Text>
          <Badge
            bg={badgeBg}
            color="#3F77A5"
            borderRadius="5px"
            px="5px"
            py="0.5px"
            fontSize="9.5px"
            fontWeight="700"
            textTransform="none"
          >
            {segments.length} recording{segments.length === 1 ? "" : "s"}
          </Badge>
        </HStack>

        <HStack spacing="4px">
          <Text fontSize="10px" fontWeight="600" color={subtextColor}>
            Zoom: {Math.round(zoomLevel)}%
          </Text>
          <IconButton
            icon={<FiZoomOut size="10px" />}
            aria-label="Zoom Out"
            size="xs"
            h="18px"
            w="18px"
            minW="18px"
            variant="outline"
            borderColor={borderColor}
            color={subtextColor}
            _hover={{ bg: "#3F77A512", color: "#3F77A5", borderColor: "#3F77A5" }}
            onClick={() => updateZoom(zoomLevel - 30)}
          />
          <IconButton
            icon={<FiZoomIn size="10px" />}
            aria-label="Zoom In"
            size="xs"
            h="18px"
            w="18px"
            minW="18px"
            variant="outline"
            borderColor={borderColor}
            color={subtextColor}
            _hover={{ bg: "#3F77A512", color: "#3F77A5", borderColor: "#3F77A5" }}
            onClick={() => updateZoom(zoomLevel + 30)}
          />
        </HStack>
      </Flex>

      {/* Timeline Canvas Track */}
      <Box
        ref={timelineRef}
        overflowX="auto"
        overflowY="hidden"
        w="100%"
        pb="2px"
        onWheel={handleWheel}
        css={{
          "&::-webkit-scrollbar": { height: "3px" },
          "&::-webkit-scrollbar-track": {
            background: scrollTrackBg,
            borderRadius: "3px",
          },
          "&::-webkit-scrollbar-thumb": {
            background: scrollThumbBg,
            borderRadius: "3px",
          },
        }}
      >
        <Box
          position="relative"
          h="36px"
          minW={`${zoomLevel}%`}
          bg={trackBg}
          borderWidth="1px"
          borderColor={trackBorder}
          borderRadius="6px"
          cursor="pointer"
          onClick={handleTimelineClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* 24 Hour Grid Markers */}
          {generateHourlyMarkers().map((hourMarker, index) => (
            <Box
              key={`hour-${index}`}
              position="absolute"
              left={`${calculatePosition(hourMarker.getTime())}%`}
              top="0"
              bottom="0"
              width="1px"
              bg={gridLineColor}
              pointerEvents="none"
            >
              <Box
                position="absolute"
                top="0"
                left="-0.5px"
                w="1.5px"
                h="4px"
                bg={hourTickColor}
              />
              <Text
                position="absolute"
                bottom="1px"
                left="50%"
                transform="translateX(-50%)"
                fontFamily="'Manrope', sans-serif"
                fontSize="9px"
                fontWeight="600"
                color={subtextColor}
                whiteSpace="nowrap"
                pointerEvents="none"
              >
                {hourMarker.getUTCHours()}:00
              </Text>
            </Box>
          ))}

          {/* Cloud Recording Segment Blocks */}
          {fileMarkers.map(({ startPercentage, width, index }) => {
            const isHighlighted = highlightedIndex === index;
            return (
              <Box
                key={`file-${index}`}
                position="absolute"
                left={`${startPercentage}%`}
                width={`${Math.max(width, 0.4)}%`}
                top="5px"
                height="20px"
                bg={
                  isHighlighted
                    ? "linear-gradient(180deg, #60A5FA 0%, #3F77A5 100%)"
                    : "linear-gradient(180deg, #3F77A5 0%, #2B5273 100%)"
                }
                borderRadius="4px"
                borderWidth={isHighlighted ? "1px" : "0px"}
                borderColor="#FFFFFF"
                boxShadow={
                  isHighlighted
                    ? "0 0 8px rgba(96, 165, 250, 0.7)"
                    : "0 1px 3px rgba(0, 0, 0, 0.15)"
                }
                zIndex={isHighlighted ? 4 : 2}
                transition="all 0.15s ease"
                _hover={{
                  transform: "scaleY(1.08)",
                  bg: "linear-gradient(180deg, #60A5FA 0%, #3F77A5 100%)",
                  boxShadow: "0 0 6px rgba(63, 119, 165, 0.6)",
                  zIndex: 5,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFileClick(index);
                }}
              />
            );
          })}

          {/* Hover Scrubber Line & Tooltip */}
          {hoveredChunk.time !== null && (
            <>
              <Box
                position="absolute"
                left={`${hoveredChunk.x}px`}
                top="0"
                bottom="0"
                width="1.5px"
                bg="#3F77A5"
                pointerEvents="none"
                zIndex={10}
              />
              <Box
                position="absolute"
                left={`${hoveredChunk.x}px`}
                top="6px"
                transform="translateX(-50%)"
                bg="rgba(15, 23, 42, 0.92)"
                color="#FFFFFF"
                px="6px"
                py="2px"
                borderRadius="4px"
                fontFamily="'Manrope', monospace"
                fontSize="10px"
                fontWeight="700"
                boxShadow="0 2px 8px rgba(0,0,0,0.3)"
                pointerEvents="none"
                zIndex={20}
                borderWidth="1px"
                borderColor="rgba(255, 255, 255, 0.15)"
              >
                {new Date(hoveredChunk.time * 1000).toISOString().substring(11, 19)}
              </Box>
            </>
          )}

          {/* Current Playback Marker (Red Playhead) */}
          {currentPlaybackTimePosition !== null && (
            <Box
              position="absolute"
              left={`${currentPlaybackTimePosition}%`}
              top="0"
              bottom="0"
              width="2px"
              bg="#EF4444"
              zIndex={15}
              pointerEvents="none"
              boxShadow="0 0 4px rgba(239, 68, 68, 0.6)"
            >
              <Box
                position="absolute"
                top="0"
                left="50%"
                transform="translateX(-50%)"
                w="0"
                h="0"
                borderLeft="4px solid transparent"
                borderRight="4px solid transparent"
                borderTop="6px solid #EF4444"
              />
            </Box>
          )}

          {/* Empty State when no segments are available */}
          {segments.length === 0 && (
            <Flex
              position="absolute"
              top="0"
              left="0"
              right="0"
              bottom="0"
              align="center"
              justify="center"
              pointerEvents="none"
            >
              <Text
                fontFamily="'Manrope', sans-serif"
                fontSize="11px"
                fontWeight="600"
                color={subtextColor}
                letterSpacing="0.5px"
              >
                No cloud recording segments on this date
              </Text>
            </Flex>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default AzureTimeline;
