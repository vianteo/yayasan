function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  const properties = PropertiesService.getScriptProperties();
  const serviceUrl = String(ScriptApp.getService().getUrl() || '');
  template.initialPage = String((e && e.parameter && e.parameter.page) || 'public');
  template.publicAppUrl = properties.getProperty('PUBLIC_APP_URL') || serviceUrl;
  template.internalAppUrl = properties.getProperty('INTERNAL_APP_URL') || (serviceUrl ? serviceUrl + '?page=internal' : '');
  template.officialContact = {
    OFFICIAL_BANK_NAME: OFFICIAL_BANK.NAME,
    OFFICIAL_BANK_ACCOUNT_NAME: OFFICIAL_BANK.ACCOUNT_NAME,
    OFFICIAL_BANK_ACCOUNT_NUMBER: OFFICIAL_BANK.ACCOUNT_NUMBER,
  };
  return template.evaluate()
    .setTitle(APP.NAME)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function healthCheck() {
  const required = JSON.parse(PropertiesService.getScriptProperties().getProperty('REQUIRED_PROPERTY_NAMES') || '[]');
  const fallback = [
    'PRIMARY_SPREADSHEET_ID',
    'DOCUMENTS_DRIVE_FOLDER_ID',
    'BACKUP_DRIVE_FOLDER_ID',
    'SESSION_SIGNING_KEY',
    'PUBLIC_APP_URL',
    'INTERNAL_APP_URL',
    'LARGE_TRANSACTION_THRESHOLD_IDR',
  ];
  const names = required.length ? required : fallback;
  const properties = PropertiesService.getScriptProperties();
  const missing = names.filter(function (name) { return !properties.getProperty(name); });
  return {ok: missing.length === 0, missingProperties: missing, checkedAt: nowIso_()};
}
