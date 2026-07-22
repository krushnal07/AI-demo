// src/hooks/useTwoWayTalk.js
// Captures the mic with MediaRecorder (compressed audio, e.g. webm/opus) and
// streams the chunks to the backend two-way-talk gateway over a WebSocket. The
// backend buffers all chunks and runs the ffmpeg pipeline (pcm_alaw / 8kHz /
// mono / volume=2 -> 640-byte packets -> MQTT /56) in services/twoWayTalk.js.
import { useCallback, useEffect, useRef, useState } from 'react';

// Derive ws(s)://host/api/ws/talk from REACT_APP_BASE_URL (e.g. http://localhost:8082)
function talkSocketUrl(deviceId) {
  const api = process.env.REACT_APP_BASE_URL || window.location.origin;
  const base = api.replace(/^http/i, 'ws');
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;

  let codec = '';
  try { codec = (window.localStorage.getItem('talkCodec') || '').toLowerCase(); } catch (_) {}
  const codecParam = ['alaw', 'mulaw', 'aac'].includes(codec) ? `&codec=${codec}` : '';

  const socketUrl = normalizedBase.endsWith('/api')
    ? `${normalizedBase}/ws/talk?deviceId=${encodeURIComponent(deviceId)}${codecParam}`
    : `${normalizedBase}/api/ws/talk?deviceId=${encodeURIComponent(deviceId)}${codecParam}`;

  return socketUrl;
}

// getUserMedia is only exposed in a secure context (HTTPS or http://localhost).
function getMic(constraints) {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }
  const legacy =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia;
  if (legacy) {
    return new Promise((resolve, reject) => legacy.call(navigator, constraints, resolve, reject));
  }
  const insecure = typeof window !== 'undefined' && !window.isSecureContext;
  throw new Error(
    insecure
      ? 'Microphone needs a secure context. Open the app over HTTPS or via http://localhost (current origin is plain HTTP).'
      : 'Microphone API not available in this browser.'
  );
}

// Pick a MediaRecorder mime type ffmpeg can decode from pipe:0.
function pickMimeType() {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  if (typeof MediaRecorder === 'undefined') return '';
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

export default function useTwoWayTalk(deviceId) {
  const [talking, setTalking] = useState(false);
  const [error, setError] = useState(null);

  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const recordedRef = useRef([]); // collected Blob parts for the whole utterance
  const startingRef = useRef(false);

  const stopTracks = useCallback(() => {
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    } catch (_) {}
    streamRef.current = null;
  }, []);

  const closeWs = useCallback(() => {
    try { wsRef.current && wsRef.current.close(); } catch (_) {}
    wsRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      // The full utterance is flushed in recorder.onstop (one finalized blob),
      // which then sends 'stop' and closes the WS.
      try { recorder.stop(); } catch (_) { closeWs(); stopTracks(); }
    } else {
      // Nothing recording — just tear down.
      try { wsRef.current && wsRef.current.readyState === WebSocket.OPEN && wsRef.current.send('stop'); } catch (_) {}
      closeWs();
      stopTracks();
    }
    startingRef.current = false;
    setTalking(false);
  }, [closeWs, stopTracks]);

  const start = useCallback(async () => {
    if (talking || startingRef.current) return;
    if (!deviceId) { setError('No deviceId'); return; }
    startingRef.current = true;
    setError(null);

    try {
      // 1) Open the authenticated WS (JWT cookie sent automatically).
      const ws = new WebSocket(talkSocketUrl(deviceId));
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;
      await new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = () => reject(new Error('WebSocket connection failed (auth or network).'));
      });
      ws.onclose = () => stop();

      // 2) Mic capture.
      const stream = await getMic({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // 3) Record the whole utterance; flush one finalized blob on stop.
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recordedRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        try {
          const ws = wsRef.current;
          if (ws && ws.readyState === WebSocket.OPEN) {
            const blob = new Blob(recordedRef.current, { type: mimeType || 'audio/webm' });
            if (blob.size > 0) ws.send(await blob.arrayBuffer()); // one finalized container
            ws.send('stop');
          }
        } catch (err) {
          console.warn('Two-way talk flush failed:', err);
        } finally {
          recordedRef.current = [];
          closeWs();
          stopTracks();
        }
      };

      // No timeslice → a single finalized blob is produced on stop().
      recorder.start();

      startingRef.current = false;
      setTalking(true);
    } catch (err) {
      console.error('Two-way talk start failed:', err);
      setError(err.message || 'Failed to start talk');
      stop();
    }
  }, [deviceId, talking, stop, closeWs, stopTracks]);

  // Stop on unmount.
  useEffect(() => () => stop(), [stop]);

  return { talking, error, start, stop };
}
