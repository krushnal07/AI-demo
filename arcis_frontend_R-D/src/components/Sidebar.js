import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Flex,
  VStack,
  Text,
  useColorModeValue,
  Divider,
  Tooltip,
  Image,
  Collapse,
} from "@chakra-ui/react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  MdOutlineSpaceDashboard,
  MdKeyboardArrowRight,
  MdKeyboardArrowDown,
  MdLocationOn,
  MdSchool,
  MdVideocam,
  MdEvent
} from "react-icons/md";
import { TbDeviceCctv } from "react-icons/tb";
import { BsCpu } from "react-icons/bs";
import { MdOutlineQuestionAnswer } from "react-icons/md";
import {
  RiCheckboxMultipleBlankLine
} from "react-icons/ri";
import { IoDocumentTextOutline } from "react-icons/io5";
import Reports from "../pages/Reports";
import AnalyticsImage from "../pages/AnalyticsImage";

const allMenuItems = [
  { label: "Dashboard", icon: <MdOutlineSpaceDashboard />, path: "/dash" },
  { label: "AI Dashboard", icon: <BsCpu />, path: "/ai-dashboard" },
  // { label: "Camera Status", icon: <MdLocationOn/>, path: "/camerastatus" },
  { label: "Multi View", icon: <TbDeviceCctv />, path: "/multiple" },
  { label: "Cameras", icon: <MdVideocam />, path: "/Cameras" },
  { label: "AI Events", icon: <MdEvent />, path: "/events" },
  { label: "Analytics Reports", icon: <RiCheckboxMultipleBlankLine />, path: "/AnalyticsImage" },
  // {
  //   label: "Reports",
  //   icon: <IoDocumentTextOutline />,
  //   subItems: [
  //     { label: "Consolidated Report", path: "/CameraReport" },
  //     { label: "Installation Report", path: "/InstallationReport" },
  //     { label: "Connected Report", path: "/ConnectedonceReport" },
  //     { label: "Gps Report", path: "/tripreport" },
  //     { label: "Mobile App Report", path: "/mobileapp" },
  //   ],
  // },
  // {
  //   label: "Helpdesk",
  //   icon: <IoDocumentTextOutline/>,
  //   subItems: [
  //     { label: "Call Activity", path: "/helpdesk" },
  //     { label: "Incidence Master", path: "/incidenceMaster" },
  //   ],
  // },
  {
    label: "Admin Panel",
    icon: <MdSchool />,
    subItems: [
      { label: "VMS Master", path: "/EditableReport" },
      // { label: "Vehicle Logs", path: "/VehicleLogs" },
      // { label: "Hardware Service", path: "/inventoryUpdation" },
    ],
  },
  { label: "FAQ", icon: <MdOutlineQuestionAnswer />, path: "/faq" },
];

const rolePermissions = {
  MasterAdmin: { Dashboard: true, "AI Dashboard": true, "Camera Status": true, "Multi View": true, Cameras: true, "AI Events": true, "Analytics Reports": true, Reports: ["Consolidated Report", "Installation Report", "Connected Report", "Gps Report", "Mobile App Report"], "Helpdesk": ["Call Activity", "Incidence Master"], "Admin Panel": ["VMS Master", "Vehicle Logs", "Hardware Service"], FAQ: true },
  VmuktiAdmin: { Dashboard: true, "AI Dashboard": true, "Camera Status": true, "Multi View": true, Cameras: true, "AI Events": true, Heatmap: true, Reports: ["Consolidated Report", "Gps Report", "Mobile App Report"], "Helpdesk": ["Call Activity", "Incidence Master"], "Admin Panel": ["Vehicle Master", "Vehicle Logs", "Hardware Service"], FAQ: true },
  CEO: { Dashboard: true, "AI Dashboard": true, "Camera Status": true, "Multi View": true, Cameras: true, "AI Events": true, FAQ: true },
  ECI: { "Multi View": true, FAQ: true },
  DistrictLevel: { Dashboard: true, "Camera Status": true, "Multi View": true, Cameras: true, "AI Events": true, Heatmap: true, FAQ: true },
  AssemblyLevel: { Dashboard: true, "Camera Status": true, "Multi View": true, Cameras: true, "AI Events": true, Heatmap: true, FAQ: true },
  Guest: { FAQ: true },
};

const getFilteredMenu = (items, role) => {
  const permissions = rolePermissions[role];
  if (!permissions) return [];
  if (permissions === "all") return items;
  return items.map((item) => {
    if (permissions[item.label] === true) return { ...item };
    if (Array.isArray(permissions[item.label])) {
      const allowedSubs = item.subItems?.filter((sub) => permissions[item.label].includes(sub.label));
      if (allowedSubs && allowedSubs.length > 0) return { ...item, subItems: allowedSubs };
    }
    if (!item.subItems && permissions[item.label]) return { ...item };
    return null;
  }).filter(Boolean);
};

