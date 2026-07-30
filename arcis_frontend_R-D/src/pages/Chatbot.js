import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
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
} from "react-icons/ai";
import { BsRobot } from "react-icons/bs";

const getUrl = (item) => (typeof item === "string" ? item : item?.url || item?.href || item?.path || "");
const getLabel = (item, fallback) => (typeof item === "string" ? fallback : item?.name || item?.filename || fallback);

const CHATBOT_BASE_URL = "http://192.168.4.33:8090";
const CHATBOT_URL = `${CHATBOT_BASE_URL}/chat`;
const CHATBOT_SAVE_URL = `${CHATBOT_BASE_URL}/chat/save`;
const CHATBOT_CACHE_URL = `${CHATBOT_BASE_URL}/chat/cache`;
const CHATBOT_DELETE_URL = `${CHATBOT_BASE_URL}/chat/delete`;
const DATA_COVERAGE_URL = `${CHATBOT_BASE_URL}/cameras/data-coverage`;
const GREETING = { sender: "bot", text: "Hi, how can I help you today?", timestamp: null };
const MAX_INPUT_HEIGHT = 120;

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

const TypingDots = ({ color }) => (
  <Flex gap="4px" align="center" px={1}>
    {[0, 1, 2].map((i) => (
      <Box
        key={i}
        w="6px"
        h="6px"
        borderRadius="full"
        bg={color}
        sx={{ animation: `${bounce} 1.2s ease-in-out infinite`, animationDelay: `${i * 0.15}s` }}
      />
    ))}
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
  const [savedIds, setSavedIds] = useState(new Set());
  const [isSavedOpen, setIsSavedOpen] = useState(false);
  const [savedItems, setSavedItems] = useState([]);
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

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const email = localStorage.getItem("email");

    setMessages((prev) => [...prev, { sender: "user", text: trimmed, timestamp: Date.now() }]);
    setInput("");
    setIsSending(true);

    try {
      const response = await axios.post(CHATBOT_URL, {
        session_id: email,
        message: trimmed,
        email,
      });

      const data = response.data || {};
      const replyText =
        data.answer ||
        data.message ||
        data.reply ||
        data.response ||
        (typeof data === "string" ? data : JSON.stringify(data));

      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: replyText,
          timestamp: Date.now(),
          images: data.images || [],
          videos: data.videos || [],
          files: data.files || [],
          qaId: data.qa_id || null,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Sorry, something went wrong - please try again.", timestamp: Date.now() },
      ]);
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to reach the assistant",
        status: "error",
      });
    } finally {
      setIsSending(false);
    }
  };

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

  const handleSaveMessage = async (qaId) => {
    if (!qaId || savedIds.has(qaId)) return;
    try {
      await axios.post(CHATBOT_SAVE_URL, { qa_id: qaId });
      setSavedIds((prev) => new Set(prev).add(qaId));
      toast({ title: "Saved", status: "success", duration: 2000 });
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to save this answer",
        status: "error",
      });
    }
  };

  const handleDeleteMessage = async (qaId, index) => {
    if (!qaId) return;
    try {
      await axios.post(CHATBOT_DELETE_URL, { qa_id: qaId });
      setMessages((prev) => prev.filter((_, i) => i !== index));
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(qaId);
        return next;
      });
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
    return data?.items || data?.cache || data?.data || [];
  };

  const handleOpenSaved = async () => {
    setIsSavedOpen(true);
    setIsLoadingSaved(true);
    try {
      const response = await axios.get(CHATBOT_CACHE_URL);
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

  const handleDeleteSavedItem = async (qaId) => {
    if (!qaId) return;
    try {
      await axios.post(CHATBOT_DELETE_URL, { qa_id: qaId });
      setSavedItems((prev) => prev.filter((item) => (item.qa_id || item.qaId) !== qaId));
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(qaId);
        return next;
      });
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
    <Flex h="calc(100vh - 110px)" p={3} gap={3}>
      {/* Left: chat history */}
      <Box
        w="260px"
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
      <Box flex="1" display="flex" flexDirection="column" maxW="820px" mx="auto">
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

              <Flex direction="column" alignItems={msg.sender === "user" ? "flex-end" : "flex-start"} maxW="75%">
                <Box
                  bg={msg.sender === "user" ? userBubbleBg : botBubbleBg}
                  color={msg.sender === "user" ? "white" : botBubbleText}
                  px={4}
                  py={2.5}
                  boxShadow="sm"
                  borderRadius="18px"
                  borderTopRightRadius={msg.sender === "user" ? "4px" : "18px"}
                  borderTopLeftRadius={msg.sender === "bot" ? "4px" : "18px"}
                  whiteSpace="pre-wrap"
                  fontSize="sm"
                  lineHeight="1.5"
                >
                  {msg.text}

                  {msg.images?.length > 0 && (
                    <Flex direction="column" gap={2} mt={2}>
                      {msg.images.map((img, i) => (
                        <Image key={i} src={getUrl(img)} alt={getLabel(img, "image")} borderRadius="8px" maxW="100%" />
                      ))}
                    </Flex>
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
                  {msg.sender === "bot" && msg.qaId && (
                    <Flex gap={0.5}>
                      <Tooltip label={savedIds.has(msg.qaId) ? "Saved" : "Save answer"} hasArrow>
                        <IconButton
                          icon={savedIds.has(msg.qaId) ? <AiOutlineCheckCircle /> : <AiOutlineCheck />}
                          aria-label="Save answer"
                          size="xs"
                          variant="ghost"
                          fontSize="14px"
                          color={savedIds.has(msg.qaId) ? "green.400" : timestampColor}
                          isDisabled={savedIds.has(msg.qaId)}
                          onClick={() => handleSaveMessage(msg.qaId)}
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
                          onClick={() => handleDeleteMessage(msg.qaId, index)}
                        />
                      </Tooltip>
                    </Flex>
                  )}
                </Flex>
              </Flex>
            </Flex>
          ))}

          {isSending && (
            <Flex gap={2.5} alignItems="flex-end" justifyContent="flex-start">
              <Avatar size="xs" icon={<BsRobot fontSize="12px" />} bg="custom.accent" color="white" flexShrink={0} />
              <Box
                bg={botBubbleBg}
                px={4}
                py={3}
                borderRadius="18px"
                borderTopLeftRadius="4px"
              >
                <TypingDots color={timestampColor} />
              </Box>
            </Flex>
          )}

          <div ref={messagesEndRef} />
        </Box>

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
            onClick={handleSend}
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
                  const qaId = item.qa_id || item.qaId;
                  const question = item.question || item.query || item.message;
                  const answer = item.answer || item.response || item.text;
                  return (
                    <Box key={qaId || i} border="1px solid" borderColor={cardBorder} borderRadius="12px" p={3}>
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
                          onClick={() => handleDeleteSavedItem(qaId)}
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
