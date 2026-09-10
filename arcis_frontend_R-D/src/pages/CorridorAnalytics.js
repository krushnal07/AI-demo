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
} from "@chakra-ui/react";
import DrillDrawer from "../components/intel/DrillDrawer";
import GujaratMap from "../components/intel/GujaratMap";
import {
  Panel,
  StatTile,
  Insight,
  BarList,
  HourColumns,
  SectionLabel,
  useIntelTheme,
  MONO_FONT,
} from "../components/intel/IntelKit";

const CorridorAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drill, setDrill] = useState(null);

  const t = useIntelTheme();
  const baseUrl = process.env.REACT_APP_BASE_URL || process.env.REACT_APP_URL;

  const severityColour = useMemo(
    () => ({ critical: t.critical, high: t.s2, medium: t.s4, watch: t.s1 }),
    [t]
  );

  const load = useCallback(
    async (refresh) => {
      setLoading(true);
      setError(null);
      try {
        const { data: body } = await axios.get(
          `${baseUrl}/api/ai-alerts/intel/summary${refresh ? "?refresh=1" : ""}`
        );
        if (!body?.success) throw new Error(body?.message || "Request failed");
        setData(body);
      } catch (err) {
        setError(err.response?.data?.message || err.message || "Could not load the corridor view.");
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
  const register = data?.register || [];

  /* the map wants sighting-shaped rows; give it one per site carrying violations */
  const violationMarkers = useMemo(
    () =>
      sites
        .filter((s) => s.violations > 0 && s.lat != null)
        .flatMap((s) => Array.from({ length: s.violations }, () => ({ location: s.location, id: s.location })))
        .slice(0, 4000),
    [sites]
  );

  const busiestHour = useMemo(() => {
    const hours = data?.violationHours || [];
    if (!hours.length) return null;
    const max = Math.max(...hours);
    return max > 0 ? { hour: hours.indexOf(max), n: max } : null;
  }, [data]);

  if (loading && !data) {
    return (
      <Flex bg={t.page} minH="100vh" align="center" justify="center" direction="column" gap={3}>
        <Spinner size="lg" color={t.s1} />
        <Text fontSize="13px" color={t.muted}>Building corridor position&hellip;</Text>
      </Flex>
    );
  }

  if (error) {
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
        <Panel title="Could not load">
          <Text fontSize="13px" color={t.critical}>{error}</Text>
          <Button
            mt={3}
            size="sm"
            bg={t.s1}
            color="white"
            borderRadius="8px"
            fontFamily="'Manrope', sans-serif"
            fontWeight="700"
            fontSize="12px"
            lineHeight="18px"
            letterSpacing="0px"
            textAlign="center"
            _hover={{ opacity: 0.9 }}
            onClick={() => load(false)}
          >
            Retry
          </Button>
        </Panel>
      </Box>
    );
  }

  const { totals } = data;
  const activeSites = sites.filter((s) => s.segments > 0);
  const withViolations = sites.filter((s) => s.violations > 0);

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
            color={t.heading}
          >
            Corridor Deployment
          </Text>
          <Text
            fontFamily="'Manrope', sans-serif"
            fontSize="13px"
            color={t.body}
            mt="2px"
          >
            Where traffic violations concentrate, and when &mdash; for siting a patrol
          </Text>
        </Box>
        <Flex align="center" gap={3} flexShrink={0} wrap="wrap">
          <Badge bg={`${t.s4}22`} color={t.warning} borderRadius="full" px={2.5} py={1} fontSize="10px" fontWeight="600" textTransform="none">
            coordinates approximate
          </Badge>
          <Button
            size="sm"
            variant="outline"
            borderColor={t.border}
            color={t.body}
            borderRadius="8px"
            fontFamily="'Manrope', sans-serif"
            fontWeight="700"
            fontSize="12px"
            lineHeight="18px"
            letterSpacing="0px"
            textAlign="center"
            leftIcon={<FaSyncAlt size={12} />}
            onClick={() => load(true)}
            isLoading={loading}
            _hover={{ borderColor: "#3F77A5", color: "#3F77A5" }}
          >
            Rebuild
          </Button>
        </Flex>
      </Flex>

      <SectionLabel note="click a figure to open its segments">Position</SectionLabel>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={3.5} mb={5}>
        <StatTile
          label="Active cameras"
          value={activeSites.length}
          note="producing described segments"
        />
        <StatTile
          label="Cameras with offences"
          value={withViolations.length}
          note={`of ${activeSites.length} active`}
          color={t.s2}
        />
        <StatTile
          label="Violation segments"
          value={totals.withViolation.toLocaleString()}
          note={`${totals.violationRate}% of ${totals.segments.toLocaleString()}`}
          color={t.critical}
          onClick={() => setDrill({ facet: "violations", title: "Segments with a reported violation" })}
        />
        <StatTile
          label="Peak hour"
          value={busiestHour ? `${String(busiestHour.hour).padStart(2, "0")}:00` : "—"}
          note={busiestHour ? `${busiestHour.n} violation segments` : "no pattern"}
          color={t.s4}
          onClick={() =>
            busiestHour &&
            setDrill({
              facet: "hour",
              value: busiestHour.hour,
              title: `Segments at ${String(busiestHour.hour).padStart(2, "0")}:00 UTC`,
            })
          }
        />
      </SimpleGrid>

      {/* findings */}
      <SectionLabel>Deployment notes</SectionLabel>
      <Flex direction="column" gap={3} mb={2}>
        {withViolations[0] && (
          <Insight
            tone="crit"
            kicker="PRIORITY"
            title={`${withViolations[0].label} carries ${withViolations[0].violations} violation segments — ${withViolations[0].rate}% of its output.`}
            source={`${withViolations[0].camera_id} · mostly ${withViolations[0].topOffence?.label.toLowerCase() || "—"}`}
            onClick={() =>
              setDrill({
                facet: "site",
                value: withViolations[0].location,
                only: "violations",
                title: `${withViolations[0].label} — violations`,
              })
            }
          >
            Highest-yield location for a standing enforcement point.
          </Insight>
        )}
        {activeSites.length < sites.length && (
          <Insight
            tone="warn"
            kicker="COVERAGE"
            title={`Only ${activeSites.length} camera${activeSites.length === 1 ? "" : "s"} are producing described segments.`}
            source="the rest have coordinates but no analysed footage"
          >
            Absence from this view means no coverage, not compliance. Treat unmonitored junctions as unknown
            rather than clean.
          </Insight>
        )}
      </Flex>

      {/* map */}
      <SectionLabel note="marker size = segment volume, filled = violations reported">Map</SectionLabel>
      <Panel accent={t.s1} mb={4}>
        <Box h={{ base: "300px", md: "420px", xl: "520px" }}>
          <GujaratMap sites={sites} sightings={violationMarkers} onSelect={() => {}} height="100%" />
        </Box>
      </Panel>

      {/* offences and timing */}
      <SectionLabel note="segments where the offence was affirmatively reported">Offence mix and timing</SectionLabel>
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4} mb={4} alignItems="stretch">
        <Panel title="Offences across the corridor" sub="click to open the segments" accent={t.s2} fill>
          <BarList
            data={register.map((o) => ({
              label: o.label,
              value: o.segments,
              color: severityColour[o.severity],
            }))}
            labelWidth="190px"
            onSelect={(d) => {
              const hit = register.find((o) => o.label === d.label);
              if (hit) setDrill({ facet: "offence", value: hit.key, title: hit.label });
            }}
          />
        </Panel>

        <Panel title="When violations happen" sub="UTC hour · click a column" accent={t.s4} fill>
          <HourColumns
            hours={data.violationHours || []}
            onSelect={(hour) =>
              setDrill({
                facet: "hour",
                value: hour,
                title: `Segments at ${String(hour).padStart(2, "0")}:00 UTC`,
              })
            }
          />
          <Text fontSize="11.5px" color={t.muted} mt="auto" pt={4}>
            Columns count segments carrying a violation, not total traffic &mdash; so this is when to deploy,
            not when the road is busiest.
          </Text>
        </Panel>
      </SimpleGrid>

      {/* per-camera table */}
      <SectionLabel note="click a row for that camera's violations">Camera detail</SectionLabel>
      <Panel accent={t.s3}>
        <TableContainer overflowX="auto">
          <Table size="sm" variant="simple">
            <Thead>
              <Tr borderBottom="1px solid" borderColor={t.border}>
                <Th fontSize="10px" color={t.muted} borderColor={t.border}>Camera site</Th>
                <Th fontSize="10px" color={t.muted} borderColor={t.border}>Device</Th>
                <Th fontSize="10px" color={t.muted} borderColor={t.border} isNumeric>Segments</Th>
                <Th fontSize="10px" color={t.muted} borderColor={t.border} isNumeric>Violations</Th>
                <Th fontSize="10px" color={t.muted} borderColor={t.border} isNumeric>Rate</Th>
                <Th fontSize="10px" color={t.muted} borderColor={t.border} isNumeric>Night</Th>
                <Th fontSize="10px" color={t.muted} borderColor={t.border}>Dominant offence</Th>
              </Tr>
            </Thead>
            <Tbody>
              {sites.map((s) => (
                <Tr
                  key={s.location}
                  borderBottom="1px solid"
                  borderColor={t.border}
                  _hover={{ bg: t.panelAlt }}
                  cursor="pointer"
                  onClick={() =>
                    setDrill({
                      facet: "site",
                      value: s.location,
                      only: s.violations ? "violations" : undefined,
                      title: s.violations ? `${s.label} — violations` : s.label,
                    })
                  }
                >
                  <Td fontSize="11.5px" color={t.body} borderColor={t.border}>{s.label}</Td>
                  <Td fontSize="10.5px" color={t.muted} fontFamily={MONO_FONT} borderColor={t.border}>{s.camera_id}</Td>
                  <Td fontSize="11.5px" color={t.body} isNumeric fontFamily={MONO_FONT} borderColor={t.border}>{s.segments.toLocaleString()}</Td>
                  <Td fontSize="11.5px" color={t.body} isNumeric fontFamily={MONO_FONT} borderColor={t.border}>{s.violations}</Td>
                  <Td fontSize="11.5px" color={t.body} isNumeric fontFamily={MONO_FONT} borderColor={t.border}>{s.rate}%</Td>
                  <Td fontSize="11.5px" color={t.body} isNumeric fontFamily={MONO_FONT} borderColor={t.border}>{s.night || "—"}</Td>
                  <Td borderColor={t.border}>
                    {s.topOffence ? (
                      <Badge
                        colorScheme={
                          { critical: "red", high: "orange", medium: "yellow", watch: "blue" }[
                            register.find((o) => o.key === s.topOffence.key)?.severity
                          ] || "gray"
                        }
                        fontSize="9px"
                        borderRadius="full"
                        px={2}
                        textTransform="none"
                      >
                        {s.topOffence.label} ({s.topOffence.n})
                      </Badge>
                    ) : (
                      <Text fontSize="11px" color={t.muted}>nothing reported</Text>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      </Panel>

      <DrillDrawer drill={drill} onClose={() => setDrill(null)} baseUrl={baseUrl} />
    </Box>
  );
};

export default CorridorAnalytics;
