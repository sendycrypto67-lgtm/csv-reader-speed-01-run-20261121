// Fast drop-in replacement for csv-reader 1.0.0.
//
// Behaviour follows the bounty specification exactly; the scanner below only
// changes how the text is walked (indexOf/slice jumps instead of a
// one-character-at-a-time loop with string concatenation).
//
// Line/row/error rules implemented here:
// - a record ends at LF or CRLF; an empty line at a record start is skipped
// - a CR outside quotes that is not part of a CRLF is dropped (stray_cr)
// - a quoted field runs to the next undoubled quote; "" is one quote;
//   CR, LF and CRLF inside quotes each become one LF and count one line
// - junk after a closing quote is appended as an unquoted field would be
// - an unterminated quote is a literal quote and the rest is re-read as an
//   unquoted field, with the line counter reset to the opening quote's line
// - a record that is one empty unquoted field is no record (errors stay)
// - short_row / long_row are recorded at record end, after field errors

const QRE = /""|\r\n?|\n/g;

export function run(input) {
  let text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  let i = 0;
  if (n > 0 && text.charCodeAt(0) === 0xFEFF) i = 1;
  let line = 1;
  const rows = [];
  const errors = [];
  let columns = null;
  let width = -1;
  let kept = 0;

  while (true) {
    // Skip empty lines at a record start (LF or CRLF). A lone CR is not
    // skipped: it is met as a stray_cr in the next record's first field.
    while (i < n) {
      const c = text.charCodeAt(i);
      if (c === 10) { i++; line++; }
      else if (c === 13 && text.charCodeAt(i + 1) === 10) { i += 2; line++; }
      else break;
    }
    if (i >= n) break;

    const recStartLine = line;
    const recIsHeader = header && kept === 0;
    const recRow = recIsHeader ? null : rows.length;
    const fields = [];
    let f0quoted = false;
    let firstField = true;

    while (true) {
      let val;
      let quoted;
      let endKind; // 0 comma, 1 LF, 2 CRLF, 3 end of text
      let scanFrom = -1;
      let junkBase = '';
      let isJunk = false;

      if (text.charCodeAt(i) === 34) {
        quoted = true;
        const quoteLine = line;
        let q = i + 1;
        let closePos = -1;
        while (true) {
          const nx = text.indexOf('"', q);
          if (nx === -1) break;
          if (text.charCodeAt(nx + 1) === 34) { q = nx + 2; continue; }
          closePos = nx;
          break;
        }
        if (closePos === -1) {
          // Unterminated quote: the opening quote is literal and the text
          // after it is re-read as an unquoted field. Line breaks inside
          // the unterminated region were not counted by the scan above,
          // so reset the counter to the opening quote's line and count
          // them again as the re-read meets them.
          errors.push({ code: 'unterminated_quote', line: recStartLine, row: recRow });
          line = quoteLine;
          quoted = false;
          scanFrom = i;
        } else {
          const raw = text.slice(i + 1, closePos);
          if (raw.indexOf('"') === -1 && raw.indexOf('\n') === -1 && raw.indexOf('\r') === -1) {
            val = raw;
          } else {
            val = raw.replace(QRE, (m) => {
              if (m === '""') return '"';
              line++;
              return '\n';
            });
          }
          const j = closePos + 1;
          if (j >= n) {
            endKind = 3;
            i = n;
          } else {
            const c = text.charCodeAt(j);
            if (c === 44) { endKind = 0; i = j + 1; }
            else if (c === 10) { endKind = 1; i = j + 1; line++; }
            else if (c === 13 && text.charCodeAt(j + 1) === 10) { endKind = 2; i = j + 2; line++; }
            else { isJunk = true; junkBase = val; scanFrom = j; }
          }
        }
      } else {
        quoted = false;
        scanFrom = i;
      }
      if (scanFrom >= 0) {
        // Unquoted scan from scanFrom: a fresh unquoted field, the junk
        // after a closing quote, or the re-read of an unterminated quote.
        const s = scanFrom;
        const comma = text.indexOf(',', s);
        const lf = text.indexOf('\n', s);
        let end;
        let ek; // 0 comma, 1 LF, 2 end of text
        if (comma !== -1 && (lf === -1 || comma < lf)) { end = comma; ek = 0; }
        else if (lf !== -1) { end = lf; ek = 1; }
        else { end = n; ek = 2; }
        let scanVal = text.slice(s, end);
        let fieldEnd = end;
        let isCRLF = false;
        const cr0 = scanVal.indexOf('\r');
        if (cr0 !== -1) {
          const parts = [];
          let seg = s;
          let p = s + cr0;
          while (true) {
            // A CR is followed by LF exactly when it is the last character
            // of the span and the span ends at that LF: then it is the CR
            // of a CRLF record end, not a stray CR.
            if (ek === 1 && p + 1 === end) { fieldEnd = p; isCRLF = true; break; }
            errors.push({ code: 'stray_cr', line: recStartLine, row: recRow });
            parts.push(text.slice(seg, p));
            seg = p + 1;
            const nx = scanVal.indexOf('\r', seg - s);
            if (nx === -1) break;
            p = s + nx;
          }
          parts.push(text.slice(seg, fieldEnd));
          scanVal = parts.join('');
        }
        if (isCRLF) { endKind = 2; i = end + 1; line++; }
        else if (ek === 0) { endKind = 0; i = end + 1; }
        else if (ek === 1) { endKind = 1; i = end + 1; line++; }
        else { endKind = 3; i = n; }
        val = junkBase + scanVal;
        if (isJunk && scanVal.length > 0) {
          errors.push({ code: 'quote_junk', line: recStartLine, row: recRow });
        }
      }

      fields.push(val);
      if (firstField) { f0quoted = quoted; firstField = false; }
      if (endKind === 0) continue;
      break;
    }

    // A record that is a single empty unquoted field is no record at all.
    // Its stray_cr errors, if any, stay.
    if (fields.length === 1 && fields[0] === '' && !f0quoted) {
      continue;
    }
    kept++;
    if (kept === 1) {
      width = fields.length;
      if (header) {
        columns = fields;
        continue;
      }
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recStartLine, row: recRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      const extra = fields.slice(width);
      errors.push({ code: 'long_row', line: recStartLine, row: recRow, extra });
      fields.length = width;
    }
    rows.push(fields);
  }

  if (header && columns === null) columns = [];
  return { columns, rows, errors };
}
