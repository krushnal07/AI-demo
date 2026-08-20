import React from "react";
import {
  Box,
  Flex,
  Heading,
  HStack,
  IconButton,
  useColorModeValue,
} from "@chakra-ui/react";
import { IoIosArrowBack, IoMdNotificationsOutline } from "react-icons/io";

const MobileHeader = ({ title }) => {
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
        // borderRadius="16px 16px"
      >
        <Flex align="center" justify="space-between" position="relative">
          {/* Back Button or Placeholder */}
          <Box>
            {title !== "Dashboard" ? (
              <IconButton
                icon={<IoIosArrowBack size="26px" />}
                aria-label="Go Back"
                variant="plain"
                onClick={() => window.history.back()} // Navigate back in browser history
              />
            ) : (
              <Box w="40px" /> // Placeholder to maintain alignment
            )}
          </Box>

          {/* Center Title */}
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

          {/* Right Content (Notifications Icon) */}
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
};

export default MobileHeader;
