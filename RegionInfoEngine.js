/**
 * RegionInfoEngine.js
 * 地域情報共有フォーム回答の転記・営業予定への変換を担当する。
 */

function onRegionInfoSubmit(e) {
  if (!e || !e.range || !e.source) return;

  const sheet = e.range.getSheet();

  if (!isRegionInfoResponseSheet_(sheet)) return;

  copyRegionInfoResponseRow_(sheet, e.range.getRow());
}

function isRegionInfoResponseSheet_(sheet) {
  return sheet.getName() === '地域情報共有（生データ）';
}

function copyRegionInfoResponseRow_(sourceSheet, rowNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const targetSheet = ss.getSheetByName('地域情報共有');
  if (!targetSheet) throw new Error('地域情報共有シートがありません');

  setupRegionInfoSheet();

  const sourceHeaders = sourceSheet
    .getRange(1, 1, 1, sourceSheet.getLastColumn())
    .getValues()[0];

  const sourceValues = sourceSheet
    .getRange(rowNumber, 1, 1, sourceSheet.getLastColumn())
    .getValues()[0];

  const get = name => {
    const index = sourceHeaders.indexOf(name);
    return index >= 0 ? sourceValues[index] : '';
  };

  const targetHeaders = targetSheet
    .getRange(1, 1, 1, targetSheet.getLastColumn())
    .getValues()[0];

  const tcol = name => targetHeaders.indexOf(name) + 1;

  const regionId = createRegionInfoId_(rowNumber);
  const nextRow = getNextRegionInfoTargetRow_(targetSheet);

  const valuesByHeader = {
    '地域情報ID': regionId,
    'タイムスタンプ': get('タイムスタンプ'),
    '投稿者': get('投稿者'),
    '部署': get('部署'),
    '情報分類': get('情報分類'),
    '内容': get('内容'),
    '関連先': get('関連先'),
    '対応優先度': get('対応優先度'),
    '営業担当に動いてほしい？': get('営業担当に動いてほしい？'),
    '対応状況': '未対応'
  };

  Object.keys(valuesByHeader).forEach(header => {
    const col = tcol(header);
    if (col > 0) {
      targetSheet.getRange(nextRow, col).setValue(valuesByHeader[header]);
    }
  });

  Logger.log('地域情報共有シートへ転記しました: ' + regionId);
}

function setupRegionInfoSubmitTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const exists = ScriptApp.getProjectTriggers()
    .some(trigger =>
      trigger.getHandlerFunction() === 'onRegionInfoSubmit' &&
      trigger.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT
    );

  if (exists) return;

  ScriptApp.newTrigger('onRegionInfoSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();
}

