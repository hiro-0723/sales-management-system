function systemHealthCheck() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const results = [];

  // シート確認
  const requiredSheets = [
    '営業先マスター',
    '訪問履歴(生データ/編集不可)',
    '紹介実績(生データ/編集不可)',
    '名刺OCR確認待ち'
  ];

  results.push('【シート】');

  requiredSheets.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    results.push(sheet ? '✅ ' + sheetName : '❌ ' + sheetName + ' が見つかりません');
  });

  results.push('');
  results.push('【フォーム同期】');

  // 営業先マスターA列
  const masterSheet = ss.getSheetByName('営業先マスター');
  const masterNames = masterSheet
    ? masterSheet.getRange(2, 1, masterSheet.getLastRow() - 1, 1)
        .getValues()
        .flat()
        .map(v => String(v).trim())
        .filter(v => v !== '')
    : [];

  results.push('営業先マスター件数：' + masterNames.length);

  // 紹介実績入力フォーム
  const referralFormId = '1Ye4AqlaNrIDFJAxiMV1l2nHAL29a_Qua-PZSUiHU1ds';
  const referralForm = FormApp.openById(referralFormId);

  const referralItem = referralForm
    .getItems()
    .find(item => item.getTitle() === '紹介経路');

  if (!referralItem) {
    results.push('❌ 紹介実績フォーム：「紹介経路」が見つかりません');
  } else if (referralItem.getType() !== FormApp.ItemType.LIST) {
    results.push('❌ 紹介実績フォーム：「紹介経路」がプルダウンではありません');
  } else {
    const choices = referralItem
      .asListItem()
      .getChoices()
      .map(choice => choice.getValue());

    results.push('紹介実績フォーム候補数：' + choices.length);

    if (choices.length === masterNames.length) {
      results.push('✅ 紹介実績フォームは営業先マスターと同期しています');
    } else {
      results.push('❌ 紹介実績フォーム候補数が営業先マスターと一致しません');
      results.push('→「営業先整理＋フォーム候補を再作成」を実行してください');
    }
  }

  results.push('');
  results.push('【営業活動フォーム】');
  results.push('営業先：短文回答のため同期対象外');

  const message = '営業管理システム診断\n\n' + results.join('\n');

  SpreadsheetApp.getUi().alert(message);
  Logger.log(message);
}
