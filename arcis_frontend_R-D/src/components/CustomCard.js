import React from 'react';
import { Box, Flex, Text, useColorModeValue, Icon } from '@chakra-ui/react';

const CustomCard = ({
  title,
  value,
  color = '#3F77A5',
  iconBg,
  subtextColor,
  IconComponent,
  subtitle,
  minH,
}) => {
  const cardBg = useColorModeValue('#FFFFFF', '#1C222D');
  const borderColor = useColorModeValue('#E2E8EF', 'rgba(255, 255, 255, 0.08)');
  const titleColor = useColorModeValue('#64748B', '#94A3B8');
  const valueColor = useColorModeValue('#1A2E3D', '#FFFFFF');
  const shadow = '0px 1px 6px 0px rgba(26, 46, 61, 0.07)';

  const defaultIconBg = iconBg || `${color}16`;

  return (
    <Box
      w="100%"
      minH={minH || { base: "auto", md: "120px", lg: "125px", "2xl": "145px" }}
      bg={cardBg}
      p={{ base: "12px", sm: "14px", md: "14px", lg: "16px", "2xl": "18px" }}
      borderRadius="14px"
      borderWidth="3px 1px 1px 1px"
      borderStyle="solid"
      borderColor={borderColor}
      borderTopColor={color}
      boxShadow={shadow}
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
      fontFamily="'Manrope', sans-serif"
      transition="transform 0.2s ease, box-shadow 0.2s ease"
      _hover={{ transform: 'translateY(-2px)', boxShadow: '0px 4px 12px 0px rgba(26, 46, 61, 0.1)' }}
    >
      {/* Top Row: Icon Container */}
      <Flex
        w={{ base: "34px", sm: "38px", "2xl": "42px" }}
        h={{ base: "34px", sm: "38px", "2xl": "42px" }}
        minW={{ base: "34px", sm: "38px", "2xl": "42px" }}
        borderRadius="10px"
        bg={defaultIconBg}
        color={color}
        align="center"
        justify="center"
      >
        {IconComponent && <Icon as={IconComponent} boxSize={{ base: "16px", sm: "18px", "2xl": "20px" }} />}
      </Flex>

      {/* Content Section */}
      <Box pt="8px">
        {/* Title */}
        <Text
          fontFamily="'Manrope', sans-serif"
          fontWeight="600"
          fontSize="10px"
          lineHeight="15px"
          letterSpacing="0.8px"
          textTransform="uppercase"
          color={titleColor}
        >
          {title}
        </Text>

        {/* Number / Value */}
        <Text
          fontFamily="'Manrope', sans-serif"
          fontWeight="800"
          fontSize={{ base: "22px", sm: "24px", md: "28px", lg: "30px", "2xl": "34px" }}
          lineHeight="32px"
          letterSpacing="0px"
          color={valueColor}
          mt="2px"
        >
          {value}
        </Text>

        {/* Subtitle / Region / Percentage */}
        {subtitle && (
          <Text
            fontFamily="'Manrope', sans-serif"
            fontWeight="600"
            fontSize="11px"
            lineHeight="15px"
            letterSpacing="0px"
            color={subtextColor || color}
            mt="2px"
          >
            {subtitle}
          </Text>
        )}
      </Box>
    </Box>
  );
};

export default CustomCard;
