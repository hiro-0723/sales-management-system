# LINE WORKS連携 技術構成

更新日：2026-07-30
状態：初期構成案。Google Cloud基盤、テスト用Sheets、Apps Scriptを作成済み。内部入口はテスト用Apps Scriptへ反映し、専用内部Secretも設定済み。Cloud Runタスク処理はローカル実装・自動テスト済み。Bot・LINE WORKS用Secret・Cloud Runデプロイ・Webアプリデプロイは未実施。

## 1. 今回の1目的

LINE WORKS連携の最初の検証に使用するWebhook受信層、非同期処理、Apps Scriptへの内部接続、テスト範囲を具体化する。

## 2. 採用する初期方針

- Webhook受信層：Cloud Runサービス（Node.jsコンテナ）
- 非同期化：Cloud Tasks
- Apps Script接続：専用Webアプリ入口へ署名付きJSONをPOST
- 最初のLINE WORKS利用範囲：テスト用Botの1対1トーク
- 最初の業務機能：地域情報共有
- テスト環境：本番Bot、本番認証情報、本番保存先と分離
- 既存Googleフォーム：並行運用のため残す

## 3. 全体構成

```text
LINE WORKSテスト用Bot
  ↓ HTTPS Callback
Cloud Run: sales-lineworks-webhook-test
  1. 生の本文とヘッダーを取得
  2. Bot IDを確認
  3. X-WORKS-Signatureを検証
  4. イベント形式・時刻・種別を確認
  5. requestIdと内部ペイロードを生成
  6. Cloud Tasksへ登録
  7. LINE WORKSへHTTP 200を返す
  ↓
Cloud Tasks: lineworks-events-test
  ├─ タスク名による短期重複防止
  ├─ 配信速度制御
  ├─ 有限回の再試行
  └─ OIDC付きで署名付きJSONをPOST
  ↓
Cloud Run: /tasks/process
  1. Cloud Run IAM/OIDCで呼び出し元を認証
  2. キュー名を追加確認
  3. Apps Script内部入口へ署名付きJSONをPOST
  4. Apps ScriptのJSON結果を確認
  5. 成功・恒久エラーはHTTP 200
  6. 一時エラーはHTTP 503としてCloud Tasksへ返す
  ↓
Apps Script Webアプリ: doPost
  1. 内部署名と時刻を検証
  2. requestIdの処理済み確認
  3. 共通入力モデルを検証
  4. 地域情報登録サービスを実行
  5. 地域情報IDと結果を記録
  6. 成功時のみHTTP 200
  ↓
テスト用Google Sheets
  ↓
結果通知処理
  ↓ Bot API
LINE WORKS利用者
```

## 4. Cloud Runサービスを選ぶ理由

Cloud Runサービスは受信リクエストのヘッダーと生の本文を扱えるため、LINE WORKSの`X-WORKS-Signature`を検証できる。既存Google Cloudプロジェクトでは、通常のCloud Runサービス、Artifact Registry、Secret Managerがすでに利用可能で、Cloud Functions APIは有効化されていない。

そのため、新しい製品と権限を増やすCloud Run functionsではなく、確認済みの運用方式へ合わせた通常のCloud Runサービスを採用する。営業管理用サービスは既存の`lw-detail-auth`へ同居させず、別サービスとして作成する。

この変更のメリットは、既存のデプロイ方式とコンテナ保存先を流用でき、サービス単位で権限、ログ、ロールバックを分離できること。デメリットは、コンテナ構成とデプロイ設定を営業管理側で管理する必要があること。影響範囲はWebhook受信層の実装・デプロイ・検証手順だけで、既存Apps Scriptの業務ロジックとデータ構造は変更しない。

## 5. Cloud Tasksを選ぶ理由

- Callbackへ早くHTTP 200を返し、Sheets更新と切り離せる。
- 配信速度と再試行回数を設定できる。
- 障害時もタスクを保持できる。
- 任意のHTTPSエンドポイントへ本文とヘッダーを付けてPOSTできる。
- 指定したタスク名は完了後も最大24時間記憶され、短期の重複登録防止に利用できる。

