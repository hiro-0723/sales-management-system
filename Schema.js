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

function findSalesActivityForms() {
  const files = DriveApp.getFilesByType(MimeType.GOOGLE_FORMS);

  const results = [];

  while (files.hasNext()) {
    const file = files.next();
    const form = FormApp.openById(file.getId());
    const title = form.getTitle();

    if (
      title.includes('営業活動') ||
      title.includes('訪問') ||
      title.includes('OCR確認済み')
    ) {
      results.push({
        title: title,
        id: file.getId(),
        editUrl: form.getEditUrl(),
        publishedUrl: form.getPublishedUrl(),
        itemTitles: form.getItems().map(item => item.getTitle())
      });
    }
  }

  Logger.log(JSON.stringify(results, null, 2));
}

function registerExistingVisitReportForm() {
  const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSdNnG1NM5fmDOMOR-1utWVZp9b5SS9g6F6hjhUanRnLnWcqhA/viewform?usp=header';

  const form = FormApp.openByUrl(formUrl);

  PropertiesService.getScriptProperties()
    .setProperty('VISIT_REPORT_FORM_ID', form.getId());

  Logger.log('営業活動報告フォームを登録しました');
  Logger.log('フォームID: ' + form.getId());
  Logger.log('編集URL: ' + form.getEditUrl());
  Logger.log('公開URL: ' + form.getPublishedUrl());

  form.getItems().forEach(item => {
    Logger.log(item.getTitle() + ' / ' + item.getType());
  });
}