function convertCheckedRegionInfoToSalesPlan() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const regionSheet = ss.getSheetByName('地域情報共有');
  const salesSheet = ss.getSheetByName('営業予定');

  if (!regionSheet) throw new Error('地域情報共有シートがありません');
  if (!salesSheet) throw new Error('営業予定シートがありません');

  setupRegionInfoSheet();
  ensureSalesPlanRegionInfoIdColumn_();

  const regionHeaders = regionSheet.getRange(1, 1, 1, regionSheet.getLastColumn()).getValues()[0];
  const salesHeaders = salesSheet.getRange(1, 1, 1, salesSheet.getLastColumn()).getValues()[0];

  const rcol = name => regionHeaders.indexOf(name) + 1;
  const scol = name => salesHeaders.indexOf(name) + 1;

  let addedCount = 0;
  let skippedCount = 0;

  for (let row = 2; row <= regionSheet.getLastRow(); row++) {
    const shouldAdd = regionSheet.getRange(row, rcol('営業予定へ追加')).getValue() === true;
    if (!shouldAdd) continue;

    const existingPlanId = regionSheet.getRange(row, rcol('営業予定PlanID')).getValue();
    const duplicateFlag = regionSheet.getRange(row, rcol('二重追加防止フラグ')).getValue();

    if (existingPlanId || duplicateFlag) {
      skippedCount++;
      continue;
    }

    let regionId = regionSheet.getRange(row, rcol('地域情報ID')).getValue();
    if (!regionId) {
      regionId = createRegionInfoId_(row);
      regionSheet.getRange(row, rcol('地域情報ID')).setValue(regionId);
    }

    const staff = regionSheet.getRange(row, rcol('営業担当')).getValue();
    const company = regionSheet.getRange(row, rcol('関連先')).getValue();
    const memo = regionSheet.getRange(row, rcol('内容')).getValue();

    if (!staff) throw new Error(row + '行目：営業担当が未入力です');
    if (!company) throw new Error(row + '行目：関連先が未入力です');

    const planId = createRegionSalesPlanId_();
    const nextRow = salesSheet.getLastRow() + 1;

    const valuesByHeader = {
      'PlanID': planId,
      'タイムスタンプ': new Date(),
      '日付': new Date(),
      '営業担当': staff,
      '営業先': company,
      '目的': '地域情報対応',
      '備考': memo,
      '状態': '未実施',
      '地域情報ID': regionId
    };

    Object.keys(valuesByHeader).forEach(header => {
      const col = scol(header);
      if (col > 0) {
        salesSheet.getRange(nextRow, col).setValue(valuesByHeader[header]);
      }
    });

    regionSheet.getRange(row, rcol('営業予定PlanID')).setValue(planId);
    regionSheet.getRange(row, rcol('営業予定反映日')).setValue(new Date());
    regionSheet.getRange(row, rcol('対応状況')).setValue('営業予定へ反映');
    regionSheet.getRange(row, rcol('二重追加防止フラグ')).setValue('追加済み');

    addedCount++;
  }

  const message =
    '地域情報から営業予定への反映が完了しました。\n\n' +
    '追加：' + addedCount + '件\n' +
    'スキップ：' + skippedCount + '件';

  Logger.log(message);

  const ssObj = SpreadsheetApp.getActiveSpreadsheet();
  if (ssObj) {
    ssObj.toast(message, '地域情報→営業予定', 5);
  }

  return message;
}

function ensureSalesPlanRegionInfoIdColumn_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('営業予定');
  if (!sheet) throw new Error('営業予定シートがありません');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (!headers.includes('地域情報ID')) {
    sheet.getRange(1, sheet.getLastColumn() + 1).setValue('地域情報ID');
  }
}

function createRegionInfoId_(row) {
  return 'REG-' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') +
    '-' +
    row;
}

function createRegionSalesPlanId_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss') +
    '-REG';
}

/**
 * 地域情報共有フォーム回答シート名の確認用
 */
function debugRegionInfoSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ss.getSheets().forEach(sheet => {
    Logger.log('シート名: [' + sheet.getName() + ']');
  });
}

/**
 * 手動テスト用
 * 地域情報共有（生データ）の最新行を地域情報共有シートへ転記する。
 */
function testCopyLatestRegionInfoResponse() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sourceSheet = ss.getSheetByName('地域情報共有（生データ）');

  if (!sourceSheet) {
    throw new Error('地域情報共有（生データ）シートが見つかりません');
  }

  const lastRow = sourceSheet.getLastRow();
  if (lastRow < 2) {
    throw new Error('地域情報共有（生データ）に回答データがありません');
  }

  copyRegionInfoResponseRow_(sourceSheet, lastRow);
}

function getNextRegionInfoTargetRow_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const regionIdCol = headers.indexOf('地域情報ID') + 1;

  if (regionIdCol === 0) {
    throw new Error('地域情報共有シートに地域情報ID列がありません');
  }

  const maxRows = sheet.getMaxRows();
  const values = sheet.getRange(2, regionIdCol, maxRows - 1, 1).getValues();

  for (let i = 0; i < values.length; i++) {
    if (!values[i][0]) {
      return i + 2;
    }
  }

  return maxRows + 1;
}