Cloud Tasksのタスク名だけを永続的な冪等性保証にしない。Apps Script側でも`requestId`を保存し、再試行時に二重登録しない。

Cloud TasksからApps Scriptへは直接送らない。Apps Script Webアプリが返せる公式な出力は`TextOutput`または`HtmlOutput`であり、業務結果に応じたHTTPステータスを明示設定する公式手段を確認できない。一方、Cloud Tasksは2xxを成功、非2xxを失敗として再試行を判断する。

そのためCloud Tasksは営業管理用Cloud Runの`/tasks/process`を呼び、Cloud RunがApps ScriptのJSON結果をHTTP 200または503へ変換する。

変更理由：

- Sheets一時障害などを成功扱いにせず、Cloud Tasksへ再試行させるため。

メリット：

- 一時失敗と恒久的な入力エラーを区別できる。
- Cloud TasksからCloud Runへの呼び出しをIAM/OIDCで保護できる。
- 追加のCloud Runサービスを増やさず、外部Callbackと内部タスク処理を経路で分離できる。

デメリット：

- Cloud Runに`/tasks/process`の責務が増える。
- Apps ScriptのJSON応答仕様とCloud RunのHTTP変換仕様を一緒に管理する必要がある。

影響範囲：

- Cloud Run実装、Cloud Tasksの送信先、検証・障害対応手順。
- 既存Apps Script、本番Sheets、既存ID体系、Googleフォームは変更しない。

## 6. Apps Script APIを採用しない理由

Google Apps Script APIの`scripts.run`はリモート実行に使えるが、公式資料ではサービスアカウントに対応しないと明記されている。Cloud Runからの無人実行には継続的な利用者OAuthトークン管理が必要になり、初期構成として複雑になる。

そのため初期版では、Apps Scriptを専用Webアプリとして公開し、Cloud Runから送る内部ペイロード自体をHMAC-SHA256で署名する。

## 7. Apps Script内部入口の安全要件

Apps Script Webアプリでは任意のHTTPヘッダー取得に依存しない。認証情報はJSON本文に含める。

内部ペイロード案：

```json
{
  "version": 1,
  "requestId": "UUID",
  "issuedAt": "2026-07-28T00:00:00.000Z",
  "expiresAt": "2026-07-28T00:05:00.000Z",
  "payload": {
    "sourceSystem": "lineworks",
    "sourceEventKey": "HASH",
    "actorExternalId": "LINE_WORKS_USER_ID",
    "payloadType": "regionInfo",
    "data": {}
  },
  "signature": "BASE64_HMAC_SHA256"
}
```

署名対象は、`signature`を除いたデータを安定した順序で文字列化した値とする。より単純に、署名前の本文文字列を固定形式で生成し、その文字列へ署名して送る方式も検討する。

Apps Script側では次をすべて満たす場合だけ処理する。

- `version`が対応範囲内
- `requestId`が有効
- `issuedAt`と`expiresAt`が許容時間内
- 内部署名が一致
- `requestId`が未処理
- `payloadType`が許可済み
- 外部利用者IDが登録済み
- 必須項目と文字数が正常

内部共有秘密はCloud Secret ManagerとApps ScriptのScript Propertiesへ保存し、GitやSheetsへ保存しない。

## 8. 外部入口と内部入口の分離

### 外部入口

営業管理用Cloud RunサービスだけをLINE WORKS Callback URLとして公開する。LINE WORKS署名の検証に失敗したリクエストはCloud Tasksへ登録しない。

### 内部入口

Cloud TasksからCloud Runの`/tasks/process`へはOIDCを付ける。Cloud Run IAMを主な認証境界とし、Cloud Tasksヘッダーだけを認証に使用しない。

Apps Script WebアプリURLは技術上アクセス可能でも、内部署名、短い有効期限、requestIdの冪等性確認を通らない本文は処理しない。URL自体を秘密情報の代わりにしない。

## 9. 秘密情報

### Google Secret Manager

- LINE WORKS Bot Secret
- LINE WORKS Client Secret
- LINE WORKS Service Account秘密鍵
- 営業管理用Cloud RunサービスからApps Scriptへ渡す内部共有秘密

