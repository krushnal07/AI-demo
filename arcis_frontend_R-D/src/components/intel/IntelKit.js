// src/components/intel/IntelKit.js
// Shared pieces for the two crime-intelligence consoles. The series colours are
// the validated categorical slots - separation checked for colour-vision
// deficiency against both the light and dark chart surfaces.
import React from "react";
import { Box, Flex, Text, Badge, Tooltip, useColorModeValue } from "@chakra-ui/react";

export const useIntelTheme = () => ({
  page: useColorModeValue("#F4F6F9", "#0E1319"),
  panel: useColorModeValue("#FFFFFF", "#161C24"),
  panelAlt: useColorModeValue("#F7F9FC", "#1C232C"),
  border: useColorModeValue("#E4E9F0", "#242C36"),
  borderStrong: useColorModeValue("#D3DBE6", "#2E3844"),
  shadow: useColorModeValue(
    "0 1px 2px rgba(16,24,40,.04), 0 8px 20px -8px rgba(16,24,40,.10)",
    "0 1px 2px rgba(0,0,0,.4), 0 12px 28px -12px rgba(0,0,0,.6)"
  ),
  heading: useColorModeValue("#0F172A", "#F1F5F9"),
  body: useColorModeValue("#475569", "#B6C2D1"),
  muted: useColorModeValue("#7C8AA0", "#75828F"),
  track: useColorModeValue("#EEF2F7", "#232B35"),
  // validated categorical slots 1-6
  s1: useColorModeValue("#2a78d6", "#3987e5"),
  s2: useColorModeValue("#eb6834", "#d95926"),
  s3: useColorModeValue("#1baf7a", "#199e70"),
  s4: useColorModeValue("#eda100", "#c98500"),
  s5: useColorModeValue("#e87ba4", "#d55181"),
  s6: "#008300",
  good: "#0ca30c",
  warning: useColorModeValue("#8a6200", "#fab219"),
  critical: "#d03b3b",
});

const MONO = '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

/** Small-caps rule used to separate groups of panels. */
export const SectionLabel = ({ children, note }) => {
  const t = useIntelTheme();
  return (
    <Flex align="center" gap={3} mt={8} mb={3}>
      <Text
        fontSize="11px"
        fontWeight="700"
        letterSpacing="0.13em"
        textTransform="uppercase"
        color={t.muted}
        whiteSpace="nowrap"
      >
        {children}
      </Text>
      <Box flex="1" h="1px" bg={t.border} />
      {note && (
        <Text fontSize="11px" color={t.muted} whiteSpace="nowrap">
          {note}
        </Text>
      )}
    </Flex>
  );
};

export const Panel = ({ title, sub, accent, fill, children, ...rest }) => {
  const t = useIntelTheme();
  return (
    <Box
      bg={t.panel}
      border="1px solid"
      borderColor={t.border}
      borderRadius="12px"
      boxShadow={t.shadow}
      p={{ base: 4, md: 5 }}
      minW={0}
      h={fill ? "100%" : undefined}
      display={fill ? "flex" : undefined}
      flexDirection={fill ? "column" : undefined}
      {...rest}
    >
      {(title || sub) && (
        <Flex align="center" gap={2.5} mb={4}>
          {accent && <Box w="3px" h="14px" borderRadius="2px" bg={accent} flexShrink={0} />}
          {title && (
            <Text fontSize="13.5px" fontWeight="700" color={t.heading} letterSpacing="-0.01em">
              {title}
            </Text>
          )}
          {sub && (
            <Text fontSize="11px" color={t.muted} ml="auto" whiteSpace="nowrap">
              {sub}
            </Text>
          )}
        </Flex>
      )}
      {fill ? (
        <Flex direction="column" flex="1" minH={0}>
          {children}
        </Flex>
      ) : (
        children
      )}
    </Box>
  );
};

