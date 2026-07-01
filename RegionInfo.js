/**
 * Phase6: 地域情報共有
 * 社員・ケアマネ・代表が持つ地域情報を営業予定の種として集約する。
 */

function setupRegionInfo() {
  const results = [];

  results.push(runSetupStep_('地域情報共有シート確認', setupRegionInfoSheet));
  results.push(runSetupStep_('地域情報共有フォーム確認', setupRegionInfoForm));
  results.push(runSetupStep_('地域情報共有フォーム候補更新', updateRegionInfoFormChoices));

  const message =
    '地域情報共有の初期設定が完了しました。\\n\\n' +
    results.join('\\n');

  Logger.log(message);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    ss.toast('地域情報共有の初期設定が完了しました。', '地域情報共有', 5);
  }

  return message;
}

function setupRegionInfoSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('地域情報共有');

  if (!sheet) {
    sheet = ss.insertSheet('地域情報共有');
  }

  const headers = [
    '地域情報ID',
    'タイムスタンプ',
    '投稿者',
    '部署',
    '情報分類',
    '内容',
    '関連先',
    '対応優先度',
    '営業担当に動いてほしい？',
    '添付ファイル',
    '対応状況',
    '対応者',
    '対応メモ',
    '営業予定へ追加',
    '営業担当',
    '営業予定反映日',
    '営業予定PlanID',
    '二重追加防止フラグ'
  ];

  ensureHeaders_(sheet, headers);

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  setupRegionInfoValidation_(sheet);

  return sheet;
}

function setupRegionInfoValidation_(sheet) {
  const lastRow = Math.max(sheet.getMaxRows(), 1000);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  const col = name => headers.indexOf(name) + 1;

  const statusCol = col('対応状況');
  const addCol = col('営業予定へ追加');
  const staffCol = col('営業担当');

  if (statusCol === 0) throw new Error('地域情報共有シートに「対応状況」列がありません');
  if (addCol === 0) throw new Error('地域情報共有シートに「営業予定へ追加」列がありません');
  if (staffCol === 0) throw new Error('地域情報共有シートに「営業担当」列がありません');

  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList([
      '未対応',
      '確認中',
      '営業予定へ反映',
      '訪問済',
      '紹介につながった',
      '対応不要'
    ], true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange(2, statusCol, lastRow - 1, 1).setDataValidation(statusRule);

  const addRule = SpreadsheetApp.newDataValidation()
    .requireCheckbox()
    .build();

  sheet.getRange(2, addCol, lastRow - 1, 1).setDataValidation(addRule);

  const staffRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(getSalesStaffNames_(), true)
    .setAllowInvalid(false)
    .build();

  sheet.getRange(2, staffCol, lastRow - 1, 1).setDataValidation(staffRule);
}

function setupRegionInfoForm() {
  const props = PropertiesService.getScriptProperties();
  let formId = props.getProperty('REGION_INFO_FORM_ID');

  if (formId) {
    try {
      const form = FormApp.openById(formId);
      updateRegionInfoFormChoices();
      return form;
    } catch (error) {
      Logger.log('既存の地域情報共有フォームを開けませんでした。新規作成します: ' + error.message);
    }
  }

  const form = FormApp.create('地域情報共有フォーム');

  form.setDescription(
    '営業につながるかどうかは気にせず、地域で聞いた情報・気づいたこと・共有しておいた方がよさそうなことを入力してください。\\n' +
    '正確でなくても構いません。営業担当や管理者が確認して活用します。'
  );

  form.addTextItem()
    .setTitle('投稿者')
    .setRequired(true);

  form.addListItem()
    .setTitle('部署')
    .setChoiceValues(getRegionInfoDepartmentChoices_())
    .setRequired(true);

  form.addListItem()
    .setTitle('情報分類')
    .setChoiceValues(getRegionInfoCategoryChoices_())
    .setRequired(true);

  form.addParagraphTextItem()
    .setTitle('内容')
    .setHelpText('いつ・どこで・誰から・どんな話を聞いたかを、分かる範囲で入力してください。')
    .setRequired(true);

  form.addTextItem()
    .setTitle('関連先')
    .setHelpText('例：○○居宅、△△病院、□□包括など。分からなければ空欄でOK。')
    .setRequired(false);

  form.addMultipleChoiceItem()
    .setTitle('対応優先度')
    .setChoiceValues(['高', '中', '低', '分からない'])
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('営業担当に動いてほしい？')
    .setChoiceValues(['動いてほしい', '共有のみ', '判断を任せる'])
    .setRequired(true);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  props.setProperty('REGION_INFO_FORM_ID', form.getId());

  Logger.log('地域情報共有フォームを作成しました');
  Logger.log('編集URL: ' + form.getEditUrl());
  Logger.log('公開URL: ' + form.getPublishedUrl());

  return form;
}

function updateRegionInfoFormChoices() {
  const props = PropertiesService.getScriptProperties();
  const formId = props.getProperty('REGION_INFO_FORM_ID');

  if (!formId) {
    const message = '△ 地域情報共有フォーム: フォームID未設定のためスキップ';
    Logger.log(message);
    return message;
  }

  const form = FormApp.openById(formId);

  form.getItems().forEach(item => {
    const title = item.getTitle();

    if (item.getType() === FormApp.ItemType.LIST && title === '部署') {
      item.asListItem().setChoiceValues(getRegionInfoDepartmentChoices_());
    }

    if (item.getType() === FormApp.ItemType.LIST && title === '情報分類') {
      item.asListItem().setChoiceValues(getRegionInfoCategoryChoices_());
    }
  });

  return '○ 地域情報共有フォーム: 更新完了';
}

function getRegionInfoDepartmentChoices_() {
  return [
    '木更津デイ',
    '姉ヶ崎デイ',
    'すまいるあくてぃぶ',
    '生活介護 真舟',
    '生活介護 文京',
    '訪問看護',
    'ケアマネ',
    '相談支援',
    'グループホーム',
    '本部',
    'その他'
  ];
}

function getRegionInfoCategoryChoices_() {
  return [
    '新規利用者',
    'ケアマネ情報',
    '病院情報',
    '包括情報',
    '相談支援情報',
    '競合情報',
    '採用',
    '地域動向',
    '空き状況',
    '退院情報',
    'その他'
  ];
}

function ensureHeaders_(sheet, headers) {
  const currentLastCol = Math.max(sheet.getLastColumn(), headers.length);
  const currentHeaders = sheet.getRange(1, 1, 1, currentLastCol).getValues()[0];

  headers.forEach((header, index) => {
    if (currentHeaders[index] !== header) {
      sheet.getRange(1, index + 1).setValue(header);
    }
  });
}
