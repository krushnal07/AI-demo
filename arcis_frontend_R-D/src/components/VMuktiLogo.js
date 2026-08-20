import React from "react";
import { Box, Icon } from "@chakra-ui/react";

/**
 * VMukti Logo Mark SVG
 * Features the signature white geometric 'V' with the amber/orange (#DB7B3A) upper right vector triangle.
 */
const VMuktiLogo = ({ size = "30px", ...props }) => {
  return (
    <Box
      as="svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      minWidth={size}
      minHeight={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      flexShrink={0}
      {...props}
    >
      {/* Outer Left V Chevron */}
      <path
        d="M 12 22 L 49 22 L 34 42 L 28 34 L 19 34 L 54 82 L 82 43 L 71 43 L 54 67 L 23 26 L 12 22 Z"
        fill="#FFFFFF"
      />

      {/* Inner Diagonal Stroke */}
      <path
        d="M 55 22 L 73 22 L 48 55 L 40 55 Z"
        fill="#FFFFFF"
      />

      {/* Upper Right Vector Triangle (End of V) in #DB7B3A */}
      <path
        d="M 78 22 L 96 22 L 87 35 Z"
        fill="#DB7B3A"
      />
    </Box>
  );
};

export default VMuktiLogo;
