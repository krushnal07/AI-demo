import React, { useEffect, useState, useRef } from "react";
import {
  Box,
  Flex,
  Tabs,
  TabList,
  Tab,
  HStack,
  IconButton,
  Text,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Button,
  Tooltip,
  useColorModeValue,
  useDisclosure,
  background,
  useBreakpointValue,
  Divider,
  MenuDivider,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  Select,
  Switch,
  Grid,
} from "@chakra-ui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
import {
  FaVolumeUp,
  FaVolumeMute,
  FaCircle,
  FaSquare,
  FaPlay,
  FaPause,
  FaSearchPlus,
  FaSearchMinus,
} from "react-icons/fa";
import {
  FiZoomIn,
  FiZoomOut,
  FiSettings,
  FiEdit2,
  FiTrash2,
  FiDatabase,
} from "react-icons/fi";
import { RiForward5Line } from "react-icons/ri";
import { MdControlCamera } from "react-icons/md";
import { BsArrowsFullscreen, BsThreeDotsVertical } from "react-icons/bs";
import { TbCapture } from "react-icons/tb";
import { LuBrainCog } from "react-icons/lu";
import EdgeTimeline from "edge-timeline-component";
import AzureTimeline from "./AzureTimeline";
import "react-datepicker/dist/react-datepicker.css";
import DatePicker from "react-datepicker";
import { SlCalender } from "react-icons/sl";
import { useNavigate } from "react-router-dom";
import theme from "../theme";
import AudioRecorder from "./AudioRecorder";
import {
  getVideoSettings,
  getImageInfo,
  setVideoSettings,
  setImageInfo,
  getVideoEncodeChannelMain,
  setVideoEncodeChannelMain,
  getVideoEncodeChannelSub,
  setVideoEncodeChannelSub,
  rebootCamera,
} from "../actions/settingsActions";
import { updateCamera, removeUserCamera } from "../actions/cameraActions";

