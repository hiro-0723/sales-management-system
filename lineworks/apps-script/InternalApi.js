const SALES_LINEWORKS_INTERNAL_SECRET_PROPERTY =
  'SALES_LINEWORKS_INTERNAL_SECRET';
const SALES_LINEWORKS_REQUEST_SHEET = '_LINEWORKS_REQUESTS';
const SALES_LINEWORKS_REGION_SHEET = '地域情報共有';
const SALES_LINEWORKS_MAX_CLOCK_SKEW_MS = 60 * 1000;
const SALES_LINEWORKS_MAX_ENVELOPE_LIFETIME_MS = 10 * 60 * 1000;

function doPost(e) {
  const rawBody = e && e.postData ? e.postData.contents : '';
  const result = handleSalesLineWorksInternalRequest_(
    rawBody,
    createSalesLineWorksAppsScriptDependencies_()
  );

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleSalesLineWorksInternalRequest_(rawBody, deps) {
  let envelope;
  try {
    envelope = JSON.parse(rawBody || '');
  } catch (error) {
    return salesLineWorksFailure_('INVALID_JSON', false);
  }

  const envelopeError = validateSalesLineWorksEnvelope_(
    envelope,
    deps.nowMs()
  );
  if (envelopeError) return salesLineWorksFailure_(envelopeError, false);

  const secret = deps.getInternalSecret();
  if (!secret) return salesLineWorksFailure_('SECRET_NOT_CONFIGURED', true);

  const signedValue = canonicalizeSalesLineWorksValue_(
    removeSalesLineWorksSignature_(envelope)
  );
  const expectedSignature = deps.computeHmacBase64(signedValue, secret);
  if (!constantTimeSalesLineWorksEqual_(
    expectedSignature,
    envelope.signature
  )) {
    return salesLineWorksFailure_('SIGNATURE_MISMATCH', false);
  }

  const payloadError = validateSalesLineWorksRegionPayload_(envelope.payload);
  if (payloadError) return salesLineWorksFailure_(payloadError, false);

  const lock = deps.acquireLock();
  try {
    const regionInfoId = deps.createRegionInfoId(envelope);
    const receipt = deps.beginRequest(envelope.requestId, regionInfoId);

    if (receipt.status === 'COMPLETE') {
      return salesLineWorksSuccess_(
        receipt.regionInfoId,
        envelope.requestId,
        true
      );
    }

    if (!deps.regionInfoExists(receipt.regionInfoId)) {
      deps.appendRegionInfo(
        createSalesLineWorksRegionRecord_(envelope, receipt.regionInfoId)
      );
    }

    deps.completeRequest(envelope.requestId);
    return salesLineWorksSuccess_(
      receipt.regionInfoId,
      envelope.requestId,
      receipt.existed
    );
  } catch (error) {
    deps.logError('LINE WORKS internal request failed', error);
    return salesLineWorksFailure_('REGISTRATION_FAILED', true);
  } finally {
    lock.release();
  }
}

function validateSalesLineWorksEnvelope_(envelope, nowMs) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return 'INVALID_ENVELOPE';
  }
  if (envelope.version !== 1) return 'UNSUPPORTED_VERSION';
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(String(envelope.requestId || ''))) {
    return 'INVALID_REQUEST_ID';
  }

  const issuedAt = Date.parse(envelope.issuedAt);
  const expiresAt = Date.parse(envelope.expiresAt);
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) {
    return 'INVALID_TIME';
  }
  if (expiresAt <= issuedAt) return 'INVALID_TIME_RANGE';
  if (expiresAt - issuedAt > SALES_LINEWORKS_MAX_ENVELOPE_LIFETIME_MS) {
    return 'ENVELOPE_LIFETIME_TOO_LONG';
  }
  if (issuedAt > nowMs + SALES_LINEWORKS_MAX_CLOCK_SKEW_MS) {
    return 'ISSUED_IN_FUTURE';
  }
  if (expiresAt < nowMs) return 'EXPIRED';
  if (typeof envelope.signature !== 'string' || !envelope.signature) {
    return 'SIGNATURE_REQUIRED';
  }
  return '';
}

