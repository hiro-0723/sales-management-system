# 開発現在地

## 1. 基本状態

- 更新日：2026-08-05
- 現在のPhase：v2.0設計準備
- 現在のStep：公開Callback受信サービスの実装・模擬実機確認完了、LINE WORKS実機Callback有効化前
- 現在ブランチ：`main`
- 移行開始ベースライン：`3e2a301bd0eddc35e7b4a755aa4b2801726ecef2 Phase8: 営業ダッシュボードVer1を追加`
- ベースライン時点のGitHub同期：`main`と`origin/main`が一致
- ベースライン時点の作業ツリー：クリーン
- 新エージェントシステムv2移行コミット：`01494eef191165f14a06520ad032b7a1d74bc23a 新エージェントシステムv2へ移行`
- 移行コミットのGitHub同期：完了
- 最新ローカルコミット：`68c24ba テスト用Webアプリのデプロイ結果を記録`
- 最新ローカルコミットのGitHub同期：完了
- 現在の作業ツリー：公開Callback署名検証コードとデプロイ結果を記録中。既存本番Apps Scriptコードの変更なし。

## 2. 完了済み

- Phase 1〜8
- v1.0現場検証版
- 約1か月の現場運用
- 営業予定、営業報告、訪問履歴、地域情報、営業予定変換、重複防止、ダッシュボードの主要経路

## 3. 現在の開発テーマ

Googleフォーム中心の入力UIをLINE WORKS中心へ移行するv2.0の設計を開始する。

想定構成：

```text
LINE WORKS
  → 署名検証可能なWebhook受信層
  → 検証済みイベント
  → Apps Script入力アダプター
  → 既存業務ロジック・Google Sheets
```

## 4. 完了した移行目的

- 目的：新エージェントシステムv2の運用資料と開始ツールを既存リポジトリへ導入する。
- 完了条件：Project Memory 4資料、AGENTS.md、Roadmap、検証資料、開始ツールが揃い、構成と差分を確認し、利用者の許可後にGitHubへ保存できる。
- 変更対象：`AGENTS.md`、`docs/`、`tools/start_chat.sh`
- 変更しない範囲：既存Apps Scriptコード、Google Sheets、Google Forms、トリガー、実データ、外部環境
- 読む検証手順：`docs/verification/release-checklist.md`
- 保存結果：利用者の許可後、commit・push完了

## 5. 完了した設計目的

- 目的：LINE WORKS連携の要件と、既存業務ロジックへ渡す入力境界を設計する。
- 結果：`docs/design/LINE_WORKS_INTEGRATION_REQUIREMENTS.md`に設計案を作成。
- 重要な判定：LINE WORKSが必須とする署名ヘッダーをApps Scriptの`doPost(e)`で取得できる公式根拠がないため、直接受信案は現時点で採用しない。
- 推奨案：署名検証可能なWebhook受信層で検証・早期応答し、検証済みイベントだけをApps Scriptの入力アダプターへ渡す。
- 変更しない範囲：既存Apps Script、Google Sheets、Google Forms、LINE WORKS設定、実データ。
- 保存結果：利用者の許可後、`6a84d00`としてcommit・push完了。

## 6. 現在扱う1つの目的

- 目的：Webhook受信層、非同期処理、Apps Script内部接続、最初の機能、テスト環境を具体化する。
- 推奨構成：営業管理専用Cloud Runサービス → Cloud Tasks → 署名付きApps Script内部入口。
- Apps Script API：サービスアカウント非対応のため初期版では不採用。
- 最初の範囲：テスト用Botの1対1トークから地域情報共有のみ。
- テスト環境：Google Cloud、Bot、Apps Script、Sheetsを本番と分離。
- 成果物：`docs/design/LINE_WORKS_TECHNICAL_ARCHITECTURE.md`と`docs/verification/line-works-webhook-test.md`。
- 変更しない範囲：既存Apps Scriptコード、Google Sheets、Google Forms、LINE WORKS設定、実データ。
- 状態：Google Cloud基盤、テストSheets、Apps Script内部入口、非公開Cloud Runワーカー、営業管理専用テストBot・Secret、公開Callbackサービスを作成済み。署名付き模擬Callbackから非公開ワーカーまで実機確認完了。LINE WORKS側Callbackは無効のまま。

