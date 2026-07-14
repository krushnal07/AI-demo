import { Box, Stack, Text, useColorModeValue, Flex, Icon } from '@chakra-ui/react';

const CustomCard = ({ title, value, color, IconComponent, layout = 'vertical', subtitle }) => {
  const cardBg = useColorModeValue('#FFFFFF', 'gray.800');
  const borderColor = useColorModeValue('rgba(226, 232, 240, 0.9)', 'whiteAlpha.200');
  const titleColor = useColorModeValue('gray.500', 'gray.400');
  const valueColor = useColorModeValue('gray.800', 'white');
  const subtitleColor = useColorModeValue('gray.400', 'gray.500');
  const shadow = useColorModeValue('0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)', 'dark-lg');
  const hoverShadow = useColorModeValue('0 8px 24px rgba(0,0,0,0.08)', 'dark-lg');

  // Soft tint of the accent color for the icon tile (8-digit hex = ~12% alpha)
  const tint = `${color}1F`;

  if (layout === 'vertical') {
    return (
      <Box
        position="relative"
        borderRadius="16px"
        bg={cardBg}
        px={5}
        py={5}
        height="100%"
        minH="150px"
        border="1px solid"
        borderColor={borderColor}
        boxShadow={shadow}
        overflow="hidden"
        transition="transform 0.2s ease, box-shadow 0.2s ease"
        _hover={{ transform: 'translateY(-3px)', boxShadow: hoverShadow }}
      >
        {/* Accent strip */}
        <Box position="absolute" top="0" left="0" right="0" height="3px" bg={color} opacity={0.9} />

        <Flex justify="space-between" align="flex-start">
          <Flex
            alignItems="center"
            justifyContent="center"
            bg={tint}
            color={color}
            borderRadius="12px"
            boxSize="46px"
          >
            {IconComponent && <Icon as={IconComponent} boxSize="22px" />}
          </Flex>
        </Flex>

        <Box mt={4}>
          <Text
            fontSize="12px"
            color={titleColor}
            fontWeight="600"
            textTransform="uppercase"
            letterSpacing="0.06em"
          >
            {title}
          </Text>
          <Text fontSize="32px" fontWeight="700" color={valueColor} lineHeight="1.1" mt={1}>
            {value}
          </Text>
          {subtitle && (
            <Text fontSize="12px" color={subtitleColor} fontWeight="500" mt={1}>
              {subtitle}
            </Text>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      borderRadius="12px"
      bg={cardBg}
      p={4}
      border="1px solid"
      borderColor={borderColor}
      boxShadow={shadow}
    >
      <Flex alignItems="center" gap={4}>
        <Flex
          alignItems="center"
          justifyContent="center"
          bg={tint}
          color={color}
          borderRadius="10px"
          boxSize="42px"
          minW="42px"
        >
          {IconComponent && <Icon as={IconComponent} boxSize="18px" />}
        </Flex>

        <Stack spacing={0}>
          <Text fontSize="13px" color={titleColor} fontWeight="500">
            {title}
          </Text>
          <Text fontSize="22px" fontWeight="700" color={valueColor}>
            {value}
          </Text>
        </Stack>
      </Flex>
    </Box>
  );
};

export default CustomCard;
