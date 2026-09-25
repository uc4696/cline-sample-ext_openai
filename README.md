# Window Resizer & Capture

Plasmo / React / TypeScript で構築した Chrome Extension (Manifest V3) です。ポップアップからブラウザウィンドウのサイズ変更とスクリーンショット保存を行えます。

## 主な機能

- ウィンドウ基準 / ビューポート基準の両方に対応したサイズ変更
- デフォルトテンプレート（スマホ縦・横、タブレット、PC標準、HD）
- カスタムサイズの追加・保存・削除
- 現在のウィンドウサイズ / ビューポートサイズ / 画面上限サイズの表示
- 表示部分キャプチャ（Visible Tab）
- ページ全体キャプチャ（スクロールしながら結合して JPG 保存）
- `chrome.downloads` による `Captures/` 配下への保存
- Options ページから保存フォルダ名変更、`local` / `sync` ストレージ切替
- OS のライト / ダークモードに追従しやすいシステムカラー中心の UI

## ディレクトリ構成

```text
.
├─ assets/
│  ├─ icon.png
│  └─ icon.svg
├─ contents/
│  └─ current-size-indicator.ts
├─ scripts/
│  └─ generate-icons.mjs
├─ utils/
│  └─ storage.ts
├─ background.ts
├─ options.tsx
├─ popup.tsx
├─ package.json
├─ tsconfig.json
└─ README.md
```

## セットアップ

```powershell
npm install
npm run generate:icons
npm run build
```

開発時:

```powershell
npm run dev
```

## Chrome への読み込み

1. `npm run build` を実行
2. Chrome の拡張機能管理画面で「デベロッパーモード」を有効化
3. `build/chrome-mv3-prod` を「パッケージ化されていない拡張機能を読み込む」から選択

## 実装仕様メモ

### サイズ変更
- popup 起動時にアクティブタブから現在のウィンドウサイズ / ビューポートサイズを取得
- ビューポート基準の場合は `outer - inner` の差分を考慮してウィンドウサイズへ変換
- カスタムサイズ入力時は現在の `screen.availWidth/availHeight` を上限に、最小 200px でバリデーション

### スクリーンショット
- 表示部分: `chrome.tabs.captureVisibleTab`
- 全体: ページを分割スクロールしながら PNG を取得し、`OffscreenCanvas` で結合して JPG 化
- ファイル名: `screenshot_YYYYMMDD_HHMISS.jpg`

### 設定
- `@plasmohq/storage` を利用
- 設定キー: `extension-settings`
- カスタムプリセットキー: `custom-presets`
- ストレージ保存先切替時は既存設定 / プリセットを移送

## 権限

- `tabs`
- `activeTab`
- `storage`
- `downloads`
- `scripting`

## バージョン管理

- 初期バージョンは `0.1.0`
- 機能変更時は `package.json` の `version` を更新してください