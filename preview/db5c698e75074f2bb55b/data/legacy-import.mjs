// Keep original cells and row slices. Interpretation is a separate, explicit mapping.
export function parseInventory(text,delimiter='auto'){
 if(typeof text!=='string'||!text.length||new TextEncoder().encode(text).length>2*1024*1024)throw Error('Оберіть непорожню таблицю до 2 МБ.');
 const input=text.charCodeAt(0)===0xfeff?text.slice(1):text;
 if(delimiter==='auto'){
  const first=input.split(/\r?\n/)[0];let quoted=false,counts={',':0,';':0,'\t':0};
  for(let i=0;i<first.length;i++){if(first[i]==='"'){if(quoted&&first[i+1]==='"')i++;else quoted=!quoted;}else if(!quoted&&first[i] in counts)counts[first[i]]++;}
  delimiter=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0];
 }
 if(![',',';','\t'].includes(delimiter))throw Error('Непідтримуваний роздільник.');
 const records=[];let cells=[],cell='',start=0,quoted=false,closed=false;
 const push=end=>{cells.push(cell);const raw=input.slice(start,end);if(raw.length)records.push({cells,raw});cells=[];cell='';closed=false;};
 for(let i=0;i<input.length;i++){
  const ch=input[i];
  if(quoted){if(ch==='"'){if(input[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
  if(ch==='"'){if(cell||closed)throw Error('Лапки всередині незакритого поля таблиці.');quoted=true;}
  else if(ch===delimiter){cells.push(cell);cell='';closed=false;}
  else if(ch==='\n'||ch==='\r'){push(i);if(ch==='\r'&&input[i+1]==='\n')i++;start=i+1;}
  else {if(closed)throw Error('Після закритих лапок очікується роздільник.');cell+=ch;}
 }
 if(quoted)throw Error('У таблиці не закрито лапки.');if(start<input.length)push(input.length);
 const headers=records.shift()?.cells;if(!headers?.length||headers.some(x=>!x.trim())||new Set(headers).size!==headers.length)throw Error('Заголовки стовпців мають бути непорожніми й різними.');
 if(!records.length||records.length>500)throw Error('Оберіть таблицю від 1 до 500 рядків.');
 for(const [i,r] of records.entries())if(r.cells.length!==headers.length)throw Error('Рядок '+(i+2)+': кількість полів не збігається із заголовком.');
 return {headers,rows:records,delimiter};
}
export function inventoryRows(parsed,mapping){
 if(!mapping||!parsed.headers.includes(mapping.text))throw Error('Оберіть стовпець оригінального опису.');
 for(const value of Object.values(mapping))if(value&&!parsed.headers.includes(value))throw Error('Стовпець відсутній у таблиці.');
 const at=(r,key)=>mapping[key]?r.cells[parsed.headers.indexOf(mapping[key])]:'';
 const rows=parsed.rows.map((r,i)=>({position:i+1,row_key:at(r,'key')||String(i+1),external_key:at(r,'code')||null,parent_key:at(r,'parent')||null,source_locator:at(r,'locator')||null,title:at(r,'text'),source_path:at(r,'path')||null,raw:r.raw,cells:r.cells}));
 if(rows.some(r=>!r.title.trim())||new Set(rows.map(r=>r.row_key)).size!==rows.length)throw Error('Описи мають бути заповнені, а ключі рядків — різними. Історичні шифри можуть повторюватися.');
 const by=new Map(rows.map(r=>[r.row_key,r]));
 for(const row of rows){const seen=new Set([row.row_key]);let p=row.parent_key;while(p){if(seen.has(p))throw Error('У вкладеності джерела є цикл.');seen.add(p);if(!by.has(p))throw Error('Не знайдено батьківський рядок: '+p);p=by.get(p).parent_key;}}
 return rows;
}
export const exampleInventory='Ключ;Батько;Шифр;Опис;Місце;Шлях\r\nbox;;Ф-7;Коробка з матеріалами;Опис 1;\r\ntape;box;К-001;Касета з нерозбірливим написом;Картка 2;\r\nphoto;box;Ф-001;Фото без встановленої дати;Картка 3;photos/001.jpg\r\n';
