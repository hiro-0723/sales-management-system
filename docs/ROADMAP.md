# 営業管理システム Roadmap

## 完了済み

- Phase 1：基盤整備
- Phase 2：営業予定＝宣言
- Phase 3：フォーム同期エンジン
- Phase 4：システム初期設定
- Phase 5：営業予定と訪問履歴の接続
- Phase 6：地域情報共有
- Phase 7：地域情報から営業予定への自動反映
- Phase 8：営業ダッシュボード Ver.1
- v1.0：約1か月の現場運用

## 進行中

- Cloud Runサービス、Cloud Tasks、Apps Script内部入口を使う初期構成案の確認
- Google Cloud環境と既存LINE WORKS Bot・Secretの対応確認完了
- Cloud Tasks API、営業管理専用実行アカウント、専用テストキューの準備完了
- 個人情報を含まない空のテスト用Sheetsと専用Driveフォルダの準備完了
- テスト用Apps Scriptの作成と専用Sheetsへの接続完了
- Apps Script内部入口とCloud Runタスク処理のローカル骨格・自動テスト完了
- 営業管理専用の内部Secret作成、実行アカウントへの参照権限付与、テスト用Apps Scriptへのコード・Script Properties反映完了
- テスト用Apps Script Webアプリのバージョン2を「全員」でデプロイ完了
- Apps Script内部入口の不正署名拒否、新規登録、requestId重複防止を実機POSTで確認完了
- 非公開Cloud Runサービスの初回デプロイ完了
- Cloud TasksからCloud Run、Apps Script、テスト用Sheetsまでの実機疎通と冪等性確認完了
- 営業管理専用Bot、LINE WORKS用Secret、Cloud Runの準備
- 地域情報共有の1対1トーク検証準備

## 今後予定

1. LINE WORKSテストBotと専用Secretを準備する。
2. Cloud RunへCallback署名検証とCloud Tasks登録処理を実装する。
3. Googleフォームを残したまま、Webhook受付、署名検証、非同期配送、Apps Script内部入口の最小経路を実装する。
4. テスト環境で営業予定登録、営業報告、地域情報共有を順番に検証する。
5. 並行運用、切替条件、復元方法を確定してv2.0へ移行する。
6. Phase 9：予定・実績・紹介の振り返りを再評価する。
7. Phase 10：AI支援・アラートを再評価する。

LINE WORKS移行を理由に、Phase 9・10を完了扱いにしない。順序は設計確認と現場優先度により変更できるが、変更理由を記録する。
