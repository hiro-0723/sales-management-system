# LINE WORKS連携 技術構成

更新日：2026-07-28
状態：初期構成案。外部環境は未作成、コードは未実装。

## 1. 今回の1目的

LINE WORKS連携の最初の検証に使用するWebhook受信層、非同期処理、Apps Scriptへの内部接続、テスト範囲を具体化する。

## 2. 採用する初期方針

- Webhook受信層：Cloud Run functions（第2世代相当、Node.js）
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
Cloud Run functions: callbackReceiver
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
  └─ 署名付きJSONをPOST
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

## 4. Cloud Run functionsを選ぶ理由

Cloud Run functionsはHTTP関数として小さく開始でき、受信リクエストのヘッダーと本文を扱える。LINE WORKS署名検証に必要な`X-WORKS-Signature`は`X-Google-*`ではなく、Google Cloudが削除対象として明示するヘッダーにも該当しない。

初期検証では独自コンテナ管理を必要とせず、1つの受信関数へ責務を限定できる。複数エンドポイント、独自ミドルウェア、複雑な常駐処理が必要になった場合は通常のCloud Runサービスへ移行を検討する。

## 5. Cloud Tasksを選ぶ理由

- Callbackへ早くHTTP 200を返し、Sheets更新と切り離せる。
- 配信速度と再試行回数を設定できる。
- 障害時もタスクを保持できる。
- 任意のHTTPSエンドポイントへ本文とヘッダーを付けてPOSTできる。
- 指定したタスク名は完了後も最大24時間記憶され、短期の重複登録防止に利用できる。

Cloud Tasksのタスク名だけを永続的な冪等性保証にしない。Apps Script側でも`requestId`を保存し、再試行時に二重登録しない。

## 6. Apps Script APIを採用しない理由

Google Apps Script APIの`scripts.run`はリモート実行に使えるが、公式資料ではサービスアカウントに対応しないと明記されている。Cloud Run functionsからの無人実行には継続的な利用者OAuthトークン管理が必要になり、初期構成として複雑になる。

そのため初期版では、Apps Scriptを専用Webアプリとして公開し、Cloud Tasksから送る内部ペイロード自体をHMAC-SHA256で署名する。

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

Cloud Run functionsだけをLINE WORKS Callback URLとして公開する。LINE WORKS署名の検証に失敗したリクエストはCloud Tasksへ登録しない。

### 内部入口

Apps Script WebアプリURLは技術上アクセス可能でも、内部署名、短い有効期限、requestIdの冪等性確認を通らない本文は処理しない。URL自体を秘密情報の代わりにしない。

## 9. 秘密情報

### Google Secret Manager

- LINE WORKS Bot Secret
- LINE WORKS Client Secret
- LINE WORKS Service Account秘密鍵
- Cloud Run functionsからApps Scriptへ渡す内部共有秘密

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

## 10. Google Cloud環境案

初期検証は本番と分離したGoogle Cloudプロジェクトを推奨する。

```text
Google Cloud test project
├── Cloud Run functions
│   └── callbackReceiver
├── Cloud Tasks
│   └── lineworks-events-test
├── Secret Manager
│   ├── lineworks-bot-secret-test
│   └── apps-script-internal-secret-test
├── Service Accounts
│   └── lineworks-webhook-test
└── Cloud Logging
```

サービスアカウントには、Cloud Tasksへの登録と必要なSecretの参照だけを許可する。既定サービスアカウントへ広い権限を与えない。

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

1. Google Cloudテストプロジェクトを用意する。
2. 必要なAPI、サービスアカウント、Secret Manager、Cloud Tasksを準備する。
3. Apps Scriptテスト用プロジェクトとテスト用スプレッドシートを準備する。
4. Apps Script内部入口を実装し、偽署名・期限切れ・重複をローカル相当で確認する。
5. Cloud TasksからApps Script内部入口への疎通を確認する。
6. Cloud Run functionsへ署名検証だけを実装する。
7. LINE WORKSテスト用Botを作成し、Callback URLを設定する。
8. 署名不一致と正常Callbackを確認する。
9. 地域情報共有の会話状態を追加する。
10. Googleフォームと既存処理の回帰確認を行う。

LINE WORKSのCallback URL設定は、受信関数の署名検証とログ制御が確認できた後に行う。

## 15. ロールバック

- LINE WORKSのCallbackを無効化する。
- テストBotの利用者公開を解除する。
- Cloud Tasksキューを一時停止する。
- Cloud Run functionsのトラフィックを直前リビジョンへ戻す。
- Apps Scriptテストデプロイを直前バージョンへ戻す。
- テスト用データを事前値へ復元する。

本番Googleフォームと既存業務処理は残すため、初期検証の停止によってv1.0運用を失わない構成とする。

## 16. 実装開始前に必要な確認

- Google Cloudを利用できるアカウントと請求設定：利用可能と利用者確認済み
- LINE WORKS Developer Consoleと管理者画面：アクセス可能と利用者確認済み
- 他タスクで作成済みのGoogle Cloudプロジェクト、サービス、Bot、権限を再利用できるか
- テスト用Botを作成してよいテナント・ドメイン
- テスト用Apps Scriptとスプレッドシートの保存先
- LINE WORKS利用者IDと社内表示名のテスト用対応表
- テストに使ってよいダミーの部署、分類、関連先

他タスクの実装は存在すると聞いているが、この資料作成時点では実際のプロジェクト、Bot、設定、権限を未確認である。次Stepで読み取り確認し、推測で再利用対象を決めない。

## 17. 参照した公式資料

- Cloud Run functions「Request Headers」
  https://cloud.google.com/functions/docs/reference/headers
- Cloud Run functions「HTTP request body」
  https://cloud.google.com/functions/docs/samples/functions-http-content
- Cloud Tasks「Create HTTP target tasks programmatically」
  https://cloud.google.com/tasks/docs/creating-http-target-tasks
- Cloud Tasks「Understand Cloud Tasks」
  https://cloud.google.com/tasks/docs/dual-overview
- Secret Manager「Best practices」
  https://cloud.google.com/secret-manager/docs/best-practices
- Google Apps Script API「Execute functions with the Google Apps Script API」
  https://developers.google.com/apps-script/api/how-tos/execute
- Google Apps Script「Web Apps」
  https://developers.google.com/apps-script/guides/web
