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
  TableContainer,
  Tooltip,
} from "@chakra-ui/react";
import { FaEdit, FaPlus, FaTrash, FaSearch } from "react-icons/fa";
import Swal from "sweetalert2";

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

    const excludeId = modalMode === "edit" ? editingCamera.originalDeviceId : null;

    // 2. Check duplicate Device ID (Camera ID) first (across ALL data)
    const isDeviceIdChanged = modalMode === "add" || (excludeId && editingCamera.DeviceId.toLowerCase() !== excludeId.toLowerCase());
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
    onOpen();
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

  // --- Professional theme tokens (match dashboard/events pages) ---
  const pageHeading = useColorModeValue("gray.800", "white");
  const subText = useColorModeValue("gray.500", "gray.400");
  const cardBg = useColorModeValue("#FFFFFF", "gray.800");
  const cardBorder = useColorModeValue("rgba(226,232,240,0.9)", "whiteAlpha.200");
  const softShadow = useColorModeValue("0 1px 3px rgba(0,0,0,0.06)", "dark-lg");
  const inputBg = useColorModeValue("white", "gray.700");
  const accent = useColorModeValue("#3F77A5", "#63B3ED");
  const accentTint = useColorModeValue("#EBF3FA", "whiteAlpha.200");
  const tableHeadBg = useColorModeValue("#F1F5F9", "gray.700");
  const rowHover = useColorModeValue("gray.50", "whiteAlpha.100");
  const zebra = useColorModeValue("gray.50", "whiteAlpha.50");
  const optionBg = useColorModeValue("white", "gray.700");
  const bg = useColorModeValue("white", "gray.800");

  const thStyle = {
    py: 3,
    px: 3,
    textAlign: "center",
    textTransform: "none",
    fontSize: "12px",
    fontWeight: "700",
    color: pageHeading,
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
  };
  const tdStyle = { py: 2.5, px: 3, textAlign: "center", fontSize: "13px", borderColor: cardBorder };

  return (
    <div style={{ fontFamily: "Arial, sans-serif" }}>
      <style>
        {`
          .swal2-container {
            z-index: 10000 !important;
          }
        `}
      </style>
      <ChakraBox borderRadius="lg" h={"fit-content"} flexDirection="column" gap={5} display="flex">
        {/* Header */}
        <Flex justify="space-between" align={{ base: "flex-start", md: "center" }} direction={{ base: "column", md: "row" }} gap={3}>
          <Box>
            <Text fontWeight={700} fontSize="28px" color={pageHeading} lineHeight="1.2">
              VMS Master
            </Text>
            
          </Box>
          <Button
            onClick={handleOpenAddModal}
            leftIcon={<FaPlus size={13} />}
            bg={accent}
            color="white"
            _hover={{ opacity: 0.9 }}
            borderRadius="10px"
            size="md"
          >
            Add New camera
          </Button>
        </Flex>

        {/* Filter bar */}
        <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" boxShadow={softShadow} p={4}>
          <Flex align={{ base: "stretch", lg: "flex-end" }} justify="space-between" gap={4} wrap="wrap" direction={{ base: "column", lg: "row" }}>
            <Flex gap={3} wrap="wrap" flex={1}>
              <Box minW="180px">
                <Text fontSize="12px" fontWeight="600" color={subText} mb={1.5} textTransform="uppercase" letterSpacing="0.05em">Location</Text>
                <Select
                  placeholder="All Locations"
                  value={selectedDistrictName}
                  onChange={handleDistrictChange}
                  bg={inputBg}
                  borderColor={cardBorder}
                  borderRadius="10px"
                  sx={{ "> option": { bg: optionBg, color: pageHeading } }}
                >
                  {districtsList.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </Select>
              </Box>

              <Box minW="240px">
                <Text fontSize="12px" fontWeight="600" color={subText} mb={1.5} textTransform="uppercase" letterSpacing="0.05em">
                  Search
                </Text>
                <Flex gap={2} align="center">
                  <RadioGroup onChange={setSearchOption} value={searchOption}>
                    <HStack spacing={2}>
                      <Radio value="Location" size="sm" colorScheme="blue">
                        <Text fontSize="12px" fontWeight={searchOption === "Location" ? "700" : "500"}>Location</Text>
                      </Radio>
                      <Radio value="camera" size="sm" colorScheme="blue">
                        <Text fontSize="12px" fontWeight={searchOption === "camera" ? "700" : "500"}>Camera</Text>
                      </Radio>
                    </HStack>
                  </RadioGroup>
                  <InputGroup flex={1} minW="150px">
                    <InputLeftElement pointerEvents="none" color={subText}>
                      <FaSearch size={13} />
                    </InputLeftElement>
                    <Input
                      placeholder={searchOption === "Location" ? "Search Location" : "Search Camera ID"}
                      value={searchQuery}
                      onChange={handleSearchChange}
                      bg={inputBg}
                      borderColor={cardBorder}
                      borderRadius="10px"
                    />
                  </InputGroup>
                </Flex>
              </Box>
            </Flex>

            <Button variant="ghost" color={subText} size="sm" onClick={handleClearFilters} _hover={{ bg: rowHover }}>
              Clear Filters
            </Button>
          </Flex>
        </Box>

        {loading ? (
          <Flex justifyContent="center" alignItems="center" height="200px" flexDirection="column" gap={3}>
            <Spinner size="xl" color={accent} thickness="3px" />
            <Text color={subText}>Loading camera records…</Text>
          </Flex>
        ) : (
          <>
            <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" boxShadow={softShadow} overflow="hidden">
              <TableContainer overflowX="auto">
                <Table size="sm">
                  <Thead bg={tableHeadBg} position="sticky" top={0} zIndex={1}>
                    <Tr>
                      <Th sx={thStyle}>Sr No.</Th>
                      <Th sx={thStyle}>Location</Th>
                      <Th sx={thStyle}>Camera Location Name</Th>
                      <Th sx={thStyle}>Device Id</Th>
                      <Th sx={thStyle}>Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {displayedCameras.length > 0 ? (
                      displayedCameras.map((camera, index) => (
                        <Tr key={`${camera.DeviceId}-${index}`} bg={index % 2 !== 0 ? zebra : "transparent"} _hover={{ bg: rowHover }}>
                          <Td sx={tdStyle}>{(currentPage - 1) * itemsPerPage + index + 1}</Td>
                          <Td sx={tdStyle}>{camera.district || "N/A"}</Td>
                          <Td sx={tdStyle} title={camera.location || "N/A"}>{camera.location || "N/A"}</Td>
                          <Td sx={tdStyle} fontWeight="600" color={accent}>{camera.DeviceId || "N/A"}</Td>
                          <Td sx={tdStyle}>
                            <HStack spacing={2} justify="center">
                              <Tooltip label="Edit" hasArrow>
                                <IconButton
                                  aria-label="Edit"
                                  icon={<FaEdit />}
                                  size="sm"
                                  variant="outline"
                                  borderColor={cardBorder}
                                  color={accent}
                                  _hover={{ bg: accentTint }}
                                  onClick={() => handleOpenEditModal(camera)}
                                />
                              </Tooltip>
                              <Tooltip label="Delete" hasArrow>
                                <IconButton
                                  aria-label="Delete"
                                  icon={<FaTrash />}
                                  size="sm"
                                  variant="outline"
                                  colorScheme="red"
                                  _hover={{ bg: "red.500", color: "white" }}
                                  onClick={() => handleDelete(camera.DeviceId)}
                                />
                              </Tooltip>
                            </HStack>
                          </Td>
                        </Tr>
                      ))
                    ) : (
                      <Tr>
                        <Td colSpan={5} textAlign="center" py={12} color={subText} borderColor={cardBorder}>
                          No records found for the selected filters.
                        </Td>
                      </Tr>
                    )}
                  </Tbody>
                </Table>
              </TableContainer>
            </Box>

            {totalItemsAfterFilters > 0 && (
              <Flex justifyContent="center" mt={2} alignItems="center" gap={1} wrap="wrap">
                <Button
                  onClick={() => handlePageChange(currentPage - 1)}
                  isDisabled={currentPage === 1}
                  mr={1}
                  size="sm"
                  variant="outline"
                  borderColor={cardBorder}
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
                      <Text key={`ellipsis-${idx}`} mx={2} alignSelf="center">
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
                        _hover={currentPage === page ? { bg: accent } : { bg: rowHover }}
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
                >
                  Next
                </Button>
              </Flex>
            )}
          </>
        )}
      </ChakraBox>

      {editingCamera && (
        <Modal isOpen={isModalOpen} onClose={onClose} isCentered size="xl" scrollBehavior="inside">
          <ModalOverlay bg="blackAlpha.600" />
          <ModalContent borderRadius="16px" bg={cardBg}>
            <ModalHeader fontSize="18px" fontWeight="700" color={pageHeading} borderBottom="1px solid" borderColor={cardBorder}>
              {modalMode === "edit" ? "Edit camera Details" : "Add New camera"}
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody pb={6}>
              <Grid templateColumns="repeat(2, 1fr)" gap={4}>

                <FormControl isRequired>
                  <FormLabel fontSize="sm">Location</FormLabel>
                  <Select
                    name="district"
                    value={editingCamera.district}
                    isDisabled={modalMode === "edit"}
                    onChange={handleModalDistrictChange}
                    placeholder="Select Location"
                    size="lg"
                  >
                    {districtsList.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </Select>
                </FormControl>

                <FormControl isRequired mt={2}>
                  <FormLabel fontSize="sm">Camera Location Name</FormLabel>
                  <Input
                    name="location"
                    value={editingCamera.location || ""}
                    onChange={handleEditInputChange}
                    placeholder="Enter camera location name"
                    size="lg"
                  />
                </FormControl>

                <FormControl isRequired mt={2} position="relative">
                  <FormLabel fontSize="sm">Device ID</FormLabel>
                  <Input
                    name="DeviceId"
                    value={editingCamera.DeviceId || ""}
                    onChange={handleDeviceIdChange}
                    placeholder="Enter Device ID"
                    size="lg"
                    autoComplete="off"
                  />
                  {showSuggestions && deviceIdSuggestions.length > 0 && (
                    <ChakraBox
                      position="absolute"
                      top="100%"
                      left="0"
                      right="0"
                      zIndex="9999"
                      bg={bg}
                      border="1px solid"
                      borderColor="gray.200"
                      borderRadius="md"
                      boxShadow="lg"
                      maxH="200px"
                      overflowY="auto"
                    >
                      {deviceIdSuggestions.map((id) => (
                        <Box
                          key={id}
                          px={4}
                          py={2}
                          cursor="pointer"
                          _hover={{ bg: "blue.50", color: "blue.600" }}
                          onClick={() => handleSelectSuggestion(id)}
                          fontSize="sm"
                          borderBottom="1px solid"
                          borderColor="gray.100"
                        >
                          {id}
                        </Box>
                      ))}
                    </ChakraBox>
                  )}
                </FormControl>

                {/* <FormControl mt={2}>
                  <FormLabel fontSize="sm">Driver Name</FormLabel>
                  <Input
                    name="operatorName"
                    value={editingCamera.operatorName || ""}
                    onChange={handleEditInputChange}
                    placeholder="Enter driver Name"
                    size="lg"
                  />
                </FormControl>

                <FormControl mt={2}>
                  <FormLabel fontSize="sm">Driver Mobile No.</FormLabel>
                  <Input
                    name="operatorMobile"
                    type="tel"
                    maxLength={10}
                    value={editingCamera.operatorMobile || ""}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      if (value.length <= 10) {
                        handleEditInputChange({
                          target: { name: "operatorMobile", value: value },
                        });
                      }
                    }}
                    placeholder="Enter 10-digit number"
                    size="lg"
                  />
                </FormControl> */}

                {/* <FormControl mt={2}>
                  <FormLabel fontSize="sm">Vehicle Type</FormLabel>
                  <Input
                    name="location_Type"
                    value={editingCamera.location_Type || ""}
                    onChange={handleEditInputChange}
                    placeholder="Enter Vehicle"
                    size="lg"
                  />
                </FormControl> */}

              </Grid>
            </ModalBody>

            <ModalFooter>
              <Button
                colorScheme="blue"
                mr={3}
                onClick={handleSave}
                isLoading={isSaving}
                isDisabled={isSaving}
                size="lg"
              >
                Save
              </Button>
              <Button onClick={onClose} isDisabled={isSaving} size="lg">
                Cancel
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </div>
  );
};

export default Boxes; 
