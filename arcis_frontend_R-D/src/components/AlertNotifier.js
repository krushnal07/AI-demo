// src/components/AlertNotifier.js
// Polls our own backend (not an external broadcaster) for AnalyticsImage rows
// that landed in the DB since the last poll, and toasts one notification per
// new alert. See GET /api/Analytics/latest-alerts.
import React, { useEffect, useRef } from "react";
import { Box, Flex, Image, Text, CloseButton, useColorModeValue, useToast } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import theme from "../theme";

const POLL_INTERVAL_MS = 8000;

const AlertNotifier = () => {
  const toast = useToast();
  const navigate = useNavigate();
  const cursorRef = useRef(null);
  const initializedRef = useRef(false);

  const buttonBG = useColorModeValue(theme.colors.custom.primary, theme.colors.custom.darkModePrimary);
  const buttonColor = useColorModeValue(theme.colors.custom.lightModeText, theme.colors.custom.darkModeText);

  useEffect(() => {
    const email = localStorage.getItem("email");
    if (!email) return;

    let cancelled = false;
    const baseUrl = `${process.env.REACT_APP_BASE_URL}/api/Analytics/latest-alerts`;

    const poll = async () => {
      try {
        const url = cursorRef.current
          ? `${baseUrl}?email=${encodeURIComponent(email)}&afterId=${cursorRef.current}`
          : `${baseUrl}?email=${encodeURIComponent(email)}`;
        const res = await fetch(url);
        const json = await res.json();
        if (cancelled || !json?.success) return;

        cursorRef.current = json.cursor || cursorRef.current;

        // First-ever poll only establishes the cursor baseline — nothing to toast yet.
        if (!initializedRef.current) {
          initializedRef.current = true;
          return;
        }

        (json.data || []).forEach((alert) => {
          const time = alert.sendtime ? new Date(alert.sendtime).toLocaleString() : "";
          toast({
            status: "info",
            duration: 6000,
            isClosable: true,
            position: "bottom-right",
            render: ({ onClose }) => (
              <Box color={buttonColor} p={3} w="100%" maxW="300px" bg={buttonBG} borderRadius="10px" boxShadow="lg">
                <Flex justifyContent="space-between" alignItems="flex-start">
                  <Text fontWeight="bold" fontSize="sm" color={buttonColor}>
                    {alert.eventType}
                  </Text>
                  <CloseButton onClick={onClose} size="sm" />
                </Flex>
                <Text fontSize="xs" mt={1} color={buttonColor}>
                  {alert.location} · {alert.cameradid} · {time}
                </Text>
                {alert.imgurl && (
                  <Image src={alert.imgurl} alt="alert" mt={2} borderRadius="6px" maxH="120px" objectFit="cover" />
                )}
                <Text
                  fontSize="xs"
                  fontWeight="bold"
                  mt={2}
                  cursor="pointer"
                  textDecoration="underline"
                  color={buttonColor}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                    navigate("/reports");
                  }}
                >
                 
                </Text>
              </Box>
            ),
          });
        });
      } catch (err) {
        console.error("AlertNotifier poll failed:", err);
      }
    };

    poll();
    const intervalId = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

export default AlertNotifier;
