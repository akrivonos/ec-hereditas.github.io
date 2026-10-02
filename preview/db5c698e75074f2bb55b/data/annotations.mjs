import {consentMedia} from './consent-media.mjs?v=20261002-programmes';
export const layerKinds=[['index','Зміст'],['transcript','Транскрипція'],['translation','Переклад'],['speakers','Респонденти / виконавці'],['genre','Жанри'],['note','Примітки'],['captions','Субтитри']];
export const layerEntries=(t,l)=>t.timed_layer_entry.filter(x=>x.layer_revision_id===t.entity.find(e=>e.id===l.id)?.current_revision_id).sort((a,b)=>a.position-b.position);
export function validateImport(tiers,duration){
 const fail=m=>{throw Error(m);};if(!Array.isArray(tiers)||!tiers.length||tiers.length>100)fail('Оберіть від 1 до 100 шарів.');
 const names=new Set(),ids=new Map();let total=0;
 for(const l of tiers){if(!l.name?.trim()||names.has(l.name))fail('Назви шарів мають бути унікальними.');names.add(l.name);if(!layerKinds.some(([k])=>k===l.kind))fail('Невідомий тип шару.');if(!Array.isArray(l.entries))fail('Некоректні анотації.');
  for(const e of l.entries){if(++total>5000)fail('За один раз можна імпортувати до 5000 анотацій.');if(!e.key||ids.has(e.key))fail('Повторений або відсутній ідентифікатор анотації.');ids.set(e.key,{e,l});if(typeof e.text_value!=='string'||!e.text_value.trim())fail('Є анотація без тексту.');if(!Number.isInteger(e.start_ms)||!Number.isInteger(e.end_ms)||e.start_ms<0||e.end_ms<=e.start_ms||e.end_ms>duration)fail('Анотація виходить за межі медіафайла.');}
 }
 for(const l of tiers){if(l.parent_name&&!['Symbolic_Association','Symbolic_Subdivision'].includes(l.constraint)||!l.parent_name&&l.constraint)fail('Непідтримувана залежність шару.');const path=new Set([l.name]);let parent=l.parent_name;while(parent){if(path.has(parent))fail('Цикл залежностей шарів.');path.add(parent);const p=tiers.find(x=>x.name===parent);if(!p)fail('Відсутній батьківський шар.');parent=p.parent_name;}
  for(const e of l.entries){if(l.parent_name&&!e.ref)fail('Залежна анотація має посилатися на батьківську.');if(e.ref){const p=ids.get(e.ref);if(!p||p.l.name!==l.parent_name||p.e.start_ms!==e.start_ms||p.e.end_ms!==e.end_ms)fail('Некоректний зв’язок із батьківською анотацією.');const seen=new Set([e.key]);let ref=e.ref;while(ref){if(seen.has(ref))fail('Цикл анотацій.');seen.add(ref);ref=ids.get(ref)?.e.ref;}}if(e.previous){const prev=ids.get(e.previous);if(!prev||prev.l!==l||prev.e.ref!==e.ref)fail('Некоректний порядок залежних анотацій.');const seen=new Set([e.key]);let prevId=e.previous;while(prevId){if(seen.has(prevId))fail('Цикл порядку анотацій.');seen.add(prevId);prevId=ids.get(prevId)?.e.previous;}}}
  if(!l.parent_name){const ordered=l.entries.slice().sort((a,b)=>a.start_ms-b.start_ms);if(ordered.some((e,i)=>i&&e.start_ms<ordered[i-1].end_ms))fail('Часові анотації одного шару ELAN не можуть перетинатися.');}
  else{const groups=Map.groupBy(l.entries,e=>e.ref);for(const group of groups.values()){
   if(l.constraint==='Symbolic_Association'&&(group.length>1||group.some(e=>e.previous)))fail('Symbolic Association допускає одну анотацію на батьківський фрагмент.');
   if(l.constraint==='Symbolic_Subdivision'&&(group.filter(e=>!e.previous).length!==1||new Set(group.filter(e=>e.previous).map(e=>e.previous)).size!==group.length-1))fail('Symbolic Subdivision потребує одного послідовного ланцюжка анотацій.');
  }}
 }return total;
}
export async function annotationCommand(s,c,r,h){
 const {fresh,required,newEntity,revise,fail,reg,arch,need,hash}=h,t=s.tables,revision=id=>reg(id)?.current_revision_id,by=(k,id)=>t[k]?.find(x=>x.id===id);
 t.timed_layer??=[];t.timed_layer_entry??=[];
 const rep=t.representation.find(x=>x.id===c.representation_id&&t.media_asset_subject.some(a=>a.asset_id===x.asset_id&&a.subject_entity_id===r.id));if(!rep)fail('invalid','Оберіть запис цього сеансу.');fresh(rep.id,c.representation_revision_id);if(consentMedia(s,rep.id))need('consent.read',arch(r.id));
 if(!rep.duration_ms||by('media_asset',rep.asset_id)?.media_kind==='photo')fail('invalid','Потрібен аудіо- або відеофайл із визначеною тривалістю.');
 const layers=()=>t.timed_layer.filter(l=>l.representation_revision_id===revision(rep.id));
 const commit=async(layer,entries)=>{if(layer)await revise(layer,'Оновлено анотації');entries.sort((a,b)=>by('entity_revision',a.segment_revision_id).snapshot.start_ms-by('entity_revision',b.segment_revision_id).snapshot.start_ms).forEach((x,i)=>t.timed_layer_entry.push({...x,layer_revision_id:revision(layer.id),position:i+1}));const v=by('entity_revision',revision(layer.id));v.snapshot._relations={timed_layer_entry:structuredClone(layerEntries(t,layer))};v.snapshot_hash=await hash(v.snapshot);};
 if(c.type==='field.session.annotation.import'){
  if(!c.confirm_media)fail('invalid','Підтвердьте відповідність ELAN-файла цьому медіазапису.');try{validateImport(c.tiers,rep.duration_ms);}catch(e){fail('invalid',e.message);}const group=crypto.randomUUID();
  for(const item of c.tiers){const name=item.name;const l=await newEntity('timed_layer',{representation_id:rep.id,representation_revision_id:revision(rep.id),kind:item.kind,name,language_tag:item.language_tag||'und',text_revision_id:null,elan:{group,tier_id:name,parent_name:item.parent_name||null,constraint:item.constraint||null,participant:item.participant||'',source_file:String(c.filename||'').slice(0,200)}},arch(r.id)),entries=[];
   for(const e of item.entries){const seg=await newEntity('media_segment',{representation_id:rep.id,representation_revision_id:revision(rep.id),start_ms:e.start_ms,end_ms:e.end_ms,channel:null},arch(r.id));entries.push({segment_revision_id:revision(seg.id),text_part_id:null,text_value:e.text_value,title:e.title||null,note:e.note||null,position:entries.length+1,annotation_key:group+':'+e.key,reference_key:e.ref?group+':'+e.ref:null,previous_key:e.previous?group+':'+e.previous:null,speaker_label:e.speaker_label||item.participant||null,person_ids:[]});}await commit(l,entries);
  }await revise(r,'Імпортовано шари ELAN');return {count:c.tiers.length};
 }
 if(c.type==='field.session.layer'){
  if(!layerKinds.some(([k])=>k===c.kind))fail('invalid','Оберіть тип шару.');const name=required(c.name);if(layers().some(l=>(l.name||layerKinds.find(([k])=>k===l.kind)?.[1])===name))fail('invalid','Шар із такою назвою вже є.');const layer=await newEntity('timed_layer',{representation_id:rep.id,representation_revision_id:revision(rep.id),kind:c.kind,name,language_tag:c.language_tag?.trim()||'uk',text_revision_id:null},arch(r.id));await revise(r,'Додано шар розмітки');return layer;
 }
 let layer=c.layer_id?layers().find(l=>l.id===c.layer_id):layers().find(l=>l.kind==='index'&&!l.elan);if(c.layer_id&&!layer)fail('invalid','Шар іншого запису.');if(layer)fresh(layer.id,c.layer_revision_id);else if(c.layer_revision_id)fail('stale','Шар змінено.');
 let entries=layer?structuredClone(layerEntries(t,layer)):[],old=c.position?entries.find(x=>x.position===Number(c.position)):null;if(c.position&&!old)fail('stale','Анотацію змінено.');
 const children=old?.annotation_key&&layers().some(l=>layerEntries(t,l).some(e=>e.reference_key===old.annotation_key||e.previous_key===old.annotation_key));
 if(c.remove){if(children)fail('invalid','Спочатку вилучіть залежні анотації.');entries=entries.filter(x=>x!==old);}
 else{
  const start=Number(c.start_ms),end=Number(c.end_ms),text=required(c.text_value);if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>rep.duration_ms)fail('invalid','Кінець має бути після початку й у межах запису.');
  if(layer?.elan?.parent_name&&!old)fail('invalid','Додавання залежних анотацій виконуйте в ELAN; тут можна редагувати їхній текст.');
  if(old&&(old.reference_key||children)){const before=by('entity_revision',old.segment_revision_id).snapshot;if(start!==before.start_ms||end!==before.end_ms)fail('invalid','Межі пов’язаних анотацій змінюйте в ELAN разом із залежними шарами.');}
  const people=c.person_ids===undefined?old?.person_ids||[]:c.person_ids;if(!Array.isArray(people)||people.some(id=>!t.participation.some(p=>p.session_id===r.id&&p.person_id===id&&p.role_code==='performer')))fail('invalid','Оберіть респондентів цього сеансу.');
  const seg=await newEntity('media_segment',{representation_id:rep.id,representation_revision_id:revision(rep.id),start_ms:start,end_ms:end,channel:null},arch(r.id));const entry={...old,segment_revision_id:revision(seg.id),text_part_id:null,text_value:text,title:c.title?.trim()||null,note:c.note?.trim()||null,person_ids:[...new Set(people)],annotation_key:old?.annotation_key||crypto.randomUUID(),position:old?.position||entries.length+1};if(old)Object.assign(old,entry);else entries.push(entry);
 }
 if(!layer)layer=await newEntity('timed_layer',{representation_id:rep.id,representation_revision_id:revision(rep.id),kind:'index',name:'Зміст',language_tag:'uk',text_revision_id:null},arch(r.id));await commit(layer,entries);await revise(r,'Оновлено розмітку сеансу');return layer;
}
