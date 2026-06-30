function setupSalesPlanSheet() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheetName = '営業予定';

  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  const headers = [
    'PlanID',
    'タイムスタンプ',
    '日付',
    '営業担当',
    '営業先',
    '予定時間',
    '目的',
    '優先度',
    '予定所要時間',
    '同行者',
    '備考',
    '状態',
    '訪問履歴ID',
    '紹介件数',
    '契約件数'
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


/*************************************************
 * 営業予定フォーム回答 → 営業予定シート展開エンジン
 *************************************************/

function testExpandLatestSalesPlanRow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sourceSheet = ss.getSheets()
    .filter(sheet =>
      sheet.getName().includes('営業予定入力フォーム') ||
      sheet.getName().includes('フォームの回答')
    )
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

function expandSalesPlanRow(sourceSheet, rowNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetSheet = ss.getSheetByName('営業予定');

  if (!targetSheet) {
    throw new Error('営業予定シートがありません');
  }

  const headers = sourceSheet
    .getRange(1, 1, 1, sourceSheet.getLastColumn())
    .getValues()[0];

  const row = sourceSheet
    .getRange(rowNumber, 1, 1, sourceSheet.getLastColumn())
    .getValues()[0];

  const get = title => {
    const i = headers.indexOf(title);
    return i === -1 ? '' : row[i];
  };

  const timestamp = get('タイムスタンプ');
  const date = get('日付');
  const staff = get('営業担当');

  for (let i = 1; i <= 10; i++) {
    const company = get('予定' + i + ' 営業先');

    if (!company) continue;

    const time = get('予定' + i + ' 予定時間');
    const purpose = get('予定' + i + ' 目的');
    const priority = get('予定' + i + ' 優先度');
    const minutes = get('予定' + i + ' 予定所要時間（分）');
    const companion = get('予定' + i + ' 同行者');
    const memo = get('予定' + i + ' 備考');

    const planId =
      Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss') +
      '-' + i;

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