function validateSalesLineWorksRegionPayload_(payload) {
  if (!payload || payload.sourceSystem !== 'lineworks') {
    return 'INVALID_SOURCE';
  }
  if (payload.payloadType !== 'regionInfo') {
    return 'UNSUPPORTED_PAYLOAD_TYPE';
  }
  if (!salesLineWorksRequiredText_(payload.sourceEventKey, 256)) {
    return 'INVALID_SOURCE_EVENT_KEY';
  }
  if (!salesLineWorksRequiredText_(payload.actorExternalId, 256)) {
    return 'INVALID_ACTOR_EXTERNAL_ID';
  }
  if (!salesLineWorksRequiredText_(payload.actorInternalName, 100)) {
    return 'INVALID_ACTOR_INTERNAL_NAME';
  }

  const data = payload.data;
  if (!data || typeof data !== 'object') return 'INVALID_DATA';
  if (!salesLineWorksRequiredText_(data.department, 100)) {
    return 'INVALID_DEPARTMENT';
  }
  if (!salesLineWorksRequiredText_(data.category, 100)) {
    return 'INVALID_CATEGORY';
  }
  if (!salesLineWorksRequiredText_(data.content, 2000)) {
    return 'INVALID_CONTENT';
  }
  if (!salesLineWorksOptionalText_(data.relatedParty, 200)) {
    return 'INVALID_RELATED_PARTY';
  }
  if (!['高', '中', '低', '分からない'].includes(data.priority)) {
    return 'INVALID_PRIORITY';
  }
  if (!['動いてほしい', '共有のみ', '判断を任せる'].includes(
    data.salesAction
  )) {
    return 'INVALID_SALES_ACTION';
  }
  return '';
}

function createSalesLineWorksRegionRecord_(envelope, regionInfoId) {
  const payload = envelope.payload;
  const data = payload.data;
  return {
    regionInfoId: regionInfoId,
    timestamp: new Date(envelope.issuedAt),
    author: payload.actorInternalName,
    department: data.department,
    category: data.category,
    content: data.content,
    relatedParty: data.relatedParty || '',
    priority: data.priority,
    salesAction: data.salesAction,
    status: '未対応'
  };
}

function createSalesLineWorksAppsScriptDependencies_() {
  return {
    nowMs: function() {
      return Date.now();
    },
    getInternalSecret: function() {
      return PropertiesService.getScriptProperties()
        .getProperty(SALES_LINEWORKS_INTERNAL_SECRET_PROPERTY);
    },
    computeHmacBase64: function(value, secret) {
      const bytes = Utilities.computeHmacSha256Signature(
        value,
        secret,
        Utilities.Charset.UTF_8
      );
      return Utilities.base64Encode(bytes);
    },
    acquireLock: function() {
      const lock = LockService.getScriptLock();
      lock.waitLock(30000);
      return {
        release: function() {
          lock.releaseLock();
        }
      };
    },
    createRegionInfoId: function(envelope) {
      const timestamp = Utilities.formatDate(
        new Date(envelope.issuedAt),
        'Asia/Tokyo',
        'yyyyMMddHHmmss'
      );
      const digest = Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        envelope.requestId
      );
      const suffix = digest
        .slice(0, 4)
        .map(function(value) {
          return ('0' + ((value + 256) % 256).toString(16)).slice(-2);
        })
        .join('')
        .toUpperCase();
      return 'REG-' + timestamp + '-' + suffix;
    },
    beginRequest: beginSalesLineWorksRequest_,
    regionInfoExists: salesLineWorksRegionInfoExists_,
    appendRegionInfo: appendSalesLineWorksRegionInfo_,
    completeRequest: completeSalesLineWorksRequest_,
    logError: function(message, error) {
      console.error(message + ': ' + String(error && error.message || error));
    }
  };
}

