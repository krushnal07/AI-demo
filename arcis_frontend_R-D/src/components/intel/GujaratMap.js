// src/components/intel/GujaratMap.js
// A real slippy map of Gujarat (OpenStreetMap tiles) with the camera estate on
// it. Markers are divIcons rather than Leaflet's default PNG pin: bundlers
// break the default icon's image paths, and a divIcon also lets a site carry
// its own colour and sighting count.
import React, { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Box, Flex, Text, Image, Badge } from "@chakra-ui/react";
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
const nudge = (lat, lng, spread) => {
  if (!spread || spread.of < 2) return [lat, lng];
  const angle = (spread.index / spread.of) * Math.PI * 2 - Math.PI / 2;
  const r = 0.0038; // degrees, roughly 400 m
  return [lat + Math.sin(angle) * r, lng + Math.cos(angle) * r];
};

const siteIcon = ({ hits, size, colour, ring, label }) =>
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
          color:#0F172A;background:rgba(255,255,255,.86);
          padding:1px 4px;border-radius:3px;
        ">${label}</div>
      </div>`,
  });

/** Keeps the viewport on whatever is currently being shown. */
const FitTo = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (!points.length) {
      map.fitBounds(GUJARAT_BOUNDS, { padding: [20, 20] });
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 13 });
  }, [points, map]);
  return null;
};

const GujaratMap = ({ sites = [], sightings = [], onSelect, height = "560px" }) => {
  const t = useIntelTheme();

  const hitsBySite = useMemo(() => {
    const map = {};
    sightings.forEach((s) => { map[s.location] = (map[s.location] || 0) + 1; });
    return map;
  }, [sightings]);

  const positioned = useMemo(
    () => sites.map((s) => ({ ...s, pos: nudge(s.lat, s.lng, s.spread) })),
    [sites]
  );

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
      borderRadius="10px"
      overflow="hidden"
      border="1px solid"
      borderColor={t.border}
      sx={{
        ".leaflet-container": { height, width: "100%", background: t.panelAlt, fontFamily: "inherit" },
        ".leaflet-popup-content": { margin: "10px 12px", minWidth: "200px" },
      }}
    >
      <MapContainer center={GUJARAT_CENTER} zoom={7} scrollWheelZoom style={{ height, width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
                colour: hits ? t.s2 : "#FFFFFF",
                ring: hits ? t.s2 : t.s1,
                label: s.label,
              })}
              eventHandlers={{ click: () => first && onSelect && onSelect(first.id) }}
            >
              <Popup>
                <Box>
                  <Text fontSize="13px" fontWeight="700" color="#0F172A">
                    {s.label}
                  </Text>
                  <Text fontFamily={MONO_FONT} fontSize="10.5px" color="#64748B">
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
                        <Text fontFamily={MONO_FONT} fontSize="10px" color="#64748B" mt={1}>
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
    </Box>
  );
};

export default GujaratMap;
