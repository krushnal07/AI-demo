import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Box,
  Flex,
  Text,
  Input,
  IconButton,
  Button,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import { AiOutlineSend } from "react-icons/ai";

const CHATBOT_URL = "https://192.168.4.33:8090/chat";
const GREETING = { sender: "bot", text: "Hi, how can I help you today?", timestamp: null };

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

const Chatbot = () => {
  const [messages, setMessages] = useState(loadStoredMessages);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const toast = useToast();
  const messagesEndRef = useRef(null);
  const messageRefs = useRef({});

  const pageHeading = useColorModeValue("gray.800", "white");
  const cardBg = useColorModeValue("#FFFFFF", "gray.800");
  const cardBorder = useColorModeValue("rgba(226,232,240,0.9)", "whiteAlpha.200");
  const userBubbleBg = useColorModeValue("custom.accent", "custom.darkModePrimary");
  const botBubbleBg = useColorModeValue("gray.100", "gray.700");
  const botBubbleText = useColorModeValue("gray.800", "whiteAlpha.900");
  const inputBg = useColorModeValue("white", "gray.700");
  const historyItemHover = useColorModeValue("gray.100", "whiteAlpha.100");
  const subText = useColorModeValue("gray.500", "gray.400");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    localStorage.setItem(getStorageKey(), JSON.stringify(messages));
  }, [messages]);

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

      const replyText =
        response.data?.message ||
        response.data?.reply ||
        response.data?.response ||
        (typeof response.data === "string" ? response.data : JSON.stringify(response.data));

      setMessages((prev) => [...prev, { sender: "bot", text: replyText, timestamp: Date.now() }]);
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
        p={3}
      >
        <Flex justifyContent="space-between" alignItems="center" mb={2}>
          <Text fontWeight={700} fontSize="md" color={pageHeading}>
            Chat History
          </Text>
          <Button size="xs" variant="ghost" onClick={handleClearHistory}>
            Clear
          </Button>
        </Flex>
        <Box flex="1" overflowY="auto">
          {Object.keys(historyGroups).length === 0 && (
            <Text fontSize="xs" color={subText}>
              No messages yet.
            </Text>
          )}
          {Object.entries(historyGroups).map(([label, items]) => (
            <Box key={label} mb={3}>
              <Text fontSize="xs" fontWeight={700} color={subText} mb={1}>
                {label}
              </Text>
              {items.map((item) => (
                <Box
                  key={item.index}
                  onClick={() => handleHistoryClick(item.index)}
                  cursor="pointer"
                  px={2}
                  py={1.5}
                  borderRadius="8px"
                  fontSize="sm"
                  noOfLines={1}
                  _hover={{ bg: historyItemHover }}
                >
                  {item.text}
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Right: chat thread */}
      <Box flex="1" display="flex" flexDirection="column" maxW="800px" mx="auto">
        <Text fontWeight={700} fontSize="28px" color={pageHeading} mb={3}>
          AI Assistant
        </Text>

        <Box
          flex="1"
          bg={cardBg}
          border="1px solid"
          borderColor={cardBorder}
          borderRadius="16px"
          p={4}
          overflowY="auto"
          display="flex"
          flexDirection="column"
          gap={3}
        >
          {messages.map((msg, index) => (
            <Flex
              key={index}
              ref={(el) => (messageRefs.current[index] = el)}
              justifyContent={msg.sender === "user" ? "flex-end" : "flex-start"}
            >
              <Box
                bg={msg.sender === "user" ? userBubbleBg : botBubbleBg}
                color={msg.sender === "user" ? "white" : botBubbleText}
                px={4}
                py={2}
                borderRadius="16px"
                maxW="75%"
                whiteSpace="pre-wrap"
                fontSize="sm"
              >
                {msg.text}
              </Box>
            </Flex>
          ))}

          {isSending && (
            <Flex justifyContent="flex-start">
              <Box bg={botBubbleBg} color={botBubbleText} px={4} py={2} borderRadius="16px" fontSize="sm">
                Typing…
              </Box>
            </Flex>
          )}

          <div ref={messagesEndRef} />
        </Box>

        <Flex mt={3} gap={2}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            size="lg"
            bg={inputBg}
            isDisabled={isSending}
          />
          <IconButton
            icon={<AiOutlineSend />}
            aria-label="Send message"
            onClick={handleSend}
            isDisabled={isSending || !input.trim()}
            bg="custom.accent"
            color="white"
            size="lg"
            _hover={{ opacity: 0.9 }}
          />
        </Flex>
      </Box>
    </Flex>
  );
};

export default Chatbot;
