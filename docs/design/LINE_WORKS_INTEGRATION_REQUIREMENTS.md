# LINE WORKS連携 要件・入力境界設計

更新日：2026-07-28
状態：推奨方針は利用者確認済み。技術詳細と外部環境は実装前に確認する。

## 1. 今回の1目的

LINE WORKSを営業管理システムの入力UIとして利用するために、既存データと業務ロジックを保護できる接続境界を定める。

このStepではコード、Apps Script、Google Sheets、Google Forms、LINE WORKS設定を変更しない。

## 2. 公式仕様から確認できたこと

- LINE WORKS Botは、HTTPSのCallback URLへJSON形式のイベントをPOSTする。
- Callbackには`X-WORKS-BotId`と`X-WORKS-Signature`ヘッダーが含まれる。
- Bot Secretとリクエスト本文からHMAC-SHA256を計算し、Base64化した値を`X-WORKS-Signature`と比較する必要がある。
- 署名検証前にイベントを処理してはいけない。
- Callbackへの応答はHTTP 200とし、後続イベントを遅延させないため処理の非同期化が推奨されている。
- イベントには`source.userId`、必要に応じて`source.channelId`、`source.domainId`、`issuedTime`、メッセージ内容が含まれる。
- Botから利用者またはトークルームへの送信はBot APIを使い、API呼び出しにはアクセストークンが必要である。
- Botメッセージ関連の最小Scopeは`bot.message`である。
- APIにはRate Limitと同時接続数制限があり、429時はリセット後に再試行する。
- Apps Script Webアプリの`doPost(e)`で公式に定義されるイベント情報は、クエリ、パラメータ、本文、本文のMIMEタイプなどであり、任意のリクエストヘッダーは定義されていない。

## 3. 直接接続案の判定

当初案：

```text
LINE WORKS → Apps Script Webアプリ → 既存業務ロジック
```

判定：現時点では採用しない。

理由：

- LINE WORKSが必須としている`X-WORKS-Signature`を、Apps Scriptの`doPost(e)`だけでは安全に取得・検証できない可能性が高い。
- 署名を検証しない直接受信は、第三者による偽イベントで営業データが更新される危険がある。
- Callbackへ速やかに200を返す受信処理と、Sheetsを更新する業務処理を分離しにくい。

Apps Scriptでヘッダーを安全に取得できる公式な方法が別途確認できた場合のみ、再評価する。

## 4. 推奨構成

```text
LINE WORKS Bot
  ↓ HTTPS Callback
署名検証可能なWebhook受信層
  ├─ Bot ID確認
  ├─ X-WORKS-Signature検証
  ├─ JSON形式・時刻・イベント種別確認
  ├─ 重複受付防止
  ├─ 受付記録
  └─ LINE WORKSへHTTP 200を早期返却
  ↓ 検証済みイベント
非同期キューまたは安全な内部呼び出し
  ↓
Apps Script入力アダプター
  ↓ 共通入力モデル
業務サービス
  ├─ 営業予定登録
  ├─ 営業報告登録
  └─ 地域情報登録
  ↓
既存Google Sheets・既存ID体系
```

Webhook受信層の候補はCloud RunまたはCloud Functionsなど、HTTPSヘッダーと生の本文を取得できる実行環境とする。製品の最終選定は、費用、運用者、Google Cloud利用可否を確認してから決める。

## 5. 構成変更の説明

### 変更理由

LINE WORKSが要求する署名検証と早期応答を確実に行い、未検証の外部入力から既存営業データを守るため。

### メリット

- 偽イベントを業務処理へ渡さない。
- LINE WORKS固有処理と既存Apps Scriptを分離できる。
- 再送、重複、失敗、監査を受付層で管理できる。
- Googleフォームを残した並行運用がしやすい。
- 将来UIが変わっても共通入力モデル以降を流用できる。

### デメリット

- Apps Scriptだけの構成より、運用対象が1つ増える。
- Google Cloudの設定、権限、ログ、費用管理が必要になる。
- 内部呼び出しの認証と秘密情報管理が追加で必要になる。
- 障害箇所と監視対象が増える。

