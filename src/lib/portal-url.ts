export function getAppBaseUrl() {
  const authUrl = process.env.AUTH_URL?.replace(/\/$/, "");
  if (authUrl) return authUrl;

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;

  return "";
}

export function getPortalUrl() {
  const base = getAppBaseUrl();
  return base ? `${base}/consulta` : "/consulta";
}