### Apps Script Script Properties

- 内部共有秘密
- 許可する送信元環境の識別子
- テスト用保存先ID

### 保存禁止

- Git
- Project Memory
- Google Sheetsの通常セル
- Cloud Loggingの本文
- LINE WORKSへのエラー返信

## 10. Google Cloud環境

確認済みのテスト・POC用プロジェクト`lw-detail-poc-20260724`を、初期検証の配置候補とする。既存の`lw-detail-auth`と`lw-detail-runtime`は別用途のため変更・共用せず、営業管理専用リソースを分離する。

```text
Google Cloud project: lw-detail-poc-20260724
├── Cloud Run
│   ├── lw-detail-auth（既存・変更しない）
│   └── sales-lineworks-webhook-test（新規候補）
├── Cloud Tasks
│   └── sales-lineworks-events-test（作成済み）
├── Artifact Registry
│   └── lw-detail（既存。格納方針を実装前に確認）
├── Secret Manager
│   ├── 既存LINE WORKS用Secret（対象Botを確認するまで流用しない）
│   └── sales-apps-script-internal-secret-test（新規候補）
├── Service Accounts
│   ├── lw-detail-runtime（既存・変更しない）
│   └── sales-lineworks-runtime（作成済み）
└── Cloud Logging
```

営業管理用サービスアカウントには、Cloud Tasksへの登録と営業管理で必要なSecretの参照だけを許可する。既存実行アカウントや既定サービスアカウントへ権限を追加しない。

確認済み：

- Cloud Run、Artifact Registry、Secret Manager APIは有効。
- Cloud Tasks APIは有効化済み。
- `sales-lineworks-runtime`を作成し、Cloud Tasks登録権限だけを付与した。
- `sales-lineworks-events-test`を作成した。最大2件/秒、同時2件、最大5回、最大10分の有限再試行とする。
- Google Driveに営業管理v2専用テストフォルダを作成した。
- 個人情報を含まない空のテスト用Sheetsを作成した。対象タブはREADME、地域情報共有（生データ）、地域情報共有。
- テスト用Sheetsに紐付くApps Script「営業管理システム v2 LINE WORKSテスト」を作成し、内部入口コードとマニフェストを反映した。Webアプリのデプロイ・権限承認・トリガーは未設定。
- 専用内部Secret`sales-apps-script-internal-secret-test`のVersion 1を作成し、営業管理専用実行アカウントだけへ参照権限を付与した。
- テスト用Apps ScriptのScript Property`SALES_LINEWORKS_INTERNAL_SECRET`へ同じ値を登録した。Secret値はログ・Git・Sheetsへ保存していない。
- 本番「営業管理マスター」は対象確認だけを行い、複製・変更していない。
- 既存Cloud Runサービスは外部呼び出し可能だが、営業管理用Callbackには使わない。
- 既存実行アカウントは既存Secretを参照できる。Secret値は未参照。
- 既存Cloud RunにはLINE WORKSのClient、Bot、サービスアカウント、監査用Secretがファイルとしてマウントされている。
- 既存のBot・認証情報は`lw-detail-auth`のSmile Riha用途に結び付くため、営業管理では流用しない。
- Secret値は確認せず、識別情報とマウント関係だけを確認した。

## 11. 最初の機能

最初は1対1トークからの地域情報共有だけを対象にする。

理由：

- PlanIDや訪問履歴の更新を伴わない。
- 既存の地域情報管理シートへ追加した後、管理者判断で営業予定化できる。
- 失敗時の影響範囲を限定できる。
- 社員・ケアマネ・代表が短時間で入力するという既存UX方針と一致する。

対象外：

- 複数人トーク
- 営業予定登録
- 営業報告
- 画像・ファイル・位置情報
- 本番データ
- Googleフォームの停止

## 12. 初期会話案

