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


function testGeminiConnection() {

  const apiKey =
    PropertiesService.getScriptProperties()
      .getProperty('GEMINI_API_KEY');

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key='
    + apiKey;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: "こんにちは。返事だけしてください。"
          }
        ]
      }
    ]
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  });

  const result = JSON.parse(response.getContentText());

  Logger.log(result);
}

function testReadBusinessCard() {

  const fileId = '1C0fE4UGUs2vfiUKkzkeizXLJDG3vrycN';

  const file = DriveApp.getFileById(fileId);

  Logger.log(file.getName());

}

function testBusinessCardOCR() {

  const apiKey =
    PropertiesService.getScriptProperties()
      .getProperty('GEMINI_API_KEY');

  const fileId = '1C0fE4UGUs2vfiUKkzkeizXLJDG3vrycN';

  const file = DriveApp.getFileById(fileId);

  const blob = file.getBlob();

  const base64Image =
    Utilities.base64Encode(blob.getBytes());

  const prompt = `
あなたは名刺OCRです。

名刺から以下の情報だけを抽出してください。

company
person
phone
fax
email
address

余計な説明は不要。

必ずJSON形式のみで返してください。

例

{
  "company":"株式会社サンプル",
  "person":"山田太郎",
  "phone":"03-1234-5678",
  "fax":"03-1234-9999",
  "email":"test@example.com",
  "address":"東京都千代田区..."
}
`;

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: blob.getContentType(),
            data: base64Image
          }
        }
      ]
    }]
  };

  const response = fetchGeminiWithRetry(
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + apiKey,
  payload
);

  const result =
    JSON.parse(response.getContentText());

  Logger.log(
    result.candidates[0].content.parts[0].text
  );
}


function ocrToWaitingSheet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (e && e.range) {
    const submittedSheetName = e.range.getSheet().getName();
    if (submittedSheetName !== '名刺OCR依頼') return;
  }

  const requestSheet = ss.getSheetByName('名刺OCR依頼');
  const waitingSheet = ss.getSheetByName('名刺OCR確認待ち');

  const lastRow = requestSheet.getLastRow();
  if (lastRow < 2) return;

  const staff = requestSheet.getRange(lastRow, 3).getValue();
  const senderMail = requestSheet.getRange(lastRow, 4).getValue();
  const imageUrl = requestSheet.getRange(lastRow, 5).getValue();

  const fileId = imageUrl.match(/id=([^&]+)/)[1];
  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();

  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  const prompt = `
名刺から以下の情報だけを抽出してください。

company
person
title
phone
fax
email
address

ルール：
- phone は必ず配列で返してください
- 固定電話、携帯電話、代表番号など、電話番号が複数ある場合はすべて phone に入れてください
- FAX番号は phone には入れず、fax に入れてください
- email が複数ある場合はすべて email に入れてください
- 余計な説明は不要です
- 必ずJSON形式のみ返してください

例：
{
  "company": "株式会社サンプル",
  "person": "山田太郎",
  "title":"営業部長",
  "phone": ["0438-22-2156", "070-1520-1942"],
  "fax": "0438-25-7358",
  "email": "test@example.com",
  "address": "千葉県木更津市..."
}
`;

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: blob.getContentType(),
            data: Utilities.base64Encode(blob.getBytes())
          }
        }
      ]
    }]
  };

  const response = fetchGeminiWithRetry(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=' + apiKey,
    payload
  );

  const responseText = response.getContentText();
  Logger.log(responseText);

  const result = JSON.parse(responseText);

  if (result.error) {
    throw new Error(result.error.message);
  }

  let text = result.candidates[0].content.parts[0].text;

  text = text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  const data = JSON.parse(text);

  const formatValue = (value) => {
    if (!value) return '';
    if (Array.isArray(value)) return value.join(' / ');
    return String(value);
  };

  const baseFormUrl =
    'https://docs.google.com/forms/d/e/1FAIpQLSfCRaA8jzPu9WYdmb2nGhjI-_SL7AGFoMiyvzC1Qq3OWpBTbw/viewform?usp=pp_url';

  const formUrl =
    baseFormUrl +
    '&entry.1243873085=' + encodeURIComponent(Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd')) +
    '&entry.1623965905=' + encodeURIComponent(staff) +
    '&entry.2107421411=' + encodeURIComponent(formatValue(data.company)) +
    '&entry.1883079877=' + encodeURIComponent(formatValue(data.person)) +
    '&entry.282404519=' + encodeURIComponent(formatValue(data.title)) +
    '&entry.1229270416=' + encodeURIComponent(formatValue(data.email)) +
    '&entry.1029743620=' + encodeURIComponent(formatValue(data.phone)) +
    '&entry.1619817651=' + encodeURIComponent(formatValue(data.fax)) +
    '&entry.97398630=' + encodeURIComponent(formatValue(data.address));

  waitingSheet.appendRow([
    new Date(),
    staff,
    senderMail,
    imageUrl,
    formatValue(data.company),
    formatValue(data.person),
    formatValue(data.title),
    formatValue(data.email),
    formatValue(data.phone),
    formatValue(data.fax),
    formatValue(data.address),
    formUrl,
    '未確認'
  ]);

  GmailApp.sendEmail(
    senderMail,
    '【要確認】名刺OCR結果の確認フォーム',
    '名刺写真から情報を読み取りました。\n\n' +
    '下記URLを開き、内容を確認・修正して営業活動報告を送信してください。\n\n' +
    formUrl + '\n\n' +
    '※営業内容・相談内容・位置情報などは必要に応じて追加入力してください。'
  );
}


