export function parseRoute() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const [pathPart, queryPart = ""] = raw.split("?");
  const parts = pathPart.split("/").filter(Boolean);
  return { parts, query: new URLSearchParams(queryPart) };
}

export function go(path) {
  location.hash = path.startsWith("#") ? path : `#${path}`;
}
