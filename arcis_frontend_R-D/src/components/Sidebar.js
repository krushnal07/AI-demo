import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Flex,
  VStack,
  Text,
  Tooltip,
  Image,
  Collapse,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  Portal,
  useColorModeValue,
} from "@chakra-ui/react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  MdOutlineBarChart,
  MdOutlineShield,
  MdOutlineDesktopWindows,
  MdOutlinePerson,
  MdOutlineChatBubbleOutline,
  MdOutlineHelpOutline,
  MdKeyboardArrowDown,
  MdKeyboardArrowUp,
  MdKeyboardArrowLeft,
  MdKeyboardArrowRight,
  MdNotificationsActive,
  MdDescription,
  MdShield,
  MdMap,
  MdTimeline,
  MdImageSearch,
} from "react-icons/md";
import { RiDashboardLine } from "react-icons/ri";
import { BsLightningCharge, BsStack, BsCalendarEvent } from "react-icons/bs";
import { TbCamera } from "react-icons/tb";

const mainMenuItems = [
  { label: "Dashboard", icon: <RiDashboardLine />, path: "/dash" },
  { label: "AI Dashboard", icon: <BsLightningCharge />, path: "/ai-dashboard" },
  { label: "Multi View", icon: <BsStack />, path: "/multiple" },
  { label: "Cameras", icon: <TbCamera />, path: "/Cameras" },
  { label: "AI Events", icon: <BsCalendarEvent />, path: "/events" },
  { label: "AI Alerts", icon: <MdNotificationsActive />, path: "/ai-alerts" },
  { label: "Forensic Report", icon: <MdDescription />, path: "/forensic-report" },
  { label: "Crime Intelligence", icon: <MdShield />, path: "/crime-intelligence" },
  { label: "Corridor Analytics", icon: <MdMap />, path: "/corridor-analytics" },
  { label: "Movement Map", icon: <MdTimeline />, path: "/movement-map" },
  { label: "Image Search", icon: <MdImageSearch />, path: "/image-search" },
  { label: "Analytics Reports", icon: <MdOutlineBarChart />, path: "/AnalyticsImage" },
  {
    label: "Admin Panel",
    icon: <MdOutlineShield />,
    subItems: [
      { label: "VMS Master", icon: <MdOutlineDesktopWindows />, path: "/EditableReport" },
      { label: "Register Face", icon: <MdOutlinePerson />, path: "/RegisterFace" },
    ],
  },
];

const bottomMenuItems = [
  { label: "AI Assistant", icon: <MdOutlineChatBubbleOutline />, path: "/chatbot" },
  { label: "FAQ", icon: <MdOutlineHelpOutline />, path: "/faq" },
];

export const rolePermissions = {
  MasterAdmin: {
    Dashboard: true,
    "AI Dashboard": true,
    "Camera Status": true,
    "Multi View": true,
    Cameras: true,
    "AI Events": true,
    "AI Alerts": true,
    "Forensic Report": true,
    "Crime Intelligence": true,
    "Corridor Analytics": true,
    "Movement Map": true,
    "Image Search": true,
    "Analytics Reports": true,
    Reports: [
      "Consolidated Report",
      "Installation Report",
      "Connected Report",
      "Gps Report",
      "Mobile App Report",
    ],
    Helpdesk: ["Call Activity", "Incidence Master"],
    "Admin Panel": [
      "VMS Master",
      "Register Face",
      "Vehicle Logs",
      "Hardware Service",
    ],
    "AI Assistant": true,
    FAQ: true,
  },
  USER: {
    Dashboard: true,
    "Camera Status": true,
    "Multi View": true,
    Cameras: true,
  },
  Demo: {
    Dashboard: true,
    Cameras: true,
    "Multi View": true,
    "AI Alerts": true,
    "Forensic Report": true,
    "Crime Intelligence": true,
    "Corridor Analytics": true,
    "Movement Map": true,
    "Image Search": true,
    "AI Assistant": true,
  },
  CEO: {
    Dashboard: true,
    "AI Dashboard": true,
    "Camera Status": true,
    "Multi View": true,
    Cameras: true,
    "AI Events": true,
    "AI Alerts": true,
    "Forensic Report": true,
    "Crime Intelligence": true,
    "Corridor Analytics": true,
    "Movement Map": true,
    "Image Search": true,
    "Analytics Reports": true,
    "AI Assistant": true,
    FAQ: true,
  },
  ECI: { "Multi View": true, "AI Assistant": true, FAQ: true },
  DistrictLevel: {
    Dashboard: true,
    "Camera Status": true,
    "Multi View": true,
    Cameras: true,
    "AI Events": true,
    "AI Alerts": true,
    "Forensic Report": true,
    "Crime Intelligence": true,
    "Corridor Analytics": true,
    "Movement Map": true,
    "Image Search": true,
    Heatmap: true,
    "AI Assistant": true,
    FAQ: true,
  },
  AssemblyLevel: {
    Dashboard: true,
    "Camera Status": true,
    "Multi View": true,
    Cameras: true,
    "AI Events": true,
    "AI Alerts": true,
    "Forensic Report": true,
    "Crime Intelligence": true,
    "Corridor Analytics": true,
    "Movement Map": true,
    "Image Search": true,
    Heatmap: true,
    "AI Assistant": true,
    FAQ: true,
  },
  Guest: { "AI Assistant": true, FAQ: true },
};

