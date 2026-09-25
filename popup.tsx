import { useEffect, useMemo, useState } from "react"
import { Storage } from "@plasmohq/storage"

type ResizeMode = "window" | "viewport"

type Preset = {
  id: string
  name: string
  width: number
  height: number
  mode: ResizeMode
  builtIn?: boolean
}

type Metrics = {
  windowWidth: number
  windowHeight: number
  viewportWidth: number
  viewportHeight: number
  maxWidth: number
  maxHeight: number
  outerWidth: number
  outerHeight: number
}

type ExtensionSettings = {
  captureFolder: string
  storageArea: "local" | "sync"
}

const SETTINGS_KEY = "extension-settings"
const CUSTOM_PRESETS_KEY = "custom-presets"

const builtInPresets: Preset[] = [
  { id: "mobile-portrait", name: "スマホ縦", width: 390, height: 844, mode: "viewport", builtIn: true },
  { id: "mobile-landscape", name: "スマホ横", width: 844, height: 390, mode: "viewport", builtIn: true },
  { id: "tablet", name: "タブレット", width: 768, height: 1024, mode: "viewport", builtIn: true },
  { id: "desktop", name: "PC標準", width: 1440, height: 900, mode: "window", builtIn: true },
  { id: "hd", name: "HD", width: 1366, height: 768, mode: "window", builtIn: true }
]

const storageLocal = new Storage({ area: "local" })

const containerStyle: React.CSSProperties = {
  width: 360,
  padding: 16,
  color: "CanvasText",
  background: "Canvas",
  fontFamily: "system-ui, sans-serif"
}

const cardStyle: React.CSSProperties = {
  border: "1px solid color-mix(in srgb, CanvasText 12%, transparent)",
  borderRadius: 12,
  padding: 12,
  marginBottom: 12,
  background: "color-mix(in srgb, Canvas 94%, CanvasText 6%)"
}

const buttonStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid color-mix(in srgb, CanvasText 15%, transparent)",
  padding: "8px 10px",
  background: "color-mix(in srgb, Highlight 10%, Canvas)",
  color: "CanvasText",
  cursor: "pointer"
}