function getFormItemIds() {

  const form =
    FormApp.openById(
      '1PEB0oku2c8QEmxYuB0K-terKfGR5gLxkS4TIWZcyfAY'
    );

  const items = form.getItems();

  items.forEach(item => {

    Logger.log(
      item.getTitle() +
      ' : ' +
      item.getId()
    );

  });

}


function getPrefilledUrlSample() {
  const form = FormApp.openById(
    '1PEB0oku2c8QEmxYuB0K-terKfGR5gLxkS4TIWZcyfAY'
  );

  const response = form.createResponse();

  form.getItems().forEach(item => {
    const title = item.getTitle();

    if (title === '日付') {
      response.withItemResponse(
        item.asDateItem().createResponse(
          new Date(2026, 5, 11)
        )
      );
    }

    if (title === '営業担当') {
      response.withItemResponse(
        item.asTextItem().createResponse('高橋')
      );
    }

    if (title === '営業先') {
      response.withItemResponse(
        item.asTextItem().createResponse('テスト会社')
      );
    }

    if (title === '営業先担当者') {
      response.withItemResponse(
        item.asTextItem().createResponse('山田')
      );
    }

    if (title === 'メールアドレス') {
      response.withItemResponse(
        item.asTextItem().createResponse('test@test.com')
      );
    }

    if (title === '電話') {
      response.withItemResponse(
        item.asTextItem().createResponse('111')
      );
    }

    if (title === 'FAX') {
      response.withItemResponse(
        item.asTextItem().createResponse('222')
      );
    }

    if (title === '肩書き') {
  response.withItemResponse(
    item.asTextItem().createResponse('テスト肩書き')
  );
}

    if (title === '住所') {
      response.withItemResponse(
        item.asParagraphTextItem().createResponse('テスト住所')
      );
    }
  });

  Logger.log(response.toPrefilledUrl());
}

