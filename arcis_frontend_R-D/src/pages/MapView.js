import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  Box,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Text,
  Badge,
  Spinner,
  Center,
  useToast,
  Heading,
  HStack,
  Flex,
  Select,
  Grid,
  useColorModeValue, Link as ChakraLink,
  Image,
  useColorMode,
  RadioGroup,
  Radio,
  Input


} from "@chakra-ui/react";
import { GoogleMap, useJsApiLoader, MarkerF } from "@react-google-maps/api";
import axios from "axios";
import Player from "../components/Player";

import { Link as RouterLink, useLocation } from "react-router-dom";
// Add these to your existing imports at the top
import { IconButton } from "@chakra-ui/react"; // Ensure IconButton is here
import { BsVolumeMute, BsVolumeUp, BsArrowsFullscreen } from "react-icons/bs";

// ⚠️ WARNING: Delete this key before deploying to production!
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_KEY;

const containerStyle = {
  width: "100%",
  height: "100%",
};


// --- Helper Functions ---
const generateStreamUrl = (camera) => {
  if (camera.plan === "LIVE" && camera.p2purl && camera.token) {
    return `https://${camera.deviceId}.${camera.p2purl}/flv/live_ch0_0.flv?verify=${camera.token}`;
  }
  if (camera.mediaUrl) {
    return `wss://${camera.mediaUrl}/jessica/DVR/${camera.deviceId}.flv`;
  }
  return "";
};

const isCameraOnline = (camera) => {
  if (!camera || !camera.status) return false;
  if (typeof camera.status === 'string' && camera.status.toUpperCase() === 'ONLINE') return true;
  if (camera.status === true) return true;
  return false;
};

// Helper to safely extract location name
const getLocationName = (camera) => {
  if (camera.location) return camera.location;
  if (camera.locations && camera.locations.length > 0) {
    return typeof camera.locations[0] === 'string'
      ? camera.locations[0]
      : (camera.locations[0]?.loc_name || "");
  }
  return camera.loc_name || "";
};

// --- Main Component ---
const GpsTrackingMap = () => {
  // Data States
  const [allCameras, setAllCameras] = useState([]);
  const [filteredCameras, setFilteredCameras] = useState([]);

  // Selection States
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [streamUrl, setStreamUrl] = useState("");

  // Filter States
  const [districtsList, setDistrictsList] = useState([]);
  const [selectedDistrictName, setSelectedDistrictName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [assembliesList, setAssembliesList] = useState([]);
  const [selectedAssemblyValue, setSelectedAssemblyValue] = useState("");
  const [psOption, setPsOption] = useState("camera");
  const placeholderColor = useColorModeValue("gray.600", "gray.400");
  const [searchDeviceId, setSearchDeviceId] = useState("");
  const textColor = useColorModeValue("black", "white");

  // Locations List State
  const [locationsList, setLocationsList] = useState([]);
  const [searchLocation, setSearchLocation] = useState("");
  const [isVehicleLoading, setIsVehicleLoading] = useState(false);

  const [map, setMap] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const text = useColorModeValue('gray.500', 'gray.400');

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY
  });

  const DEFAULT_CENTER = { lat: 23.5937, lng: 87.8550 };
