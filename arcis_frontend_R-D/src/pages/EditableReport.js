import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import {
  Box as ChakraBox,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  HStack,
  Button,
  Select,
  Input,
  Flex,
  Text,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  FormControl,
  FormLabel,
  useToast,
  Grid,
  RadioGroup,
  Radio,
  Box,
  Link as ChakraLink,
  useColorModeValue,
  IconButton,
  InputGroup,
  InputLeftElement,
  Tooltip,
} from "@chakra-ui/react";
import { FaPlus, FaSearch } from "react-icons/fa";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import Swal from "sweetalert2";
import { addDevice } from "../actions/cameraActions";
import MobileHeader from "../components/MobileHeader";

const RTMP_URL_REGEX = /^rtmp:\/\/([^:/]+)(?::(\d+))?\/([^/]+)\/(.+)$/i;
const parseRtmpUrlClient = (url) => {
  const match = String(url || "").trim().match(RTMP_URL_REGEX);
  if (!match) return null;
  const [, serverName, port, app, deviceId] = match;
  return { serverName, port: port || "80", app, deviceId };
};

const getYourCamerasAPI = async (userEmail, filters = {}) => {
  const API_URL = `${process.env.REACT_APP_URL}/api/camera/getCurrentUserCameras1`;

  const params = new URLSearchParams();
  if (filters.page) params.set("page", filters.page);
  if (filters.limit) params.set("limit", filters.limit);
  if (filters.district) params.set("district", filters.district);
  if (filters.assembly) params.set("assembly", filters.assembly);
  if (filters.search) params.set("search", filters.search);
  if (filters.searchType) params.set("searchType", filters.searchType);
  if (filters.locationType && filters.locationType !== "all")
    params.set("locationType", filters.locationType);

  try {
    const response = await axios.post(`${API_URL}?${params.toString()}`, { email: userEmail });

    const rawCameras = Array.isArray(response.data)
      ? response.data
      : Array.isArray(response.data?.userCameras)
        ? response.data.userCameras
        : [];

    const total = response.data?.total ?? rawCameras.length;

    const mappedCameras = rawCameras
      .filter(camera => camera != null && camera.deviceId)
      .map((camera) => {
        let locationString = "N/A";
        if (camera.locations?.length > 0) {
          const firstLocation = camera.locations[0];
          locationString = typeof firstLocation === "string"
            ? firstLocation
            : firstLocation?.loc_name || "N/A";
        }
        return {
          DeviceId: camera.deviceId,
          district: camera.dist_name,
          assembly: camera.accName,
          location: locationString,
          is_live: camera.is_live,
          last_checked: camera.last_checked || camera.lastSeen || camera.updatedAt || new Date().toISOString(),
          user_email: userEmail,
          name: camera.name,
          location_Type: camera.location_Type,
          operatorName: camera.operatorName,
          operatorMobile: camera.operatorMobile,
        };
      });

    return {
      userCameras: mappedCameras,
      total,
      allDeviceIds: response.data?.allDeviceIds || [],
    };
  } catch (error) {
    console.error("Error fetching cameras:", error.response ? error.response.data : error.message);
    if (error.response?.status === 404) return { userCameras: [], total: 0, allDeviceIds: [] };
    throw error;
  }
};

const getAllRegionsAPI = async () => {
  const API_URL = `${process.env.REACT_APP_URL}/api/camera/getAllRegions`;
  try {
    const response = await axios.get(API_URL);
    return response.data && Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    console.error("Error fetching all region data:", error.message);
    return [];
  }
};

