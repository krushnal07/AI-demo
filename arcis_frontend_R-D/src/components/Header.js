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

  const userInitial =
    userName && userName.trim().length > 0
      ? userName.trim().charAt(0).toUpperCase()
      : "U";

  const formattedDate = currentTime.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = currentTime.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  return (
    <Box
      w="100%"
      h="56px"
      position="relative"
      color={textColor}
      fontFamily="'Manrope', sans-serif"
    >
      <Flex
        h="56px"
        alignItems="center"
        px={{ base: 4, sm: 6 }}
        justifyContent="flex-end"
        gap="14px"
        bg={useColorModeValue("#FFFFFF", "#131922")}
        borderBottom="1px solid"
        borderColor={useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.08)")}
        boxShadow={useColorModeValue("0 1px 3px rgba(0,0,0,0.05)", "0 2px 8px rgba(0,0,0,0.25)")}
        position="absolute"
        top="0"
        right="0"
        left={{ base: 0, md: isSidebarExpanded ? "228px" : "68px" }}
        width={{
          base: "100%",
          md: isSidebarExpanded ? "calc(100% - 228px)" : "calc(100% - 68px)",
        }}
        transition="left 0.25s cubic-bezier(0.4, 0, 0.2, 1), width 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
        zIndex="1000"
      >
        {/* 1. TIME CONTAINER (Width: ~143px, Height: 18px, Gap: 5px) */}
        <Flex
          alignItems="center"
          gap="5px"
          h="18px"
          display={{ base: "none", sm: "flex" }}
          userSelect="none"
        >
          {/* Time icon container (13x13) */}
          <Flex w="13px" h="13px" align="center" justify="center" flexShrink={0}>
            <TimeIcon boxSize="13px" color={useColorModeValue("#64748B", "#94A3B8")} />
          </Flex>

          {/* Time text container (Manrope 600 SemiBold, 12px, Line-height: 18px, Color: #64748B) */}
          <Text
            fontFamily="'Manrope', sans-serif"
            fontWeight="600"
            fontSize="12px"
            lineHeight="18px"
            letterSpacing="0px"
            color={useColorModeValue("#64748B", "#94A3B8")}
            whiteSpace="nowrap"
          >
            {formattedDate} · {formattedTime}
          </Text>
        </Flex>

        {/* 2. THEME CHANGE CONTAINER (as it is) */}
        <Tooltip label={colorMode === "light" ? "Dark mode" : "Light mode"} hasArrow>
          <IconButton
            aria-label="Toggle dark mode"
            icon={colorMode === "light" ? <FaMoon /> : <FaSun />}
            onClick={toggleColorMode}
            size="sm"
            variant="ghost"
            borderRadius="8px"
            w="32px"
            h="32px"
            minW="32px"
            color={useColorModeValue("#64748B", "#94A3B8")}
            _hover={{ bg: useColorModeValue("#F1F5F9", "whiteAlpha.100") }}
          />
        </Tooltip>

        {/* 3. PROFILE CONTAINER (Avatar 32x32 gradient, Name 12px Bold #1A2E3D, Role 10px Regular #64748B) */}
        <Menu isLazy>
          <MenuButton
            as={Button}
            variant="ghost"
            p={1}
            h="38px"
            borderRadius="8px"
            _hover={{ bg: useColorModeValue("#F8FAFC", "whiteAlpha.100") }}
            _active={{ bg: useColorModeValue("#F1F5F9", "whiteAlpha.200") }}
          >
            <Flex alignItems="center" gap="10px">
              {/* 1. Profile avatar container (32x32, border-radius: 16px, background: linear-gradient(135deg, #3F77A5 0%, #DB7B3A 100%)) */}
              <Flex
                w="32px"
                h="32px"
                minW="32px"
                borderRadius="16px"
                bgGradient="linear(135deg, #3F77A5 0%, #DB7B3A 100%)"
                color="#FFFFFF"
                align="center"
                justify="center"
                fontFamily="'Manrope', sans-serif"
                fontWeight="700"
                fontSize="13px"
                flexShrink={0}
                userSelect="none"
              >
                {userInitial}
              </Flex>

              {/* 2 & 3. Profile Name and Role container */}
              <VStack
                spacing={0}
                align="flex-start"
                display={{ base: "none", md: "flex" }}
                lineHeight="1.2"
              >
                {/* Profile name container (Manrope 700 Bold, 12px, Line-height: 14.4px, Color: #1A2E3D) */}
                <Text
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="700"
                  fontSize="12px"
                  lineHeight="14.4px"
                  letterSpacing="0px"
                  color={useColorModeValue("#1A2E3D", "#FFFFFF")}
                  maxW="140px"
                  isTruncated
                >
                  {userName}
                </Text>

                {/* Role container (Manrope 400 Regular, 10px, Line-height: 15px, Color: #64748B) */}
                <Text
                  fontFamily="'Manrope', sans-serif"
                  fontWeight="400"
                  fontSize="10px"
                  lineHeight="15px"
                  letterSpacing="0px"
                  color={useColorModeValue("#64748B", "#94A3B8")}
                  textTransform="capitalize"
                >
                  {userRole}
                </Text>
              </VStack>
            </Flex>
          </MenuButton>
          <MenuList
            bg={useColorModeValue("#FFFFFF", "#1C1A1A")}
            borderColor={useColorModeValue("#E2E8EF", "whiteAlpha.200")}
            boxShadow="0 10px 25px rgba(0, 0, 0, 0.12)"
            borderRadius="10px"
            p="6px"
            fontFamily="'Manrope', sans-serif"
            zIndex="1100"
          >
            <Box px={3} py={2}>
              <Text
                fontSize="13px"
                fontWeight="700"
                color={useColorModeValue("#1A2E3D", "#FFFFFF")}
              >
                {userName}
              </Text>
              <Text
                fontSize="11px"
                color={useColorModeValue("#64748B", "#94A3B8")}
                textTransform="capitalize"
              >
                {userRole}
              </Text>
            </Box>
            <Divider my={1} />
            <MenuItem
              icon={<FaRegUser size="14px" />}
              onClick={() => openProfileModal("My Profile")}
              fontSize="13px"
              borderRadius="6px"
              _hover={{ bg: useColorModeValue("#F1F5F9", "whiteAlpha.100") }}
            >
              My Profile
            </MenuItem>
            <MenuItem
              icon={<CgLogOff size="16px" />}
              onClick={() => openModal("logout")}
              color="red.500"
              fontSize="13px"
              borderRadius="6px"
              _hover={{ bg: useColorModeValue("#FEF2F2", "whiteAlpha.100") }}
            >
              Logout
            </MenuItem>
          </MenuList>
        </Menu>
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
