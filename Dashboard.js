/**
 * Dashboard.js
 * 営業管理システムの閲覧用ダッシュボードを作成・更新する。
 */

function setupDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('営業ダッシュボード');

  if (!sheet) sheet = ss.insertSheet('営業ダッシュボード');

  sheet.clear();
  sheet.getRange('A1').setValue('営業ダッシュボード');
  sheet.getRange('A2').setValue('更新日時');
  sheet.getRange('A4').setValue('今日の営業予定');
  sheet.getRange('A20').setValue('担当者別予定件数');
  sheet.getRange('A30').setValue('未対応地域情報');
  sheet.getRange('A45').setValue('営業予定へ反映済み地域情報');

  updateDashboard();
}

function updateDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dashboard = ss.getSheetByName('営業ダッシュボード');
  if (!dashboard) throw new Error('営業ダッシュボードシートがありません');

  dashboard.getRange('B2').setValue(new Date()).setNumberFormat('yyyy/MM/dd HH:mm');

  updateDashboardSummary_(dashboard);
  updateTodaySalesPlans_(dashboard);
  updateStaffPlanCounts_(dashboard);
  updatePendingRegionInfo_(dashboard);
  updateConvertedRegionInfo_(dashboard);
  formatDashboard_(dashboard);

  ss.toast('営業ダッシュボードを更新しました。', '営業ダッシュボード', 5);
}

function updateDashboardSummary_(dashboard) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sales = ss.getSheetByName('営業予定');
  const region = ss.getSheetByName('地域情報共有');

  let total = 0, done = 0, pending = 0, regionPending = 0;
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd');

  if (sales && sales.getLastRow() >= 2) {
    const headers = sales.getRange(1, 1, 1, sales.getLastColumn()).getValues()[0];
    const col = name => headers.indexOf(name);
    const values = sales.getRange(2, 1, sales.getLastRow() - 1, sales.getLastColumn()).getValues();

    values.forEach(row => {
      const date = row[col('日付')];
      if (!date) return;
      const dateText = Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'yyyy/MM/dd');
      if (dateText !== today) return;

      total++;
      if (row[col('状態')] === '完了') done++;
      else pending++;
    });
  }

  if (region && region.getLastRow() >= 2) {
    const headers = region.getRange(1, 1, 1, region.getLastColumn()).getValues()[0];
    const col = name => headers.indexOf(name);
    const lastRow = getLastRegionInfoDashboardRow_(region, col('地域情報ID') + 1);

    if (lastRow >= 2) {
      const values = region.getRange(2, 1, lastRow - 1, region.getLastColumn()).getValues();

      regionPending = values.filter(row => {
        const status = row[col('対応状況')];
        const planId = row[col('営業予定PlanID')];
        return !planId && (!status || status === '未対応' || status === '確認中');
      }).length;
    }
  }

  dashboard.getRange('D1:K1').setValues([[
    '今日予定', total, '完了', done, '未実施', pending, '未対応地域情報', regionPending
  ]]);
}

function updateTodaySalesPlans_(dashboard) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('営業予定');
  if (!sheet) return;

  dashboard.getRange('A5:I18').clearContent().clearFormat();

  const outputHeaders = ['日付', '営業担当', '営業先', '予定時間', '目的', '状態', '営業報告', '地域情報ID', 'PlanID'];
  dashboard.getRange(5, 1, 1, outputHeaders.length).setValues([outputHeaders]);

  if (sheet.getLastRow() < 2) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const col = name => headers.indexOf(name);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd');

  const rows = values.filter(row => {
    const date = row[col('日付')];
    if (!date) return false;
    return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'yyyy/MM/dd') === today;
  }).map(row => [
    row[col('日付')],
    row[col('営業担当')],
    row[col('営業先')],
    row[col('予定時間')],
    row[col('目的')],
    row[col('状態')],
    col('営業報告') >= 0 ? row[col('営業報告')] : '',
    col('地域情報ID') >= 0 ? row[col('地域情報ID')] : '',
    row[col('PlanID')]
  ]);

  if (rows.length > 0) {
    dashboard.getRange(6, 1, rows.length, outputHeaders.length).setValues(rows);

    rows.forEach((row, i) => {
      const cell = dashboard.getRange(6 + i, 6);
      if (row[5] === '完了') cell.setBackground('#d9ead3');
      else if (row[5]) cell.setBackground('#fff2cc');
    });
  }
}

function updateStaffPlanCounts_(dashboard) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('営業予定');
  if (!sheet) return;

  dashboard.getRange('A21:C28').clearContent();
  dashboard.getRange(21, 1, 1, 3).setValues([['営業担当', '今日の予定件数', '未実施件数']]);

  if (sheet.getLastRow() < 2) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const col = name => headers.indexOf(name);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd');
  const counts = {};

  values.forEach(row => {
    const date = row[col('日付')];
    if (!date) return;
    if (Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'yyyy/MM/dd') !== today) return;

    const staff = row[col('営業担当')] || '未設定';
    if (!counts[staff]) counts[staff] = { total: 0, pending: 0 };
    counts[staff].total++;
    if (row[col('状態')] !== '完了') counts[staff].pending++;
  });

  const rows = Object.keys(counts).map(staff => [staff, counts[staff].total, counts[staff].pending]);
  if (rows.length > 0) dashboard.getRange(22, 1, rows.length, 3).setValues(rows);
}

