function ensureVisitReportPlanIdItem() {
  const formId = PropertiesService.getScriptProperties()
    .getProperty('VISIT_REPORT_FORM_ID');

  if (!formId) {
    SpreadsheetApp.getUi().alert('VISIT_REPORT_FORM_ID が未設定です。');
    return;
  }

  const form = FormApp.openById(formId);

  const existing = form.getItems()
    .find(item => item.getTitle() === 'PlanID');

  if (existing) {
    Logger.log('PlanID項目は既に存在します');
    return;
  }

  form.addTextItem()
    .setTitle('PlanID')
    .setHelpText('営業予定から自動入力されます。通常は変更しません。')
    .setRequired(false);

  Logger.log('営業活動報告フォームにPlanID項目を追加しました');
}

function debugVisitReportFormItems() {
  const formId = PropertiesService.getScriptProperties()
    .getProperty('VISIT_REPORT_FORM_ID');

  const form = FormApp.openById(formId);

  Logger.log('フォームID: ' + formId);
  Logger.log('編集URL: ' + form.getEditUrl());
  Logger.log('公開URL: ' + form.getPublishedUrl());

  form.getItems().forEach(item => {
    Logger.log(item.getTitle() + ' / ' + item.getType() + ' / ' + item.getId());
  });
}

function ensureSalesPlanReportUrlColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('営業予定');
  if (!sheet) throw new Error('営業予定シートがありません');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  if (!headers.includes('営業報告')) {
    const nextCol = sheet.getLastColumn() + 1;
    sheet.getRange(1, nextCol).setValue('営業報告');
  }
}

function buildVisitReportPrefilledUrl_(planData) {
  const formId = PropertiesService.getScriptProperties()
    .getProperty('VISIT_REPORT_FORM_ID');

  if (!formId) throw new Error('VISIT_REPORT_FORM_ID が未設定です');

  const form = FormApp.openById(formId);
  const response = form.createResponse();

  const itemsByTitle = {};
  form.getItems().forEach(item => {
    itemsByTitle[item.getTitle()] = item;
  });

  if (itemsByTitle['PlanID']) {
    response.withItemResponse(
      itemsByTitle['PlanID'].asTextItem().createResponse(String(planData.planId || ''))
    );
  }

  if (itemsByTitle['営業担当']) {
    response.withItemResponse(
      itemsByTitle['営業担当'].asTextItem().createResponse(String(planData.staff || ''))
    );
  }

  if (itemsByTitle['営業先']) {
    response.withItemResponse(
      itemsByTitle['営業先'].asTextItem().createResponse(String(planData.company || ''))
    );
  }

  if (itemsByTitle['日付'] && planData.date) {
    response.withItemResponse(
      itemsByTitle['日付'].asDateItem().createResponse(new Date(planData.date))
    );
  }

  return response.toPrefilledUrl();
}


function updateSalesPlanReportUrls() {
  Logger.log('①開始');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('②Spreadsheet取得');

  const sheet = ss.getSheetByName('営業予定');
  if (!sheet) throw new Error('営業予定シートがありません');
  Logger.log('③営業予定シート取得');

  ensureSalesPlanReportUrlColumn();
  Logger.log('④営業報告URL列確認');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  Logger.log('⑤ヘッダー取得: ' + JSON.stringify(headers));

  const col = name => headers.indexOf(name) + 1;

  const planIdCol = col('PlanID');
  const dateCol = col('日付');
  const staffCol = col('営業担当');
  const companyCol = col('営業先');
  let reportUrlCol = col('営業報告');
  if (reportUrlCol === 0) reportUrlCol = col('営業報告URL');

  Logger.log('⑥列番号 planId=' + planIdCol + ', date=' + dateCol + ', staff=' + staffCol + ', company=' + companyCol + ', url=' + reportUrlCol);

  const lastRow = sheet.getLastRow();
  Logger.log('⑦最終行: ' + lastRow);

  if (lastRow < 2) return;

  for (let row = 2; row <= lastRow; row++) {
    Logger.log('⑧処理行: ' + row);

    const planId = sheet.getRange(row, planIdCol).getValue();
    const company = sheet.getRange(row, companyCol).getValue();

    Logger.log('⑨PlanID=' + planId + ', company=' + company);

    if (!planId || !company) continue;

    const url = buildVisitReportPrefilledUrl_({
      planId: planId,
      date: sheet.getRange(row, dateCol).getValue(),
      staff: sheet.getRange(row, staffCol).getValue(),
      company: company
    });

    Logger.log('⑩URL生成完了');

    sheet.getRange(row, reportUrlCol).setFormula(
      '=HYPERLINK("' + url + '","報告する")'
    );
    Logger.log('⑪URL書き込み完了');
  }

  Logger.log('⑫完了');
}


