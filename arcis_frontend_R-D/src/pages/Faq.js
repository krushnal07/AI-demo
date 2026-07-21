import {
  Box,
  Flex,
  Heading,
  Text,
  Input,
  InputGroup,
  InputLeftElement,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Badge,
  VStack,
  HStack,
  Icon,
  useColorModeValue,
  UnorderedList,
  ListItem,
} from "@chakra-ui/react";
import React, { useMemo, useState } from "react";
import { MdSearch, MdHelpOutline } from "react-icons/md";
import {
  TbDeviceCctv,
  TbLayoutGrid,
  TbCpu,
  TbShieldLock,
  TbReportAnalytics,
  TbSettings,
} from "react-icons/tb";

// --- FAQ content -------------------------------------------------------------
// Each category groups related questions. Answers support plain strings and
// a { text, bullets } shape for step-by-step / list answers.
const FAQ_DATA = [
  {
    category: "Getting Started",
    icon: TbShieldLock,
    items: [
      {
        q: "What is this platform?",
        a: "This is the VMS (Video Management System) — a centralized dashboard to monitor live camera feeds, review AI-generated events and analytics, and manage your camera network. Access to each section depends on your assigned role (e.g. Master Admin, Admin, CEO, District/Assembly level).",
      },
      {
        q: "How do I log in, and why can't I see some menu items?",
        a: {
          text: "Log in with your registered email (or mobile number) and password on the login screen. The sidebar only shows the sections your role is permitted to use, so two users may see different menus. If you're missing a section you expect:",
          bullets: [
            "Confirm you're logged in with the correct account.",
            "Ask your administrator to verify your role permissions.",
            "Try logging out and back in to refresh your session.",
          ],
        },
      },
      {
        q: "How do I change my password?",
        a: "Open the account/profile menu in the header and choose Change Password, or use the 'Forgot Password' link on the login screen to receive a reset link by email. Passwords should be strong (mix of upper/lower case, numbers, and symbols).",
      },
    ],
  },
  {
    category: "Multi View & Live Monitoring",
    icon: TbDeviceCctv,
    items: [
      {
        q: "What does the Multi View page do?",
        a: "Multi View shows several live camera feeds at once in a grid. Online cameras are prioritized first, and you can page through all cameras you have access to. Each tile has quick controls for mute/unmute and per-camera fullscreen.",
      },
      {
        q: "How do I change the grid layout?",
        a: {
          text: "Use the grid selector in the top toolbar to pick how many feeds show per page:",
          bullets: [
            "2x2 — 4 cameras per page",
            "3x2 — 6 cameras per page",
            "3x3 — 9 cameras per page",
            "3x4 — 12 cameras per page",
          ],
        },
      },
      {
        q: "How does auto-refresh / auto-rotate work?",
        a: "The auto-refresh dropdown (Off / 45s / 60s) automatically advances to the next page of cameras on the chosen interval. It only rotates when there is more than one page. Set it to Off to stay on the current page.",
      },
      {
        q: "Can I view a single camera in fullscreen?",
        a: "Yes. Each tile has a fullscreen icon to expand just that camera, and there's a global fullscreen button to expand the whole grid. While in fullscreen you can still change the layout and switch pages using the on-screen controls.",
      },
      {
        q: "Why is a camera showing offline or not loading?",
        a: {
          text: "A red status dot means the camera is currently offline. Common causes:",
          bullets: [
            "The camera device has lost power or network connectivity.",
            "Temporary streaming server / proxy interruption — try refreshing.",
            "The camera stream URL or token has expired on the backend.",
          ],
        },
      },
      {
        q: "How do I search for a specific camera?",
        a: "Use the search box in the toolbar to filter by Camera ID, name, or operator. You can also narrow the list first by selecting a location from the location dropdown.",
      },
    ],
  },
  {
    category: "Camera Groups",
    icon: TbLayoutGrid,
    items: [
      {
        q: "What are Camera Groups?",
        a: "Camera Groups let you save a custom set of cameras under a name (for example 'Main Gate', 'Ward 5', or 'Highway Cams') so you can instantly view just those feeds in Multi View instead of paging through everything. Your groups are saved to your browser and remembered the next time you log in on that device.",
      },
      {
        q: "How do I create a group?",
        a: {
          text: "On the Multi View page, use the group bar below the filters:",
          bullets: [
            "Click 'Create Group'.",
            "Type a group name.",
            "Add cameras by clicking them in the 'Available Cameras' list, or by dragging and dropping them into the 'In this group' panel.",
            "Use the small live preview on each camera to confirm it's the right feed before adding it.",
            "Click 'Create Group' to save. The new group appears as a pill in the group bar.",
          ],
        },
      },
      {
        q: "How do I view, edit, or delete a group?",
        a: {
          text: "In the group bar at the top of Multi View:",
          bullets: [
            "Click a group's pill to view only that group's cameras in the grid.",
            "Click 'All Cameras' to return to the default full view.",
            "Use the pencil icon on a group pill to edit its name or cameras.",
            "Use the trash icon to delete the group (this does not delete the cameras themselves).",
          ],
        },
      },
      {
        q: "What are the live previews when building a group?",
        a: "While selecting cameras, each one shows a small live thumbnail so you can watch the feed and decide whether to include it. Previews only stream when scrolled into view to keep things fast, and you can turn them off with the 'Live previews' toggle if you prefer a compact list.",
      },
      {
        q: "Are my groups shared with other users?",
        a: "No. Groups are currently stored locally in your browser for your account, so they are personal to you and to the device you created them on. They are not yet synced across devices or shared with teammates.",
      },
    ],
  },
  {
    category: "AI Dashboard & Events",
    icon: TbCpu,
    items: [
      {
        q: "What is the AI Dashboard?",
        a: "The AI Dashboard summarizes AI-driven detections and analytics from your cameras — such as counts and trends over time — giving you an at-a-glance view of activity across your network without watching every feed manually.",
      },
      {
        q: "What are AI Events?",
        a: "AI Events are automatically flagged occurrences detected by the analytics engine (for example motion or object detections, depending on your configuration). The AI Events page lists these so you can review what happened, when, and on which camera.",
      },
      {
        q: "How do I configure AI settings for a camera?",
        a: "AI processing is configured per camera through the AI Settings section (where enabled for your role). There you can start or stop AI processing for a device. If you don't see this option, your role may not have permission to change AI configuration.",
      },
    ],
  },
  {
    category: "Reports & Analytics",
    icon: TbReportAnalytics,
    items: [
      {
        q: "What reports are available?",
        a: {
          text: "Depending on your role, reports may include:",
          bullets: [
            "Analytics Reports — AI/image analytics summaries.",
            "Consolidated & Installation reports — camera inventory and setup status.",
            "Connected / Downtime reports — uptime and connectivity history.",
            "VMS Master (Admin Panel) — administrative camera and configuration data.",
          ],
        },
      },
      {
        q: "Can I export report data?",
        a: "Where export is supported, use the download/export control on the report page. If you don't see one, that report may be view-only for your role.",
      },
    ],
  },
  {
    category: "Display, Theme & Troubleshooting",
    icon: TbSettings,
    items: [
      {
        q: "Does the app support dark mode?",
        a: "Yes. The interface follows your system's light/dark preference by default and adapts all pages — including Multi View and Camera Groups — automatically. You can also toggle the theme from the header where available.",
      },
      {
        q: "The video feeds are laggy or the page feels slow. What can I do?",
        a: {
          text: "Live video is resource-intensive. To improve performance:",
          bullets: [
            "Use a smaller grid layout (e.g. 2x2) so fewer feeds stream at once.",
            "Use Camera Groups to watch only the cameras you need.",
            "Turn off 'Live previews' in the group editor when picking cameras.",
            "Close other heavy browser tabs and ensure a stable network connection.",
          ],
        },
      },
      {
        q: "A page won't load or shows a connection error. What should I check?",
        a: {
          text: "Try these steps in order:",
          bullets: [
            "Refresh the page (a hard refresh with Ctrl+Shift+R clears cached files).",
            "Check your internet connection.",
            "Log out and back in to renew your session.",
            "If it persists, contact your administrator/support with the time and what you were doing.",
          ],
        },
      },
      {
        q: "How do I log out?",
        a: "Open the account menu in the header and select Logout. For shared computers, always log out when you're done to protect access to the camera network.",
      },
    ],
  },
];

