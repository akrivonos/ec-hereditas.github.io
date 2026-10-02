import {validateImport} from './annotations.mjs?v=20261002-annotations';
const xml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
// XML parsing is browser-native. External entities and media URLs are never resolved.
export function parseEaf(text,duration,Parser=globalThis.DOMParser){
 if(text.length>2*1024*1024)throw Error('ELAN-файл має бути до 2 МіБ.');if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('Файл із зовнішніми XML-сутностями не підтримується.');
 const doc=new Parser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror')||doc.documentElement.tagName!=='ANNOTATION_DOCUMENT')throw Error('Це не коректний файл ELAN .eaf.');
 const root=doc.documentElement,header=root.querySelector('HEADER');if(header?.getAttribute('TIME_UNITS')!=='milliseconds')throw Error('Потрібна часова шкала в мілісекундах.');
 if(root.querySelector('CONTROLLED_VOCABULARY,LEXICON_REF,EXTERNAL_REF,REF_LINK_SET'))throw Error('Цей файл містить словники або зовнішні зв’язки. Експортуйте з ELAN потрібні шари без цих залежностей.');
 if([...root.querySelectorAll('HEADER > MEDIA_DESCRIPTOR')].some(m=>m.hasAttribute('TIME_ORIGIN')&&Number(m.getAttribute('TIME_ORIGIN'))!==0))throw Error('Медіа має зміщення часової шкали. Підготуйте в ELAN розмітку від початку цього файла.');
 const types=new Map([...root.querySelectorAll('LINGUISTIC_TYPE')].map(x=>[x.getAttribute('LINGUISTIC_TYPE_ID'),x])),slots=new Map(),annotations=new Map();
 for(const x of root.querySelectorAll('TIME_ORDER > TIME_SLOT')){const id=x.getAttribute('TIME_SLOT_ID'),value=x.getAttribute('TIME_VALUE');if(slots.has(id)||!/^\d+$/.test(value||''))throw Error('Є повторені або невизначені часові мітки.');slots.set(id,Number(value));}
 let extras={};const property=[...root.querySelectorAll('HEADER > PROPERTY')].find(p=>p.getAttribute('NAME')==='hereditas.annotations');if(property){try{extras=JSON.parse(property.textContent);}catch{throw Error('Пошкоджені додаткові відомості Hereditas.');}}
 const tiers=[...root.querySelectorAll('ANNOTATION_DOCUMENT > TIER')].map(tier=>{
  const name=tier.getAttribute('TIER_ID'),type=types.get(tier.getAttribute('LINGUISTIC_TYPE_REF')),constraint=type?.getAttribute('CONSTRAINTS')||null,parent_name=tier.getAttribute('PARENT_REF')||null;
  if(!type||constraint&&!['Symbolic_Association','Symbolic_Subdivision'].includes(constraint)||parent_name&&!constraint)throw Error('Підтримуються незалежні часові шари та Symbolic Association/Subdivision. Інші залежності підготуйте в ELAN.');
  if(type.hasAttribute('CONTROLLED_VOCABULARY_REF'))throw Error('Шар залежить від словника ELAN. Потрібен експорт без словника.');
  const result={name,parent_name,constraint,participant:tier.getAttribute('PARTICIPANT')||'',language_tag:extras.tiers?.[name]?.language_tag||'und',kind:extras.tiers?.[name]?.kind||(/translat|переклад/i.test(name)?'translation':'transcript'),entries:[]};
  for(const node of tier.querySelectorAll(':scope > ANNOTATION')){const a=node.firstElementChild;if(!a||!['ALIGNABLE_ANNOTATION','REF_ANNOTATION'].includes(a.tagName))throw Error('Невідомий тип анотації.');const key=a.getAttribute('ANNOTATION_ID');if(annotations.has(key))throw Error('Повторений ідентифікатор анотації.');
   const e={key,text_value:a.querySelector('ANNOTATION_VALUE')?.textContent||'',ref:a.getAttribute('ANNOTATION_REF')||null,previous:a.getAttribute('PREVIOUS_ANNOTATION')||null,start_ms:slots.get(a.getAttribute('TIME_SLOT_REF1')),end_ms:slots.get(a.getAttribute('TIME_SLOT_REF2'))};
   if((a.tagName==='REF_ANNOTATION')!==!!parent_name)throw Error('Тип анотації не відповідає залежності шару.');const extra=extras.entries?.[key];if(extra){e.title=String(extra.title||'');e.note=String(extra.note||'');e.speaker_label=String(extra.speaker_label||'');}annotations.set(key,e);result.entries.push(e);
  }return result;
 });
 const resolve=(e,seen=new Set())=>{if(seen.has(e.key))throw Error('Цикл посилань між анотаціями.');seen.add(e.key);if(e.ref){const parent=annotations.get(e.ref);if(!parent)throw Error('Відсутня батьківська анотація.');resolve(parent,seen);e.start_ms=parent.start_ms;e.end_ms=parent.end_ms;}};annotations.forEach(e=>resolve(e));
 validateImport(tiers,duration);return {tiers,media:[...root.querySelectorAll('HEADER > MEDIA_DESCRIPTOR')].map(m=>(m.getAttribute('RELATIVE_MEDIA_URL')||m.getAttribute('MEDIA_URL')||'').split(/[\\/]/).at(-1)),count:annotations.size};
}
export function exportEaf(layers,{mediaName='media.wav',mime='audio/wav'}={}){
 if(!layers.length)throw Error('Спочатку додайте анотації.');const used=new Set(),tierIds=new Map(),keys=new Map(),slots=[],extras={tiers:{},entries:{}};let count=0;
 for(const l of layers){let name=l.name||l.kind||'Шар',n=1;while(used.has(name))name=(l.name||l.kind)+' '+(++n);used.add(name);tierIds.set(l.id,name);for(const e of l.entries){const key=e.annotation_key||e.segment_revision_id;if(keys.has(key))throw Error('Повторений ідентифікатор анотації.');keys.set(key,'a'+(++count));}}
 let tiers='',types='';const constraints=new Set();
 for(const [i,l] of layers.entries()){
  const name=tierIds.get(l.id),type='type'+i,parent=l.elan?.parent_name&&layers.find(p=>p.elan?.group===l.elan.group&&p.elan?.tier_id===l.elan.parent_name),constraint=l.elan?.constraint;
  if(l.elan?.parent_name&&!parent)throw Error('Для експорту потрібен також батьківський шар.');
  if(!parent){const sorted=l.entries.slice().sort((a,b)=>a.start_ms-b.start_ms);if(sorted.some((e,i)=>i&&e.start_ms<sorted[i-1].end_ms))throw Error('У шарі «'+name+'» є перетини. Рознесіть їх на окремі шари перед експортом ELAN.');}
  extras.tiers[name]={kind:l.kind,language_tag:l.language_tag};let content='';
  for(const e of l.entries){const id=keys.get(e.annotation_key||e.segment_revision_id);extras.entries[id]={title:e.title||'',note:e.note||'',speaker_label:e.speaker_label||''};let tag;
   if(e.reference_key){const ref=keys.get(e.reference_key),prev=e.previous_key&&keys.get(e.previous_key);if(!ref||e.previous_key&&!prev)throw Error('Відсутня залежна анотація для експорту.');tag='REF_ANNOTATION';content+='<ANNOTATION><'+tag+' ANNOTATION_ID="'+id+'" ANNOTATION_REF="'+ref+'"'+(prev?' PREVIOUS_ANNOTATION="'+prev+'"':'')+'>';}
   else{tag='ALIGNABLE_ANNOTATION';const a='ts'+(slots.length+1),b='ts'+(slots.length+2);slots.push({id:a,value:e.start_ms},{id:b,value:e.end_ms});content+='<ANNOTATION><'+tag+' ANNOTATION_ID="'+id+'" TIME_SLOT_REF1="'+a+'" TIME_SLOT_REF2="'+b+'">';}
   content+='<ANNOTATION_VALUE>'+xml(e.text_value)+'</ANNOTATION_VALUE></'+tag+'></ANNOTATION>';
  }
  tiers+='<TIER TIER_ID="'+xml(name)+'" LINGUISTIC_TYPE_REF="'+type+'"'+(parent?' PARENT_REF="'+xml(tierIds.get(parent.id))+'"':'')+(l.elan?.participant?' PARTICIPANT="'+xml(l.elan.participant)+'"':'')+'>'+content+'</TIER>';
  types+='<LINGUISTIC_TYPE LINGUISTIC_TYPE_ID="'+type+'" TIME_ALIGNABLE="'+(!parent)+'" GRAPHIC_REFERENCES="false"'+(constraint?' CONSTRAINTS="'+xml(constraint)+'"':'')+'/>';if(constraint)constraints.add(constraint);
 }
 return '<?xml version="1.0" encoding="UTF-8"?>\n<ANNOTATION_DOCUMENT AUTHOR="Hereditas" DATE="'+new Date().toISOString()+'" FORMAT="3.0" VERSION="3.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.mpi.nl/tools/elan/EAFv3.0.xsd"><HEADER MEDIA_FILE="" TIME_UNITS="milliseconds"><MEDIA_DESCRIPTOR MEDIA_URL="'+xml(mediaName)+'" MIME_TYPE="'+xml(mime)+'" RELATIVE_MEDIA_URL="./'+xml(mediaName)+'"/><PROPERTY NAME="hereditas.annotations">'+xml(JSON.stringify(extras))+'</PROPERTY></HEADER><TIME_ORDER>'+slots.sort((a,b)=>a.value-b.value).map(x=>'<TIME_SLOT TIME_SLOT_ID="'+x.id+'" TIME_VALUE="'+x.value+'"/>').join('')+'</TIME_ORDER>'+tiers+types+[...constraints].map(c=>'<CONSTRAINT STEREOTYPE="'+c+'" DESCRIPTION="'+(c==='Symbolic_Association'?'One-to-one association with a parent annotation':'Ordered subdivision of a parent annotation')+'"/>').join('')+'</ANNOTATION_DOCUMENT>';
}
