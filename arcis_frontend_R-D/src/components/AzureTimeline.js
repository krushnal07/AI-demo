import React, { useEffect, useRef, useState } from "react";
import "cloud-timeline-component/lib/Timeline.css";
import { getPlayback } from "../actions/cameraActions";

// Human-readable byte size (for the "Data Consumed" indicator)
const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

/**
 * Azure-backed timeline that renders with the EXACT same DOM/CSS as the original
 * CloudTimeline component — only the data source (/api/playback) and the click
 * action (play the Azure SAS URL) are different.
 */
const AzureTimeline = ({ date, deviceid, onUrlChange, onTotalDataChange }) => {
  const [segments, setSegments] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(null);
  const [hoveredChunk, setHoveredChunk] = useState({ x: 0, y: 0, time: null });
  const [currentPlaybackTimePosition, setCurrentPlaybackTimePosition] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(200);
  const timelineRef = useRef(null);

  // --- Fetch recordings for the selected day ---
  useEffect(() => {
    if (!deviceid || !date) return;
    let cancelled = false;

    (async () => {
      const res = await getPlayback(deviceid, {
        from: `${date}T00:00:00Z`,
        to: `${date}T23:59:59Z`,
      });
      if (cancelled) return;

      const segs = res.segments || [];
      setSegments(segs);
      setHighlightedIndex(null);
      setCurrentPlaybackTimePosition(getCurrentTimePosition());

      if (onTotalDataChange) {
        const totalBytes = segs.reduce((s, x) => s + (x.sizeBytes || 0), 0);
        onTotalDataChange(formatBytes(totalBytes));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, deviceid]);

  // --- Position helpers (identical math to CloudTimeline) ---
  const calculatePosition = (time) => {
    const startOfDay = new Date(`${date}T00:00:00Z`);
    const totalDuration = 24 * 60 * 60 * 1000;
    const elapsed = time - startOfDay.getTime();
    return (elapsed / totalDuration) * 100;
  };

  const getCurrentTimePosition = () => {
    // "now" as IST wall-clock, matching the recordings' wall-clock times
    const istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    // Only show the marker if "now" falls on the selected day
    if (istNow.toISOString().slice(0, 10) !== date) return null;
    const secs =
      istNow.getUTCHours() * 3600 +
      istNow.getUTCMinutes() * 60 +
      istNow.getUTCSeconds();
    return (secs / (24 * 3600)) * 100;
  };

  const generateHourlyMarkers = () => {
    const startOfDay = new Date(`${date}T00:00:00Z`);
    return Array.from({ length: 24 }, (_, h) => new Date(startOfDay.getTime() + h * 3600 * 1000));
  };

  const fileMarkers = segments.map((seg, index) => {
    const startTime = new Date(seg.startTime);
    const endTime = new Date(seg.endTime);
    const startPercentage = calculatePosition(startTime.getTime());
    const width = calculatePosition(endTime.getTime()) - startPercentage;
    return { startTime, endTime, startPercentage, width, index, url: seg.url };
  });

  // --- Interaction ---
  const handleFileClick = (index) => {
    setHighlightedIndex(index);
    const seg = fileMarkers[index];
    if (seg && onUrlChange) {
      onUrlChange(seg.url);
      setCurrentPlaybackTimePosition(seg.startPercentage);
    }
  };

  const handleTimelineClick = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickPercent = ((event.clientX - rect.left) / rect.width) * 100;
    const startOfDay = new Date(`${date}T00:00:00Z`);
    const clickedTime = startOfDay.getTime() + (clickPercent / 100) * 24 * 3600 * 1000;

    // Find the closest recording to the clicked position
    let closest = null;
    let minDiff = Infinity;
    fileMarkers.forEach((f) => {
      const diff = Math.abs(f.startTime.getTime() - clickedTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = f;
      }
    });
    if (closest) handleFileClick(closest.index);
  };

  const handleMouseMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const clickPercent = (x / rect.width) * 100;
    const startOfDay = new Date(`${date}T00:00:00Z`);
    const hoverTime = new Date(startOfDay.getTime() + (clickPercent / 100) * 24 * 3600 * 1000);
    setHoveredChunk({ x, y: event.clientY - rect.top, time: Math.floor(hoverTime.getTime() / 1000) });
  };

  const handleMouseLeave = () => setHoveredChunk({ x: 0, y: 0, time: null });

  // --- Zoom (wheel + scroll), same as CloudTimeline ---
  const handleScroll = () => {
    if (timelineRef.current) {
      const scrollPercentage =
        (timelineRef.current.scrollLeft / timelineRef.current.scrollWidth) * 100;
      setZoomLevel(Math.max(100, Math.min(800, 100 + scrollPercentage)));
    }
  };
  const handleWheel = (e) => {
    if (e.deltaY < 0) setZoomLevel((p) => Math.min(800, p + 10));
    else setZoomLevel((p) => Math.max(100, p - 10));
  };

  return (
    <div
      className="timeline-wrapper"
      onWheel={handleWheel}
      style={{ overflowX: "auto", width: "100%", paddingBottom: "10px" }}
    >
      <div className="timeline-container">
        <div
          className="timeline"
          ref={timelineRef}
          onScroll={handleScroll}
          style={{ minWidth: `${zoomLevel}%` }}
          onClick={handleTimelineClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {generateHourlyMarkers().map((hourMarker, index) => (
            <div
              key={`hour-${index}`}
              className="hour-marker"
              style={{ left: `${calculatePosition(hourMarker.getTime())}%` }}
            >
              <div className="hour-marker-indicator" />
              <div className="hour-marker-label">{hourMarker.getUTCHours()}:00</div>
            </div>
          ))}

          {fileMarkers.map(({ startPercentage, width, index }) => (
            <div
              key={`file-${index}`}
              className={`cloudfile-marker ${highlightedIndex === index ? "highlighted" : ""}`}
              style={{ left: `${startPercentage}%`, width: `${width}%` }}
              onClick={(e) => {
                e.stopPropagation();
                handleFileClick(index);
              }}
            >
              <div className="file-marker-indicator" />
            </div>
          ))}

          {hoveredChunk.time !== null && (
            <div
              className="hover-tooltip"
              style={{ left: `${hoveredChunk.x}px`, top: `${hoveredChunk.y - 40}px` }}
            >
              {new Date(hoveredChunk.time * 1000).toISOString().substring(11, 19)}{" "}
            </div>
          )}
          {hoveredChunk.time !== null && (
            <div
              className="hover-highlight"
              style={{ left: `${hoveredChunk.x}px`, top: "0px", height: "100%", width: "2px" }}
            />
          )}

          {currentPlaybackTimePosition !== null && (
            <div
              className="current-time-marker"
              style={{
                left: `${currentPlaybackTimePosition}%`,
                height: "100%",
                backgroundColor: "red",
                position: "absolute",
                width: "2px",
              }}
            />
          )}
          <div className="playback-marker" />
        </div>
      </div>
    </div>
  );
};

export default AzureTimeline;