const Boxes = () => {
  const [allFetchedCameras, setAllFetchedCameras] = useState([]);
  const [displayedCameras, setDisplayedCameras] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [loading, setLoading] = useState(true);
  const [allRegionData, setAllRegionData] = useState([]);
  const [allValidDeviceIds, setAllValidDeviceIds] = useState([]);
  const [selectedDistrictName, setSelectedDistrictName] = useState("");
  const [selectedAssemblyValue, setSelectedAssemblyValue] = useState("");
  const [selectedLocationType, setSelectedLocationType] = useState("all");
  const { isOpen: isModalOpen, onOpen, onClose } = useDisclosure();
  const [editingCamera, setEditingCamera] = useState(null);
  const [modalMode, setModalMode] = useState("edit");
  const [isSaving, setIsSaving] = useState(false);
  const [psOption, setPsOption] = useState("ps");
  const [searchOption, setSearchOption] = useState("vehicle");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDeviceId, setSearchDeviceId] = useState("");
  const [deviceIdSuggestions, setDeviceIdSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addDeviceMode, setAddDeviceMode] = useState("deviceId"); // "deviceId" | "rtmp"
  const [rtmpUrlInput, setRtmpUrlInput] = useState("");
  const toast = useToast();

  // FIX 1: serverTotal state added
  const [serverTotal, setServerTotal] = useState(0);
  const totalItemsAfterFilters = serverTotal;

  const districtsList = useMemo(
    () => allRegionData.map((region) => region.district),
    [allRegionData]
  );
  const assembliesList = useMemo(() => {
    if (!selectedDistrictName) return [];
    const region = allRegionData.find((r) => r.district === selectedDistrictName);
    return region ? region.assemblies : [];
  }, [allRegionData, selectedDistrictName]);

  const modalAssembliesList = useMemo(() => {
    if (!editingCamera?.district) return [];
    const region = allRegionData.find((r) => r.district === editingCamera.district);
    return region ? region.assemblies : [];
  }, [allRegionData, editingCamera?.district]);

  useEffect(() => {
    const emailFromStorage = localStorage.getItem("email");
    if (emailFromStorage) {
      setUserEmail(emailFromStorage);
    } else {
      setLoading(false);
    }
  }, []);

  // FIX 4 + FIX 5: fetchAllData passes filters and has correct dependencies
  const fetchAllData = useCallback(async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const [regions, cameraData] = await Promise.all([
        getAllRegionsAPI(),
        getYourCamerasAPI(userEmail, {
          page: currentPage,
          limit: itemsPerPage,
          district: selectedDistrictName || undefined,
          assembly: selectedAssemblyValue || undefined,
          search: searchQuery || undefined,
          searchType: searchOption,
          locationType: selectedLocationType,
        }),
      ]);
      setAllRegionData(regions);
      // FIX 2: setDisplayedCameras and setServerTotal added
      setAllFetchedCameras(cameraData.userCameras || []);
      setDisplayedCameras(cameraData.userCameras || []);
      setServerTotal(cameraData.total || 0);
      setAllValidDeviceIds(cameraData.allDeviceIds || []);
    } catch (err) {
      toast({
        title: "Data Fetch Error",
        description: "Could not load data from the server.",
        status: "error",
      });
      setAllRegionData([]);
      setAllFetchedCameras([]);
      setDisplayedCameras([]);
      setServerTotal(0);
      setAllValidDeviceIds([]);
    } finally {
      setLoading(false);
    }
  }, [
    // FIX 5: all filter dependencies added
    userEmail, currentPage, itemsPerPage,
    selectedDistrictName, selectedAssemblyValue,
    searchQuery, searchOption, selectedLocationType,
    toast
  ]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // FIX 3: client-side filter useEffect DELETED — server handles filtering now

  const handleDelete = async (deviceId) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(
          `${process.env.REACT_APP_URL}/api/camera/delete/${deviceId}?userEmail=${userEmail}&source=Portal`
        );
        Swal.fire('Deleted!', `Camera ${deviceId} has been deleted.`, 'success');
        fetchAllData();
      } catch (error) {
        Swal.fire(
          'Error!',
          error.response?.data?.message || "Could not delete camera.",
          'error'
        );
      }
    }
  };

  const checkDuplicateOnServer = async (field, value) => {
    try {
      const params = new URLSearchParams();
      params.set("checkDuplicate", "true");
      if (field === "vehicle") {
        params.set("vehicle", value);
      } else {
        params.set("camera", value);
      }
      const response = await axios.post(
        `${process.env.REACT_APP_URL}/api/camera/getCurrentUserCameras1?${params.toString()}`,
        { email: userEmail }
      );
      return response.data;
    } catch {
      return { exists: false, inStream: false };
    }
  };

  const handleSave = async () => {
    if (!editingCamera) return;

    // 1. Empty field validation
    if (
      !editingCamera.DeviceId ||
      !editingCamera.district ||
      !editingCamera.assembly ||
      !editingCamera.location
    ) {
      toast({
        title: "Validation Error",
        description: "Required fields (District, Assembly, Vehicle No, Device ID) are missing.",
        status: "warning",
      });
      return;
    }

    setIsSaving(true);

    // 1b. RTMP mode: the hardware doesn't exist in the stream table yet - provision it
    // first via /addDevice, then fall through into the normal assignment flow below.
    let skipDuplicateDeviceCheck = false;
    if (modalMode === "add" && addDeviceMode === "rtmp") {
      const hwCheck = await checkDuplicateOnServer("camera", editingCamera.DeviceId);
      if (hwCheck.inStream && hwCheck.exists) {
        setIsSaving(false);
        toast({
          title: "Duplicate Assignment",
          description: `Device ID "${editingCamera.DeviceId}" is already assigned to another vehicle.`,
          status: "error",
        });
        return;
      }
      if (!hwCheck.inStream) {
        try {
          await addDevice(editingCamera.location || editingCamera.DeviceId, undefined, rtmpUrlInput);
          skipDuplicateDeviceCheck = true; // we just created the Camera stub ourselves - step 2 below must not treat it as a conflict
        } catch (err) {
          setIsSaving(false);
          toast({
            title: "Error",
            description: err.response?.data?.message || "Failed to register RTMP device",
            status: "error",
          });
          return;
        }
      }
      // else: inStream true, exists false -> already provisioned earlier but not yet assigned; fall through normally.
    }

    const excludeId = modalMode === "edit" ? editingCamera.originalDeviceId : null;

    // 2. Check duplicate Device ID (Camera ID) first (across ALL data)
    const isDeviceIdChanged = !skipDuplicateDeviceCheck && (modalMode === "add" || (excludeId && editingCamera.DeviceId.toLowerCase() !== excludeId.toLowerCase()));
    let cameraCheck = { exists: false, inStream: true };

    if (isDeviceIdChanged) {
      cameraCheck = await checkDuplicateOnServer("camera", editingCamera.DeviceId.trim());

      // If it doesn't exist in the stream table, directly show error and block
      if (!cameraCheck.inStream) {
        toast({
          title: "Device ID Not Found",
          description: "Device ID not found.",
          status: "error",
        });
        setIsSaving(false);
        return;
      }

      if (cameraCheck.exists) {
        setIsSaving(false);

        if (modalMode === "add") {
          toast({
            title: "Duplicate Assignment",
            description: `Device ID "${editingCamera.DeviceId}" is already assigned to another vehicle.`,
            status: "error",
          });
          return;
        } else {
          // Edit mode: offer swap
          const conflictingCamera = cameraCheck.camera;
          const userAgreesToSwap = await Swal.fire({
            title: 'Device Already Assigned!',
            text: `camera_id ${editingCamera.DeviceId} is already assigned to district- ${conflictingCamera.district || conflictingCamera.dist_name}, assembly- ${conflictingCamera.assembly || conflictingCamera.accName}, Location- ${conflictingCamera.location || conflictingCamera.locations?.[0]}. Do you want to SWAP them?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, swap IDs!'
          });

          if (userAgreesToSwap.isConfirmed) {
            setIsSaving(true);
            try {
              const updatePayload1 = {
                deviceId: editingCamera.DeviceId,
                district: editingCamera.district,
                assembly: editingCamera.assembly,
                location: editingCamera.location || "N/A",
                location_Type: editingCamera.location_Type,
                operatorName: editingCamera.operatorName || "N/A",
                operatorMobile: editingCamera.operatorMobile || "N/A",
                userEmail: userEmail, // ADDED
                source: "Portal"
              };

              const updatePayload2 = {
                deviceId: excludeId || editingCamera.DeviceId,
                district: conflictingCamera.district || conflictingCamera.dist_name,
                assembly: conflictingCamera.assembly || conflictingCamera.accName,
                location: conflictingCamera.location || conflictingCamera.locations?.[0] || "N/A",
                location_Type: conflictingCamera.location_Type || "indoor",
                operatorName: conflictingCamera.operatorName || "N/A",
                operatorMobile: conflictingCamera.operatorMobile || "N/A",
                userEmail: userEmail, // ADDED
                source: "Portal"
              };

              await Promise.all([
                axios.put(`${process.env.REACT_APP_URL}/api/camera/update/${updatePayload1.deviceId}`, updatePayload1),
                axios.put(`${process.env.REACT_APP_URL}/api/camera/update/${updatePayload2.deviceId}`, updatePayload2),
              ]);

              onClose();
              Swal.fire('Swapped!', 'Device IDs have been swapped.', 'success');
              fetchAllData();
            } catch (error) {
              toast({ title: "Swap Failed", description: error.message, status: "error" });
            } finally {
              setIsSaving(false);
            }
          }
          return;
        }
      }
    }

    // 3. Check duplicate Vehicle No next
    const isVehicleChanged = modalMode === "add" || (editingCamera.location.trim().toLowerCase() !== (editingCamera.originalLocation || "").trim().toLowerCase());
    if (isVehicleChanged) {
      const vehicleCheck = await checkDuplicateOnServer("vehicle", editingCamera.location.trim());
      if (vehicleCheck.exists && vehicleCheck.camera?.deviceId?.toLowerCase() !== excludeId?.toLowerCase()) {
        toast({
          title: "Duplicate Vehicle No",
          description: `Vehicle No "${editingCamera.location}" is already assigned to another camera.`,
          status: "error",
        });
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);

    // 5. Standard save
    const saveResult = await Swal.fire({
      title: 'Are you sure?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, save it!'
    });

    if (saveResult.isConfirmed) {
      setIsSaving(true);
      try {
        const targetId = excludeId || editingCamera.DeviceId;
        await axios.put(
          `${process.env.REACT_APP_URL}/api/camera/update/${targetId}`,
          {
            deviceId: editingCamera.DeviceId,
            district: editingCamera.district,
            assembly: editingCamera.assembly,
            location: editingCamera.location || "N/A",
            location_Type: editingCamera.location_Type,
            operatorName: editingCamera.operatorName || "N/A",
            operatorMobile: editingCamera.operatorMobile || "N/A",
            userEmail: userEmail,
            source: "Portal"
          }
        );
        onClose();
        Swal.fire('Saved!', 'Details saved successfully.', 'success');
        fetchAllData();
      } catch (error) {
        toast({
          title: "API Error",
          description: `Could not save: ${error.response?.data?.message || error.message}`,
          status: "error",
        });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleOpenEditModal = (camera) => {
    setModalMode("edit");
    setEditingCamera({
      ...camera,
      originalDeviceId: camera.DeviceId,
      originalLocation: camera.location
    });
    setDeviceIdSuggestions([]);
    setShowSuggestions(false);
    onOpen();
  };

  const handleOpenAddModal = () => {
    setModalMode("add");
    setEditingCamera({
      DeviceId: "",
      district: "",
      assembly: "",
      location: "",
      location_Type: "",
      operatorName: "",
      operatorMobile: "",
    });
    setDeviceIdSuggestions([]);
    setShowSuggestions(false);
    setAddDeviceMode("deviceId");
    setRtmpUrlInput("");
    onOpen();
  };

  const handleRtmpUrlChange = (e) => {
    const value = e.target.value;
    setRtmpUrlInput(value);
    const parsed = parseRtmpUrlClient(value);
    setEditingCamera((prev) => ({ ...prev, DeviceId: parsed ? parsed.deviceId : "" }));
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditingCamera((prev) => ({ ...prev, [name]: value }));
  };

  const fetchedCameraDeviceIds = useMemo(() => {
    return new Set(allFetchedCameras.filter(cam => cam.DeviceId).map(cam => cam.DeviceId.toLowerCase()));
  }, [allFetchedCameras]);

  const handleDeviceIdChange = async (e) => {
    const value = e.target.value;
    setEditingCamera(prev => ({ ...prev, DeviceId: value }));

    if (value.length > 0) {
      try {
        const response = await axios.post(
          `${process.env.REACT_APP_URL}/api/camera/getCurrentUserCameras1?allIdsOnly=true&search=${encodeURIComponent(value)}&mode=${modalMode}`,
          { email: userEmail }
        );
        const suggestions = response.data?.allDeviceIds || [];
        setDeviceIdSuggestions(suggestions);
        setShowSuggestions(suggestions.length > 0);
      } catch (err) {
        console.error("Error fetching suggestions:", err);
      }
    } else {
      setDeviceIdSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = (id) => {
    setEditingCamera(prev => ({ ...prev, DeviceId: id }));
    setDeviceIdSuggestions([]);
    setShowSuggestions(false);
  };

  const handleModalDistrictChange = (e) => {
    const newDistrict = e.target.value;
    // Assembly is hidden from the form, but the backend still needs it — auto-pick
    // the first assembly of the selected Location behind the scenes.
    const region = allRegionData.find((r) => r.district === newDistrict);
    const firstAssembly = region?.assemblies?.[0] || "";
    setEditingCamera((prev) => ({ ...prev, district: newDistrict, assembly: firstAssembly }));
  };

  const handleDistrictChange = (e) => {
    setSelectedDistrictName(e.target.value);
    setSelectedAssemblyValue("");
    setCurrentPage(1);
  };

  const handleAssemblyChange = (e) => {
    setSelectedAssemblyValue(e.target.value);
    setCurrentPage(1);
  };

  const handleLocationTypeChange = (e) => {
    setSelectedLocationType(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleClearFilters = () => {
    setSelectedDistrictName("");
    setSelectedAssemblyValue("");
    setSelectedLocationType("all");
    setSearchDeviceId("");
    setPsOption("ps");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleSearchDeviceIdChange = (event) => {
    setSearchDeviceId(event.target.value);
    setCurrentPage(1);
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    setCurrentPage(1);
  };

  // --- Design System Color Tokens Matching Analytics Image / Listview ---
  const titleColor = useColorModeValue("#1A2E3D", "#FFFFFF");
  const pageHeading = titleColor;
  const subtextColor = useColorModeValue("#64748B", "#94A3B8");
  const subText = subtextColor;
  const cardBg = useColorModeValue("#FFFFFF", "#1C222D");
  const cardBorder = useColorModeValue("#E2E8F0", "rgba(255, 255, 255, 0.08)");
  const softShadow = useColorModeValue("0 1px 3px rgba(0,0,0,0.06)", "dark-lg");
  const inputBg = useColorModeValue("white", "gray.700");
  const placeholderColor = useColorModeValue("#94A3B8", "#64748B");
  const accent = useColorModeValue("#3F77A5", "#63B3ED");
  const accentTint = useColorModeValue("#EBF3FA", "whiteAlpha.200");
  const tableHeaderBg = useColorModeValue("#F0F5FA", "#202734");
  const tableHeaderColor = useColorModeValue("#4A607A", "#94A3B8");
  const tableBorderColor = useColorModeValue("#F1F5F9", "rgba(255, 255, 255, 0.06)");
  const rowAltBg = useColorModeValue("#F8FAFC", "#161C26");
  const tableRowHoverBg = useColorModeValue("#EDF4FA80", "rgba(255, 255, 255, 0.04)");
  const tableTextColor = useColorModeValue("#4A5568", "#CBD5E1");
  const actionBtnBg = useColorModeValue("#3F77A512", "#3F77A522");
  const deleteBtnBg = useColorModeValue("#FEF2F2", "rgba(239, 68, 68, 0.1)");
  const deleteBtnBorder = useColorModeValue("#FEE2E2", "rgba(239, 68, 68, 0.2)");
  const deleteBtnColor = useColorModeValue("#EF4444", "#F87171");

  const thStyle = {
    py: "14px",
    px: "18px",
    fontFamily: "Manrope, sans-serif",
    fontWeight: "700",
    fontSize: "13px",
    color: tableHeaderColor,
    textTransform: "none",
    letterSpacing: "0px",
    whiteSpace: "nowrap",
  };
  const tdStyle = {
    py: "14px",
    px: "18px",
    fontFamily: "Manrope, sans-serif",
    fontSize: "13px",
    color: tableTextColor,
    borderColor: tableBorderColor,
  };

  return (
    <Box
      maxW="1440px"
      w="100%"
      mx="auto"
      px={{ base: "12px", sm: "16px", md: "20px", lg: "24px" }}
      py={{ base: "12px", md: "16px" }}
      fontFamily="'Manrope', sans-serif"
      mb={{ base: "20", md: "6" }}
    >
      <style>
        {`
          .swal2-container {
            z-index: 10000 !important;
          }
        `}
      </style>
      <MobileHeader title="VMS Master" />

      {/* Header */}
      <Flex
        justify="space-between"
        align={{ base: "flex-start", sm: "center" }}
        direction={{ base: "column", sm: "row" }}
        gap={3}
        mb={4}
      >
        <Box>
          <Text
            fontFamily="'Manrope', sans-serif"
            fontWeight={800}
            fontSize={{ base: "20px", md: "22px" }}
            lineHeight="1.2"
            color={pageHeading}
          >
            VMS Master
          </Text>
          <Text
            fontFamily="'Manrope', sans-serif"
            fontSize="13px"
            color={subText}
            mt="2px"
          >
            Camera management and configuration
          </Text>
        </Box>
        <Button
          onClick={handleOpenAddModal}
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          gap="6px"
          w="164px"
          h="38px"
          pt="9px"
          pb="9px"
          pl="18px"
          pr="18px"
          borderRadius="8px"
          bg="#3F77A5"
          boxShadow="0px 2px 10px 0px #3F77A54D"
          color="#FFFFFF"
          _hover={{ bg: "#3570A0", boxShadow: "0px 4px 14px 0px #3F77A54D" }}
          _active={{ bg: "#2E608F" }}
          transition="all 0.15s ease"
        >
          <FaPlus size={11} />
          <Text
            fontFamily="Manrope, sans-serif"
            fontWeight={700}
            fontSize="13px"
            lineHeight="19.5px"
            letterSpacing="0px"
            textAlign="center"
            color="#FFFFFF"
            m={0}
          >
            Add New Camera
          </Text>
        </Button>
      </Flex>

      {/* Big Container enclosing Filter, Table, and Pagination */}
      <Box
        bg={cardBg}
        border="1px solid"
        borderColor={cardBorder}
        borderRadius="16px"
        boxShadow={softShadow}
        p={{ base: 4, md: 6 }}
        mb={{ base: 6, md: 8 }}
      >
        {/* Filter bar */}
        <Flex
          align={{ base: "flex-start", md: "center" }}
          direction={{ base: "column", md: "row" }}
          justify="space-between"
          gap={4}
          mb={6}
          wrap="wrap"
        >
          <Flex align="center" gap={{ base: 3, md: 5 }} flex="1" wrap="wrap" w={{ base: "100%", md: "auto" }}>
            <Text
              fontFamily="Manrope, sans-serif"
              fontSize="11px"
              fontWeight="700"
              color={subtextColor}
              textTransform="uppercase"
              letterSpacing="0.7px"
            >
              SEARCH
            </Text>
            <RadioGroup onChange={setSearchOption} value={searchOption}>
              <HStack spacing={4}>
                <Radio value="Location" size="sm" colorScheme="blue">
                  <Text fontSize="13px" fontWeight={searchOption === "Location" ? "700" : "500"} color={titleColor} fontFamily="Manrope, sans-serif">
                    Location
                  </Text>
                </Radio>
                <Radio value="camera" size="sm" colorScheme="blue">
                  <Text fontSize="13px" fontWeight={searchOption === "camera" ? "700" : "500"} color={titleColor} fontFamily="Manrope, sans-serif">
                    Camera
                  </Text>
                </Radio>
              </HStack>
            </RadioGroup>

            <InputGroup flex="1" minW={{ base: "100%", sm: "240px", md: "320px" }} maxW={{ base: "100%", md: "520px" }} h="38px">
              <InputLeftElement pointerEvents="none" h="38px" color={subtextColor}>
                <FaSearch size={13} />
              </InputLeftElement>
              <Input
                placeholder={searchOption === "Location" ? "Search Location" : "Search Camera ID"}
                value={searchQuery}
                onChange={handleSearchChange}
                bg={inputBg}
                borderColor={cardBorder}
                borderRadius="8px"
                h="38px"
                fontSize="12px"
                fontFamily="Manrope, sans-serif"
                color={titleColor}
                _placeholder={{ color: placeholderColor, fontSize: "12px", fontFamily: "Manrope, sans-serif" }}
                _focus={{ borderColor: "#3F77A5", boxShadow: "0 0 0 1px #3F77A5" }}
              />
            </InputGroup>
          </Flex>

          <ChakraLink
            fontSize="13px"
            color={accent}
            fontWeight="600"
            textDecoration="underline"
            onClick={handleClearFilters}
            whiteSpace="nowrap"
            fontFamily="Manrope, sans-serif"
            _hover={{ color: "#315f85" }}
          >
            Clear Filters
          </ChakraLink>
        </Flex>

        {loading ? (
          <Flex justifyContent="center" alignItems="center" height="200px" flexDirection="column" gap={3}>
            <Spinner size="xl" color={accent} thickness="3px" />
            <Text color={subtextColor} fontFamily="Manrope, sans-serif">Loading camera records…</Text>
          </Flex>
        ) : (
          <>
            {/* Table View matching Listview & Analytics Image Layout & Typography */}
            <Box
              borderRadius="10px"
              overflow="hidden"
              border="1px solid"
              borderColor={tableBorderColor}
            >
              <Box overflowX="auto">
                <Table variant="simple" size="md">
                  <Thead
                    position="sticky"
                    top={0}
                    zIndex={2}
                    bg={tableHeaderBg}
                  >
                    <Tr borderBottom="1px solid" borderColor={tableBorderColor}>
                      <Th sx={thStyle}>Location</Th>
                      <Th sx={thStyle}>Camera Location Name</Th>
                      <Th sx={thStyle}>Device Id</Th>
                      <Th sx={thStyle}>Operator Name</Th>
                      <Th sx={thStyle}>Operator Mobile No.</Th>
                      <Th sx={thStyle} textAlign="center">Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {displayedCameras.length > 0 ? (
                      displayedCameras.map((camera, index) => {
                        const isEvenRow = index % 2 === 1;
                        return (
                          <Tr
                            key={`${camera.DeviceId}-${index}`}
                            bg={isEvenRow ? rowAltBg : cardBg}
                            borderBottom="1px solid"
                            borderColor={tableBorderColor}
                            _hover={{ bg: tableRowHoverBg }}
                            transition="background 0.15s ease"
                          >
                            <Td sx={tdStyle} fontWeight="600" color={titleColor}>
                              {camera.district || "N/A"}
                            </Td>
                            <Td sx={tdStyle} title={camera.location || "N/A"}>
                              {camera.location || "N/A"}
                            </Td>
                            <Td sx={{ ...tdStyle, color: "#3F77A5", fontWeight: "700" }}>
                              {camera.DeviceId || "N/A"}
                            </Td>
                            <Td sx={tdStyle}>
                              {camera.operatorName || "N/A"}
                            </Td>
                            <Td sx={tdStyle}>
                              {camera.operatorMobile || "N/A"}
                            </Td>
                            <Td sx={tdStyle} textAlign="center">
                              <HStack spacing={2} justify="center">
                                <Tooltip label="Edit" hasArrow>
                                  <IconButton
                                    aria-label="Edit"
                                    icon={<FiEdit2 size="13px" />}
                                    size="sm"
                                    h="30px"
                                    w="30px"
                                    minW="30px"
                                    borderRadius="7px"
                                    borderWidth="1px"
                                    borderColor={cardBorder}
                                    bg={actionBtnBg}
                                    color="#3F77A5"
                                    _hover={{
                                      bg: "#3F77A5",
                                      color: "#FFFFFF",
                                      borderColor: "#3F77A5",
                                      transform: "translateY(-1px)",
                                      boxShadow: "0 2px 6px rgba(63, 119, 165, 0.35)",
                                    }}
                                    transition="all 0.15s ease"
                                    onClick={() => handleOpenEditModal(camera)}
                                  />
                                </Tooltip>
                                <Tooltip label="Delete" hasArrow>
                                  <IconButton
                                    aria-label="Delete"
                                    icon={<FiTrash2 size="13px" />}
                                    size="sm"
                                    h="30px"
                                    w="30px"
                                    minW="30px"
                                    borderRadius="7px"
                                    borderWidth="1px"
                                    borderColor={deleteBtnBorder}
                                    bg={deleteBtnBg}
                                    color={deleteBtnColor}
                                    _hover={{
                                      bg: "#EF4444",
                                      color: "#FFFFFF",
                                      borderColor: "#EF4444",
                                      transform: "translateY(-1px)",
                                      boxShadow: "0 2px 6px rgba(239, 68, 68, 0.35)",
                                    }}
                                    transition="all 0.15s ease"
                                    onClick={() => handleDelete(camera.DeviceId)}
                                  />
                                </Tooltip>
                              </HStack>
                            </Td>
                          </Tr>
                        );
                      })
                    ) : (
                      <Tr>
                        <Td colSpan={6} textAlign="center" py={12} color={subtextColor} borderColor={tableBorderColor} fontFamily="Manrope, sans-serif">
                          No records found for the selected filters.
                        </Td>
                      </Tr>
                    )}
                  </Tbody>
                </Table>
              </Box>
            </Box>

            {/* Pagination inside container */}
            {totalItemsAfterFilters > 0 && (
              <Flex justifyContent="center" mt={6} alignItems="center" gap={1} wrap="wrap">
                <Button
                  onClick={() => handlePageChange(currentPage - 1)}
                  isDisabled={currentPage === 1}
                  mr={1}
                  size="sm"
                  variant="outline"
                  borderColor={cardBorder}
                  fontFamily="Manrope, sans-serif"
                >
                  Prev
                </Button>

                {(() => {
                  const totalPages = Math.ceil(totalItemsAfterFilters / itemsPerPage);
                  const pageNumbers = [];
                  const delta = 1;

                  for (let i = 1; i <= totalPages; i++) {
                    if (
                      i === 1 ||
                      i === totalPages ||
                      (i >= currentPage - delta && i <= currentPage + delta)
                    ) {
                      pageNumbers.push(i);
                    } else if (
                      (i === currentPage - delta - 1 && i > 1) ||
                      (i === currentPage + delta + 1 && i < totalPages)
                    ) {
                      if (pageNumbers[pageNumbers.length - 1] !== "...") {
                        pageNumbers.push("...");
                      }
                    }
                  }

                  return pageNumbers.map((page, idx) =>
                    page === "..." ? (
                      <Text key={`ellipsis-${idx}`} mx={2} alignSelf="center" color={subtextColor} fontFamily="Manrope, sans-serif">
                        ...
                      </Text>
                    ) : (
                      <Button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        size="sm"
                        minW="38px"
                        mx={0.5}
                        variant={currentPage === page ? "solid" : "outline"}
                        bg={currentPage === page ? accent : "transparent"}
                        color={currentPage === page ? "white" : "inherit"}
                        borderColor={cardBorder}
                        fontFamily="Manrope, sans-serif"
                        _hover={currentPage === page ? { bg: accent } : { bg: tableRowHoverBg }}
                      >
                        {page}
                      </Button>
                    )
                  );
                })()}

                <Button
                  onClick={() => handlePageChange(currentPage + 1)}
                  isDisabled={currentPage * itemsPerPage >= totalItemsAfterFilters}
                  ml={1}
                  size="sm"
                  variant="outline"
                  borderColor={cardBorder}
                  fontFamily="Manrope, sans-serif"
                >
                  Next
                </Button>
              </Flex>
            )}
          </>
        )}
      </Box>

      {/* ─── Add New Camera / Edit Camera Modal ─────────────────────────────── */}
      {editingCamera && (
        <Modal
          isOpen={isModalOpen}
          onClose={onClose}
          isCentered
          size={{ base: "xs", sm: "md", md: "lg", lg: "xl" }}
          scrollBehavior="inside"
        >
          <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
          <ModalContent
            borderRadius={{ base: "12px", md: "16px" }}
            bg={cardBg}
            fontFamily="'Manrope', sans-serif"
            border="1px solid"
            borderColor={cardBorder}
            boxShadow="0 20px 60px rgba(0,0,0,0.18)"
            mx={{ base: 3, sm: 4 }}
          >
            {/* Header */}
            <ModalHeader
              px={{ base: 4, md: 6 }}
              py={{ base: 4, md: 5 }}
              borderBottom="1px solid"
              borderColor={cardBorder}
            >
              <Text
                fontFamily="'Manrope', sans-serif"
                fontWeight={800}
                fontSize={{ base: "15px", md: "17px" }}
                color={pageHeading}
                lineHeight="1.2"
              >
                {modalMode === "edit" ? "Edit Camera Details" : "Add New Camera"}
              </Text>
            </ModalHeader>
            <ModalCloseButton
              top={{ base: "10px", md: "14px" }}
              right={{ base: "10px", md: "16px" }}
              color={subtextColor}
              _hover={{ color: pageHeading, bg: accentTint }}
              borderRadius="8px"
            />

            {/* Body */}
            <ModalBody px={{ base: 4, md: 6 }} py={{ base: 4, md: 5 }}>
              <Grid
                templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)" }}
                gap={{ base: 4, md: 5 }}
              >
                {/* Location */}
                <FormControl isRequired>
                  <FormLabel
                    fontFamily="'Manrope', sans-serif"
                    fontSize={{ base: "12px", md: "13px" }}
                    fontWeight={600}
                    color={subtextColor}
                    mb="6px"
                    sx={{
                      "& .chakra-form__required-indicator": { color: "#E53E3E" },
                    }}
                  >
                    Location
                  </FormLabel>
                  <Select
                    id="modal-location"
                    name="district"
                    value={editingCamera.district || ""}
                    isDisabled={modalMode === "edit"}
                    onChange={handleModalDistrictChange}
                    placeholder="Select Location"
                    size="md"
                    bg={inputBg}
                    borderColor={cardBorder}
                    borderRadius="8px"
                    fontSize="13px"
                    fontFamily="'Manrope', sans-serif"
                    color={titleColor}
                    h="42px"
                    _focus={{ borderColor: accent, boxShadow: `0 0 0 1px ${accent}` }}
                    _disabled={{ opacity: 0.55, cursor: "not-allowed" }}
                  >
                    {districtsList.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </Select>
                </FormControl>

                {/* Camera Location Name */}
                <FormControl isRequired>
                  <FormLabel
                    fontFamily="'Manrope', sans-serif"
                    fontSize={{ base: "12px", md: "13px" }}
                    fontWeight={600}
                    color={subtextColor}
                    mb="6px"
                    sx={{
                      "& .chakra-form__required-indicator": { color: "#E53E3E" },
                    }}
                  >
                    Camera Location Name
                  </FormLabel>
                  <Input
                    id="modal-location-name"
                    name="location"
                    value={editingCamera.location || ""}
                    onChange={handleEditInputChange}
                    placeholder="Enter camera location name"
                    size="md"
                    h="42px"
                    bg={inputBg}
                    borderColor={cardBorder}
                    borderRadius="8px"
                    fontSize="13px"
                    fontFamily="'Manrope', sans-serif"
                    color={titleColor}
                    _placeholder={{ color: placeholderColor, fontSize: "13px" }}
                    _focus={{ borderColor: accent, boxShadow: `0 0 0 1px ${accent}` }}
                  />
                </FormControl>

                {/* Add Device Using — only shown in "add" mode, spans full width */}
                {modalMode === "add" && (
                  <FormControl gridColumn={{ base: "1", sm: "1 / -1" }}>
                    <FormLabel
                      fontFamily="'Manrope', sans-serif"
                      fontSize={{ base: "12px", md: "13px" }}
                      fontWeight={600}
                      color={subtextColor}
                      mb="8px"
                    >
                      Add Device Using
                    </FormLabel>
                    <RadioGroup value={addDeviceMode} onChange={setAddDeviceMode}>
                      <HStack spacing={{ base: 4, md: 6 }}>
                        <Radio
                          value="deviceId"
                          colorScheme="blue"
                          size="md"
                          borderColor={cardBorder}
                        >
                          <Text
                            fontFamily="'Manrope', sans-serif"
                            fontSize="13px"
                            fontWeight={500}
                            color={titleColor}
                          >
                            Device ID
                          </Text>
                        </Radio>
                        <Radio
                          value="rtmp"
                          colorScheme="blue"
                          size="md"
                          borderColor={cardBorder}
                        >
                          <Text
                            fontFamily="'Manrope', sans-serif"
                            fontSize="13px"
                            fontWeight={500}
                            color={titleColor}
                          >
                            RTMP URL
                          </Text>
                        </Radio>
                      </HStack>
                    </RadioGroup>
                  </FormControl>
                )}

                {/* Device ID / RTMP URL */}
                {addDeviceMode === "rtmp" && modalMode === "add" ? (
                  <FormControl isRequired gridColumn={{ base: "1", sm: "1 / -1" }}>
                    <FormLabel
                      fontFamily="'Manrope', sans-serif"
                      fontSize={{ base: "12px", md: "13px" }}
                      fontWeight={600}
                      color={subtextColor}
                      mb="6px"
                      sx={{
                        "& .chakra-form__required-indicator": { color: "#E53E3E" },
                      }}
                    >
                      RTMP URL
                    </FormLabel>
                    <Input
                      id="modal-rtmp-url"
                      name="rtmpUrl"
                      value={rtmpUrlInput}
                      onChange={handleRtmpUrlChange}
                      placeholder="rtmp://server:port/live-record/deviceId"
                      size="md"
                      h="42px"
                      bg={inputBg}
                      borderColor={cardBorder}
                      borderRadius="8px"
                      fontSize="13px"
                      fontFamily="'Manrope', sans-serif"
                      color={titleColor}
                      autoComplete="off"
                      _placeholder={{ color: placeholderColor, fontSize: "13px" }}
                      _focus={{ borderColor: accent, boxShadow: `0 0 0 1px ${accent}` }}
                    />
                    {rtmpUrlInput && (
                      <Text
                        fontFamily="'Manrope', sans-serif"
                        fontSize="11px"
                        mt="5px"
                        color={editingCamera.DeviceId ? subtextColor : "red.500"}
                      >
                        {editingCamera.DeviceId
                          ? `Detected Device ID: ${editingCamera.DeviceId}`
                          : "Invalid RTMP URL format"}
                      </Text>
                    )}
                  </FormControl>
                ) : (
                  <FormControl isRequired position="relative">
                    <FormLabel
                      fontFamily="'Manrope', sans-serif"
                      fontSize={{ base: "12px", md: "13px" }}
                      fontWeight={600}
                      color={subtextColor}
                      mb="6px"
                      sx={{
                        "& .chakra-form__required-indicator": { color: "#E53E3E" },
                      }}
                    >
                      Device ID
                    </FormLabel>
                    <Input
                      id="modal-device-id"
                      name="DeviceId"
                      value={editingCamera.DeviceId || ""}
                      onChange={handleDeviceIdChange}
                      placeholder="Enter Device ID"
                      size="md"
                      h="42px"
                      bg={inputBg}
                      borderColor={cardBorder}
                      borderRadius="8px"
                      fontSize="13px"
                      fontFamily="'Manrope', sans-serif"
                      color={titleColor}
                      autoComplete="off"
                      _placeholder={{ color: placeholderColor, fontSize: "13px" }}
                      _focus={{ borderColor: accent, boxShadow: `0 0 0 1px ${accent}` }}
                    />
                    {showSuggestions && deviceIdSuggestions.length > 0 && (
                      <ChakraBox
                        position="absolute"
                        top="100%"
                        left="0"
                        right="0"
                        zIndex="9999"
                        bg={cardBg}
                        border="1px solid"
                        borderColor={cardBorder}
                        borderRadius="8px"
                        boxShadow="0 8px 24px rgba(0,0,0,0.12)"
                        maxH="180px"
                        overflowY="auto"
                        mt="4px"
                      >
                        {deviceIdSuggestions.map((id) => (
                          <Box
                            key={id}
                            px={4}
                            py="9px"
                            cursor="pointer"
                            fontFamily="'Manrope', sans-serif"
                            fontSize="13px"
                            color={titleColor}
                            _hover={{ bg: accentTint, color: accent }}
                            onClick={() => handleSelectSuggestion(id)}
                            borderBottom="1px solid"
                            borderColor={cardBorder}
                            transition="background 0.12s ease"
                            _last={{ borderBottom: "none" }}
                          >
                            {id}
                          </Box>
                        ))}
                      </ChakraBox>
                    )}
                  </FormControl>
                )}

                {/* Operator Name */}
                <FormControl>
                  <FormLabel
                    fontFamily="'Manrope', sans-serif"
                    fontSize={{ base: "12px", md: "13px" }}
                    fontWeight={600}
                    color={subtextColor}
                    mb="6px"
                  >
                    Operator Name
                  </FormLabel>
                  <Input
                    id="modal-operator-name"
                    name="operatorName"
                    value={editingCamera.operatorName || ""}
                    onChange={handleEditInputChange}
                    placeholder="Enter Operator Name"
                    size="md"
                    h="42px"
                    bg={inputBg}
                    borderColor={cardBorder}
                    borderRadius="8px"
                    fontSize="13px"
                    fontFamily="'Manrope', sans-serif"
                    color={titleColor}
                    _placeholder={{ color: placeholderColor, fontSize: "13px" }}
                    _focus={{ borderColor: accent, boxShadow: `0 0 0 1px ${accent}` }}
                  />
                </FormControl>

                {/* Operator Mobile No. */}
                <FormControl>
                  <FormLabel
                    fontFamily="'Manrope', sans-serif"
                    fontSize={{ base: "12px", md: "13px" }}
                    fontWeight={600}
                    color={subtextColor}
                    mb="6px"
                  >
                    Operator Mobile No.
                  </FormLabel>
                  <Input
                    id="modal-operator-mobile"
                    name="operatorMobile"
                    type="tel"
                    maxLength={10}
                    value={editingCamera.operatorMobile || ""}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      if (value.length <= 10) {
                        handleEditInputChange({
                          target: { name: "operatorMobile", value },
                        });
                      }
                    }}
                    placeholder="Enter 10-digit number"
                    size="md"
                    h="42px"
                    bg={inputBg}
                    borderColor={cardBorder}
                    borderRadius="8px"
                    fontSize="13px"
                    fontFamily="'Manrope', sans-serif"
                    color={titleColor}
                    _placeholder={{ color: placeholderColor, fontSize: "13px" }}
                    _focus={{ borderColor: accent, boxShadow: `0 0 0 1px ${accent}` }}
                  />
                </FormControl>

              </Grid>
            </ModalBody>

            {/* Footer */}
            <ModalFooter
              px={{ base: 4, md: 6 }}
              py={{ base: 4, md: 5 }}
              borderTop="1px solid"
              borderColor={cardBorder}
              gap={3}
            >
              <Button
                id="modal-save-btn"
                onClick={handleSave}
                isLoading={isSaving}
                isDisabled={isSaving}
                bg={accent}
                color="white"
                _hover={{ opacity: 0.88 }}
                _active={{ opacity: 0.76 }}
                borderRadius="9px"
                fontFamily="'Manrope', sans-serif"
                fontWeight={700}
                fontSize={{ base: "13px", md: "14px" }}
                h={{ base: "38px", md: "42px" }}
                px={{ base: 5, md: 6 }}
                minW={{ base: "90px", md: "100px" }}
                transition="opacity 0.15s ease"
              >
                {modalMode === "add" ? "Add Camera" : "Save"}
              </Button>
              <Button
                id="modal-cancel-btn"
                onClick={onClose}
                isDisabled={isSaving}
                variant="outline"
                borderColor={cardBorder}
                color={subtextColor}
                bg="transparent"
                _hover={{ bg: accentTint, borderColor: accent, color: accent }}
                borderRadius="9px"
                fontFamily="'Manrope', sans-serif"
                fontWeight={600}
                fontSize={{ base: "13px", md: "14px" }}
                h={{ base: "38px", md: "42px" }}
                px={{ base: 5, md: 6 }}
                minW={{ base: "90px", md: "100px" }}
                transition="all 0.15s ease"
              >
                Cancel
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
      {/* ─── End Modal ──────────────────────────────────────────────────────── */}

    </Box>
  );
};

export default Boxes; 
