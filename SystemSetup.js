function setupSystem() {
  registerVisitReportForm_();
  ensureSalesPlanSheet_();
  ensureSalesPlanForm_();
  ensureSalesPlanSubmitTrigger_();
  updateAllForms();

  SpreadsheetApp.getUi().alert(
    'システム初期設定が完了しました。\n\n' +
    '既存データは保持したまま、必要なシート・フォーム・トリガーを確認しました。'
  );
}

function ensureSalesPlanSheet_() {
  setupSalesPlanSheet();
}

function ensureSalesPlanForm_() {
  const props = PropertiesService.getScriptProperties();
  const formId = props.getProperty('SALES_PLAN_FORM_ID');

  if (!formId) {
    SpreadsheetApp.getUi().alert(
      '営業予定フォームIDが未設定です。\n既存フォームを壊さないため、フォーム再作成は行いません。'
    );
    return;
  }

  try {
    FormApp.openById(formId);
    updateSalesPlanFormChoices();
  } catch (e) {
    SpreadsheetApp.getUi().alert(
      '営業予定フォームを開けませんでした。\n既存フォームを壊さないため、フォーム再作成は行いません。'
    );
  }
}

function ensureSalesPlanSubmitTrigger_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const exists = ScriptApp.getProjectTriggers()
    .some(trigger =>
      trigger.getHandlerFunction() === 'onSalesPlanSubmit' &&
      trigger.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT
    );

  if (exists) return;

  ScriptApp.newTrigger('onSalesPlanSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();
}


function registerVisitReportForm_() {
  PropertiesService.getScriptProperties().setProperty(
    'VISIT_REPORT_FORM_ID',
    '19kiXsP0cFy9TAJMAxgge5_jOnP-juZ7gSmGTAeZ5tHs'
  );
}
