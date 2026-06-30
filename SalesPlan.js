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

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  sheet.setFrozenRows(1);

  sheet.autoResizeColumns(1, headers.length);

  sheet.getRange('A:A').setNumberFormat('yyyy/MM/dd HH:mm:ss');
  sheet.getRange('B:B').setNumberFormat('yyyy/MM/dd');
  sheet.getRange('C:C').setNumberFormat('HH:mm');

  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['予定', '完了', '延期'], true)
    .build();

  sheet.getRange(2, 11, 5000, 1).setDataValidation(statusRule);

  SpreadsheetApp.getUi().alert('営業予定シートを最新版へ更新しました。');
}


function setupSalesPlanForm() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  setupSalesPlanSheet();

  const props = PropertiesService.getScriptProperties();
  const savedFormId = props.getProperty('SALES_PLAN_FORM_ID');

  let form;

  if (savedFormId) {
    try {
      form = FormApp.openById(savedFormId);
    } catch (e) {
      form = FormApp.create('営業予定入力フォーム');
      props.setProperty('SALES_PLAN_FORM_ID', form.getId());
    }
  } else {
    form = FormApp.create('営業予定入力フォーム');
    props.setProperty('SALES_PLAN_FORM_ID', form.getId());
  }

  // 既存項目を全削除して作り直す
  form.getItems().forEach(item => form.deleteItem(item));

  form.setTitle('営業予定入力フォーム');

  form.setDescription(
    '1回の送信で最大10件まで営業予定を登録できます。\n' +
    '予定が10件を超える場合は、送信後に再度フォームを開いて続きの予定を入力してください。\n' +
    '未使用の予定欄は空欄のままで構いません。'
  );

  form.addDateItem()
    .setTitle('日付')
    .setRequired(true);

  form.addListItem()
    .setTitle('営業担当')
    .setChoiceValues(getSalesStaffNames_())
    .setRequired(true);

  const salesNames = getSalesMasterNames_();

  for (let i = 1; i <= 10; i++) {
    form.addSectionHeaderItem()
      .setTitle('予定' + i);

    form.addListItem()
      .setTitle('予定' + i + ' 営業先')
      .setChoiceValues(salesNames)
      .setRequired(i === 1);

    form.addTimeItem()
      .setTitle('予定' + i + ' 予定時間')
      .setRequired(false);

    form.addListItem()
      .setTitle('予定' + i + ' 目的')
      .setChoiceValues([
        '新規営業',
        '定期訪問',
        '情報収集',
        '契約・担当者会議',
        '空き状況案内',
        'あいさつ',
        'その他'
      ])
      .setRequired(false);

    form.addListItem()
      .setTitle('予定' + i + ' 優先度')
      .setChoiceValues([
        '★★★',
        '★★',
        '★'
      ])
      .setRequired(false);

    form.addTextItem()
      .setTitle('予定' + i + ' 予定所要時間（分）')
      .setRequired(false);

    form.addTextItem()
      .setTitle('予定' + i + ' 同行者')
      .setRequired(false);

    form.addParagraphTextItem()
      .setTitle('予定' + i + ' 備考')
      .setRequired(false);
  }

  form.setDestination(
    FormApp.DestinationType.SPREADSHEET,
    ss.getId()
  );

  SpreadsheetApp.getUi().alert(
    '営業予定フォームを作成・更新しました。\n\n' +
    form.getPublishedUrl()
  );

  Logger.log('営業予定フォーム 編集URL: ' + form.getEditUrl());
  Logger.log('営業予定フォーム 公開URL: ' + form.getPublishedUrl());
}


function getSalesStaffNames_() {
  return [
    '生貝',
    '田丸',
    '北浦',
    '小形',
    '渡辺',
    '高橋亜',
    '石井直',
    '大谷',
    '大下'
  ];
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


function updateSalesPlanFormChoices() {

  const props = PropertiesService.getScriptProperties();

  const formId = props.getProperty('SALES_PLAN_FORM_ID');

  if (!formId) {
    SpreadsheetApp.getUi().alert(
      '営業予定フォームがまだ作成されていません。'
    );
    return;
  }

  const form = FormApp.openById(formId);

  const salesNames = getSalesMasterNames_();

  const staffNames = getSalesStaffNames_();

  form.getItems().forEach(item => {

    const title = item.getTitle();

    if (
      item.getType() === FormApp.ItemType.LIST &&
      title === '営業担当'
    ) {

      item.asListItem().setChoiceValues(staffNames);

    }

    if (
      item.getType() === FormApp.ItemType.LIST &&
      title.match(/^予定\d+ 営業先$/)
    ) {

      item.asListItem().setChoiceValues(salesNames);

    }

  });

  SpreadsheetApp.getUi().alert(
    '営業予定フォーム候補を更新しました。'
  );

}
