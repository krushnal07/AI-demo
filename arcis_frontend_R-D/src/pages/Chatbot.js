import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import MarkdownMessage from "../components/MarkdownMessage";
import { keyframes } from "@emotion/react";
import {
  Box,
  Flex,
  Text,
  Textarea,
  IconButton,
  Button,
  Image,
  Link,
  Avatar,
  Tooltip,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  Spinner,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import {
  AiOutlineSend,
  AiOutlineCheck,
  AiOutlineCheckCircle,
  AiOutlineDelete,
  AiOutlineStar,
  AiOutlineUnorderedList,
  AiOutlineMessage,
  AiOutlineLeft,
  AiOutlineRight,
} from "react-icons/ai";
import { BsRobot } from "react-icons/bs";

const getUrl = (item) => (typeof item === "string" ? item : item?.url || item?.href || item?.path || "");
const getLabel = (item, fallback) => (typeof item === "string" ? fallback : item?.name || item?.filename || fallback);

const CHATBOT_HOST = "https://vmschatbot.vmukti.com:21836";
// Streams server-sent events: data: {"content"|"image_url"|"save_prompt"} then data: [DONE]
const CHATBOT_STREAM_URL = `${CHATBOT_HOST}/api/chat/stream`;
const CACHE_SAVE_URL = `${CHATBOT_HOST}/api/cache/save`;
const CACHE_LIST_URL = `${CHATBOT_HOST}/api/cache/list`;
const CACHE_DELETE_URL = `${CHATBOT_HOST}/api/cache/delete`; // + /{entry_id}
const DATA_COVERAGE_URL = `${CHATBOT_HOST}/api/camera_coverage`;
const QUICK_PROMPTS = [
  { emoji: "📋", label: "Cameras", prompt: "List all cameras" },
  { emoji: "🎥", label: "Camera Summary", prompt: "Provide me a summary of Janpath on 2026-06-13" },
  { emoji: "🚌", label: "White Bus", prompt: "have you seen any white bus at Rajkot Bus Port" },
  { emoji: "🚛", label: "Truck", prompt: "have you seen any truck at Chiman bhai Bridge on 2026-06-13" },
  { emoji: "🛺", label: "Auto-rickshaw", prompt: "have you seen any auto-rickshaw at Janpath on 2026-06-13" },
  { emoji: "🚦", label: "Traffic Jam", prompt: "have you seen a traffic jam at Janpath on 2026-06-13" },
  { emoji: "🚶", label: "Pedestrians", prompt: "were there pedestrians at O.N.G.C. Office on 2026-06-13" },
  { emoji: "👥", label: "Crowd", prompt: "was there a crowd at Rajkot Bus Port" },
  { emoji: "🔢", label: "Number Plates", prompt: "have you seen any number plate starting with GJ in cam10" },
  { emoji: "🚘", label: "Trace a Plate", prompt: "have you seen GJ27EA8879 in cam10 on 2025-08-28" },
  { emoji: "🔢", label: "Vehicle Count", prompt: "how many vehicles were detected at cam10 on 2025-08-28" },
  { emoji: "🛑", label: "Vehicle Stopped", prompt: "did any vehicle stop at cam10 on 2025-08-28" },
];
const GREETING = { sender: "bot", text: "Hi, how can I help you today?", timestamp: null };
const MAX_INPUT_HEIGHT = 120;
const IMAGE_PREVIEW_COUNT = 5;

const bounce = keyframes`
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
`;

const getStorageKey = () => `chatbot_messages_${localStorage.getItem("email") || "guest"}`;

const loadStoredMessages = () => {
  try {
    const raw = localStorage.getItem(getStorageKey());
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [GREETING];
  } catch {
    return [GREETING];
  }
};

const formatDateLabel = (timestamp) => {
  if (!timestamp) return "Earlier";
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

const formatTime = (timestamp) => {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

// Shown in the reply bubble until the first streamed characters arrive.
const GeneratingIndicator = ({ color }) => (
  <Flex gap="6px" align="center">
    <Text fontSize="sm" color={color} fontWeight="500">
      Vmukti AI
    </Text>
    <Flex gap="3px" align="center">
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          w="4px"
          h="4px"
          borderRadius="full"
          bg={color}
          sx={{ animation: `${bounce} 1.2s ease-in-out infinite`, animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </Flex>
  </Flex>
);

const EmptyState = ({ icon, text, color }) => (
  <Flex direction="column" align="center" justify="center" py={10} gap={2} color={color}>
    <Box fontSize="28px" opacity={0.5}>
      {icon}
    </Box>
    <Text fontSize="sm">{text}</Text>
  </Flex>
);

const Chatbot = () => {
  const [messages, setMessages] = useState(loadStoredMessages);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSavedOpen, setIsSavedOpen] = useState(false);
  const [savedItems, setSavedItems] = useState([]);
  const [expandedImages, setExpandedImages] = useState(() => new Set());
  // { images, index } while a thumbnail is open full size
  const [lightbox, setLightbox] = useState(null);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const toast = useToast();
  const messagesEndRef = useRef(null);
  const messageRefs = useRef({});
  const textareaRef = useRef(null);

  const pageHeading = useColorModeValue("gray.800", "white");
  const cardBg = useColorModeValue("#FFFFFF", "gray.800");
  const cardBorder = useColorModeValue("rgba(226,232,240,0.9)", "whiteAlpha.200");
  const softShadow = useColorModeValue("0 1px 3px rgba(0,0,0,0.06)", "none");
  const userBubbleBg = useColorModeValue("custom.accent", "custom.darkModePrimary");
  const botBubbleBg = useColorModeValue("gray.100", "gray.700");
  const botBubbleText = useColorModeValue("gray.800", "whiteAlpha.900");
  const inputBg = useColorModeValue("gray.50", "gray.700");
  const inputBorder = useColorModeValue("gray.200", "whiteAlpha.200");
  const historyItemHover = useColorModeValue("gray.100", "whiteAlpha.100");
  const subText = useColorModeValue("gray.500", "gray.400");
  const timestampColor = useColorModeValue("gray.400", "gray.500");
  const headerBg = useColorModeValue("white", "gray.800");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    localStorage.setItem(getStorageKey(), JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`;
  }, [input]);

  const historyGroups = useMemo(() => {
    const groups = {};
    messages.forEach((msg, index) => {
      if (msg.sender !== "user") return;
      const label = formatDateLabel(msg.timestamp);
      if (!groups[label]) groups[label] = [];
      groups[label].push({ index, text: msg.text });
    });
    return groups;
  }, [messages]);

  // Rewrites the trailing bot bubble as stream chunks arrive.
  const patchStreamingBot = (patch) =>
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.sender === "bot") next[next.length - 1] = { ...last, ...patch };
      return next;
    });

  // presetText comes from a quick-prompt chip; typeof guards against a
  // click event being passed in by an onClick={handleSend} style call.
  const handleSend = async (presetText) => {
    const source = typeof presetText === "string" ? presetText : input;
    const trimmed = source.trim();
    if (!trimmed || isSending) return;

    const email = localStorage.getItem("email");

    setMessages((prev) => [
      ...prev,
      { sender: "user", text: trimmed, timestamp: Date.now() },
      // placeholder bubble that fills in chunk by chunk
      { sender: "bot", text: "", timestamp: Date.now(), images: [], streaming: true },
    ]);
    setInput("");
    setIsSending(true);

    let answer = "";
    const images = [];
    let savePayload = null;

    try {
      const response = await fetch(CHATBOT_STREAM_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, session_id: email || "default" }),
      });

      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      if (!response.body) throw new Error("Streaming is not supported in this browser");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streaming = true;

      while (streaming) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are blank-line separated; hold back any partial tail
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          const dataLine = event.split("\n").find((line) => line.startsWith("data:"));
          if (!dataLine) continue;

          const payload = dataLine.slice(5).trim();
          if (!payload) continue;
          if (payload === "[DONE]") {
            streaming = false;
            break;
          }

          let parsed;
          try {
            parsed = JSON.parse(payload);
          } catch (err) {
            continue; // skip a malformed event rather than losing the reply
          }

          if (typeof parsed.content === "string") {
            answer += parsed.content;
            patchStreamingBot({ text: answer });
          }
          if (parsed.image_url) {
            images.push(parsed.image_url);
            patchStreamingBot({ images: [...images] });
          }
          if (parsed.save_prompt) {
            savePayload = parsed.save_prompt;
          }
        }
      }

      patchStreamingBot({
        text: answer || "No answer returned.",
        images: [...images],
        streaming: false,
        // POST /api/cache/save takes exactly { query, answer, image_urls }
        savePayload: savePayload || { query: trimmed, answer, image_urls: images },
      });
    } catch (error) {
      patchStreamingBot({
        text: "Sorry, something went wrong - please try again.",
        streaming: false,
      });
      toast({
        title: "Error",
        description: error.message || "Failed to reach the assistant",
        status: "error",
      });
    } finally {
      setIsSending(false);
    }
  };

  const openLightbox = (images, index) => setLightbox({ images, index });
  const closeLightbox = () => setLightbox(null);

  const stepLightbox = (delta) =>
    setLightbox((prev) => {
      if (!prev) return prev;
      const next = prev.index + delta;
      if (next < 0 || next >= prev.images.length) return prev;
      return { ...prev, index: next };
    });

  const toggleImages = (index) =>
    setExpandedImages((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleHistoryClick = (index) => {
    messageRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleClearHistory = () => {
    setMessages([GREETING]);
  };

  // The stream hands us { query, answer, image_urls }, which is exactly the
  // body /api/cache/save expects. The saved entry id comes back in the response.
  const handleSaveMessage = async (payload, index) => {
    if (!payload) return;
    try {
      const response = await axios.post(CACHE_SAVE_URL, {
        query: payload.query,
        answer: payload.answer,
        image_urls: payload.image_urls || [],
      });
      const entryId = response.data?.id || response.data?.entry_id || null;
      setMessages((prev) => prev.map((msg, i) => (i === index ? { ...msg, saved: true, entryId } : msg)));
      toast({ title: "Saved", status: "success", duration: 2000 });
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to save this answer",
        status: "error",
      });
    }
  };

  const handleDeleteMessage = async (entryId, index) => {
    try {
      // only saved answers exist server-side; the rest are local only
      if (entryId) await axios.delete(`${CACHE_DELETE_URL}/${entryId}`);
      setMessages((prev) => prev.filter((_, i) => i !== index));
      toast({ title: "Deleted", status: "success", duration: 2000 });
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete this answer",
        status: "error",
      });
    }
  };

  const normalizeSavedList = (data) => {
    if (Array.isArray(data)) return data;
    return data?.entries || data?.items || data?.cache || data?.data || [];
  };

  const handleOpenSaved = async () => {
    setIsSavedOpen(true);
    setIsLoadingSaved(true);
    try {
      const response = await axios.get(CACHE_LIST_URL);
      setSavedItems(normalizeSavedList(response.data));
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to load saved answers",
        status: "error",
      });
      setSavedItems([]);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  const handleDeleteSavedItem = async (entryId) => {
    if (!entryId) return;
    try {
      await axios.delete(`${CACHE_DELETE_URL}/${entryId}`);
      setSavedItems((prev) => prev.filter((item) => (item.id || item.entry_id) !== entryId));
      toast({ title: "Deleted", status: "success", duration: 2000 });
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete this answer",
        status: "error",
      });
    }
  };

  const formatCoverageTimestamp = (ts) => {
    if (!ts) return "";
    const date = new Date(ts.includes("T") ? ts : ts.replace(" ", "T"));
    return isNaN(date.getTime()) ? ts : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  };

  const formatCoverageText = (data) => {
    const cameras = data?.cameras || normalizeSavedList(data);
    if (!cameras || cameras.length === 0) return "No data coverage information available.";

    const lines = cameras.map((cam) => {
      if (typeof cam !== "object" || cam === null) return `• ${cam}`;
      const id = cam.camera_id || cam.deviceId || "Unknown camera";
      const segments = cam.segment_count != null ? `${cam.segment_count} segments` : null;
      const range =
        cam.earliest && cam.latest
          ? `${formatCoverageTimestamp(cam.earliest)} → ${formatCoverageTimestamp(cam.latest)}`
          : null;
      return `• ${id}${segments ? ` — ${segments}` : ""}${range ? `\n   ${range}` : ""}`;
    });

    return `Data coverage for ${cameras.length} camera${cameras.length === 1 ? "" : "s"}:\n\n${lines.join("\n\n")}`;
  };

  const handleDataCoverage = async () => {
    if (isSending) return;
    setMessages((prev) => [...prev, { sender: "user", text: "Show data coverage", timestamp: Date.now() }]);
    setIsSending(true);
    try {
      const response = await axios.get(DATA_COVERAGE_URL);
      setMessages((prev) => [...prev, { sender: "bot", text: formatCoverageText(response.data), timestamp: Date.now() }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Sorry, I couldn't fetch data coverage right now.", timestamp: Date.now() },
      ]);
      toast({
        title: "Error",
        description: error.response?.data?.message || error.message || "Failed to load data coverage",
        status: "error",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Flex h="calc(100vh - 88px)" p={3} gap={3}>
      {/* Left: chat history */}
      <Box
        w="300px"
        display={{ base: "none", md: "flex" }}
        flexDirection="column"
        bg={cardBg}
        border="1px solid"
        borderColor={cardBorder}
        borderRadius="16px"
        boxShadow={softShadow}
        p={3}
      >
        <Flex justifyContent="space-between" alignItems="center" mb={3} px={1}>
          <Text fontWeight={700} fontSize="sm" color={pageHeading} letterSpacing="0.02em">
            CHAT HISTORY
          </Text>
          <Button size="xs" variant="ghost" color={subText} onClick={handleClearHistory}>
            Clear
          </Button>
        </Flex>
        <Box flex="1" overflowY="auto">
          {Object.keys(historyGroups).length === 0 && (
            <EmptyState icon={<AiOutlineMessage />} text="No messages yet" color={subText} />
          )}
          {Object.entries(historyGroups).map(([label, items]) => (
            <Box key={label} mb={4}>
              <Text fontSize="xs" fontWeight={700} color={subText} mb={1.5} px={1}>
                {label}
              </Text>
              {items.map((item) => (
                <Tooltip key={item.index} label={item.text} hasArrow openDelay={400} placement="right">
                  <Box
                    onClick={() => handleHistoryClick(item.index)}
                    cursor="pointer"
                    px={2.5}
                    py={2}
                    borderRadius="10px"
                    fontSize="sm"
                    color={pageHeading}
                    noOfLines={2}
                    wordBreak="break-word"
                    overflowWrap="anywhere"
                    lineHeight="1.4"
                    transition="background 0.15s ease"
                    _hover={{ bg: historyItemHover }}
                  >
                    {item.text}
                  </Box>
                </Tooltip>
              ))}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Right: chat thread */}
      <Box flex="1" display="flex" flexDirection="column" maxW="1200px" mx="auto">
        <Flex
          justifyContent="space-between"
          alignItems="center"
          mb={3}
          px={4}
          py={3}
          bg={headerBg}
          border="1px solid"
          borderColor={cardBorder}
          borderRadius="16px"
          boxShadow={softShadow}
        >
          <Flex alignItems="center" gap={3}>
            <Avatar size="sm" icon={<BsRobot fontSize="18px" />} bg="custom.accent" color="white" />
            <Box>
              <Text fontWeight={700} fontSize="lg" color={pageHeading} lineHeight="1.2">
                AI Assistant
              </Text>
              <Text fontSize="xs" color={subText}>
                Arcis Virtual Assistant
              </Text>
            </Box>
          </Flex>
          <Flex gap={1}>
            <Tooltip label="Data Coverage" hasArrow>
              <IconButton
                icon={<AiOutlineUnorderedList />}
                aria-label="Data coverage"
                variant="ghost"
                fontSize="20px"
                borderRadius="full"
                onClick={handleDataCoverage}
              />
            </Tooltip>
            <Tooltip label="Saved Answers" hasArrow>
              <IconButton
                icon={<AiOutlineStar />}
                aria-label="Saved answers"
                variant="ghost"
                fontSize="20px"
                borderRadius="full"
                onClick={handleOpenSaved}
              />
            </Tooltip>
          </Flex>
        </Flex>

        <Box
          flex="1"
          bg={cardBg}
          border="1px solid"
          borderColor={cardBorder}
          borderRadius="16px"
          boxShadow={softShadow}
          p={4}
          overflowY="auto"
          display="flex"
          flexDirection="column"
          gap={4}
        >
          {messages.map((msg, index) => (
            <Flex
              key={index}
              ref={(el) => (messageRefs.current[index] = el)}
              gap={2.5}
              alignItems="flex-end"
              justifyContent={msg.sender === "user" ? "flex-end" : "flex-start"}
            >
              {msg.sender === "bot" && (
                <Avatar size="xs" icon={<BsRobot fontSize="12px" />} bg="custom.accent" color="white" flexShrink={0} />
              )}

              <Flex direction="column" alignItems={msg.sender === "user" ? "flex-end" : "flex-start"} maxW="85%">
                <Box
                  bg={msg.sender === "user" ? userBubbleBg : botBubbleBg}
                  color={msg.sender === "user" ? "white" : botBubbleText}
                  px={4}
                  py={2.5}
                  boxShadow="sm"
                  borderRadius="18px"
                  borderTopRightRadius={msg.sender === "user" ? "4px" : "18px"}
                  borderTopLeftRadius={msg.sender === "bot" ? "4px" : "18px"}
                  whiteSpace={msg.sender === "bot" ? "normal" : "pre-wrap"}
                  fontSize="sm"
                  lineHeight="1.5"
                >
                  {msg.sender === "bot" ? (
                    msg.streaming && !msg.text ? (
                      <GeneratingIndicator color={botBubbleText} />
                    ) : (
                      <MarkdownMessage text={msg.text} />
                    )
                  ) : (
                    msg.text
                  )}

                  {msg.images?.length > 0 && (
                    <Box mt={2}>
                      <Flex gap={2} wrap="wrap">
                        {(expandedImages.has(index) ? msg.images : msg.images.slice(0, IMAGE_PREVIEW_COUNT)).map(
                          (img, i) => (
                            <Image
                              key={i}
                              src={getUrl(img)}
                              alt={getLabel(img, "image")}
                              boxSize="72px"
                              objectFit="cover"
                              borderRadius="8px"
                              flexShrink={0}
                              cursor="pointer"
                              transition="transform 0.15s ease"
                              _hover={{ transform: "scale(1.06)" }}
                              onClick={() => openLightbox(msg.images, i)}
                            />
                          )
                        )}
                      </Flex>

                      {msg.images.length > IMAGE_PREVIEW_COUNT && (
                        <Button
                          size="xs"
                          variant="link"
                          mt={2}
                          color="custom.accent"
                          onClick={() => toggleImages(index)}
                        >
                          {expandedImages.has(index)
                            ? "Show less"
                            : `Show more (${msg.images.length - IMAGE_PREVIEW_COUNT})`}
                        </Button>
                      )}
                    </Box>
                  )}

                  {msg.videos?.length > 0 && (
                    <Flex direction="column" gap={2} mt={2}>
                      {msg.videos.map((vid, i) => (
                        <Box as="video" key={i} src={getUrl(vid)} controls borderRadius="8px" maxW="100%" />
                      ))}
                    </Flex>
                  )}

                  {msg.files?.length > 0 && (
                    <Flex direction="column" gap={1} mt={2}>
                      {msg.files.map((file, i) => (
                        <Link key={i} href={getUrl(file)} isExternal color="blue.400" fontSize="xs" textDecoration="underline">
                          {getLabel(file, `File ${i + 1}`)}
                        </Link>
                      ))}
                    </Flex>
                  )}
                </Box>

                <Flex gap={2} mt={1} alignItems="center" px={1}>
                  {msg.timestamp && (
                    <Text fontSize="10px" color={timestampColor}>
                      {formatTime(msg.timestamp)}
                    </Text>
                  )}
                  {msg.sender === "bot" && msg.savePayload && (
                    <Flex gap={0.5}>
                      <Tooltip label={msg.saved ? "Saved" : "Save answer"} hasArrow>
                        <IconButton
                          icon={msg.saved ? <AiOutlineCheckCircle /> : <AiOutlineCheck />}
                          aria-label="Save answer"
                          size="xs"
                          variant="ghost"
                          fontSize="14px"
                          color={msg.saved ? "green.400" : timestampColor}
                          isDisabled={msg.saved}
                          onClick={() => handleSaveMessage(msg.savePayload, index)}
                        />
                      </Tooltip>
                      <Tooltip label="Delete answer" hasArrow>
                        <IconButton
                          icon={<AiOutlineDelete />}
                          aria-label="Delete answer"
                          size="xs"
                          variant="ghost"
                          fontSize="14px"
                          color={timestampColor}
                          onClick={() => handleDeleteMessage(msg.entryId, index)}
                        />
                      </Tooltip>
                    </Flex>
                  )}
                </Flex>
              </Flex>
            </Flex>
          ))}


          <div ref={messagesEndRef} />
        </Box>

        <Flex mt={3} gap={2} wrap="wrap">
          {QUICK_PROMPTS.map((item) => (
            <Button
              key={item.label}
              size="sm"
              variant="outline"
              borderColor={inputBorder}
              borderRadius="full"
              fontWeight="500"
              fontSize="13px"
              px={3}
              isDisabled={isSending}
              onClick={() => handleSend(item.prompt)}
            >
              <Box as="span" mr={1.5}>
                {item.emoji}
              </Box>
              {item.label}
            </Button>
          ))}
        </Flex>

        <Flex
          mt={3}
          gap={2}
          alignItems="flex-end"
          bg={inputBg}
          border="1px solid"
          borderColor={inputBorder}
          borderRadius="22px"
          p={2}
          pl={4}
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            variant="unstyled"
            resize="none"
            rows={1}
            minH="24px"
            maxH={`${MAX_INPUT_HEIGHT}px`}
            py={2}
            isDisabled={isSending}
          />
          <IconButton
            icon={<AiOutlineSend />}
            aria-label="Send message"
            onClick={() => handleSend()}
            isDisabled={isSending || !input.trim()}
            bg="custom.accent"
            color="white"
            borderRadius="full"
            flexShrink={0}
            transition="transform 0.15s ease, opacity 0.15s ease"
            _hover={{ opacity: 0.9, transform: "scale(1.05)" }}
            _active={{ transform: "scale(0.96)" }}
          />
        </Flex>
      </Box>

      {/* full-size image viewer; arrows step through that message's images */}
      <Modal isOpen={!!lightbox} onClose={closeLightbox} isCentered size="4xl">
        <ModalOverlay bg="blackAlpha.800" />
        <ModalContent bg="transparent" boxShadow="none" position="relative">
          <ModalCloseButton color="white" zIndex={2} />
          <ModalBody p={0}>
            <Flex justify="center" align="center" minH="60vh">
              <Image
                src={getUrl(lightbox?.images?.[lightbox?.index])}
                alt="Full size"
                maxH="80vh"
                maxW="100%"
                objectFit="contain"
                borderRadius="8px"
              />
            </Flex>

            {lightbox?.images?.length > 1 && (
              <>
                <IconButton
                  icon={<AiOutlineLeft />}
                  aria-label="Previous image"
                  size="sm"
                  isRound
                  position="absolute"
                  left="-4px"
                  top="50%"
                  transform="translateY(-50%)"
                  bg="blackAlpha.700"
                  color="white"
                  _hover={{ bg: "blackAlpha.900" }}
                  onClick={() => stepLightbox(-1)}
                  isDisabled={lightbox.index === 0}
                />
                <IconButton
                  icon={<AiOutlineRight />}
                  aria-label="Next image"
                  size="sm"
                  isRound
                  position="absolute"
                  right="-4px"
                  top="50%"
                  transform="translateY(-50%)"
                  bg="blackAlpha.700"
                  color="white"
                  _hover={{ bg: "blackAlpha.900" }}
                  onClick={() => stepLightbox(1)}
                  isDisabled={lightbox.index === lightbox.images.length - 1}
                />
                <Text textAlign="center" color="white" fontSize="xs" mt={3}>
                  {lightbox.index + 1} / {lightbox.images.length}
                </Text>
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={isSavedOpen} onClose={() => setIsSavedOpen(false)} isCentered size="lg" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent borderRadius="16px">
          <ModalHeader>Saved Answers</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {isLoadingSaved ? (
              <Flex justifyContent="center" py={6}>
                <Spinner color="custom.accent" />
              </Flex>
            ) : savedItems.length === 0 ? (
              <EmptyState icon={<AiOutlineStar />} text="No saved answers yet" color={subText} />
            ) : (
              <Flex direction="column" gap={3}>
                {savedItems.map((item, i) => {
                  const entryId = item.id || item.entry_id;
                  const question = item.question || item.query || item.message;
                  const answer = item.answer || item.response || item.text;
                  return (
                    <Box key={entryId || i} border="1px solid" borderColor={cardBorder} borderRadius="12px" p={3}>
                      <Flex justifyContent="space-between" alignItems="flex-start" gap={2}>
                        <Box>
                          {question && (
                            <Text fontSize="xs" fontWeight={700} color={subText} mb={1}>
                              {question}
                            </Text>
                          )}
                          <Text fontSize="sm">{answer}</Text>
                        </Box>
                        <IconButton
                          icon={<AiOutlineDelete />}
                          aria-label="Delete saved answer"
                          size="xs"
                          variant="ghost"
                          onClick={() => handleDeleteSavedItem(entryId)}
                        />
                      </Flex>
                    </Box>
                  );
                })}
              </Flex>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Flex>
  );
};

export default Chatbot;
