function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('営業管理メニュー')
    .addItem('営業先データを整理する', 'maintenanceSalesMasterAndForm')
    .addItem('営業先マスター再構築', 'rebuildSalesMaster')
    .addSeparator()
    .addItem('営業予定シートを作成する', 'setupSalesPlanSheet')
    .addItem('営業予定フォームを作成する', 'setupSalesPlanForm')
    .addSeparator()
    .addItem('システム診断', 'systemHealthCheck')
    .addItem('システム構成を書き出す', 'exportAllSchemasToDrive')
    .addToUi();
}
