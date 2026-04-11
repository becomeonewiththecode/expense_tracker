import api from "./api";

/** Where to send the user after sign-in: list if they have any saved expense, else `/budget?view=import`. */
export async function getPostLoginPath() {
  try {
    const { data } = await api.get("/expenses", { params: { limit: 1 } });
    return Array.isArray(data) && data.length > 0 ? "/expenses/list" : "/budget?view=import";
  } catch {
    return "/budget?view=import";
  }
}
