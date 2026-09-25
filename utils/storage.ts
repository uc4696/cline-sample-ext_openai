import { Storage } from "@plasmohq/storage"

export const SETTINGS_KEY = "extension-settings"
export const CUSTOM_PRESETS_KEY = "custom-presets"

export type StorageAreaType = "local" | "sync"

export type ExtensionSettings = {
  captureFolder: string
  storageArea: StorageAreaType
}

export const defaultSettings: ExtensionSettings = {
  captureFolder: "Captures",
  storageArea: "local"
}

export const getLocalStorage = () => new Storage({ area: "local" })