const PlayerControls = ({
  device = {},
  // play,
  // pause,
  handlePlayPause,
  isPlaying,
  isRecording,
  onRecording,
  onFullscreen,
  // onVolumeToggle,
  // isMuted,
  onScreenshot,
  handleSegmentation,
  url: initialUrl,
  onUrlChange,
  status,
  toggleCameraPTZ,
  zoomIn,
  zoomOut,
  handleVolumeChange,
  toggleMute,
  volume,
  isMuted,
  currentVideoTime,
  playUrl,
  onDeviceUpdate,
  // handleGoLive,
}) => {
  const toast = useToast();
  const navigate = useNavigate();

  // Active modal: null | "Camera Settings" | "Rename Device" | "Remove Camera"
  const [activeModal, setActiveModal] = useState(null);
  const [activeSettingsTab, setActiveSettingsTab] = useState("Video settings");
  const [cameraRenameInput, setCameraRenameInput] = useState("");

  // Video settings state
  const [streamType, setStreamType] = useState("main");
  const [bitRate, setBitRate] = useState("");
  const [frameRate, setFrameRate] = useState("");
  const [codecType, setCodecType] = useState("");
  const [bitRateType, setBitRateType] = useState("");
  const [resolution, setResolution] = useState("");

  // Media / Image settings state
  const [irCutMode, setIrCutMode] = useState("auto");
  const [brightness, setBrightness] = useState(50);
  const [contrast, setContrast] = useState(50);
  const [saturation, setSaturation] = useState(50);
  const [sharpness, setSharpness] = useState(50);
  const [hue, setHue] = useState(50);
  const [mirror, setMirror] = useState(false);
  const [flip, setFlip] = useState(false);

  // Wifi settings state
  const [wifiName, setWifiName] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");

  const modalBg = useColorModeValue("#FFFFFF", "#1C222D");
  const modalBorderColor = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.08)");
  const sliderTrackBg = useColorModeValue("#E2E8EF", "#2D3748");
  const dataConsumedBg = useColorModeValue("#F8FAFC", "#222936");
  const dataConsumedBorder = useColorModeValue("#E2E8F0", "rgba(255, 255, 255, 0.06)");
  const saveBtnBg = "#3F77A5";
  const saveBtnColor = "#FFFFFF";
  const [selectedDate, setSelectedDate] = useState(getCurrentISTDate());
  const [url, setUrl] = useState(initialUrl || playUrl);
  const datePickerRef = useRef(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  function getCurrentISTDate() {
    const now = new Date();
    const options = {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    };
    const formattedDate = now.toLocaleDateString("en-IN", options);
    return formattedDate.split("/").reverse().join("-"); // Convert DD/MM/YYYY to YYYY-MM-DD
  }
  const handleDateChange = (date) => {
    // Ensure date is a valid Date object
    const dateObj = date instanceof Date ? date : new Date(date);
    if (!isNaN(dateObj.getTime())) {
      // Convert to IST and format date to YYYY-MM-DD
      const options = {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      };
      const formattedDate = dateObj.toLocaleDateString("en-IN", options);
      setSelectedDate(formattedDate.split("/").reverse().join("-"));
    } else {
      console.error("Invalid date:", date);
    }
  };
  const updateUrl = (newUrl, offsetSec = 0) => {
    setUrl(newUrl);
    if (onUrlChange) {
      onUrlChange(newUrl, offsetSec); // Notify the parent component
    }
  };

  useEffect(() => {
    setUrl(initialUrl || playUrl); // Update local URL state if initialUrl/playUrl changes
  }, [initialUrl, playUrl]);

  const handlePtzControlClick = () => {
    const ptzElement = document.querySelector(".jessibuca-ptz-controls");
    if (ptzElement) {
      ptzElement.classList.toggle("jessibuca-ptz-controls-show");
    }
  };

  // const togglePlayPause = () => {
  //   if (isPlaying) {
  //     pause();
  //   } else {
  //     play();
  //   }
  // };

  const toggleCalendar = () => {
    setCalendarOpen(!calendarOpen);
  };

  const [showTimelIne, setShowTimeLine] = useState("cloud");
  const [isOn, setIsOn] = useState(false);

  // const toggle = () => {
  //   setIsOn(!isOn);
  // };

  const toggle = (tabName) => {
    if (showTimelIne !== tabName) {
      setIsOn(!isOn);
      setShowTimeLine(tabName);
    }
  };
  const handlePreviousDay = () => {
    const currentDate = new Date(selectedDate); // Convert to Date
    if (!isNaN(currentDate.getTime())) {
      currentDate.setDate(currentDate.getDate() - 1); // Go to the previous day
      handleDateChange(currentDate); // Update selected date
    } else {
      console.error("Invalid selected date:", selectedDate);
    }
  };

  const handleNextDay = () => {
    const currentDate = new Date(selectedDate); // Convert to Date
    if (!isNaN(currentDate.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset time on today's date
      if (currentDate < today) {
        currentDate.setDate(currentDate.getDate() + 1); // Go to the next day
        handleDateChange(currentDate); // Update selected date
      }
    } else {
      console.error("Invalid selected date:", selectedDate);
    }
  };

  const events = [
    { label: "Motion Detection", shortLabel: "MD", color: "#A689FA" },
    { label: "Human Detection", shortLabel: "HD", color: "#E87BF9" },
    { label: "Face Detection", shortLabel: "FD", color: "#FDDF49" },
    { label: "Linecross Detection", shortLabel: "LD", color: "#E7B008" },
    { label: "Region-Enter Detection", shortLabel: "RE", color: "#FF6262" },
    { label: "Region-Exit Detection", shortLabel: "RX", color: "#FF6262" },
    { label: "Unattended Detection", shortLabel: "UD", color: "#FDBA72" },
    { label: "MissingObject Detection", shortLabel: "MO", color: "#7ED4FC" },
  ];

  const labelType = useBreakpointValue({ base: "shortLabel", md: "label" });
  // const direction = useBreakpointValue({ base: "column", sm: "row" });

  const tabActiveColor = "#FFFFFF";
  const tabInactiveColor = useColorModeValue("#64748B", "#94A3B8");
  const bgColor = "#3F77A5";
  const textColor = useColorModeValue("#1A2E3D", "#FFFFFF");
  const selectedTab = "#3F77A5";
  const controlsBg = useColorModeValue("#F8FAFC", "#161C26");
  const controlsBorder = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.08)");
  const menuBg = useColorModeValue("#FFFFFF", "#1C222D");
  const menuBorder = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.08)");
  const menuHoverBg = useColorModeValue("#F1F5F9", "#252D3A");

  const [totalData, setTotalData] = useState(0);

  const handleTotalDataChange = (data) => {
    setTotalData(data);
  };

  const fetchSettingsData = async () => {
    const devId = device?.deviceId;
    if (!devId) return;
    try {
      if (activeSettingsTab === "Media" || activeSettingsTab === "Image settings") {
        const response = await getVideoSettings(devId);
        const response2 = await getImageInfo(devId);
        if (response2?.irCutMode) setIrCutMode(response2.irCutMode);
        if (response) {
          if (response.brightnessLevel !== undefined) setBrightness(response.brightnessLevel);
          if (response.contrastLevel !== undefined) setContrast(response.contrastLevel);
          if (response.saturationLevel !== undefined) setSaturation(response.saturationLevel);
          if (response.sharpnessLevel !== undefined) setSharpness(response.sharpnessLevel);
          if (response.hueLevel !== undefined) setHue(response.hueLevel);
          if (response.mirrorEnabled !== undefined) setMirror(response.mirrorEnabled);
          if (response.flipEnabled !== undefined) setFlip(response.flipEnabled);
        }
      } else if (activeSettingsTab === "Video settings") {
        const response = streamType === "main"
          ? await getVideoEncodeChannelMain(devId)
          : await getVideoEncodeChannelSub(devId);
        if (response) {
          setBitRate(response.constantBitRate || "");
          setFrameRate(response.frameRate || "");
          setCodecType(response.codecType || "");
          setResolution(response.resolution || "");
          setBitRateType(response.bitRateControlType || "");
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ${activeSettingsTab} settings:`, error);
    }
  };

  useEffect(() => {
    if (activeModal === "Camera Settings") {
      fetchSettingsData();
    }
  }, [activeModal, activeSettingsTab, streamType, device?.deviceId]);

  const handleOpenSettings = () => {
    setActiveSettingsTab("Video settings");
    setActiveModal("Camera Settings");
  };

  const handleOpenRename = () => {
    setCameraRenameInput(device?.name || device?.cameraName || device?.deviceId || "");
    setActiveModal("Rename Device");
  };

  const handleOpenRemoveCamera = () => {
    setActiveModal("Remove Camera");
  };

  const closeModal = () => {
    setActiveModal(null);
  };

  const handleVideoEncodeSave = async () => {
    const devId = device?.deviceId;
    if (!devId) return;
    try {
      if (streamType === "main") {
        await setVideoEncodeChannelMain(devId, codecType, resolution, bitRateType, bitRate, frameRate);
      } else {
        await setVideoEncodeChannelSub(devId, codecType, resolution, bitRateType, bitRate, frameRate);
      }
      toast({
        title: "Video Settings Updated Successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      closeModal();
    } catch (error) {
      console.error("Error updating camera video settings:", error);
      toast({
        title: "Failed to update video settings",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleMediaSettingsSave = async () => {
    const devId = device?.deviceId;
    if (!devId) return;
    try {
      await setImageInfo(devId, irCutMode);
      await setVideoSettings(
        devId,
        brightness,
        contrast,
        saturation,
        sharpness,
        hue,
        mirror,
        flip
      );
      toast({
        title: "Settings Updated Successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      closeModal();
    } catch (error) {
      console.error("Error updating image settings:", error);
      toast({
        title: "Failed to update image settings",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleReboot = async () => {
    const devId = device?.deviceId;
    if (!devId) return;
    try {
      await rebootCamera(devId);
      toast({
        title: "Camera Rebooted Successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      closeModal();
    } catch (error) {
      console.error("Error rebooting camera:", error);
      toast({
        title: "Failed to reboot camera",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleWifiSettingsSave = async () => {
    const payload = {
      wirelessMode: "stationMode",
      stationMode: {
        wirelessStaMode: "802.11bgn mixed",
        wirelessApBssId: "123456",
        wirelessApEssId: wifiName,
        wirelessApPsk: wifiPassword,
        wirelessFixedBpsModeEnabled: false,
      },
    };

    try {
      const res = await fetch("/netsdk/Network/Interface/4/Wireless", {
        method: "PUT",
        headers: {
          Authorization: "Basic YWRtaW46",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast({
          title: "Wifi Settings Updated Successfully",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        closeModal();
      } else {
        throw new Error("Failed to update Wifi settings");
      }
    } catch (error) {
      toast({
        title: "Failed to update Wifi settings",
        description: error.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleSaveRename = async () => {
    if (!cameraRenameInput.trim()) return;
    try {
      const idToUpdate = device?._id || device?.id || device?.deviceId;
      await updateCamera(idToUpdate, cameraRenameInput.trim());
      if (device) {
        device.name = cameraRenameInput.trim();
        device.cameraName = cameraRenameInput.trim();
      }
      if (onDeviceUpdate) {
        onDeviceUpdate(cameraRenameInput.trim());
      }
      toast({
        title: "Device Renamed Successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      closeModal();
    } catch (error) {
      console.error("Error updating camera name:", error);
      toast({
        title: "Failed to rename device",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const handleConfirmRemoveCamera = async () => {
    const devId = device?.deviceId;
    if (!devId) return;
    try {
      await removeUserCamera(devId);
      toast({
        title: "Camera Removed Successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      closeModal();
      navigate("/cameras");
    } catch (error) {
      console.error("Error removing camera:", error);
      toast({
        title: "Failed to remove camera",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <>
      <style jsx>
        {`
          .dateInput {
            background-color: unset;
            width: 82px;
            font-family: 'Manrope', sans-serif;
            font-weight: 700;
            font-size: 11.5px;
            color: inherit;
            cursor: pointer;
          }

          .react-datepicker__day--selected {
            background-color: ${bgColor} !important;
            color: #ffffff !important;
            border-radius: 6px;
          }
        `}
      </style>

      <Box
        borderRadius="8px"
        width="100%"
        mx="auto"
        mt="6px"
        p="6px 10px"
        bg={controlsBg}
        borderWidth="1px"
        borderColor={controlsBorder}
        fontFamily="'Manrope', sans-serif"
        color={textColor}
      >
        <Flex
          direction={{ base: "column", md: "row" }}
          alignItems={{ base: "flex-start", md: "center" }}
          justifyContent="space-between"
          flexWrap="wrap"
          gap={{ base: 3, md: 2 }}
        >
          {/* First Part (Tabs and Date Navigation) */}
          <Box width={{ base: "100%", md: "auto" }}>
            <Flex alignItems="center" gap="8px" flexWrap="wrap">
              <Tabs
                variant="unstyled"
                size="sm"
              >
                <TabList bg={useColorModeValue("#E8EFF7", "rgba(255,255,255,0.06)")} p="2px" borderRadius="6px">
                  <Tab
                    _selected={{
                      bg: selectedTab,
                      color: tabActiveColor,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                    }}
                    px="10px"
                    py="2px"
                    borderRadius="5px"
                    textAlign="center"
                    color={tabInactiveColor}
                    fontFamily="'Manrope', sans-serif"
                    fontWeight="700"
                    fontSize="11px"
                    onClick={() => toggle("cloud")}
                  >
                    Cloud
                  </Tab>
                </TabList>
              </Tabs>
              <HStack spacing="2px" align="center" bg={useColorModeValue("#FFFFFF", "#1C222D")} px="6px" py="2px" borderRadius="6px" borderWidth="1px" borderColor={controlsBorder}>
                <Tooltip label="Previous Day" aria-label="Previous Day Tooltip" hasArrow>
                  <IconButton
                    icon={<ChevronLeftIcon />}
                    aria-label="Previous Day"
                    variant="unstyled"
                    size="xs"
                    h="18px"
                    w="18px"
                    minW="18px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    color={tabInactiveColor}
                    _hover={{ color: "#3F77A5" }}
                    onClick={handlePreviousDay}
                  />
                </Tooltip>
                <DatePicker
                  selected={selectedDate}
                  onChange={handleDateChange}
                  dateFormat="yyyy-MM-dd"
                  className="dateInput"
                  disabled
                  ref={datePickerRef}
                  open={calendarOpen}
                  onClickOutside={() => setCalendarOpen(false)}
                  maxDate={new Date()}
                />
                <IconButton
                  icon={<SlCalender size="11px" />}
                  aria-label="Select Date"
                  variant="unstyled"
                  size="xs"
                  h="18px"
                  w="18px"
                  minW="18px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  color={tabInactiveColor}
                  _hover={{ color: "#3F77A5" }}
                  onClick={toggleCalendar}
                />
                <Tooltip label="Next Day" aria-label="Next Day Tooltip" hasArrow>
                  <IconButton
                    icon={<ChevronRightIcon />}
                    aria-label="Next Day"
                    variant="unstyled"
                    size="xs"
                    h="18px"
                    w="18px"
                    minW="18px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    color={tabInactiveColor}
                    _hover={{ color: "#3F77A5" }}
                    onClick={handleNextDay}
                  />
                </Tooltip>
              </HStack>
            </Flex>
          </Box>

          {/* Second Part (Playback Controls and Options) */}
          <Flex
            alignItems="center"
            justifyContent={{ base: "space-between", md: "flex-start" }}
            gap={{ base: 2, md: 3 }}
            w={{ base: "100%", md: "auto" }}
          >
            <HStack
              spacing={2}
              justifyContent={{ base: "space-between", md: "flex-start" }}
              w={{ base: "100%", md: "auto" }}
            >
              <Tooltip
                label={isPlaying ? "Pause" : "Play"}
                aria-label="Play/Pause Tooltip"
                hasArrow
              >
                <IconButton
                  icon={
                    isPlaying ? (
                      <FaPause size="11px" />
                    ) : (
                      <FaPlay size="11px" style={{ marginLeft: "1px" }} />
                    )
                  }
                  aria-label="Play/Pause"
                  size="xs"
                  h="26px"
                  w="26px"
                  minW="26px"
                  borderRadius="6px"
                  bg={isPlaying ? "red.500" : "#3F77A5"}
                  color="white"
                  _hover={{ bg: isPlaying ? "red.600" : "#2B5273" }}
                  onClick={handlePlayPause}
                />
              </Tooltip>

              <Box display="flex" alignItems="center" gap={1.5} bg={useColorModeValue("#FFFFFF", "#1C222D")} px="6px" py="2px" borderRadius="6px" borderWidth="1px" borderColor={controlsBorder}>
                <Tooltip
                  label={isMuted ? "Unmute" : "Mute"}
                  aria-label="Mute Tooltip"
                  hasArrow
                >
                  <IconButton
                    icon={
                      isMuted ? (
                        <FaVolumeMute size="12px" />
                      ) : (
                        <FaVolumeUp size="12px" />
                      )
                    }
                    aria-label="Volume"
                    variant="unstyled"
                    size="xs"
                    h="18px"
                    w="18px"
                    minW="18px"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    color={tabInactiveColor}
                    _hover={{ color: "#3F77A5" }}
                    onClick={toggleMute}
                  />
                </Tooltip>
                <Slider
                  value={isMuted ? 0 : volume}
                  min={0}
                  max={100}
                  step={1}
                  size="sm"
                  width="54px"
                  onChange={handleVolumeChange}
                >
                  <SliderTrack bg={useColorModeValue("#E2E8EF", "rgba(255,255,255,0.12)")} h="3px">
                    <SliderFilledTrack bg="#3F77A5" />
                  </SliderTrack>
                  <SliderThumb boxSize={2.5} bg="#3F77A5" />
                </Slider>
              </Box>
            </HStack>
          </Flex>

          {/* Third Part: Zoom & Options Controls */}
          <Flex
            alignItems="center"
            justifyContent={{ base: "space-between", md: "flex-end" }}
            w={{ base: "100%", md: "auto" }}
            gap={1.5}
          >
            <HStack spacing={1.5}>
              <Tooltip label="Zoom In" aria-label="Zoom In Tooltip" hasArrow>
                <IconButton
                  icon={<FiZoomIn size="13px" />}
                  aria-label="Zoom In"
                  variant="outline"
                  size="xs"
                  h="26px"
                  w="26px"
                  minW="26px"
                  borderRadius="6px"
                  borderColor={controlsBorder}
                  bg={useColorModeValue("#FFFFFF", "#1C222D")}
                  color={textColor}
                  _hover={{ bg: "#3F77A512", borderColor: "#3F77A5", color: "#3F77A5" }}
                  onClick={zoomIn}
                />
              </Tooltip>

              <Tooltip label="Zoom Out" aria-label="Zoom Out Tooltip" hasArrow>
                <IconButton
                  icon={<FiZoomOut size="13px" />}
                  aria-label="Zoom Out"
                  variant="outline"
                  size="xs"
                  h="26px"
                  w="26px"
                  minW="26px"
                  borderRadius="6px"
                  borderColor={controlsBorder}
                  bg={useColorModeValue("#FFFFFF", "#1C222D")}
                  color={textColor}
                  _hover={{ bg: "#3F77A512", borderColor: "#3F77A5", color: "#3F77A5" }}
                  onClick={zoomOut}
                />
              </Tooltip>

              <Tooltip label="Fullscreen" aria-label="Fullscreen Tooltip" hasArrow>
                <IconButton
                  icon={<BsArrowsFullscreen size="12px" />}
                  aria-label="Fullscreen"
                  variant="outline"
                  size="xs"
                  h="26px"
                  w="26px"
                  minW="26px"
                  borderRadius="6px"
                  borderColor={controlsBorder}
                  bg={useColorModeValue("#FFFFFF", "#1C222D")}
                  color={textColor}
                  _hover={{ bg: "#3F77A512", borderColor: "#3F77A5", color: "#3F77A5" }}
                  onClick={onFullscreen}
                />
              </Tooltip>

              <Tooltip
                label="More Options"
                aria-label="More Options Tooltip"
                hasArrow
              >
                <Menu isLazy>
                  <MenuButton
                    as={IconButton}
                    icon={<BsThreeDotsVertical size="13px" />}
                    aria-label="More Options"
                    variant="outline"
                    size="xs"
                    h="26px"
                    w="26px"
                    minW="26px"
                    borderRadius="6px"
                    borderColor={controlsBorder}
                    bg={useColorModeValue("#FFFFFF", "#1C222D")}
                    color={textColor}
                    _hover={{ bg: "#3F77A512", borderColor: "#3F77A5", color: "#3F77A5" }}
                  />
                  <MenuList
                    fontSize="13px"
                    p="6px"
                    borderRadius="12px"
                    borderColor={menuBorder}
                    bg={menuBg}
                    boxShadow="0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04)"
                    minW="200px"
                  >
                    <MenuItem
                      h="34px"
                      px="10px"
                      borderRadius="7px"
                      fontFamily="'Manrope', sans-serif"
                      fontWeight="500"
                      fontSize="13px"
                      color={textColor}
                      _hover={{ bg: "#3F77A514", color: "#3F77A5" }}
                      transition="all 0.15s ease"
                      onClick={handleOpenSettings}
                    >
                      <FiSettings size="14px" style={{ marginRight: "10px", flexShrink: 0 }} />
                      Camera Setting
                    </MenuItem>
                    <MenuItem
                      h="34px"
                      px="10px"
                      borderRadius="7px"
                      fontFamily="'Manrope', sans-serif"
                      fontWeight="500"
                      fontSize="13px"
                      color={textColor}
                      _hover={{ bg: "#3F77A514", color: "#3F77A5" }}
                      transition="all 0.15s ease"
                      onClick={handleOpenRename}
                    >
                      <FiEdit2 size="14px" style={{ marginRight: "10px", flexShrink: 0 }} />
                      Rename Device
                    </MenuItem>

                    <MenuDivider my="4px" borderColor={menuBorder} />

                    <MenuItem
                      h="34px"
                      px="10px"
                      borderRadius="7px"
                      fontFamily="'Manrope', sans-serif"
                      fontWeight="500"
                      fontSize="13px"
                      color={textColor}
                      _hover={{ bg: "#3F77A514", color: "#3F77A5" }}
                      transition="all 0.15s ease"
                      onClick={handleSegmentation}
                    >
                      <LuBrainCog size="15px" style={{ marginRight: "10px", flexShrink: 0 }} />
                      Image Segmentation
                    </MenuItem>

                    <Box
                      px="10px"
                      py="7px"
                      mx="2px"
                      my="2px"
                      borderRadius="7px"
                      bg={dataConsumedBg}
                      border="1px solid"
                      borderColor={dataConsumedBorder}
                    >
                      <Flex align="center" justify="space-between" gap="8px">
                        <Flex align="center" gap="8px">
                          <FiDatabase size="13px" color="#64748B" />
                          <Text fontSize="12px" fontWeight="600" color={tabInactiveColor} fontFamily="'Manrope', sans-serif">
                            Data Consumed:
                          </Text>
                        </Flex>
                        <Text fontSize="12px" fontWeight="700" color="#EF4444" fontFamily="'Manrope', sans-serif">
                          {totalData}
                        </Text>
                      </Flex>
                    </Box>

                    <MenuDivider my="4px" borderColor={menuBorder} />

                    <MenuItem
                      h="34px"
                      px="10px"
                      borderRadius="7px"
                      color="#EF4444"
                      fontFamily="'Manrope', sans-serif"
                      fontWeight="500"
                      fontSize="13px"
                      _hover={{ bg: "rgba(239, 68, 68, 0.08)", color: "#DC2626" }}
                      transition="all 0.15s ease"
                      onClick={handleOpenRemoveCamera}
                    >
                      <FiTrash2 size="14px" style={{ marginRight: "10px", flexShrink: 0 }} />
                      Remove Camera
                    </MenuItem>
                  </MenuList>
                </Menu>
              </Tooltip>
            </HStack>
          </Flex>
        </Flex>

        {/* Timeline Section taking full width */}
        <Box mt={1}>
          <AzureTimeline
            date={selectedDate}
            deviceid={device?.deviceId}
            onUrlChange={updateUrl}
            onTotalDataChange={handleTotalDataChange}
            currentPlayUrl={url || playUrl || initialUrl}
            currentVideoTime={currentVideoTime}
          />
        </Box>
      </Box>

      {/* Modal for Rename Device */}
      <Modal
        onClose={closeModal}
        isOpen={activeModal === "Rename Device"}
        isCentered
        size="lg"
      >
        <ModalOverlay />
        <ModalContent
          bg={modalBg}
          color={textColor}
          borderRadius="12px"
          borderColor={modalBorderColor}
          borderWidth="1px"
        >
          <ModalHeader
            textAlign="center"
            p={2}
            mt={4}
            fontFamily="'Manrope', sans-serif"
            fontWeight="700"
          >
            Rename Device
          </ModalHeader>
          <ModalBody pb={6} textAlign="center">
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              width="100%"
              p={1}
            >
              <FormControl width="350px" mt={4}>
                <FormLabel
                  htmlFor="device-name-input"
                  textAlign="start"
                  fontSize="13px"
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="600"
                >
                  Enter Device Name:
                </FormLabel>
                <Input
                  id="device-name-input"
                  placeholder="Device Name"
                  borderRadius="8px"
                  borderColor={modalBorderColor}
                  px={4}
                  value={cameraRenameInput}
                  onChange={(e) => setCameraRenameInput(e.target.value)}
                  _focus={{
                    borderColor: "#3F77A5",
                    boxShadow: "0 0 0 1px #3F77A5",
                  }}
                  fontFamily="'Manrope', sans-serif"
                />
              </FormControl>
            </Box>
          </ModalBody>

          <ModalFooter justifyContent="space-evenly" pb={6}>
            <Button
              onClick={closeModal}
              w="150px"
              variant="outline"
              colorScheme="red"
              borderRadius="8px"
              fontFamily="'Manrope', sans-serif"
            >
              Cancel
            </Button>

            <Button
              onClick={handleSaveRename}
              w="150px"
              bg={saveBtnBg}
              color={saveBtnColor}
              borderRadius="8px"
              _hover={{ opacity: 0.9 }}
              fontFamily="'Manrope', sans-serif"
            >
              Save Device
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal for Camera Settings */}
      <Modal
        onClose={closeModal}
        isOpen={activeModal === "Camera Settings"}
        isCentered
        size="3xl"
      >
        <ModalOverlay />
        <ModalContent
          bg={modalBg}
          color={textColor}
          borderRadius="12px"
          borderColor={modalBorderColor}
          borderWidth="1px"
        >
          <ModalHeader
            fontFamily="'Manrope', sans-serif"
            fontWeight="700"
            borderBottomWidth="1px"
            borderColor={modalBorderColor}
            pb={3}
          >
            Camera Settings
          </ModalHeader>
          <ModalCloseButton />

          <ModalBody py={4}>
            {/* Tabs */}
            <Tabs
              variant="unstyled"
              mb={5}
              index={
                activeSettingsTab === "Video settings"
                  ? 0
                  : activeSettingsTab === "Media" || activeSettingsTab === "Image settings"
                  ? 1
                  : 2
              }
              onChange={(index) => {
                const tabs = ["Video settings", "Media", "Wifi Settings"];
                setActiveSettingsTab(tabs[index]);
              }}
            >
              <TabList borderBottom="1px solid" borderColor={modalBorderColor}>
                <Tab
                  pb={2}
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="600"
                  fontSize="14px"
                  _selected={{
                    color: "#3F77A5",
                    borderBottom: "3px solid #3F77A5",
                  }}
                >
                  Video settings
                </Tab>
                <Tab
                  pb={2}
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="600"
                  fontSize="14px"
                  _selected={{
                    color: "#3F77A5",
                    borderBottom: "3px solid #3F77A5",
                  }}
                >
                  Image settings
                </Tab>
                {device?.productType === "Wifi-S-Series" && (
                  <Tab
                    pb={2}
                    fontFamily="'Manrope', sans-serif"
                    fontWeight="600"
                    fontSize="14px"
                    _selected={{
                      color: "#3F77A5",
                      borderBottom: "3px solid #3F77A5",
                    }}
                  >
                    Wifi Settings
                  </Tab>
                )}
              </TabList>
            </Tabs>

            {/* Video settings tab */}
            {activeSettingsTab === "Video settings" && (
              <Box>
                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text fontSize="13px" fontWeight="600" fontFamily="'Manrope', sans-serif">
                    Device Name
                  </Text>
                  <Input
                    disabled
                    value={device?.deviceId || ""}
                    size="sm"
                    maxW="60%"
                    borderRadius="6px"
                  />
                </Flex>

                <Grid templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)" }} gap={4} mb={4}>
                  <FormControl>
                    <FormLabel fontSize="12px" fontFamily="'Manrope', sans-serif">Stream Type</FormLabel>
                    <Select value={streamType} onChange={(e) => setStreamType(e.target.value)} size="sm" borderRadius="6px">
                      <option value="main">Main Stream</option>
                      <option value="sub">Sub Stream</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="12px" fontFamily="'Manrope', sans-serif">Bit Rate</FormLabel>
                    <Input value={bitRate} onChange={(e) => setBitRate(e.target.value)} placeholder="Bit Rate" size="sm" borderRadius="6px" />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="12px" fontFamily="'Manrope', sans-serif">FPS</FormLabel>
                    <Input value={frameRate} onChange={(e) => setFrameRate(e.target.value)} placeholder="FPS" size="sm" borderRadius="6px" />
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="12px" fontFamily="'Manrope', sans-serif">Profile</FormLabel>
                    <Select value={codecType} onChange={(e) => setCodecType(e.target.value)} placeholder="Codec Type" size="sm" borderRadius="6px">
                      <option value="H.264">H.264</option>
                      <option value="H.265">H.265</option>
                      <option value="H.264+">H.264+</option>
                      <option value="H.265+">H.265+</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="12px" fontFamily="'Manrope', sans-serif">Bit Rate Type</FormLabel>
                    <Select value={bitRateType} onChange={(e) => setBitRateType(e.target.value)} placeholder="Select type" size="sm" borderRadius="6px">
                      <option value="CBR">CBR</option>
                      <option value="VBR">VBR</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel fontSize="12px" fontFamily="'Manrope', sans-serif">Resolution</FormLabel>
                    <Select value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Select resolution" size="sm" borderRadius="6px">
                      {streamType === "main" ? (
                        <>
                          <option value="2304x1296">2304x1296</option>
                          <option value="1920x1080">1920x1080</option>
                          <option value="1280x720">1280x720</option>
                        </>
                      ) : (
                        <>
                          <option value="800x448">800x448</option>
                          <option value="640x360">640x360</option>
                        </>
                      )}
                    </Select>
                  </FormControl>
                </Grid>

                <Divider mb={4} borderColor={modalBorderColor} />

                <Flex w="full" justifyContent="flex-end" gap={2}>
                  <Button variant="outline" size="sm" borderRadius="6px" onClick={closeModal} fontFamily="'Manrope', sans-serif">
                    Close
                  </Button>
                  <Button size="sm" bg={saveBtnBg} color={saveBtnColor} borderRadius="6px" _hover={{ opacity: 0.9 }} onClick={handleVideoEncodeSave} fontFamily="'Manrope', sans-serif">
                    Save
                  </Button>
                </Flex>
              </Box>
            )}

            {/* Image settings / Media tab */}
            {(activeSettingsTab === "Media" || activeSettingsTab === "Image settings") && (
              <Box>
                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text fontSize="13px" fontWeight="600" fontFamily="'Manrope', sans-serif">IR Mode</Text>
                  <Select value={irCutMode} onChange={(e) => setIrCutMode(e.target.value)} size="sm" maxW="60%" borderRadius="6px">
                    <option value="auto">IrLedMode</option>
                    <option value="light">Light Mode</option>
                    <option value="smart">Smart Mode</option>
                    <option value="daylight">Daylight Mode</option>
                    <option value="night">Night Mode</option>
                  </Select>
                </Flex>

                {/* Sliders */}
                {[
                  { label: "Brightness", val: brightness, setVal: setBrightness },
                  { label: "Contrast", val: contrast, setVal: setContrast },
                  { label: "Saturation", val: saturation, setVal: setSaturation },
                  { label: "Hue", val: hue, setVal: setHue },
                  { label: "Sharpness", val: sharpness, setVal: setSharpness },
                ].map((item) => (
                  <Flex key={item.label} alignItems="center" justifyContent="space-between" mb={3}>
                    <Text flex="1" fontSize="13px" fontFamily="'Manrope', sans-serif">{item.label}</Text>
                    <Box flex="2" mx={4}>
                      <Slider value={item.val} onChange={(val) => item.setVal(val)} min={0} max={100} step={1}>
                        <SliderTrack bg={sliderTrackBg}>
                          <SliderFilledTrack bg="#3F77A5" />
                        </SliderTrack>
                        <SliderThumb borderColor="#3F77A5" />
                      </Slider>
                    </Box>
                    <Text w="45px" textAlign="right" fontSize="12px" fontWeight="600">{item.val}%</Text>
                  </Flex>
                ))}

                {/* Flip & Mirror */}
                <Flex alignItems="center" justifyContent="space-between" mb={3}>
                  <Text flex="1" fontSize="13px" fontFamily="'Manrope', sans-serif">Flip</Text>
                  <Switch size="sm" isChecked={flip} colorScheme="blue" onChange={() => setFlip(!flip)} />
                </Flex>
                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text flex="1" fontSize="13px" fontFamily="'Manrope', sans-serif">Mirror</Text>
                  <Switch size="sm" isChecked={mirror} colorScheme="blue" onChange={() => setMirror(!mirror)} />
                </Flex>

                <Divider mb={4} borderColor={modalBorderColor} />

                <Flex w="full" justifyContent="space-between" alignItems="center">
                  <Button
                    p={0}
                    colorScheme="red"
                    variant="ghost"
                    textDecoration="underline"
                    size="sm"
                    onClick={handleReboot}
                    fontFamily="'Manrope', sans-serif"
                  >
                    Reboot Camera
                  </Button>
                  <Flex gap={2}>
                    <Button variant="outline" size="sm" borderRadius="6px" onClick={closeModal} fontFamily="'Manrope', sans-serif">
                      Close
                    </Button>
                    <Button size="sm" bg={saveBtnBg} color={saveBtnColor} borderRadius="6px" _hover={{ opacity: 0.9 }} onClick={handleMediaSettingsSave} fontFamily="'Manrope', sans-serif">
                      Save
                    </Button>
                  </Flex>
                </Flex>
              </Box>
            )}

            {/* Wifi Settings tab */}
            {activeSettingsTab === "Wifi Settings" && (
              <Box>
                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text fontSize="13px" fontWeight="600" fontFamily="'Manrope', sans-serif">Wifi Name</Text>
                  <Input value={wifiName} onChange={(e) => setWifiName(e.target.value)} size="sm" maxW="60%" borderRadius="6px" />
                </Flex>
                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text fontSize="13px" fontWeight="600" fontFamily="'Manrope', sans-serif">Password</Text>
                  <Input type="password" value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} size="sm" maxW="60%" borderRadius="6px" />
                </Flex>

                <Divider mb={4} borderColor={modalBorderColor} />

                <Flex w="full" justifyContent="space-between" alignItems="center">
                  <Button
                    p={0}
                    colorScheme="red"
                    variant="ghost"
                    textDecoration="underline"
                    size="sm"
                    onClick={handleReboot}
                    fontFamily="'Manrope', sans-serif"
                  >
                    Reboot Camera
                  </Button>
                  <Flex gap={2}>
                    <Button variant="outline" size="sm" borderRadius="6px" onClick={closeModal} fontFamily="'Manrope', sans-serif">
                      Close
                    </Button>
                    <Button size="sm" bg={saveBtnBg} color={saveBtnColor} borderRadius="6px" _hover={{ opacity: 0.9 }} onClick={handleWifiSettingsSave} fontFamily="'Manrope', sans-serif">
                      Save
                    </Button>
                  </Flex>
                </Flex>
              </Box>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Modal for Remove Camera Confirmation */}
      <Modal
        onClose={closeModal}
        isOpen={activeModal === "Remove Camera"}
        isCentered
        size="md"
      >
        <ModalOverlay />
        <ModalContent
          bg={modalBg}
          color={textColor}
          borderRadius="12px"
          borderColor={modalBorderColor}
          borderWidth="1px"
        >
          <ModalHeader fontFamily="'Manrope', sans-serif" fontWeight="700">
            Remove Camera
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody py={4}>
            <Text fontFamily="'Manrope', sans-serif" fontSize="14px">
              Are you sure you want to remove camera "{device?.name || device?.cameraName || device?.deviceId}"?
            </Text>
          </ModalBody>
          <ModalFooter gap={3}>
            <Button variant="outline" borderRadius="8px" onClick={closeModal} fontFamily="'Manrope', sans-serif">
              Cancel
            </Button>
            <Button colorScheme="red" borderRadius="8px" onClick={handleConfirmRemoveCamera} fontFamily="'Manrope', sans-serif">
              Remove Camera
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default PlayerControls;
