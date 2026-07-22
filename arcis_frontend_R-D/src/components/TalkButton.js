// src/components/TalkButton.js
// Press-and-hold microphone button for two-way talk. Push-to-talk avoids echo
// with the downstream Jessibuca audio and maps one hold = one talk session.
import React, { useEffect } from 'react';
import { IconButton, Tooltip, useToast } from '@chakra-ui/react';
import { FiMic } from 'react-icons/fi';
import useTwoWayTalk from '../hooks/useTwoWayTalk';

const TalkButton = ({ deviceId, size = 'sm' }) => {
  const { talking, error, start, stop } = useTwoWayTalk(deviceId);
  const toast = useToast();

  useEffect(() => {
    if (error) {
      toast({
        title: 'Two-way talk error',
        description: error,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  }, [error, toast]);

  // Prevent the press gesture from selecting text / triggering context menus.
  const press = (e) => {
    e.preventDefault();
    e.stopPropagation();
    start();
  };
  const release = (e) => {
    e.preventDefault();
    e.stopPropagation();
    stop();
  };

  return (
    <Tooltip label={talking ? 'Release to stop' : 'Hold to talk'} placement="left">
      <IconButton
        aria-label={talking ? 'Talking (release to stop)' : 'Hold to talk'}
        aria-pressed={talking}
        icon={<FiMic fontSize="16px" />}
        variant="solid"
        size={size}
        onMouseDown={press}
        onMouseUp={release}
        onMouseLeave={release}
        onTouchStart={press}
        onTouchEnd={release}
        onContextMenu={(e) => e.preventDefault()}
        bg={talking ? 'red.500' : 'rgba(0, 0, 0, 0.6)'}
        color="#fff"
        _hover={{ bg: talking ? 'red.600' : 'rgba(0,0,0,0.8)' }}
        borderRadius="full"
        minW="unset"
        sx={{ touchAction: 'none', userSelect: 'none' }}
      />
    </Tooltip>
  );
};

export default TalkButton;
