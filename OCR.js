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
