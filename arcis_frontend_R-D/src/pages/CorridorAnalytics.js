import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { FaMapMarkedAlt, FaSyncAlt } from "react-icons/fa";
import {
  Box,
  Flex,
  Text,
  Button,
  Badge,
  Spinner,
  SimpleGrid,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
  useColorModeValue,
} from "@chakra-ui/react";
import DrillDrawer from "../components/intel/DrillDrawer";
import {
  Panel,
  StatTile,
  Insight,
  BarList,
  SplitBarList,
  Legend,
  RateBadge,
  SectionLabel,
  useIntelTheme,
  MONO_FONT,
} from "../components/intel/IntelKit";

/*
 * No camera in activities_hackathon carries a latitude, so sites are placed
 * from their names until a camera -> coordinate table exists. Anything not
 * listed here is still counted, just not plotted.
 */
const APPROX_COORDS = {
  "Rajkot Bus Port": { lat: 22.302, lon: 70.795, cluster: null },
  Dehgam: { lat: 23.17, lon: 72.821, cluster: null },
  Tankal: { lat: 22.55, lon: 72.95, cluster: null },
  Janpath: { lat: 23.023, lon: 72.571, cluster: "ahmedabad" },
  "Chiman bhai Bridge": { lat: 23.028, lon: 72.548, cluster: "ahmedabad" },
  "O.N.G.C. Office": { lat: 23.048, lon: 72.531, cluster: "ahmedabad" },
  "pakwan cross road": { lat: 23.038, lon: 72.507, cluster: "ahmedabad" },
  Suvidhapark: { lat: 23.061, lon: 72.531, cluster: "ahmedabad" },
  "Visat T Junction": { lat: 23.083, lon: 72.59, cluster: "ahmedabad" },
  "CN Vidhyalaya P2 RLVD-2027": { lat: 23.04, lon: 72.55, cluster: "ahmedabad" },
};

const MIX_NAMES = ["car", "motorcycle", "auto-rickshaw", "bus"];
const VIOLATIONS = ["helmet", "red light", "illegal parking", "speeding", "wrong-side"];
const HAZARDS = ["debris", "puddle", "fire", "injur", "flood", "smoke", "accident", "collision", "pothole", "obstruction"];

// main map projection
const MX = (lon) => ((lon - 70.4) / 2.6) * 600;
const MY = (lat) => ((23.4 - lat) / 1.4) * 380;
// inset projection
const IX = (lon) => ((lon - 72.49) / 0.11) * 260;
const IY = (lat) => ((23.09 - lat) / 0.08) * 200;

const CorridorAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drill, setDrill] = useState(null);

  const t = useIntelTheme();
  const pageBg = t.page;
  const mapBg = useColorModeValue("gray.50", "whiteAlpha.100");
  const gridStroke = useColorModeValue("#E3E7EC", "#232B34");
  const baseUrl = process.env.REACT_APP_BASE_URL || process.env.REACT_APP_URL;

  const load = useCallback(
    async (refresh) => {
      setLoading(true);
      setError(null);
      try {
        const { data: body } = await axios.get(`${baseUrl}/api/ai-alerts/intel/summary${refresh ? "?refresh=1" : ""}`);
        if (!body?.success) throw new Error(body?.message || "Request failed");
        setData(body);
      } catch (err) {
        setError(err.response?.data?.message || err.message || "Could not load corridor summary.");
      } finally {
        setLoading(false);
      }
    },
    [baseUrl]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const sites = data?.sites || [];

  const byRate = useMemo(() => [...sites].sort((a, b) => b.rate - a.rate), [sites]);
  const hotspot = byRate.find((s) => s.total >= 50);
  const busiest = useMemo(() => [...sites].sort((a, b) => b.flagged - a.flagged)[0], [sites]);
  const silent = useMemo(() => sites.filter((s) => s.flagged === 0 && s.total >= 100), [sites]);

  const cluster = useMemo(() => {
    const members = sites.filter((s) => APPROX_COORDS[s.location]?.cluster === "ahmedabad");
    return { members, total: members.reduce((n, s) => n + s.total, 0) };
  }, [sites]);

  const outliers = useMemo(
    () => sites.filter((s) => APPROX_COORDS[s.location] && !APPROX_COORDS[s.location].cluster),
    [sites]
  );
  const unplotted = useMemo(() => sites.filter((s) => !APPROX_COORDS[s.location]), [sites]);

  const reg = useMemo(() => {
    const map = {};
    (data?.register || []).forEach((r) => { map[r.term] = r; });
    return map;
  }, [data]);

  const pick = (terms) =>
    terms.filter((k) => reg[k]).map((k) => ({ label: k, net: reg[k].net, negated: reg[k].negated }));

  if (loading && !data) {
    return (
      <Flex bg={pageBg} minH="100vh" align="center" justify="center" direction="column" gap={3}>
        <Spinner size="lg" color={t.s1} />
        <Text fontSize="13px" color={t.muted}>
          Building corridor rollup&hellip;
        </Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Box bg={pageBg} minH="100vh" p={6}>
        <Panel title="Could not load">
          <Text fontSize="13px" color={t.critical}>{error}</Text>
          <Button mt={3} size="sm" onClick={() => load(false)}>Retry</Button>
        </Panel>
      </Box>
    );
  }

  const { totals, entities } = data;
  const radius = (n) => Math.max(7, Math.min(30, Math.sqrt(n) * 0.95));
  const fillFor = (rate) => (rate >= 25 ? t.s2 : rate >= 10 ? t.s4 : t.s3);

  return (
    <Box bg={pageBg} minH="100vh" pt={{ base: "70px", md: 4 }} pb={{ base: "100px", md: 8 }} px={{ base: 3, md: 6 }}>
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
              Corridor Analytics
            </Text>
            <Text fontSize="12.5px" color={t.body} mt={0.5}>
              {sites.length} sites across {totals.segments.toLocaleString()} segments &mdash; click a pin, bar or row to read the records.
            </Text>
          </Box>
          <Flex ml="auto" align="center" gap={2.5} flexShrink={0}>
            <Badge bg={`${t.s4}22`} color={t.warning} borderRadius="full" px={2.5} py={1} fontSize="10px" fontWeight="600" textTransform="none">
              coordinates approximate
            </Badge>
            <Button
              size="sm"
              variant="outline"
              borderColor={t.border}
              color={t.body}
              borderRadius="9px"
              fontWeight="600"
              fontSize="12px"
              leftIcon={<FaSyncAlt />}
              onClick={() => load(true)}
              isLoading={loading}
              _hover={{ borderColor: t.s1, color: t.s1 }}
            >
              Rebuild
            </Button>
          </Flex>
        </Flex>
      </Box>

      <SectionLabel>What the map is telling you</SectionLabel>
      <Flex direction="column" gap={3} mb={2}>
        {hotspot && (
          <Insight
            tone="crit"
            kicker="HOTSPOT"
            title={`${hotspot.location} runs ${(hotspot.rate / (totals.flagRate || 1)).toFixed(1)}× the estate flag rate.`}
            source={`${hotspot.camera_id} · ${hotspot.total.toLocaleString()} segments`}
            onClick={() => setDrill({ facet: "site", value: hotspot.location, only: "flagged", title: `${hotspot.location} — flagged` })}
          >
            {hotspot.flagged} of its {hotspot.total.toLocaleString()} segments carry an anomaly note &mdash; {hotspot.rate}%,
            against an estate average of {totals.flagRate}%.
          </Insight>
        )}
        {busiest && (
          <Insight
            tone="warn"
            kicker="VOLUME"
            title={`${busiest.location} is the largest absolute source of flagged scenes.`}
            source={`${busiest.camera_id} · ${busiest.night} segments in the night window`}
            onClick={() => setDrill({ facet: "site", value: busiest.location, only: "flagged", title: `${busiest.location} — flagged` })}
          >
            {busiest.flagged} flagged segments &mdash; more than any other site &mdash; from {busiest.total.toLocaleString()} total.
          </Insight>
        )}
        {silent.length > 0 && (
          <Insight
            tone="info"
            kicker={"BLIND\nSPOT"}
            title={`${silent.length} busy ${silent.length === 1 ? "camera has" : "cameras have"} never produced a single flag.`}
            source={silent.map((s) => s.camera_id).join(", ")}
            onClick={() => setDrill({ facet: "sites", value: silent.map((s) => s.location).join("|"), title: "Sites with no flags" })}
          >
            {silent.map((s) => s.location).join(" and ")} hold {silent.reduce((n, s) => n + s.total, 0).toLocaleString()} segments
            between them with zero anomaly notes. Either genuinely quiet, or the describer is not being asked the same
            question there &mdash; an operational check, not a data one.
          </Insight>
        )}
      </Flex>

      {/* map */}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4} mb={4} sx={{ "@media (min-width: 62em)": { gridTemplateColumns: "1.35fr 1fr" } }}>
        <Panel title="Estate" sub="size = volume · colour = flag rate" accent={t.s1} fill>
          <Box bg={mapBg} borderRadius="8px" overflow="hidden">
            <svg viewBox="0 0 600 380" role="img" aria-label="Camera sites across Gujarat, sized by segment volume">
              <g stroke={gridStroke} strokeWidth="1" opacity="0.7">
                <path d="M0 95 H600 M0 190 H600 M0 285 H600 M150 0 V380 M300 0 V380 M450 0 V380" fill="none" />
              </g>
              <path
                d="M60 300 C130 250 200 230 300 200 C380 176 460 140 520 70"
                fill="none" stroke={t.muted} strokeWidth="1.5" strokeDasharray="5 5" opacity="0.55"
              />
              <text x="250" y="228" fontFamily={MONO_FONT} fontSize="9" fill={t.muted}>
                Rajkot – Ahmedabad corridor · no coverage between
              </text>

              {outliers.map((s) => {
                const c = APPROX_COORDS[s.location];
                const r = radius(s.total);
                return (
                  <g
                    key={s.location}
                    style={{ cursor: "pointer" }}
                    onClick={() => setDrill({ facet: "site", value: s.location, title: s.location })}
                  >
                    <title>{`${s.location} — ${s.total} segments, ${s.rate}% flagged · click to open`}</title>
                    <circle cx={MX(c.lon)} cy={MY(c.lat)} r={r} fill={fillFor(s.rate)} opacity="0.22" />
                    <circle cx={MX(c.lon)} cy={MY(c.lat)} r={r} fill="none" stroke={fillFor(s.rate)} strokeWidth="2" />
                    <text x={MX(c.lon)} y={MY(c.lat) + 4} textAnchor="middle" fontFamily={MONO_FONT} fontSize="11" fontWeight="600" fill={t.heading}>
                      {s.total}
                    </text>
                    <text x={MX(c.lon)} y={MY(c.lat) + r + 16} textAnchor="middle" fontFamily={MONO_FONT} fontSize="9" fill={t.muted}>
                      {s.location} · {s.rate}%
                    </text>
                  </g>
                );
              })}

              {cluster.members.length > 0 && (
                <g
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    setDrill({
                      facet: "sites",
                      value: cluster.members.map((m) => m.location).join("|"),
                      title: "Ahmedabad metro",
                    })
                  }
                >
                  <title>{`Ahmedabad metro — ${cluster.members.length} sites, ${cluster.total} segments · click to open`}</title>
                  <circle cx="496" cy="140" r="40" fill={t.s1} opacity="0.14" />
                  <circle cx="496" cy="140" r="40" fill="none" stroke={t.s1} strokeWidth="2" strokeDasharray="4 3" />
                  <text x="496" y="137" textAnchor="middle" fontFamily={MONO_FONT} fontSize="13" fontWeight="600" fill={t.heading}>
                    {cluster.total.toLocaleString()}
                  </text>
                  <text x="496" y="153" textAnchor="middle" fontFamily={MONO_FONT} fontSize="9" fill={t.muted}>
                    {cluster.members.length} sites
                  </text>
                  <text x="496" y="196" textAnchor="middle" fontFamily={MONO_FONT} fontSize="9" fill={t.muted}>
                    Ahmedabad metro
                  </text>
                </g>
              )}
            </svg>
          </Box>
          <Legend
            items={[
              { label: "cluster", color: t.s1 },
              { label: "flag rate >25%", color: t.s2 },
              { label: "10–25%", color: t.s4 },
              { label: "<10%", color: t.s3 },
            ]}
          />
        </Panel>

        <Panel title="Ahmedabad inset" sub={`${cluster.members.length} sites within 9 km`} accent={t.s3} fill>
          <Box bg={mapBg} borderRadius="8px" overflow="hidden">
            <svg viewBox="0 0 260 200" role="img" aria-label="Camera sites within Ahmedabad">
              <g stroke={gridStroke} strokeWidth="1" opacity="0.6">
                <path d="M0 50 H260 M0 100 H260 M0 150 H260 M65 0 V200 M130 0 V200 M195 0 V200" fill="none" />
              </g>
              {cluster.members.map((s) => {
                const c = APPROX_COORDS[s.location];
                const r = Math.max(5, Math.min(15, Math.sqrt(s.total) * 0.5));
                return (
                  <g
                    key={s.location}
                    style={{ cursor: "pointer" }}
                    onClick={() => setDrill({ facet: "site", value: s.location, title: s.location })}
                  >
                    <title>{`${s.location} — ${s.total} segments, ${s.rate}% flagged · click to open`}</title>
                    <circle cx={IX(c.lon)} cy={IY(c.lat)} r={r} fill={s.rate >= 40 ? t.critical : fillFor(s.rate)} opacity="0.88" />
                    <text x={IX(c.lon)} y={IY(c.lat) + r + 11} textAnchor="middle" fontFamily={MONO_FONT} fontSize="8.5" fill={t.muted}>
                      {s.location.split(" ")[0]} {s.rate}%
                    </text>
                  </g>
                );
              })}
            </svg>
          </Box>
          {unplotted.length > 0 && (
            <Text fontSize="11.5px" color={t.muted} mt="auto" pt={4}>
              {unplotted.length} site{unplotted.length === 1 ? "" : "s"} not plotted &mdash; no place name to resolve
              ({unplotted.map((s) => s.camera_id).join(", ")}). They are still counted in every table below.
            </Text>
          )}
        </Panel>
      </SimpleGrid>

      <Panel title="Site table" sub="sorted by flag rate" accent={t.s2} mb={6}>
        <TableContainer overflowX="auto">
          <Table size="sm" variant="simple">
            <Thead>
              <Tr>
                <Th fontSize="10px" color={t.muted}>Location</Th>
                <Th fontSize="10px" color={t.muted}>Camera</Th>
                <Th fontSize="10px" color={t.muted} isNumeric>Segments</Th>
                <Th fontSize="10px" color={t.muted} isNumeric>Flagged</Th>
                <Th fontSize="10px" color={t.muted} isNumeric>Rate</Th>
                <Th fontSize="10px" color={t.muted} isNumeric>Night</Th>
                <Th fontSize="10px" color={t.muted}>Band</Th>
              </Tr>
            </Thead>
            <Tbody>
              {byRate.map((s) => (
                <Tr
                  key={s.location}
                  _hover={{ bg: t.panelAlt }}
                  cursor="pointer"
                  onClick={() => setDrill({ facet: "site", value: s.location, title: s.location })}
                >
                  <Td fontSize="11.5px" color={t.body}>{s.location}</Td>
                  <Td fontSize="10.5px" color={t.muted} fontFamily={MONO_FONT}>{s.camera_id}</Td>
                  <Td fontSize="11.5px" color={t.body} isNumeric fontFamily={MONO_FONT}>{s.total.toLocaleString()}</Td>
                  <Td fontSize="11.5px" color={t.body} isNumeric fontFamily={MONO_FONT}>{s.flagged}</Td>
                  <Td fontSize="11.5px" color={t.body} isNumeric fontFamily={MONO_FONT}>{s.rate}%</Td>
                  <Td fontSize="11.5px" color={t.body} isNumeric fontFamily={MONO_FONT}>{s.night || "—"}</Td>
                  <Td><RateBadge rate={s.rate} /></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      </Panel>

      <SectionLabel note="click a figure to open its records">Traffic, entity &amp; violation analytics</SectionLabel>

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3.5} mb={4}>
        <StatTile
          label="Crowd noted"
          value={(entities.find((e) => e.term === "crowd")?.count || 0).toLocaleString()}
          note="segments mentioning a crowd"
          onClick={() => setDrill({ facet: "signal", value: "crowd", title: '"crowd" in the corpus' })}
        />
        <StatTile
          label="Helmet observed"
          value={reg.helmet?.net ?? "—"}
          note={`of ${reg.helmet?.total ?? 0} mentions`}
          onClick={() => setDrill({ facet: "signal", value: "helmet", title: "Helmet mentions", state: "observed" })}
        />
        <StatTile
          label="Red light"
          value={reg["red light"]?.net ?? "—"}
          note="observed"
          color={t.warning}
          onClick={() => setDrill({ facet: "signal", value: "red light", title: "Red-light mentions", state: "observed" })}
        />
        <StatTile
          label="Police present"
          value={reg.police?.net ?? "—"}
          note="observed"
          onClick={() => setDrill({ facet: "signal", value: "police", title: "Police mentions", state: "observed" })}
        />
      </SimpleGrid>

      <Panel title="Entity mentions" sub="documents containing term" accent={t.s1} mb={4}>
        <BarList
          data={entities.map((e) => ({
            label: e.term,
            value: e.count,
            color: e.count > 1500 ? t.s1 : e.count > 400 ? t.s3 : t.s4,
          }))}
          labelWidth="120px"
          onSelect={(d) => setDrill({ facet: "signal", value: d.label, title: `"${d.label}" in the corpus` })}
        />
      </Panel>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4} mb={4}>
        <Panel title="Violation register" sub="observed · ruled out" accent={t.s2} fill>
          <SplitBarList
            data={pick(VIOLATIONS)}
            labelWidth="115px"
            onSelect={(d) => setDrill({ facet: "signal", value: d.label, title: `"${d.label}" in the corpus` })}
          />
        </Panel>
        <Panel title="Hazard & incident register" sub="observed · ruled out" accent={t.s4} fill>
          <SplitBarList
            data={pick(HAZARDS)}
            labelWidth="115px"
            onSelect={(d) => setDrill({ facet: "signal", value: d.label, title: `"${d.label}" in the corpus` })}
          />
        </Panel>
      </SimpleGrid>


      <Panel title="Vehicle mix by site" sub="share of vehicle mentions" accent={t.s3} mt={4}>
        <Flex direction="column" gap={2}>
          {sites.slice(0, 8).map((s) => (
            <Flex key={s.location} align="center" gap={2.5}>
              <Text
                fontSize="11.5px"
                color={t.body}
                w="150px"
                flexShrink={0}
                noOfLines={1}
                title={s.location}
                as="button"
                textAlign="left"
                cursor="pointer"
                _hover={{ textDecoration: "underline" }}
                onClick={() => setDrill({ facet: "site", value: s.location, title: s.location })}
              >
                {s.location}
              </Text>
              <Flex flex="1" h="9px" bg={t.track} borderRadius="5px" overflow="hidden" gap="2px" minW={0}>
                {s.mixPct.map((share, i) => (
                  <Box
                    key={i}
                    h="100%"
                    w={`${share}%`}
                    bg={[t.s1, t.s2, t.s3, t.s4][i]}
                    title={`${s.location} — ${MIX_NAMES[i]} ${share}% · click to open`}
                    cursor="pointer"
                    onClick={() => setDrill({ facet: "signal", value: MIX_NAMES[i], title: `"${MIX_NAMES[i]}" in the corpus` })}
                  />
                ))}
              </Flex>
              <Text fontFamily={MONO_FONT} fontSize="11.5px" color={t.muted} w="52px" textAlign="right">
                100%
              </Text>
            </Flex>
          ))}
        </Flex>
        <Legend items={MIX_NAMES.map((n, i) => ({ label: n, color: [t.s1, t.s2, t.s3, t.s4][i] }))} />
      </Panel>

      <DrillDrawer drill={drill} onClose={() => setDrill(null)} baseUrl={baseUrl} />
    </Box>
  );
};

export default CorridorAnalytics;
