import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaShieldAlt, FaSearch, FaSyncAlt } from "react-icons/fa";
import {
  Box,
  Flex,
  Text,
  Input,
  Button,
  Badge,
  Spinner,
  SimpleGrid,
} from "@chakra-ui/react";
import DrillDrawer from "../components/intel/DrillDrawer";
import {
  Panel,
  StatTile,
  Insight,
  BarList,
  SplitBarList,
  SectionLabel,
  useIntelTheme,
  MONO_FONT,
} from "../components/intel/IntelKit";

const GROUP_ORDER = ["Traffic offence", "Hazard", "Person behaviour", "Property & weapon", "Incident", "Response"];

const CrimeIntelligence = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [drill, setDrill] = useState(null);
  const [term, setTerm] = useState("loiter");
  const [concordance, setConcordance] = useState(null);
  const [searching, setSearching] = useState(false);

  const navigate = useNavigate();
  const registerRef = React.useRef(null);
  const t = useIntelTheme();
  const pageBg = t.page;
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
        setError(err.response?.data?.message || err.message || "Could not load intelligence summary.");
      } finally {
        setLoading(false);
      }
    },
    [baseUrl]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const runConcordance = useCallback(
    async (value) => {
      const q = (value ?? term).trim();
      if (!q) return;
      setSearching(true);
      try {
        const { data: body } = await axios.get(
          `${baseUrl}/api/ai-alerts/intel/concordance?term=${encodeURIComponent(q)}&limit=12`
        );
        if (body?.success) setConcordance(body);
      } catch (err) {
        setConcordance(null);
      } finally {
        setSearching(false);
      }
    },
    [baseUrl, term]
  );

  useEffect(() => {
    if (data) runConcordance("loiter");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  /* ---- derived views ---- */
  const neverNegated = useMemo(
    () => (data?.register || []).filter((r) => r.negated === 0 && r.total > 0).sort((a, b) => b.net - a.net),
    [data]
  );
  const mostDiscounted = useMemo(
    () =>
      (data?.register || [])
        .filter((r) => r.total >= 20)
        .map((r) => ({ ...r, share: r.negated / r.total }))
        .sort((a, b) => b.share - a.share)
        .slice(0, 3),
    [data]
  );
  const suspicious = useMemo(
    () =>
      (data?.register || [])
        .filter((r) => ["Person behaviour", "Property & weapon"].includes(r.group))
        .sort((a, b) => b.net - a.net),
    [data]
  );

  if (loading && !data) {
    return (
      <Flex bg={pageBg} minH="100vh" align="center" justify="center" direction="column" gap={3}>
        <Spinner size="lg" color={t.s1} />
        <Text fontSize="13px" color={t.muted}>
          Scanning the description corpus&hellip;
        </Text>
      </Flex>
    );
  }

  if (error) {
    return (
      <Box bg={pageBg} minH="100vh" p={6}>
        <Panel title="Could not load">
          <Text fontSize="13px" color={t.critical}>
            {error}
          </Text>
          <Button mt={3} size="sm" onClick={() => load(false)}>
            Retry
          </Button>
        </Panel>
      </Box>
    );
  }

  const { totals, registerGroups, sections, vocabulary } = data;
  const vocabMax = vocabulary[0]?.count || 1;
  const worst = mostDiscounted[0];

  return (
    <Box bg={pageBg} minH="100vh" pt={{ base: "70px", md: 4 }} pb={{ base: "100px", md: 8 }} px={{ base: 3, md: 6 }}>
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
        <Box position="absolute" top={0} left={0} right={0} h="3px" bgGradient={`linear(to-r, ${t.s1}, ${t.s5}, ${t.s2})`} />
        <Flex align="center" gap={3.5} wrap="wrap">
          <Flex
            align="center"
            justify="center"
            boxSize="38px"
            borderRadius="10px"
            bg={`${t.s1}1A`}
            color={t.s1}
            fontSize="17px"
            flexShrink={0}
          >
            <FaShieldAlt />
          </Flex>
          <Box minW={0}>
            <Text fontSize={{ base: "20px", md: "23px" }} fontWeight="800" color={t.heading} letterSpacing="-0.025em" lineHeight="1.15">
              Crime Intelligence
            </Text>
            <Text fontSize="12.5px" color={t.body} mt={0.5}>
              Every figure counts observations, not keyword matches &mdash; click any of them to read the records.
            </Text>
          </Box>
          <Flex ml="auto" align="center" gap={2.5} flexShrink={0}>
            <Badge
              bg={`${t.s1}1A`}
              color={t.s1}
              borderRadius="full"
              px={2.5}
              py={1}
              fontSize="10px"
              fontWeight="600"
              textTransform="none"
            >
              negation-adjusted
            </Badge>
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

      <SectionLabel note="click a figure to open its records">At a glance</SectionLabel>
      <SimpleGrid columns={{ base: 2, md: 3, lg: 6 }} spacing={3.5} mb={5}>
        <StatTile
          label="Segments"
          value={totals.segments.toLocaleString()}
          note="described scenes"
          onClick={() => setDrill({ facet: "segments", title: "All described segments" })}
        />
        <StatTile
          label="Signals tracked"
          value={totals.signals}
          note="issue types"
          onClick={() => registerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />
        <StatTile
          label="Flagged"
          value={totals.flagged.toLocaleString()}
          note={`${totals.flagRate}% of corpus`}
          color={t.critical}
          onClick={() => setDrill({ facet: "flagged", title: "Segments with an anomaly note" })}
        />
        <StatTile
          label="Night segments"
          value={totals.night.toLocaleString()}
          note="21:00–04:00"
          onClick={() => setDrill({ facet: "night", title: "Segments recorded 21:00–04:00" })}
        />
        <StatTile
          label="Sites"
          value={totals.sites}
          note="camera locations"
          onClick={() => navigate("/corridor-analytics")}
        />
        <StatTile
          label="Plate reads"
          value={totals.plates}
          note="ANPR"
          onClick={() => setDrill({ facet: "plates", title: "Segments carrying a plate read" })}
        />
      </SimpleGrid>

      <SectionLabel>What the corpus is telling you</SectionLabel>
      <Flex direction="column" gap={3} mb={2}>
        {worst && (
          <Insight
            tone="crit"
            kicker={"READ\nFIRST"}
            title={`Raw keyword counts overstate incidents — "${worst.term}" matches ${worst.total} documents but only ${worst.net} describe one.`}
            source="negation window of 45 characters before each match"
            onClick={() => setDrill({ facet: "signal", value: worst.term, title: `"${worst.term}" in the corpus` })}
          >
            The other {worst.negated} read as clearances &mdash; &ldquo;no visible incidents or accidents&rdquo;. Every
            figure on this page counts observations, not matches. A search that counts matches will brief the wrong
            number upward.
          </Insight>
        )}
        {neverNegated.length > 0 && (
          <Insight
            tone="warn"
            kicker={"HIGH\nTRUST"}
            title={`${neverNegated.length} signals are never negated — treat each as a real sighting.`}
            source={`${neverNegated.reduce((n, r) => n + r.net, 0)} documents worth manual review`}
            onClick={() =>
              setDrill({
                facet: "signal",
                value: neverNegated[0].term,
                title: `"${neverNegated[0].term}" — never negated`,
              })
            }
          >
            {neverNegated
              .slice(0, 5)
              .map((r) => `${r.term} (${r.net})`)
              .join(", ")}{" "}
            carry zero negated mentions. Small counts, but every one is an affirmative observation rather than a
            clearance.
          </Insight>
        )}
      </Flex>

      <SectionLabel note="observed after negation">Issue register</SectionLabel>
      <SimpleGrid columns={{ base: 1, lg: 4 }} spacing={3.5} mb={4}>
        {GROUP_ORDER.filter((g) => registerGroups.some((x) => x.group === g))
          .slice(0, 4)
          .map((g, i) => {
            const grp = registerGroups.find((x) => x.group === g);
            const colour = [t.s2, t.s4, t.s5, t.critical][i];
            return (
              <StatTile
                key={g}
                label={g}
                value={grp.net}
                note={`observed of ${grp.total} mentions`}
                color={colour}
                onClick={() => setDrill({ facet: "group", value: g, title: g, state: "observed" })}
              />
            );
          })}
      </SimpleGrid>

      <Box ref={registerRef} />
      <SectionLabel note="the written summary as evidence">Description intelligence</SectionLabel>

      <Panel title="Corpus vocabulary" sub="size = frequency · click to search" accent={t.s1} mb={4}>
        <Flex wrap="wrap" gap="6px 12px" align="baseline">
          {vocabulary.map((v) => (
            <Text
              key={v.term}
              as="button"
              fontWeight="600"
              lineHeight="1.25"
              color={v.count > vocabMax * 0.55 ? t.heading : t.body}
              fontSize={`${(12 + (v.count / vocabMax) * 16).toFixed(1)}px`}
              title={`${v.term} — ${v.count.toLocaleString()} occurrences · click to search`}
              onClick={() => { setTerm(v.term); runConcordance(v.term); }}
              cursor="pointer"
              _hover={{ textDecoration: "underline" }}
              _focusVisible={{ outline: "2px solid", outlineColor: t.s1, outlineOffset: "2px", borderRadius: "3px" }}
            >
              {v.term}
              <Box as="sup" fontFamily={MONO_FONT} fontSize="9px" fontWeight="400" color={t.muted} ml="2px">
                {v.count.toLocaleString()}
              </Box>
            </Text>
          ))}
        </Flex>
      </Panel>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4} mb={4} alignItems="stretch">
        <Panel title="Suspicious-term register" sub="observed after negation" accent={t.s5} fill>
          <SplitBarList
            data={suspicious.map((r) => ({ label: r.term, net: r.net, negated: r.negated }))}
            labelWidth="115px"
            onSelect={(d) => setDrill({ facet: "signal", value: d.label, title: `"${d.label}" in the corpus` })}
          />
        </Panel>
        <Panel title="Section coverage" sub="documents containing header" accent={t.s3} fill>
          <BarList
            data={sections.map((s, i) => ({
              label: s.term,
              value: s.count,
              color: i < 5 ? t.s1 : t.s5,
            }))}
            labelWidth="150px"
            onSelect={(d) => setDrill({ facet: "section", value: d.label, title: `Documents with "${d.label}"` })}
          />
          <Text fontSize="11.5px" color={t.muted} mt="auto" pt={4}>
            Two describer generations coexist &mdash; the long tail uses numbered prose sections instead of
            <Box as="span" fontFamily={MONO_FONT}> VEHICLES:/PEOPLE:</Box>. A single parser silently drops one.
          </Text>
        </Panel>
      </SimpleGrid>

      <Box>
        <Panel
          accent={t.s4}
          title="Concordance"
          sub={concordance ? `${concordance.observed} observed of ${concordance.count} shown` : "search the corpus"}
        >
          <Flex gap={2} mb={3}>
            <Input
              size="sm"
              borderRadius="8px"
              placeholder="e.g. loiter, snatch, abandoned"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runConcordance();
              }}
            />
            <Button size="sm" colorScheme="blue" leftIcon={<FaSearch />} onClick={() => runConcordance()} isLoading={searching}>
              Search
            </Button>
          </Flex>

          {!concordance || concordance.hits.length === 0 ? (
            <Text fontSize="12px" color={t.muted}>
              No occurrences of that term.
            </Text>
          ) : (
            <Flex direction="column" maxH="340px" overflowY="auto" pr={1}>
              {concordance.hits.map((h, i) => (
                <Box
                  key={i}
                  py={2}
                  borderTop={i ? "1px solid" : "none"}
                  borderColor={t.border}
                  role="button"
                  tabIndex={0}
                  cursor="pointer"
                  borderRadius="4px"
                  _hover={{ bg: t.panelAlt }}
                  _focusVisible={{ outline: "2px solid", outlineColor: t.s1, outlineOffset: "1px" }}
                  onClick={() => setDrill({ facet: "signal", value: concordance.term, title: `"${concordance.term}" in the corpus` })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDrill({ facet: "signal", value: concordance.term, title: `"${concordance.term}" in the corpus` });
                    }
                  }}
                >
                  <Text fontSize="12px" color={t.body}>
                    &hellip;{h.before}
                    <Box as="span" fontWeight="700" color={t.heading} bg={t.panelAlt} px="2px">
                      {h.match}
                    </Box>
                    {h.after}&hellip;
                  </Text>
                  <Flex gap={2} mt={1} align="center">
                    <Text fontFamily={MONO_FONT} fontSize="10px" color={t.muted}>
                      {h.location}
                    </Text>
                    <Badge
                      colorScheme={h.negated ? "gray" : "orange"}
                      fontSize="9px"
                      borderRadius="full"
                      px={2}
                      textTransform="none"
                    >
                      {h.negated ? "ruled out" : "observed"}
                    </Badge>
                  </Flex>
                </Box>
              ))}
            </Flex>
          )}
          <Text fontSize="11.5px" color={t.muted} mt={3}>
            Concordance is the control: it shows the sentence, so a reader judges rather than a counter.
          </Text>
        </Panel>
      </Box>

      <DrillDrawer drill={drill} onClose={() => setDrill(null)} baseUrl={baseUrl} />
    </Box>
  );
};

export default CrimeIntelligence;
