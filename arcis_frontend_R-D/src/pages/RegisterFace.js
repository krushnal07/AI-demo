import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Box,
  Flex,
  Text,
  Input,
  Button,
  IconButton,
  RadioGroup,
  Radio,
  HStack,
  VStack,
  Grid,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Image,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  useToast,
  useColorModeValue,
  Spinner,
  Tooltip,
} from "@chakra-ui/react";
import { FaUser } from "react-icons/fa";
import { FiUpload, FiTrash2 } from "react-icons/fi";
import Swal from "sweetalert2";
import moment from "moment";
import { registerFace, getRegisteredFaces, deleteFace } from "../actions/faceActions";
import MobileHeader from "../components/MobileHeader";

const RegisterFace = () => {
  const [name, setName] = useState("");
  const [rollNoEmpId, setRollNoEmpId] = useState("");
  const [captureMode, setCaptureMode] = useState("upload"); // "upload" | "capture"
  const [selectedFile, setSelectedFile] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [records, setRecords] = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [modalImage, setModalImage] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const toast = useToast();

  // --- Design System Theme Tokens ---
  const titleColor = useColorModeValue("#1A2E3D", "#FFFFFF");
  const pageHeading = titleColor;
  const subtextColor = useColorModeValue("#64748B", "#94A3B8");
  const subText = subtextColor;
  const cardBg = useColorModeValue("#FFFFFF", "#1C222D");
  const cardBorder = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.08)");
  const softShadow = "0px 1px 6px 0px rgba(26, 46, 61, 0.07)";
  const inputBg = useColorModeValue("white", "gray.700");
  const placeholderColor = useColorModeValue("#94A3B8", "#64748B");
  const accent = useColorModeValue("#3F77A5", "#63B3ED");
  const tableHeaderBg = useColorModeValue("#F0F5FA", "#202734");
  const tableHeaderColor = useColorModeValue("#4A607A", "#94A3B8");
  const tableBorderColor = useColorModeValue("#F1F5F9", "rgba(255, 255, 255, 0.06)");
  const rowHover = useColorModeValue("#EDF4FA80", "rgba(255, 255, 255, 0.04)");
  const tableTextColor = useColorModeValue("#4A5568", "#CBD5E1");
  const fileBtnBg = useColorModeValue("#F0F5FA", "#202734");
  const avatarBg = useColorModeValue("#F0F5FA", "#202734");
  const deleteBtnBg = useColorModeValue("#FEF2F2", "rgba(239, 68, 68, 0.1)");
  const deleteBtnBorder = useColorModeValue("#FEE2E2", "rgba(239, 68, 68, 0.2)");
  const deleteBtnColor = useColorModeValue("#EF4444", "#F87171");

  const thStyle = {
    py: "12px",
    px: "14px",
    fontFamily: "Manrope, sans-serif",
    fontWeight: "700",
    fontSize: "12px",
    color: tableHeaderColor,
    textTransform: "none",
    letterSpacing: "0px",
    whiteSpace: "nowrap",
  };
  const tdStyle = {
    py: "12px",
    px: "14px",
    fontFamily: "Manrope, sans-serif",
    fontSize: "13px",
    color: tableTextColor,
    borderColor: tableBorderColor,
  };

  const fetchRecords = useCallback(async () => {
    setIsLoadingRecords(true);
    try {
      const res = await getRegisteredFaces();
      setRecords(res.records || []);
    } catch (error) {
      toast({ title: "Error", description: "Failed to load registered faces", status: "error" });
    } finally {
      setIsLoadingRecords(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setIsCameraActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (error) {
      toast({
        title: "Camera Error",
        description: "Could not access the camera. Check browser permissions.",
        status: "error",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (captureMode === "capture" && !capturedBlob) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureMode]);

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleModeChange = (mode) => {
    setCaptureMode(mode);
    setSelectedFile(null);
    setCapturedBlob(null);
    setPreviewUrl(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        setCapturedBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stopCamera();
      },
      "image/jpeg",
      0.9
    );
  };

  const retake = () => {
    setCapturedBlob(null);
    setPreviewUrl(null);
    startCamera();
  };

  const resetForm = () => {
    setName("");
    setRollNoEmpId("");
    setSelectedFile(null);
    setCapturedBlob(null);
    setPreviewUrl(null);
    if (captureMode === "capture") startCamera();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({ title: "Validation Error", description: "Name is required", status: "warning" });
      return;
    }
    const imageFile = selectedFile || (capturedBlob ? new File([capturedBlob], "capture.jpg", { type: "image/jpeg" }) : null);
    if (!imageFile) {
      toast({ title: "Validation Error", description: "Please upload or capture a photo", status: "warning" });
      return;
    }

    const formData = new FormData();
    formData.append("image", imageFile);
    formData.append("person_name", name.trim());
    if (rollNoEmpId.trim()) formData.append("roll_no_emp_id", rollNoEmpId.trim());

    setIsSubmitting(true);
    try {
      const res = await registerFace(formData);
      if (res.success) {
        toast({ title: "Registered", description: res.message, status: "success" });
        resetForm();
        fetchRecords();
      } else {
        toast({ title: "No Face Detected", description: res.message, status: "warning" });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to register face",
        status: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (personName) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: `Remove ${personName} from registered faces?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });
    if (!result.isConfirmed) return;

    try {
      await deleteFace(personName);
      Swal.fire("Deleted!", `${personName} has been removed.`, "success");
      fetchRecords();
    } catch (error) {
      Swal.fire("Error!", error.response?.data?.message || "Could not delete.", "error");
    }
  };

  const handleImageClick = (url) => {
    setModalImage(url);
    onOpen();
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
      <MobileHeader title="Register Face" />

      <Modal isOpen={isOpen} onClose={onClose} isCentered size="2xl">
        <ModalOverlay bg="blackAlpha.700" />
        <ModalContent bg={cardBg} borderRadius="16px" overflow="hidden" fontFamily="'Manrope', sans-serif">
          <ModalCloseButton zIndex={2} />
          <ModalBody display="flex" justifyContent="center" alignItems="center" p={4}>
            <Image src={modalImage} alt="Enlarged view" maxW="100%" maxH="80vh" borderRadius="10px" />
          </ModalBody>
        </ModalContent>
      </Modal>

      <Box mb={4}>
        <Text
          fontFamily="'Manrope', sans-serif"
          fontWeight={800}
          fontSize={{ base: "20px", md: "22px" }}
          lineHeight="1.2"
          color={pageHeading}
        >
          Register Face
        </Text>
        <Text
          fontFamily="'Manrope', sans-serif"
          fontSize="13px"
          color={subText}
          mt="2px"
        >
          Upload or capture a photo to register a person for facial recognition
        </Text>
      </Box>

      {/* Container for Card 3 and Card 4 */}
      <VStack spacing="20px" align="stretch" maxW="580px" w="100%">
        {/* Card 3: Registration Form */}
        <Box
          w="100%"
          maxW="580px"
          minH={{ md: "264.5px" }}
          p="20px"
          borderRadius="14px"
          borderWidth="1px"
          borderColor={cardBorder}
          borderTop="1px solid"
          borderTopColor={cardBorder}
          bg={cardBg}
          boxShadow={softShadow}
          fontFamily="'Manrope', sans-serif"
        >
          <Grid templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)" }} gap="16px">
            {/* Name */}
            <Box>
              <Text
                fontFamily="'Manrope', sans-serif"
                fontSize="11px"
                fontWeight="700"
                color={subtextColor}
                textTransform="uppercase"
                letterSpacing="0.7px"
                mb="8px"
              >
                NAME
              </Text>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                bg={inputBg}
                borderColor={cardBorder}
                borderRadius="8px"
                h="38px"
                fontSize="12px"
                fontFamily="'Manrope', sans-serif"
                color={titleColor}
                placeholder="Enter person's name"
                _placeholder={{ color: placeholderColor, fontSize: "12px", fontFamily: "'Manrope', sans-serif" }}
                _focus={{ borderColor: "#3F77A5", boxShadow: "0 0 0 1px #3F77A5" }}
              />
            </Box>

            {/* Roll No / Emp ID */}
            <Box>
              <Text
                fontFamily="'Manrope', sans-serif"
                fontSize="11px"
                fontWeight="700"
                color={subtextColor}
                textTransform="uppercase"
                letterSpacing="0.7px"
                mb="8px"
              >
                ROLL NO / EMP ID (OPTIONAL)
              </Text>
              <Input
                value={rollNoEmpId}
                onChange={(e) => setRollNoEmpId(e.target.value)}
                bg={inputBg}
                borderColor={cardBorder}
                borderRadius="8px"
                h="38px"
                fontSize="12px"
                fontFamily="'Manrope', sans-serif"
                color={titleColor}
                placeholder="Enter roll no or employee id"
                _placeholder={{ color: placeholderColor, fontSize: "12px", fontFamily: "'Manrope', sans-serif" }}
                _focus={{ borderColor: "#3F77A5", boxShadow: "0 0 0 1px #3F77A5" }}
              />
            </Box>

            {/* Photo Source */}
            <Box gridColumn={{ sm: "1 / -1" }}>
              <Text
                fontFamily="'Manrope', sans-serif"
                fontSize="11px"
                fontWeight="700"
                color={subtextColor}
                textTransform="uppercase"
                letterSpacing="0.7px"
                mb="8px"
              >
                PHOTO SOURCE
              </Text>
              <RadioGroup value={captureMode} onChange={handleModeChange}>
                <HStack spacing={6}>
                  <Radio value="upload" size="sm" colorScheme="blue">
                    <Text fontSize="13px" fontWeight={captureMode === "upload" ? "700" : "500"} color={titleColor} fontFamily="'Manrope', sans-serif">
                      Upload Image
                    </Text>
                  </Radio>
                  <Radio value="capture" size="sm" colorScheme="blue">
                    <Text fontSize="13px" fontWeight={captureMode === "capture" ? "700" : "500"} color={titleColor} fontFamily="'Manrope', sans-serif">
                      Capture Photo
                    </Text>
                  </Radio>
                </HStack>
              </RadioGroup>
            </Box>

            {/* Choose File or Camera View */}
            <Box gridColumn={{ sm: "1 / -1" }}>
              {captureMode === "upload" ? (
                <Flex direction="column" gap={3}>
                  <HStack spacing={3} wrap="wrap">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      leftIcon={<FiUpload size={14} />}
                      variant="outline"
                      borderColor={cardBorder}
                      bg={fileBtnBg}
                      color={titleColor}
                      borderRadius="8px"
                      h="36px"
                      px="14px"
                      fontSize="13px"
                      fontWeight="500"
                      fontFamily="'Manrope', sans-serif"
                      _hover={{ bg: "#E2E8F0" }}
                    >
                      Choose File
                    </Button>
                    <Text fontSize="13px" color={subtextColor} fontFamily="'Manrope', sans-serif" noOfLines={1}>
                      {selectedFile ? selectedFile.name : "No file chosen"}
                    </Text>
                  </HStack>
                  {previewUrl && (
                    <Image src={previewUrl} alt="Preview" maxH="180px" objectFit="contain" borderRadius="10px" border="1px solid" borderColor={cardBorder} />
                  )}
                </Flex>
              ) : (
                <Flex direction="column" gap={3} align="flex-start">
                  <canvas ref={canvasRef} style={{ display: "none" }} />
                  {capturedBlob && previewUrl ? (
                    <>
                      <Image src={previewUrl} alt="Captured" maxH="180px" objectFit="contain" borderRadius="10px" border="1px solid" borderColor={cardBorder} />
                      <Button onClick={retake} variant="outline" borderColor={cardBorder} size="sm" fontFamily="'Manrope', sans-serif">
                        Retake
                      </Button>
                    </>
                  ) : (
                    <>
                      <Box borderRadius="10px" overflow="hidden" border="1px solid" borderColor={cardBorder} maxW="360px">
                        <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", display: "block" }} />
                      </Box>
                      <Button onClick={capturePhoto} isDisabled={!isCameraActive} bg={accent} color="white" size="sm" borderRadius="8px" fontFamily="'Manrope', sans-serif" _hover={{ bg: "#315f85" }}>
                        Capture
                      </Button>
                    </>
                  )}
                </Flex>
              )}
            </Box>
          </Grid>

          {/* Register Button */}
          <Flex justify="flex-end" mt={4}>
            <Button
              onClick={handleSubmit}
              isLoading={isSubmitting}
              loadingText="Registering…"
              bg={accent}
              color="white"
              _hover={{ bg: "#315f85" }}
              borderRadius="8px"
              h="38px"
              px="24px"
              fontSize="13px"
              fontWeight="600"
              fontFamily="'Manrope', sans-serif"
            >
              Register
            </Button>
          </Flex>
        </Box>

        {/* Card 4: Registered Faces Table Card */}
        <Box
          w="100%"
          maxW="580px"
          minH={{ md: "139.5px" }}
          p="20px"
          borderRadius="14px"
          borderWidth="1px"
          borderColor={cardBorder}
          borderTop="1px solid"
          borderTopColor={cardBorder}
          bg={cardBg}
          boxShadow={softShadow}
          fontFamily="'Manrope', sans-serif"
        >
          <Box
            borderRadius="10px"
            overflow="hidden"
            border="1px solid"
            borderColor={tableBorderColor}
          >
            <Box overflowX="auto">
              <Table variant="simple" size="sm">
                <Thead bg={tableHeaderBg}>
                  <Tr borderBottom="1px solid" borderColor={tableBorderColor}>
                    <Th sx={thStyle}>Photo</Th>
                    <Th sx={thStyle}>Name</Th>
                    <Th sx={thStyle}>Roll No / Emp ID</Th>
                    <Th sx={thStyle}>Registered Date</Th>
                    <Th sx={thStyle} textAlign="center">Action</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {isLoadingRecords ? (
                    <Tr>
                      <Td colSpan={5} textAlign="center" py={8} borderColor={tableBorderColor}>
                        <Spinner size="md" color={accent} thickness="3px" />
                      </Td>
                    </Tr>
                  ) : records.length === 0 ? (
                    <Tr>
                      <Td colSpan={5} textAlign="center" py={8} color={subtextColor} borderColor={tableBorderColor} fontFamily="'Manrope', sans-serif" fontSize="13px">
                        No faces registered yet.
                      </Td>
                    </Tr>
                  ) : (
                    records.map((record) => (
                      <Tr key={record._id} borderBottom="1px solid" borderColor={tableBorderColor} _hover={{ bg: rowHover }}>
                        {/* Photo */}
                        <Td sx={tdStyle}>
                          <Box
                            w="36px"
                            h="36px"
                            borderRadius="8px"
                            bg={avatarBg}
                            border="1px solid"
                            borderColor={cardBorder}
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            color="#3F77A5"
                            overflow="hidden"
                            cursor={record.image_url ? "pointer" : "default"}
                            onClick={() => record.image_url && handleImageClick(record.image_url)}
                            _hover={record.image_url ? { transform: "scale(1.05)" } : undefined}
                            transition="transform 0.15s ease"
                          >
                            {record.image_url ? (
                              <Image src={record.image_url} alt={record.person_name} w="100%" h="100%" objectFit="cover" />
                            ) : (
                              <FaUser size={15} />
                            )}
                          </Box>
                        </Td>

                        {/* Name */}
                        <Td sx={tdStyle} fontWeight="700" color={titleColor}>
                          {record.person_name}
                        </Td>

                        {/* Roll No / Emp ID */}
                        <Td sx={tdStyle}>
                          {record.roll_no_emp_id || "N/A"}
                        </Td>

                        {/* Registered Date */}
                        <Td sx={tdStyle} whiteSpace="nowrap">
                          {record.created_date ? moment(record.created_date).format("DD-MM-YYYY HH:mm:ss") : "N/A"}
                        </Td>

                        {/* Action */}
                        <Td sx={tdStyle} textAlign="center">
                          <Tooltip label="Delete" hasArrow>
                            <IconButton
                              aria-label="Delete"
                              icon={<FiTrash2 size="13px" />}
                              size="sm"
                              w="30px"
                              h="30px"
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
                              onClick={() => handleDelete(record.person_name)}
                            />
                          </Tooltip>
                        </Td>
                      </Tr>
                    ))
                  )}
                </Tbody>
              </Table>
            </Box>
          </Box>
        </Box>
      </VStack>
    </Box>
  );
};

export default RegisterFace;
