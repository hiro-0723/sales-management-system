function setupSalesPlanSheet() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetName = '営業予定';

  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const headers = [
    'タイムスタンプ',
    '日付',
    '予定時間',
    '営業担当',
    '営業先',
    '目的',
    '優先度',
    '予定所要時間',
    '同行者',
    '備考',
    '状態'
  ];

  sheet.clear();

  sheet.getRange(1,1,1,headers.length).setValues([headers]);

  sheet.setFrozenRows(1);

  sheet.autoResizeColumns(1,headers.length);

  sheet.getRange('A:A').setNumberFormat('yyyy/MM/dd HH:mm:ss');
  sheet.getRange('B:B').setNumberFormat('yyyy/MM/dd');
  sheet.getRange('C:C').setNumberFormat('HH:mm');

  const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList([
        '予定',
        '完了',
        '延期'
      ], true)
      .build();

  sheet.getRange(2,11,5000,1)
       .setDataValidation(rule);

  SpreadsheetApp.getUi().alert(
    '営業予定シートを最新版へ更新しました。'
  );

}

function setupSalesPlanForm() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetName = '営業予定';
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const form = FormApp.create('営業予定入力フォーム');

  // 日付
  form.addDateItem()
    .setTitle('日付')
    .setRequired(true);

  // 予定時間
  form.addTimeItem()
    .setTitle('予定時間')
    .setRequired(true);

  // 営業担当
  form.addListItem()
    .setTitle('営業担当')
    .setChoiceValues([
      '高橋',
      '田丸'
    ])
    .setRequired(true);

  // 営業先
  form.addListItem()
    .setTitle('営業先')
    .setChoiceValues(getSalesMasterNames_())
    .setRequired(true);

  // 目的
  form.addListItem()
    .setTitle('目的')
    .setChoiceValues([
      '新規営業',
      '定期訪問',
      '情報収集',
      '契約・担当者会議',
      '空き状況案内',
      'あいさつ',
      'その他'
    ])
    .setRequired(true);

  // 優先度
  form.addListItem()
    .setTitle('優先度')
    .setChoiceValues([
      '★★★',
      '★★',
      '★'
    ])
    .setRequired(true);

  // 予定所要時間
  form.addTextItem()
    .setTitle('予定所要時間（分）')
    .setRequired(false);

  // 同行者
  form.addTextItem()
    .setTitle('同行者')
    .setRequired(false);

  // 備考
  form.addParagraphTextItem()
    .setTitle('備考')
    .setRequired(false);

  form.setDestination(
    FormApp.DestinationType.SPREADSHEET,
    ss.getId()
  );

  SpreadsheetApp.getUi().alert(
    '営業予定フォーム（Ver2）を作成しました。\n\n' +
    form.getPublishedUrl()
  );

  Logger.log(form.getEditUrl());
}

function getSalesMasterNames_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName('営業先マスター');

  if (!masterSheet) return ['営業先マスター未設定'];

  const lastRow = masterSheet.getLastRow();
  if (lastRow < 2) return ['営業先未登録'];

  return masterSheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .flat()
    .map(v => String(v).trim())
    .filter(v => v !== '');
}
