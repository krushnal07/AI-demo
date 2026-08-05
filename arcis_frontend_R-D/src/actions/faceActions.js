import axios from "axios";

const baseURL = `${process.env.REACT_APP_BASE_URL}/api/face`;

const instance = axios.create({
  baseURL: baseURL,
  withCredentials: true,
});

instance.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    if (error.response && error.response.status === 401) {
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const registerFace = async (formData) => {
  const response = await instance.post("/register", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
};

export const getRegisteredFaces = async () => {
  const response = await instance.get("/list");
  return response.data;
};

export const deleteFace = async (personName) => {
  const response = await instance.delete(`/${encodeURIComponent(personName)}`);
  return response.data;
};
