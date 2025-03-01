const INTERNAL_IP_PATTERNS =
  process.env.REACT_APP_INTERNAL_IP_PATTERNS?.split(',');

const isInternalNetwork = INTERNAL_IP_PATTERNS?.some((pattern) =>
  new RegExp(`^${pattern}`).test(window.location.hostname),
);
export const BASE_URL = isInternalNetwork
  ? process.env.REACT_APP_API_URL
  : process.env.REACT_APP_EXTERNAL_API_URL;

export const GATEWAY_URL = process.env.REACT_APP_GATEWAY_URL;

export const TOKEN = process.env.REACT_APP_TOKEN;
