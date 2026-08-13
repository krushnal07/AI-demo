import React, { useEffect, useRef, useState, useCallback } from "react";
import JessibucaPlayer from "react-jessibuca";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Image,
  Button,
  ModalFooter,
  useDisclosure,
  Box,
  Flex,
  Text,
  HStack,
  IconButton,
  useColorModeValue,
  Spinner,
} from "@chakra-ui/react";
import { FaVolumeUp, FaVolumeMute, FaSignal } from "react-icons/fa";
import { BsArrowsFullscreen } from "react-icons/bs";
import axios from "axios";
import PlayerControls from "./PlayerControls";
import ImageMask from "./ImageMask";
import { useLocation } from "react-router-dom";
import CameraPTZ from "./CameraPTZ";

const RECONNECT_DELAY_MS = 3000; // 3 seconds before each retry

const Player = React.forwardRef(({
  device,
  initialPlayUrl,
  className,
  style,
  showControls,
  width,
  height,
  status,
  showOverlay,
  overlayData,
  muted, // Prop passed from MultipleView to handle pagination resets
}, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [playUrl, setPlayUrl] = useState(initialPlayUrl);
  const jessibucaRef = useRef(null);
  const containerRef = useRef(null);

  const [error, setError] = useState(null);
  const forceNoOffscreen = false;
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [screenshotUrl, setScreenshotUrl] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCameraPTZ, setShowCameraPTZ] = useState(false);
  const location = useLocation();
  const [zoomIndex, setZoomIndex] = useState(0);
  const [volume, setVolume] = useState(50);

  // Logic: All cameras start muted by default
  const [isMuted, setIsMuted] = useState(true);

  // Auto-reconnect state
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const isUnmountedRef = useRef(false); // guard against setState after unmount

  // Clear any pending reconnect timer
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  // Core reconnect: destroy → wait → recreate → play
  const scheduleReconnect = useCallback((currentPlayUrl) => {
    if (isUnmountedRef.current || !currentPlayUrl) return;
    clearReconnectTimer();
    setIsReconnecting(true);
    setIsPlaying(false);

    reconnectTimerRef.current = setTimeout(async () => {
      if (isUnmountedRef.current) return;
      reconnectAttemptsRef.current += 1;

      try {
        // Destroy old instance
        if (jessibucaRef.current) {
          await jessibucaRef.current.destroy();
          jessibucaRef.current = null;
        }

        if (isUnmountedRef.current) return;

        // Re-create and play
        if (currentPlayUrl.includes("hdl" && "jessica")) {
          createPlayer(currentPlayUrl);
          playStream(currentPlayUrl);
        } else {
          // For JessibucaPlayer (react-jessibuca), just toggling src triggers replay
          // Force a re-play via ref if available
          if (containerRef.current?.play) {
            containerRef.current.play(currentPlayUrl);
          }
          setIsPlaying(true);
          setIsReconnecting(false);
        }
      } catch (e) {
        // If reconnect fails, schedule another attempt
        if (!isUnmountedRef.current) {
          scheduleReconnect(currentPlayUrl);
        }
      }
    }, RECONNECT_DELAY_MS);
  }, [clearReconnectTimer]);

  // Sync state with parent prop (MultipleView pagination reset)
  // This ensures that when you change pages, the player engine is explicitly told to be silent.
  useEffect(() => {
    if (muted !== undefined) {
      setIsMuted(muted);

      const playerInstance = jessibucaRef.current || containerRef.current;
      if (playerInstance) {
        if (muted) {
          if (playerInstance.mute) playerInstance.mute();
          if (playerInstance.player) playerInstance.player.volume = 0;
        } else {
          // Unmuting requires browser audio context activation
          if (playerInstance.cancelMute) playerInstance.cancelMute();
          if (playerInstance.player) playerInstance.player.volume = volume / 100;
        }
      }
    }
  }, [muted]);

  React.useImperativeHandle(ref, () => ({
    zoomIn: () => zoomIn(),
    zoomOut: () => zoomOut(),
    handleFullscreen: () => handleFullscreen()
  }));

  useEffect(() => {
    if (initialPlayUrl) {
      setPlayUrl(initialPlayUrl);
    }
  }, [initialPlayUrl]);

  // Cleanup on route change
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      clearReconnectTimer();
      destroy();
    };
  }, [location]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      clearReconnectTimer();
    };
  }, []);

  useEffect(() => {
    const handlePlayUrlChange = async () => {
      clearReconnectTimer();
      reconnectAttemptsRef.current = 0;
      setIsReconnecting(false);

      if (jessibucaRef.current) {
        await destroy();
      }
      if (playUrl) {
        if (playUrl.includes("hdl" && "jessica")) {
          createPlayer(playUrl);
          playStream(playUrl);
        } else {
          setIsPlaying(true);
        }
      }
    };
    handlePlayUrlChange();
  }, [playUrl]);

  const createPlayer = useCallback((url) => {
    if (!containerRef.current || !(containerRef.current instanceof HTMLElement)) return;

    jessibucaRef.current = new window.JessibucaPro({
      container: containerRef.current,
      decoder: "/js/decoder-pro.js",
      useMSE: true,
      videoBuffer: 0.2,
      isResize: false,
      text: "ArcisAI",
      loadingText: "Loading",
      debug: false,
      zooming: true,
      operateBtns: {},
      forceNoOffscreen: forceNoOffscreen,
      isNotMute: !isMuted, // Sync with current state
    });

    if (jessibucaRef.current.on) {
      // ✅ Stream is rendering fine — clear reconnect state
      jessibucaRef.current.on("start", () => {
        if (!isUnmountedRef.current) {
          setIsReconnecting(false);
          setIsPlaying(true);
          reconnectAttemptsRef.current = 0;
          clearReconnectTimer();
        }
      });

      // ❌ Stream stopped / timed out — schedule reconnect
      jessibucaRef.current.on("timeout", () => {
        if (!isUnmountedRef.current) scheduleReconnect(url);
      });
      jessibucaRef.current.on("loadingTimeout", () => {
        if (!isUnmountedRef.current) scheduleReconnect(url);
      });
      jessibucaRef.current.on("delayTimeout", () => {
        if (!isUnmountedRef.current) scheduleReconnect(url);
      });
      jessibucaRef.current.on("error", () => {
        if (!isUnmountedRef.current) scheduleReconnect(url);
      });

      jessibucaRef.current.on("ptz", (arrow) => {
        const ptzParams = {
          "-step": 0,
          "-act": arrow,
          "-speed": 3,
          "-presetNUM": 1,
          deviceId: `${device.deviceId}.torqueverse.dev`,
        };
        const authHeader = "Basic " + btoa(`admin:`);
        axios.post("https://adiance-portal-backend-7d9tj.ondigitalocean.app/p2p/ptz", ptzParams, {
          headers: { "Content-Type": "application/json", Authorization: authHeader },
        });
      });
    }
  }, [device.deviceId, forceNoOffscreen, isMuted, clearReconnectTimer, scheduleReconnect]);

  // Keep old name for backward-compat references
  const create = useCallback(() => createPlayer(playUrl), [createPlayer, playUrl]);

  const playStream = useCallback((url) => {
    if (jessibucaRef.current && url) {
      jessibucaRef.current.play(url);
      setIsPlaying(true);
    } else if (containerRef.current && containerRef.current.play) {
      containerRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const play = useCallback(() => playStream(playUrl), [playStream, playUrl]);

  const pause = useCallback(() => {
    if (jessibucaRef.current) {
      jessibucaRef.current.pause();
    } else if (containerRef.current && containerRef.current.pause) {
      containerRef.current.pause();
    }
    setIsPlaying(false);
  }, []);

  const destroy = useCallback(async () => {
    clearReconnectTimer();
    if (jessibucaRef.current) {
      try {
        await jessibucaRef.current.destroy();
      } catch (e) {
        // jessibuca-pro can throw a benign PressureObserver AbortError while
        // tearing down. Swallow it so it doesn't surface as an app error.
      }
      jessibucaRef.current = null;
      setIsPlaying(false);
    }
  }, [clearReconnectTimer]);

  const handleFullscreen = async () => {
    try {
      const player = jessibucaRef.current || containerRef.current;
      if (player) player.setFullscreen(true);
    } catch (error) {
      setError("Fullscreen failed: " + error.message);
    }
  };

  const handleRecording = async () => {
    try {
      const player = jessibucaRef.current || containerRef.current;
      if (player) {
        if (isRecording) {
          await player.stopRecordAndSave();
          setIsRecording(false);
        } else {
          const fileName = `${new Date().toISOString().replace(/[:.-]/g, "")}`;
          jessibucaRef.current ? await player.startRecord() : await player.startRecord(fileName, "mp4");
          setIsRecording(true);
        }
      }
    } catch (error) {
      setError("Recording failed: " + error.message);
    }
  };

  const zoomIn = () => {
    const player = jessibucaRef.current || containerRef.current;
    if (player?.expandZoom) {
      if (player.player) player.player.zooming = true;
      player.expandZoom();
      setZoomIndex(zoomIndex + 1);
    }
  };

  const zoomOut = () => {
    const player = jessibucaRef.current || containerRef.current;
    if (player?.narrowZoom) {
      if (zoomIndex > 0) setZoomIndex(zoomIndex - 1);
      player.narrowZoom();
    }
  };

  useEffect(() => {
    const player = jessibucaRef.current || containerRef.current;
    if (zoomIndex === 0 && player?.player) {
      player.player.zooming = false;
    }
  }, [zoomIndex]);

  const handleScreenshot = () => {
    try {
      const player = jessibucaRef.current || containerRef.current;
      if (player) {
        const file = player.screenshot("test", "blob");
        const url = URL.createObjectURL(file);
        const link = document.createElement("a");
        link.href = url;
        link.download = "screenshot.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      setError("Screenshot failed: " + error.message);
    }
  };

  const handleSegmentation = () => {
    try {
      const player = jessibucaRef.current || containerRef.current;
      if (player) {
        const file = player.screenshot("test", "blob");
        const url = URL.createObjectURL(file);
        setScreenshotUrl(url);
        setIsModalOpen(true);
        onOpen();
      }
    } catch (error) {
      console.error("Screenshot failed:", error.message);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    if (screenshotUrl) {
      URL.revokeObjectURL(screenshotUrl);
      setScreenshotUrl(null);
    }
  };

  const handleUrlChange = (newUrl) => setPlayUrl(newUrl);
  const toggleCameraPTZ = () => setShowCameraPTZ((prevState) => !prevState);

  const handleVolumeChange = (val) => {
    setVolume(val);
    const normalizedVolume = val / 100;
    const player = jessibucaRef.current || containerRef.current;
    if (player?.player) {
      player.player.volume = normalizedVolume;
      setIsMuted(normalizedVolume === 0);
    }
  };

  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    const player = jessibucaRef.current || containerRef.current;

    if (player) {
      if (newMuteState) {
        if (player.mute) player.mute(); // Jessibuca Native Mute
        if (player.player) player.player.volume = 0;
      } else {
        if (player.cancelMute) player.cancelMute(); // Jessibuca Native Audio Context Unlock
        if (player.player) player.player.volume = volume / 100;
      }
    }
  };

  const handlePlayPause = async () => {
    if (isPlaying) {
      pause();
    } else {
      clearReconnectTimer();
      setIsReconnecting(false);
      await destroy();
      createPlayer(playUrl);
      playStream(playUrl);
    }
  };

  const footerTextColor = useColorModeValue("black", "white");
  const footerBg = useColorModeValue(
    "linear-gradient(to top, rgba(255, 255, 255, 0.95) 0%, rgba(200, 230, 255, 0.75) 1%, transparent 100%)",
    "linear-gradient(to top, rgba(13, 108, 153, 0.95) 0%, rgba(150, 205, 230, 0.75) 1%, transparent 100%)"
  );
  const footerTextShadow = useColorModeValue("none", "1px 1px 2px rgba(0,0,0,0.8)");

  return (
    <Box position="relative" width={width} height="auto" overflow="visible">
      {showCameraPTZ && <CameraPTZ deviceId={device.deviceId} />}

      {playUrl && playUrl.includes("hdl" && "jessica") ? (
        <Box display="flex" justifyContent="center" className="container-shell">
          <Box id="container" ref={containerRef} className={className} style={style}></Box>
        </Box>
      ) : playUrl && (playUrl.includes("record") || playUrl.includes("blob.core.windows.net") || playUrl.includes("storage.googleapis.com") || playUrl.includes(".mp4")) ? (
        <Box position="relative" width={width} height={height}>
          <video style={style} autoPlay controls muted={isMuted} src={playUrl} />
        </Box>
      ) : (
        <JessibucaPlayer
          ref={containerRef}
          decodeMode="useMSE"
          style={{ ...style, background: 'transparent' }}
          controls={false}
          muted={isMuted}
          loadingText="loading"
          src={playUrl}
          decoder="/decoder.js"
          onStart={() => {
            if (!isUnmountedRef.current) {
              setIsReconnecting(false);
              setIsPlaying(true);
              reconnectAttemptsRef.current = 0;
              clearReconnectTimer();
            }
          }}
          onTimeout={() => {
            if (!isUnmountedRef.current) scheduleReconnect(playUrl);
          }}
          onLoadingTimeout={() => {
            if (!isUnmountedRef.current) scheduleReconnect(playUrl);
          }}
          onDelayTimeout={() => {
            if (!isUnmountedRef.current) scheduleReconnect(playUrl);
          }}
          onError={() => {
            if (!isUnmountedRef.current) scheduleReconnect(playUrl);
          }}
        />

      )}

      {showControls && (
        <PlayerControls
          device={device}
          onFullscreen={handleFullscreen}
          onScreenshot={handleScreenshot}
          onRecording={handleRecording}
          isRecording={isRecording}
          onSegment={handleSegmentation}
          handlePlayPause={handlePlayPause}
          isPlaying={isPlaying}
          handleSegmentation={handleSegmentation}
          onUrlChange={handleUrlChange}
          status={status}
          toggleCameraPTZ={toggleCameraPTZ}
          zoomIn={zoomIn}
          zoomOut={zoomOut}
          handleVolumeChange={handleVolumeChange}
          toggleMute={toggleMute}
          volume={volume}
          isMuted={isMuted}
        />
      )}

      {/* ── Auto-reconnect spinner overlay ─────────────────────────────────── */}
      {isReconnecting && (
        <Box
          position="absolute"
          top="0"
          left="0"
          right="0"
          bottom="0"
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          zIndex={50}
          pointerEvents="none"
        >
          {/* <Spinner
            thickness="3px"
            speed="0.75s"
            emptyColor="rgba(255,255,255,0.2)"
            color="blue.300"
            size="md"
          />
          <Text
            mt={2}
            fontSize="10px"
            color="whiteAlpha.800"
            fontWeight="semibold"
            letterSpacing="0.5px"
            textShadow="0 1px 3px rgba(0,0,0,0.8)"
          >
            Reconnecting…
          </Text> */}
        </Box>
      )}
      {/* ───────────────────────────────────────────────────────────────────── */}

      {showOverlay && overlayData && (
        <Box position="absolute" top="0" left="0" right="0" bottom="0" pointerEvents="none" zIndex="10" p={2} color="white">
          <Box position="absolute" bottom="0" left="0" right="0" background={footerBg} px={3} py={2.5} zIndex="11">
            <Flex justifyContent="space-between" alignItems="center">
              <Box maxW="85%">
                <Text fontWeight="bold" fontSize="xs" color={footerTextColor} textShadow={footerTextShadow}>
                  {overlayData.dist_name} / {overlayData.accName} / {overlayData.deviceId} / {overlayData.operatorName} / {overlayData.operatorMobile}
                </Text>
              </Box>
              <HStack spacing={2} pointerEvents="auto">
                <IconButton
                  icon={isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
                  size="xs"
                  minW="30px" // Fix for icon stability
                  variant="solid"
                  bg="rgba(0,0,0,0.6)"
                  _hover={{ bg: "black" }}
                  onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                  aria-label="Toggle Mute"
                  color="white"
                />
                <IconButton
                  icon={<BsArrowsFullscreen />}
                  size="xs"
                  minW="30px"
                  variant="solid"
                  bg="rgba(0,0,0,0.6)"
                  _hover={{ bg: "black" }}
                  onClick={(e) => { e.stopPropagation(); handleFullscreen(); }}
                  aria-label="Fullscreen"
                  color="white"
                />
              </HStack>
            </Flex>
          </Box>
        </Box>
      )}

      <Modal isOpen={isOpen} onClose={onClose} size="6xl" isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Screenshot with Segmentation</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Box position="relative" width="100%">
              <ImageMask screenshotUrl={screenshotUrl} device={device} />
            </Box>
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
});

export default Player;
