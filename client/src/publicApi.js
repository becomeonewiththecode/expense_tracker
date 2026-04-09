import axios from "axios";

/** Unauthenticated API client (e.g. read-only advisor share). */
const publicApi = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

export default publicApi;
