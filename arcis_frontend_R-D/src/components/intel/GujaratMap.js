// src/components/intel/GujaratMap.js
// A real slippy map of Gujarat with the camera estate on it.
// Uses reliable CartoDB / OpenStreetMap tile layer with auto-resizing.
import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Box, Flex, Text, Image, Badge, useColorMode } from "@chakra-ui/react";
import { useIntelTheme, MONO_FONT } from "./IntelKit";

// Gujarat, comfortably framed
const GUJARAT_CENTER = [22.6, 71.8];
const GUJARAT_BOUNDS = [
  [20.1, 68.1],
  [24.8, 74.6],
];

/**
 * Five sites share one city-centre coordinate. Nudge each onto a tiny circle
 * (~400 m) so all of them stay visible and clickable at city zoom, instead of
 * one marker hiding four cameras.
 */
const hasCoords = (s) => Number.isFinite(s?.lat) && Number.isFinite(s?.lng);

const nudge = (lat, lng, spread) => {
  if (!spread || spread.of < 2) return [lat, lng];
  const angle = (spread.index / spread.of) * Math.PI * 2 - Math.PI / 2;
  const r = 0.0038; // degrees, roughly 400 m
  return [lat + Math.sin(angle) * r, lng + Math.cos(angle) * r];
};