export const StatTile = ({ label, value, note, color, onClick }) => {
  const t = useIntelTheme();
  const clickable = Boolean(onClick);
  const tone = color || t.heading;
  return (
    <Box
      as={clickable ? "button" : "div"}
      onClick={onClick}
      textAlign="left"
      w="100%"
      position="relative"
      overflow="hidden"
      bg={t.panel}
      border="1px solid"
      borderColor={t.border}
      borderRadius="12px"
      boxShadow={t.shadow}
      px={4}
      py={3.5}
      cursor={clickable ? "pointer" : "default"}
      transition="transform .18s ease, border-color .18s ease"
      _hover={clickable ? { borderColor: tone, transform: "translateY(-2px)" } : undefined}
      _focusVisible={clickable ? { outline: "2px solid", outlineColor: tone, outlineOffset: "2px" } : undefined}
      title={clickable ? "Open the records behind this figure" : undefined}
      role="group"
    >
      {/* hairline in the tile's own colour, brightening on hover */}
      <Box
        position="absolute"
        top={0}
        left={0}
        right={0}
        h="2px"
        bg={tone}
        opacity={clickable ? 0.35 : 0.2}
        transition="opacity .18s ease"
        _groupHover={clickable ? { opacity: 1 } : undefined}
      />
      <Text fontSize="10px" fontWeight="600" letterSpacing="0.08em" textTransform="uppercase" color={t.muted}>
        {label}
      </Text>
      <Text
        fontSize="26px"
        fontWeight="800"
        lineHeight="1.1"
        mt={1}
        color={tone}
        letterSpacing="-0.02em"
        sx={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </Text>
      {note && (
        <Text fontSize="11px" color={t.muted} mt={1}>
          {note}
        </Text>
      )}
    </Box>
  );
};

const TONE = { crit: "critical", warn: "warning", info: "s1", good: "good" };

/** The narrative layer: a finding, its evidence, and where it came from. */
export const Insight = ({ tone = "info", kicker, title, children, source, onClick }) => {
  const t = useIntelTheme();
  const accent = t[TONE[tone]] || t.s1;
  return (
    <Flex
      gap={3.5}
      bg={t.panel}
      border="1px solid"
      borderColor={t.border}
      borderLeft="3px solid"
      borderLeftColor={accent}
      borderRadius="10px"
      boxShadow={t.shadow}
      px={4}
      py={3.5}
      align="stretch"
      position="relative"
      overflow="hidden"
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      cursor={onClick ? "pointer" : "default"}
      transition="border-color .18s ease, transform .18s ease"
      _hover={onClick ? { borderColor: accent, transform: "translateX(2px)" } : undefined}
      _focusVisible={onClick ? { outline: "2px solid", outlineColor: accent, outlineOffset: "2px" } : undefined}
      title={onClick ? "Open the records behind this finding" : undefined}
    >
      {/* a whisper of the tone colour, so severity reads before the words do */}
      <Box position="absolute" inset={0} bg={accent} opacity={0.035} pointerEvents="none" />
      {kicker && (
        <Flex
          direction="column"
          justify="center"
          flexShrink={0}
          minW="48px"
          borderRight="1px solid"
          borderColor={t.border}
          pr={3}
          zIndex={1}
        >
          <Text
            fontFamily={MONO}
            fontSize="9.5px"
            fontWeight="700"
            letterSpacing="0.08em"
            color={accent}
            whiteSpace="pre-line"
            lineHeight="1.35"
          >
            {kicker}
          </Text>
        </Flex>
      )}
      <Box minW={0} zIndex={1}>
        <Text fontSize="13.5px" fontWeight="700" color={t.heading} lineHeight="1.45" letterSpacing="-0.01em">
          {title}
        </Text>
        {children && (
          <Text fontSize="12.5px" color={t.body} mt={1.5} lineHeight="1.6">
            {children}
          </Text>
        )}
        {source && (
          <Text fontFamily={MONO} fontSize="10px" color={t.muted} mt={2}>
            {source}
          </Text>
        )}
      </Box>
    </Flex>
  );
};

const rowProps = (t, onSelect, d) =>
  onSelect
    ? {
        role: "button",
        tabIndex: 0,
        cursor: "pointer",
        onClick: () => onSelect(d),
        onKeyDown: (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(d);
          }
        },
        _hover: { bg: t.panelAlt },
        _focusVisible: { outline: "2px solid", outlineColor: t.s1, outlineOffset: "1px" },
      }
    : {};

/** Plain horizontal bar list. `data` = [{ label, value, display?, color? }] */
export const BarList = ({ data, max, color, labelWidth = "120px", onSelect }) => {
  const t = useIntelTheme();
  const top = max || Math.max(1, ...data.map((d) => d.value));
  return (
    <Flex direction="column" gap={0.5}>
      {data.map((d) => {
        const bar = d.color || color || t.s1;
        return (
          <Flex
            key={d.label}
            align="center"
            gap={3}
            py={1.5}
            px={1.5}
            mx={-1.5}
            borderRadius="6px"
            transition="background .12s ease"
            {...rowProps(t, onSelect, d)}
          >
            <Text fontSize="11.5px" color={t.body} w={labelWidth} flexShrink={0} noOfLines={1} title={d.label}>
              {d.label}
            </Text>
            <Tooltip label={`${d.label} — ${d.display ?? d.value.toLocaleString()}`} hasArrow openDelay={200}>
              <Box flex="1" h="10px" bg={t.track} borderRadius="6px" overflow="hidden" minW={0}>
                <Box
                  h="100%"
                  borderRadius="6px"
                  w={`${Math.max(1.5, (d.value / top) * 100)}%`}
                  bgGradient={`linear(to-r, ${bar}, ${bar}CC)`}
                  transition="width .5s cubic-bezier(.22,1,.36,1)"
                />
              </Box>
            </Tooltip>
            <Text
              fontFamily={MONO}
              fontSize="11.5px"
              fontWeight="600"
              color={t.heading}
              w="54px"
              textAlign="right"
              sx={{ fontVariantNumeric: "tabular-nums" }}
            >
              {d.display ?? d.value.toLocaleString()}
            </Text>
          </Flex>
        );
      })}
    </Flex>
  );
};

