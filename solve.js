// Single-pass CSV reader, independent implementation for make.fun CSV speed task.
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const rows = [];
  const errors = [];
  let columns = null;
  let width = -1;
  let pos = text.charCodeAt(0) === 65279 ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;

  function error(code) { errors.push({code, line: recordLine, row: recordRow}); }
  function addRecord(fields) {
    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; return; }
    if (fields.length < width) {
      errors.push({code: 'short_row', line: recordLine, row: recordRow, fields: fields.length});
      while(fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width)});
    }
    rows.push(fields);
  }

  // Common case: neither quotes nor CR characters need to be interpreted.
  if (text.indexOf('"',pos) === -1 && text.indexOf('\r',pos) === -1) {
    const parts = text.slice(pos).split('\n');
    for (let i=0; i<parts.length; i++) {
      const s=parts[i];
      if(s.length !== 0) {
        recordLine=i+1;
        recordRow=header && columns === null ? null : rows.length;
        addRecord(s.split(','));
      }
    }
    return {columns: header ? (columns ?? []) : null, rows, errors};
  }

  // Return field and delimiter: 0 comma, 1 newline, 2 end of input.
  function readUnquoted(prefix) {
    let start=pos, chunks=null, added=0;
    while(pos<n) {
      const c=text.charCodeAt(pos);
      if(c===44 || c===10 || (c===13 && text.charCodeAt(pos+1)===10)) {
        const tail=text.slice(start,pos);
        added+=tail.length;
        const value=prefix + (chunks ? (chunks.push(tail),chunks.join('')) : tail);
        if(c===44) {pos++;return {value,ended:0,added};}
        pos+=c===13?2:1;line++;
        return {value,ended:1,added};
      }
      if(c===13) {
        if(chunks===null)chunks=[];
        const tail=text.slice(start,pos);
        chunks.push(tail);
        added+=tail.length;
        error('stray_cr');
        pos++;start=pos;
        continue;
      }
      pos++;
    }
    const tail=text.slice(start,pos);
    added+=tail.length;
    return {value:prefix + (chunks ? (chunks.push(tail),chunks.join('')) : tail),ended:2,added};
  }

  function readQuoted() {
    const open=pos, openLine=line;
    let start=++pos;
    const chunks=[];
    while(pos<n) {
      const c=text.charCodeAt(pos);
      if(c===34) {
        chunks.push(text.slice(start,pos));
        if(text.charCodeAt(pos+1)===34) {
          chunks.push('"');pos+=2;start=pos;continue;
        }
        const value=chunks.join('');
        pos++;
        if(pos>=n) return {value,ended:2};
        const next=text.charCodeAt(pos);
        if(next===44) {pos++;return {value,ended:0};}
        if(next===10) {pos++;line++;return {value,ended:1};}
        if(next===13 && text.charCodeAt(pos+1)===10) {pos+=2;line++;return {value,ended:1};}
        const junk=readUnquoted(value);
        if(junk.added>0)error('quote_junk');
        return junk;
      }
      if(c===13 || c===10) {
        chunks.push(text.slice(start,pos),'\n');
        if(c===13 && text.charCodeAt(pos+1)===10)pos+=2;
        else pos++;
        line++;start=pos;continue;
      }
      pos++;
    }
    // Unclosed quotes are treated literally and the remaining text is reread unquoted.
    pos=open+1;line=openLine;
    error('unterminated_quote');
    return readUnquoted('"');
  }

  while(true) {
    // Ignore empty LF/CRLF-only lines (but not lone CRs).
    while(pos<n) {
      const c=text.charCodeAt(pos);
      if(c===10) {pos++;line++;}
      else if(c===13 && text.charCodeAt(pos+1)===10) {pos+=2;line++;}
      else break;
    }
    if(pos>=n)break;
    recordLine=line;
    recordRow=header && columns===null ? null : rows.length;
    const fields=[];
    let field, quoted;
    do {
      quoted=text.charCodeAt(pos)===34;
      field=quoted ? readQuoted() : readUnquoted('');
      fields.push(field.value);
    } while(field.ended===0);
    if(fields.length===1 && fields[0]==='' && !quoted)continue;
    addRecord(fields);
  }
  return {columns: header ? (columns ?? []) : null, rows, errors};
}