## 7. 実施済みの確認

- 全既存`.js`：`node --check`成功
- `appsscript.json`と2つのスキーマJSON：構文確認成功
- `tools/start_chat.sh`：`bash -n`成功
- `tools/start_chat.sh --compact`：開始パッケージ生成成功
- 未記入プレースホルダー：なし
- 既存Apps Scriptコード・設定・スキーマの差分：なし
- `git diff --check`：問題なし

## 8. 未確認事項

- LINE WORKSの利用方式、API、認証、Webhook署名
- 利用者識別と営業担当名の対応
- 会話フローと入力項目
- 再送・重複・エラー・監査の設計
- Googleフォームとの並行運用と終了条件
- Apps Scriptのデプロイ・権限・復元方法
- 本番Apps Scriptが`3e2a301`と一致しているか
- テスト用Botを作成できるテナント・ドメイン
- テスト用Apps Scriptとスプレッドシートの保存先
- テスト利用者IDと社内表示名の対応

確認済み：

- Google Cloudを利用できるアカウントと請求設定がある。
- LINE WORKS Developer Consoleと管理者画面へアクセスできる。
- Google Cloudプロジェクト`lw-detail-poc-20260724`でCloud Run、Artifact Registry、Secret Managerを利用できる。
- 既存Cloud Runサービス、実行アカウント、Secretは別用途として維持し、営業管理用には共用しない。
- 既存LINE WORKS Bot、サービスアカウント、4つのSecretは`lw-detail-auth`のSmile Riha用途に接続されている。
- 既存Secretの値は確認せず、識別情報とマウント関係だけを確認した。
- Cloud Tasks APIは有効化済み。
- 営業管理専用実行アカウント`sales-lineworks-runtime`を作成し、Cloud Tasks登録権限だけを付与した。
- テストキュー`sales-lineworks-events-test`を作成し、低速・有限再試行に設定した。
- Google Drive上の本番「営業管理マスター」を特定したが、個人情報保護のため複製・変更していない。
- 専用Driveフォルダ「営業管理システム v2 テスト」を作成した。
- 空のテスト用Sheets「営業管理システム v2 LINE WORKSテスト」を作成し、README、地域情報共有（生データ）、地域情報共有の3タブを確認した。
- テスト用Sheetsは日本語ロケール、Asia/Tokyo、データシートの1行目固定を確認した。
- テスト用Sheetsに紐付くApps Script「営業管理システム v2 LINE WORKSテスト」を作成し、所有アカウントと接続先を確認した。
- テスト用Apps Scriptへ`InternalApi.js`と`appsscript.json`を反映した。トリガーは未設定。
- Webアプリのバージョン2を実行者「自分」、アクセス「全員」でデプロイした。デプロイIDは`AKfycbwWUtVjVuLAbPb-quAd8tuHdA0AIb6UdHnUhqmUKj18zfSt7ay72xNUxm5_oNmeExkPWw`。
- WebアプリURLは`https://script.google.com/macros/s/AKfycbwWUtVjVuLAbPb-quAd8tuHdA0AIb6UdHnUhqmUKj18zfSt7ay72xNUxm5_oNmeExkPWw/exec`。
- デプロイ直後、テスト用Sheetsの地域情報共有2シートがヘッダー行だけで、データ行がないことを確認した。
- Webアプリへの実機POSTで、不正署名は`SIGNATURE_MISMATCH`、正常署名は`REGISTERED`、同一requestIdの再送は`ALREADY_PROCESSED`となることを確認した。
- 日本語を含む署名対象の文字コード差異を防ぐため、Apps ScriptのHMAC計算へUTF-8を明示した。
- 専用内部Secret`sales-apps-script-internal-secret-test`のVersion 2を作成し、`sales-lineworks-runtime`だけへ参照権限を付与した。
- 同じ内部Secretをテスト用Apps ScriptのScript Property`SALES_LINEWORKS_INTERNAL_SECRET`へ登録した。値は画面出力・ログ・Git・Sheetsへ保存せず、作業用一時ファイルも削除した。
- Apps Scriptが業務結果に応じたHTTPステータスを返せないため、Cloud Tasksの送信先をCloud Run`/tasks/process`へ補正した。
- Apps Script内部入口に内部署名、期限、入力検証、requestId冪等性、処理途中復旧、地域情報登録のローカル骨格を追加した。
- Cloud Runタスク処理にApps Script結果をHTTP 200/503へ変換するローカル骨格を追加した。
- Apps Script 6ケース、Cloud Run 4ケースの自動テストがすべて成功した。
- ルートの本番用claspから`lineworks/`を除外し、既存本番Apps Scriptの送信対象が変わらないことを`clasp status`で確認した。
- 営業管理専用ビルドアカウント`sales-lineworks-build`を作成し、`roles/run.builder`だけを付与した。
- 非公開Cloud Runサービス`sales-lineworks-webhook-test`を専用実行アカウントでデプロイした。初回リビジョンは`sales-lineworks-webhook-test-00001-jsm`。
- 未認証アクセスではサービス内容を返さず、専用実行アカウントだけに`roles/run.invoker`を付与した。
- Cloud TasksからOIDC付きで`/tasks/process`を呼び、HTTP 200、Apps Scriptで`ALREADY_PROCESSED`、同一地域情報IDの返却を確認した。これによりCloud Tasksからテスト用Sheetsまでの登録と冪等性を実機確認した。
- LINE WORKSテナント`smile-riha`に営業管理専用テストBot（Bot ID `12871416`）をCallback無効・1対1限定・準備中で作成した。
- 専用Secret`sales-lineworks-bot-secret-test`を作成し、正しいBot SecretをVersion 2へ保存した。誤入力だったVersion 1は無効化し、専用実行アカウントだけへ参照権限を付与した。値はGit・ログ・Project Memoryへ保存していない。
- Cloud Runはサービス単位で公開範囲が決まるため、公開Callbackと非公開`/tasks/process`を別サービスへ分離する方針へ補正した。現在の`sales-lineworks-webhook-test`は名前を維持したまま非公開ワーカーとして扱う。
- 公開`sales-lineworks-callback-test`へBot ID確認、HMAC-SHA256署名検証、発行時刻、利用者ID、テキスト長、イベント種別制限、Cloud Tasks登録を実装した。
- 公開Callbackの不正署名はHTTP 401、正常署名と同一イベント再送はHTTP 200となり、非公開ワーカー`/tasks/callback`へOIDC付きで1件配送されることを確認した。営業データ登録は行わない受信確認段階。
- 非公開ワーカーはリビジョン`sales-lineworks-webhook-test-00002-l76`、公開Callbackは`sales-lineworks-callback-test-00003-n7l`が100%配信中。初回Callbackリビジョンの設定不足は修正済みでトラフィックなし。

## 9. 未着手機能

- LINE WORKS連携要件の利用者確認・確定
- LINE WORKS Webhook受信
- LINE WORKSからの営業予定登録
- LINE WORKSからの営業報告
- LINE WORKSからの地域情報共有
- 利用者への応答・エラー通知
- LINE WORKS連携の診断・検証手順
- Phase 9「予定・実績・紹介の振り返り」
- Phase 10「AI支援・アラート」

## 10. 次のStep

安定地点をGitHubへ保存後、LINE WORKSテストBotのCallback URLを公開サービスの`/callback`へ設定し、テキストイベントだけを有効化する。その後、テスト利用者を限定して実機Callbackを確認する。

## 11. 更新ルール

- 作業終了時または重要な安定地点で更新する。
- 文書移行だけで既存機能のPhaseを完了扱いにしない。
- コミット、同期、作業ツリーは実際のGit状態と一致させる。
- 未実施のLINE WORKS設計・テスト・実機確認を完了扱いにしない。
