import { useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";

/**
 * Opens Plaid Link once the SDK is ready. Unmount parent when finished to clear token state.
 */
export default function PlaidLinkLauncher({ linkToken, onSuccess, onExit }) {
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit,
  });

  useEffect(() => {
    if (ready && linkToken) open();
  }, [ready, linkToken, open]);

  return null;
}