/**
 * Observed vs ruled-out. A description saying "no accident occurred" still
 * contains the word, so the discounted portion is shown rather than hidden.
 * `data` = [{ label, net, negated }]
 */
export const SplitBarList = ({ data, max, labelWidth = "120px", onSelect }) => {
  const t = useIntelTheme();
  const top = max || Math.max(1, ...data.map((d) => d.net + d.negated));
  const toneFor = (net) => (net >= 60 ? t.s2 : net >= 25 ? t.s4 : t.s5);
  return (
    <Flex direction="column" gap={0.5}>
      {data.map((d) => {
        const tone = toneFor(d.net);
        return (
          <Flex
            key={d.label}
            align="center"
            gap={3}
            py={1.5}
            px={1.5}
            mx={-1.5}
            borderRadius="6px"
            transition="background .12s ease"
            {...rowProps(t, onSelect, d)}
          >
            <Text fontSize="11.5px" color={t.body} w={labelWidth} flexShrink={0} noOfLines={1} title={d.label}>
              {d.label}
            </Text>
            <Flex flex="1" h="10px" bg={t.track} borderRadius="6px" overflow="hidden" gap="2px" minW={0}>
              <Tooltip label={`${d.label} — ${d.net} observed`} hasArrow openDelay={200}>
                <Box
                  h="100%"
                  w={`${Math.max(1.5, (d.net / top) * 100)}%`}
                  bgGradient={`linear(to-r, ${tone}, ${tone}CC)`}
                  transition="width .5s cubic-bezier(.22,1,.36,1)"
                />
              </Tooltip>
              {d.negated > 0 && (
                <Tooltip label={`${d.label} — ${d.negated} ruled out by negation`} hasArrow openDelay={200}>
                  <Box
                    h="100%"
                    w={`${(d.negated / top) * 100}%`}
                    bg={t.track}
                    borderTop="1px dashed"
                    borderBottom="1px dashed"
                    borderColor={t.borderStrong}
                  />
                </Tooltip>
              )}
            </Flex>
            <Text
              fontFamily={MONO}
              fontSize="11.5px"
              fontWeight="600"
              color={t.heading}
              w="54px"
              textAlign="right"
              sx={{ fontVariantNumeric: "tabular-nums" }}
            >
              {d.net}
            </Text>
          </Flex>
        );
      })}
    </Flex>
  );
};

/** 24 hourly columns; the 21:00-04:00 window is emphasised. */
export const HourColumns = ({ hours, onSelect }) => {
  const t = useIntelTheme();
  const max = Math.max(1, ...hours);
  return (
    <Box>
      <Flex align="flex-end" gap="3px" h="112px">
        {hours.map((v, i) => {
          const night = i >= 21 || i <= 4;
          return (
            <Tooltip key={i} label={`${String(i).padStart(2, "0")}:00 — ${v} segments${night ? " (night)" : ""}`} hasArrow openDelay={150}>
              <Flex
                flex="1"
                minW={0}
                direction="column"
                justify="flex-end"
                h="100%"
                role={onSelect ? "button" : undefined}
                tabIndex={onSelect ? 0 : undefined}
                onClick={onSelect ? () => onSelect(i, v) : undefined}
                onKeyDown={onSelect ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(i, v); } } : undefined}
                cursor={onSelect ? "pointer" : "default"}
                _hover={onSelect ? { opacity: 0.75 } : undefined}
              >
                <Box
                  h={`${Math.max(1.5, (v / max) * 100)}%`}
                  borderTopRadius="4px"
                  bgGradient={night ? `linear(to-t, ${t.s2}, ${t.s2}DD)` : `linear(to-t, ${t.s1}88, ${t.s1}66)`}
                />
              </Flex>
            </Tooltip>
          );
        })}
      </Flex>
      <Flex gap="3px" mt={2}>
        {hours.map((_, i) => (
          <Text key={i} flex="1" textAlign="center" fontFamily={MONO} fontSize="9px" color={t.muted}>
            {i % 3 === 0 ? String(i).padStart(2, "0") : ""}
          </Text>
        ))}
      </Flex>
    </Box>
  );
};

export const Legend = ({ items }) => {
  const t = useIntelTheme();
  return (
    <Flex gap={4} wrap="wrap" mt={4} pt={3} borderTop="1px solid" borderColor={t.border}>
      {items.map((it) => (
        <Flex key={it.label} align="center" gap={1.5}>
          <Box boxSize="9px" borderRadius="2px" bg={it.color} flexShrink={0} />
          <Text fontSize="11px" color={t.body}>
            {it.label}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
};

export const RateBadge = ({ rate }) => {
  const scheme = rate >= 35 ? "red" : rate >= 15 ? "orange" : "green";
  const label = rate >= 35 ? "high" : rate >= 15 ? "elevated" : "low";
  return (
    <Badge colorScheme={scheme} fontSize="9px" borderRadius="full" px={2} py={0.5} textTransform="none" fontWeight="600">
      {label}
    </Badge>
  );
};

export const MONO_FONT = MONO;
