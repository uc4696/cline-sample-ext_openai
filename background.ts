import { Storage } from "@plasmohq/storage"

export {}

const DEFAULT_FOLDER_NAME = "Captures"
const SETTINGS_KEY = "extension-settings"

type StorageArea = "local" | "sync"

type ExtensionSettings = {
  captureFolder: string
  storageArea: StorageArea
}

type ResizeMode = "window" | "viewport"

type ResizePreset = {
  width: number
  height: number
  mode: ResizeMode
}

const DEFAULT_SETTINGS: ExtensionSettings = {
  captureFolder: DEFAULT_FOLDER_NAME,
  storageArea: "local"
}

const jpegDataUrlToBlob = (dataUrl: string): Blob => {
  const [header, base64] = dataUrl.split(",")
  const mimeMatch = header.match(/data:(.*?);base64/)
  const mime = mimeMatch?.[1] ?? "image/jpeg"
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new Blob([bytes], { type: mime })
}

const loadSettings = async (): Promise<ExtensionSettings> => {
  const localStorage = new Storage({ area: "local" })
  const localSettings = await localStorage.get<ExtensionSettings>(SETTINGS_KEY)
  const chosenArea = localSettings?.storageArea ?? "local"
  const activeStorage = new Storage({ area: chosenArea })
  const activeSettings = await activeStorage.get<ExtensionSettings>(SETTINGS_KEY)

  return {
    ...DEFAULT_SETTINGS,
    ...localSettings,
    ...activeSettings,
    storageArea: chosenArea
  }
}

const pad = (value: number) => `${value}`.padStart(2, "0")

const createFilename = (folderName: string) => {
  const now = new Date()
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `${folderName}/screenshot_${stamp}.jpg`
}

const dataUrlToJpeg = async (dataUrl: string, quality = 0.92): Promise<string> => {
  const blob = jpegDataUrlToBlob(dataUrl)
  const bitmap = await createImageBitmap(blob)
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const context = canvas.getContext("2d")

  if (!context) {
    return dataUrl
  }

  context.drawImage(bitmap, 0, 0)
  const jpegBlob = await canvas.convertToBlob({ type: "image/jpeg", quality })

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(jpegBlob)
  })
}

const saveDataUrl = async (dataUrl: string) => {
  const settings = await loadSettings()
  const filename = createFilename(settings.captureFolder || DEFAULT_FOLDER_NAME)

  await chrome.downloads.download({
    url: dataUrl,
    filename,
    saveAs: false,
    conflictAction: "uniquify"
  })

  return filename
}

const captureVisible = async (windowId?: number) => {
  const image = await chrome.tabs.captureVisibleTab(windowId, {
    format: "jpeg",
    quality: 92
  })

  return saveDataUrl(image)
}

const captureFullPage = async (tabId: number, windowId?: number) => {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      totalWidth: document.documentElement.scrollWidth,
      totalHeight: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
      scrollX: window.scrollX,
      scrollY: window.scrollY
    })
  })

  const metrics = results[0]?.result

  if (!metrics) {
    throw new Error("ページ情報を取得できませんでした。")
  }

  const slices: Array<{ x: number; y: number; dataUrl: string }> = []
  const originalOverflow = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const original = document.documentElement.style.scrollBehavior
      document.documentElement.style.scrollBehavior = "auto"
      return original
    }
  })

  for (let y = 0; y < metrics.totalHeight; y += metrics.viewportHeight) {
    for (let x = 0; x < metrics.totalWidth; x += metrics.viewportWidth) {
      await chrome.scripting.executeScript({
        target: { tabId },
        args: [x, y],
        func: async (left, top) => {
          window.scrollTo(left, top)
          await new Promise((resolve) => setTimeout(resolve, 150))
        }
      })

      const shot = await chrome.tabs.captureVisibleTab(windowId, {
        format: "png"
      })

      slices.push({ x, y, dataUrl: shot })
    }
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    args: [metrics.scrollX, metrics.scrollY, originalOverflow[0]?.result ?? ""],
    func: (left, top, scrollBehavior) => {
      document.documentElement.style.scrollBehavior = scrollBehavior
      window.scrollTo(left, top)
    }
  })

  const canvas = new OffscreenCanvas(metrics.totalWidth * metrics.devicePixelRatio, metrics.totalHeight * metrics.devicePixelRatio)
  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("画像描画コンテキストを取得できませんでした。")
  }

  for (const slice of slices) {
    const blob = jpegDataUrlToBlob(slice.dataUrl)
    const bitmap = await createImageBitmap(blob)
    context.drawImage(bitmap, slice.x * metrics.devicePixelRatio, slice.y * metrics.devicePixelRatio)
  }

  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 })
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })

  const jpegUrl = await dataUrlToJpeg(dataUrl)
  return saveDataUrl(jpegUrl)
}

