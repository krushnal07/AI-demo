import React, { useState, useEffect } from "react";
import { InfoIcon } from "@chakra-ui/icons";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Tab,
  TabList,
  Tabs,
  Text,
  TabPanel,
  ModalFooter,
  Button,
  Flex,
  IconButton,
  ModalCloseButton,
  TabPanels,
  Input,
  VStack,
  useColorModeValue,
  useToast,
  SimpleGrid,
  Box,
  Tooltip,
} from "@chakra-ui/react";
import {
  sendVerificationForUpdateMobile,
  UpdateName,
  userProfile,
  verifyMobileOtpForChangeMobile,
} from "../../actions/userActions";
import { TbEdit, TbEditOff } from "react-icons/tb";
import { IoCheckmarkOutline } from "react-icons/io5";

function MyProfile({ isOpen, onClose }) {
  const [profileDetails, setProfileDetails] = useState({
    name: "N/A",
    mobile: "N/A",
    email: "N/A",
  });
  const [editedDetails, setEditedDetails] = useState(profileDetails);
  const [fieldBeingEdited, setFieldBeingEdited] = useState("");
  const [nameChanged, setNameChanged] = useState(false);
  const [mobileChanged, setMobileChanged] = useState(false);
  const [verifyModalField, setVerifyModalField] = useState(null);
  const [otp, setOtp] = useState("");

  const toast = useToast();

  // --- Theme Colors ---
  const cardBg = useColorModeValue("#FFFFFF", "#1C222D");
  const cardBorder = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.08)");
  const headingColor = useColorModeValue("#1A2E3D", "#FFFFFF");
  const subtextColor = useColorModeValue("#64748B", "#94A3B8");
  const inputBg = useColorModeValue("#F8FAFC", "#131822");
  const btnHoverBg = useColorModeValue("#F1F5F9", "#252D3A");
  const accentColor = "#3F77A5";

  const showToast = (msg, status) => {
    toast({
      description: msg,
      status: status,
      duration: 3000,
      position: "bottom-center",
      isClosable: true,
    });
  };

  const fetchUserDetails = async () => {
    try {
      const response = await userProfile();
      const user = response?.user;
      if (user) {
        setProfileDetails({
          name: user.name || "N/A",
          mobile: user.mobile || "N/A",
          email: user.email || "N/A",
        });
        setEditedDetails({
          name: user.name || "N/A",
          mobile: user.mobile || "N/A",
          email: user.email || "N/A",
        });
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  };

  useEffect(() => {
    fetchUserDetails();
  }, []);

  const handleEditToggle = (field) => {
    if (fieldBeingEdited === field) {
      setFieldBeingEdited("");
    } else {
      setFieldBeingEdited(field);
    }
  };

  const handleInputChange = (e, field) => {
    const updatedDetails = { ...editedDetails, [field]: e.target.value };
    setEditedDetails(updatedDetails);

    if (field === "name") setNameChanged(updatedDetails.name !== profileDetails.name);
    if (field === "mobile") setMobileChanged(updatedDetails.mobile !== profileDetails.mobile);
  };

  const handleUpdateName = async () => {
    try {
      const response = await UpdateName(editedDetails.name);
      if (response?.status === 200) {
        localStorage.setItem("name", editedDetails.name);
        setProfileDetails((prev) => ({ ...prev, name: editedDetails.name }));
        setFieldBeingEdited("");
        setNameChanged(false);
        showToast(response.data?.data || "Name updated successfully", "success");
      } else {
        showToast(response?.data?.data || "Failed to update name", "error");
      }
    } catch (error) {
      showToast(error.message || "Error updating name", "error");
    }
  };

  const handleVerifyClick = async (field) => {
    try {
      setVerifyModalField(field);
      await sendVerificationForUpdateMobile(editedDetails.mobile);
    } catch (error) {
      console.error("Error sending verification code:", error);
      showToast("Error sending verification code", "error");
    }
  };

  const handleMobileOtpSubmit = async () => {
    try {
      await verifyMobileOtpForChangeMobile(editedDetails.mobile, otp);
      fetchUserDetails();
      closeVerifyModal();
      setFieldBeingEdited("");
      setMobileChanged(false);
      showToast("Mobile number updated successfully", "success");
    } catch (error) {
      console.error("Error verifying mobile OTP:", error);
      showToast("Failed to update mobile number. Please try again.", "error");
    }
  };

  const closeVerifyModal = () => {
    setVerifyModalField(null);
    setOtp("");
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} isCentered size={{ base: "md", md: "xl", lg: "2xl" }}>
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(2px)" />
        <ModalContent
          borderRadius="16px"
          bg={cardBg}
          border="1px solid"
          borderColor={cardBorder}
          boxShadow="0 20px 60px rgba(0, 0, 0, 0.2)"
          overflow="hidden"
          fontFamily="'Manrope', sans-serif"
          mx={4}
        >
          {/* Header */}
          <ModalHeader
            textAlign="left"
            px={{ base: 4, md: 6 }}
            py={{ base: 4, md: 5 }}
            borderBottom="1px solid"
            borderColor={cardBorder}
            fontFamily="'Manrope', sans-serif"
            fontWeight={800}
            fontSize={{ base: "16px", md: "18px" }}
            color={headingColor}
            lineHeight="1.2"
          >
            My Profile
          </ModalHeader>
          <ModalCloseButton
            top="14px"
            right="16px"
            color={subtextColor}
            _hover={{ color: headingColor, bg: btnHoverBg }}
            borderRadius="8px"
          />

          {/* Body */}
          <ModalBody px={{ base: 4, md: 6 }} py={{ base: 4, md: 6 }}>
            <Tabs variant="unstyled">
              <TabList borderBottom="1px solid" borderColor={cardBorder} gap={{ base: "12px", md: "24px" }} mb="20px">
                <Tab
                  p="0 0 10px 0"
                  fontFamily="'Manrope', sans-serif"
                  fontSize={{ base: "12px", md: "13px" }}
                  fontWeight={600}
                  color={subtextColor}
                  _hover={{ color: headingColor }}
                  _selected={{
                    color: accentColor,
                    fontWeight: 700,
                    borderBottom: `2.5px solid ${accentColor}`,
                    mb: "-1px",
                  }}
                >
                  Account
                </Tab>
                <Tab
                  p="0 0 10px 0"
                  fontFamily="'Manrope', sans-serif"
                  fontSize={{ base: "12px", md: "13px" }}
                  fontWeight={600}
                  color={subtextColor}
                  _hover={{ color: headingColor }}
                  _selected={{
                    color: accentColor,
                    fontWeight: 700,
                    borderBottom: `2.5px solid ${accentColor}`,
                    mb: "-1px",
                  }}
                >
                  Access and security
                </Tab>
                <Tab
                  p="0 0 10px 0"
                  fontFamily="'Manrope', sans-serif"
                  fontSize={{ base: "12px", md: "13px" }}
                  fontWeight={600}
                  color={subtextColor}
                  _hover={{ color: headingColor }}
                  _selected={{
                    color: accentColor,
                    fontWeight: 700,
                    borderBottom: `2.5px solid ${accentColor}`,
                    mb: "-1px",
                  }}
                >
                  Notification and email
                </Tab>
              </TabList>

              <TabPanels>
                {/* 1. Account Tab */}
                <TabPanel p="0">
                  <VStack spacing={5} align="stretch">
                    <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={{ base: "14px", sm: "20px" }}>
                      {/* User Name */}
                      <Box>
                        <Flex align="center" justify="space-between" mb="6px">
                          <Text fontFamily="'Manrope', sans-serif" fontSize="12px" fontWeight={600} color={subtextColor}>
                            User name
                          </Text>
                          <IconButton
                            aria-label={fieldBeingEdited === "name" ? "Cancel edit" : "Edit username"}
                            icon={fieldBeingEdited === "name" ? <TbEditOff size="15px" /> : <TbEdit size="15px" />}
                            size="xs"
                            variant="ghost"
                            color={subtextColor}
                            _hover={{ color: headingColor, bg: btnHoverBg }}
                            onClick={() => handleEditToggle("name")}
                          />
                        </Flex>
                        {fieldBeingEdited === "name" ? (
                          <Flex align="center" gap="6px">
                            <Input
                              value={editedDetails.name}
                              onChange={(e) => handleInputChange(e, "name")}
                              size="sm"
                              borderRadius="8px"
                              bg={inputBg}
                              borderWidth="1px"
                              borderColor={cardBorder}
                              fontFamily="'Manrope', sans-serif"
                              fontSize="13px"
                              fontWeight={600}
                              color={headingColor}
                              _focus={{ borderColor: accentColor, boxShadow: `0 0 0 1px ${accentColor}` }}
                            />
                            {nameChanged && (
                              <IconButton
                                aria-label="Save name"
                                icon={<IoCheckmarkOutline size="16px" />}
                                size="sm"
                                colorScheme="green"
                                borderRadius="8px"
                                onClick={handleUpdateName}
                              />
                            )}
                          </Flex>
                        ) : (
                          <Text fontFamily="'Manrope', sans-serif" fontSize="14px" fontWeight={700} color={headingColor}>
                            {profileDetails.name}
                          </Text>
                        )}
                      </Box>

                      {/* Mobile Number */}
                      <Box>
                        <Flex align="center" justify="space-between" mb="6px">
                          <Text fontFamily="'Manrope', sans-serif" fontSize="12px" fontWeight={600} color={subtextColor}>
                            Mobile number
                          </Text>
                          <IconButton
                            aria-label={fieldBeingEdited === "mobile" ? "Cancel edit" : "Edit mobile number"}
                            icon={fieldBeingEdited === "mobile" ? <TbEditOff size="15px" /> : <TbEdit size="15px" />}
                            size="xs"
                            variant="ghost"
                            color={subtextColor}
                            _hover={{ color: headingColor, bg: btnHoverBg }}
                            onClick={() => handleEditToggle("mobile")}
                          />
                        </Flex>
                        {fieldBeingEdited === "mobile" ? (
                          <Flex align="center" gap="6px">
                            <Input
                              value={editedDetails.mobile}
                              onChange={(e) => handleInputChange(e, "mobile")}
                              size="sm"
                              borderRadius="8px"
                              bg={inputBg}
                              borderWidth="1px"
                              borderColor={cardBorder}
                              fontFamily="'Manrope', sans-serif"
                              fontSize="13px"
                              fontWeight={600}
                              color={headingColor}
                              _focus={{ borderColor: accentColor, boxShadow: `0 0 0 1px ${accentColor}` }}
                            />
                            {mobileChanged && (
                              <Button
                                size="sm"
                                colorScheme="blue"
                                bg={accentColor}
                                _hover={{ bg: "#315F86" }}
                                fontFamily="'Manrope', sans-serif"
                                fontSize="12px"
                                fontWeight={700}
                                borderRadius="8px"
                                onClick={() => handleVerifyClick("mobile")}
                              >
                                Verify
                              </Button>
                            )}
                          </Flex>
                        ) : (
                          <Text fontFamily="'Manrope', sans-serif" fontSize="14px" fontWeight={700} color={headingColor}>
                            {profileDetails.mobile}
                          </Text>
                        )}
                      </Box>

                      {/* Email */}
                      <Box>
                        <Flex align="center" justify="space-between" mb="6px">
                          <Text fontFamily="'Manrope', sans-serif" fontSize="12px" fontWeight={600} color={subtextColor}>
                            Email
                          </Text>
                        </Flex>
                        <Text
                          fontFamily="'Manrope', sans-serif"
                          fontSize="14px"
                          fontWeight={700}
                          color={headingColor}
                          wordBreak="break-word"
                        >
                          {profileDetails.email}
                        </Text>
                      </Box>
                    </SimpleGrid>

                    {/* Delete Account Button */}
                    <Flex align="center" pt="16px" borderTop="1px solid" borderColor={cardBorder} gap="6px">
                      <Button
                        variant="link"
                        color="#E53E3E"
                        _hover={{ textDecoration: "underline", color: "#C53030" }}
                        fontFamily="'Manrope', sans-serif"
                        fontWeight={700}
                        fontSize="13px"
                      >
                        Delete Account
                      </Button>
                      <Tooltip label="Account deletion terms and security policies" hasArrow placement="top">
                        <IconButton
                          aria-label="More info"
                          icon={<InfoIcon boxSize="13px" />}
                          size="xs"
                          variant="ghost"
                          color={subtextColor}
                          _hover={{ color: headingColor }}
                        />
                      </Tooltip>
                    </Flex>
                  </VStack>
                </TabPanel>

                {/* 2. Access and Security Tab */}
                <TabPanel p="0">
                  <Box py={4}>
                    <Text fontFamily="'Manrope', sans-serif" fontSize="13px" color={subtextColor}>
                      Access permissions, API keys, and security settings for this account.
                    </Text>
                  </Box>
                </TabPanel>

                {/* 3. Notification and Email Tab */}
                <TabPanel p="0">
                  <Box py={4}>
                    <Text fontFamily="'Manrope', sans-serif" fontSize="13px" color={subtextColor}>
                      Email notification preferences, system alerts, and SMS subscriptions.
                    </Text>
                  </Box>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Verify OTP Modal */}
      <Modal isOpen={!!verifyModalField} onClose={closeVerifyModal} isCentered size="md">
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(2px)" />
        <ModalContent
          borderRadius="16px"
          bg={cardBg}
          border="1px solid"
          borderColor={cardBorder}
          fontFamily="'Manrope', sans-serif"
          p={2}
          mx={4}
        >
          <ModalHeader
            fontFamily="'Manrope', sans-serif"
            fontWeight={800}
            fontSize="16px"
            color={headingColor}
            borderBottom="1px solid"
            borderColor={cardBorder}
            pb={3}
          >
            Verify {verifyModalField === "mobile" ? "Mobile Number" : "Email"}
          </ModalHeader>
          <ModalCloseButton top="14px" right="16px" color={subtextColor} _hover={{ color: headingColor }} />
          <ModalBody py={4}>
            <Text fontFamily="'Manrope', sans-serif" fontSize="13px" color={subtextColor} mb={3}>
              Enter the verification code sent to your{" "}
              {verifyModalField === "mobile" ? "mobile number" : "email"}:
            </Text>
            <Input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Verification Code"
              size="md"
              borderRadius="8px"
              bg={inputBg}
              borderWidth="1px"
              borderColor={cardBorder}
              fontFamily="'Manrope', sans-serif"
              fontSize="13px"
              color={headingColor}
              _focus={{ borderColor: accentColor, boxShadow: `0 0 0 1px ${accentColor}` }}
            />
          </ModalBody>
          <ModalFooter borderTop="1px solid" borderColor={cardBorder} pt={3}>
            <Button
              bg={accentColor}
              color="white"
              _hover={{ bg: "#315F86" }}
              fontFamily="'Manrope', sans-serif"
              fontWeight={700}
              fontSize="13px"
              borderRadius="8px"
              onClick={handleMobileOtpSubmit}
            >
              Submit
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export default MyProfile;