function transferOcrConfirmedToVisitHistory(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let sourceSheet;
  let sourceRowNumber;

  if (e && e.range) {
    sourceSheet = e.range.getSheet();

    if (sourceSheet.getName() !== 'OCR確認済み営業活動') return;

    sourceRowNumber = e.range.getRow();
  } else {
    sourceSheet = ss.getSheetByName('OCR確認済み営業活動');
    sourceRowNumber = sourceSheet.getLastRow();
  }

  const targetSheet = ss.getSheetByName('訪問履歴(生データ/編集不可)');

  if (!sourceSheet) throw new Error('OCR確認済み営業活動 シートが見つかりません');
  if (!targetSheet) throw new Error('訪問履歴(生データ/編集不可) シートが見つかりません');

  if (sourceRowNumber < 2) return;

  const sourceHeaders = sourceSheet
    .getRange(1, 1, 1, sourceSheet.getLastColumn())
    .getValues()[0];

  const targetHeaders = targetSheet
    .getRange(1, 1, 1, targetSheet.getLastColumn())
    .getValues()[0];

  const sourceRow = sourceSheet
    .getRange(sourceRowNumber, 1, 1, sourceSheet.getLastColumn())
    .getValues()[0];

  const getValueByHeader = (headerName) => {
    const index = sourceHeaders.indexOf(headerName);
    if (index === -1) return '';
    return sourceRow[index];
  };

  const rowToAppend = targetHeaders.map(headerName => {
    return getValueByHeader(headerName);
  });

  if (!isDuplicateVisit(targetSheet, rowToAppend)) {
    targetSheet.appendRow(rowToAppend);

    const appendedRow = targetSheet.getLastRow();
    updateSalesMasterFromSheetRow(targetSheet, appendedRow);
  }

  markOcrWaitingAsConfirmed(sourceRow, sourceHeaders);
}

function fetchGeminiWithRetry(url, payload) {
  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  for (let i = 0; i < 3; i++) {
    const response = UrlFetchApp.fetch(url, options);
    const responseText = response.getContentText();
    const result = JSON.parse(responseText);

    if (!result.error) {
      return response;
    }

    if (i === 2) {
      throw new Error(result.error.message);
    }

    Utilities.sleep(3000);
  }
}

function isDuplicateVisit(targetSheet, rowToAppend) {
  const lastRow = targetSheet.getLastRow();
  if (lastRow < 2) return false;

  const existingValues = targetSheet
    .getRange(2, 1, lastRow - 1, 12)
    .getValues();

  const newTimestamp = String(rowToAppend[0]).trim();
  const newDate = String(rowToAppend[1]).trim();
  const newStaff = String(rowToAppend[2]).trim();
  const newCompany = String(rowToAppend[3]).trim();
  const newPerson = String(rowToAppend[4]).trim();

  return existingValues.some(row => {
    return (
      String(row[0]).trim() === newTimestamp &&
      String(row[1]).trim() === newDate &&
      String(row[2]).trim() === newStaff &&
      String(row[3]).trim() === newCompany &&
      String(row[4]).trim() === newPerson
    );
  });
}

function markOcrWaitingAsConfirmed(sourceRow, sourceHeaders) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const waitingSheet = ss.getSheetByName('名刺OCR確認待ち');

  if (!waitingSheet) return;

  const getSourceValue = (headerName) => {
    const index = sourceHeaders.indexOf(headerName);
    if (index === -1) return '';
    return String(sourceRow[index]).trim();
  };

  const company = getSourceValue('営業先');
  const person = getSourceValue('営業先担当者');
  const email = getSourceValue('メールアドレス');

  const lastRow = waitingSheet.getLastRow();
  if (lastRow < 2) return;

  const waitingHeaders = waitingSheet
    .getRange(1, 1, 1, waitingSheet.getLastColumn())
    .getValues()[0];

  const getWaitingCol = (headerName) => {
    const index = waitingHeaders.indexOf(headerName);
    return index === -1 ? null : index + 1;
  };

  const companyCol = getWaitingCol('営業先');
  const personCol = getWaitingCol('営業先担当者');
  const emailCol = getWaitingCol('メールアドレス');
  const statusCol = getWaitingCol('確認状況');

  if (!companyCol || !personCol || !emailCol || !statusCol) return;

  for (let row = lastRow; row >= 2; row--) {
    const waitingCompany = String(waitingSheet.getRange(row, companyCol).getValue()).trim();
    const waitingPerson = String(waitingSheet.getRange(row, personCol).getValue()).trim();
    const waitingEmail = String(waitingSheet.getRange(row, emailCol).getValue()).trim();

    if (
      waitingCompany === company &&
      waitingPerson === person &&
      waitingEmail === email
    ) {
      waitingSheet.getRange(row, statusCol).setValue('確認済');
      return;
    }
  }
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

