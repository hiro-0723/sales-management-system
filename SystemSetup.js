function setupSystem() {
  const results = [];

  results.push(runSetupStep_('訪問履歴フォームID登録', registerVisitReportForm_));
  results.push(runSetupStep_('営業予定シート確認', ensureSalesPlanSheet_));
  results.push(runSetupStep_('営業予定フォーム確認', ensureSalesPlanForm_));
  results.push(runSetupStep_('営業予定フォーム送信トリガー確認', ensureSalesPlanSubmitTrigger_));

  results.push(runSetupStep_('営業活動報告フォームPlanID確認', ensureVisitReportPlanIdItem));
  results.push(runSetupStep_('営業予定シート営業報告列確認', ensureSalesPlanReportUrlColumn));
  results.push(runSetupStep_('営業活動報告URL更新', updateSalesPlanReportUrls));
  results.push(runSetupStep_('営業活動報告フォーム送信トリガー確認', ensureVisitReportSubmitTrigger_));

  results.push(runSetupStep_('全フォーム候補更新', updateAllForms));

  const message =
    'システム初期設定が完了しました。\n\n' +
    results.join('\n') +
    '\n\n必要に応じて、営業管理メニューの「システム診断」を実行してください。';

  Logger.log(message);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    ss.toast('システム初期設定が完了しました。', '営業管理システム', 5);
  }

  return message;
}

function runSetupStep_(label, fn) {
  try {
    if (typeof fn !== 'function') {
      return '△ ' + label + ': 関数が未実装です';
    }

    fn();
    return '○ ' + label + ': 完了';
  } catch (error) {
    Logger.log(error);
    return '× ' + label + ': エラー - ' + error.message;
  }
}

function ensureSalesPlanSheet_() {
  setupSalesPlanSheet();
}

function ensureSalesPlanForm_() {
  const props = PropertiesService.getScriptProperties();
  const formId = props.getProperty('SALES_PLAN_FORM_ID');

  if (!formId) {
    Logger.log('営業予定フォームIDが未設定です。既存フォームを壊さないため、フォーム再作成は行いません。');
    return;
  }

  const form = FormApp.openById(formId);
  updateSalesPlanFormChoices();
  Logger.log('営業予定フォーム確認完了: ' + form.getTitle());
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

function ensureVisitReportSubmitTrigger_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const exists = ScriptApp.getProjectTriggers()
    .some(trigger =>
      trigger.getHandlerFunction() === 'onVisitReportSubmit' &&
      trigger.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT
    );

  if (exists) return;

  ScriptApp.newTrigger('onVisitReportSubmit')
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