const DEFAULT_ZOOM = 9;

  // --- THEME HOOKS ---
  const headerBg = useColorModeValue("white", "gray.900");
  const buttonGradientColor = useColorModeValue(
    "linear-gradient(93.5deg,#CDDEEB ,  #9CBAD2 94.58%)",
    "linear-gradient(93.5deg, #2A2A2A 0.56%, #030711 50.58%)"
  );
  const location = useLocation(); // To determine current view (grid/list)

  // Use Chakra's useColorMode hook to get current mode for dynamic icon src
  const { colorMode } = useColorMode();
  const [isMuted, setIsMuted] = useState(true);
  const [isFs, setIsFs] = useState(false);
  const containerRef = useRef(null);
  const mapBoxRef = useRef(null);

  // Sync the state if the user exits via the Escape key
  useEffect(() => {
    const handleFsChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

 const toggleMapFullscreen = () => {
  if (!document.fullscreenElement) {
    mapBoxRef.current?.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
};
  // ... other logic ...

  const handleCloseModal = () => {
    setSelectedCamera(null);
    setStreamUrl("");
    setIsMuted(true); // 2. Reset mute status when closing
    onClose();
  };

  // 1. FETCH ALL CAMERAS (Initial Data)
  useEffect(() => {
    const fetchCameras = async () => {
      const userEmail = localStorage.getItem("email");
      if (!userEmail) return;

      try {
        const response = await axios.post(`${process.env.REACT_APP_URL}/api/camera/getCurrentUserCameras`, {
          email: userEmail
        });

        const data = Array.isArray(response.data) ? response.data : [];
        setAllCameras(data);
      } catch (error) {
        console.error("Error fetching cameras:", error);
      }
    };

    fetchCameras();
    const interval = setInterval(fetchCameras, 30000);
    return () => clearInterval(interval);
  }, []);

  // 2. EXTRACT DISTRICTS
  useEffect(() => {
    const districts = [...new Set(allCameras.map((c) => c.dist_name || c.district).filter(Boolean))];
    setDistrictsList(districts.sort());
  }, [allCameras]);

  // 3. UPDATE ASSEMBLIES ON DISTRICT CHANGE
  useEffect(() => {
    if (selectedDistrictName) {
      const cams = allCameras.filter(
        (c) => (c.dist_name || c.district) === selectedDistrictName
      );
      const assemblies = [
        ...new Set(cams.map((c) => c.accName || c.assembly).filter(Boolean)),
      ];
      setAssembliesList(assemblies.sort());
    } else {
      setAssembliesList([]);
    }
  }, [selectedDistrictName, allCameras]);

  // 4. FETCH VEHICLES BY ASSEMBLY (STRICT HIERARCHY ENFORCED)
  useEffect(() => {
    const fetchVehiclesFromApi = async () => {
      // STRICT CHECK: If no assembly is selected, Clear vehicles and return.
      if (!selectedAssemblyValue) {
        setLocationsList([]);
        return;
      }

      setIsVehicleLoading(true);

      // Find the 'districtAssemblyCode'
      const sampleCamera = allCameras.find(
        (c) => (c.accName || c.assembly) === selectedAssemblyValue
      );

      const districtAssemblyCode = sampleCamera?.districtAssemblyCode;

      if (districtAssemblyCode) {
        try {
          const response = await axios.post(`${process.env.REACT_APP_URL}/api/gps/getVehiclesByAssembly`, {
            districtAssemblyCode: districtAssemblyCode
          });

          if (response.data.success && Array.isArray(response.data.vehicles)) {
            const vehicles = response.data.vehicles.map(v => v.vehicleNo);
            setLocationsList(vehicles);
          } else {
            setLocationsList([]);
          }
        } catch (error) {
          console.error("Error fetching vehicles by assembly:", error);
          toast({
            title: "Error fetching vehicles",
            description: error.message,
            status: "error",
            duration: 3000
          });
          setLocationsList([]);
        }
      } else {
        // Fallback if code is missing but assembly name exists (rare edge case)
        setLocationsList([]);
      }
      setIsVehicleLoading(false);
    };

    fetchVehiclesFromApi();
  }, [selectedAssemblyValue, allCameras, toast]);

  // 5. MAIN FILTER LOGIC FOR MAP
  useEffect(() => {
    let data = [...allCameras];

    if (selectedDistrictName) {
      data = data.filter((c) => (c.dist_name || c.district) === selectedDistrictName);
    }
    if (selectedAssemblyValue) {
      data = data.filter((c) => (c.accName || c.assembly) === selectedAssemblyValue);
    }
    if (searchLocation) {
      const lowerSearch = searchLocation.toLowerCase();
      data = data.filter((c) => {
        const locName = getLocationName(c);
        return String(locName).toLowerCase().includes(lowerSearch);
      });
    }

    if (searchDeviceId) {
      const term = searchDeviceId.toLowerCase();
      if (psOption === "ps") {
        // Search by Vehicle Number
        data = data.filter((c) => {
          const locName = getLocationName(c);
          return String(locName).toLowerCase().includes(term);
        });
      } else {
        // Search by Camera ID
        data = data.filter((c) =>
          String(c.deviceId || "").toLowerCase().includes(term)
        );
      }
    }

    setFilteredCameras(data);
  }, [allCameras, selectedDistrictName, selectedAssemblyValue, searchLocation,searchDeviceId, psOption]);

 // SMART ZOOM: Default view on load, Fit bounds on filter
useEffect(() => {
  if (isLoaded && map) {
    // Check if any filter is currently active
    const isFilterActive = !!(selectedDistrictName || selectedAssemblyValue || searchLocation || searchDeviceId);

    if (isFilterActive && filteredCameras.length > 0) {
      // 1. A filter is active: Zoom into the vehicles
      const bounds = new window.google.maps.LatLngBounds();
      let hasValidCoords = false;

      filteredCameras.forEach((camera) => {
        const lat = parseFloat(camera.latitude);
        const lng = parseFloat(camera.longitude);
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          bounds.extend({ lat, lng });
          hasValidCoords = true;
        }
      });

      if (hasValidCoords) {
        map.fitBounds(bounds);

        // Optional: If only 1 vehicle is found, fitBounds zooms in too much.
        // This keeps it at a readable level (e.g., 14)
        if (filteredCameras.length === 1) {
          const listener = window.google.maps.event.addListener(map, "idle", () => {
            if (map.getZoom() > 15) map.setZoom(14); 
            window.google.maps.event.removeListener(listener);
          });
        }
      }
    } else {
      // 2. No filter active (Initial Load) OR no vehicles found:
      // Force zoom on your specific default coordinates
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(DEFAULT_ZOOM);
    }
  }
}, [filteredCameras, isLoaded, map, selectedDistrictName, selectedAssemblyValue, searchLocation, searchDeviceId]);

  // HANDLERS
  const handleDistrictChange = (e) => {
    setSelectedDistrictName(e.target.value);

    // STRICT HIERARCHY RESET
    setSelectedAssemblyValue(""); // Reset Assembly
    setSearchLocation("");        // Reset Vehicle Selection
    setLocationsList([]);         // Clear Vehicle Options
  };

  const handleAssemblyChange = (e) => {
    setSelectedAssemblyValue(e.target.value);
    setSearchLocation("");        // Reset Vehicle Selection when assembly changes
    // locationsList will update via useEffect
  };

  const handleSearchDeviceIdChange = (event) => {
    setSearchDeviceId(event.target.value);
    setCurrentPage(1);
  };

  const onLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  const handleMarkerClick = (camera) => {
    const isOnline = isCameraOnline(camera);

    const district =
      camera.dist_name || camera.district || "Unknown District";
    const assembly =
      camera.accName || camera.assembly || "Unknown Assembly";
    const location =
      getLocationName(camera) ||
      camera.vehicleNo ||
      camera.deviceId ||
      "Unknown Location";

    if (!isOnline) {
      toast({
        title: "Vehicle Offline",
        description: `${district} / ${assembly} / ${location} is offline`,
        status: "error",
        duration: 3000,
        isClosable: true,
        position: "top",
      });
      return;
    }

    const url = generateStreamUrl(camera);
    if (!url) {
      toast({
        title: "Error",
        description: "Stream URL not available.",
        status: "warning",
      });
      return;
    }

    setSelectedCamera(camera);
    setStreamUrl(url);
    onOpen();
  };



  const getMarkerIcon = (isOnline) => {
    if (!window.google || !window.google.maps) return undefined;

    const color = isOnline ? "#00E676" : "#FF1744";

    return {
      path: "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z",
      fillColor: color,
      fillOpacity: 1,
      strokeWeight: 1.5,
      strokeColor: "white",
      scale: 2,
      anchor: new window.google.maps.Point(12, 22),
    };
  };

  const total = filteredCameras.length;
  const onlineCount = filteredCameras.filter((c) => isCameraOnline(c)).length;
  const offlineCount = total - onlineCount;

  if (loadError) return <Center h="100vh">Error loading maps</Center>;
  if (!isLoaded) return <Center h="100vh"><Spinner size="xl" /></Center>;

  return (
    <Flex direction="column" h="100vh">
      {/* --- HEADER --- */}
      <Box
        mb={2}
        zIndex="10"
      >
        <Flex justify="space-between" align="center">
          <Text fontWeight={400} fontSize="26px" mb={0} color={text}>
            Map View
          </Text>
          <HStack
            border="1px solid #868686"
            borderRadius="12px"
            spacing={0}
            overflow="hidden"
            height="42px"
            width="fit-content"
            bg="white"
          >
            {/* Historical View */}
            <Box
              as={RouterLink}
              to="/RouteView"
              height="100%"
              display="flex"
              alignItems="center"
              justifyContent="center"
              px={6}
              fontSize="14px"
              fontWeight="700"
              whiteSpace="nowrap"
              bg={location.pathname === "/RouteView"
                ? "linear-gradient(180deg, #d4e3ef 0%, #a3bbd1 100%)"
                : "transparent"
              }
              color="#171c26"
              borderRight="1px solid #868686"
              _hover={{ textDecoration: "none" }}
            >
              Historical View
            </Box>

            {/* Map View */}
            <Box
              as={RouterLink}
              to="/Mapview"
              height="100%"
              display="flex"
              alignItems="center"
              justifyContent="center"
              px={6}
              fontSize="14px"
              fontWeight="700"
              whiteSpace="nowrap"
              bg={location.pathname === "/Mapview"
                ? "linear-gradient(180deg, #d4e3ef 0%, #a3bbd1 100%)"
                : "transparent"
              }
              color="#171c26"
              _hover={{ textDecoration: "none" }}
            >
              Map View
            </Box>
          </HStack>
        </Flex>

        {/* Filters + Stats Row */}
        <Flex
          justify="space-between"
          align="center"
          wrap="wrap"
          gap={4}
        >
          {/* Filters */}
          <Grid
            templateColumns={{
              base: "1fr",
              md: "repeat(5, auto)", // Changed from 3 to 5 to align everything in one row
            }}
            gap={4}
            alignItems="center" // Ensures vertical alignment for all elements
          >
            {/* District */}
            <Select
              placeholder="Select District"
              size="sm"
              w={"auto"}
              bg={buttonGradientColor}
              borderRadius="8px"
              fontSize={"12px"}
              value={selectedDistrictName}
              onChange={handleDistrictChange}
            >
              {districtsList.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </Select>

            {/* Assembly */}
            <Select
              placeholder="Select Assembly"
              size="sm"
              w={"auto"}
              bg={buttonGradientColor}
              borderRadius="8px"
              fontSize={"12px"}
              value={selectedAssemblyValue}
              onChange={handleAssemblyChange}
              isDisabled={!selectedDistrictName}
            >
              {assembliesList.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </Select>

            {/* Vehicle */}
            <Select
              placeholder={isVehicleLoading ? "Loading Vehicles..." : "Select Vehicle"}
              size="sm"
              w={"auto"}
              value={searchLocation}
              onChange={(e) => setSearchLocation(e.target.value)}
              bg={buttonGradientColor}
              borderRadius="8px"
              fontSize={"12px"}
              isDisabled={!selectedAssemblyValue || isVehicleLoading}
            >
              {locationsList.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </Select>

            {/* Radio Group - Now side-by-side with Vehicle */}
            <RadioGroup onChange={setPsOption} value={psOption}>
              <HStack>
                <Radio
                  value="ps"
                  size="md"
                  colorScheme="blue"
                  borderColor="gray.400"
                >
                  <Text fontSize="13px" fontWeight={psOption === "ps" ? "bold" : "normal"} whiteSpace="nowrap">Vehicle No</Text>
                </Radio>
                <Text color="gray.400" fontSize="12px">|</Text>
                <Radio
                  value="camera"
                  size="md"
                  colorScheme="blue"
                  borderColor="gray.400"
                >
                  <Text fontSize="13px" fontWeight={psOption === "camera" ? "bold" : "normal"} whiteSpace="nowrap">Camera ID</Text>
                </Radio>
              </HStack>
            </RadioGroup>

            {/* Search Box - Now side-by-side with Radio buttons */}
            <Input
              placeholder={psOption === "ps" ? "Search Vehicle No" : "Search Camera ID"}
              border="1px solid #CBD5E0"
              value={searchDeviceId}
              onChange={handleSearchDeviceIdChange}
              size="lg"
              width={"125px"}
              height={"34px"}
              fontSize={"12px"}
              bg={buttonGradientColor}
              borderRadius={"12px"}
              color={textColor}
              _placeholder={{ color: placeholderColor }}
            />
          </Grid>

          {/* Stats */}
          <HStack spacing={0} whiteSpace="nowrap">
            <Text color="blue.500" fontWeight="bold" fontSize="14px">
              ● Total ({total})
            </Text>
            <Text color="green.500" fontWeight="bold"  fontSize="14px">
              ● Online ({onlineCount})
            </Text>
            <Text color="red.500" fontWeight="bold"  fontSize="14px">
              ● Offline ({offlineCount})
            </Text>
          </HStack>
        </Flex>

      </Box>


      {/* --- MAP --- */}
     {/* --- MAP --- */}
<Box flex="1" position="relative" ref={mapBoxRef} bg="white">
  {/* Fullscreen Button for Map */}
  <IconButton
    icon={<BsArrowsFullscreen />}
    position="absolute"
    top="10px"
    right="10px"
    zIndex="10"
    onClick={toggleMapFullscreen}
    aria-label="Fullscreen Map"
    colorScheme="blackAlpha"
    bg="white"
    color="black"
    boxShadow="md"
    _hover={{ bg: "gray.100" }}
  />

  <GoogleMap
    mapContainerStyle={containerStyle}
    onLoad={onLoad}
    center={DEFAULT_CENTER}
    zoom={DEFAULT_ZOOM}
    options={{ 
      streetViewControl: false, 
      mapTypeControl: true, // Useful when in fullscreen
      fullscreenControl: false, // We use our custom button
      gestureHandling: "greedy" 
    }}
  >
    {filteredCameras.map((camera, index) => {
      const lat = parseFloat(camera.latitude);
      const lng = parseFloat(camera.longitude);
      const isOnline = isCameraOnline(camera);

      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null;

      return (
        <MarkerF
  key={camera.deviceId || index}
  position={{ lat, lng }}
  icon={getMarkerIcon(isOnline)}
  onClick={() => handleMarkerClick(camera)}
  // CHANGE THIS LINE:
  title={`ID: ${camera.deviceId} | Vehicle: ${camera.locations || "N/A"}`}
/>
      );
    })}
  </GoogleMap>
</Box>
      {/* --- MODAL --- */}
      <Modal isOpen={isOpen} onClose={handleCloseModal} size="xl" isCentered usePortal={false}>
        <ModalOverlay backdropFilter="blur(5px)" />
        <ModalContent bg="gray.900" color="white" border="1px solid #333">
          <ModalHeader>
            {selectedCamera?.deviceId}
            <Badge ml={3} colorScheme="green" variant="solid">LIVE</Badge>
          </ModalHeader>
          <ModalCloseButton />

          <ModalBody pb={6}>
            {streamUrl && selectedCamera ? (
              <Box ref={containerRef} position="relative" borderRadius="md" overflow="hidden" height={isFs ? "100vh" : "400px"}>
                {/* 3. Pass the muted prop to the Player */}
                <Player
                  device={selectedCamera}
                  initialPlayUrl={streamUrl}
                  muted={isMuted}
                  // DYNAMIC STYLE: Switches based on isFs state
                  style={{
                    width: "100%",
                    height: isFs ? "730px" : "400px"
                  }}
                />

                {/* Buttons Overlay Group */}
                <HStack
                  position="absolute"
                  bottom="15px"
                  right="15px"
                  zIndex="20"
                  spacing={2}
                >
                  {/* Mute Button */}
                  <IconButton
                    variant="solid"
                    size="sm"
                    bg="rgba(0,0,0,0.6)"
                    _hover={{ bg: "black" }}
                    color="white"
                    borderRadius="full"
                    icon={isMuted ? <BsVolumeMute fontSize="20px" /> : <BsVolumeUp fontSize="20px" />}
                    onClick={() => setIsMuted(!isMuted)}
                    aria-label="Toggle Mute"
                  />

                  {/* Fullscreen Button */}
                  <IconButton
                    variant="solid"
                    size="sm"
                    bg="rgba(0,0,0,0.6)"
                    _hover={{ bg: "black" }}
                    color="white"
                    borderRadius="full"
                    icon={<BsArrowsFullscreen fontSize="16px" />}
                    onClick={toggleMapFullscreen}
                    aria-label="Toggle Fullscreen"
                  />
                </HStack>
              </Box>
            ) : (
              <Center h="200px"><Spinner size="xl" color="blue.500" /></Center>
            )}

            {selectedCamera && (
              <Box mt={4} p={3} bg="gray.800" borderRadius="md" border="1px solid" borderColor="gray.700">
                <Text fontWeight="bold" fontSize="sm" color="gray.200">
                  {selectedCamera.dist_name || selectedCamera.district || 'N/A'}/
                  {selectedCamera.accName || selectedCamera.assembly || 'N/A'}/
                  {/* {selectedCamera.ps_id || 'N/A'}/ */}
                  {selectedCamera.deviceId}/
                  {getLocationName(selectedCamera)}
                  /{selectedCamera.operatorName || 'N/A'}/
                  {selectedCamera.operatorMobile || 'N/A'}
                </Text>
              </Box>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Flex>
  );
};

export default GpsTrackingMap;