function IndexPopup() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [customPresets, setCustomPresets] = useState<Preset[]>([])
  const [settings, setSettings] = useState<ExtensionSettings>({ captureFolder: "Captures", storageArea: "local" })
  const [customName, setCustomName] = useState("")
  const [customWidth, setCustomWidth] = useState("")
  const [customHeight, setCustomHeight] = useState("")
  const [customMode, setCustomMode] = useState<ResizeMode>("viewport")
  const [status, setStatus] = useState<string>("")

  const presets = useMemo(() => [...builtInPresets, ...customPresets], [customPresets])

  const loadAll = async () => {
    const response = await chrome.runtime.sendMessage({ type: "get-window-metrics" })
    if (response?.ok) {
      setMetrics(response.metrics)
    }

    const localSettings = (await storageLocal.get<ExtensionSettings>(SETTINGS_KEY)) ?? settings
    const activeStorage = new Storage({ area: localSettings.storageArea ?? "local" })
    const activeSettings = (await activeStorage.get<ExtensionSettings>(SETTINGS_KEY)) ?? localSettings
    const savedPresets = (await activeStorage.get<Preset[]>(CUSTOM_PRESETS_KEY)) ?? []

    setSettings({ captureFolder: "Captures", storageArea: "local", ...localSettings, ...activeSettings })
    setCustomPresets(savedPresets)
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const handleResize = async (preset: Preset) => {
    const response = await chrome.runtime.sendMessage({ type: "resize-window", payload: preset })
    setStatus(response?.ok ? `サイズ変更: ${preset.name}` : `失敗: ${response?.error ?? "unknown"}`)
    await loadAll()
  }

  const handleCapture = async (type: "capture-visible" | "capture-full") => {
    setStatus("キャプチャ中...")
    const response = await chrome.runtime.sendMessage({ type })
    setStatus(response?.ok ? `保存完了: ${response.filename}` : `失敗: ${response?.error ?? "unknown"}`)
  }

  const validateCustomSize = () => {
    const width = Number(customWidth)
    const height = Number(customHeight)
    const maxWidth = metrics?.maxWidth ?? 9999
    const maxHeight = metrics?.maxHeight ?? 9999

    if (!customName.trim()) return "名前を入力してください。"
    if (!Number.isFinite(width) || !Number.isFinite(height)) return "幅と高さは数値で入力してください。"
    if (width < 200 || height < 200) return "最小サイズは 200px です。"
    if (width > maxWidth || height > maxHeight) return `現在の画面では最大 ${maxWidth} x ${maxHeight} までです。`
    return ""
  }

  const saveCustomPreset = async () => {
    const error = validateCustomSize()
    if (error) {
      setStatus(error)
      return
    }

    const storage = new Storage({ area: settings.storageArea })
    const nextPreset: Preset = {
      id: `custom-${Date.now()}`,
      name: customName.trim(),
      width: Number(customWidth),
      height: Number(customHeight),
      mode: customMode
    }

    const nextPresets = [...customPresets, nextPreset]
    await storage.set(CUSTOM_PRESETS_KEY, nextPresets)
    setCustomPresets(nextPresets)
    setCustomName("")
    setCustomWidth("")
    setCustomHeight("")
    setStatus(`追加しました: ${nextPreset.name}`)
  }

  const removeCustomPreset = async (presetId: string) => {
    const storage = new Storage({ area: settings.storageArea })
    const nextPresets = customPresets.filter((preset) => preset.id !== presetId)
    await storage.set(CUSTOM_PRESETS_KEY, nextPresets)
    setCustomPresets(nextPresets)
    setStatus("カスタムサイズを削除しました。")
  }

  return (
    <div style={containerStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Window Resizer & Capture</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>保存先: {settings.captureFolder}</div>
        </div>
        <button style={buttonStyle} onClick={() => chrome.runtime.openOptionsPage()}>
          設定
        </button>
      </div>

      <section style={cardStyle}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>現在のサイズ</div>
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <div>ウィンドウ: {metrics?.windowWidth ?? "-"} x {metrics?.windowHeight ?? "-"}</div>
          <div>ビューポート: {metrics?.viewportWidth ?? "-"} x {metrics?.viewportHeight ?? "-"}</div>
          <div>画面上限: {metrics?.maxWidth ?? "-"} x {metrics?.maxHeight ?? "-"}</div>
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>テンプレート</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {presets.map((preset) => (
            <button key={preset.id} style={buttonStyle} onClick={() => handleResize(preset)}>
              <div style={{ fontWeight: 600 }}>{preset.name}</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{preset.width} x {preset.height} / {preset.mode}</div>
            </button>
          ))}
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>カスタムサイズ</div>
        <div style={{ display: "grid", gap: 8 }}>
          <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="名前" style={{ padding: 8, borderRadius: 8, border: "1px solid #8884" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <input value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} placeholder="幅" inputMode="numeric" style={{ padding: 8, borderRadius: 8, border: "1px solid #8884" }} />
            <input value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} placeholder="高さ" inputMode="numeric" style={{ padding: 8, borderRadius: 8, border: "1px solid #8884" }} />
          </div>
          <select value={customMode} onChange={(e) => setCustomMode(e.target.value as ResizeMode)} style={{ padding: 8, borderRadius: 8 }}>
            <option value="viewport">ビューポート基準</option>
            <option value="window">ウィンドウ基準</option>
          </select>
          <button style={buttonStyle} onClick={saveCustomPreset}>追加して保存</button>
          {customPresets.length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              {customPresets.map((preset) => (
                <div key={preset.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span>{preset.name} ({preset.width} x {preset.height}, {preset.mode})</span>
                  <button style={buttonStyle} onClick={() => removeCustomPreset(preset.id)}>削除</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={cardStyle}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>スクリーンショット</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <button style={buttonStyle} onClick={() => handleCapture("capture-visible")}>表示部分</button>
          <button style={buttonStyle} onClick={() => handleCapture("capture-full")}>ページ全体</button>
        </div>
      </section>

      <div style={{ minHeight: 20, fontSize: 12, opacity: 0.8 }}>{status}</div>
    </div>
  )
}

export default IndexPopup