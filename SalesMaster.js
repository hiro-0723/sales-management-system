function onFormSubmit(e) {
  if (!e || !e.range || !e.source) return;

  const submittedSheet = e.range.getSheet();
  const submittedSheetName = submittedSheet.getName();

  if (submittedSheetName !== '訪問履歴(生データ/編集不可)') return;

  const submittedRow = e.range.getRow();

  updateSalesMasterFromSheetRow(submittedSheet, submittedRow);
}

function updateReferralFormChoices() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName('営業先マスター');

  // ここに紹介実績フォームのIDを入れる
  const formId = '1Ye4AqlaNrIDFJAxiMV1l2nHAL29a_Qua-PZSUiHU1ds';

  const form = FormApp.openById(formId);

  const lastRow = masterSheet.getLastRow();

  if (lastRow < 2) return;

  const names = masterSheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .flat()
    .map(name => String(name).trim())
    .filter(name => name !== '');

  const uniqueNames = [...new Set(names)].sort();

  const items = form.getItems();

  const targetItem = items.find(item => item.getTitle() === '紹介経路');

  if (!targetItem) return;

  targetItem.asListItem().setChoiceValues(uniqueNames);
}

function updateSalesMasterFromSheetRow(sourceSheet, sourceRowNumber) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName('営業先マスター');
  if (!masterSheet) return;

  const sourceHeaders = sourceSheet
    .getRange(1, 1, 1, sourceSheet.getLastColumn())
    .getValues()[0];

  const sourceRow = sourceSheet
    .getRange(sourceRowNumber, 1, 1, sourceSheet.getLastColumn())
    .getValues()[0];

  const getSourceValue = (headerName) => {
    const index = sourceHeaders.indexOf(headerName);
    if (index === -1) return '';
    return String(sourceRow[index]).trim();
  };

  const clientName = getSourceValue('営業先');
  if (!clientName) return;

  const contactName = getSourceValue('営業先担当者');
  const title = getSourceValue('肩書き');
  const phone = getSourceValue('電話');
  const fax = getSourceValue('FAX');
  const email = getSourceValue('メールアドレス');
  const address = getSourceValue('住所');

  const masterHeaders = masterSheet
    .getRange(1, 1, 1, masterSheet.getLastColumn())
    .getValues()[0];

  const getMasterCol = (headerName) => {
    const index = masterHeaders.indexOf(headerName);
    return index === -1 ? null : index + 1;
  };

  const masterValues = masterSheet.getRange('A:A').getValues().flat();

  let targetRow = null;

  for (let i = 1; i < masterValues.length; i++) {
    if (String(masterValues[i]).trim() === clientName) {
      targetRow = i + 1;
      break;
    }
  }

  if (!targetRow) {
    let lastClientRow = 1;

    for (let i = masterValues.length - 1; i >= 1; i--) {
      if (String(masterValues[i]).trim() !== '') {
        lastClientRow = i + 1;
        break;
      }
    }

    targetRow = lastClientRow + 1;

    masterSheet.getRange(targetRow, 1).setValue(clientName);

    masterSheet
      .getRange(2, 2, 1, masterSheet.getLastColumn() - 1)
      .copyTo(
        masterSheet.getRange(targetRow, 2, 1, masterSheet.getLastColumn() - 1),
        { contentsOnly: false }
      );

    ['担当者', '肩書き', '電話', 'FAX', 'メールアドレス', '住所'].forEach(headerName => {
      const col = getMasterCol(headerName);
      if (col) masterSheet.getRange(targetRow, col).clearContent();
    });
  }

  const setValueByHeader = (headerName, value) => {

  const col = getMasterCol(headerName);
  if (!col) return;

  masterSheet
    .getRange(targetRow, col)
    .setValue(value);

};

  setValueByHeader('担当者', contactName);
setValueByHeader('肩書き', title);
setValueByHeader('電話', phone);
setValueByHeader('FAX', fax);
setValueByHeader('メールアドレス', email);
setValueByHeader('住所', address);

  updateReferralFormChoices();
}

function maintenanceSalesMasterAndForm() {
  cleanupSalesMaster();
  rebuildSalesMaster();
  updateAllForms();

  SpreadsheetApp.getUi().alert(
    '営業先データ整理と全フォーム候補の最新化が完了しました。'
  );
}

