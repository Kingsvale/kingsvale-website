export function isLocalDemoRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  const { hostname, protocol } = window.location;
  return (
    protocol === "file:" ||
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

export function requireServerBackedStudio() {
  return !isLocalDemoRuntime();
}
