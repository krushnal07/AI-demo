import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Icon,
  IconButton,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Text,
  Tooltip,
  useColorMode,
  useColorModeValue,
  useToast,
  VStack,
  HStack,
  Badge,
  Spinner,
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import { FaRegEnvelope, FaLock, FaMoon, FaSun, FaKey } from "react-icons/fa6";
import { TbDeviceCctv, TbShieldCheck, TbArrowRight, TbSparkles } from "react-icons/tb";

import { login, sendOtp, verifyOtp, verifytok } from "../actions/userActions";

const Login = () => {
  // --- Form & Auth State ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [isMobileNumber, setIsMobileNumber] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginVisible, setLoginVisible] = useState(false);

  const navigate = useNavigate();
  const toast = useToast();
  const { colorMode, toggleColorMode } = useColorMode();

  // --- Design System Tokens (Unconditionally declared at top per Rules of Hooks) ---
  const pageBg = useColorModeValue("#F4F8FB", "#0A0E17");
  const rightPanelBg = useColorModeValue("#FFFFFF", "#0C131D");
  const headingColor = useColorModeValue("#1A2E3D", "#FFFFFF");
  const subtextColor = useColorModeValue("#64748B", "#94A3B8");
  const inputBg = useColorModeValue("#F3F7FA", "rgba(255, 255, 255, 0.05)");
  const inputBorder = useColorModeValue("#DCE5EE", "rgba(255, 255, 255, 0.12)");
  const inputFocusBorder = "#3F77A5";
  const inputFocusShadow = useColorModeValue(
    "0 0 0 3px rgba(63, 119, 165, 0.18)",
    "0 0 0 3px rgba(63, 119, 165, 0.3)"
  );
  const inputFocusBg = useColorModeValue("#FFFFFF", "rgba(255, 255, 255, 0.08)");
  const iconColor = useColorModeValue("#64748B", "#94A3B8");
  const dividerColor = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.08)");

  const headerLogoSrc = useColorModeValue("/images/vmukti_light.png", "/images/vmukti.png");

  const themeToggleBg = useColorModeValue("#FFFFFF", "rgba(255, 255, 255, 0.06)");
  const themeToggleBorder = useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.12)");
  const themeToggleHoverBg = useColorModeValue("#F1F5F9", "rgba(255, 255, 255, 0.12)");
  const themeToggleColor = useColorModeValue("#475569", "#CBD5E1");

  const brandPanelBg = useColorModeValue(
    "linear-gradient(155deg, #0F2232 0%, #17324A 45%, #224768 100%)",
    "linear-gradient(155deg, #091520 0%, #0F2233 45%, #18334D 100%)"
  );
  const brandFeatureBg = "rgba(255, 255, 255, 0.06)";
  const brandFeatureBorder = "rgba(255, 255, 255, 0.1)";

  const errorBannerBg = useColorModeValue("red.50", "rgba(239, 68, 68, 0.12)");
  const errorBannerBorder = useColorModeValue("red.200", "rgba(239, 68, 68, 0.3)");
  const errorBannerColor = useColorModeValue("red.600", "red.300");

  const btnGradient = "linear-gradient(135deg, #3F77A5 0%, #2A5880 100%)";
  const btnHoverGradient = "linear-gradient(135deg, #35678F 0%, #21486B 100%)";
  const btnShadow = "0 4px 14px rgba(63, 119, 165, 0.32)";

  const showToast = (msg, status) => {
    toast({
      description: msg,
      status: status,
      duration: 3000,
      position: "bottom-left",
      isClosable: true,
    });
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setEmail(value.toLowerCase());

    const mobileRegex = /^[6-9]\d{9}$/;
    setIsMobileNumber(mobileRegex.test(value));
    setIsOtpSent(false);
  };

  const handleSendOtp = async () => {
    try {
      setIsLoading(true);
      const sendOtpResult = await sendOtp(email);
      if (sendOtpResult && sendOtpResult.success) {
        showToast("OTP sent successfully", "success");
        setIsOtpSent(true);
      } else {
        setErrorMessage("Failed to send OTP. Please try again.");
        showToast("Failed to send OTP", "error");
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      setErrorMessage("Failed to send OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      setIsLoading(true);
      const verifyResult = await verifyOtp(email, otp);
      if (verifyResult && verifyResult.success) {
        localStorage.setItem("name", verifyResult.name);
        localStorage.setItem("email", verifyResult.email);
        navigate("/dash");
        showToast("OTP verified successfully. Logging in...", "success");
      } else {
        setErrorMessage("Invalid OTP. Please try again.");
        showToast("Invalid OTP", "error");
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      setErrorMessage("Failed to verify OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || (!password && !isMobileNumber)) {
      setErrorMessage("Please enter all required fields.");
      return;
    }

    try {
      setErrorMessage("");
      setIsLoading(true);

      const loginResult = await login(email, password);
      if (loginResult && loginResult.success) {
        navigate("/dash");
        showToast("Logged in Successfully", "success");
        localStorage.setItem("name", loginResult.name);
        localStorage.setItem("email", loginResult.email);
        localStorage.setItem("role", loginResult.role);
      } else {
        const errorMsg = (loginResult && loginResult.data) || "Login failed. Please check your credentials.";
        setErrorMessage(errorMsg);
        showToast(errorMsg, "error");
      }
    } catch (error) {
      setErrorMessage("Failed to login. Please try again.");
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const checkLoginStatus = async () => {
      try {
        const verifyTok = await verifytok();
        if (verifyTok === null) {
          if (isMounted) setLoginVisible(true);
        } else {
          navigate("/dash");
        }
      } catch (err) {
        if (isMounted) setLoginVisible(true);
      }
    };

    checkLoginStatus();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  if (!loginVisible) {
    return (
      <Flex h="100vh" w="100vw" align="center" justify="center" bg={pageBg}>
        <Spinner size="xl" color="#3F77A5" thickness="4px" speed="0.75s" />
      </Flex>
    );
  }

  return (
    <Flex
      h="100vh"
      maxH="100vh"
      w="100%"
      maxW="100%"
      bg={pageBg}
      position="relative"
      fontFamily="'Manrope', -apple-system, BlinkMacSystemFont, sans-serif"
      overflow="hidden"
      overflowX="hidden"
      overflowY="hidden"
      direction={{ base: "column", md: "row" }}
    >
      {/* ============================================================ */}
      {/* 1. LEFT HALF: Full-Screen Enterprise Showcase (Desktop)      */}
      {/* ============================================================ */}
      <Flex
        direction="column"
        justify="space-between"
        w={{ base: "100%", md: "48%", lg: "50%", xl: "50%" }}
        h={{ base: "auto", md: "100vh" }}
        p={{ base: 8, md: 10, lg: 12, xl: 16 }}
        bgGradient={brandPanelBg}
        color="white"
        position="relative"
        overflow="hidden"
        display={{ base: "none", md: "flex" }}
      >
        {/* Ambient atmospheric glows */}
        <Box
          position="absolute"
          top="-100px"
          right="-100px"
          w="360px"
          h="360px"
          borderRadius="full"
          bg="rgba(63, 119, 165, 0.28)"
          filter="blur(80px)"
          pointerEvents="none"
        />
        <Box
          position="absolute"
          bottom="-80px"
          left="-80px"
          w="320px"
          h="320px"
          borderRadius="full"
          bg="rgba(42, 88, 128, 0.22)"
          filter="blur(70px)"
          pointerEvents="none"
        />

        {/* Top Header: Official VMukti Wordmark + Live Status Badge */}
        <Box zIndex={2}>
          <Flex align="center" gap={4} mb={3.5}>
            <Image
              src="/images/vmukti.png"
              alt="VMukti Logo"
              h={{ md: "34px", lg: "38px" }}
              objectFit="contain"
            />
          </Flex>

          <Badge
            px={3}
            py={1}
            borderRadius="full"
            bg="rgba(255, 255, 255, 0.1)"
            border="1px solid rgba(255, 255, 255, 0.18)"
            color="#6EE7B7"
            fontSize="11px"
            fontWeight="700"
            letterSpacing="0.8px"
            fontFamily="'Manrope', sans-serif"
            display="inline-flex"
            alignItems="center"
            gap={2}
          >
            <Box w="6px" h="6px" borderRadius="full" bg="#10B981" boxShadow="0 0 8px #10B981" />
            LIVE ENTERPRISE VMS PLATFORM
          </Badge>
        </Box>

        {/* Middle: Hero Title + Feature Cockpit Cards */}
        <Box zIndex={2} my="auto" py={{ md: 4, lg: 6 }}>
          <Heading
            fontSize={{ md: "24px", lg: "28px", xl: "32px" }}
            fontWeight="800"
            color="#FFFFFF"
            fontFamily="'Manrope', sans-serif"
            lineHeight="1.25"
            letterSpacing="-0.5px"
            mb={2.5}
          >
            Intelligent Video Surveillance & Live AI Analytics
          </Heading>
          <Text
            fontSize={{ md: "13px", lg: "13.5px" }}
            color="rgba(255, 255, 255, 0.72)"
            fontFamily="'Manrope', sans-serif"
            lineHeight="1.5"
            maxW="460px"
            mb={{ md: 5, lg: 6 }}
          >
            High-performance CCTV management with low-latency streaming, automated anomaly detection, and deep forensic reporting.
          </Text>

          <VStack spacing={{ md: 2.5, lg: 3 }} align="stretch">
            <Flex
              align="center"
              gap={3.5}
              p={{ md: "11px 15px", lg: "13px 16px" }}
              borderRadius="12px"
              bg={brandFeatureBg}
              border="1px solid"
              borderColor={brandFeatureBorder}
              backdropFilter="blur(10px)"
              transition="all 0.2s ease"
              _hover={{ bg: "rgba(255, 255, 255, 0.09)", transform: "translateX(3px)" }}
            >
              <Flex
                w="40px"
                h="40px"
                minW="40px"
                borderRadius="10px"
                bg="rgba(63, 119, 165, 0.3)"
                color="#7EC1E8"
                align="center"
                justify="center"
              >
                <Icon as={TbDeviceCctv} boxSize="20px" />
              </Flex>
              <Box>
                <Text fontSize={{ md: "13px", lg: "14px" }} fontWeight="700" color="#FFFFFF" fontFamily="'Manrope', sans-serif" lineHeight="1.3">
                  Multi-Camera Live Grid
                </Text>
                <Text fontSize={{ md: "11px", lg: "12px" }} color="rgba(255, 255, 255, 0.7)" fontFamily="'Manrope', sans-serif" lineHeight="1.3">
                  Ultra-low latency RTSP / WebRTC camera grid & PTZ controls
                </Text>
              </Box>
            </Flex>

            <Flex
              align="center"
              gap={3.5}
              p={{ md: "11px 15px", lg: "13px 16px" }}
              borderRadius="12px"
              bg={brandFeatureBg}
              border="1px solid"
              borderColor={brandFeatureBorder}
              backdropFilter="blur(10px)"
              transition="all 0.2s ease"
              _hover={{ bg: "rgba(255, 255, 255, 0.09)", transform: "translateX(3px)" }}
            >
              <Flex
                w="40px"
                h="40px"
                minW="40px"
                borderRadius="10px"
                bg="rgba(245, 158, 11, 0.22)"
                color="#FBBF24"
                align="center"
                justify="center"
              >
                <Icon as={TbSparkles} boxSize="20px" />
              </Flex>
              <Box>
                <Text fontSize={{ md: "13px", lg: "14px" }} fontWeight="700" color="#FFFFFF" fontFamily="'Manrope', sans-serif" lineHeight="1.3">
                  AI Vision Intelligence
                </Text>
                <Text fontSize={{ md: "11px", lg: "12px" }} color="rgba(255, 255, 255, 0.7)" fontFamily="'Manrope', sans-serif" lineHeight="1.3">
                  Intrusion, facial recognition, crowd monitoring & ANPR alerts
                </Text>
              </Box>
            </Flex>

            <Flex
              align="center"
              gap={3.5}
              p={{ md: "11px 15px", lg: "13px 16px" }}
              borderRadius="12px"
              bg={brandFeatureBg}
              border="1px solid"
              borderColor={brandFeatureBorder}
              backdropFilter="blur(10px)"
              transition="all 0.2s ease"
              _hover={{ bg: "rgba(255, 255, 255, 0.09)", transform: "translateX(3px)" }}
            >
              <Flex
                w="40px"
                h="40px"
                minW="40px"
                borderRadius="10px"
                bg="rgba(16, 185, 129, 0.22)"
                color="#6EE7B7"
                align="center"
                justify="center"
              >
                <Icon as={TbShieldCheck} boxSize="20px" />
              </Flex>
              <Box>
                <Text fontSize={{ md: "13px", lg: "14px" }} fontWeight="700" color="#FFFFFF" fontFamily="'Manrope', sans-serif" lineHeight="1.3">
                  Forensic Security & Audits
                </Text>
                <Text fontSize={{ md: "11px", lg: "12px" }} color="rgba(255, 255, 255, 0.7)" fontFamily="'Manrope', sans-serif" lineHeight="1.3">
                  Corridor analytics, incident investigation & tamper detection
                </Text>
              </Box>
            </Flex>
          </VStack>
        </Box>

        {/* Bottom Tagline */}
        <Box zIndex={2}>
          <Text fontSize={{ md: "11px", lg: "12px" }} color="rgba(255, 255, 255, 0.65)" fontFamily="'Manrope', sans-serif" lineHeight="1.4">
            VMukti Electra VMS v2.4 • Enterprise Cloud & Edge Surveillance Infrastructure
          </Text>
        </Box>
      </Flex>

      {/* ============================================================ */}
      {/* 2. RIGHT HALF: Full-Screen Authentication Surface             */}
      {/* ============================================================ */}
      <Flex
        direction="column"
        justify="space-between"
        w={{ base: "100%", md: "52%", lg: "50%", xl: "50%" }}
        h={{ base: "auto", md: "100vh" }}
        minH={{ base: "100vh", md: "100vh" }}
        p={{ base: 6, sm: 10, md: 10, lg: 12, xl: 16 }}
        position="relative"
        bg={rightPanelBg}
        overflowY={{ base: "auto", md: "hidden" }}
      >
        {/* Top Header Row: Mobile Brand Logo (Left) & Theme Toggle (Right) */}
        <Flex align="center" justify="space-between" w="100%" mb={{ base: 6, md: 0 }}>
          <Image
            src={headerLogoSrc}
            alt="VMukti"
            h={{ base: "30px", md: "34px" }}
            objectFit="contain"
            display={{ base: "block", md: "none" }}
          />

          {/* Theme Toggle Button */}
          <Box ml="auto">
            <Tooltip
              label={colorMode === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
              hasArrow
              placement="left"
            >
              <IconButton
                aria-label="Toggle theme mode"
                icon={colorMode === "light" ? <FaMoon size={15} /> : <FaSun size={15} />}
                onClick={toggleColorMode}
                size="sm"
                variant="ghost"
                borderRadius="10px"
                w="38px"
                h="38px"
                border="1px solid"
                borderColor={themeToggleBorder}
                bg={themeToggleBg}
                color={themeToggleColor}
                _hover={{
                  bg: themeToggleHoverBg,
                  color: "#3F77A5",
                  borderColor: "#3F77A5",
                }}
                transition="all 0.2s ease"
              />
            </Tooltip>
          </Box>
        </Flex>

        {/* Center: Centered Authentication Form */}
        <Box
          my="auto"
          w="100%"
          maxW={{ base: "100%", sm: "400px", md: "420px", lg: "440px" }}
          mx="auto"
          py={{ base: 4, md: 6 }}
          fontFamily="'Manrope', sans-serif"
        >
          {/* Heading */}
          <Box mb={{ base: 6, md: 7 }}>
            <Heading
              as="h1"
              fontSize={{ base: "26px", md: "28px", lg: "32px" }}
              fontWeight="800"
              color={headingColor}
              fontFamily="'Manrope', sans-serif"
              letterSpacing="-0.5px"
            >
              Welcome back
            </Heading>
            <Text
              fontSize={{ base: "13.5px", md: "14px" }}
              color={subtextColor}
              fontFamily="'Manrope', sans-serif"
              mt={1.5}
            >
              Sign in to your account to access the surveillance console
            </Text>
          </Box>

          {/* Form */}
          <form onSubmit={handleLogin}>
            <VStack spacing={4} align="stretch">
              {/* Email / Mobile Field */}
              <FormControl id="login-identifier" isRequired>
                <FormLabel
                  fontSize="13px"
                  fontWeight="600"
                  color={headingColor}
                  fontFamily="'Manrope', sans-serif"
                  mb={1.5}
                >
                  Email ID or Registered Mobile <Box as="span" color="#EF4444">*</Box>
                </FormLabel>
                <InputGroup size="md">
                  <InputLeftElement pointerEvents="none" color={iconColor} h="46px">
                    <FaRegEnvelope size={14} />
                  </InputLeftElement>
                  <Input
                    type="text"
                    placeholder="e.g. user@vmukti.com or 9876543210"
                    value={email}
                    onChange={handleInputChange}
                    borderRadius="10px"
                    h="46px"
                    fontSize="14px"
                    fontFamily="'Manrope', sans-serif"
                    bg={inputBg}
                    borderColor={inputBorder}
                    color={headingColor}
                    _placeholder={{ color: subtextColor, fontSize: "13px" }}
                    _hover={{ borderColor: inputFocusBorder }}
                    _focus={{
                      borderColor: inputFocusBorder,
                      boxShadow: inputFocusShadow,
                      bg: inputFocusBg,
                    }}
                  />
                </InputGroup>
              </FormControl>

              {/* Password / OTP Field */}
              {isMobileNumber && isOtpSent ? (
                <FormControl id="login-otp" isRequired>
                  <Flex justify="space-between" align="center" mb={1.5}>
                    <FormLabel
                      fontSize="13px"
                      fontWeight="600"
                      color={headingColor}
                      fontFamily="'Manrope', sans-serif"
                      m={0}
                    >
                      Enter 6-digit OTP <Box as="span" color="#EF4444">*</Box>
                    </FormLabel>
                    <Button
                      variant="link"
                      size="xs"
                      color="#3F77A5"
                      fontWeight="600"
                      fontFamily="'Manrope', sans-serif"
                      _hover={{ color: "#2A5880", textDecoration: "underline" }}
                      onClick={handleSendOtp}
                      isDisabled={isLoading}
                    >
                      Resend OTP
                    </Button>
                  </Flex>
                  <InputGroup size="md">
                    <InputLeftElement pointerEvents="none" color={iconColor} h="46px">
                      <FaKey size={13} />
                    </InputLeftElement>
                    <Input
                      type="text"
                      placeholder="Enter the received OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      borderRadius="10px"
                      h="46px"
                      fontSize="14px"
                      fontFamily="'Manrope', sans-serif"
                      bg={inputBg}
                      borderColor={inputBorder}
                      color={headingColor}
                      _placeholder={{ color: subtextColor, fontSize: "13px" }}
                      _hover={{ borderColor: inputFocusBorder }}
                      _focus={{
                        borderColor: inputFocusBorder,
                        boxShadow: inputFocusShadow,
                        bg: inputFocusBg,
                      }}
                    />
                  </InputGroup>
                </FormControl>
              ) : (
                <FormControl id="login-password" isRequired={!isMobileNumber}>
                  <Flex justify="space-between" align="center" mb={1.5}>
                    <FormLabel
                      fontSize="13px"
                      fontWeight="600"
                      color={headingColor}
                      fontFamily="'Manrope', sans-serif"
                      m={0}
                    >
                      Password <Box as="span" color="#EF4444">*</Box>
                    </FormLabel>
                    {isMobileNumber && (
                      <Button
                        variant="link"
                        size="xs"
                        color="#3F77A5"
                        fontWeight="600"
                        fontFamily="'Manrope', sans-serif"
                        _hover={{ color: "#2A5880", textDecoration: "underline" }}
                        onClick={handleSendOtp}
                        isLoading={isLoading}
                      >
                        Login with OTP instead
                      </Button>
                    )}
                  </Flex>
                  <InputGroup size="md">
                    <InputLeftElement pointerEvents="none" color={iconColor} h="46px">
                      <FaLock size={13} />
                    </InputLeftElement>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your account password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      borderRadius="10px"
                      h="46px"
                      fontSize="14px"
                      fontFamily="'Manrope', sans-serif"
                      bg={inputBg}
                      borderColor={inputBorder}
                      color={headingColor}
                      _placeholder={{ color: subtextColor, fontSize: "13px" }}
                      _hover={{ borderColor: inputFocusBorder }}
                      _focus={{
                        borderColor: inputFocusBorder,
                        boxShadow: inputFocusShadow,
                        bg: inputFocusBg,
                      }}
                    />
                    <InputRightElement h="46px">
                      <IconButton
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                        variant="ghost"
                        size="sm"
                        borderRadius="8px"
                        color={iconColor}
                        _hover={{ bg: "transparent", color: headingColor }}
                        onClick={() => setShowPassword((prev) => !prev)}
                      />
                    </InputRightElement>
                  </InputGroup>
                </FormControl>
              )}

              {/* Error Banner */}
              {errorMessage && (
                <Box
                  p="10px 14px"
                  borderRadius="10px"
                  bg={errorBannerBg}
                  border="1px solid"
                  borderColor={errorBannerBorder}
                  color={errorBannerColor}
                  fontSize="13px"
                  fontWeight="500"
                  fontFamily="'Manrope', sans-serif"
                  lineHeight="1.35"
                >
                  {errorMessage}
                </Box>
              )}

              {/* Submit Action Button */}
              {isMobileNumber && isOtpSent ? (
                <Button
                  type="button"
                  onClick={handleVerifyOtp}
                  w="100%"
                  h="48px"
                  mt={2}
                  borderRadius="10px"
                  bgGradient={btnGradient}
                  color="white"
                  fontWeight="600"
                  fontSize="15px"
                  fontFamily="'Manrope', sans-serif"
                  letterSpacing="0.2px"
                  isLoading={isLoading}
                  loadingText="Verifying OTP..."
                  rightIcon={<TbArrowRight size={17} />}
                  boxShadow={btnShadow}
                  _hover={{
                    bgGradient: btnHoverGradient,
                    transform: "translateY(-1px)",
                    boxShadow: "0 6px 18px rgba(63, 119, 165, 0.4)",
                  }}
                  _active={{ transform: "translateY(0)" }}
                  transition="all 0.2s ease"
                >
                  Verify & Access VMS
                </Button>
              ) : (
                <Button
                  type="submit"
                  w="100%"
                  h="48px"
                  mt={2}
                  borderRadius="10px"
                  bgGradient={btnGradient}
                  color="white"
                  fontWeight="600"
                  fontSize="15px"
                  fontFamily="'Manrope', sans-serif"
                  letterSpacing="0.2px"
                  isLoading={isLoading}
                  loadingText="Signing in..."
                  rightIcon={<TbArrowRight size={17} />}
                  boxShadow={btnShadow}
                  _hover={{
                    bgGradient: btnHoverGradient,
                    transform: "translateY(-1px)",
                    boxShadow: "0 6px 18px rgba(63, 119, 165, 0.4)",
                  }}
                  _active={{ transform: "translateY(0)" }}
                  transition="all 0.2s ease"
                >
                  Sign In to Portal
                </Button>
              )}
            </VStack>
          </form>

          {/* Compliance Notice */}
          <Box
            mt={6}
            pt={4}
            borderTop="1px solid"
            borderColor={dividerColor}
            textAlign="center"
          >
            <HStack spacing={1.5} justify="center" color={subtextColor} mb={0.5}>
              <Icon as={TbShieldCheck} boxSize="15px" color="#3F77A5" />
              <Text fontSize="12px" fontWeight="600" color={headingColor} fontFamily="'Manrope', sans-serif">
                Authorized Personnel Only
              </Text>
            </HStack>
            <Text fontSize="11px" color={subtextColor} lineHeight="1.3" fontFamily="'Manrope', sans-serif">
              Unauthorized access is strictly prohibited and actively audited.
            </Text>
          </Box>
        </Box>

        {/* Bottom Row: Footer Copyright */}
        <Flex w="100%" justify="center" pt={4}>
          <Text fontSize="11.5px" color={subtextColor} textAlign="center" fontFamily="'Manrope', sans-serif">
            © {new Date().getFullYear()} VMukti Electra VMS. All rights reserved.
          </Text>
        </Flex>
      </Flex>
    </Flex>
  );
};

export default Login;