function Faq() {
  const [search, setSearch] = useState("");

  const pageText = useColorModeValue("gray.800", "white");
  const subText = useColorModeValue("gray.500", "gray.400");
  const cardBg = useColorModeValue("white", "#1A202C");
  const cardBorder = useColorModeValue("gray.200", "whiteAlpha.200");
  const panelText = useColorModeValue("gray.600", "gray.300");
  const searchBg = useColorModeValue("gray.50", "whiteAlpha.100");
  const accentIconBg = useColorModeValue("blue.50", "rgba(66,153,225,0.15)");
  const hoverBg = useColorModeValue("gray.50", "whiteAlpha.50");

  // Filter questions by the search term (matches question or answer text).
  const filteredData = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return FAQ_DATA;
    return FAQ_DATA.map((cat) => {
      const items = cat.items.filter((it) => {
        const answerText =
          typeof it.a === "string"
            ? it.a
            : `${it.a.text} ${(it.a.bullets || []).join(" ")}`;
        return (
          it.q.toLowerCase().includes(term) ||
          answerText.toLowerCase().includes(term)
        );
      });
      return { ...cat, items };
    }).filter((cat) => cat.items.length > 0);
  }, [search]);

  const totalQuestions = FAQ_DATA.reduce((n, c) => n + c.items.length, 0);

  const renderAnswer = (a) => {
    if (typeof a === "string") {
      return (
        <Text fontSize="14px" color={panelText} lineHeight="1.7">
          {a}
        </Text>
      );
    }
    return (
      <Box>
        <Text fontSize="14px" color={panelText} lineHeight="1.7" mb={2}>
          {a.text}
        </Text>
        <UnorderedList spacing={1.5} pl={2}>
          {a.bullets.map((b, i) => (
            <ListItem key={i} fontSize="14px" color={panelText} lineHeight="1.6">
              {b}
            </ListItem>
          ))}
        </UnorderedList>
      </Box>
    );
  };

  return (
    <Box maxW="960px" mx="auto" px={{ base: 3, md: 4 }} py={{ base: 4, md: 6 }} color={pageText}>
      {/* Header */}
      <Flex align="center" gap={3} mb={2}>
        <Flex
          w="44px"
          h="44px"
          align="center"
          justify="center"
          borderRadius="12px"
          bg={accentIconBg}
          color="blue.400"
          flexShrink={0}
        >
          <Icon as={MdHelpOutline} boxSize="26px" />
        </Flex>
        <Box>
          <Heading fontSize={{ base: "22px", md: "26px" }} fontWeight="600">
            Frequently Asked Questions
          </Heading>
          <Text fontSize="13px" color={subText}>
            Answers to common questions about using the platform.
          </Text>
        </Box>
      </Flex>

      {/* Search */}
      <InputGroup my={5}>
        <InputLeftElement pointerEvents="none" color={subText}>
          <MdSearch />
        </InputLeftElement>
        <Input
          placeholder="Search questions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          bg={searchBg}
          borderColor={cardBorder}
          borderRadius="12px"
        />
      </InputGroup>

      {/* Categories */}
      {filteredData.length === 0 ? (
        <Flex direction="column" align="center" justify="center" py={16} gap={2}>
          <Icon as={MdHelpOutline} boxSize="40px" color={subText} />
          <Text color={subText}>No questions match “{search}”.</Text>
        </Flex>
      ) : (
        <VStack align="stretch" spacing={6}>
          {filteredData.map((cat) => (
            <Box key={cat.category}>
              <HStack spacing={2} mb={3}>
                <Icon as={cat.icon} color="blue.400" boxSize="18px" />
                <Text fontSize="15px" fontWeight="700">
                  {cat.category}
                </Text>
                <Badge colorScheme="blue" borderRadius="full" fontSize="10px">
                  {cat.items.length}
                </Badge>
              </HStack>

              <Accordion allowMultiple defaultIndex={search ? cat.items.map((_, i) => i) : []}>
                <VStack align="stretch" spacing={2}>
                  {cat.items.map((it, idx) => (
                    <AccordionItem
                      key={idx}
                      border="1px solid"
                      borderColor={cardBorder}
                      borderRadius="12px"
                      bg={cardBg}
                      overflow="hidden"
                    >
                      <AccordionButton
                        py={3}
                        px={4}
                        _hover={{ bg: hoverBg }}
                        _expanded={{ bg: hoverBg }}
                        borderRadius="12px"
                      >
                        <Box flex="1" textAlign="left" fontSize="14px" fontWeight="600">
                          {it.q}
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel px={4} pb={4} pt={0}>
                        {renderAnswer(it.a)}
                      </AccordionPanel>
                    </AccordionItem>
                  ))}
                </VStack>
              </Accordion>
            </Box>
          ))}
        </VStack>
      )}

      <Text fontSize="12px" color={subText} textAlign="center" mt={10}>
        Showing {totalQuestions} answers · Still stuck? Contact your administrator or support team.
      </Text>
    </Box>
  );
}

export default Faq;
