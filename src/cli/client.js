export const baseUrl = () => process.env.IMHOTEP_URL || "http://127.0.0.1:4173";
export async function request(path, body) {
  const response = await fetch(
    `${baseUrl()}${path}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}
