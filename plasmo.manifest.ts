const manifest = {
  manifest_version: 3,
  name: "Window Resizer & Capture",
  version: "0.1.0",
  description: "Resize browser windows by window or viewport size and capture screenshots.",
  permissions: ["tabs", "activeTab", "storage", "downloads", "scripting"],
  host_permissions: ["<all_urls>"],
  background: {
    service_worker: "background.ts"
  },
  action: {
    default_title: "Window Resizer & Capture"
  },
  options_page: "options.html",
  icons: {
    "128": "assets/icon.png"
  }
}

export default manifest