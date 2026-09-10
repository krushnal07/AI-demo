// src/components/MarkdownMessage.js
// Renders the assistant's markdown subset as Chakra elements, so replies show
// real headings and bullets instead of raw "#" and "*" characters.
import React from "react";
import { Box, Text, Divider } from "@chakra-ui/react";
import { parseBlocks } from "../utils/markdown";

const HEADING_SIZE = { 1: "15px", 2: "14px", 3: "13px" };

const Spans = ({ spans }) => (
  <>
    {spans.map((span, i) =>
      span.bold ? (
        <Text as="span" key={i} fontWeight="700">
          {span.text}
        </Text>
      ) : (
        <React.Fragment key={i}>{span.text}</React.Fragment>
      )
    )}
  </>
);

const MarkdownMessage = ({ text }) => {
  const blocks = parseBlocks(text);

  // nothing markdown-ish to do -- render as-is so no content is ever lost
  if (!blocks.length) return <>{text}</>;

  return (
    <Box>
      {blocks.map((block, index) => {
        if (block.type === "rule") {
          return <Divider key={index} my={2} opacity={0.4} />;
        }

        if (block.type === "heading") {
          return (
            <Text
              key={index}
              fontSize={HEADING_SIZE[block.level] || "13px"}
              fontWeight="700"
              mt={index === 0 ? 0 : 3}
              mb={1.5}
            >
              <Spans spans={block.spans} />
            </Text>
          );
        }

        if (block.type === "list") {
          return (
            <Box key={index} mt={index === 0 ? 0 : 1.5} mb={1.5}>
              {block.items.map((item, i) => (
                <Box key={i} display="flex" alignItems="flex-start" gap={2} mb={0.5}>
                  <Box as="span" flexShrink={0} lineHeight="1.5" opacity={0.7}>
                    •
                  </Box>
                  <Box as="span" flex={1}>
                    <Spans spans={item} />
                  </Box>
                </Box>
              ))}
            </Box>
          );
        }

        return (
          <Text key={index} mt={index === 0 ? 0 : 2} whiteSpace="pre-wrap">
            <Spans spans={block.spans} />
          </Text>
        );
      })}
    </Box>
  );
};

export default MarkdownMessage;