function Sidebar({ isSidebarExpanded, setSidebarExpanded }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUserRole = localStorage.getItem("role") || "Guest";

  const [selectedItem, setSelectedItem] = useState(localStorage.getItem("selectedItem") || "Dashboard");
  const [openSubMenuLabel, setOpenSubMenuLabel] = useState("");

  const textColor = useColorModeValue("custom.lightModeText", "custom.darkModeText");
  const sidebarButtonColor = useColorModeValue(
    "linear-gradient(93.5deg, #9CBAD2 0.56%, #CDDEEB 94.58%)",
    "linear-gradient(93.5deg, #2A2A2A 0.56%, #030711 94.58%)"
  );
  const sidebarBg = useColorModeValue("white", "#030711"); // Made solid so content doesn't bleed through
  const sidebarButtonIconColor = useColorModeValue("black", "white");

  const fullLogo = useColorModeValue("/images/vmukti_light.png", "/images/vmukti.png");
  const collapsedLogo = useColorModeValue("/images/Vlogo.png", "/images/Vlogo_dark.png");

  const menuItemsToRender = useMemo(() => getFilteredMenu(allMenuItems, currentUserRole), [currentUserRole]);

  const handleItemClick = useCallback((label, path) => {
    setSelectedItem(label);
    localStorage.setItem("selectedItem", label);
    if (path) navigate(path);
  }, [navigate]);

  const toggleSubMenu = useCallback((label) => {
    setOpenSubMenuLabel((prev) => (prev === label ? "" : label));
  }, []);

  useEffect(() => {
    for (const item of allMenuItems) {
      if (item.path === location.pathname) {
        setSelectedItem(item.label);
        break;
      }
      if (item.subItems) {
        const subFound = item.subItems.find((sub) => sub.path === location.pathname);
        if (subFound) {
          setSelectedItem(subFound.label);
          setOpenSubMenuLabel(item.label);
          break;
        }
      }
    }
  }, [location.pathname]);

  return (
    <Box
      as="nav"
      onMouseEnter={() => setSidebarExpanded(true)}
      onMouseLeave={() => {
        setSidebarExpanded(false);
        setOpenSubMenuLabel("");
      }}
      boxShadow="2px 0px 20px rgba(0, 0, 0, 0.2)"
      w={isSidebarExpanded ? "214px" : "60px"}
      transition="width 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
      h="100vh"
      p={isSidebarExpanded ? 3 : 2}
      position="fixed" // Overlay fixed position
      top="0px"
      left="0px"
      zIndex="1500" // Higher than page content
      borderTopRightRadius="30px"
      bg={sidebarBg}
      overflowY="auto"
      css={{ '&::-webkit-scrollbar': { display: 'none' } }}
    >
      <Flex direction="column" gap={10} alignItems="center" mt={5} color={textColor}>
        <Image
          src={isSidebarExpanded ? fullLogo : collapsedLogo}
          alt="Logo"
          w={isSidebarExpanded ? "111px" : "35px"}
          h={isSidebarExpanded ? "28px" : "35px"}
          objectFit="contain"
          onClick={() => navigate("/dash")}
          cursor="pointer"
        />

        <VStack align="stretch" spacing={2} width="100%">
          {menuItemsToRender.map((item) => (
            <Box key={item.label}>
              <Tooltip label={item.label} placement="right" isDisabled={isSidebarExpanded}>
                <Flex
                  cursor="pointer"
                  align="center"
                  bg={selectedItem === item.label || openSubMenuLabel === item.label ? sidebarButtonColor : "transparent"}
                  p={isSidebarExpanded ? 2 : 2}
                  borderRadius="8px"
                  onClick={() => item.subItems ? toggleSubMenu(item.label) : handleItemClick(item.label, item.path)}
                  justifyContent={isSidebarExpanded ? "flex-start" : "center"}
                >
                  <Box color={sidebarButtonIconColor} fontSize="23px">
                    {item.icon}
                  </Box>

                  {isSidebarExpanded && (
                    <>
                      <Text ml={4} fontSize="14px" fontWeight={(selectedItem === item.label || openSubMenuLabel === item.label) ? "700" : "400"} flexGrow={1} whiteSpace="nowrap">
                        {item.label}
                      </Text>
                      {item.subItems && (
                        <Box fontSize="18px">
                          {openSubMenuLabel === item.label ? <MdKeyboardArrowDown /> : <MdKeyboardArrowRight />}
                        </Box>
                      )}
                    </>
                  )}
                </Flex>
              </Tooltip>

              {item.subItems && (
                <Collapse in={openSubMenuLabel === item.label && isSidebarExpanded} animateOpacity>
                  <VStack align="stretch" pl={10} py={1} spacing={1}>
                    {item.subItems.map((sub) => (
                      <Box
                        key={sub.label}
                        onClick={() => handleItemClick(sub.label, sub.path)}
                        cursor="pointer"
                        p={1.5}
                        borderRadius="8px"
                        bg={selectedItem === sub.label ? sidebarButtonColor : "transparent"}
                      >
                        <Text fontSize="13px" fontWeight={selectedItem === sub.label ? "700" : "400"} whiteSpace="nowrap">
                          {sub.label}
                        </Text>
                      </Box>
                    ))}
                  </VStack>
                </Collapse>
              )}
            </Box>
          ))}
        </VStack>
      </Flex>
    </Box>
  );
}

export default Sidebar;