```text
利用者：「地域情報」
Bot：「部署を選んでください」
利用者：部署を選択
Bot：「情報の分類を選んでください」
利用者：分類を選択
Bot：「内容を入力してください」
利用者：内容を入力
Bot：「関連先があれば入力してください。なければ『なし』」
利用者：関連先または「なし」
Bot：確認内容を表示
利用者：「登録」
Bot：「地域情報ID REG-... で登録しました」
```

ボタン・ポストバック利用の詳細は、実装StepでLINE WORKSのメッセージテンプレート仕様を確認して確定する。

## 13. 最初のテスト環境

- LINE WORKS：テスト用Bot
- トーク：許可したテスト利用者との1対1のみ
- Google Cloud：テスト用プロジェクト
- Apps Script：テスト用デプロイ
- Google Sheets：本番の構造を複製し、個人情報を除いたテスト用データ
- Googleフォーム：本番・テストとも変更しない

## 14. 初期デプロイ順序

1. Google Cloudテストプロジェクトを用意する。（確認済み）
2. Cloud Tasks API、営業管理用サービスアカウント、Cloud Tasksキューを準備する。（完了）
3. Apps Script内部接続用Secretを準備する。（完了。LINE WORKS Bot用Secretは未準備）
4. 個人情報を含まないテスト用スプレッドシートを準備する。（完了）
5. Apps Scriptテスト用プロジェクトを準備する。（完了）
6. Apps Script内部入口を実装し、偽署名・期限切れ・重複をローカル相当で確認する。（自動テスト・テスト用プロジェクトへの反映完了）
7. Cloud Runのタスク処理でApps Script結果をHTTP 200/503へ変換する。（ローカル骨格・自動テスト完了）
8. Cloud TasksからCloud Runタスク処理、Apps Script内部入口への疎通を確認する。
9. 営業管理用Cloud RunサービスへCallback署名検証を実装する。
10. LINE WORKSテスト用Botを作成し、Callback URLを設定する。
11. 署名不一致と正常Callbackを確認する。
12. 地域情報共有の会話状態を追加する。
13. Googleフォームと既存処理の回帰確認を行う。

LINE WORKSのCallback URL設定は、受信関数の署名検証とログ制御が確認できた後に行う。

## 15. ロールバック

- LINE WORKSのCallbackを無効化する。
- テストBotの利用者公開を解除する。
- Cloud Tasksキューを一時停止する。
- 営業管理用Cloud Runサービスのトラフィックを直前リビジョンへ戻す。
- Apps Scriptテストデプロイを直前バージョンへ戻す。
- テスト用データを事前値へ復元する。

本番Googleフォームと既存業務処理は残すため、初期検証の停止によってv1.0運用を失わない構成とする。

## 16. 実装開始前に必要な確認

- Google Cloudを利用できるアカウントと請求設定：利用可能と利用者確認済み
- LINE WORKS Developer Consoleと管理者画面：アクセス可能と利用者確認済み
- テスト用Botを作成してよいテナント・ドメイン
- テスト用Apps Scriptとスプレッドシートの保存先
- LINE WORKS利用者IDと社内表示名のテスト用対応表
- テストに使ってよいダミーの部署、分類、関連先

Google Cloudのプロジェクト、Cloud Run、実行アカウント、Artifact Registry、Secretのメタデータと権限、および既存BotとSecretの接続関係は確認済み。既存Botと認証情報は別用途のため、営業管理用には流用しない。

## 17. 参照した公式資料

- Cloud Run「Container runtime contract」
  https://cloud.google.com/run/docs/container-contract
- Cloud Tasks「Create HTTP target tasks programmatically」
  https://cloud.google.com/tasks/docs/creating-http-target-tasks
- Cloud Tasks「Understand Cloud Tasks」
  https://cloud.google.com/tasks/docs/dual-overview
- Cloud Tasks REST「Task」
  https://cloud.google.com/tasks/docs/reference/rest/v2/projects.locations.queues.tasks
- Secret Manager「Best practices」
  https://cloud.google.com/secret-manager/docs/best-practices
- Google Apps Script API「Execute functions with the Google Apps Script API」
  https://developers.google.com/apps-script/api/how-tos/execute
- Google Apps Script「Web Apps」
  https://developers.google.com/apps-script/guides/web
