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
  Grid,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableContainer,
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
} from "@chakra-ui/react";
import { FaTrash } from "react-icons/fa";
import Swal from "sweetalert2";
import moment from "moment";
import { registerFace, getRegisteredFaces, deleteFace } from "../actions/faceActions";

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
  const toast = useToast();

  const pageHeading = useColorModeValue("gray.800", "white");
  const subText = useColorModeValue("gray.500", "gray.400");
  const cardBg = useColorModeValue("#FFFFFF", "gray.800");
  const cardBorder = useColorModeValue("rgba(226,232,240,0.9)", "whiteAlpha.200");
  const softShadow = useColorModeValue("0 1px 3px rgba(0,0,0,0.06)", "dark-lg");
  const inputBg = useColorModeValue("white", "gray.700");
  const accent = useColorModeValue("#3F77A5", "#63B3ED");
  const tableHeadBg = useColorModeValue("#F1F5F9", "gray.700");
  const rowHover = useColorModeValue("gray.50", "whiteAlpha.100");

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
    <Box maxW="1200px" mx="auto" pt={{ base: "70px", md: "0" }} mb={{ base: "100px", md: "6" }} px={{ base: 3, md: 0 }}>
      <Modal isOpen={isOpen} onClose={onClose} isCentered size="2xl">
        <ModalOverlay bg="blackAlpha.700" />
        <ModalContent bg={cardBg} borderRadius="16px" overflow="hidden">
          <ModalCloseButton zIndex={2} />
          <ModalBody display="flex" justifyContent="center" alignItems="center" p={4}>
            <Image src={modalImage} alt="Enlarged view" maxW="100%" maxH="80vh" borderRadius="10px" />
          </ModalBody>
        </ModalContent>
      </Modal>

      <Box mb={5}>
        <Text fontWeight={700} fontSize="28px" color={pageHeading} lineHeight="1.2">
          Register Face
        </Text>
        <Text fontSize="14px" color={subText}>
          Upload or capture a photo to register a person for facial recognition
        </Text>
      </Box>

      <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" boxShadow={softShadow} p={4} mb={5}>
        <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
          <Box>
            <Text fontSize="12px" fontWeight="600" color={subText} mb={1.5} textTransform="uppercase" letterSpacing="0.05em">
              Name
            </Text>
            <Input value={name} onChange={(e) => setName(e.target.value)} bg={inputBg} borderColor={cardBorder} borderRadius="10px" placeholder="Enter person's name" />
          </Box>
          <Box>
            <Text fontSize="12px" fontWeight="600" color={subText} mb={1.5} textTransform="uppercase" letterSpacing="0.05em">
              Roll No / Emp ID (optional)
            </Text>
            <Input value={rollNoEmpId} onChange={(e) => setRollNoEmpId(e.target.value)} bg={inputBg} borderColor={cardBorder} borderRadius="10px" placeholder="Enter roll no or employee id" />
          </Box>

          <Box gridColumn={{ md: "1 / -1" }}>
            <Text fontSize="12px" fontWeight="600" color={subText} mb={1.5} textTransform="uppercase" letterSpacing="0.05em">
              Photo Source
            </Text>
            <RadioGroup value={captureMode} onChange={handleModeChange}>
              <HStack spacing={6}>
                <Radio value="upload">Upload Image</Radio>
                <Radio value="capture">Capture Photo</Radio>
              </HStack>
            </RadioGroup>
          </Box>

          <Box gridColumn={{ md: "1 / -1" }}>
            {captureMode === "upload" ? (
              <Flex direction="column" gap={3}>
                <Input type="file" accept="image/*" onChange={handleFileChange} bg={inputBg} borderColor={cardBorder} borderRadius="10px" p={1.5} />
                {previewUrl && (
                  <Image src={previewUrl} alt="Preview" maxH="200px" borderRadius="10px" border="1px solid" borderColor={cardBorder} />
                )}
              </Flex>
            ) : (
              <Flex direction="column" gap={3} align="flex-start">
                <canvas ref={canvasRef} style={{ display: "none" }} />
                {capturedBlob && previewUrl ? (
                  <>
                    <Image src={previewUrl} alt="Captured" maxH="240px" borderRadius="10px" border="1px solid" borderColor={cardBorder} />
                    <Button onClick={retake} variant="outline" borderColor={cardBorder} size="sm">
                      Retake
                    </Button>
                  </>
                ) : (
                  <>
                    <Box borderRadius="10px" overflow="hidden" border="1px solid" borderColor={cardBorder} maxW="360px">
                      <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", display: "block" }} />
                    </Box>
                    <Button onClick={capturePhoto} isDisabled={!isCameraActive} bg={accent} color="white" size="sm" _hover={{ opacity: 0.9 }}>
                      Capture
                    </Button>
                  </>
                )}
              </Flex>
            )}
          </Box>
        </Grid>

        <Flex justify="flex-end" mt={4}>
          <Button onClick={handleSubmit} isLoading={isSubmitting} loadingText="Registering…" bg={accent} color="white" _hover={{ opacity: 0.9 }} borderRadius="10px">
            Register
          </Button>
        </Flex>
      </Box>

      <Box bg={cardBg} border="1px solid" borderColor={cardBorder} borderRadius="16px" boxShadow={softShadow} overflow="hidden">
        <TableContainer overflowX="auto">
          <Table size="sm">
            <Thead bg={tableHeadBg}>
              <Tr>
                <Th sx={thStyle}>Photo</Th>
                <Th sx={thStyle}>Name</Th>
                <Th sx={thStyle}>Roll No / Emp ID</Th>
                <Th sx={thStyle}>Registered Date</Th>
                <Th sx={thStyle}>Action</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoadingRecords ? (
                <Tr>
                  <Td colSpan={5} textAlign="center" py={10} borderColor={cardBorder}>
                    <Spinner size="lg" color={accent} thickness="3px" />
                  </Td>
                </Tr>
              ) : records.length === 0 ? (
                <Tr>
                  <Td colSpan={5} textAlign="center" py={10} color={subText} borderColor={cardBorder}>
                    No faces registered yet.
                  </Td>
                </Tr>
              ) : (
                records.map((record) => (
                  <Tr key={record._id} _hover={{ bg: rowHover }}>
                    <Td sx={tdStyle}>
                      <Image
                        src={record.image_url}
                        alt={record.person_name}
                        boxSize="50px"
                        objectFit="cover"
                        borderRadius="8px"
                        cursor="pointer"
                        mx="auto"
                        transition="transform 0.2s ease"
                        _hover={{ transform: "scale(1.08)" }}
                        onClick={() => handleImageClick(record.image_url)}
                        fallbackSrc="https://via.placeholder.com/50?text=—"
                      />
                    </Td>
                    <Td sx={tdStyle}>{record.person_name}</Td>
                    <Td sx={tdStyle}>{record.roll_no_emp_id || "N/A"}</Td>
                    <Td sx={tdStyle}>{record.created_date ? moment(record.created_date).format("DD-MM-YYYY HH:mm:ss") : "N/A"}</Td>
                    <Td sx={tdStyle}>
                      <IconButton
                        icon={<FaTrash />}
                        aria-label="Delete"
                        size="sm"
                        colorScheme="red"
                        variant="ghost"
                        onClick={() => handleDelete(record.person_name)}
                      />
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};

export default RegisterFace;
