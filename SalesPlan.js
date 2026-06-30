function setupSalesPlanSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('営業予定');

  if (!sheet) sheet = ss.insertSheet('営業予定');

  const headers = [
    'PlanID','タイムスタンプ','日付','営業担当','営業先','予定時間','目的','優先度',
    '予定所要時間','同行者','備考','状態','訪問履歴ID','紹介件数','契約件数'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange('B:B').setNumberFormat('yyyy/MM/dd HH:mm:ss');
  sheet.getRange('C:C').setNumberFormat('yyyy/MM/dd');
  sheet.getRange('F:F').setNumberFormat('HH:mm');

  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['予定', '完了', '延期'], true)
    .build();

  sheet.getRange(2, 12, 5000, 1).setDataValidation(statusRule);
}

function createNewSalesPlanForm() {
  Logger.log('① 新フォーム作成開始');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();

  const form = FormApp.create('営業予定入力フォーム');
  Logger.log('② フォーム作成完了');

  props.setProperty('SALES_PLAN_FORM_ID', form.getId());
  Logger.log('③ フォームID保存完了');

  form.setDescription(
    '1回の送信で最大10件まで営業予定を登録できます。\n' +
    '予定が10件を超える場合は、送信後に再度フォームを開いて続きの予定を入力してください。\n' +
    '未使用の予定欄は空欄のままで構いません。'
  );

  form.addDateItem().setTitle('日付').setRequired(true);

  form.addListItem()
    .setTitle('営業担当')
    .setChoiceValues(getSalesStaffNames_())
    .setRequired(true);

  const salesNames = getSalesMasterNames_();

  for (let i = 1; i <= 10; i++) {
    form.addSectionHeaderItem().setTitle('予定' + i);

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
      .setChoiceValues(['★★★', '★★', '★'])
      .setRequired(false);

    form.addTextItem().setTitle('予定' + i + ' 予定所要時間（分）').setRequired(false);
    form.addTextItem().setTitle('予定' + i + ' 同行者').setRequired(false);
    form.addParagraphTextItem().setTitle('予定' + i + ' 備考').setRequired(false);
  }

  Logger.log('④ 項目作成完了');

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  Logger.log('⑤ 回答先設定完了');

  SpreadsheetApp.getUi().alert(
    '新しい営業予定フォームを作成し、使用フォームIDを切り替えました。\n\n' +
    form.getPublishedUrl()
  );

  Logger.log('編集URL: ' + form.getEditUrl());
  Logger.log('公開URL: ' + form.getPublishedUrl());
}

// 旧名は残すが、既存フォーム再構築はしない
function setupSalesPlanForm() {
  createNewSalesPlanForm();
}

function updateSalesPlanFormChoices() {
  const props = PropertiesService.getScriptProperties();
  const formId = props.getProperty('SALES_PLAN_FORM_ID');

  if (!formId) {
    SpreadsheetApp.getUi().alert('営業予定フォームIDが未設定です。');
    return;
  }

  const form = FormApp.openById(formId);
  const salesNames = getSalesMasterNames_();
  const staffNames = getSalesStaffNames_();

  form.getItems().forEach(item => {
    const title = item.getTitle();

    if (item.getType() === FormApp.ItemType.LIST && title === '営業担当') {
      item.asListItem().setChoiceValues(staffNames);
    }

    if (item.getType() === FormApp.ItemType.LIST && /^予定\d+ 営業先$/.test(title)) {
      item.asListItem().setChoiceValues(salesNames);
    }
  });
}

function getSalesStaffNames_() {
  return ['生貝','田丸','北浦','小形','渡辺','高橋亜','石井直','大谷','大下'];
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

function debugSalesPlanForm() {
  const formId = PropertiesService.getScriptProperties().getProperty('SALES_PLAN_FORM_ID');

  if (!formId) {
    Logger.log('SALES_PLAN_FORM_ID がありません');
    return;
  }

  const form = FormApp.openById(formId);

  Logger.log('フォームID: ' + formId);
  Logger.log('編集URL: ' + form.getEditUrl());
  Logger.log('公開URL: ' + form.getPublishedUrl());
  Logger.log('タイトル: ' + form.getTitle());

  const items = form.getItems();
  Logger.log('項目数: ' + items.length);

  items.forEach((item, index) => {
    Logger.log((index + 1) + ': ' + item.getTitle() + ' / ' + item.getType());
  });
}
