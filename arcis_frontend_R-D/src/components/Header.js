import React, { useState, useEffect } from "react";
import {
  Box,
  Flex,
  Image,
  Button,
  Switch,
  Text,
  useColorMode,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  useDisclosure,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  useColorModeValue,
  Divider,
  Icon,
  IconButton,
  Avatar,
  VStack,
  Tooltip,
} from "@chakra-ui/react";
import { CgLogOff } from "react-icons/cg";
import { BsCameraVideoFill } from "react-icons/bs";
import {
  logout,
  logoutFromAllDevices,
} from "../actions/userActions";
import { useNavigate } from "react-router-dom";
import theme from "../theme";
import { FaRegBell, FaRegUser, FaMoon, FaSun } from "react-icons/fa6";
import { IoPower } from "react-icons/io5";
import MyProfile from "./Modals/MyProfile";
import { TimeIcon } from "@chakra-ui/icons";
import eciLogo from "../assets/eci-WHITE MODE.png"
import eciLogo1 from "../assets/eci-DARK MODE.png"

const Header = ({
  toggleTextVisibility,
  isSidebarExpanded,
  setSidebarExpanded,
  isSidebarHovered
}) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [activeModal, setActiveModal] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { colorMode, toggleColorMode } = useColorMode();
  const activeLogo = useColorModeValue(eciLogo, eciLogo1);

  // Define widths based on your sidebar design
  // Case 1: 80px (collapsed) | Case 2: 260px (expanded/hovered)
  // const sidebarWidth = isSidebarHovered ? "260px" : "80px";

  const textColor = useColorModeValue(
    "custom.lightModeText",
    "custom.darkModeText"
  );

  // Define background color so it isn't transparent
  const headerBg = useColorModeValue(
    "linear-gradient(90deg, #FFFFFF 0%, #F4F8FB 100%)",
    "linear-gradient(90deg, #1C1A1A 0%, #231F1F 100%)"
  );
  const headerBorder = useColorModeValue("gray.100", "whiteAlpha.200");
  const subText = useColorModeValue("gray.500", "gray.400");
  const pillBg = useColorModeValue("gray.50", "whiteAlpha.100");
  const pillBorder = useColorModeValue("gray.200", "whiteAlpha.200");
  const brandTitle = useColorModeValue("gray.800", "white");

  // Logged-in user details
  const userName = localStorage.getItem("name") || "User";
  const userRole = localStorage.getItem("role") || "Operator";

  const navigate = useNavigate();

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(timerId);
    };
  }, []);

  const logoutClick = async () => {
    await logout();
    navigate("/login");
  };

  const handleLogoutFromAllDevices = async () => {
    alert("Are you sure you want to Logout from all devices...");
    const response = await logoutFromAllDevices();
    navigate("/login");
  };

  const openModal = (modal) => {
    setActiveModal(modal);
    onOpen();
  };

  const openProfileModal = (modal) => {
    setActiveModal(modal);
    onOpen();
  };

  return (
    <Box
      px={6}
      w="100%"
      h="75px"
      // --- CHANGE IS HERE ---
      // 'relative' means it sits in the normal flow of the page.
      // When the page scrolls, this element scrolls up with it.
      position="relative"
      //  bg={headerBg}
      //  boxShadow="sm" // Optional: adds a nice shadow under the header
      // ---------------------
      color={textColor}
    >

      <Flex
        h="75px"
        alignItems="center"
        px={6}
        justifyContent="space-between"
        bg={headerBg}
        backdropFilter="blur(8px)"
        borderBottom="1px solid"
        borderColor={headerBorder}
        boxShadow="0 1px 3px rgba(0,0,0,0.04)"

        // FIXED POSITIONING
        position="absolute"
        top="0"
        right="0"

        // Match the Sidebar widths: 60px (collapsed) and 214px (expanded)
        left={{ base: 0, md: isSidebarExpanded ? "214px" : "60px" }}
        transition="left 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        zIndex="1000"
      >
        {/* 1. LEFT SECTION: Brand */}
        <Flex alignItems="center" gap={3} minW={0}>
          <Flex
            alignItems="center"
            justifyContent="center"
            boxSize="42px"
            borderRadius="12px"
            bgGradient="linear(135deg, #3F77A5, #1C4ED8)"
            color="white"
            boxShadow="0 4px 12px rgba(28,78,216,0.25)"
            flexShrink={0}
          >
            <Icon as={BsCameraVideoFill} boxSize="20px" />
          </Flex>
          <Box lineHeight="1.2" display={{ base: "none", sm: "block" }}>
            <Text fontSize="17px" fontWeight="700" color={brandTitle} whiteSpace="nowrap">
              Real-time monitoring, playback and analytics 
            </Text>
           
          </Box>
        </Flex>

        {/* 2. RIGHT SECTION: Time, Notifications, Theme, Profile */}
        <Flex justifyContent="flex-end" alignItems="center" gap={{ base: 2, md: 3 }}>
          {/* Live date + time pill */}
          <Flex
            alignItems="center"
            gap={2}
            bg={pillBg}
            border="1px solid"
            borderColor={pillBorder}
            px={3}
            py={1.5}
            borderRadius="full"
            display={{ base: "none", lg: "flex" }}
          >
            <TimeIcon boxSize="14px" color={subText} />
            <Text fontSize="13px" fontWeight="600" whiteSpace="nowrap">
              {currentTime.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} ·{" "}
              {currentTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </Text>
          </Flex>

          {/* Notifications */}
          <Tooltip label="Notifications" hasArrow>
            <Box position="relative">
              <IconButton
                aria-label="Notifications"
                icon={<FaRegBell size="17px" />}
                variant="ghost"
                size="sm"
                borderRadius="12px"
              />
              <Box
                position="absolute"
                top="6px"
                right="7px"
                boxSize="7px"
                bg="red.500"
                borderRadius="full"
                border="1.5px solid"
                borderColor={useColorModeValue("white", "#231F1F")}
              />
            </Box>
          </Tooltip>

          {/* Theme toggle */}
          <Tooltip label={colorMode === "light" ? "Dark mode" : "Light mode"} hasArrow>
            <IconButton
              aria-label="Toggle dark mode"
              icon={colorMode === "light" ? <FaMoon /> : <FaSun />}
              onClick={toggleColorMode}
              size="sm"
              variant="ghost"
              borderRadius="12px"
            />
          </Tooltip>

          <Divider orientation="vertical" h="28px" display={{ base: "none", md: "block" }} />

          {/* Profile menu */}
          <Menu isLazy>
            <MenuButton
              as={Button}
              variant="ghost"
              px={2}
              py={1}
              h="auto"
              borderRadius="12px"
              _hover={{ bg: pillBg }}
              _active={{ bg: pillBg }}
            >
              <Flex alignItems="center" gap={2}>
                <Avatar size="sm" name={userName} bg="#3F77A5" color="white" />
                <VStack spacing={0} align="flex-start" display={{ base: "none", md: "flex" }} lineHeight="1.1">
                  <Text fontSize="13px" fontWeight="600" maxW="120px" isTruncated>
                    {userName}
                  </Text>
                  <Text fontSize="11px" color={subText} textTransform="capitalize">
                    {userRole}
                  </Text>
                </VStack>
              </Flex>
            </MenuButton>
            <MenuList>
              <Box px={3} py={2}>
                <Text fontSize="sm" fontWeight="700">{userName}</Text>
                <Text fontSize="xs" color={subText} textTransform="capitalize">{userRole}</Text>
              </Box>
              <Divider />
              <MenuItem icon={<FaRegUser size="15px" />} onClick={() => openProfileModal("My Profile")} fontSize="sm">
                My Profile
              </MenuItem>
              <MenuItem
                icon={<CgLogOff size="18px" />}
                onClick={() => openModal("logout")}
                color="red.600"
                fontSize="sm"
              >
                Logout
              </MenuItem>
            </MenuList>
          </Menu>
        </Flex>
      </Flex>

      {/* Logout Modal */}
      <Modal
        isOpen={isOpen && activeModal === "logout"}
        onClose={onClose}
        isCentered
      >
        <ModalOverlay />
        <ModalContent
          pt={3}
          pr={3}
          pl={3}
          pb={1}
          borderRadius="8px"
          boxShadow="lg"
          bg={useColorModeValue("white", "gray.800")}
        >
          <ModalHeader
            textAlign="center"
            fontSize="xl"
            fontWeight="bold"
            color={useColorModeValue("black", "white")}
          >
            Oh no! You're leaving... Are you sure?
          </ModalHeader>
          <ModalBody>
            <Flex direction="column" align="center" justify="center" mt={4}>
              <Icon as={IoPower} color="red.500" boxSize="50px" mb={4} />
              <Text
                textAlign="center"
                color={useColorModeValue("gray.800", "gray.200")}
                fontSize="md"
              >
                You will be signed out of your account. If you have unsaved
                changes, they will be lost.
              </Text>
            </Flex>
          </ModalBody>
          <Box>
            <Flex gap={4} mt={2} justifyContent="center">
              <Button
                onClick={onClose}
                w="150px"
                border="1px"
                background="0"
                color="red.500"
                borderColor="red.500"
                _hover={{ background: "none" }}
              >
                Cancel
              </Button>

              <Button
                w={"150px"}
                background={useColorModeValue(
                  theme.colors.custom.primary,
                  theme.colors.custom.darkModePrimary
                )}
                color={useColorModeValue(
                  theme.colors.custom.lightModeText,
                  theme.colors.custom.darkModeText
                )}
                fontWeight="normal"
                _hover={{
                  backgroundColor: useColorModeValue(
                    theme.colors.custom.darkModePrimary,
                    theme.colors.custom.primary
                  ),
                  color: useColorModeValue(
                    theme.colors.custom.darkModeText,
                    theme.colors.custom.lightModeText
                  ),
                }}
                onClick={logoutClick}
                borderRadius="6px"
              >
                Logout
              </Button>
            </Flex>
          </Box>
          <Divider mt={2} />
          <Flex justifyContent={"center"}>
            <Button
              p={0}
              colorScheme="red"
              variant="ghost"
              textDecoration={"underline"}
              size="sm"
              w={"200px"}
              onClick={() => handleLogoutFromAllDevices()}
            >
              Logout from All Devices
            </Button>
          </Flex>
        </ModalContent>
      </Modal>

      {/* My Profile MOdal */}
      {isOpen && activeModal === "My Profile" && (
        <MyProfile isOpen={isOpen} onClose={onClose} />
      )}
    </Box>
  );
};

export default Header;
