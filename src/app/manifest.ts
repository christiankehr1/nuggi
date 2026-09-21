import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_NAME, APP_SHORT_NAME, THEME_COLOR } from "@/config";
import { de } from "@/i18n/de";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_SHORT_NAME,
    description: APP_DESCRIPTION,
    id: "/heute",
    start_url: "/heute",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: THEME_COLOR,
    theme_color: THEME_COLOR,
    lang: "de",
    // Long-press shortcuts: supported on Android/Chrome; iOS shows only its bookmark menu.
    shortcuts: [
      { name: de.shortcuts.sleep, url: "/heute?aktion=schlaf", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: de.shortcuts.breast, url: "/heute?aktion=stillen", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: de.shortcuts.bottle, url: "/heute?aktion=flaeschchen", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
