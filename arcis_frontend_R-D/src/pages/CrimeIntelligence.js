import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaShieldAlt, FaSyncAlt, FaExclamationTriangle } from "react-icons/fa";
import { Box, Flex, Text, Button, Badge, Spinner, SimpleGrid } from "@chakra-ui/react";
import DrillDrawer from "../components/intel/DrillDrawer";
import { Panel, StatTile, Insight, BarList, SectionLabel, useIntelTheme, MONO_FONT } from "../components/intel/IntelKit";

const SEVERITY_LABEL = {
  critical: "Danger to life",
  high: "Chargeable offence",
  medium: "Obstruction / rule breach",
  watch: "Context only",
};

const CrimeIntelligence = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [drill, setDrill] = useState(null);

  const navigate = useNavigate();
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
        setError(err.response?.data?.message || err.message || "Could not load the offence register.");
      } finally {
        setLoading(false);
      }
    },
    [baseUrl]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const grouped = useMemo(() => {
    const out = { critical: [], high: [], medium: [], watch: [] };
    (data?.register || []).forEach((o) => out[o.severity]?.push(o));
    return out;
  }, [data]);

  const topOffence = data?.register?.find((o) => o.severity === "high") || data?.register?.[0];
  const worstSite = data?.sites?.[0];
  const quietSite = useMemo(
    () => (data?.sites || []).filter((s) => s.segments >= 50 && s.violations === 0),
    [data]
  );

  if (loading && !data) {
    return (
      <Flex bg={t.page} minH="100vh" align="center" justify="center" direction="column" gap={3}>
        <Spinner size="lg" color={t.s1} />
        <Text fontSize="13px" color={t.muted}>Classifying traffic violations&hellip;</Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Box bg={t.page} minH="100vh" p={6}>
        <Panel title="Could not load">
          <Text fontSize="13px" color={t.critical}>{error}</Text>
          <Button mt={3} size="sm" onClick={() => load(false)}>Retry</Button>
        </Panel>
      </Box>
    );
  }

  const { totals, register, sites } = data;

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
        <Box position="absolute" top={0} left={0} right={0} h="3px" bgGradient={`linear(to-r, ${t.critical}, ${t.s2}, ${t.s4})`} />
        <Flex align="center" gap={3.5} wrap="wrap">
          <Flex align="center" justify="center" boxSize="38px" borderRadius="10px" bg={`${t.s2}1A`} color={t.s2} fontSize="17px" flexShrink={0}>
            <FaShieldAlt />
          </Flex>
          <Box minW={0}>
            <Text fontSize={{ base: "20px", md: "23px" }} fontWeight="800" color={t.heading} letterSpacing="-0.025em" lineHeight="1.15">
              Traffic Offence Register
            </Text>
            <Text fontSize="12.5px" color={t.body} mt={0.5}>
              Offences the describer actually reported &mdash; click any figure to read the evidence.
            </Text>
          </Box>
          <Flex ml="auto" align="center" gap={2.5} flexShrink={0}>
            <Text fontSize="10.5px" color={t.muted} fontFamily={MONO_FONT} display={{ base: "none", md: "block" }}>
              {data.cached ? "cached" : "rebuilt"} &middot; {new Date(data.generatedAt).toLocaleTimeString()}
            </Text>
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

      {/* the numbers that matter to a duty officer */}
      <SectionLabel note="click a figure to open its segments">Enforcement position</SectionLabel>
      <SimpleGrid columns={{ base: 2, md: 3, lg: 5 }} spacing={3.5} mb={5}>
        <StatTile
          label="Segments reviewed"
          value={totals.segments.toLocaleString()}
          note={`${totals.sites} active cameras`}
          onClick={() => setDrill({ facet: "segments", title: "All reviewed segments" })}
        />
        <StatTile
          label="Violation reported"
          value={totals.withViolation.toLocaleString()}
          note={`${totals.violationRate}% of segments`}
          color={t.s2}
          onClick={() => setDrill({ facet: "violations", title: "Segments with a reported violation" })}
        />
        <StatTile
          label="Chargeable"
          value={totals.chargeable.toLocaleString()}
          note="critical + high severity"
          color={t.critical}
          onClick={() => setDrill({ facet: "violations", title: "Segments with a reported violation" })}
        />
        <StatTile
          label="Notable events"
          value={totals.withNotable.toLocaleString()}
          note="near-miss, unsafe carriage"
          color={t.s4}
          onClick={() => setDrill({ facet: "notable", title: "Segments with a notable event" })}
        />
        <StatTile
          label="Plates readable"
          value={totals.plateLegible}
          note={`of ${totals.plateAttempted} attempted`}
          color={totals.plateLegible === 0 ? t.critical : t.good}
          onClick={() => setDrill({ facet: "plates", title: "Segments with a readable registration" })}
        />
      </SimpleGrid>

      {/* findings */}
      <SectionLabel>What needs attention</SectionLabel>
      <Flex direction="column" gap={3} mb={2}>
        {totals.plateLegible === 0 && (
          <Insight
            tone="crit"
            kicker={"NO\nEVIDENCE"}
            title="Not one registration number was readable across the whole corpus."
            source={`${totals.plateAttempted} attempt${totals.plateAttempted === 1 ? "" : "s"} recorded in "REGISTRATIONS READ"`}
          >
            Every violation below is observable but <strong>unattributable</strong> &mdash; there is no plate to
            issue a notice against. Until plate capture works, this register supports deployment decisions and
            camera siting, not prosecutions.
          </Insight>
        )}
        {totals.plateAttempted > totals.plateLegible && (
          <Insight
            tone="warn"
            kicker={"PLATE\nQUALITY"}
            title={`${totals.plateAttempted - totals.plateLegible} of ${totals.plateAttempted} registration reads were not legible.`}
            source="segments where a plate was attempted but could not be resolved"
            onClick={() =>
              setDrill({
                facet: "plates",
                only: "unreadable",
                title: "Registrations attempted but not legible",
              })
            }
          >
            Those segments show an offence with no attributable vehicle. Camera angle, resolution or lighting
            is the limiting factor on whether any of this becomes a notice.
          </Insight>
        )}
        {topOffence && (
          <Insight
            tone="warn"
            kicker="VOLUME"
            title={`${topOffence.label} is the dominant chargeable offence — ${topOffence.segments} segments.`}
            source={`across ${topOffence.sites} of ${totals.sites} cameras`}
            onClick={() => setDrill({ facet: "offence", value: topOffence.key, title: topOffence.label })}
          >
            Highest-yield target for a standing enforcement action.
          </Insight>
        )}
        {worstSite && (
          <Insight
            tone="info"
            kicker="HOTSPOT"
            title={`${worstSite.label} reports a violation in ${worstSite.rate}% of its segments.`}
            source={`${worstSite.camera_id} · ${worstSite.violations} of ${worstSite.segments.toLocaleString()}`}
            onClick={() => setDrill({ facet: "site", value: worstSite.location, only: "violations", title: `${worstSite.label} — violations` })}
          >
            Most common there: {worstSite.topOffence ? worstSite.topOffence.label.toLowerCase() : "—"}.
          </Insight>
        )}
        {quietSite.length > 0 && (
          <Insight
            tone="good"
            kicker="CHECK"
            title={`${quietSite.map((s) => s.label).join(", ")} reported no violations at all.`}
            source={`${quietSite.reduce((n, s) => n + s.segments, 0)} segments reviewed`}
            onClick={() => setDrill({ facet: "site", value: quietSite[0].location, title: quietSite[0].label })}
          >
            Either genuinely compliant, or the camera angle cannot evidence an offence. Worth confirming before
            it is read as clean.
          </Insight>
        )}
      </Flex>

      {/* the register, grouped by what an officer can do about it */}
      <SectionLabel note="segments where the offence was affirmatively reported">Offence register</SectionLabel>
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4} mb={4} alignItems="stretch">
        {["critical", "high", "medium", "watch"]
          .filter((sev) => grouped[sev].length)
          .map((sev) => (
            <Panel key={sev} title={SEVERITY_LABEL[sev]} sub={`${grouped[sev].length} categories`} accent={severityColour[sev]} fill>
              <BarList
                data={grouped[sev].map((o) => ({ label: o.label, value: o.segments, color: severityColour[sev] }))}
                max={Math.max(...register.map((o) => o.segments))}
                labelWidth="190px"
                onSelect={(d) => {
                  const hit = register.find((o) => o.label === d.label);
                  if (hit) setDrill({ facet: "offence", value: hit.key, title: hit.label });
                }}
              />
            </Panel>
          ))}
      </SimpleGrid>

      {/* per-camera */}
      <SectionLabel note="click a row for that camera's violations">By camera</SectionLabel>
      <Panel accent={t.s1}>
        <Flex direction="column" gap={2}>
          {sites.map((s) => (
            <Flex
              key={s.location}
              align="center"
              gap={3}
              py={2}
              px={2}
              mx={-2}
              borderRadius="7px"
              cursor="pointer"
              _hover={{ bg: t.panelAlt }}
              onClick={() => setDrill({ facet: "site", value: s.location, only: "violations", title: `${s.label} — violations` })}
            >
              <Box minW={0} flex="1">
                <Flex align="center" gap={2} wrap="wrap">
                  <Text fontSize="13px" fontWeight="600" color={t.heading}>{s.label}</Text>
                  <Text fontFamily={MONO_FONT} fontSize="10.5px" color={t.muted}>{s.camera_id}</Text>
                  {s.violations === 0 && (
                    <Badge colorScheme="gray" fontSize="9px" borderRadius="full" px={2} textTransform="none">
                      nothing reported
                    </Badge>
                  )}
                </Flex>
                <Text fontSize="11.5px" color={t.body} mt={0.5}>
                  {s.violations} of {s.segments.toLocaleString()} segments
                  {s.topOffence ? ` · mostly ${s.topOffence.label.toLowerCase()} (${s.topOffence.n})` : ""}
                </Text>
              </Box>
              <Box w="120px" flexShrink={0}>
                <Box h="10px" bg={t.track} borderRadius="6px" overflow="hidden">
                  <Box
                    h="100%"
                    borderRadius="6px"
                    w={`${Math.max(1.5, s.rate)}%`}
                    bg={s.rate >= 30 ? t.critical : s.rate >= 15 ? t.s4 : t.s3}
                  />
                </Box>
              </Box>
              <Text
                fontFamily={MONO_FONT}
                fontSize="12px"
                fontWeight="700"
                color={t.heading}
                w="52px"
                textAlign="right"
              >
                {s.rate}%
              </Text>
            </Flex>
          ))}
        </Flex>
        <Flex align="center" gap={2} mt={4} pt={3} borderTop="1px solid" borderColor={t.border}>
          <Box color={t.s4} fontSize="11px"><FaExclamationTriangle /></Box>
          <Text fontSize="11.5px" color={t.muted}>
            Only {totals.sites} cameras are producing described segments. Coverage, not compliance, explains a
            camera missing from this list.
          </Text>
        </Flex>
        <Button mt={3} size="xs" variant="outline" borderColor={t.border} onClick={() => navigate("/corridor-analytics")}>
          Open corridor view
        </Button>
      </Panel>

      <DrillDrawer drill={drill} onClose={() => setDrill(null)} baseUrl={baseUrl} />
    </Box>
  );
};

export default CrimeIntelligence;
