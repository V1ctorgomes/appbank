export function getPortalUrl() {
  const base = process.env.AUTH_URL?.replace(/\/$/, "");
  return base ? `${base}/consulta` : "/consulta";
}
