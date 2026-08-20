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
      minH="175px"
      bg={cardBg}
      p="20px"
      borderRadius="14px"
      borderWidth="3px 1px 1px 1px"
      borderStyle="solid"
      borderColor={borderColor}
      boxShadow={shadow}
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
      fontFamily="'Manrope', sans-serif"
      transition="transform 0.2s ease, box-shadow 0.2s ease"
      _hover={{ transform: 'translateY(-2px)', boxShadow: '0px 4px 12px 0px rgba(26, 46, 61, 0.1)' }}
    >
      {/* Top Row: Icon Container (42x42, border-radius: 11px) */}
      <Flex
        w="42px"
        h="42px"
        minW="42px"
        borderRadius="11px"
        bg={defaultIconBg}
        color={color}
        align="center"
        justify="center"
      >
        {IconComponent && <Icon as={IconComponent} boxSize="20px" />}
      </Flex>

      {/* Content Section */}
      <Box pt="14px">
        {/* Title (Manrope 600 SemiBold, 10px, line-height 15px, letter-spacing 0.8px, uppercase) */}
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

        {/* Number / Value (Manrope 800 ExtraBold, 36px, line-height 36px) */}
        <Text
          fontFamily="'Manrope', sans-serif"
          fontWeight="800"
          fontSize="36px"
          lineHeight="36px"
          letterSpacing="0px"
          color={valueColor}
          mt="4px"
        >
          {value}
        </Text>

        {/* Subtitle / Region / Percentage (Manrope 600 SemiBold, 11px, line-height 16.5px) */}
        {subtitle && (
          <Text
            fontFamily="'Manrope', sans-serif"
            fontWeight="600"
            fontSize="11px"
            lineHeight="16.5px"
            letterSpacing="0px"
            color={subtextColor || color}
            mt="4px"
          >
            {subtitle}
          </Text>
        )}
      </Box>
    </Box>
  );
};

export default CustomCard;
