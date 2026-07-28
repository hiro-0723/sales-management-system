# プロジェクトマップ

## 1. 基本情報

- プロジェクト名：営業管理システム
- リポジトリURL：`https://github.com/hiro-0723/sales-management-system`
- 既定ブランチ：`main`
- 開発環境：Google Apps Script V8、Google Sheets、Google Forms、clasp、GitHub
- 次期入力UI候補：LINE WORKS + Webhook

## 2. 現在の構成

```text
sales-management-system/
├── AGENTS.md
├── Menu.js
├── SystemSetup.js
├── Diagnostics.js
├── Schema.js
├── SalesMaster.js
├── SalesPlan.js
├── SalesPlanEngine.js
├── VisitReport.js
├── OCR.js
├── RegionInfo.js
├── RegionInfoEngine.js
├── Dashboard.js
├── appsscript.json
├── sales-management-system-schema.json
├── sales-management-system-full-schema.json
├── docs/
│   ├── ROADMAP.md
│   ├── guides/
│   ├── project-memory/
│   └── verification/
└── tools/
    └── start_chat.sh
```

## 3. 主要ファイル

| ファイル | 役割 | 注意点 |
|---|---|---|
| `Menu.js` | 営業管理メニュー | メニューを増やしすぎない |
| `SystemSetup.js` | 初期設定・作成・更新 | 診断処理を重複実装しない |
| `Diagnostics.js` | システム診断 | 一時調査関数の追加先 |
| `Schema.js` | シート・フォーム・トリガーの構造確認 | 外部状態の読み取り範囲を確認する |
| `SalesMaster.js` | 営業先マスター、紹介実績候補、フォーム同期 | 複数フォームに依存 |
| `SalesPlan.js` | 営業予定フォーム・シートの作成と設定 | フォーム構造を無断再構築しない |
| `SalesPlanEngine.js` | 予定展開、PlanID、状態、訪問履歴接続 | v2.0で流用候補 |
| `VisitReport.js` | 営業報告、訪問履歴、予定更新 | PlanID連携を保護 |
| `RegionInfo.js` | 地域情報フォーム・シートの作成と設定 | 設定責務に限定 |
| `RegionInfoEngine.js` | 転記、予定変換、重複防止 | v2.0で流用候補 |
| `Dashboard.js` | 営業ダッシュボード | 閲覧用画面 |
| `OCR.js` | 名刺OCR | 安定モジュールとして直接改修を避ける |

## 4. 主要な処理

| 処理 | 現在の入口 | 主な実装 | 出力・保存先 |
|---|---|---|---|
| 営業予定登録 | Googleフォーム | `SalesPlan.js`、`SalesPlanEngine.js` | 営業予定（生データ）、営業予定 |
| 営業報告 | 報告リンク、Googleフォーム | `VisitReport.js` | 訪問履歴、営業予定 |
| 地域情報登録 | Googleフォーム | `RegionInfo.js`、`RegionInfoEngine.js` | 地域情報共有（生データ）、地域情報共有 |
| 地域情報の予定化 | 管理シートのチェック | `RegionInfoEngine.js` | 営業予定、地域情報共有 |
| 振り返り | Google Sheets | `Dashboard.js` | 営業ダッシュボード |
| 名刺OCR | 既存OCR導線 | `OCR.js` | OCR関連シート、訪問履歴 |

## 5. 主なデータ

| データ | 正式な保存先 | 識別子・関係 |
|---|---|---|
| 営業予定 | 営業予定シート | PlanID |
| 地域情報 | 地域情報共有シート | 地域情報ID、営業予定PlanID |
| 訪問履歴 | 訪問履歴シート | 訪問履歴ID、PlanID |
| 紹介実績 | 紹介実績シート | 営業先・事業所・成果との関係 |
| 営業先 | 営業先マスター | 営業先名を中心とする既存構造 |

秘密情報や個人情報の実値は資料へ記載しない。

## 6. 外部サービス

| サービス | 用途 | 状態変更時の条件 |
|---|---|---|
| Google Apps Script | 業務処理、トリガー、Webhook候補 | 反映・実行前に対象と許可を確認 |
| Google Sheets | 正式な業務データ | 更新・削除・移行前にバックアップと許可 |
| Google Forms | v1.0入力UI | 再構築・切替前にバックアップと許可 |
| Google Drive | スキーマや関連ファイル | 作成・更新前に対象と許可 |
| Gemini API | 名刺OCR | 認証情報をGitへ保存しない |
| LINE WORKS | v2.0入力UI候補 | 方式、権限、送信情報は未確定 |
| GitHub | 安定地点と履歴 | commit・pushは許可後 |

## 7. 標準コマンド

- 開始パッケージ：`./tools/start_chat.sh --full`
- JavaScript構文：`node --check 対象ファイル.js`
- シェル構文：`bash -n tools/start_chat.sh`
- Git確認：`git status --short --branch`
- 外部反映：`clasp push`（対象と許可を確認後）
- 自動テスト：未整備

## 8. 変更内容と確認対象

| 変更内容 | 主な対象 | 最初に読む手順 |
|---|---|---|
| 文書・設定 | 対象文書・設定 | `docs/verification/release-checklist.md` |
| Apps Script関数 | 対象`.js` | `docs/verification/apps-script-function-test.md` |
| フォーム・画面 | Googleフォーム、将来のLINE WORKS | `docs/verification/browser-screen-test.md` |
| データ構造・移行 | スキーマ、シート、移行処理 | 専用手順を実作業前に作成 |
| GitHub保存 | 差分とProject Memory | `docs/verification/release-checklist.md` |

## 9. 更新条件

主要ファイル、責務、処理入口、保存先、外部サービス、標準コマンドが変わったときに更新する。
