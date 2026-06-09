import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(async () => {
  let appVersion = "v0.1.0"; // fallback
  try {
    const res = await fetch("https://api.github.com/repos/katrate/notie/releases/latest");
    const data = await res.json();
    if (data.tag_name) appVersion = data.tag_name;
  } catch (e) {
    console.warn("Failed to fetch latest release version, using fallback:", appVersion);
  }

  return {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    base: "/",
  };
});