// True when the role may see the given menu label. A sub-item list counts as
// access to the parent label.
export const hasPermission = (role, label) => {
  const permissions = rolePermissions[role];
  if (!permissions) return false;
  if (permissions === "all") return true;
  const allowed = permissions[label];
  return allowed === true || (Array.isArray(allowed) && allowed.length > 0);
};

const filterMenuByRole = (items, role) => {
  const permissions = rolePermissions[role];
  if (!permissions) return [];
  if (permissions === "all") return items;
  return items
    .map((item) => {
      if (permissions[item.label] === true) return { ...item };
      if (Array.isArray(permissions[item.label])) {
        const allowedSubs = item.subItems?.filter((sub) =>
          permissions[item.label].includes(sub.label)
        );
        if (allowedSubs && allowedSubs.length > 0)
          return { ...item, subItems: allowedSubs };
      }
      if (!item.subItems && permissions[item.label]) return { ...item };
      return null;
    })
    .filter(Boolean);
};

function Sidebar({ isSidebarExpanded, setSidebarExpanded }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUserRole = localStorage.getItem("role") || "Guest";

  const [selectedItem, setSelectedItem] = useState(
    localStorage.getItem("selectedItem") || "Dashboard"
  );
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  const filteredMainMenu = useMemo(
    () => filterMenuByRole(mainMenuItems, currentUserRole),
    [currentUserRole]
  );
  const filteredBottomMenu = useMemo(
    () => filterMenuByRole(bottomMenuItems, currentUserRole),
    [currentUserRole]
  );

  const handleItemClick = useCallback(
    (label, path) => {
      setSelectedItem(label);
      localStorage.setItem("selectedItem", label);
      if (path) navigate(path);
    },
    [navigate]
  );

  const toggleAdminPanel = useCallback(() => {
    setIsAdminPanelOpen((prev) => !prev);
  }, []);

  // Synchronize selected item and expanded admin panel with current URL
  useEffect(() => {
    const allItems = [...mainMenuItems, ...bottomMenuItems];
    for (const item of allItems) {
      if (item.path === location.pathname) {
        setSelectedItem(item.label);
        break;
      }
      if (item.subItems) {
        const subFound = item.subItems.find(
          (sub) => sub.path === location.pathname
        );
        if (subFound) {
          setSelectedItem(subFound.label);
          setIsAdminPanelOpen(true);
          break;
        }
      }
    }
  }, [location.pathname]);

  // Sidebar Dark Theme Tokens (Preserves #3F77A5 visual identity with dark contrast)
  const sidebarBorder = useColorModeValue("1px solid rgba(255, 255, 255, 0.12)", "1px solid rgba(0, 0, 0, 0.25)");
  const dividerBorder = useColorModeValue("1px solid rgba(255, 255, 255, 0.14)", "1px solid rgba(255, 255, 255, 0.08)");
  const itemDefaultColor = useColorModeValue("rgba(255, 255, 255, 0.88)", "rgba(255, 255, 255, 0.90)");
  const itemHoverBg = useColorModeValue("rgba(255, 255, 255, 0.10)", "rgba(255, 255, 255, 0.12)");
  const itemActiveBg = useColorModeValue("rgba(255, 255, 255, 0.16)", "rgba(255, 255, 255, 0.18)");
  const collapseBtnBg = useColorModeValue("#F0F5FA", "rgba(255, 255, 255, 0.12)");
  const collapseBtnColor = useColorModeValue("#3F77A5", "#FFFFFF");
  const collapseBtnHoverBg = useColorModeValue("#E2EBF4", "rgba(255, 255, 255, 0.20)");
  const collapseBtnActiveBg = useColorModeValue("#D5E3F0", "rgba(255, 255, 255, 0.26)");

  return (
    <Box
      as="nav"
      boxShadow="2px 0px 20px rgba(0, 0, 0, 0.20)"
      w={isSidebarExpanded ? "228px" : "68px"}
      transition="width 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
      h="100vh"
      position="fixed"
      top="0px"
      left="0px"
      zIndex="1500"
      bg="#3F77A5"
      borderRight={sidebarBorder}
      display="flex"
      flexDirection="column"
      fontFamily="'Manrope', sans-serif"
      overflow="hidden"
    >
      {/* 1. LOGO CONTAINER (Height: 65px, Border-bottom: 1px solid #FFFFFF14, Padding: 16px) */}
      <Flex
        h="65px"
        w="100%"
        px={isSidebarExpanded ? "16px" : "12px"}
        py="14px"
        borderBottom={dividerBorder}
        align="center"
        gap="10px"
        cursor="pointer"
        onClick={() => navigate("/dash")}
        justify={isSidebarExpanded ? "flex-start" : "center"}
        userSelect="none"
      >
        <Image
          src="/images/Vlogo.png"
          alt="VMukti Logo"
          w="30px"
          h="30px"
          objectFit="contain"
          flexShrink={0}
        />

        {isSidebarExpanded && (
          <Flex direction="column" justify="center" minW="0" overflow="hidden">
            <Text
              fontFamily="'Manrope', sans-serif"
              fontWeight="800"
              fontSize="14px"
              lineHeight="16.8px"
              letterSpacing="0px"
              color="#FFFFFF"
              whiteSpace="nowrap"
            >
              VMukti
            </Text>
            <Text
              fontFamily="'Manrope', sans-serif"
              fontWeight="500"
              fontSize="10px"
              lineHeight="15px"
              letterSpacing="0.8px"
              color="#FFFFFF73"
              textTransform="uppercase"
              whiteSpace="nowrap"
            >
              VMS PLATFORM
            </Text>
          </Flex>
        )}
      </Flex>

      {/* 2. 2ND CONTAINER - MAIN MENU (Scrollable, Padding: 12px 10px, Gap: 2px) */}
      <Box
        flex="1"
        overflowY="auto"
        overflowX="hidden"
        pt="12px"
        pb="12px"
        px={isSidebarExpanded ? "10px" : "8px"}
        display="flex"
        flexDirection="column"
        gap="2px"
        css={{
          "&::-webkit-scrollbar": { width: "4px" },
          "&::-webkit-scrollbar-thumb": {
            background: "rgba(255, 255, 255, 0.2)",
            borderRadius: "4px",
          },
        }}
      >
        {filteredMainMenu.map((item) => {
          const isSelected = selectedItem === item.label;
          const hasSubItems = Boolean(item.subItems && item.subItems.length > 0);
          const isSubItemSelected =
            hasSubItems &&
            item.subItems.some((sub) => sub.label === selectedItem || sub.path === location.pathname);

          const mainButton = (
            <Flex
              w="100%"
              h="38px"
              px={isSidebarExpanded ? "14px" : "0"}
              py="9px"
              borderRadius="9px"
              align="center"
              justify={isSidebarExpanded ? "flex-start" : "center"}
              gap="10px"
              cursor="pointer"
              transition="all 0.18s ease"
              bg={isSelected || (isSubItemSelected && !isSidebarExpanded) ? "#FFFFFF" : "transparent"}
              color={isSelected || (isSubItemSelected && !isSidebarExpanded) ? "#3F77A5" : itemDefaultColor}
              boxShadow={isSelected || (isSubItemSelected && !isSidebarExpanded) ? "0 1px 4px rgba(0, 0, 0, 0.10)" : "none"}
              _hover={{
                bg: isSelected || (isSubItemSelected && !isSidebarExpanded) ? "#FFFFFF" : itemHoverBg,
                color: isSelected || (isSubItemSelected && !isSidebarExpanded) ? "#3F77A5" : "#FFFFFF",
              }}
              _active={{
                bg: isSelected || (isSubItemSelected && !isSidebarExpanded) ? "#FFFFFF" : itemActiveBg,
              }}
              onClick={() => {
                if (hasSubItems) {
                  if (!isSidebarExpanded) {
                    setSidebarExpanded(true);
                    setIsAdminPanelOpen(true);
                  } else {
                    toggleAdminPanel();
                  }
                } else {
                  handleItemClick(item.label, item.path);
                }
              }}
            >
              <Box
                fontSize="18px"
                boxSize="18px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                flexShrink={0}
                color={isSelected || (isSubItemSelected && !isSidebarExpanded) ? "#3F77A5" : "inherit"}
              >
                {item.icon}
              </Box>

              {isSidebarExpanded && (
                <>
                  <Text
                    fontFamily="'Manrope', sans-serif"
                    fontWeight={isSelected || isSubItemSelected ? "700" : "500"}
                    fontSize="13px"
                    lineHeight="19.5px"
                    letterSpacing="0px"
                    whiteSpace="nowrap"
                    flex="1"
                  >
                    {item.label}
                  </Text>

                  {hasSubItems && (
                    <Box fontSize="16px" color={isSelected ? "#3F77A5" : "#FFFFFF80"}>
                      {isAdminPanelOpen ? <MdKeyboardArrowUp /> : <MdKeyboardArrowDown />}
                    </Box>
                  )}
                </>
              )}
            </Flex>
          );

          if (hasSubItems && !isSidebarExpanded) {
            return (
              <Box key={item.label} w="100%">
                <Popover
                  trigger="hover"
                  placement="right-start"
                  isLazy
                  openDelay={80}
                  closeDelay={180}
                  gutter={12}
                >
                  <PopoverTrigger>
                    {mainButton}
                  </PopoverTrigger>
                  <Portal>
                    <PopoverContent
                      bg="#3F77A5"
                      borderColor="rgba(255, 255, 255, 0.18)"
                      borderWidth="1px"
                      boxShadow="0 10px 25px rgba(0, 0, 0, 0.3)"
                      borderRadius="12px"
                      p="8px"
                      w="190px"
                      color="white"
                      _focus={{ outline: "none" }}
                      fontFamily="'Manrope', sans-serif"
                      zIndex={2000}
                    >
                      <PopoverHeader
                        border="none"
                        pb="6px"
                        pt="2px"
                        px="8px"
                        fontSize="11px"
                        fontWeight="800"
                        color="#FFFFFF80"
                        textTransform="uppercase"
                        letterSpacing="0.8px"
                      >
                        {item.label}
                      </PopoverHeader>
                      <PopoverBody p="0">
                        <VStack align="stretch" spacing="4px">
                          {item.subItems.map((sub) => {
                            const isSubActive =
                              selectedItem === sub.label || location.pathname === sub.path;
                            return (
                              <Flex
                                key={sub.label}
                                h="36px"
                                px="10px"
                                py="6px"
                                borderRadius="8px"
                                align="center"
                                gap="8px"
                                cursor="pointer"
                                transition="all 0.15s ease"
                                bg={isSubActive ? "#FFFFFF" : "transparent"}
                                color={isSubActive ? "#3F77A5" : "#FFFFFF"}
                                fontWeight={isSubActive ? "700" : "500"}
                                boxShadow={isSubActive ? "0 1px 3px rgba(0,0,0,0.1)" : "none"}
                                _hover={{
                                  bg: isSubActive ? "#FFFFFF" : "rgba(255, 255, 255, 0.12)",
                                  color: isSubActive ? "#3F77A5" : "#FFFFFF",
                                }}
                                onClick={() => handleItemClick(sub.label, sub.path)}
                              >
                                <Box fontSize="16px" flexShrink={0} color={isSubActive ? "#3F77A5" : "inherit"}>
                                  {sub.icon}
                                </Box>
                                <Text fontSize="13px" whiteSpace="nowrap">
                                  {sub.label}
                                </Text>
                              </Flex>
                            );
                          })}
                        </VStack>
                      </PopoverBody>
                    </PopoverContent>
                  </Portal>
                </Popover>
              </Box>
            );
          }

          return (
            <Box key={item.label} w="100%">
              <Tooltip
                label={item.label}
                placement="right"
                isDisabled={isSidebarExpanded}
                hasArrow
              >
                {mainButton}
              </Tooltip>

              {/* Sub-items for Admin Panel */}
              {hasSubItems && (
                <Collapse in={isAdminPanelOpen && isSidebarExpanded} animateOpacity>
                  <VStack align="stretch" spacing="2px" pt="4px" pb="2px">
                    {item.subItems.map((sub) => {
                      const isSubActive =
                        selectedItem === sub.label || location.pathname === sub.path;

                      return (
                        <Flex
                          key={sub.label}
                          w="100%"
                          h="34px"
                          pl="28px"
                          pr="12px"
                          py="6px"
                          borderRadius="8px"
                          align="center"
                          gap="8px"
                          cursor="pointer"
                          transition="all 0.15s ease"
                          bg={isSubActive ? "#FFFFFF" : "transparent"}
                          color={isSubActive ? "#3F77A5" : itemDefaultColor}
                          boxShadow={isSubActive ? "0 1px 3px rgba(0, 0, 0, 0.10)" : "none"}
                          _hover={{
                            bg: isSubActive ? "#FFFFFF" : itemHoverBg,
                            color: isSubActive ? "#3F77A5" : "#FFFFFF",
                          }}
                          _active={{
                            bg: isSubActive ? "#FFFFFF" : itemActiveBg,
                          }}
                          onClick={() => handleItemClick(sub.label, sub.path)}
                        >
                          <Box fontSize="16px" flexShrink={0} color={isSubActive ? "#3F77A5" : "inherit"}>
                            {sub.icon}
                          </Box>
                          <Text
                            fontFamily="'Manrope', sans-serif"
                            fontWeight={isSubActive ? "700" : "500"}
                            fontSize="12.5px"
                            lineHeight="18px"
                            whiteSpace="nowrap"
                          >
                            {sub.label}
                          </Text>
                        </Flex>
                      );
                    })}
                  </VStack>
                </Collapse>
              )}
            </Box>
          );
        })}
      </Box>

      {/* 3. 3RD CONTAINER - BOTTOM ITEMS (Border-top: 1px solid #FFFFFF14, Padding: 8px 10px, Gap: 4px) */}
      <Box
        borderTop={dividerBorder}
        pt="8px"
        pb="8px"
        px={isSidebarExpanded ? "10px" : "8px"}
        display="flex"
        flexDirection="column"
        gap="4px"
        bg="#3F77A5"
      >
        {filteredBottomMenu.map((item) => {
          const isSelected =
            selectedItem === item.label || location.pathname === item.path;

          return (
            <Tooltip
              key={item.label}
              label={item.label}
              placement="right"
              isDisabled={isSidebarExpanded}
              hasArrow
            >
              <Flex
                w="100%"
                h="38px"
                px={isSidebarExpanded ? "14px" : "0"}
                py="9px"
                borderRadius="9px"
                align="center"
                justify={isSidebarExpanded ? "flex-start" : "center"}
                gap="10px"
                cursor="pointer"
                transition="all 0.18s ease"
                bg={isSelected ? "#FFFFFF" : "transparent"}
                color={isSelected ? "#3F77A5" : itemDefaultColor}
                boxShadow={isSelected ? "0 1px 4px rgba(0, 0, 0, 0.10)" : "none"}
                _hover={{
                  bg: isSelected ? "#FFFFFF" : itemHoverBg,
                  color: isSelected ? "#3F77A5" : "#FFFFFF",
                }}
                _active={{
                  bg: isSelected ? "#FFFFFF" : itemActiveBg,
                }}
                onClick={() => handleItemClick(item.label, item.path)}
              >
                <Box
                  fontSize="18px"
                  boxSize="18px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  flexShrink={0}
                  color={isSelected ? "#3F77A5" : "inherit"}
                >
                  {item.icon}
                </Box>

                {isSidebarExpanded && (
                  <Text
                    fontFamily="'Manrope', sans-serif"
                    fontWeight={isSelected ? "700" : "500"}
                    fontSize="13px"
                    lineHeight="19.5px"
                    letterSpacing="0px"
                    whiteSpace="nowrap"
                  >
                    {item.label}
                  </Text>
                )}
              </Flex>
            </Tooltip>
          );
        })}

        {/* 3rd Button: Sidebar Close/Collapse Button (Height: 31px, Background: #F0F5FA, Icon: #3F77A5) */}
        <Flex
          w="100%"
          h="31px"
          borderRadius="8px"
          p="8px"
          bg={collapseBtnBg}
          color={collapseBtnColor}
          align="center"
          justify="center"
          cursor="pointer"
          transition="all 0.18s ease"
          _hover={{ bg: collapseBtnHoverBg }}
          _active={{ bg: collapseBtnActiveBg }}
          onClick={() => setSidebarExpanded(!isSidebarExpanded)}
          aria-label={isSidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          <Box
            fontSize="16px"
            color={collapseBtnColor}
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            {isSidebarExpanded ? <MdKeyboardArrowLeft /> : <MdKeyboardArrowRight />}
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}

export default Sidebar;
