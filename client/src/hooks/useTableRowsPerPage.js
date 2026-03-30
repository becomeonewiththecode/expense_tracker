import { useEffect, useState } from "react";
import { getRowsPerPage } from "../tablePreferences.js";

export default function useTableRowsPerPage() {
  const [rowsPerPage, setRowsPerPage] = useState(() => getRowsPerPage());

  useEffect(() => {
    const onChange = () => setRowsPerPage(getRowsPerPage());
    window.addEventListener("tableRowsPerPage-changed", onChange);
    return () => window.removeEventListener("tableRowsPerPage-changed", onChange);
  }, []);

  return rowsPerPage;
}

