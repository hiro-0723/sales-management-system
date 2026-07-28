# 新エージェントシステムv2 ガイド

## 1. 目的

担当AI、モデル、製品、過去チャットが変わっても、同じ設計、安全ルール、現在地、確認条件から営業管理システムの開発を続ける。

## 2. 正式な情報源

1. 既存の営業管理システム設計書
2. Project Memory 4資料
3. `AGENTS.md`
4. `docs/verification/`
5. 実コードとGit履歴・現在差分

Project Memoryは既存設計書を置き換えない。矛盾があればコードとGit履歴を調査し、推測で進めない。

## 3. Project Memory

- `01_SYSTEM_DESIGN.md`：目的、North Star、確定方針、未確定事項
- `02_DEVELOPMENT_RULES.md`：安全な開発、検証、反映、保存方法
- `03_PROJECT_MAP.md`：主要ファイル、処理、データ、外部サービス
- `04_CURRENT_STATUS.md`：Phase、Step、安定地点、現在の1目的、次の作業

Roadmapは`docs/ROADMAP.md`に、完了済み・進行中・今後予定だけを記録する。

## 4. 新しい作業の開始

```bash
./tools/start_chat.sh --full
```

作業ツリーがクリーンで短い開始情報だけが必要な場合：

```bash
./tools/start_chat.sh --compact
```

開始後は、Phase、Step、ベースライン、Git状態、未確認事項、今回の1目的を整理してから実装する。

## 5. 通常の開発順序

1. `AGENTS.md`、Project Memory、Roadmapを読む。
2. Git状態と最新コミットを確認する。
3. 今回の1目的と変更しない範囲を決める。
4. 必要な検証手順だけを読む。
5. 最小変更を実施する。
6. 構文、テスト、差分を確認する。
7. 必要な場合だけ、許可後にApps Scriptや外部環境へ反映する。
8. 実機確認と確認用データの復元を行う。
9. Project Memoryを実態へ合わせる。
10. 許可後にcommit・pushし、同期を確認する。

## 6. 外部状態を変える操作

Apps Script反映、関数実行、Google Sheets・Formsの変更、LINE WORKSへの送信、権限変更、commit、pushでは、対象、影響、復元方法、許可条件を確認する。

## 7. v2.0移行時の注意

- LINE WORKSは新しい入力UIであり、既存業務データの正本を無断で変更しない。
- Googleフォームを直ちに削除しない。
- 認証、署名、利用者識別、再送、重複防止、エラー、監査を設計してからWebhookを実装する。
- 既存の`SalesPlanEngine.js`、`RegionInfoEngine.js`、`VisitReport.js`へ直接LINE WORKS固有処理を混ぜず、専用の入力境界から接続する。
- `地域情報ID → PlanID → 訪問履歴ID → 紹介実績`を維持する。

## 8. GitHubの役割

必要なテストと実機確認を完了した安定地点、Project Memory、変更理由を保存する。未確認状態を安定地点として保存しない。

## 9. 困ったとき

| 内容 | 確認場所 |
|---|---|
| 目的・設計 | `01_SYSTEM_DESIGN.md`と既存設計書 |
| 開発手順 | `02_DEVELOPMENT_RULES.md` |
| ファイル・処理・保存先 | `03_PROJECT_MAP.md` |
| 現在地 | `04_CURRENT_STATUS.md` |
| 今後の順序 | `docs/ROADMAP.md` |
| 担当AIのルール | `AGENTS.md` |
| 確認方法 | `docs/verification/` |
| 保存可否 | `docs/verification/release-checklist.md` |

最も重要なのは、担当者が変わっても推測ではなく、同じ正式資料と確認根拠から安全に続けられることである。
