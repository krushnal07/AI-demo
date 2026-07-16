import {
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  Grid,
  Heading,
  Icon,
  IconButton,
  Image,
  Input,
  InputGroup,
  InputRightElement,
  InputLeftElement,
  Text,
  useColorMode,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import { login, sendOtp, verifyOtp } from "../actions/userActions";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ViewIcon, ViewOffIcon } from "@chakra-ui/icons";
import { verifytok } from "../actions/userActions";
import { BsCameraVideoFill } from "react-icons/bs";
import { FaRegEnvelope, FaLock } from "react-icons/fa6";
// import { registerPushNotifications } from '../actions/notification';
// import io from 'socket.io-client';

const Login = () => {
  const [email, setEmail] = useState(""); // Unified field for email or mobile
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [isMobileNumber, setIsMobileNumber] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const bgColor = useColorModeValue("custom.primary", "custom.darkModePrimary");
  const { colorMode } = useColorMode();

  const textColor = useColorModeValue(
    "custom.lightModeText",
    "custom.darkModeText"
  );
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
    setEmail(value.toLowerCase()); // Convert to lowercase

    // Check if the input is a mobile number
    const mobileRegex = /^[6-9]\d{9}$/;
    setIsMobileNumber(mobileRegex.test(value));
    setIsOtpSent(false); // Reset OTP sent status when input changes
  };

  const handleSendOtp = async () => {
    try {
      setIsLoading(true);
      const sendOtpResult = await sendOtp(email); // Assuming the sendOtp function exists
      if (sendOtpResult.success) {
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
      console.log("Email:", email, otp);
      const verifyResult = await verifyOtp(email, otp); // Assuming the verifyOtp function exists
      if (verifyResult.success) {
        localStorage.setItem("name", verifyResult.name);
        localStorage.setItem("email", verifyResult.email);
        // Perform any login redirection logic
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
    e.preventDefault(); // Prevent default form submission
    console.log("Logging in with:", { email, password, isMobileNumber });
    if (!email || (!password && !isMobileNumber)) {
      setErrorMessage("Please enter all required fields.");
      return;
    }

    try {
      setErrorMessage("");
      setIsLoading(true); // Show loader during login

      const loginResult = await login(email, password);
      console.log("Login result:", loginResult);
      if (loginResult.success) {
        // localStorage.setItem('email', loginResult.user.email);
        navigate("/dash");
        showToast("Logged in Successfully", "success");
        localStorage.setItem("name", loginResult.name);
        localStorage.setItem("email", loginResult.email);
        localStorage.setItem("role", loginResult.role);
        // registerPushNotifications();
        // socket.on('notification', (data) => {
        //   setNotifications((prev) => [...prev, data]);
        // });
      } else {
        setErrorMessage(loginResult.data);
        showToast(loginResult.data, "error");
      }
    } catch (error) {
      setErrorMessage("Failed to login. Please try again.");
      console.error("Error:", error);
    } finally {
      setIsLoading(false); // Hide loader
    }
  };

  const [loginVisible, setLoginVisible] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  useEffect(() => {
    const checkLoginStatus = async () => {
      // Verify token
      const verifyTok = await verifytok();
      // console.log(verifyTok);

      // Handle token verification result
      if (verifyTok === null) {
        setLoginVisible(true);
      } else {
        navigate("/dash");
      }
    };

    checkLoginStatus();
    // Check for small screen based on window height
    function handleResize() {
      setIsSmallScreen(window.innerHeight < 676);
    }

    // Add event listener for window resize
    window.addEventListener("resize", handleResize);

    // Initial check
    handleResize();

    // Cleanup the event listener when the component unmounts
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const btnBg = useColorModeValue(
    "linear-gradient(94deg, #9CBAD2 0.56%, #CDDEEB 94.58%)",
    "black"
  );

  const btnHoverBg = useColorModeValue(
    "linear-gradient(94deg, #7DA5C4 0.56%, #AFCBE0 94.58%)",
    "#1a1a1a"
  );

  const btnTextColor = useColorModeValue(
    "black",
    "white"
  );

  // --- Professional theme tokens ---
  const cardBg = useColorModeValue("rgba(255,255,255,0.88)", "rgba(18,18,18,0.82)");
  const cardBorder = useColorModeValue("rgba(255,255,255,0.6)", "whiteAlpha.200");
  const headingColor = useColorModeValue("gray.800", "white");
  const subColor = useColorModeValue("gray.500", "gray.400");
  const inputBorder = useColorModeValue("gray.300", "whiteAlpha.300");
  const iconColor = useColorModeValue("gray.400", "gray.500");
  const inputFieldBg = useColorModeValue("white", "whiteAlpha.100");
  const accentBtn = "linear-gradient(94deg, #1C4ED8 0%, #3F77A5 100%)";
  // Mode-aware VMukti logo (light logo for light bg, white logo for dark bg)
  const loginLogo = useColorModeValue("/images/vmukti_light.png", "/images/vmukti.png");


  return (
    <Flex
      position="relative"
      h="100vh"
      w="100%"
      alignItems="center"
      justify="center"
    >

      {colorMode === "light" ? (
        <Image
          src="/images/background_img_light.png"
          position="absolute"
          top="0"
          left="0"
          w="100%"
          h="100%"
          objectFit="cover"
          zIndex={0}
        />
      ) : (<Image
        src="/images/background_img.png"
        position="absolute"
        top="0"
        left="0"
        w="100%"
        h="100%"
        objectFit="cover"
        zIndex={0}
      />)}

      {/* VMukti logo — top-left corner (both light & dark mode) */}
      <Image
        src={loginLogo}
        alt="VMukti"
        position="absolute"
        top={{ base: 4, md: 6 }}
        left={{ base: 4, md: 8 }}
        h={{ base: "26px", md: "36px" }}
        objectFit="contain"
        zIndex={2}
      />

      <Flex
        zIndex={1}
        w={{ base: "94%", md: "auto" }}
        maxW="960px"
        borderRadius="24px"
        overflow="hidden"
        boxShadow="0 24px 60px rgba(0,0,0,0.35)"
        border="1px solid"
        borderColor={cardBorder}
        bg={cardBg}
        backdropFilter="blur(24px)"
        direction={{ base: "column", md: "row" }}
      >
        {/* LEFT — Brand panel */}
        <Flex
          direction="column"
          justify="space-between"
          w={{ md: "44%" }}
          p={10}
          display={{ base: "none", md: "flex" }}
         // bgGradient="linear(160deg, #1C4ED8 0%, #3F77A5 100%)"
          color="#1C4ED8"
        >
          <Image src={loginLogo} alt="VMukti" h="40px" objectFit="contain" alignSelf="flex-start" />

          <Flex flex="1" align="center" justify="center" py={6}>
            <Image src="/images/GptResponse.png" alt="VMS" objectFit="contain" maxW="320px" />
          </Flex>

          <Box>
            <Heading fontSize="24px" fontWeight="700" lineHeight="1.25" mb={2}>
              Live Video Management System
            </Heading>
            <Text fontSize="13px" opacity={0.85}>
              Real-time monitoring, playback and analytics for field surveillance vehicles.
            </Text>
          </Box>
        </Flex>

        {/* RIGHT — Login form */}
        <Flex direction="column" justify="center" w={{ base: "100%", md: "56%" }} p={{ base: 8, md: 12 }} gap={6}>
          {/* Mobile brand */}
          <Image src={loginLogo} alt="VMukti" h="32px" objectFit="contain" alignSelf="flex-start" display={{ base: "block", md: "none" }} />

          <Box>
            <Heading fontSize={{ base: "26px", md: "30px" }} fontWeight="700" color={headingColor}>
              Welcome back
            </Heading>
            <Text fontSize="14px" color={subColor} mt={1}>
              Sign in to your VMS account to continue
            </Text>
          </Box>

          <form onSubmit={handleLogin}>
            <Flex direction="column" gap={4}>
              {/* Email */}
              <FormControl>
                <FormLabel fontSize="13px" fontWeight="600" color={subColor} mb={1.5}>
                  Email ID
                </FormLabel>
                <InputGroup>
                  <InputLeftElement pointerEvents="none" color={iconColor}>
                    <FaRegEnvelope size={15} />
                  </InputLeftElement>
                  <Input
                    placeholder="Enter your Email ID"
                    value={email}
                    onChange={handleInputChange}
                    borderRadius="12px"
                    bg={inputFieldBg}
                    borderColor={inputBorder}
                    _hover={{ borderColor: "#3F77A5" }}
                    _focus={{ borderColor: "#3F77A5", boxShadow: "0 0 0 1px #3F77A5" }}
                  />
                </InputGroup>
              </FormControl>

              {/* Password */}
              <FormControl>
                <FormLabel fontSize="13px" fontWeight="600" color={subColor} mb={1.5}>
                  Password
                </FormLabel>
                <InputGroup>
                  <InputLeftElement pointerEvents="none" color={iconColor}>
                    <FaLock size={14} />
                  </InputLeftElement>
                  <Input
                    placeholder="Enter your Password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    borderRadius="12px"
                    bg={inputFieldBg}
                    borderColor={inputBorder}
                    _hover={{ borderColor: "#3F77A5" }}
                    _focus={{ borderColor: "#3F77A5", boxShadow: "0 0 0 1px #3F77A5" }}
                  />
                  <InputRightElement>
                    <IconButton
                      aria-label="Toggle password visibility"
                      icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPassword((p) => !p)}
                    />
                  </InputRightElement>
                </InputGroup>
              </FormControl>

              {errorMessage && (
                <Text fontSize="13px" color="red.400" fontWeight="500">
                  {errorMessage}
                </Text>
              )}

              <Button
                type="submit"
                w="100%"
                mt={1}
                borderRadius="12px"
                bg={accentBtn}
                color="white"
                fontWeight="600"
                size="lg"
                isLoading={isLoading}
                loadingText="Signing in…"
                _hover={{ opacity: 0.92 }}
                _active={{ opacity: 0.85 }}
              >
                Continue
              </Button>
            </Flex>
          </form>

          {/* Authorized access note */}
          <Box borderTop="1px solid" borderColor={inputBorder} pt={4} textAlign="center">
            <Text fontWeight="600" fontSize="14px" color={headingColor}>
              Unauthorized Access Prohibited
            </Text>
             
          </Box>
        </Flex>
      </Flex>
    </Flex >

  );
};

export default Login;

