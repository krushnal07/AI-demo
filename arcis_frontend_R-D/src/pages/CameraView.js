import React, { useEffect, useState } from "react";
import {
  Box,
  Flex,
  Text,
  useColorModeValue,
  useBreakpointValue,
  Tooltip,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  ModalBody,
  SimpleGrid,
  Spinner,
  Button,
  HStack,
  Badge,
} from "@chakra-ui/react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  getStreamDetails,
  setImageUrl,
  setImageUrll,
} from "../actions/cameraActions";
import Player from "../components/Player";
import SimpleFLVPlayer from "../components/SimpleFLVPlayer";
import axios from "axios";
import MobileHeader from "../components/MobileHeader";
import { RiArrowGoBackLine } from "react-icons/ri";
import { CiStreamOn } from "react-icons/ci";
import { TbCamera } from "react-icons/tb";

const CameraView = () => {
  const [device, setDevice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const { deviceId } = useParams();
  const location = useLocation();
  const { status } = location.state || {};
  const navigate = useNavigate();
  const width = useBreakpointValue({ base: "100%" });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isToggled, setIsToggled] = React.useState(false);
  const [videoUrl, setVideoUrl] = useState([]);
  const [noStream, setNoStream] = useState(false);

  // --- Theme Tokens matching Global Design System ---
  const cardBg = useColorModeValue("#FFFFFF", "#1C222D");
  const cardBorder = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.08)");
  const titleColor = useColorModeValue("#1A2E3D", "#FFFFFF");
  const subtextColor = useColorModeValue("#64748B", "#94A3B8");

  const getResponsivePlayerStyle = () => ({
    width,
    height: "auto",
    aspectRatio: "16 / 9",
    borderRadius: "10px",
  });

  const fetchStreamDetails = async (deviceId) => {
    setIsLoading(true);
    try {
      const response = await getStreamDetails(deviceId);
      if (
        response.success &&
        response.streamData &&
        response.streamData.length > 0
      ) {
        setDevice(response.streamData[0]);
      } else {
        setDevice(null);
      }
    } catch (error) {
      console.error("Error fetching camera details:", error);
      setDevice(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => {
    setIsToggled(!isToggled);
    if (!isToggled) {
      onOpen();
    } else {
      onClose();
    }
  };

  const handleModalClose = () => {
    onClose();
    setIsToggled(false);
  };

  const handleBack = () => {
    try {
      setImageUrll(deviceId);
    } catch (error) {
      console.error("Error in handleBack:", error);
    } finally {
      navigate("/cameras");
    }
  };

  useEffect(() => {
    if (deviceId) {
      fetchStreamDetails(deviceId);
    }
  }, [deviceId]);

  useEffect(() => {
    if (!device || !device.deviceId) {
      return;
    }

    const fetchStreamData = async () => {
      try {
        const response = await axios.get(
          "https://zmedia.arcisai.io:443/rtmp/api/list"
        );
        const streamData = response.data;
        const matchedPaths = streamData
          .filter((item) => item.StreamName === `RTSP-${device.deviceId}`)
          .map((item) => item.Path);

        if (matchedPaths.length > 0) {
          setVideoUrl(matchedPaths);
          setNoStream(false);
        } else {
          setVideoUrl([]);
          setNoStream(true);
        }
      } catch (error) {
        console.error("Error fetching AI stream data:", error);
        setNoStream(true);
      }
    };

    fetchStreamData();
  }, [device]);

  if (isLoading) {
    return (
      <Flex justify="center" align="center" height="70vh" direction="column" gap={3}>
        <Spinner size="xl" color="#3F77A5" thickness="3px" />
        <Text fontFamily="'Manrope', sans-serif" fontSize="13px" color={subtextColor}>
          Loading camera details…
        </Text>
      </Flex>
    );
  }

  if (!device) {
    return (
      <Flex justify="center" align="center" height="70vh" direction="column" gap={3}>
        <Text fontFamily="'Manrope', sans-serif" fontSize="16px" fontWeight="700" color={titleColor}>
          Camera not found
        </Text>
        <Text fontFamily="'Manrope', sans-serif" fontSize="13px" color={subtextColor}>
          Failed to load stream details for this camera.
        </Text>
        <Button
          leftIcon={<RiArrowGoBackLine />}
          onClick={handleBack}
          size="sm"
          mt={2}
          bg="#3F77A5"
          color="white"
          _hover={{ bg: "#2B5273" }}
        >
          Back to Cameras
        </Button>
      </Flex>
    );
  }

  let url = "";
  if (device) {
    if (device.deviceId && device.deviceId.startsWith("SSAN")) {
      url = `wss://ptz.vmukti.com/live-record/${device.deviceId}.flv`;
    } else if (device.plan === "LIVE" && device.p2purl && device.token) {
      url = `https://${device.deviceId}.${device.p2purl}/flv/live_ch0_0.flv?verify=${device.token}`;
    } else if (device.mediaUrl) {
      url = `wss://${device.mediaUrl}/jessica/DVR/${device.deviceId}.flv`;
    }
  }

  return (
    <>
      <MobileHeader title="Camera View" />

      <Box
        maxW="1440px"
        mx="auto"
        px={{ base: "12px", sm: "16px", md: "20px", lg: "24px" }}
        py={{ base: "12px", md: "16px" }}
        mt={{ base: "12", md: "0" }}
        mb={{ base: "20", md: "6" }}
        fontFamily="'Manrope', sans-serif"
      >
        {/* Top Header Bar */}
        <Flex
          justifyContent="space-between"
          alignItems="center"
          flexDirection={{ base: "column", sm: "row" }}
          gap="12px"
          mb="16px"
        >
          {/* Camera Details & Badges */}
          <HStack spacing="12px" align="center" flexWrap="wrap">
            <Flex
              w="38px"
              h="38px"
              borderRadius="10px"
              bg="#3F77A518"
              color="#3F77A5"
              align="center"
              justify="center"
              flexShrink={0}
            >
              <TbCamera size="20px" />
            </Flex>
            <Flex direction="column">
              <HStack spacing="8px" align="center" flexWrap="wrap">
                <Text
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="700"
                  fontSize={{ base: "15px", md: "18px" }}
                  lineHeight="1.2"
                  color={titleColor}
                >
                  {device.cameraName || "Unnamed Camera"}
                </Text>
                {device.deviceId && (
                  <Badge
                    borderRadius="999px"
                    px="8px"
                    py="2px"
                    bg="#3F77A51A"
                    color="#3F77A5"
                    fontFamily="'Manrope', sans-serif"
                    fontWeight="700"
                    fontSize="11px"
                    textTransform="none"
                  >
                    {device.deviceId}
                  </Badge>
                )}
                {(() => {
                  const isOnline = Boolean(
                    status
                      ? ["online", "live", "connected", "1", "true"].includes(
                          String(status).trim().toLowerCase()
                        )
                      : device &&
                        (device.isLive === true ||
                          device.isLive === "true" ||
                          String(device.status || "").toLowerCase() === "online")
                  );
                  const displayStatus = status
                    ? String(status).toUpperCase()
                    : isOnline
                    ? "ONLINE"
                    : "OFFLINE";

                  return (
                    <Badge
                      borderRadius="999px"
                      px="8px"
                      py="2px"
                      bg={isOnline ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"}
                      color={isOnline ? "#10B981" : "#EF4444"}
                      fontFamily="'Manrope', sans-serif"
                      fontWeight="700"
                      fontSize="11px"
                      display="inline-flex"
                      alignItems="center"
                      gap="4px"
                      textTransform="uppercase"
                    >
                      <Box
                        w="5px"
                        h="5px"
                        borderRadius="full"
                        bg={isOnline ? "#10B981" : "#EF4444"}
                      />
                      {displayStatus}
                    </Badge>
                  );
                })()}
              </HStack>
            </Flex>
          </HStack>

          {/* Back Button */}
          <Button
            leftIcon={<RiArrowGoBackLine />}
            onClick={handleBack}
            h="36px"
            px="16px"
            borderRadius="8px"
            borderWidth="1px"
            borderColor={cardBorder}
            bg={cardBg}
            color={titleColor}
            fontFamily="'Manrope', sans-serif"
            fontWeight="600"
            fontSize="13px"
            _hover={{ bg: "#3F77A512", borderColor: "#3F77A5", color: "#3F77A5" }}
            transition="all 0.15s ease"
          >
            Back to Cameras
          </Button>
        </Flex>

        {/* Main Card Container Wrapper */}
        <Box
          bg={cardBg}
          borderWidth="1px"
          borderColor={cardBorder}
          borderRadius="14px"
          p={{ base: "12px", md: "16px" }}
          boxShadow="0px 1px 6px 0px rgba(26, 46, 61, 0.07)"
        >
          {device.deviceId && device.deviceId.startsWith("SSAN") ? (
            <Box
              position="relative"
              borderRadius="10px"
              overflow="hidden"
              bg="black"
              w="100%"
            >
              <SimpleFLVPlayer
                url={url}
                style={getResponsivePlayerStyle()}
              />
            </Box>
          ) : (
            <Player
              device={device}
              initialPlayUrl={url}
              style={getResponsivePlayerStyle()}
              width="100%"
              height="100%"
              status={status}
              showControls={true}
              className=""
            />
          )}
        </Box>
      </Box>

      {/* Modal for AI Streams */}
      {isToggled && (
        <Modal isOpen={isOpen} onClose={handleModalClose} size="full">
          <ModalOverlay />
          <ModalContent bg={cardBg}>
            <ModalCloseButton
              position="absolute"
              top="10px"
              right="10px"
              zIndex="10"
              color="red.500"
            />
            <ModalBody p={4}>
              <SimpleGrid columns={2} spacing={3}>
                {device.deviceId && device.deviceId.startsWith("SSAN") ? (
                  <SimpleFLVPlayer
                    url={url}
                    style={{ width: "48vw", height: "55vh" }}
                  />
                ) : (
                  <Player
                    device={device}
                    style={{ width: "48vw", height: "55vh" }}
                    initialPlayUrl={url}
                    showControls={false}
                  />
                )}
                
                {videoUrl.map((aiurl, index) => (
                  <Player
                    key={index}
                    device={device}
                    style={{ width: "48vw", height: "55vh" }}
                    initialPlayUrl={`https://zmedia.arcisai.io:443/jessica/${aiurl}.flv`}
                    showControls={false}
                  />
                ))}
              </SimpleGrid>
            </ModalBody>
          </ModalContent>
        </Modal>
      )}
    </>
  );
};

export default CameraView;
