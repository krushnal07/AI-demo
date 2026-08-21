import {
  Box,
  Flex,
  Text,
  Tabs,
  TabList,
  Tab,
  Input,
  InputGroup,
  IconButton,
  SimpleGrid,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
  Badge,
  useColorModeValue,
  Image,
  Divider,
  InputLeftElement,
  HStack,
  Tag,
  Portal,
  Tooltip,
  Skeleton,
  SkeletonText,
  InputRightElement,
  Icon,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  FormControl,
  FormLabel,
  ModalFooter,
  Heading,
  Select,
  Switch,
  Spacer,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  Grid,
  useToast,
  RadioGroup,
  VStack,
  Radio,
  grid,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  Spinner,

} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { BsThreeDotsVertical } from "react-icons/bs";
import { Link, useNavigate } from "react-router-dom";
import {
  getAllCameras,
  getSharedCamera,
  getSharedEmails,
  removeSharedCamera,
  removeUserCamera,
  shareCamera,
  updateCamera,
  getdistrictwiseAccess,
  getDistrictNameByAssemblyName,
  getCamerasByDistrict
} from "../actions/cameraActions";
import { MdGridView, MdChevronLeft, MdChevronRight, MdSearch } from "react-icons/md";
import { TbCamera, TbLayoutGrid, TbList } from "react-icons/tb";
import { TfiLayoutListThumb } from "react-icons/tfi";
import { CiCircleRemove, CiMap } from "react-icons/ci";
import { IoMdNotificationsOutline } from "react-icons/io";
import { IoPlayCircleOutline, IoSearchOutline } from "react-icons/io5";
import { LuLayoutList } from "react-icons/lu";
import { Link as RouterLink, useLocation } from "react-router-dom";
import theme from "../theme";
import { InfoIcon } from "@chakra-ui/icons";
import {
  getImageInfo,
  setSmartQuality,
  getVideoEncodeChannelMain,
  getVideoEncodeChannelSub,
  getVideoSettings,
  rebootCamera,
  setImageInfo,
  setVideoEncodeChannelMain,
  setVideoEncodeChannelSub,
  setVideoSettings,
} from "../actions/settingsActions";
import NoCameraFound from "../components/NoCameraFound";
import MobileHeader from "../components/MobileHeader";
import AudioRecorder from "../components/AudioRecorder";
import VMuktiLogo from "../components/VMuktiLogo";
import { FiInfo } from "react-icons/fi";
//import DashboardHeader from "./DashboardHeader";