function exportAllSchemas() {
  exportSpreadsheetSchema();
  exportFormSchema();
  exportTriggers();
}

function exportSpreadsheetSchema() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const result = ss.getSheets().map(sheet => {
    const headers = sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0];

    return {
      sheetName: sheet.getName(),
      lastColumn: sheet.getLastColumn(),
      headers: headers
    };
  });

  Logger.log('=== Spreadsheet Schema ===');
  Logger.log(JSON.stringify(result, null, 2));
}

function exportFormSchema() {
  const formUrls = [
    'https://docs.google.com/forms/d/e/1FAIpQLSfpXrKpPIOj_uI99MT62qm44d-8ysu3VODxDH9WoMAaQy9Vvg/viewform?usp=header',
    'https://docs.google.com/forms/d/e/1FAIpQLSfCRaA8jzPu9WYdmb2nGhjI-_SL7AGFoMiyvzC1Qq3OWpBTbw/viewform?usp=header',
    'https://docs.google.com/forms/d/e/1FAIpQLSdNnG1NM5fmDOMOR-1utWVZp9b5SS9g6F6hjhUanRnLnWcqhA/viewform?usp=header',
    'https://docs.google.com/forms/d/e/1FAIpQLScTu-GMM1a_kZEsKHlYS6N9q89S7dfYAJdVMNkXivq4mChhRg/viewform?usp=header'
  ];

  const result = formUrls.map(url => {
    const form = FormApp.openByUrl(url);

    return {
      formTitle: form.getTitle(),
      formUrl: url,
      items: form.getItems().map(item => ({
        title: item.getTitle(),
        type: item.getType().toString(),
        required: item.isRequired ? item.isRequired() : false
      }))
    };
  });

  Logger.log('=== Form Schema ===');
  Logger.log(JSON.stringify(result, null, 2));
}

function exportTriggers() {
  const triggers = ScriptApp.getProjectTriggers();

  const result = triggers.map(t => ({
    functionName: t.getHandlerFunction(),
    eventType: t.getEventType().toString(),
    source: t.getTriggerSource().toString()
  }));

  Logger.log('=== Trigger Schema ===');
  Logger.log(JSON.stringify(result, null, 2));
}

function exportAllSchemasToDrive() {
  const schema = {
    exportedAt: new Date(),
    spreadsheet: exportSpreadsheetSchemaData(),
    forms: exportFormSchemaData(),
    triggers: exportTriggerSchemaData()
  };

  const json = JSON.stringify(schema, null, 2);
  const fileName = 'sales-management-system-schema.json';

  const files = DriveApp.getFilesByName(fileName);

  if (files.hasNext()) {
    const file = files.next();
    file.setContent(json);
    Logger.log('更新しました: ' + file.getUrl());
  } else {
    const file = DriveApp.createFile(fileName, json, MimeType.PLAIN_TEXT);
    Logger.log('作成しました: ' + file.getUrl());
  }
}

function exportSpreadsheetSchemaData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  return ss.getSheets().map(sheet => {
    const lastColumn = sheet.getLastColumn();

    const headers = lastColumn > 0
      ? sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
      : [];

    return {
      sheetName: sheet.getName(),
      lastRow: sheet.getLastRow(),
      lastColumn: lastColumn,
      headers: headers
    };
  });
}