### 影響範囲

- LINE WORKS Developer Consoleと管理者画面
- Webhook受信環境
- Apps Scriptの新規入力アダプター
- 認証情報とログの管理
- 検証・復元・障害対応手順

既存Googleフォーム、既存Sheets、既存ID、既存ダッシュボードは、この構成決定だけでは変更しない。

## 6. 共通入力境界

LINE WORKS固有のイベントを、そのまま既存エンジンへ渡さない。検証済みイベントを次の共通形式へ変換する。

### 共通メタデータ

| 項目 | 必須 | 意味 |
|---|---:|---|
| `requestId` | 必須 | システム内の受付ID |
| `sourceSystem` | 必須 | `lineworks`または`google-form` |
| `sourceEventKey` | 必須 | 重複判定に使う安定したキー |
| `receivedAt` | 必須 | システムが受信した日時 |
| `issuedAt` | 必須 | 入力元でイベントが作成された日時 |
| `actorExternalId` | 必須 | LINE WORKSの`source.userId`など |
| `actorInternalName` | 保存前必須 | 既存の営業担当名・投稿者名 |
| `conversationId` | 任意 | 複数人トークでは`channelId` |
| `payloadType` | 必須 | `salesPlan`、`visitReport`、`regionInfo` |
| `payload` | 必須 | 種別ごとの業務入力 |

### 営業予定入力

| 項目 | 必須 |
|---|---:|
| 日付 | 必須 |
| 営業担当 | 必須 |
| 営業先 | 必須 |
| 予定時間 | 任意 |
| 目的 | 任意 |
| 優先度 | 任意 |
| 予定所要時間 | 任意 |
| 同行者 | 任意 |
| 備考 | 任意 |
| 地域情報ID | 任意 |

PlanIDは外部入力に持たせず、既存ルールと互換性のある方法で業務サービス側が発行する。

### 営業報告入力

| 項目 | 必須 |
|---|---:|
| PlanID | 必須 |
| 営業担当 | 必須 |
| 営業先 | 必須 |
| 営業内容 | 必須 |
| 次回予定 | 任意 |
| メモ | 任意 |

営業予定の完了更新と訪問履歴IDの書き戻しは、既存の追跡関係を維持して実行する。

### 地域情報入力

| 項目 | 必須 |
|---|---:|
| 投稿者 | 必須 |
| 部署 | 必須 |
| 情報分類 | 必須 |
| 内容 | 必須 |
| 関連先 | 任意 |
| 対応優先度 | 任意 |
| 営業担当に動いてほしいか | 任意 |

地域情報IDは外部入力に持たせず、業務サービス側が発行する。

## 7. 既存エンジンの流用判定

### 現状

- `SalesPlanEngine.js`はフォーム回答シートと送信行を前提に、最大10件を展開する。
- `RegionInfoEngine.js`は「地域情報共有（生データ）」の行を前提に転記する。
- `VisitReport.js`は営業活動報告フォーム回答シートの行を前提に予定を更新する。

### 判定

既存のID、列、状態更新ロジックは流用できるが、現在の関数をLINE WORKSからそのまま呼ぶことはできない。

### 推奨する最小リファクタリング

1. 入力元に依存しない業務関数を新設する。
2. 既存フォーム送信関数は、フォーム行を共通入力へ変換して業務関数を呼ぶ。
3. LINE WORKS入力アダプターも、検証済みイベントを同じ共通入力へ変換して業務関数を呼ぶ。
4. 既存フォーム経路の結果が変わらないことを回帰確認する。

想定責務：

```text
Googleフォーム用アダプター ─┐
                            ├→ 共通業務サービス → 既存Sheets
LINE WORKS用アダプター ─────┘
```

既存関数の一括置換は行わず、業務関数を1処理ずつ抽出する。

## 8. セキュリティ要件

