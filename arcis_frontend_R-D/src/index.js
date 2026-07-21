import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { ChakraProvider, ColorModeScript } from "@chakra-ui/react";
import theme from './theme';

// --- Suppress benign third-party player errors ------------------------------
// jessibuca-pro (the video player library) can throw errors that are harmless
// to the app but noisy and, in dev, trip the error overlay. We swallow ONLY
// these specific, known library errors:
//   1. AbortError from its PressureObserver during player teardown.
//   2. "Cannot use 'in' operator to search for 'buffer' in <streamError>" —
//      thrown inside its error handler when a stream fails (e.g. an offline
//      camera returning "context deadline exceeded").
const isBenignPlayerError = (val) => {
  const msg =
    (val && (val.message || (typeof val === "string" ? val : ""))) || "";
  return (
    (msg.includes("PressureObserver") && msg.includes("Called disconnect method")) ||
    msg.includes("Cannot use 'in' operator to search for 'buffer'")
  );
};

window.addEventListener(
  "unhandledrejection",
  (event) => {
    if (isBenignPlayerError(event.reason)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true
);

window.addEventListener(
  "error",
  (event) => {
    if (isBenignPlayerError(event.error || event.message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },
  true
);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ChakraProvider theme={theme}>
    <ColorModeScript initialColorMode={theme.config.initialColorMode} />
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </ChakraProvider>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