function cleanupSalesMaster() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterSheet = ss.getSheetByName('営業先マスター');
  const visitSheet = ss.getSheetByName('訪問履歴(生データ/編集不可)');
  const referralSheet =
    ss.getSheetByName('紹介実績(生データ/編集不可)') ||
    ss.getSheetByName('紹介実績(閲覧用/編集可)') ||
    ss.getSheetByName('紹介実績');

  if (!masterSheet) throw new Error('営業先マスター シートが見つかりません');
  if (!visitSheet) throw new Error('訪問履歴(生データ/編集不可) シートが見つかりません');
  if (!referralSheet) throw new Error('紹介実績系シートが見つかりません');

  const normalizeName = (name) => {
    return String(name)
      .normalize('NFKC')
      .replace(/[ \u00A0\u1680\u180E\u2000-\u200D\u202F\u205F\u3000\uFEFF]/g, '')
      .trim();
  };

  const visitNames = getColumnValues_(visitSheet, 4).map(normalizeName);
  const referralNames = getColumnValues_(referralSheet, 3).map(normalizeName);
  const usedNames = new Set([...visitNames, ...referralNames]);

  const lastRow = masterSheet.getLastRow();
  const seenMasterNames = new Set();
  const rowsToDelete = [];

  for (let row = 2; row <= lastRow; row++) {
    const rawName = masterSheet.getRange(row, 1).getValue();
    const normalizedName = normalizeName(rawName);

    if (!normalizedName) continue;

    Logger.log(row + '行目: [' + rawName + '] → [' + normalizedName + ']');

    if (!usedNames.has(normalizedName)) {
      rowsToDelete.push(row);
      continue;
    }

    if (seenMasterNames.has(normalizedName)) {
      rowsToDelete.push(row);
      continue;
    }

    seenMasterNames.add(normalizedName);
  }

  rowsToDelete.reverse().forEach(row => {
    masterSheet.deleteRow(row);
  });

  Logger.log('削除行: ' + JSON.stringify(rowsToDelete));

  updateReferralFormChoices();
}

function getColumnValues_(sheet, col) {
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  return sheet
    .getRange(2, col, lastRow - 1, 1)
    .getValues()
    .flat()
    .map(v => String(v).trim())
    .filter(v => v !== '');
}

function onEdit(e) {
  if (!e || !e.range || !e.source) return;

  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();

  // 訪問履歴の生データシート以外では何もしない
  if (sheetName !== '訪問履歴(生データ/編集不可)') return;

  const editedRow = e.range.getRow();
  const editedCol = e.range.getColumn();

  // 見出し行は無視
  if (editedRow < 2) return;

  // 反映対象列だけに限定
  // D:営業先, E:営業先担当者, F:メール, J:電話, K:FAX, L:住所, M:肩書き
  const targetCols = [4, 5, 6, 10, 11, 12, 13];

  if (!targetCols.includes(editedCol)) return;

  updateSalesMasterFromSheetRow(sheet, editedRow);

  updateReferralFormChoices();

  SpreadsheetApp.getActiveSpreadsheet().toast(
    '営業先マスターへ反映しました',
    '営業管理システム',
    3
  );
}

