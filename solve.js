// Allocation-lean state-machine CSV reader for the make.fun speed bounty.
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

  function addRecord(fields) {
    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; return; }
    if (fields.length < width) {
      errors.push({code: 'short_row', line: recordLine, row: recordRow, fields: fields.length});
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width)});
    }
    rows.push(fields);
  }

  // The no-escape case is common in user CSV even though official stress files use quotes.
  if (text.indexOf('"', pos) === -1 && text.indexOf('\r', pos) === -1) {
    const parts = text.slice(pos).split('\n');
    for (let i=0; i<parts.length; i++) {
      const s=parts[i];
      if (s.length) {
        recordLine=i+1;
        recordRow=header && columns === null ? null : rows.length;
        addRecord(s.split(','));
      }
    }
    return {columns: header ? (columns ?? []) : null, rows, errors};
  }

  while (true) {
    // Drop blank lines only; a line containing a stray CR is not silently removed.
    while (pos < n) {
      const c=text.charCodeAt(pos);
      if (c===10) { pos++; line++; }
      else if(c===13 && text.charCodeAt(pos+1)===10) { pos+=2; line++; }
      else break;
    }
    if(pos>=n) break;
    recordLine=line;
    recordRow=header && columns === null ? null : rows.length;
    const fields=[];
    let lastQuoted=false;

    while (true) {
      let value='';
      let start=pos;
      let fromClosingQuote=false;
      const quoted=text.charCodeAt(pos)===34;
      lastQuoted=quoted;
      if (quoted) {
        const open=pos, openLine=line;
        let chunks=null, closed=false;
        start=++pos;
        while (pos<n) {
          const c=text.charCodeAt(pos);
          if(c===34) {
            if(text.charCodeAt(pos+1)===34) {
              if(chunks===null) chunks=[];
              chunks.push(text.slice(start,pos),'"');
              pos+=2; start=pos;
              continue;
            }
            const tail=text.slice(start,pos);
            value=chunks ? (chunks.push(tail),chunks.join('')) : tail;
            pos++; closed=true;
            break;
          }
          if(c===13 || c===10) {
            if(chunks===null) chunks=[];
            chunks.push(text.slice(start,pos),'\n');
            pos += c===13 && text.charCodeAt(pos+1)===10 ? 2 : 1;
            line++; start=pos;
            continue;
          }
          pos++;
        }
        if (closed) {
          fromClosingQuote=true;
          start=pos;
        } else {
          pos=open+1;
          line=openLine;
          errors.push({code:'unterminated_quote',line:recordLine,row:recordRow});
          value='"';
          start=pos;
        }
      }
      let chunks=null, added=0;
      let c;
      while(pos<n) {
        c=text.charCodeAt(pos);
        if(c===44 || c===10 || (c===13 && text.charCodeAt(pos+1)===10)) break;
        if(c===13) {
          if(chunks===null)chunks=[];
          const part=text.slice(start,pos);
          chunks.push(part);
          added+=part.length;
          errors.push({code:'stray_cr',line:recordLine,row:recordRow});
          pos++;start=pos;
          continue;
        }
        pos++;
      }
      const tail=text.slice(start,pos);
      added+=tail.length;
      value+=chunks?(chunks.push(tail),chunks.join('')):tail;
      if(fromClosingQuote && added>0) errors.push({code:'quote_junk',line:recordLine,row:recordRow});
      fields.push(value);
      if(pos>=n) break;
      if(c===44){pos++; continue;}
      pos+=c===13?2:1;line++;
      break;
    }
    if(fields.length===1 && fields[0]==='' && !lastQuoted) continue;
    addRecord(fields);
  }
  return {columns:header ? (columns??[]) : null, rows, errors};
}