const Cameras = () => {
  const toast = useToast();
  const location = useLocation();

  const [userDistricts, setUserDistricts] = useState([]);
  const [isDistrictLoading, setIsDistrictLoading] = useState(true);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [isGridView, setGridView] = useState(() => {
    // Load the view preference from localStorage on initialization
    const savedView = localStorage.getItem("cameraView");
    return savedView ? savedView === "grid" : true; // Default to Grid View
  });
  const [tempView, setTempView] = useState(
    isGridView ? "Grid View" : "List View"
  ); // Temporary state for the selection

  const [sharedCameras, setSharedCameras] = useState([]);
  const [sortStatus, setSortStatus] = useState(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(isGridView ? 6 : 20);
  // const tabBg = useColorModeValue("#F1EFFE", "#5F4BB6");
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [activeModal, setActiveModal] = useState(null);
  const [smartQualityActiveModal, setSmartQualityActiveModal] = useState(null);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [selectedCameraName, setSelectedCameraName] = useState(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [selectedCameraType, setSelectedCameraType] = useState(null);
  const [selectedEmailId, setSelectedEmailId] = useState(null);
  const [shareEmail, setShareEmail] = useState("");
  const [activeTab, setActiveTab] = useState("Video settings");
  const [camerasTab, setCamerasTab] = useState("My Cameras");
  const [timeZoneOffset, setTimeZoneOffset] = useState("+00:00"); // Initial timezone value
  const [brightness, setBrightness] = useState(50);
  const [contrast, setContrast] = useState(50);
  const [saturation, setSaturation] = useState(0);
  const [hue, setHue] = useState(0);
  const [sharpness, setSharpness] = useState(50);
  const [flip, setFlip] = useState(false);
  const [mirror, setMirror] = useState(false);
  const [irCutMode, setIrCutMode] = useState(false);
  const [sharedEmails, setSharedEmails] = useState([]);
  const [totalCameras, setTotalCameras] = useState(0);
  const [totalSharedCameras, setTotalSharedCameras] = useState(0);
  const cardDetailsColor = useColorModeValue("linear-gradient(180deg, rgba(173, 209, 235) 5.17%, rgba(255, 255, 255) 45.14%)", "linear-gradient(to right bottom, #163B74 10.53%, rgba(3, 7, 17) 100.32%)")
  // Video Settings Tab (raw encode config)
  const [streamType, setStreamType] = useState("main");
  const [bitRate, setBitRate] = useState("");
  const [frameRate, setFrameRate] = useState("");
  const [codecType, setCodecType] = useState("");
  const [resolution, setResolution] = useState("");
  const [bitRateType, setBitRateType] = useState("");
  const [enablesmartQuality, setenableSmartQuality] = useState(false);
  const [dataPlan, setdataPlan] = useState(0);
  // wifi settings
  const [wifiName, setWifiName] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiResponse, setWifiResponse] = useState(null);
  const [selectedAssembly, setSelectedAssembly] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // --- NEW State for Districts and Assemblies ---
  const [userEmail, setUserEmail] = useState(localStorage.getItem("email") || ''); // Get email once
  const [allAccessibleData, setAllAccessibleData] = useState([]); // Raw data from first API
  // --- End NEW State ---
  const [districtWiseCameras, setDistrictWiseCameras] = useState({});
  const [assemblyWiseCameras, setAssemblyWiseCameras] = useState({});
  const [selectedDistrictName, setSelectedDistrictName] = useState('');
  const [selectedAssemblyValue, setSelectedAssemblyValue] = useState('');
  const [uniqueDistricts, setUniqueDistricts] = useState([]);
  const [assemblies, setAssemblies] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingAssemblies, setLoadingAssemblies] = useState(false);
  const [districtError, setDistrictError] = useState(null);
  const [assemblyError, setAssemblyError] = useState(null);
  const [selectedDistrictDid, setSelectedDistrictDid] = useState('');
  const [unfilteredCameras, setUnfilteredCameras] = useState([]);
  const [view, setView] = useState("grid");
  const [psOption, setPsOption] = useState("ps");
  const [reportFormat, setReportFormat] = useState("csv");

  // State for fetched data
  const [districts, setDistricts] = useState([]);


  // Chakra UI hooks
  const cardBg = useColorModeValue("#FFFFFF", "#1C1A1A");
  const cardBorder = useColorModeValue("#E2E8EF", "#2D3748");
  const titleColor = useColorModeValue("#1A2E3D", "#FFFFFF");
  const placeholderColor = useColorModeValue("#1A2E3D80", "#94A3B8");
  const imageContainerBg = useColorModeValue("#E8EFF7", "#1E293B");
  const cameraPlaceholderLogo = useColorModeValue("/images/Vlogodark.png", "/images/Vlogo.png");
  const radioButtonColor = useColorModeValue("black", "white");
  //const grid_view_icon = useColorModeValue("/images/grid_view_icon_light.png", "/images/grid_view_icon.png");
  //const list_view_icon = useColorModeValue("/images/list_view_icon_light.png", "/images/list_view_icon.png");
  const buttonGradientColor = useColorModeValue(
    "linear-gradient(93.5deg, #9CBAD2 , #CDDEEB 94.58%)", // light mode
    "linear-gradient(93.5deg, #2A2A2A 0.56%, #030711 50.58%)" // dark mode
  );


  // gradient style for buttons
  const gradientBtn = {
    bg: buttonGradientColor,
    _hover: {
      bg: useColorModeValue(
        "linear-gradient(93.5deg, #8EABC5 , #C4D7E7 94.58%)", // slightly darker hover in light mode
        "linear-gradient(93.5deg, #1F1F1F 0.56%, #010307 50.58%)" // darker hover in dark mode
      ),
    },
  };
  const totalCount = cameras.length;
  const onlineCount = cameras.filter((cam) => cam.status === "online").length;
  const offlineCount = cameras.filter((cam) => cam.status === "offline").length;

  const handleTimeZoneChange = (event) => {
    setTimeZoneOffset(event.target.value);
  };

  const openModal = (modal, cameraId, cameraName) => {
    setActiveModal(modal);
    setSelectedCameraId(cameraId);
    setSelectedCameraName(cameraName);
    onOpen();
  };

  const openSettingsModal = (modal, deviceId, cameraName, productType) => {
    setActiveModal(modal);
    setSelectedDeviceId(deviceId);
    setSelectedCameraName(cameraName);
    setSelectedCameraType(productType);
    onOpen();
  };

  const openShareModal = (modal, deviceId) => {
    setActiveModal(modal);
    setSelectedDeviceId(deviceId);
    onOpen();
  };

  const openShareAccessModal = (modal, deviceId) => {
    fetchSharedEmails(deviceId);
    setActiveModal(modal);
    setSelectedDeviceId(deviceId);
    onOpen();
  };

  const openRemoveSharedCameraModal = (modal, deviceId) => {
    setActiveModal(modal);
    setSelectedDeviceId(deviceId);
    onOpen();
  };

  const openRemoveCamera = (modal, deviceId) => {
    setActiveModal(modal);
    setSelectedDeviceId(deviceId);
    onOpen();
  };

  const openRemoveAdminShareModal = (modal, deviceId, email) => {
    setActiveModal(modal);
    setSelectedEmailId(email);
    setSelectedDeviceId(deviceId);
    onOpen();
  };

  const handleToggleSmartQuality = (modal) => {
    setenableSmartQuality(!enablesmartQuality);
    if (!enablesmartQuality) {
      setSmartQualityActiveModal(modal);
      onOpen();
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setActiveTab("Video settings");
    onClose();
  };

  const handleUpdateCameraName = async (name) => {
    // Update the camera in the cameras array
    try {
      const response = await updateCamera(selectedCameraId, name);
      closeModal();
      setSelectedCameraId(null);
      setSelectedCameraName(null);
      fetchAllCameras();
      // // console.log("Camera updated:", response);
    } catch (error) {
      console.error("Error updating camera:", error);
    }
  };

  const handleShareCamera = async () => {
    // Update the camera in the cameras array
    try {
      const response = await shareCamera(selectedDeviceId, shareEmail);
      closeModal();
      setSelectedDeviceId(null);
      setShareEmail(null);
      fetchAllCameras();
      toast({
        title: response.message,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error updating camera:", error);
    }
  };

  // Sample camera data
  // const cameras = Array(10).fill({
  // name: "Entry Gate No 18",
  // status: "Offline", // "Offline"
  // snapshot: "Snapshot : 15 mins ago",
  // });

  // Colors to match the provided image
  const tabBg = useColorModeValue("#F1EFFE", "#5F4BB6");
  const gridBorderColor = useColorModeValue("#FCFCFC", "#231F1F");
  const tabActiveColor = useColorModeValue(
    "custom.lightModeText",
    "custom.darkModeText"
  );
  const onlineBackgroundColor = useColorModeValue("rgba(0,128,0,0.2)", "rgba(64, 130, 64, 0.5)");
  const offlineBackgroundColor = useColorModeValue("rgba(128,0,0,0.2)", "rgba(128,0,0,0.5)");
  const tabInactiveColor = useColorModeValue("#65758B", "custom.tabDarkMode");
  const bgColor = useColorModeValue("custom.primary", "custom.darkModePrimary");
  const textColor = useColorModeValue(
    "custom.lightModeText",
    "custom.darkModeText"
  );

  const selectedTab = useColorModeValue(
    "custom.primary",
    "custom.darkModePrimary"
  );

  // handle pagination
  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
    // // console.log("Previous Page", page);
  };

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
    // // console.log("Next Page", page);
  };
  // Example: In your API service file (e.g., api.js)
  // This function needs to take the district identifier (name or ID)
  // and return a promise that resolves to an array of assembly objects.
  const getAssembliesByDistrictAPI = async (districtIdentifier) => {
    // Replace with your actual API endpoint and logic
    // The backend needs an endpoint like /api/assemblies?district=<districtIdentifier>
    // or /api/districts/<districtIdentifier>/assemblies
    const response = await fetch(`/api/assemblies?district=${encodeURIComponent(districtIdentifier)}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to fetch assemblies');
    }
    const data = await response.json();
    return data.assemblies || []; // Assuming the API returns { assemblies: [...] }
  };

  // --- Fetch Cameras ---

  // src/components/Cameras.js

  const fetchAllCameras = async () => {
    setIsLoading(true);
    try {
      console.log("COMPONENT: fetchAllCameras - Calling action with parameters:", {
        page, itemsPerPage, search, sortStatus,
        district: selectedDistrictName, assembly: selectedAssemblyValue,
      });

      const response = await getAllCameras( // Calls the action from cameraActions.js
        page, itemsPerPage, search, sortStatus, selectedDistrictName, selectedAssemblyValue
      );

      console.log("COMPONENT: fetchAllCameras - Raw response from ACTION call:", JSON.stringify(response, null, 2));

      let camerasFromBackend = [];
      let dataSourceInfo = "No camera data or API call failed.";

      if (response && response.success) {
        camerasFromBackend = response.cameras || [];
        dataSourceInfo = `Using 'response.cameras' (count: ${camerasFromBackend.length}). Backend handled primary filtering.`;
        if (selectedAssemblyValue) dataSourceInfo += ` Queried for Assembly: ${selectedAssemblyValue}.`;
        else if (selectedDistrictName) dataSourceInfo += ` Queried for District: ${selectedDistrictName}.`;
        else dataSourceInfo += ` No specific district or assembly queried.`;
      } else if (response) {
        dataSourceInfo = `API call failed: ${response.message || 'Unknown API error'}`;
        console.error("COMPONENT: fetchAllCameras - API call reported failure:", response);
        toast({ title: "API Error", description: response.message || "Failed to retrieve cameras.", status: "error", duration: 5000, isClosable: true });
      }
      console.log("COMPONENT: fetchAllCameras - Data source info:", dataSourceInfo);

      if (response && response.success) {
        setUnfilteredCameras(camerasFromBackend);
        setTotalPages(response.totalPages || 1);
        setTotalCameras(response.total !== undefined ? response.total : 0);
      } else {
        setUnfilteredCameras([]); setTotalCameras(0); setPage(1); setTotalPages(1);
      }
    } catch (err) {
      const errorMessage = err.message || "Component error in fetching cameras.";
      console.error("COMPONENT: fetchAllCameras - JavaScript/Network Error:", errorMessage, err);
      setUnfilteredCameras([]); setTotalCameras(0); setPage(1); setTotalPages(1);
      toast({ title: "Fetch Error", description: errorMessage, status: "error", duration: 5000, isClosable: true });
    } finally {
      setIsLoading(false);
    }
  };


  const fetchSharedCameras = async () => {
    try {
      const response = await getSharedCamera();
      // // console.log("getSharedCameras", response);
      setSharedCameras(response.data || []);
      setTotalSharedCameras(response.total || 0);
    } catch (error) {
      console.error("Error fetching cameras:", error);
    } finally {
      setIsLoading(false); // Stop loading when data is fetched
    }
  };

  const fetchSharedEmails = async (deviceId) => {
    try {
      const response = await getSharedEmails(deviceId);
      setSharedEmails(response.data);
      // // console.log("getSharedEmails", response);
    } catch (error) {
      console.error("Error fetching cameras:", error);
    } finally {
      setIsLoading(false); // Stop loading when data is fetched
    }
  };

  const email = localStorage.getItem("email");
  const handleRemoveSharedCamera = async () => {
    try {
      // Use emailId if it exists; otherwise, fallback to email
      const emailToUse = selectedEmailId || email;
      // // console.log("emailToUse", emailToUse);
      const response = await removeSharedCamera(emailToUse, selectedDeviceId);
      // // console.log("removeSharedCamera", response);

      fetchSharedCameras();
      setSelectedDeviceId(null);
      closeModal();

      toast({
        title: "Camera Access Removed Successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error fetching cameras:", error);
    }
  };

  const handleRemoveCamera = async () => {
    try {
      const response = await removeUserCamera(selectedDeviceId);
      // // console.log("removeUserCamera", response);
      fetchAllCameras();
      closeModal();
      toast({
        title: "Camera Removed Successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error fetching cameras:", error);
    }
  };


  // Utility function to calculate the time difference
  const getTimeAgo = (timestamp) => {
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const timeDiffInSeconds = currentTime - timestamp;

    if (timeDiffInSeconds < 60) {
      return `${timeDiffInSeconds} seconds ago`;
    } else if (timeDiffInSeconds < 3600) {
      const minutes = Math.floor(timeDiffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    } else if (timeDiffInSeconds < 86400) {
      const hours = Math.floor(timeDiffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else {
      const days = Math.floor(timeDiffInSeconds / 86400);
      return `${days} day${days > 1 ? "s" : ""} ago`;
    }
  };

  // Fetch initial data
  // const fetchCameras = async () => {
  //   try {
  //     const response = await getAllCameras(page, itemsPerPage, sortStatus); // Fetch paginated data
  //     console.log("getAllCameras: ", response);

  //     setCameras(response.cameras || []);
  //     setTotalPages(response.totalPages || 1);
  //     setTotalCameras(response.total || 0);

  //   } catch (error) {
  //     console.error("Error fetching cameras:", error);
  //   }
  // };

  const updateCameraData = () => {
    setCameras((prevCameras) =>
      prevCameras.map((camera) => {
        const storedData = localStorage.getItem(
          `deviceImage_${camera.deviceId}`
        );
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          return {
            ...camera,
            imageUrl:
              parsedData.imageUrl ||
              "https://zeta.arcisai.io/images/CameraCard.png", // Default fallback
            lastOpened: getTimeAgo(parsedData.timestamp),
          };
        }
        return {
          ...camera,
          imageUrl: "https://zeta.arcisai.io/images/CameraCard.png", // Default fallback
          lastOpened: "N/A",
        };
      })
    );
  };

  const handleViewChange = (isGrid) => {
    setGridView(isGrid);
    setItemsPerPage(isGrid ? 6 : 20); // Set itemsPerPage to 20 for list view, 6 for grid view
    setPage(isGrid ? 1 : 1);
  };

  useEffect(() => {
    // Save the current view preference to localStorage whenever it changes
    localStorage.setItem("cameraView", isGridView ? "grid" : "list");

    // Fetch cameras and shared cameras
    // fetchCameras();
    fetchSharedCameras();

    // Set interval to update camera data from localStorage
    const intervalId = setInterval(updateCameraData, 5000);

    // Cleanup interval on unmount
    return () => clearInterval(intervalId);
  }, [isGridView, page]); // Depend on `isGridView` and `page`

  // Sort function based on status
  const sortCameras = (status) => {
    if (status === "online") {
      setCameras((prevCameras) =>
        [...prevCameras].sort((a, b) => (a.status === "online" ? -1 : 1))
      );
    } else if (status === "offline") {
      setCameras((prevCameras) =>
        [...prevCameras].sort((a, b) => (a.status === "offline" ? -1 : 1))
      );
    }
  };


  // --- Fetch Districts ---
  // --- Fetch Districts ---
  useEffect(() => {
    const fetchInitialDistricts = async () => {
      if (!userEmail) {
        setDistrictError("User email not available for fetching districts.");
        setLoadingDistricts(false);
        return;
      }
      setLoadingDistricts(true);
      setDistrictError(null);
      try {
        const response = await getdistrictwiseAccess(userEmail); // Call the ACTION

        if (response?.success && Array.isArray(response.matchedDistricts)) {

          // --- THIS IS THE FIX ---
          // The API returned duplicates, so we create a unique list here.

          const districtsMap = new Map();
          response.matchedDistricts.forEach(district => {
            // By using 'dist_name' as the key, the Map automatically handles
            // uniqueness. It will overwrite any previous entry with the same name.
            districtsMap.set(district.dist_name, district);
          });

          // Convert the map's values back into a unique array of district objects.
          const trulyUniqueDistricts = Array.from(districtsMap.values());

          // Now, set the state with the clean, de-duplicated data.
          setUniqueDistricts(trulyUniqueDistricts);
          // --- END OF FIX ---

        } else {
          setDistrictError(response?.message || "Failed to load districts.");
          setUniqueDistricts([]);
        }
      } catch (err) {
        setDistrictError(err.message || "Error occurred while fetching districts.");
        setUniqueDistricts([]);
      } finally {
        setLoadingDistricts(false);
      }
    };

    fetchInitialDistricts();
  }, [userEmail]); // Depends on userEmail



  // --- Fetch Assemblies when district is selected ---
  // --- Fetch Assemblies when district is selected ---
  // src/components/Cameras.js
  const handleDistrictChange = async (event) => {
    const selectedDistName = event.target.value;
    console.log("COMPONENT: handleDistrictChange - Selected District Name:", selectedDistName);
    setSelectedDistrictName(selectedDistName);
    setSelectedAssemblyValue(''); // CRITICAL RESET
    console.log("COMPONENT: handleDistrictChange - selectedAssemblyValue RESET");

    setAssemblies([]);
    setAssemblyError(null);

    if (!selectedDistName) {
      setSelectedDistrictDid('');
      setLoadingAssemblies(false);
      return;
    }

    // const districtObject = uniqueDistricts.find(d => d.name === selectedDistName); // Already set by fetchDistricts for display
    // setSelectedDistrictDid(districtObject ? districtObject.did : ''); // If needed for client-side logic

    setLoadingAssemblies(true);
    try {
      // Pass userEmail from component state
      const response = await getDistrictNameByAssemblyName(userEmail, selectedDistName);
      console.log("COMPONENT: handleDistrictChange - Response from getDistrictNameByAssemblyName (fetching assemblies):", JSON.stringify(response, null, 2));

      if (response?.success) {
        const assembliesArray = response.districts; // Backend returns assemblies under 'districts' key
        if (Array.isArray(assembliesArray)) {
          setAssemblies(assembliesArray); // Backend now sorts assemblies
          if (assembliesArray.length === 0) console.log("COMPONENT: No assemblies found for district:", selectedDistName);
        } else {
          setAssemblyError("Invalid assembly data format from API."); setAssemblies([]);
        }
      } else {
        setAssemblyError(response?.message || "Failed to load assemblies for district."); setAssemblies([]);
      }
    } catch (err) {
      setAssemblyError(err.message || "Error fetching assemblies."); setAssemblies([]);
    } finally {
      setLoadingAssemblies(false);
    }
  };



  // --- Assembly Change Handler ---
  const handleAssemblyChange = (event) => {
    setSelectedAssemblyValue(event.target.value);

  };



  // Handle click for sorting
  const handleSort = (status) => {
    setSortStatus(status);

    // sortCameras(status);
    setPage(1);
    // console.log(status);
  };

  const handleCameraClick = (cameraId, status) => {
    navigate(`/camera/${cameraId}`, { state: { status } });
  };

  const fetchData = async () => {
    try {
      if (activeTab === "Media") {
        const response = await getVideoSettings(selectedDeviceId);
        const response2 = await getImageInfo(selectedDeviceId);
        // console.log("getVideoSettings", response2);
        setIrCutMode(response2.irCutMode);
        setBrightness(response.brightnessLevel);
        setContrast(response.contrastLevel);
        setSaturation(response.saturationLevel);
        setSharpness(response.sharpnessLevel);
        setHue(response.hueLevel);
        setMirror(response.mirrorEnabled);
        setFlip(response.flipEnabled);
      } else if (activeTab === "Video settings") {
        const response = streamType === "main"
          ? await getVideoEncodeChannelMain(selectedDeviceId)
          : await getVideoEncodeChannelSub(selectedDeviceId);
        if (response) {
          setBitRate(response.constantBitRate || "");
          setFrameRate(response.frameRate || "");
          setCodecType(response.codecType || "");
          setResolution(response.resolution || "");
          setBitRateType(response.bitRateControlType || "");
        }
      }
    } catch (error) {
      console.error(`Failed to fetch ${activeTab} settings:`, error);
    }
  };

  useEffect(() => {
    // Only proceed if the modal is open and is the Camera Settings modal
    if (isOpen && activeModal === "Camera Settings") {
      fetchData();
    }
  }, [isOpen, activeModal, activeTab, selectedDeviceId, streamType]);


  // --- useEffect to Fetch Districts ---
  // useEffect(() => {
  //   const fetchDistrictsForUser = async () => {
  //     // const userEmail = localStorage.getItem("email"); // Get email from storage

  //     if (!email) {
  //       setDistrictError("User email not found. Cannot load districts.");
  //       setIsDistrictLoading(false);
  //       setUserDistricts([]); // Ensure districts array is empty
  //       return;
  //     }

  //     setIsDistrictLoading(true);
  //     setDistrictError(null); // Reset error state

  //     try {
  //       const response = await getdistrictwiseAccess(email);
  //       // console.log('0000000000000000',response)
  //       console.log('API Response [getdistrictwiseAccess]:', response);
  //       if (response && response.success) {
  //         setUserDistricts(response.matchedDistricts || []);
  //       } else {

  //         setDistrictError(response?.message || "Failed to load districts.");
  //         setUserDistricts([]);
  //         toast({
  //           title: "Error Loading Districts",
  //           description: response?.message || "Could not fetch district list.",
  //           status: "error",
  //           duration: 5000,
  //           isClosable: true,
  //         });
  //       }
  //     } catch (error) {

  //       console.error("Error fetching user districts in component:", error);
  //       setDistrictError("An error occurred while fetching districts.");
  //       setUserDistricts([]);
  //       toast({
  //         title: "Network Error",
  //         description: "Could not connect to fetch district list.",
  //         status: "error",
  //         duration: 5000,
  //         isClosable: true,
  //       });
  //     } finally {
  //       setIsDistrictLoading(false);
  //     }
  //   };

  //   fetchDistrictsForUser();
  // }, [toast]);









  // Set AI Settings

  const handleVideoEncodeSave = async () => {
    try {
      if (streamType === "main") {
        await setVideoEncodeChannelMain(selectedDeviceId, codecType, resolution, bitRateType, bitRate, frameRate);
      } else {
        await setVideoEncodeChannelSub(selectedDeviceId, codecType, resolution, bitRateType, bitRate, frameRate);
      }
      fetchData();
      setSelectedDeviceId(null);
      closeModal();
      toast({
        title: "Video Settings Updated Successfully",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error updating camera:", error);
    }
  };

  const handleToggleSmart = async () => {
    try {
      const response = await setSmartQuality(selectedDeviceId, enablesmartQuality, dataPlan);
      // console.log("setSmartQuality", response);
      setSmartQualityActiveModal(null);
      toast({
        title: "Smart Quality Settings Updated Successfully",
        status: "success",
        duration: 3000,
      })
    } catch (error) {
      console.error("Error updating camera:", error);
    }
  }

  const handleWifiSettings = async () => {
    const payload = {
      wirelessMode: "stationMode",
      stationMode: {
        wirelessStaMode: "802.11bgn mixed",
        wirelessApBssId: "123456",
        wirelessApEssId: "Torque4",
        wirelessApPsk: "Raptor@101",
        wirelessFixedBpsModeEnabled: false,
      },
    };

    try {
      const res = await fetch("/netsdk/Network/Interface/4/Wireless", {
        method: "PUT",
        headers: {
          Authorization: "Basic YWRtaW46", // Base64 encoded credentials
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setWifiResponse(`Success: ${JSON.stringify(data)}`);
      } else {
        throw new Error(`Error: ${res.status}, ${JSON.stringify(data)}`);
      }
    } catch (error) {
      setWifiResponse(`Failed: ${error.message}`);
    }
  };

  const handleMediaSettings = async () => {
    try {
      const response = await setImageInfo(selectedDeviceId, irCutMode);
      const response2 = await setVideoSettings(
        selectedDeviceId,
        brightness,
        contrast,
        saturation,
        sharpness,
        hue,
        mirror,
        flip
      );
      // console.log("updateVideoSettings", response2);
      fetchData();
      setSelectedDeviceId(null);
      closeModal();
      toast({
        title: "Settings Updated Successfully",
        // description: "The video failed to load.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error updating camera:", error);
    }
  };

  // Reboot Settings
  const handleRebootCamera = async () => {
    try {
      const response = await rebootCamera(selectedDeviceId);
      // console.log("rebootCamera", response);
      setSelectedDeviceId(null);
      closeModal();
      toast({
        title: "Camera Rebooted Successfully",
        // description: "The video failed to load.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error updating camera:", error);
    }
  };
  const saveButtonBackgroundColor = useColorModeValue(
    theme.colors.custom.primary,
    theme.colors.custom.darkModePrimary
  );
  const saveButtonColor = useColorModeValue(
    theme.colors.custom.lightModeText,
    theme.colors.custom.darkModeText
  );
  const saveButtonHoverBackgroundColor = useColorModeValue(
    theme.colors.custom.darkModePrimary,
    theme.colors.custom.primary
  );
  const saveButtonHoverColor = useColorModeValue(
    theme.colors.custom.darkModeText,
    theme.colors.custom.lightModeText
  );

  const handleOpenModal = (modalType) => {
    setActiveModal(modalType);
    onOpen();
  };

  const handleApply = () => {
    // Update the main state based on temporary selection
    setGridView(tempView === "Grid View");
    onClose(); // Close the drawer
  };

  //
  useEffect(() => {
    // Fetch data when the component mounts

    setIsLoading(true);
    fetchAllCameras();
  }, [sortStatus, page, isGridView]);


  // --- Trigger Camera Fetch when filters change ---
  // useEffect(() => {
  //   // if (!selectedDistrictName) return;
  //   fetchAllCameras();
  // }, [selectedDistrictName, selectedAssemblyValue, page, itemsPerPage, sortStatus, search]);

  // src/components/Cameras.js

  // Fetching districts for the dropdown
  useEffect(() => {
    const fetchInitialDistricts = async () => {
      if (!userEmail) {
        setDistrictError("User email not available for fetching districts.");
        setLoadingDistricts(false);
        return;
      }
      setLoadingDistricts(true);
      setDistrictError(null);
      try {
        const response = await getdistrictwiseAccess(userEmail); // Call the ACTION
        console.log("COMPONENT: useEffect[userEmail] - Response from getdistrictwiseAccess:", JSON.stringify(response.matchedDistricts ? response.matchedDistricts.slice(0, 5) : response, null, 2));
        if (response?.success && Array.isArray(response.matchedDistricts)) {
          setUniqueDistricts(response.matchedDistricts); // Backend provides unique, sorted names
        } else {
          setDistrictError(response?.message || "Failed to load districts.");
          setUniqueDistricts([]);
        }
      } catch (err) {
        setDistrictError(err.message || "Error occurred while fetching districts.");
        setUniqueDistricts([]);
      } finally {
        setLoadingDistricts(false);
      }
    };
    fetchInitialDistricts();
  }, [userEmail]); // Depends on userEmail

  // Fetching cameras when filters or pagination change
  useEffect(() => {
    console.log("COMPONENT: useEffect[filters, page, etc.] - Triggering fetchAllCameras. Deps changed:", { selectedDistrictName, selectedAssemblyValue, page, itemsPerPage, search, sortStatus });
    fetchAllCameras();
  }, [selectedDistrictName, selectedAssemblyValue, page, itemsPerPage, search, sortStatus]);

  // Client-side processing of cameras received from backend (e.g., additional sorting IF NEEDED)
  useEffect(() => {
    let processedCameras = [...unfilteredCameras];

    // Location filter (client-side): narrow by selected District, then Assembly
    if (selectedDistrictName) {
      processedCameras = processedCameras.filter(
        (c) => c.dist_name === selectedDistrictName
      );
    }
    if (selectedAssemblyValue) {
      processedCameras = processedCameras.filter(
        (c) => c.accName === selectedAssemblyValue
      );
    }

    // If backend handles status filtering via 'sortStatus', this client-side sort might only be for ordering the current page.
    // If 'sortStatus' is purely a backend filter, this client-side sort could be removed.
    if (sortStatus && camerasTab === "My Cameras") {
      processedCameras.sort((a, b) => {
        if (sortStatus === 'online') {
          if (a.status === 'online' && b.status !== 'online') return -1;
          if (a.status !== 'online' && b.status === 'online') return 1;
        } else if (sortStatus === 'offline') {
          if (a.status === 'offline' && b.status !== 'offline') return -1;
          if (a.status !== 'offline' && b.status === 'offline') return 1;
        }
        return 0;
      });
    }
    setCameras(processedCameras);
  }, [unfilteredCameras, sortStatus, camerasTab, selectedDistrictName, selectedAssemblyValue]);


  // --- useEffect to Fetch Cameras when filters/pagination change ---
  useEffect(() => {
    console.log("COMPONENT: useEffect[filters, page, etc.] - Triggering fetchAllCameras. Deps changed:", { selectedDistrictName, selectedAssemblyValue, page, itemsPerPage, search, sortStatus });
    fetchAllCameras();
  }, [selectedDistrictName, selectedAssemblyValue, page, itemsPerPage, search, sortStatus]);

  const text = useColorModeValue('gray.500', 'gray.400');

  return (
    <Box
      maxW="1440px"
      w="100%"
      mx="auto"
      px={{ base: "12px", sm: "16px", md: "20px", lg: "24px" }}
      py={{ base: "12px", md: "16px" }}
      fontFamily="Manrope, sans-serif"
      mb={{ base: "20", md: "6" }}
    >
      {/* Mobile Header */}
      <MobileHeader title="Camera" />

      {/* ========================================================================= */}
      {/* 1. CAMERA HEADER & CONTROLS CONTAINER                                     */}
      {/* ========================================================================= */}
      <Flex
        justifyContent="space-between"
        alignItems="center"
        flexWrap="wrap"
        gap="12px"
        mb="4px"
      >
        {/* Title & View Switcher */}
        <HStack spacing={4} align="center">
          <Text
            fontFamily="Manrope, sans-serif"
            fontWeight="800"
            fontSize="22px"
            lineHeight="26.4px"
            letterSpacing="0px"
            color={titleColor}
          >
            Cameras
          </Text>
          <HStack
            h="34px"
            p="3px"
            bg={useColorModeValue("#F1F5F9", "#23262F")}
            border="1px solid"
            borderColor={cardBorder}
            borderRadius="9px"
            spacing="3px"
            ml={2}
          >
            <Tooltip label="Grid View" hasArrow placement="top">
              <Box
                as={RouterLink}
                to="/cameras"
                h="26px"
                px="8px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                borderRadius="6px"
                bg={
                  location.pathname.toLowerCase() === "/cameras"
                    ? cardBg
                    : "transparent"
                }
                boxShadow={
                  location.pathname.toLowerCase() === "/cameras"
                    ? "0 1px 3px rgba(0, 0, 0, 0.08)"
                    : "none"
                }
                color={
                  location.pathname.toLowerCase() === "/cameras"
                    ? "#3F77A5"
                    : "#64748B"
                }
                _hover={{
                  textDecoration: "none",
                  color:
                    location.pathname.toLowerCase() === "/cameras"
                      ? "#3F77A5"
                      : titleColor,
                }}
                transition="all 0.18s cubic-bezier(0.4, 0, 0.2, 1)"
              >
                <TbLayoutGrid size="17px" />
              </Box>
            </Tooltip>
            <Tooltip label="List View" hasArrow placement="top">
              <Box
                as={RouterLink}
                to="/listview"
                h="26px"
                px="8px"
                display="flex"
                alignItems="center"
                justifyContent="center"
                borderRadius="6px"
                bg={
                  location.pathname.toLowerCase() === "/listview"
                    ? cardBg
                    : "transparent"
                }
                boxShadow={
                  location.pathname.toLowerCase() === "/listview"
                    ? "0 1px 3px rgba(0, 0, 0, 0.08)"
                    : "none"
                }
                color={
                  location.pathname.toLowerCase() === "/listview"
                    ? "#3F77A5"
                    : "#64748B"
                }
                _hover={{
                  textDecoration: "none",
                  color:
                    location.pathname.toLowerCase() === "/listview"
                      ? "#3F77A5"
                      : titleColor,
                }}
                transition="all 0.18s cubic-bezier(0.4, 0, 0.2, 1)"
              >
                <TbList size="18px" />
              </Box>
            </Tooltip>
          </HStack>
        </HStack>

        {/* Right side controls */}
        <Flex alignItems="center" gap="10px" flexWrap="wrap">
          {/* Select Location Dropdown */}
          <Select
            value={selectedDistrictName}
            onChange={handleDistrictChange}
            placeholder={loadingDistricts ? "Loading..." : "Select Location"}
            isDisabled={loadingDistricts || !userEmail || !!districtError}
            w={{ base: "100%", sm: "140px" }}
            h="35px"
            borderRadius="7px"
            borderWidth="1px"
            borderColor={cardBorder}
            bg={cardBg}
            fontFamily="Manrope, sans-serif"
            fontSize="12px"
            fontWeight="400"
            lineHeight="100%"
            letterSpacing="0px"
            color={titleColor}
            _focus={{ borderColor: "#3F77A5" }}
          >
            {Array.isArray(uniqueDistricts) && uniqueDistricts.map((district) => (
              <option
                key={district.districtAssemblycode || district.dist_name}
                value={district.dist_name}
                style={{
                  fontFamily: "Manrope, sans-serif",
                  fontWeight: "400",
                  fontSize: "12px",
                }}
              >
                {district.dist_name}
              </option>
            ))}
          </Select>

          {/* Search Camera Input */}
          <InputGroup w={{ base: "100%", sm: "171px" }} h="34px">
            <InputLeftElement h="34px" pointerEvents="none" pl="8px">
              <MdSearch size="16px" color="#94A3B8" />
            </InputLeftElement>
            <Input
              placeholder="Search Cameras"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  fetchAllCameras(page, itemsPerPage, search);
                }
              }}
              h="34px"
              pl="30px"
              pr="10px"
              py="7px"
              borderRadius="7px"
              borderWidth="1px"
              borderColor={cardBorder}
              bg={cardBg}
              fontFamily="Manrope, sans-serif"
              fontSize="12px"
              fontWeight="400"
              lineHeight="100%"
              letterSpacing="0px"
              color={titleColor}
              _placeholder={{
                color: placeholderColor,
                fontFamily: "Manrope, sans-serif",
                fontSize: "12px",
              }}
              _focus={{
                borderColor: "#3F77A5",
                boxShadow: "0 0 0 1px #3F77A5",
              }}
            />
          </InputGroup>
        </Flex>
      </Flex>

      {/* ========================================================================= */}
      {/* 2. COUNT CONTAINER                                                        */}
      {/* ========================================================================= */}
      <Flex gap="16px" align="center" flexWrap="wrap" mt="6px" mb="4px">
        {/* Total Cameras */}
        <HStack spacing="5px">
          <Box w="7px" h="7px" borderRadius="3.5px" bg="#3F77A5" />
          <Text
            fontFamily="Manrope, sans-serif"
            fontWeight="500"
            fontSize="12px"
            lineHeight="18px"
            letterSpacing="0px"
            color="#64748B"
          >
            Total Cameras ({totalCount})
          </Text>
        </HStack>

        {/* Online */}
        <HStack
          spacing="5px"
          cursor="pointer"
          onClick={() => setSortStatus(sortStatus === "online" ? null : "online")}
          opacity={sortStatus && sortStatus !== "online" ? 0.5 : 1}
        >
          <Box w="7px" h="7px" borderRadius="3.5px" bg="#10B981" />
          <Text
            fontFamily="Manrope, sans-serif"
            fontWeight="500"
            fontSize="12px"
            lineHeight="18px"
            letterSpacing="0px"
            color="#64748B"
          >
            Online ({onlineCount})
          </Text>
        </HStack>

        {/* Offline */}
        <HStack
          spacing="5px"
          cursor="pointer"
          onClick={() => setSortStatus(sortStatus === "offline" ? null : "offline")}
          opacity={sortStatus && sortStatus !== "offline" ? 0.5 : 1}
        >
          <Box w="7px" h="7px" borderRadius="3.5px" bg="#EF4444" />
          <Text
            fontFamily="Manrope, sans-serif"
            fontWeight="500"
            fontSize="12px"
            lineHeight="18px"
            letterSpacing="0px"
            color="#64748B"
          >
            Offline ({offlineCount})
          </Text>
        </HStack>
      </Flex>

      {/* ========================================================================= */}
      {/* 3. CAMERA STREAM / CARDS CONTAINER                                        */}
      {/* ========================================================================= */}
      {isLoading ? (
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing="16px" pt="20px" w="100%">
          {[...Array(6)].map((_, index) => (
            <Box
              key={index}
              borderRadius="12px"
              borderWidth="1px"
              borderColor={cardBorder}
              bg={cardBg}
              overflow="hidden"
              boxShadow="0px 1px 5px 0px rgba(26, 46, 61, 0.07)"
            >
              <Skeleton height="156px" />
              <Box p="10px 14px">
                <SkeletonText noOfLines={1} spacing="2" />
              </Box>
            </Box>
          ))}
        </SimpleGrid>
      ) : cameras.length > 0 ? (
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing="16px" pt="20px" w="100%">
          {cameras.map((camera, id) => {
            const isOnline = camera.status === "online";

            return (
              <Box
                key={camera.deviceId || id}
                borderRadius="12px"
                borderWidth="1px"
                borderColor={cardBorder}
                bg={cardBg}
                boxShadow="0px 1px 5px 0px rgba(26, 46, 61, 0.07)"
                overflow="hidden"
                display="flex"
                flexDirection="column"
                transition="transform 0.15s ease, box-shadow 0.15s ease"
                _hover={{
                  boxShadow: "0px 4px 12px rgba(26, 46, 61, 0.12)",
                  transform: "translateY(-2px)",
                }}
              >
                {/* 1. Camera icon / preview container (h: 156px) */}
                <Box
                  h="156px"
                  w="100%"
                  position="relative"
                  cursor="pointer"
                  bg={imageContainerBg}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  onClick={() => handleCameraClick(camera.deviceId, camera.status)}
                  overflow="hidden"
                >
                  {camera.lastImage ? (
                    <Image
                      src={camera.lastImage}
                      fallbackSrc={cameraPlaceholderLogo}
                      alt="Camera Snapshot"
                      w="100%"
                      h="100%"
                      objectFit="cover"
                    />
                  ) : (
                    <Flex direction="column" align="center" justify="center" w="100%" h="100%">
                      <Image
                        src={cameraPlaceholderLogo}
                        alt="Camera Logo"
                        w="96px"
                        h="auto"
                        maxH="72px"
                        objectFit="contain"
                      />
                    </Flex>
                  )}

                  {/* Status Dot */}
                  <Box
                    position="absolute"
                    top="10px"
                    left="10px"
                    w="7px"
                    h="7px"
                    borderRadius="3.5px"
                    bg={isOnline ? "#10B981" : "#EF4444"}
                    boxShadow="0 0 0 2px white"
                    zIndex="2"
                  />

                  {/* Play Button */}
                  <IconButton
                    aria-label="Play Video"
                    icon={<IoPlayCircleOutline size="18px" />}
                    position="absolute"
                    bottom="8px"
                    right="8px"
                    w="28px"
                    h="28px"
                    minW="28px"
                    borderRadius="7px"
                    bg="#16222E8C"
                    _hover={{ bg: "#16222ECC" }}
                    color="white"
                    size="sm"
                    zIndex="2"
                  />
                </Box>

                {/* 2. Details Section */}
                <Box
                  p="10px 14px"
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  borderTop="1px solid"
                  borderColor={cardBorder}
                >
                  <Box flex="1" pr={2} overflow="hidden">
                    <Text
                      fontFamily="Manrope, sans-serif"
                      fontWeight="700"
                      fontSize="13px"
                      color={titleColor}
                      noOfLines={1}
                      title={`${camera.dist_name || ''}/${camera.deviceId || ''}/${camera.locations && camera.locations.length > 0 ? (typeof camera.locations[0] === 'string' ? camera.locations[0] : camera.locations[0].loc_name) : ''}`}
                    >
                      {camera.dist_name ? `${camera.dist_name}/` : ''}{camera.deviceId}/
                      {camera.locations && camera.locations.length > 0
                        ? (typeof camera.locations[0] === 'string'
                          ? camera.locations[0]
                          : (camera.locations[0] && camera.locations[0].loc_name)
                        )
                        : (camera.operatorName || 'N/A')}
                    </Text>
                  </Box>

                  {/* Menu */}
                  <Menu>
                    <MenuButton
                      as={IconButton}
                      aria-label="More options"
                      icon={<BsThreeDotsVertical />}
                      variant="unstyled"
                      size="sm"
                      minW="24px"
                      h="24px"
                      color="#64748B"
                      _hover={{ color: titleColor }}
                    />
                    <MenuList fontSize="12px" p="8px" borderRadius="10px" borderColor={cardBorder} bg={cardBg}>
                      <MenuItem
                        _hover={{ bg: "#3F77A515", color: "#3F77A5" }}
                        borderRadius="6px"
                        onClick={() =>
                          openSettingsModal(
                            "Camera Settings",
                            camera.deviceId,
                            camera.name,
                            camera.productType
                          )
                        }
                      >
                        Camera Setting
                      </MenuItem>
                      <MenuItem
                        _hover={{ bg: "#3F77A515", color: "#3F77A5" }}
                        borderRadius="6px"
                        onClick={() =>
                          openModal(
                            "Rename Device",
                            camera._id,
                            camera.name
                          )
                        }
                      >
                        Rename Device
                      </MenuItem>
                      <Divider my={1} borderColor={cardBorder} />
                      <MenuItem
                        _hover={{ bg: "red.50", color: "red.600" }}
                        borderRadius="6px"
                        color="red.500"
                        onClick={() => {
                          openRemoveCamera(
                            "removeUserCamera",
                            camera.deviceId
                          );
                        }}
                      >
                        Remove Camera
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </Box>
              </Box>
            );
          })}
        </SimpleGrid>
      ) : (
        <Box py={10}>
          <NoCameraFound
            title="No Cameras Found"
            description="It looks like you have not activated any cameras or no cameras match your filters."
          />
        </Box>
      )}

      {/* ========================================================================= */}
      {/* 4. PAGINATION CONTAINER                                                   */}
      {/* ========================================================================= */}
      <Flex
        minH="44px"
        pt="20px"
        justifyContent="center"
        alignItems="center"
        gap="12px"
        w="100%"
        fontFamily="Manrope, sans-serif"
      >
        {/* Previous Button */}
        <Button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          isDisabled={page === 1 || totalPages <= 1}
          h="32px"
          px="12px"
          gap="6px"
          borderRadius="8px"
          borderWidth="1px"
          borderColor={cardBorder}
          bg={cardBg}
          color="#3F77A5"
          fontFamily="Manrope, sans-serif"
          fontWeight="700"
          fontSize="12px"
          leftIcon={<MdChevronLeft size="18px" color="#3F77A5" />}
          _hover={{ bg: "#3F77A510", borderColor: "#3F77A5" }}
          _disabled={{ opacity: 0.45, cursor: "not-allowed" }}
        >
          Previous
        </Button>

        {/* Page Indicator (1 / n) */}
        <Text
          fontFamily="Manrope, sans-serif"
          fontWeight="600"
          fontSize="13px"
          lineHeight="19.5px"
          letterSpacing="0px"
          color="#64748B"
          px="4px"
        >
          {totalPages > 0 ? `${page} / ${totalPages}` : "1 / 1"}
        </Text>

        {/* Next Button */}
        <Button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          isDisabled={page === totalPages || totalPages <= 1}
          h="32px"
          px="12px"
          gap="6px"
          borderRadius="8px"
          borderWidth="1px"
          borderColor={cardBorder}
          bg={cardBg}
          color="#3F77A5"
          fontFamily="Manrope, sans-serif"
          fontWeight="700"
          fontSize="12px"
          rightIcon={<MdChevronRight size="18px" color="#3F77A5" />}
          _hover={{ bg: "#3F77A510", borderColor: "#3F77A5" }}
          _disabled={{ opacity: 0.45, cursor: "not-allowed" }}
        >
          Next
        </Button>
      </Flex>

      {/* Modal for Sharing Camera */}
      <Modal
        onClose={onClose}
        isOpen={isOpen && activeModal === "Share Camera"}
        isCentered
        size={"lg"}
      >
        <ModalOverlay />
        <ModalContent
          bg={useColorModeValue("white", theme.colors.custom.darkModeBg)}
          color={textColor}
        >
          <ModalHeader
            textAlign={"center"}
            p={1}
            mt={4}
            color={useColorModeValue(
              theme.colors.custom.lightModeText,
              theme.colors.custom.darkModeText
            )}
          >
            Share Camera
          </ModalHeader>
          <ModalBody pb={6} textAlign="center">
            <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              width="100%"
              //   padding="10px"
              p={1}
            >
              <FormControl width="350px" mt={5}>
                <FormLabel
                  htmlFor="device-name"
                  textAlign="start"
                  color={useColorModeValue(
                    theme.colors.custom.lightModeText,
                    theme.colors.custom.darkModeText
                  )}
                >
                  DeviceId:
                </FormLabel>
                <Input
                  id="device-name"
                  placeholder="Device Name"
                  borderColor="gray"
                  borderRadius="10px"
                  px={4}
                  _placeholder={{ color: "gray.400" }}
                  value={selectedDeviceId}
                  disabled
                  _focus={{
                    borderColor: theme.colors.custom.primary, // Custom purple border color on focus
                    boxShadow: `0 0 0 1px ${theme.colors.custom.primary}`, // Custom purple box shadow
                  }}
                />
              </FormControl>

              {/* Email of User */}
              <FormControl width="350px" mt={5}>
                <FormLabel
                  htmlFor="device-name"
                  textAlign="start"
                  color={useColorModeValue(
                    theme.colors.custom.lightModeText,
                    theme.colors.custom.darkModeText
                  )}
                >
                  Email Id:
                </FormLabel>
                <Input
                  id="device-name"
                  placeholder="Enter Email Id"
                  borderColor="gray"
                  borderRadius="10px"
                  px={4}
                  _placeholder={{ color: "gray.400" }}
                  type="email"
                  required
                  onChange={(e) => setShareEmail(e.target.value)}
                  _focus={{
                    borderColor: theme.colors.custom.primary, // Custom purple border color on focus
                    boxShadow: `0 0 0 1px ${theme.colors.custom.primary}`, // Custom purple box shadow
                  }}
                />
              </FormControl>
            </Box>
          </ModalBody>

          <ModalFooter marginRight={"10px"} justifyContent={"space-evenly"}>
            <Button
              onClick={closeModal}
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
              onClick={() => handleShareCamera()}
              w="150px"
              background={useColorModeValue(
                theme.colors.custom.primary,
                theme.colors.custom.darkModePrimary
              )}
              color={useColorModeValue(
                theme.colors.custom.lightModeText,
                theme.colors.custom.darkModeText
              )}
              fontWeight={"normal"}
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
            >
              Share Camera
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal for Managing Sharing Access */}
      <Modal
        onClose={onClose}
        isOpen={isOpen && activeModal === "Share Access"}
        isCentered
        size={"lg"}
      >
        <ModalOverlay />
        <ModalContent
          bg={useColorModeValue("white", theme.colors.custom.darkModeBg)}
        >
          <ModalHeader textAlign={"center"} p={1} mt={4}>
            View Shared Access
          </ModalHeader>
          <ModalBody textAlign="center">
            {/* <Box
              display="flex"
              flexDirection="column"
              alignItems="center"
              justifyContent="center"
              width="100%"
              //   padding="10px"
              p={1}
            > */}
            {/* <Flex alignItems="center" justifyContent="space-between" mb={4}> */}
            ,
            {sharedEmails.length === 0 ? (
              <Text>Seems you've not shared cameras yet...</Text>
            ) : (
              sharedEmails.map((email, index) => (
                <Flex
                  key={index}
                  alignItems="center"
                  justifyContent="space-between"
                  mb={4}
                >
                  <Text>{email}</Text>
                  <Button
                    color="red.500"
                    variant={"outline"}
                    onClick={() => {
                      openRemoveAdminShareModal(
                        "removeSharedAccess",
                        selectedDeviceId,
                        email
                      );
                    }}
                  >
                    Remove
                  </Button>
                </Flex>
              ))
            )}
            {/* <Text>Camera model</Text>
              <Text>Remove</Text> */}
            {/* </Flex> */}
            {/* </Box> */}
          </ModalBody>
          <Divider />
          <ModalFooter marginRight={"10px"} justifyContent={"space-evenly"}>
            <Button
              onClick={closeModal}
              w="150px"
              border="1px"
              background="0"
              color="red.500"
              borderColor="red.500"
              _hover={{ background: "none" }}
            >
              Cancel
            </Button>

            {/* <Button
              w="150px"
              background={useColorModeValue(
                theme.colors.custom.primary,
                theme.colors.custom.darkModePrimary
              )}
              color={useColorModeValue(
                theme.colors.custom.lightModeText,
                theme.colors.custom.darkModeText
              )}
              fontWeight={"normal"}
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
            >
              Save Camera
            </Button> */}
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal for Rename Device */}
      <Modal
        onClose={onClose}
        isOpen={isOpen && activeModal === "Rename Device"}
        isCentered
        size={"lg"}
      >
        <ModalOverlay />
        <ModalContent
          bg={useColorModeValue("white", theme.colors.custom.darkModeBg)}
          color={textColor}
        >
          <ModalHeader
            textAlign={"center"}
            p={1}
            mt={4}
            color={useColorModeValue(
              theme.colors.custom.lightModeText,
              theme.colors.custom.darkModeText
            )}
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
              //   padding="10px"
              p={1}
            >
              <FormControl width="350px" mt={5}>
                <FormLabel
                  htmlFor="device-name"
                  textAlign="start"
                  color={useColorModeValue(
                    theme.colors.custom.lightModeText,
                    theme.colors.custom.darkModeText
                  )}
                >
                  Enter Device Name:
                </FormLabel>
                <Input
                  id="device-name"
                  placeholder="Device Name"
                  borderColor="gray"
                  borderRadius="10px"
                  px={4}
                  _placeholder={{ color: "gray.400" }}
                  value={selectedCameraName}
                  onChange={(e) => setSelectedCameraName(e.target.value)}
                  _focus={{
                    borderColor: theme.colors.custom.primary, // Custom purple border color on focus
                    boxShadow: `0 0 0 1px ${theme.colors.custom.primary}`, // Custom purple box shadow
                  }}
                />
              </FormControl>
            </Box>
          </ModalBody>

          <ModalFooter marginRight={"10px"} justifyContent={"space-evenly"}>
            <Button
              onClick={closeModal}
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
              onClick={() => handleUpdateCameraName(selectedCameraName)}
              w="150px"
              background={useColorModeValue(
                theme.colors.custom.primary,
                theme.colors.custom.darkModePrimary
              )}
              color={useColorModeValue(
                theme.colors.custom.lightModeText,
                theme.colors.custom.darkModeText
              )}
              fontWeight={"normal"}
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
            >
              Save Device
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Modal for Camera Settings */}
      <Modal
        onClose={closeModal}
        isOpen={isOpen && activeModal === "Camera Settings"}
        isCentered
        size={"3xl"}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Camera Settings</ModalHeader>

          {/* Modal Body */}
          <ModalBody>
            {/* Tabs */}
            <Tabs
              variant="unstyled"
              mb={6}
              onChange={(index) =>
                setActiveTab(
                  [
                    "Video settings",
                    "Media",
                    "Wifi Settings",
                    "System",
                  ][index]
                )
              }
            >
              <TabList>
                <Tab
                  _selected={{
                    fontWeight: "bold",
                    borderBottom: "4px solid",
                    borderColor: useColorModeValue(
                      theme.colors.custom.primary,
                      theme.colors.custom.darkModeText
                    ),
                  }}
                >
                  Video settings
                </Tab>
                <Tab
                  _selected={{
                    fontWeight: "bold",
                    borderBottom: "4px solid",
                    borderColor: useColorModeValue(
                      theme.colors.custom.primary,
                      theme.colors.custom.darkModeText
                    ),
                  }}
                >
                  Image settings
                </Tab>
                {selectedCameraType === "Wifi-S-Series" && (
                  <Tab
                    _selected={{
                      fontWeight: "bold",
                      borderBottom: "4px solid",
                      borderColor: saveButtonBackgroundColor,
                    }}
                  >
                    Wifi Settings
                  </Tab>
                )}
              </TabList>
            </Tabs>

            {/* Conditional Content Based on Active Tab */}
            {activeTab === "Video settings" && (
              <Box>
                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text>Device Name</Text>
                  <Input
                    disabled
                    defaultValue={selectedDeviceId}
                    size="sm"
                    maxW="60%"
                  />
                </Flex>

                <Grid templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)" }} gap={4} mb={4}>
                  <FormControl>
                    <FormLabel>Stream Type</FormLabel>
                    <Select value={streamType} onChange={(e) => setStreamType(e.target.value)} size="sm">
                      <option value="main">Main Stream</option>
                      <option value="sub">Sub Stream</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Bit Rate</FormLabel>
                    <Input value={bitRate} onChange={(e) => setBitRate(e.target.value)} placeholder="Bit Rate" size="sm" />
                  </FormControl>
                  <FormControl>
                    <FormLabel>FPS</FormLabel>
                    <Input value={frameRate} onChange={(e) => setFrameRate(e.target.value)} placeholder="FPS" size="sm" />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Profile</FormLabel>
                    <Select value={codecType} onChange={(e) => setCodecType(e.target.value)} placeholder="Codec Type" size="sm">
                      <option value="H.264">H.264</option>
                      <option value="H.265">H.265</option>
                      <option value="H.264+">H.264+</option>
                      <option value="H.265+">H.265+</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Bit Rate Type</FormLabel>
                    <Select value={bitRateType} onChange={(e) => setBitRateType(e.target.value)} placeholder="Select type" size="sm">
                      <option>CBR</option>
                      <option>VBR</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Resolution</FormLabel>
                    <Select value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Select resolution" size="sm">
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

                <Divider mb={2} />

                <Flex w="full" justifyContent="flex-end">
                  <Button
                    variant="outline"
                    size="sm"
                    mr={2}
                    onClick={closeModal}
                  >
                    Close
                  </Button>
                  <Button
                    size="sm"
                    background={saveButtonBackgroundColor}
                    color={saveButtonColor}
                    fontWeight={"normal"}
                    _hover={{
                      backgroundColor: saveButtonHoverBackgroundColor,
                      color: saveButtonHoverColor,
                    }}
                    onClick={() => handleVideoEncodeSave()}
                  >
                    Save
                  </Button>
                </Flex>
              </Box>
            )}

            {/* Media Tab Content */}
            {activeTab === "Media" && (
              <Box>
                {/* <Text mb={4} fontWeight="bold">Media Settings</Text> */}

                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text>IR Mode</Text>
                  <Select
                    value={irCutMode}
                    onChange={(e) => setIrCutMode(e.target.value)}
                    size="sm"
                    maxW="60%"
                  >
                    <option value="auto">IrLedMode</option>
                    <option value="light">Light Mode</option>
                    <option value="smart">Smart Mode</option>
                    <option value="daylight">Daylight Mode</option>
                    <option value="night">Night Mode</option>
                  </Select>
                  {/* <IconButton aria-label="Info" icon={<InfoIcon />} size="xs" variant="ghost" /> */}
                </Flex>

                {/* Brightness Slider */}
                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text flex="1">Brightness</Text>
                  <Box flex="1" mx={4}>
                    <Slider
                      value={brightness}
                      onChange={(val) => setBrightness(val)}
                      min={0}
                      max={100}
                      step={1}
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <SliderThumb />
                    </Slider>
                  </Box>
                  <Text>{brightness}%</Text>
                </Flex>

                {/* Contrast Slider */}
                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text flex="1">Contrast</Text>
                  <Box flex="1" mx={4}>
                    <Slider
                      value={contrast}
                      onChange={(val) => setContrast(val)}
                      min={0}
                      max={100}
                      step={1}
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <SliderThumb />
                    </Slider>
                  </Box>
                  <Text>{contrast}%</Text>
                </Flex>

                {/* Saturation Slider */}
                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text flex="1">Saturation</Text>
                  <Box flex="1" mx={4}>
                    <Slider
                      value={saturation}
                      onChange={(val) => setSaturation(val)}
                      min={0}
                      max={100}
                      step={1}
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <SliderThumb />
                    </Slider>
                  </Box>
                  <Text>{saturation}%</Text>
                </Flex>

                {/* Hue Slider */}
                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text flex="1">Hue</Text>
                  <Box flex="1" mx={4}>
                    <Slider
                      value={hue}
                      onChange={(val) => setHue(val)}
                      min={0}
                      max={100}
                      step={1}
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <SliderThumb />
                    </Slider>
                  </Box>
                  <Text>{hue}%</Text>
                </Flex>

                {/* Sharpness Slider */}
                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text flex="1">Sharpness</Text>
                  <Box flex="1" mx={4}>
                    <Slider
                      value={sharpness}
                      onChange={(val) => setSharpness(val)}
                      min={0}
                      max={100}
                      step={1}
                    >
                      <SliderTrack>
                        <SliderFilledTrack />
                      </SliderTrack>
                      <SliderThumb />
                    </Slider>
                  </Box>
                  <Text>{sharpness}%</Text>
                </Flex>

                {/* Flip Check box */}
                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text flex="1">Flip</Text>
                  <Switch
                    size="sm"
                    isChecked={flip}
                    onChange={() => setFlip(!flip)}
                  />
                </Flex>

                {/* Mirror Check box */}
                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text flex="1">Mirror</Text>
                  <Switch
                    size="sm"
                    isChecked={mirror}
                    onChange={() => setMirror(!mirror)}
                  />
                </Flex>

                {/* <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text>Media Quality</Text>
                  <Input placeholder="Enter media quality" size="sm" maxW="60%" />
                </Flex> */}

                <Divider mb={2} />

                <Flex w="full" justifyContent="space-between">
                  <Button
                    p={0}
                    colorScheme="red"
                    variant="ghost"
                    textDecoration={"underline"}
                    size="sm"
                    onClick={() => handleRebootCamera()}
                  >
                    Reboot Camera
                  </Button>
                  <IconButton
                    colorScheme="red"
                    aria-label="Info"
                    icon={<InfoIcon />}
                    size="sm"
                    variant="ghost"
                  />
                  <Spacer />
                  <Button
                    variant="outline"
                    size="sm"
                    mr={2}
                    onClick={closeModal}
                  >
                    Close
                  </Button>
                  <Button
                    size="sm"
                    background={saveButtonBackgroundColor}
                    color={saveButtonColor}
                    fontWeight={"normal"}
                    _hover={{
                      backgroundColor: saveButtonHoverBackgroundColor,
                      color: saveButtonHoverColor,
                    }}
                    onClick={() => handleMediaSettings()}
                  >
                    Save
                  </Button>
                </Flex>
              </Box>
            )}

            {activeTab === "Wifi Settings" && (
              <>
                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text>Wifi Name</Text>
                  <Input
                    value={wifiName}
                    onChange={(event) => setWifiName(event.target.value)}
                    size="sm"
                    maxW="60%"
                  />
                </Flex>

                <Flex alignItems="center" justifyContent="space-between" mb={4}>
                  <Text>Password</Text>
                  <Input
                    value={wifiPassword}
                    onChange={(event) => setWifiPassword(event.target.value)}
                    size="sm"
                    maxW="60%"
                  />
                </Flex>

                <Divider mb={2} />

                <Flex w="full" justifyContent="space-between">
                  {/* <Button colorScheme="red" variant="outline" size="sm">
                Set to Default
              </Button> */}
                  <Button
                    p={0}
                    colorScheme="red"
                    variant="ghost"
                    textDecoration={"underline"}
                    size="sm"
                    onClick={() => handleRebootCamera()}
                  >
                    Reboot Camera
                  </Button>
                  <IconButton
                    colorScheme="red"
                    aria-label="Info"
                    icon={<InfoIcon />}
                    size="sm"
                    variant="ghost"
                  />
                  <Spacer />
                  <Button
                    variant="outline"
                    size="sm"
                    mr={2}
                    onClick={closeModal}
                  >
                    Close
                  </Button>
                  <Button
                    size="sm"
                    background={saveButtonBackgroundColor}
                    color={saveButtonColor}
                    fontWeight={"normal"}
                    _hover={{
                      backgroundColor: saveButtonHoverBackgroundColor,
                      color: saveButtonHoverColor,
                    }}
                    onClick={() => handleWifiSettings()}
                  >
                    Save
                  </Button>
                </Flex>
              </>
            )}

            {/* Add other tab contents here if needed */}
          </ModalBody>

          {/* Modal Footer */}
          {/* <ModalFooter>
            <Flex w="full" justifyContent="space-between">
              <Button colorScheme="red" variant="ghost" textDecoration={'underline'} size="sm">
                Reboot Camera
              </Button>
              <IconButton colorScheme="red" aria-label="Info" icon={<InfoIcon />} size="sm" variant="ghost" />
              <Spacer />
              <Button variant="outline" size="sm" mr={2} onClick={closeModal}>
                Close
              </Button>
              <Button
                size="sm"
                background={useColorModeValue(
                  theme.colors.custom.primary,
                  theme.colors.custom.darkModePrimary
                )}
                color={useColorModeValue(
                  theme.colors.custom.lightModeText,
                  theme.colors.custom.darkModeText
                )}
                fontWeight={"normal"}
                _hover={{
                  backgroundColor: useColorModeValue(
                    theme.colors.custom.darkModePrimary,
                    theme.colors.custom.primary
                  ),
                  color: useColorModeValue(
                    theme.colors.custom.darkModeText,
                    theme.colors.custom.lightModeText
                  ),
                }}>
                Save
              </Button>
            </Flex>
          </ModalFooter> */}
        </ModalContent>
      </Modal>

      {/* removeSharedAccess Modal */}
      <Modal
        isOpen={isOpen && activeModal === "removeSharedAccess"}
        onClose={onClose}
        isCentered
      >
        <ModalOverlay />
        <ModalContent
          p={3} // Add padding to the modal content
          borderRadius="8px" // Add border radius for rounded corners
          boxShadow="lg" // Add shadow for a floating effect
          // maxW="400px" // Limit width for better responsiveness
          bg={useColorModeValue("white", "gray.800")}
          color={textColor}
        >
          <ModalHeader
            textAlign="center"
            fontSize="xl"
            fontWeight="bold"
            color={useColorModeValue("black", "white")}
          >
            Are you sure?
          </ModalHeader>
          <ModalBody>
            <Flex direction="column" align="center" justify="center">
              <Icon as={CiCircleRemove} color="red.500" boxSize="50px" mb={4} />
              <Text
                textAlign="center"
                color={useColorModeValue("gray.800", "gray.200")}
                fontSize="md"
              >
                Remove access from this camera.
              </Text>
            </Flex>
          </ModalBody>
          <ModalFooter justifyContent="center" gap={4}>
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
              onClick={handleRemoveSharedCamera}
              borderRadius="6px"
            >
              Remove Access
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* remove user camera Modal */}
      <Modal
        isOpen={isOpen && activeModal === "removeUserCamera"}
        onClose={onClose}
        isCentered
      >
        <ModalOverlay />
        <ModalContent
          p={3} // Add padding to the modal content
          borderRadius="8px" // Add border radius for rounded corners
          boxShadow="lg" // Add shadow for a floating effect
          // maxW="400px" // Limit width for better responsiveness
          bg={useColorModeValue("white", "gray.800")}
          color={textColor}
        >
          <ModalHeader
            textAlign="center"
            fontSize="xl"
            fontWeight="bold"
            color={useColorModeValue("black", "white")}
          >
            Are you sure?
          </ModalHeader>
          <ModalBody>
            <Flex direction="column" align="center" justify="center">
              <Icon as={CiCircleRemove} color="red.500" boxSize="50px" mb={4} />
              <Text
                textAlign="center"
                color={useColorModeValue("gray.800", "gray.200")}
                fontSize="md"
              >
                Remove access of this camera.
              </Text>
            </Flex>
          </ModalBody>
          <ModalFooter justifyContent="center" gap={4}>
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
              onClick={handleRemoveCamera}
              borderRadius="6px"
            >
              Remove Camera
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Smart Quality Camera Modal */}
      <Modal
        isOpen={isOpen && smartQualityActiveModal === "Smart Quality"}
        onClose={onClose}
        isCentered
      >
        <ModalOverlay />
        <ModalContent
          p={3} // Add padding to the modal content
          borderRadius="8px" // Add border radius for rounded corners
          boxShadow="lg" // Add shadow for a floating effect
          // maxW="400px" // Limit width for better responsiveness
          bg={useColorModeValue("white", "gray.800")}
          color={textColor}
        >
          <ModalHeader
            textAlign="center"
            fontSize="xl"
            fontWeight="bold"
            color={useColorModeValue("black", "white")}
          >
            Enter your SIM's daily limit in GB?
          </ModalHeader>
          <ModalBody>
            <Flex direction="column" align="center" justify="center">
              <Input
                placeholder="Dataplan"
                // disabled={enablesmartQuality}
                value={dataPlan || ""} // Controlled component value
                onChange={(e) => setdataPlan(e.target.value)} // Update state on change
                size="md"
                maxWidth="full" // Optional: Restrict input width
              />
            </Flex>
          </ModalBody>
          <ModalFooter justifyContent="center" gap={4}>
            <Button
              onClick={() => setSmartQualityActiveModal(null)}
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
              // onClick={handleRemoveSharedCamera}
              onClick={() => handleToggleSmart()}
              borderRadius="6px"
            >
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* slide up modal for mobile view */}
      <Drawer
        isOpen={isOpen && activeModal === "filterOptions"}
        placement="bottom"
        onClose={onClose}
      >
        <DrawerOverlay />
        <DrawerContent borderTopRadius="md">
          <DrawerHeader textAlign="center" fontSize="lg">
            View By
          </DrawerHeader>
          <DrawerBody>
            <RadioGroup
              onChange={setTempView} // Update temporary state on selection
              value={tempView} // Use temporary state to show the selection
            >
              <VStack align="start" spacing={4}>
                <Radio value="Grid View">Grid View</Radio>
                <Radio value="List View">List View</Radio>
              </VStack>
            </RadioGroup>
          </DrawerBody>
          <DrawerFooter justifyContent="center">
            <Button bg={bgColor} width="50%" onClick={handleApply}>
              Apply
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </Box>
  );
};

export default Cameras;