function exportFormSchemaData() {
  const targetTitles = [
    '紹介実績入力フォーム',
    'OCR確認済み営業活動報告フォーム',
    '営業活動報告フォーム',
    '名刺OCR依頼フォーム'
  ];

  const result = [];
  const files = DriveApp.getFilesByType(MimeType.GOOGLE_FORMS);

  while (files.hasNext()) {
    const file = files.next();
    const form = FormApp.openById(file.getId());
    const title = form.getTitle();

    if (!targetTitles.includes(title)) continue;

    result.push({
      formTitle: title,
      formId: file.getId(),
      editUrl: form.getEditUrl(),
      publishedUrl: form.getPublishedUrl(),
      items: form.getItems().map(item => ({
        title: item.getTitle(),
        type: item.getType().toString(),
        id: item.getId()
      }))
    });
  }

  return result;
}

function exportTriggerSchemaData() {
  return ScriptApp.getProjectTriggers().map(trigger => ({
    functionName: trigger.getHandlerFunction(),
    eventType: trigger.getEventType().toString(),
    source: trigger.getTriggerSource().toString()
  }));
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('営業管理メニュー')
    .addItem('営業先データを整理する', 'maintenanceSalesMasterAndForm')
    .addItem('営業先マスター再構築', 'rebuildSalesMaster')
    .addSeparator()
    .addItem('システム診断', 'systemHealthCheck')
    .addItem('システム構成を書き出す', 'exportAllSchemasToDrive')
    .addToUi();
}

function maintenanceSalesMasterAndForm() {
  cleanupSalesMaster();
  rebuildSalesMaster();
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

function exportFullSystemSchema() {

  const schema = {
    exportedAt: new Date(),

    spreadsheet: exportSpreadsheetSchema_(),

    forms: exportFormsSchema_(),

    triggers: exportTriggerSchema_()
  };

  const json = JSON.stringify(schema, null, 2);

  const fileName = "sales-management-system-full-schema.json";

  const files = DriveApp.getFilesByName(fileName);

  if (files.hasNext()) {

    files.next().setContent(json);

  } else {

    DriveApp.createFile(fileName, json, MimeType.PLAIN_TEXT);

  }

  SpreadsheetApp.getUi().alert("フルスキーマを書き出しました。");
}



function exportSpreadsheetSchema_(){

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  return ss.getSheets().map(sheet=>{

    const lastRow=sheet.getLastRow();
    const lastCol=sheet.getLastColumn();

    const headers=
      lastCol>0
      ?sheet.getRange(1,1,1,lastCol).getValues()[0]
      :[];

    return{

      sheetName:sheet.getName(),

      rows:lastRow,

      columns:lastCol,

      frozenRows:sheet.getFrozenRows(),

      frozenColumns:sheet.getFrozenColumns(),

      headers:headers

    };

  });

}



function exportFormsSchema_(){

  const result=[];

  const files=DriveApp.getFilesByType(MimeType.GOOGLE_FORMS);

  while(files.hasNext()){

    const file=files.next();

    const form=FormApp.openById(file.getId());

    const items=form.getItems().map(item=>{

      const obj={

        id:item.getId(),

        title:item.getTitle(),

        type:item.getType().toString()

      };

      try{

        if(item.getType()==FormApp.ItemType.LIST){

          obj.choices=item.asListItem()
            .getChoices()
            .map(c=>c.getValue());

        }

        if(item.getType()==FormApp.ItemType.MULTIPLE_CHOICE){

          obj.choices=item.asMultipleChoiceItem()
            .getChoices()
            .map(c=>c.getValue());

        }

      }catch(err){}

      return obj;

    });

    result.push({

      title:form.getTitle(),

      id:file.getId(),

      editUrl:form.getEditUrl(),

      publishedUrl:form.getPublishedUrl(),

      items:items

    });

  }

  return result;

}



function exportTriggerSchema_(){

  return ScriptApp.getProjectTriggers().map(t=>({

    function:t.getHandlerFunction(),

    eventType:t.getEventType().toString(),

    source:t.getTriggerSource().toString()

  }));

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