- 署名不一致、Bot ID不一致、JSON不正、未対応イベントは業務処理へ渡さない。
- Bot Secret、Client Secret、Service Account秘密鍵、内部共有秘密はGitやSheetsへ保存しない。
- 最小権限を使い、Botメッセージだけならまず`bot.message`を検討する。
- 利用者対応表はLINE WORKSの外部IDと既存表示名を分離する。
- メッセージ本文、個人情報、秘密値を無制限にログへ残さない。
- 本番とテストのBot、Callback URL、認証情報、保存先を分ける。
- 未登録利用者からの業務登録は拒否し、案内だけを返す。

## 9. 重複・再送・同時実行

- 同一イベントの再送を前提に、受付処理と業務登録を冪等にする。
- `sourceEventKey`の確定方法は、公式イベントに安定したイベントIDがあるか追加確認して決める。
- イベントIDを利用できない場合は、Bot ID、userId、channelId、issuedTime、本文ハッシュなどから候補キーを作るが、衝突評価が必要である。
- Apps Script側では`LockService`などを使い、同一IDの同時登録を防ぐ設計を検討する。
- Bot APIの429ではRate Limitのリセット後に再試行し、無制限再試行を行わない。

## 10. 応答とエラー

- Callback受信層は署名検証と受付の成否を分け、LINE WORKSへ早期にHTTP 200を返す設計を基本とする。
- 利用者には「受付」「入力不足」「登録完了」「登録失敗」を区別して通知する。
- 入力途中の会話状態には有効期限を設ける。
- 業務登録失敗時に同じ内容を安全に再処理できるよう、受付IDと状態を残す。
- 管理者向けエラーには秘密値や不要な個人情報を含めない。

## 11. 段階導入案

1. テスト用BotとWebhook受信層を用意し、署名検証、200応答、ログ最小化だけを確認する。
2. 利用者ID対応と未登録者拒否を確認する。
3. 地域情報共有を最初の業務入力候補として実装する。
4. 営業予定登録を1件入力から実装する。
5. PlanIDを指定した営業報告を実装する。
6. Googleフォームと並行運用して結果を比較する。
7. 切替条件、復元条件、Googleフォームの扱いを確定する。

地域情報共有を先にする案は、営業予定の完了更新や訪問履歴連携より影響範囲が小さいためである。最初の業務入力は利用者確認後に確定する。

## 12. 確認済み方針と準備時の確認

確認済み：

- 署名検証可能なGoogle Cloud受信層を置く。
- 最初は1対1トークに限定する。
- 最初の対象機能は地域情報共有とする。
- テスト用Bot、Apps Script、保存先を本番と分離する。
- Googleフォームを並行運用する。

準備時に確認する：

1. LINE WORKS管理者権限とDeveloper Consoleへアクセスできる担当者
2. LINE WORKSの利用者IDと既存の社内表示名を対応付ける担当者
3. テスト用Botを作成できるテナント・ドメイン
4. テスト用Apps Scriptとスプレッドシートの保存先
5. Googleフォームとの並行運用期間と移行完了条件
6. LINE WORKSへ送信・表示してよい営業情報の範囲

## 13. 完了条件

- 直接Apps Script受信の可否判断が記録されている。
- 推奨構成、責務、共通入力モデルが記録されている。
- 既存エンジンの流用範囲と必要な最小リファクタリングが記録されている。
- セキュリティ、重複、再送、エラー、並行運用の要件が分離されている。
- 利用者が決める事項と、公式仕様で追加確認する事項が明確である。

## 14. 参照した公式資料

- LINE WORKS Developers「Callback（メッセージの受信）」
  https://developers.worksmobile.com/jp/docs/bot-callback
- LINE WORKS Developers「Message Event」
  https://developers.worksmobile.com/jp/docs/bot-callback-message
- LINE WORKS Developers「Bot API」
  https://developers.worksmobile.com/en/docs/bot-api
- LINE WORKS Developers「Authentication with a Service Account (JWT)」
  https://developers.worksmobile.com/en/docs/auth-jwt
- LINE WORKS Developers「API 使用の上限」
  https://developers.worksmobile.com/jp/docs/rate-limits
- Google for Developers「Web Apps」
  https://developers.google.com/apps-script/guides/web