function rebuildSalesMaster() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const masterSheet = ss.getSheetByName('営業先マスター');
  const visitSheet = ss.getSheetByName('訪問履歴(生データ/編集不可)');

  if (!masterSheet) {
    SpreadsheetApp.getUi().alert('営業先マスター シートが見つかりません。');
    return;
  }

  if (!visitSheet) {
    SpreadsheetApp.getUi().alert('訪問履歴シートが見つかりません。');
    return;
  }

  const normalizeName = (name) => {
    return String(name)
      .normalize('NFKC')
      .replace(/[ \u00A0\u1680\u180E\u2000-\u200D\u202F\u205F\u3000\uFEFF]/g, '')
      .trim();
  };

  const visitLastRow = visitSheet.getLastRow();
  if (visitLastRow < 2) {
    SpreadsheetApp.getUi().alert('訪問履歴がありません。');
    return;
  }

  const visitHeaders = visitSheet
    .getRange(1, 1, 1, visitSheet.getLastColumn())
    .getValues()[0];

  const masterHeaders = masterSheet
    .getRange(1, 1, 1, masterSheet.getLastColumn())
    .getValues()[0];

  const getIndex = (headers, headerName) => headers.indexOf(headerName);

  const visitValues = visitSheet
    .getRange(2, 1, visitLastRow - 1, visitSheet.getLastColumn())
    .getValues();

  const latestByCompany = {};

  visitValues.forEach(row => {
    const company = String(row[getIndex(visitHeaders, '営業先')] || '').trim();
    if (!company) return;

    const key = normalizeName(company);

    latestByCompany[key] = {
      company: company,
      person: String(row[getIndex(visitHeaders, '営業先担当者')] || '').trim(),
      title: String(row[getIndex(visitHeaders, '肩書き')] || '').trim(),
      phone: String(row[getIndex(visitHeaders, '電話')] || '').trim(),
      fax: String(row[getIndex(visitHeaders, 'FAX')] || '').trim(),
      email: String(row[getIndex(visitHeaders, 'メールアドレス')] || '').trim(),
      address: String(row[getIndex(visitHeaders, '住所')] || '').trim()
    };
  });

  const masterLastRow = masterSheet.getLastRow();
  const masterNames = masterLastRow >= 2
    ? masterSheet.getRange(2, 1, masterLastRow - 1, 1).getValues().flat()
    : [];

  const masterRowByKey = {};

  masterNames.forEach((name, i) => {
    const key = normalizeName(name);
    if (key && !masterRowByKey[key]) {
      masterRowByKey[key] = i + 2;
    }
  });

  const getMasterCol = (headerName) => {
    const index = masterHeaders.indexOf(headerName);
    return index === -1 ? null : index + 1;
  };

  const setByHeader = (row, headerName, value) => {
  const col = getMasterCol(headerName);
  if (!col) return;

  const range = masterSheet.getRange(row, col);

  // 電話・FAX・メール・住所は、数値ではなく文字列として扱う
  // 特に電話/FAXは先頭の0が消えないようにする
  if (
    headerName === '電話' ||
    headerName === 'FAX' ||
    headerName === 'メールアドレス' ||
    headerName === '住所'
  ) {
    range.setNumberFormat('@');
  }

  range.setValue(value);
};

  let addedCount = 0;
  let updatedCount = 0;

  Object.keys(latestByCompany).forEach(key => {
    const data = latestByCompany[key];

    let targetRow = masterRowByKey[key];

    if (!targetRow) {
      targetRow = masterSheet.getLastRow() + 1;

      masterSheet.getRange(targetRow, 1).setValue(data.company);

      if (targetRow > 2) {
        masterSheet
          .getRange(2, 2, 1, masterSheet.getLastColumn() - 1)
          .copyTo(
            masterSheet.getRange(targetRow, 2, 1, masterSheet.getLastColumn() - 1),
            { contentsOnly: false }
          );
      }

      masterRowByKey[key] = targetRow;
      addedCount++;
    } else {
      updatedCount++;
    }

    // A列の営業先名とB列以降の管理・集計列は原則保持。
    // C〜H相当の基本情報のみ、訪問履歴の最新情報で同期する。
    setByHeader(targetRow, '担当者', data.person);
    setByHeader(targetRow, '肩書き', data.title);
    setByHeader(targetRow, '電話', data.phone);
    setByHeader(targetRow, 'FAX', data.fax);
    setByHeader(targetRow, 'メールアドレス', data.email);
    setByHeader(targetRow, '住所', data.address);
  });

  updateReferralFormChoices();

  const message =
    '営業先データを整理しました。\n\n' +
    '訪問履歴件数：' + visitValues.length + '\n' +
    '営業先数：' + Object.keys(latestByCompany).length + '\n' +
    '新規追加：' + addedCount + '件\n' +
    '基本情報更新：' + updatedCount + '件\n\n' +
    '担当者・肩書き・電話・FAX・メールアドレス・住所を最新化しました。\n' +
    '種別・ランク・集計列などの管理情報は保持しています。\n\n' +
    '紹介実績フォームの候補も同期しました。';

  SpreadsheetApp.getUi().alert(message);
  Logger.log(message);
}

/**
 * Phase3: フォーム同期エンジン
 * 全フォームの候補を一括更新する。
 */
function updateAllForms() {
  const results = [];

  results.push(runFormUpdate_('紹介実績フォーム', updateReferralFormChoices));
  results.push(runFormUpdate_('営業予定フォーム', updateSalesPlanFormChoices));
  results.push(runFormUpdate_('地域情報共有フォーム', updateRegionInfoFormChoices));

  const message =
    '全フォーム候補を最新化しました。\\n\\n' +
    results.join('\\n');

  Logger.log(message);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    ss.toast('全フォーム候補を最新化しました。', 'フォーム同期', 5);
  }

  return message;
}

/**
 * フォーム更新処理を安全に実行する共通関数
 */
function runFormUpdate_(label, fn) {
  try {
    if (typeof fn !== 'function') {
      return '△ ' + label + ': 更新関数が未実装です';
    }

    const result = fn();

    if (result) {
      return result;
    }

    return '○ ' + label + ': 更新完了';
  } catch (error) {
    Logger.log(error);
    return '× ' + label + ': エラー - ' + error.message;
  }
}

/**
 * Phase6で本実装予定。
 * 現時点では地域情報共有フォーム未作成のためスキップする。
 */
function updateRegionInfoFormChoices() {
  const message = '△ 地域情報共有フォーム: 未実装のためスキップ';
  Logger.log(message);
  return message;
}