const siteIcon = ({ hits, size, colour, ring, label, isDark }) =>
  L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        <div style="
          width:${size}px;height:${size}px;border-radius:50%;
          background:${colour};border:2px solid ${ring};
          box-shadow:0 1px 4px rgba(0,0,0,.35);
          display:flex;align-items:center;justify-content:center;
          font:700 10px/1 ui-monospace,Menlo,monospace;color:#fff;
        ">${hits || ""}</div>
        <div style="
          position:absolute;top:${size + 2}px;left:50%;transform:translateX(-50%);
          white-space:nowrap;font:600 10px/1.2 ui-monospace,Menlo,monospace;
          color:${isDark ? "#FFFFFF" : "#0F172A"};
          background:${isDark ? "rgba(28,34,45,0.92)" : "rgba(255,255,255,.86)"};
          padding:1px 4px;border-radius:3px;
          ${isDark ? "border:1px solid rgba(255,255,255,0.12);" : ""}
        ">${label}</div>
      </div>`,
  });

/** Ensures Leaflet correctly recalculates dimensions when rendered in dynamic containers */
const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    const container = map.getContainer();
    let ro;
    if (typeof ResizeObserver !== "undefined" && container) {
      ro = new ResizeObserver(() => {
        map.invalidateSize();
      });
      ro.observe(container);
    }
    return () => {
      clearTimeout(timer);
      if (ro) ro.disconnect();
    };
  }, [map]);
  return null;
};

/** Keeps the viewport on whatever is currently being shown. */
const FitTo = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const valid = (points || []).filter(
      (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])
    );
    try {
      if (!valid.length) {
        map.fitBounds(GUJARAT_BOUNDS, { padding: [20, 20] });
        return;
      }
      if (valid.length === 1) {
        map.setView(valid[0], 12);
        return;
      }
      const bounds = L.latLngBounds(valid);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      } else {
        map.fitBounds(GUJARAT_BOUNDS, { padding: [20, 20] });
      }
    } catch (e) {
      console.warn("FitTo error:", e);
    }
  }, [points, map]);
  return null;
};

const GujaratMap = ({ sites = [], sightings = [], onSelect, height = "560px" }) => {
  const t = useIntelTheme();
  const { colorMode } = useColorMode();
  const isDark = colorMode === "dark";

  const hitsBySite = useMemo(() => {
    const map = {};
    sightings.forEach((s) => { map[s.location] = (map[s.location] || 0) + 1; });
    return map;
  }, [sightings]);

  // A site with no coordinates is simply not drawn; it is still counted in
  // every table on the page, and the caller is told how many were skipped.
  const positioned = useMemo(
    () => sites.filter(hasCoords).map((s) => ({ ...s, pos: nudge(s.lat, s.lng, s.spread) })),
    [sites]
  );

  const skipped = useMemo(() => sites.filter((s) => !hasCoords(s)), [sites]);

  const posByLocation = useMemo(() => {
    const map = {};
    positioned.forEach((s) => { map[s.location] = s.pos; });
    return map;
  }, [positioned]);

  // one point per consecutive change of site - the route worth drawing
  const route = useMemo(() => {
    const pts = [];
    sightings.forEach((s) => {
      const pos = posByLocation[s.location];
      if (!pos) return;
      const last = pts[pts.length - 1];
      if (last && last.location === s.location) return;
      pts.push({ location: s.location, pos });
    });
    return pts;
  }, [sightings, posByLocation]);

  const maxSegments = Math.max(1, ...sites.map((s) => s.segments || 0));
  const fitPoints = sightings.length ? route.map((r) => r.pos) : positioned.map((s) => s.pos);

  return (
    <Box
      h={height || "100%"}
      minH="350px"
      w="100%"
      borderRadius="10px"
      overflow="hidden"
      border="1px solid"
      borderColor={t.border}
      display="flex"
      flexDirection="column"
      position="relative"
      sx={{
        ".leaflet-container": {
          height: "100% !important",
          minHeight: "350px !important",
          width: "100% !important",
          flex: 1,
          background: t.panelAlt,
          fontFamily: "inherit",
          zIndex: 1,
        },
        ".leaflet-popup-content-wrapper": {
          background: `${t.panel} !important`,
          color: `${t.heading} !important`,
          border: `1px solid ${t.border}`,
          borderRadius: "8px !important",
          boxShadow: "0 4px 14px rgba(0,0,0,0.35) !important",
        },
        ".leaflet-popup-tip": {
          background: `${t.panel} !important`,
        },
        ".leaflet-popup-close-button": {
          color: `${t.muted} !important`,
        },
        ".leaflet-popup-content": { margin: "10px 12px", minWidth: "200px" },
      }}
    >
      <MapContainer
        center={GUJARAT_CENTER}
        zoom={7}
        scrollWheelZoom
        style={{ height: "100%", width: "100%", flex: 1, minHeight: "350px" }}
      >
        <MapResizer />
        <TileLayer
          key={isDark ? "dark-tiles" : "light-tiles"}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url={
            isDark
              ? "https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png"
              : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          }
          subdomains={["a", "b", "c", "d"]}
        />

        <FitTo points={fitPoints} />

        {route.length > 1 && (
          <Polyline
            positions={route.map((r) => r.pos)}
            pathOptions={{ color: t.s2, weight: 3, opacity: 0.85, dashArray: "8 6" }}
          />
        )}

        {positioned.map((s) => {
          const hits = hitsBySite[s.location] || 0;
          const size = Math.round(20 + ((s.segments || 0) / maxSegments) * 14);
          const first = sightings.find((x) => x.location === s.location);
          return (
            <Marker
              key={s.location}
              position={s.pos}
              icon={siteIcon({
                hits,
                size: hits ? size + 4 : size,
                colour: hits ? t.s2 : isDark ? "#1C222D" : "#FFFFFF",
                ring: hits ? t.s2 : t.s1,
                label: s.label,
                isDark,
              })}
              eventHandlers={{ click: () => first && onSelect && onSelect(first.id) }}
            >
              <Popup>
                <Box>
                  <Text fontSize="13px" fontWeight="700" color={t.heading}>
                    {s.label}
                  </Text>
                  <Text fontFamily={MONO_FONT} fontSize="10.5px" color={t.muted}>
                    {s.camera_id} &middot; {(s.segments || 0).toLocaleString()} segments
                  </Text>
                  {s.spread?.of > 1 && (
                    <Text fontSize="10.5px" color="#B45309" mt={1}>
                      Shares one city-centre coordinate with {s.spread.of - 1} other site
                      {s.spread.of - 1 === 1 ? "" : "s"} &mdash; position is approximate.
                    </Text>
                  )}
                  {first && (
                    <Flex gap={2} mt={2} align="flex-start">
                      {first.frame && (
                        <Image src={first.frame} alt={s.label} w="88px" h="50px" objectFit="cover" borderRadius="4px" />
                      )}
                      <Box minW={0}>
                        <Badge colorScheme="orange" fontSize="9px" borderRadius="full" px={2} textTransform="none">
                          {hits} sighting{hits === 1 ? "" : "s"}
                        </Badge>
                        <Text fontFamily={MONO_FONT} fontSize="10px" color={t.muted} mt={1}>
                          {first.start_time ? String(first.start_time).replace("T", " ").slice(0, 19) : ""}
                        </Text>
                      </Box>
                    </Flex>
                  )}
                </Box>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {skipped.length > 0 && (
        <Flex align="center" gap={2} px={3} py={2} bg={t.panelAlt} borderTop="1px solid" borderColor={t.border} flexShrink={0}>
          <Text fontSize="11px" color={t.muted}>
            {skipped.length} site{skipped.length === 1 ? "" : "s"} not plotted &mdash; no coordinates for{" "}
            {skipped.map((s) => s.camera_id || s.location).join(", ")}. Still counted in the tables below.
          </Text>
        </Flex>
      )}
    </Box>
  );
};

export default GujaratMap;
