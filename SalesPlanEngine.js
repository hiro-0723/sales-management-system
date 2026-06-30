function onSalesPlanSubmit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();

  if (!isSalesPlanResponseSheet_(sheet)) return;

  expandSalesPlanRow(sheet, e.range.getRow());
}

function isSalesPlanResponseSheet_(sheet) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(String);

  return (
    headers.includes('日付') &&
    headers.includes('営業担当') &&
    headers.includes('予定1 営業先') &&
    headers.includes('予定1 予定時間')
  );
}

function expandSalesPlanRow(sourceSheet, rowNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetSheet = ss.getSheetByName('営業予定');

  if (!targetSheet) throw new Error('営業予定シートがありません');

  const headers = sourceSheet
    .getRange(1, 1, 1, sourceSheet.getLastColumn())
    .getValues()[0];

  const row = sourceSheet
    .getRange(rowNumber, 1, 1, sourceSheet.getLastColumn())
    .getValues()[0];

  const get = title => {
    const index = headers.indexOf(title);
    return index === -1 ? '' : row[index];
  };

  const timestamp = get('タイムスタンプ');
  const date = get('日付');
  const staff = get('営業担当');

  for (let i = 1; i <= 10; i++) {
    const company = get('予定' + i + ' 営業先');
    if (!company) continue;

    const planId =
      Utilities.formatDate(new Date(timestamp), 'Asia/Tokyo', 'yyyyMMddHHmmss') +
      '-' + i;

    if (isDuplicateSalesPlan(planId)) continue;

    targetSheet.appendRow([
      planId,
      timestamp,
      date,
      staff,
      company,
      get('予定' + i + ' 予定時間'),
      get('予定' + i + ' 目的'),
      get('予定' + i + ' 優先度'),
      get('予定' + i + ' 予定所要時間（分）'),
      get('予定' + i + ' 同行者'),
      get('予定' + i + ' 備考'),
      '予定',
      '',
      0,
      0
    ]);
  }

  updateSalesPlanReportUrls();
}

function isDuplicateSalesPlan(planId) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName('営業予定');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const ids = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .flat()
    .map(String);

  return ids.includes(String(planId));
}

function updateSalesPlanStatus(planId, status) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName('営業予定');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(planId)) {
      sheet.getRange(i + 2, 12).setValue(status);
      return;
    }
  }
}

function linkVisitHistory(planId, visitId) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName('営業予定');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(planId)) {
      sheet.getRange(i + 2, 13).setValue(visitId);
      return;
    }
  }
}

function testExpandLatestSalesPlanRow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sourceSheet = ss.getSheets()
    .filter(sheet => isSalesPlanResponseSheet_(sheet))
    .sort((a, b) => b.getLastRow() - a.getLastRow())[0];

  if (!sourceSheet) {
    SpreadsheetApp.getUi().alert('営業予定フォームの回答シートが見つかりません。');
    return;
  }

  const lastRow = sourceSheet.getLastRow();

  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('回答データがありません。');
    return;
  }

  expandSalesPlanRow(sourceSheet, lastRow);

  SpreadsheetApp.getUi().alert('最新の営業予定フォーム回答を営業予定シートへ展開しました。');
}

function setupSalesPlanSubmitTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onSalesPlanSubmit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('onSalesPlanSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  SpreadsheetApp.getUi().alert('営業予定フォーム送信トリガーを作成しました。');
}
