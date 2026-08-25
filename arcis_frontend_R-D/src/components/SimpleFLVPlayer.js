// src/components/SimpleFLVPlayer.js
import React, { useEffect, useRef } from "react";
import mpegts from "mpegts.js";
import { Box } from "@chakra-ui/react";

const SimpleFLVPlayer = ({ url, style, isLive = true, hasAudio = false, poster }) => {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    // A live stream needs MSE live playback; a recorded clip only needs MSE.
    const supported = isLive ? mpegts.getFeatureList().mseLivePlayback : mpegts.isSupported();

    if (supported && url) {
      // Initialize Player
      playerRef.current = mpegts.createPlayer({
        type: "flv", // Support flv format
        url: url,
        isLive: isLive,
        cors: true,
        hasAudio: hasAudio, // Set to true if your cameras have audio
      });

      playerRef.current.on(mpegts.Events.ERROR, (type, detail, info) => {
        console.error("FLV playback error:", type, detail, info);
      });

      playerRef.current.attachMediaElement(videoRef.current);
      playerRef.current.load();
      
      const playPromise = playerRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error("Auto-play prevented:", error);
        });
      }
    }

    return () => {
      // Cleanup on unmount
      if (playerRef.current) {
        playerRef.current.pause();
        playerRef.current.unload();
        playerRef.current.detachMediaElement();
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [url, isLive, hasAudio]);

  return (
    <Box style={style} bg="black" display="flex" justifyContent="center" alignItems="center">
      <video
        ref={videoRef}
        poster={poster}
        style={{ width: "100%", height: "100%" }}
        controls
        autoPlay
        muted // Muted is often required for autoplay to work efficiently
      />
    </Box>
  );
};

export default SimpleFLVPlayer;
