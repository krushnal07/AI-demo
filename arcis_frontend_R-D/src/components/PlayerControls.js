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
} from "@chakra-ui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
import {
  FaVolumeUp,
  FaVolumeMute,
  FaEllipsisV,
  FaCircle,
  FaSquare,
  FaPlay,
  FaPause,
  FaSearchPlus,
  FaSearchMinus,
} from "react-icons/fa";
import { FiZoomIn, FiZoomOut } from "react-icons/fi";
import { RiForward5Line } from "react-icons/ri";
import { MdControlCamera } from "react-icons/md";
import { BsArrowsFullscreen } from "react-icons/bs";
import { TbCapture } from "react-icons/tb";
import { LuBrainCog } from "react-icons/lu";
import EdgeTimeline from "edge-timeline-component";
import AzureTimeline from "./AzureTimeline";
import "react-datepicker/dist/react-datepicker.css";
import DatePicker from "react-datepicker";
import { SlCalender } from "react-icons/sl";
import theme from "../theme";
import AudioRecorder from "./AudioRecorder";

const PlayerControls = ({
  device,
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
  // handleGoLive,
}) => {
  const [selectedDate, setSelectedDate] = useState(getCurrentISTDate());
  const [url, setUrl] = useState(initialUrl || playUrl);
  const datePickerRef = useRef(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false);

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

  return (
    <>
      <style jsx>
        {`
          .dateInput {
            background-color: unset;
            width: 93px;
            font-family: 'Manrope', sans-serif;
            font-weight: 700;
            font-size: 13px;
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
        borderRadius="10px"
        width="100%"
        mx="auto"
        mt="12px"
        p="10px 14px"
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
            <Flex alignItems="center" gap="10px" flexWrap="wrap">
              <Tabs
                variant="unstyled"
                size="sm"
              >
                <TabList bg={useColorModeValue("#E8EFF7", "rgba(255,255,255,0.06)")} p="3px" borderRadius="8px">
                  <Tab
                    _selected={{
                      bg: selectedTab,
                      color: tabActiveColor,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                    }}
                    px="14px"
                    py="4px"
                    borderRadius="6px"
                    textAlign="center"
                    color={tabInactiveColor}
                    fontFamily="'Manrope', sans-serif"
                    fontWeight="700"
                    fontSize="12px"
                    onClick={() => toggle("cloud")}
                  >
                    Cloud
                  </Tab>
                </TabList>
              </Tabs>
              <HStack spacing="4px" align="center" bg={useColorModeValue("#FFFFFF", "#1C222D")} px="8px" py="3px" borderRadius="8px" borderWidth="1px" borderColor={controlsBorder}>
                <Tooltip label="Previous Day" aria-label="Previous Day Tooltip" hasArrow>
                  <IconButton
                    icon={<ChevronLeftIcon />}
                    aria-label="Previous Day"
                    variant="unstyled"
                    size="xs"
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
                  icon={<SlCalender size="13px" />}
                  aria-label="Select Date"
                  variant="unstyled"
                  size="xs"
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
            gap={{ base: 2, md: 4 }}
            w={{ base: "100%", md: "auto" }}
          >
            <HStack
              spacing={3}
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
                      <FaPause size="13px" />
                    ) : (
                      <FaPlay size="13px" style={{ marginLeft: "2px" }} />
                    )
                  }
                  aria-label="Play/Pause"
                  size="sm"
                  h="32px"
                  w="32px"
                  minW="32px"
                  borderRadius="8px"
                  bg={isPlaying ? "red.500" : "#3F77A5"}
                  color="white"
                  _hover={{ bg: isPlaying ? "red.600" : "#2B5273" }}
                  onClick={handlePlayPause}
                />
              </Tooltip>

              <Box display="flex" alignItems="center" gap={2} bg={useColorModeValue("#FFFFFF", "#1C222D")} px="8px" py="4px" borderRadius="8px" borderWidth="1px" borderColor={controlsBorder}>
                <Tooltip
                  label={isMuted ? "Unmute" : "Mute"}
                  aria-label="Mute Tooltip"
                  hasArrow
                >
                  <IconButton
                    icon={
                      isMuted ? (
                        <FaVolumeMute size="14px" />
                      ) : (
                        <FaVolumeUp size="14px" />
                      )
                    }
                    aria-label="Volume"
                    variant="unstyled"
                    size="xs"
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
                  width="70px"
                  onChange={handleVolumeChange}
                >
                  <SliderTrack bg={useColorModeValue("#E2E8EF", "rgba(255,255,255,0.12)")}>
                    <SliderFilledTrack bg="#3F77A5" />
                  </SliderTrack>
                  <SliderThumb boxSize={3} bg="#3F77A5" />
                </Slider>
              </Box>
            </HStack>
          </Flex>

          {/* Third Part: Zoom & Options Controls */}
          <Flex
            alignItems="center"
            justifyContent={{ base: "space-between", md: "flex-end" }}
            w={{ base: "100%", md: "auto" }}
            gap={2}
          >
            <HStack spacing={2}>
              <Tooltip label="Zoom In" aria-label="Zoom In Tooltip" hasArrow>
                <IconButton
                  icon={<FiZoomIn size="16px" />}
                  aria-label="Zoom In"
                  variant="outline"
                  size="sm"
                  h="32px"
                  w="32px"
                  minW="32px"
                  borderRadius="8px"
                  borderColor={controlsBorder}
                  bg={useColorModeValue("#FFFFFF", "#1C222D")}
                  color={textColor}
                  _hover={{ bg: "#3F77A512", borderColor: "#3F77A5", color: "#3F77A5" }}
                  onClick={zoomIn}
                />
              </Tooltip>

              <Tooltip label="Zoom Out" aria-label="Zoom Out Tooltip" hasArrow>
                <IconButton
                  icon={<FiZoomOut size="16px" />}
                  aria-label="Zoom Out"
                  variant="outline"
                  size="sm"
                  h="32px"
                  w="32px"
                  minW="32px"
                  borderRadius="8px"
                  borderColor={controlsBorder}
                  bg={useColorModeValue("#FFFFFF", "#1C222D")}
                  color={textColor}
                  _hover={{ bg: "#3F77A512", borderColor: "#3F77A5", color: "#3F77A5" }}
                  onClick={zoomOut}
                />
              </Tooltip>

              <Tooltip label="Fullscreen" aria-label="Fullscreen Tooltip" hasArrow>
                <IconButton
                  icon={<BsArrowsFullscreen size="14px" />}
                  aria-label="Fullscreen"
                  variant="outline"
                  size="sm"
                  h="32px"
                  w="32px"
                  minW="32px"
                  borderRadius="8px"
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
                <Menu>
                  <MenuButton
                    as={IconButton}
                    icon={<FaEllipsisV size="14px" />}
                    aria-label="More Options"
                    variant="outline"
                    size="sm"
                    h="32px"
                    w="32px"
                    minW="32px"
                    borderRadius="8px"
                    borderColor={controlsBorder}
                    bg={useColorModeValue("#FFFFFF", "#1C222D")}
                    color={textColor}
                    _hover={{ bg: "#3F77A512", borderColor: "#3F77A5", color: "#3F77A5" }}
                  />
                  <MenuList minW="200px" p="6px" bg={menuBg} borderColor={menuBorder} boxShadow="0 4px 14px rgba(0,0,0,0.15)">
                    <MenuItem
                      isDisabled
                      _disabled={{ opacity: 0.7, cursor: "default" }}
                      bg={menuBg}
                      fontFamily="'Manrope', sans-serif"
                    >
                      <Flex align="center" gap="6px" flexWrap="wrap">
                        <Text fontSize="12px" color={tabInactiveColor}>Data Consumed:</Text>
                        <Text fontSize="12px" fontWeight="700" color="#EF4444">
                          {totalData}
                        </Text>
                      </Flex>
                    </MenuItem>

                    <MenuDivider borderColor={menuBorder} />

                    <MenuItem
                      onClick={handleSegmentation}
                      bg={menuBg}
                      _hover={{ bg: menuHoverBg }}
                      borderRadius="6px"
                      fontFamily="'Manrope', sans-serif"
                      fontSize="13px"
                      color={textColor}
                    >
                      <LuBrainCog size="18px" style={{ marginRight: "8px", color: "#3F77A5" }} />
                      Image Segmentation
                    </MenuItem>
                  </MenuList>
                </Menu>
              </Tooltip>
            </HStack>
          </Flex>
        </Flex>

        {/* Timeline Section taking full width */}
        <Box mt={2}>
          <AzureTimeline
            date={selectedDate}
            deviceid={device.deviceId}
            onUrlChange={updateUrl}
            onTotalDataChange={handleTotalDataChange}
            currentPlayUrl={url || playUrl || initialUrl}
            currentVideoTime={currentVideoTime}
          />
        </Box>
      </Box>
    </>
  );
};

export default PlayerControls;
