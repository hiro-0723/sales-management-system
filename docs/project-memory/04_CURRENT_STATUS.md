# 開発現在地

## 1. 基本状態

- 更新日：2026-07-28
- 現在のPhase：v2.0設計準備
- 現在のStep：新エージェントシステムv2資料生成・ローカル検証完了、GitHub保存前
- 現在ブランチ：`main`
- 移行開始ベースライン：`3e2a301bd0eddc35e7b4a755aa4b2801726ecef2 Phase8: 営業ダッシュボードVer1を追加`
- ベースライン時点のGitHub同期：`main`と`origin/main`が一致
- ベースライン時点の作業ツリー：クリーン
- 現在の作業ツリー：新エージェントシステムv2資料と開始ツールが未追跡。既存Apps Scriptコードの変更なし。

## 2. 完了済み

- Phase 1〜8
- v1.0現場検証版
- 約1か月の現場運用
- 営業予定、営業報告、訪問履歴、地域情報、営業予定変換、重複防止、ダッシュボードの主要経路

## 3. 現在の開発テーマ

Googleフォーム中心の入力UIをLINE WORKS中心へ移行するv2.0の設計を開始する。

想定構成：

```text
LINE WORKS → Webhook → Apps Script → 既存業務ロジック・Google Sheets
```

## 4. 現在扱う1つの目的

- 目的：新エージェントシステムv2の運用資料と開始ツールを既存リポジトリへ導入する。
- 完了条件：Project Memory 4資料、AGENTS.md、Roadmap、検証資料、開始ツールが揃い、構成と差分を確認し、利用者の許可後にGitHubへ保存できる。
- 変更対象：`AGENTS.md`、`docs/`、`tools/start_chat.sh`
- 変更しない範囲：既存Apps Scriptコード、Google Sheets、Google Forms、トリガー、実データ、外部環境
- 読む検証手順：`docs/verification/release-checklist.md`
- 必要な許可：ローカル資料生成は確認済み。commit・pushは別途許可が必要。

## 5. 実施済みの確認

- 全既存`.js`：`node --check`成功
- `appsscript.json`と2つのスキーマJSON：構文確認成功
- `tools/start_chat.sh`：`bash -n`成功
- `tools/start_chat.sh --compact`：開始パッケージ生成成功
- 未記入プレースホルダー：なし
- 既存Apps Scriptコード・設定・スキーマの差分：なし
- `git diff --check`：問題なし

## 6. 未確認事項

- LINE WORKSの利用方式、API、認証、Webhook署名
- 利用者識別と営業担当名の対応
- 会話フローと入力項目
- 再送・重複・エラー・監査の設計
- Googleフォームとの並行運用と終了条件
- Apps Scriptのデプロイ・権限・復元方法
- 本番Apps Scriptが`3e2a301`と一致しているか

## 7. 未着手機能

- LINE WORKS連携の要件定義
- LINE WORKS Webhook受信
- LINE WORKSからの営業予定登録
- LINE WORKSからの営業報告
- LINE WORKSからの地域情報共有
- 利用者への応答・エラー通知
- LINE WORKS連携の診断・検証手順
- Phase 9「予定・実績・紹介の振り返り」
- Phase 10「AI支援・アラート」

## 8. 次のStep

新エージェントシステムv2の資料差分を利用者が確認し、許可後にcommit・pushする。その次にLINE WORKS連携の公式仕様と現場要件を確認し、既存エンジンへ渡す入力境界を設計する。

## 9. 更新ルール

- 作業終了時または重要な安定地点で更新する。
- 文書移行だけで既存機能のPhaseを完了扱いにしない。
- コミット、同期、作業ツリーは実際のGit状態と一致させる。
- 未実施のLINE WORKS設計・テスト・実機確認を完了扱いにしない。
