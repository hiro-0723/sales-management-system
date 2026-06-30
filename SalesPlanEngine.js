
/*************************************************
 * SalesPlanEngine.js
 * 営業予定フォーム回答 → 営業予定シート展開エンジン
 *************************************************/


function onSalesPlanSubmit(e) {

  if (!e || !e.range) return;

  const sheet = e.range.getSheet();

  if (!isSalesPlanResponseSheet_(sheet)) return;

  const row = e.range.getRow();

  expandSalesPlanRow(sheet, row);

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

  if (!targetSheet) {
    throw new Error('営業予定シートがありません');
  }

  const headers = sourceSheet
    .getRange(1,1,1,sourceSheet.getLastColumn())
    .getValues()[0];

  const row = sourceSheet
    .getRange(rowNumber,1,1,sourceSheet.getLastColumn())
    .getValues()[0];

  const get = title => {

    const i = headers.indexOf(title);

    return i==-1 ? '' : row[i];

  };

  const timestamp = get('タイムスタンプ');
  const date = get('日付');
  const staff = get('営業担当');

  for(let i=1;i<=10;i++){

    const company = get('予定'+i+' 営業先');

    if(!company) continue;

    const time = get('予定'+i+' 予定時間');
    const purpose = get('予定'+i+' 目的');
    const priority = get('予定'+i+' 優先度');
    const minutes = get('予定'+i+' 予定所要時間（分）');
    const companion = get('予定'+i+' 同行者');
    const memo = get('予定'+i+' 備考');

    const planId =
      Utilities.formatDate(
        new Date(),
        'Asia/Tokyo',
        'yyyyMMddHHmmss'
      ) + '-' + i;

    targetSheet.appendRow([
      planId,
      timestamp,
      date,
      staff,
      company,
      time,
      purpose,
      priority,
      minutes,
      companion,
      memo,
      '予定',
      '',
      0,
      0
    ]);

  }

}


function testExpandLatestSalesPlanRow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheets = ss.getSheets();

  const sourceSheet = sheets
    .filter(sheet => sheet.getName().includes('営業予定入力フォーム') || sheet.getName().includes('フォームの回答'))
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

  SpreadsheetApp.getUi().alert(
    '最新の営業予定フォーム回答を営業予定シートへ展開しました。'
  );
}


/*************************************************
 * 営業予定重複チェック
 *************************************************/
function isDuplicateSalesPlan(planId){

  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName('営業予定');

  const lastRow = sheet.getLastRow();

  if(lastRow < 2) return false;

  const ids = sheet
    .getRange(2,1,lastRow-1,1)
    .getValues()
    .flat()
    .map(String);

  return ids.includes(String(planId));

}

/*************************************************
 * 営業予定状態更新
 *************************************************/
function updateSalesPlanStatus(planId,status){

  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName('営業予定');

  const lastRow = sheet.getLastRow();

  if(lastRow < 2) return;

  const values = sheet
    .getRange(2,1,lastRow-1,12)
    .getValues();

  for(let i=0;i<values.length;i++){

    if(String(values[i][0])===String(planId)){

      sheet.getRange(i+2,12).setValue(status);

      return;

    }

  }

}

/*************************************************
 * 訪問履歴とのリンク（今は雛形）
 *************************************************/
function linkVisitHistory(planId,visitId){

  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName('営業予定');

  const lastRow = sheet.getLastRow();

  if(lastRow < 2) return;

  const values = sheet
    .getRange(2,1,lastRow-1,13)
    .getValues();

  for(let i=0;i<values.length;i++){

    if(String(values[i][0])===String(planId)){

      sheet.getRange(i+2,13).setValue(visitId);

      return;

    }

  }

}


/*************************************************
 * 営業予定フォーム送信トリガー作成
 *************************************************/
function setupSalesPlanSubmitTrigger() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'onSalesPlanSubmit') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('onSalesPlanSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  SpreadsheetApp.getUi().alert(
    '営業予定フォーム送信トリガーを作成しました。'
  );

}
