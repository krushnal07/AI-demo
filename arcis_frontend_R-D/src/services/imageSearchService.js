/* ---------------------------------------------------------------------------
 * Image (face) search.
 *
 * The search service itself sends no CORS headers and lives on a private IP,
 * so the browser cannot call it directly - the request goes to our own backend,
 * which forwards the file upstream untouched and returns the service's JSON.
 * ------------------------------------------------------------------------- */

const BASE_URL = process.env.REACT_APP_BASE_URL || process.env.REACT_APP_URL;

export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
export const ACCEPT_ATTR = ".png,.jpg,.jpeg,.webp";
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

/** Client-side guard so an obviously wrong file never costs a round trip. */
export const validateImage = (file) => {
  if (!file) return "Choose an image first.";
  if (!ACCEPTED_TYPES.includes(String(file.type).toLowerCase()))
    return "Only PNG, JPG and WebP images are supported.";
  if (file.size > MAX_FILE_BYTES) return "That image is larger than 15 MB. Use a smaller file.";
  if (!file.size) return "That image file is empty.";
  return null;
};

/**
 * POST the image and the optional filters.
 * @param {{ file: File, location?: string, startTime?: string, endTime?: string, signal?: AbortSignal }} params
 * @returns {Promise<object>} the search service's response, as it came back
 */
export const searchByImage = async ({ file, location, startTime, endTime, signal }) => {
  const form = new FormData();
  // the actual file, not a data URL - the service reads the `file` part
  form.append("file", file, file.name);
  if (location && location.trim()) form.append("location", location.trim());
  if (startTime) form.append("start_time", startTime);
  if (endTime) form.append("end_time", endTime);

  // Content-Type is deliberately not set: the browser adds it with the
  // multipart boundary, which we cannot generate ourselves.
  const response = await fetch(`${BASE_URL}/api/image-search/search`, {
    method: "POST",
    body: form,
    signal,
  });

  let body;
  try {
    body = await response.json();
  } catch (err) {
    throw new Error(`The server returned an unreadable response (${response.status}).`);
  }

  if (!response.ok || body?.success === false) {
    throw new Error(body?.message || `Search failed (${response.status}).`);
  }
  return body;
};