function beginSalesLineWorksRequest_(requestId, regionInfoId) {
  const sheet = getOrCreateSalesLineWorksRequestSheet_();
  const values = sheet.getDataRange().getValues();
  for (let row = 1; row < values.length; row++) {
    if (String(values[row][0]) === requestId) {
      return {
        existed: true,
        regionInfoId: String(values[row][1]),
        status: String(values[row][2])
      };
    }
  }
  sheet.appendRow([requestId, regionInfoId, 'PROCESSING', new Date()]);
  return { existed: false, regionInfoId: regionInfoId, status: 'PROCESSING' };
}

function completeSalesLineWorksRequest_(requestId) {
  const sheet = getOrCreateSalesLineWorksRequestSheet_();
  const values = sheet.getDataRange().getValues();
  for (let row = 1; row < values.length; row++) {
    if (String(values[row][0]) === requestId) {
      sheet.getRange(row + 1, 3, 1, 2)
        .setValues([['COMPLETE', new Date()]]);
      return;
    }
  }
  throw new Error('Request receipt not found');
}

function getOrCreateSalesLineWorksRequestSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SALES_LINEWORKS_REQUEST_SHEET);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SALES_LINEWORKS_REQUEST_SHEET);
    sheet.getRange(1, 1, 1, 4).setValues([[
      'requestId',
      'regionInfoId',
      'status',
      'updatedAt'
    ]]);
    sheet.hideSheet();
  }
  return sheet;
}

function salesLineWorksRegionInfoExists_(regionInfoId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(SALES_LINEWORKS_REGION_SHEET);
  if (!sheet) throw new Error('地域情報共有シートがありません');
  if (sheet.getLastRow() < 2) return false;
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getDisplayValues()
    .some(function(row) {
      return row[0] === regionInfoId;
    });
}

function appendSalesLineWorksRegionInfo_(record) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName(SALES_LINEWORKS_REGION_SHEET);
  if (!sheet) throw new Error('地域情報共有シートがありません');

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];
  const valuesByHeader = {
    '地域情報ID': record.regionInfoId,
    'タイムスタンプ': record.timestamp,
    '投稿者': record.author,
    '部署': record.department,
    '情報分類': record.category,
    '内容': record.content,
    '関連先': record.relatedParty,
    '対応優先度': record.priority,
    '営業担当に動いてほしい？': record.salesAction,
    '対応状況': record.status
  };
  const row = headers.map(function(header) {
    return Object.prototype.hasOwnProperty.call(valuesByHeader, header)
      ? valuesByHeader[header]
      : '';
  });
  sheet.appendRow(row);
}

function removeSalesLineWorksSignature_(envelope) {
  const result = {};
  Object.keys(envelope).forEach(function(key) {
    if (key !== 'signature') result[key] = envelope[key];
  });
  return result;
}

function canonicalizeSalesLineWorksValue_(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalizeSalesLineWorksValue_).join(',') + ']';
  }
  return '{' + Object.keys(value).sort().map(function(key) {
    return JSON.stringify(key) + ':' +
      canonicalizeSalesLineWorksValue_(value[key]);
  }).join(',') + '}';
}

function constantTimeSalesLineWorksEqual_(left, right) {
  left = String(left || '');
  right = String(right || '');
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index++) {
    mismatch |= (left.charCodeAt(index) || 0) ^
      (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function salesLineWorksRequiredText_(value, maxLength) {
  return typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxLength;
}

function salesLineWorksOptionalText_(value, maxLength) {
  return value === undefined || value === null ||
    (typeof value === 'string' && value.length <= maxLength);
}

function salesLineWorksSuccess_(regionInfoId, requestId, duplicate) {
  return {
    ok: true,
    retryable: false,
    code: duplicate ? 'ALREADY_PROCESSED' : 'REGISTERED',
    requestId: requestId,
    regionInfoId: regionInfoId
  };
}

function salesLineWorksFailure_(code, retryable) {
  return { ok: false, retryable: retryable, code: code };
}
