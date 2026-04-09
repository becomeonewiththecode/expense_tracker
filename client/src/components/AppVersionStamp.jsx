import { useAppVersion } from "../useAppVersion.js";

/** Subtle release label; hidden until version is known. */
export default function AppVersionStamp({ className = "" }) {
  const version = useAppVersion();
  if (!version) return null;
  return (
    <span className={className} title="Application release">
      Version {version}
    </span>
  );
}
