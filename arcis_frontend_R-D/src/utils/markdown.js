// The assistant answers in a small markdown subset: "# heading", "**bold**",
// "*   item" / "• item" bullets, "---" rules, and blank-line separated
// paragraphs. Parsing just that keeps replies readable without pulling in a
// full markdown dependency. Anything unrecognised falls through as plain text.

const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^\s*(?:[*-]\s+|•\s*)(.+)$/;
const RULE = /^\s*-{3,}\s*$/;

/**
 * Split a line into plain and bold runs.
 * "a **b** c" -> [{bold:false,text:"a "},{bold:true,text:"b"},{bold:false,text:" c"}]
 */
export const splitBold = (line) =>
  String(line)
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((part) => part !== "")
    .map((part) =>
      part.length > 4 && part.startsWith("**") && part.endsWith("**")
        ? { bold: true, text: part.slice(2, -2) }
        : { bold: false, text: part }
    );

/**
 * Turn markdown text into a flat list of blocks:
 *   { type: "heading", level, spans }
 *   { type: "list", items: [spans] }
 *   { type: "rule" }
 *   { type: "paragraph", spans }
 */
export const parseBlocks = (markdown) => {
  const blocks = [];
  if (!markdown) return blocks;

  const lines = String(markdown).replace(/\r\n/g, "\n").split("\n");
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push({ type: "paragraph", spans: splitBold(paragraph.join(" ")) });
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    blocks.push({ type: "list", items: list });
    list = null;
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushAll();
      continue;
    }

    if (RULE.test(line)) {
      flushAll();
      blocks.push({ type: "rule" });
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      flushAll();
      blocks.push({ type: "heading", level: heading[1].length, spans: splitBold(heading[2]) });
      continue;
    }

    const bullet = line.match(BULLET);
    if (bullet) {
      flushParagraph();
      if (!list) list = [];
      list.push(splitBold(bullet[1]));
      continue;
    }

    // a plain line ends any open list and joins the running paragraph
    flushList();
    paragraph.push(line.trim());
  }

  flushAll();
  return blocks;
};
