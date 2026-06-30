function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('営業管理メニュー')
    .addItem('システム初期設定', 'setupSystem')
    .addSeparator()
    .addItem('営業先データを整理する', 'maintenanceSalesMasterAndForm')
    .addItem('営業先マスター再構築', 'rebuildSalesMaster')
    .addSeparator()
    .addItem('フォーム候補を最新化', 'updateAllForms')
    .addSeparator()
    .addItem('システム診断', 'systemHealthCheck')
    .addItem('システム構成を書き出す', 'exportAllSchemasToDrive')
    .addToUi();
}
