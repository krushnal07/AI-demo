// MobileHeader is disabled — returns null. Kept for import compatibility.

// MobileHeader is disabled — the standard Header navbar handles all screen sizes.
// The component is kept here so existing imports in pages don't break.
const MobileHeader = ({ title }) => {
  // Commented out — replaced by responsive Header navbar
  /*
  return (
    <Box display={{ base: "block", md: "none" }}>
      <Box
        bg={useColorModeValue("white", "#131922")}
        borderBottom="1px solid"
        borderColor={useColorModeValue("#E2E8EF", "rgba(255, 255, 255, 0.08)")}
        boxShadow={useColorModeValue("0 1px 3px rgba(0,0,0,0.05)", "0 2px 8px rgba(0,0,0,0.25)")}
        w="100%"
        position="fixed"
        top="0"
        left="0"
        zIndex="1000"
        p={3}
      >
        <Flex align="center" justify="space-between" position="relative">
          <Box>
            {title !== "Dashboard" ? (
              <IconButton
                icon={<IoIosArrowBack size="26px" />}
                aria-label="Go Back"
                variant="plain"
                onClick={() => window.history.back()}
              />
            ) : (
              <Box w="40px" />
            )}
          </Box>
          <Heading
            as="h6"
            fontSize="19px"
            fontWeight="550"
            position="absolute"
            left="50%"
            transform="translateX(-50%)"
          >
            {title}
          </Heading>
          <HStack spacing={1}>
            <Box position="relative">
              <IconButton
                icon={<IoMdNotificationsOutline size="26px" />}
                aria-label="Notifications"
                variant="plain"
              />
            </Box>
          </HStack>
        </Flex>
      </Box>
    </Box>
  );
  */
  return null;
};

export default MobileHeader;