function updatePendingRegionInfo_(dashboard) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('地域情報共有');
  if (!sheet) return;

  dashboard.getRange('A31:H43').clearContent();
  const outputHeaders = ['地域情報ID', '投稿者', '部署', '情報分類', '関連先', '対応優先度', '対応状況', '内容'];
  dashboard.getRange(31, 1, 1, outputHeaders.length).setValues([outputHeaders]);

  if (sheet.getLastRow() < 2) {
    dashboard.getRange('A32').setValue('未対応地域情報はありません。');
    return;
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const col = name => headers.indexOf(name);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  const rows = values.filter(row => {
    const status = row[col('対応状況')];
    const planId = row[col('営業予定PlanID')];
    return !planId && (!status || status === '未対応' || status === '確認中');
  }).slice(0, 10).map(row => [
    row[col('地域情報ID')],
    row[col('投稿者')],
    row[col('部署')],
    row[col('情報分類')],
    row[col('関連先')],
    row[col('対応優先度')],
    row[col('対応状況')],
    row[col('内容')]
  ]);

  if (rows.length > 0) dashboard.getRange(32, 1, rows.length, outputHeaders.length).setValues(rows);
  else dashboard.getRange('A32').setValue('未対応地域情報はありません。');
}

function updateConvertedRegionInfo_(dashboard) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('地域情報共有');
  if (!sheet) return;

  dashboard.getRange('A46:H58').clearContent();
  const outputHeaders = ['地域情報ID', '営業担当', '関連先', '対応状況', '営業予定PlanID', '営業予定反映日', '二重追加防止', '内容'];
  dashboard.getRange(46, 1, 1, outputHeaders.length).setValues([outputHeaders]);

  if (sheet.getLastRow() < 2) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const col = name => headers.indexOf(name);
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  const rows = values.filter(row => row[col('営業予定PlanID')]).slice(-10).reverse().map(row => [
    row[col('地域情報ID')],
    row[col('営業担当')],
    row[col('関連先')],
    row[col('対応状況')],
    row[col('営業予定PlanID')],
    row[col('営業予定反映日')],
    row[col('二重追加防止フラグ')],
    row[col('内容')]
  ]);

  if (rows.length > 0) dashboard.getRange(47, 1, rows.length, outputHeaders.length).setValues(rows);
}

function formatDashboard_(sheet) {
  sheet.setFrozenRows(4);
  sheet.getRange('A1').setFontWeight('bold').setFontSize(18);
  sheet.getRange('D1:K1').setFontWeight('bold');
  sheet.getRange('A4').setFontWeight('bold');
  sheet.getRange('A20').setFontWeight('bold');
  sheet.getRange('A30').setFontWeight('bold');
  sheet.getRange('A45').setFontWeight('bold');

  sheet.getRange('A5:I5').setFontWeight('bold').setBackground('#d9eaf7');
  sheet.getRange('A21:C21').setFontWeight('bold').setBackground('#d9eaf7');
  sheet.getRange('A31:H31').setFontWeight('bold').setBackground('#d9eaf7');
  sheet.getRange('A46:H46').setFontWeight('bold').setBackground('#d9eaf7');

  sheet.getRange('D1:K1')
    .setBackground('#fff2cc')
    .setFontWeight('bold')
    .setFontSize(12)
    .setHorizontalAlignment('center');

  sheet.getRange('E1').setFontSize(16);
  sheet.getRange('G1').setFontSize(16);
  sheet.getRange('I1').setFontSize(16);
  sheet.getRange('K1').setFontSize(16);

  sheet.getRange('G6:G18')
    .setBackground('#cfe2f3')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange('A5:I18').setBorder(true, true, true, true, true, true);
  sheet.getRange('A21:C28').setBorder(true, true, true, true, true, true);
  sheet.getRange('A31:H43').setBorder(true, true, true, true, true, true);
  sheet.getRange('A46:H58').setBorder(true, true, true, true, true, true);

  sheet.setColumnWidths(1, 9, 110);
  sheet.setColumnWidth(3, 190);
  sheet.setColumnWidth(5, 140);
  sheet.setColumnWidth(8, 170);
  sheet.setColumnWidth(9, 160);

  sheet.getRange('A6:I18').setWrap(true);
  sheet.getRange('A32:H43').setWrap(true);
  sheet.getRange('A47:H58').setWrap(true);

  sheet.setRowHeights(6, 13, 28);
  sheet.setRowHeights(32, 12, 26);
  sheet.setRowHeights(47, 12, 26);

  sheet.getRange('A1:K58').setVerticalAlignment('middle');
  sheet.getRange('A5:I18').setHorizontalAlignment('center');
  sheet.getRange('C6:C18').setHorizontalAlignment('left');
  sheet.getRange('E6:E18').setHorizontalAlignment('left');
  sheet.getRange('A31:H43').setHorizontalAlignment('center');
  sheet.getRange('H32:H43').setHorizontalAlignment('left');
  sheet.getRange('A46:H58').setHorizontalAlignment('center');
  sheet.getRange('H47:H58').setHorizontalAlignment('left');
}

function getLastRegionInfoDashboardRow_(sheet, regionIdCol) {
  if (!regionIdCol || regionIdCol <= 0) return sheet.getLastRow();

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;

  const values = sheet.getRange(2, regionIdCol, lastRow - 1, 1).getValues();

  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i][0]) {
      return i + 2;
    }
  }

  return 1;
}