function onVisitReportSubmit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();

  if (!isVisitReportResponseSheet_(sheet)) return;

  const rowNumber = e.range.getRow();

  updateSalesPlanFromVisitReportRow_(sheet, rowNumber);
}

function isVisitReportResponseSheet_(sheet) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(String);

  return (
    headers.includes('PlanID') &&
    headers.includes('営業担当') &&
    headers.includes('営業先') &&
    headers.includes('営業内容')
  );
}

function updateSalesPlanFromVisitReportRow_(sourceSheet, rowNumber) {
  const headers = sourceSheet
    .getRange(1, 1, 1, sourceSheet.getLastColumn())
    .getValues()[0];

  const row = sourceSheet
    .getRange(rowNumber, 1, 1, sourceSheet.getLastColumn())
    .getValues()[0];

  const get = (headerName) => {
    const index = headers.indexOf(headerName);
    if (index === -1) return '';
    return String(row[index]).trim();
  };

  const planId = get('PlanID');

  if (!planId) return;

  updateSalesPlanStatus(planId, '完了');

  // 訪問履歴IDは、まずは営業活動報告フォーム回答シートの行番号を入れる
  // 将来、訪問履歴(生データ/編集不可)側のIDと連携する場合はここを拡張する
  linkVisitHistory(planId, sourceSheet.getName() + ':' + rowNumber);
}

function setupVisitReportSubmitTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  ScriptApp.getProjectTriggers().forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onVisitReportSubmit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('onVisitReportSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  SpreadsheetApp.getUi().alert('営業活動報告フォーム送信トリガーを作成しました。');
}

function testUpdateSalesPlanFromLatestVisitReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sourceSheet = ss.getSheets()
    .filter(sheet => isVisitReportResponseSheet_(sheet))
    .sort((a, b) => b.getLastRow() - a.getLastRow())[0];

  if (!sourceSheet) {
    SpreadsheetApp.getUi().alert('営業活動報告フォームの回答シートが見つかりません。');
    return;
  }

  const lastRow = sourceSheet.getLastRow();

  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('営業活動報告フォームの回答がありません。');
    return;
  }

  updateSalesPlanFromVisitReportRow_(sourceSheet, lastRow);

  SpreadsheetApp.getUi().alert('最新の営業活動報告から営業予定を更新しました。');
}

function hideOldSalesReportUrlColumn() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('営業予定');
  if (!sheet) throw new Error('営業予定シートがありません');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const oldCol = headers.indexOf('営業報告URL') + 1;

  if (oldCol > 0) {
    sheet.hideColumns(oldCol);
  }
}

/**
 * 営業予定シートの指定行だけ営業報告URLを更新する
 */
function updateSalesPlanReportUrlForRow(row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('営業予定');
  if (!sheet) throw new Error('営業予定シートがありません');

  ensureSalesPlanReportUrlColumn();

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const col = name => headers.indexOf(name) + 1;

  const planIdCol = col('PlanID');
  const dateCol = col('日付');
  const staffCol = col('営業担当');
  const companyCol = col('営業先');
  let reportUrlCol = col('営業報告');
  if (reportUrlCol === 0) reportUrlCol = col('営業報告URL');

  if (row < 2) throw new Error('更新対象行が不正です: ' + row);
  if (planIdCol === 0) throw new Error('PlanID列がありません');
  if (companyCol === 0) throw new Error('営業先列がありません');
  if (reportUrlCol === 0) throw new Error('営業報告列がありません');

  const planId = sheet.getRange(row, planIdCol).getValue();
  const company = sheet.getRange(row, companyCol).getValue();

  if (!planId || !company) return;

  const url = buildVisitReportPrefilledUrl_({
    planId: planId,
    date: sheet.getRange(row, dateCol).getValue(),
    staff: sheet.getRange(row, staffCol).getValue(),
    company: company
  });

  sheet.getRange(row, reportUrlCol).setFormula(
    '=HYPERLINK("' + url + '","報告する")'
  );
}