const getActiveTab = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message?.type === "capture-visible") {
        const tab = await getActiveTab()
        const filename = await captureVisible(tab?.windowId)
        sendResponse({ ok: true, filename })
        return
      }

      if (message?.type === "capture-full") {
        const tab = await getActiveTab()

        if (!tab?.id) {
          throw new Error("アクティブなタブを取得できませんでした。")
        }

        const filename = await captureFullPage(tab.id, tab.windowId)
        sendResponse({ ok: true, filename })
        return
      }

      if (message?.type === "resize-window") {
        const tab = await getActiveTab()

        if (!tab?.windowId) {
          throw new Error("アクティブウィンドウを取得できませんでした。")
        }

        const preset = message.payload as ResizePreset
        const bounds = await chrome.windows.get(tab.windowId)
        let targetWidth = preset.width
        let targetHeight = preset.height

        if (preset.mode === "viewport" && tab.id) {
          const info = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => ({
              innerWidth: window.innerWidth,
              innerHeight: window.innerHeight,
              outerWidth: window.outerWidth,
              outerHeight: window.outerHeight
            })
          })

          const current = info[0]?.result

          if (current) {
            targetWidth = preset.width + (current.outerWidth - current.innerWidth)
            targetHeight = preset.height + (current.outerHeight - current.innerHeight)
          }
        }

        await chrome.windows.update(tab.windowId, {
          width: Math.round(targetWidth),
          height: Math.round(targetHeight),
          left: bounds.left,
          top: bounds.top,
          focused: true
        })

        sendResponse({ ok: true })
        return
      }

      if (message?.type === "get-window-metrics") {
        const tab = await getActiveTab()

        if (!tab?.id || !tab.windowId) {
          throw new Error("アクティブタブの情報取得に失敗しました。")
        }

        const [windowInfo, viewportInfo] = await Promise.all([
          chrome.windows.get(tab.windowId),
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => ({
              viewportWidth: window.innerWidth,
              viewportHeight: window.innerHeight,
              screenWidth: window.screen.availWidth,
              screenHeight: window.screen.availHeight,
              outerWidth: window.outerWidth,
              outerHeight: window.outerHeight
            })
          })
        ])

        sendResponse({
          ok: true,
          metrics: {
            windowWidth: windowInfo.width ?? 0,
            windowHeight: windowInfo.height ?? 0,
            viewportWidth: viewportInfo[0]?.result?.viewportWidth ?? 0,
            viewportHeight: viewportInfo[0]?.result?.viewportHeight ?? 0,
            maxWidth: viewportInfo[0]?.result?.screenWidth ?? 0,
            maxHeight: viewportInfo[0]?.result?.screenHeight ?? 0,
            outerWidth: viewportInfo[0]?.result?.outerWidth ?? 0,
            outerHeight: viewportInfo[0]?.result?.outerHeight ?? 0
          }
        })
        return
      }

      sendResponse({ ok: false, error: "unknown-message" })
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "unknown-error"
      })
    }
  })()

  return true
})