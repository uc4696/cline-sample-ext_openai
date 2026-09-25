import { useEffect, useState } from "react"
import { Storage } from "@plasmohq/storage"

type Settings = {
  captureFolder: string
  storageArea: "local" | "sync"
}

const SETTINGS_KEY = "extension-settings"
const CUSTOM_PRESETS_KEY = "custom-presets"
const defaultSettings: Settings = {
  captureFolder: "Captures",
  storageArea: "local"
}

function OptionsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [status, setStatus] = useState("")

  useEffect(() => {
    void (async () => {
      const localStorage = new Storage({ area: "local" })
      const localSettings = (await localStorage.get<Settings>(SETTINGS_KEY)) ?? defaultSettings
      const activeStorage = new Storage({ area: localSettings.storageArea })
      const activeSettings = (await activeStorage.get<Settings>(SETTINGS_KEY)) ?? localSettings
      setSettings({ ...defaultSettings, ...localSettings, ...activeSettings })
    })()
  }, [])

  const save = async () => {
    const folder = settings.captureFolder.trim() || "Captures"
    const next = { ...settings, captureFolder: folder }
    const localStorage = new Storage({ area: "local" })
    const targetStorage = new Storage({ area: next.storageArea })
    const previousSettings = (await localStorage.get<Settings>(SETTINGS_KEY)) ?? defaultSettings
    const previousStorage = new Storage({ area: previousSettings.storageArea ?? "local" })
    const existingPresets = (await previousStorage.get(CUSTOM_PRESETS_KEY)) ?? []

    await targetStorage.set(SETTINGS_KEY, next)
    await targetStorage.set(CUSTOM_PRESETS_KEY, existingPresets)
    await localStorage.set(SETTINGS_KEY, next)

    if (previousSettings.storageArea !== next.storageArea) {
      await previousStorage.remove(SETTINGS_KEY)
      await previousStorage.remove(CUSTOM_PRESETS_KEY)
    }

    setStatus("設定を保存しました。")
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif", color: "CanvasText", background: "Canvas", minHeight: "100vh" }}>
      <h1>Window Resizer & Capture 設定</h1>
      <p>スクリーンショットの保存先フォルダ名と、設定保存先のストレージ種別を変更できます。</p>

      <section style={{ border: "1px solid #8884", borderRadius: 12, padding: 16, display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Captures ディレクトリ名</span>
          <input
            value={settings.captureFolder}
            onChange={(e) => setSettings((current) => ({ ...current, captureFolder: e.target.value }))}
            placeholder="Captures"
            style={{ padding: 10, borderRadius: 8, border: "1px solid #8884" }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>設定の保存先</span>
          <select
            value={settings.storageArea}
            onChange={(e) => setSettings((current) => ({ ...current, storageArea: e.target.value as Settings["storageArea"] }))}
            style={{ padding: 10, borderRadius: 8 }}>
            <option value="local">local</option>
            <option value="sync">sync</option>
          </select>
        </label>

        <button onClick={save} style={{ width: 180, padding: "10px 12px", borderRadius: 10, cursor: "pointer" }}>保存</button>
        <div style={{ minHeight: 20, fontSize: 13 }}>{status}</div>
      </section>
    </main>
  )
}

export default OptionsPage