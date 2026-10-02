import {parseInventory,inventoryRows} from './legacy-import.mjs?v=20261002-wf16';
import {rawHash,mediaCommand} from './media.mjs?v=20261002-wf16';
import {fileBytes,MAX_MEDIA_BYTES} from './binary.mjs?v=20261002-wf16';
export const legacyTypes=['legacy_batch','legacy_inventory'];
export function validateLegacy(s,ok,fk){
 const t=s.tables,by=(type,id)=>t[type]?.find(x=>x.id===id),same=(a,b)=>ok(by('entity',a)?.archive_id===by('entity',b)?.archive_id,'Інвентар поза архівом');
 for(const b of t.legacy_batch||[]){fk('source_system',b.source_system_id);fk('file_object',b.original_file_id);fk('workflow_run',b.workflow_run_id);same(b.id,b.source_system_id);ok(by('entity_revision',b.source_document_revision_id)?.snapshot.kind==='source_document','Документ партії');ok(t.source_record.filter(r=>r.import_run_id===b.workflow_run_id).length===b.row_count,'Склад партії');}
 const keys=(t.legacy_batch||[]).map(b=>b.source_system_id+':'+b.source_checksum);ok(new Set(keys).size===keys.length,'Повтор партії');
 const rows=t.legacy_inventory||[];ok(new Set(rows.map(i=>i.source_record_id)).size===rows.length,'Повторний інвентар запису');
 for(const i of rows){fk('source_record',i.source_record_id);same(i.id,i.source_record_id);for(const key of ['physical_object_id','file_id','media_asset_id'])if(i[key]){fk('entity',i[key]);same(i.id,i[key]);}for(const p of ['digitization_priority','description_priority'])ok(['none','normal','urgent'].includes(i[p]),'Пріоритет');for(const id of Object.values(i.tasks||{}))if(id)fk('work_item',id);}
}
export async function legacyCommand(s,actor,c,ctx){
 const {need,fail,hash,snapshot,revise,audit}=ctx,t=s.tables,by=(type,id)=>t[type]?.find(x=>x.id===id),reg=id=>by('entity',id),rev=id=>reg(id)?.current_revision_id;
 const required=v=>{if(typeof v!=='string'||!v.trim())fail('invalid','Заповніть обов’язкові поля.');return v.trim();};
 const get=(type,id,p='legacy.write')=>{const r=by(type,id);if(!r)fail('forbidden','Запис недоступний.');need(p,reg(id)?.archive_id);return r;};
 const fresh=r=>{if(c.expected_revision_id!==rev(r.id))fail('stale','Запис змінено. Оновіть сторінку.');};
 const add=async(type,row,a)=>{row={id:crypto.randomUUID(),...row};const rid=crypto.randomUUID();(t[type]??=[]).push(row);t.entity.push({id:row.id,entity_type:type,owner_installation_id:s.demo.ids.installation,archive_id:a,owner_account_id:actor,current_revision_id:rid,retired_at:null});const snap=snapshot(t,type,row);t.entity_revision.push({id:rid,entity_id:row.id,revision_no:1,previous_revision_id:null,snapshot:snap,snapshot_hash:await hash(snap),recorded_at:s.clock,actor_account_id:actor,process_run_id:null,change_reason:'Зареєстровано спадкове джерело'});return row;};
 const run=id=>{const r={id:crypto.randomUUID(),workflow_code:'WF-06',primary_entity_id:id,started_by:actor,started_at:s.clock,finished_at:s.clock,state:'completed',notes:null};t.workflow_run.push(r);return r;};
 const file=async(name,mime,content,a,w,path=null,container=false)=>{required(name);const bytes=fileBytes(content);if(!bytes.length||bytes.length>MAX_MEDIA_BYTES)fail('invalid','Файл має бути непорожнім і не перевищувати 2 МБ.');const f=await add('file_object',{original_filename:name,mime_type:mime||'application/octet-stream',sha256:await rawHash(content),byte_size:bytes.length,pronom_id:null,received_at:s.clock,technical_metadata:{legacy_original:true,intake_package:container}},a);s.demo.file_contents[f.id]=structuredClone(content);t.file_ingest_occurrence.push({file_id:f.id,workflow_run_id:w.id,received_filename:name,source_path:path,received_at:s.clock,capture_event_id:null});return f;};
 const inventory=async(record,title,path=null)=>add('legacy_inventory',{source_record_id:record.id,title,source_path:path,physical_object_id:null,file_id:null,media_asset_id:null,registration_note:null,digitization_priority:'none',description_priority:'none',priority_note:null,unresolved_note:null,resolution_note:null,tasks:{}},reg(record.id).archive_id);
 const sourceDoc=async(source,title,body,w,f=null)=>{const d=await add('document',{kind:'source_document',title,body_text:body,language_tag:null,media_asset_id:null,physical_object_id:null},source.archive_id);t.document_context.push({document_id:d.id,target_entity_id:source.id,target_revision_id:rev(source.id),context_role:'legacy_source'});if(f)t.document_context.push({document_id:d.id,target_entity_id:f.id,target_revision_id:rev(f.id),context_role:'original_file'});await revise(d,'Зафіксовано походження документа');return d;};
 if(c.type==='legacy.source'){
  need('legacy.write',c.archive_id);if(!['catalogue','cards','spreadsheet','document','database','file_register','other'].includes(c.system_kind))fail('invalid','Оберіть вид джерела.');return add('source_system',{archive_id:c.archive_id,name:required(c.name),system_kind:c.system_kind,source_uri:c.source_uri?.trim()||null,description:required(c.description)},c.archive_id);
 }
 if(['legacy.import','legacy.record','legacy.document'].includes(c.type)){
  const source=get('source_system',c.id),a=source.archive_id;
  if(c.type==='legacy.import'){
   const parsed=parseInventory(c.raw_text,c.delimiter||'auto'),rows=inventoryRows(parsed,c.mapping),checksum=await rawHash(c.raw_text),mappingHash=await hash(c.mapping),old=t.legacy_batch?.find(b=>b.source_system_id===source.id&&b.source_checksum===checksum);
   if(old){if(old.mapping_hash!==mappingHash)fail('conflict','Цю таблицю вже імпортовано з іншим зіставленням стовпців. Оригінал збережено; уточнюйте описи окремо.');return {id:old.id,duplicate:true};}
   const w=run(source.id),f=await file(required(c.filename),'text/csv;charset=utf-8',c.raw_text,a,w,null,true),d=await sourceDoc(source,c.title?.trim()||c.filename,c.raw_text,w,f),b=await add('legacy_batch',{source_system_id:source.id,title:c.title?.trim()||c.filename,original_file_id:f.id,source_document_revision_id:rev(d.id),source_checksum:checksum,mapping:structuredClone(c.mapping),mapping_hash:mappingHash,delimiter:parsed.delimiter,workflow_run_id:w.id,row_count:rows.length,imported_at:s.clock},a);
   const ids=new Map(rows.map(r=>[r.row_key,crypto.randomUUID()]));
   for(const r of rows){const record=await add('source_record',{id:ids.get(r.row_key),source_system_id:source.id,source_document_revision_id:rev(d.id),external_key:r.external_key,parent_record_id:r.parent_key?ids.get(r.parent_key):null,source_position:r.position,source_locator:r.source_locator,raw_payload:{columns:parsed.headers,cells:r.cells,row_key:r.row_key},raw_text:r.raw,source_hash:await rawHash(r.raw),import_run_id:w.id},a);await inventory(record,r.title,r.source_path);}
   audit('legacy.import',b.id,null,rev(b.id),'Імпортовано '+rows.length+' рядків без нормалізації');return {id:b.id,duplicate:false};
  }
  if(c.type==='legacy.document'){
   const w=run(source.id),f=c.content?await file(c.filename,c.mime_type,c.content,a,w,null,true):null;if(!f&&!c.body_text?.trim())fail('invalid','Додайте оригінал або текст документа.');const d=await sourceDoc(source,required(c.title),c.body_text||null,w,f);return d;
  }
  required(c.raw_text);const parent=c.parent_record_id?get('source_record',c.parent_record_id):null;if(parent&&parent.source_system_id!==source.id)fail('invalid','Батьківський запис має належати цьому джерелу.');
  const doc=c.document_id?get('document',c.document_id):null;if(doc&&(doc.kind!=='source_document'||!t.document_context.some(x=>x.document_id===doc.id&&x.target_entity_id===source.id)))fail('invalid','Оберіть документ цього джерела.');
  const position=Number(c.source_position);if(!Number.isInteger(position)||position<1)fail('invalid','Укажіть порядок у джерелі.');
  const source_hash=await rawHash(c.raw_text),key=c.external_key||null,old=t.source_record.find(r=>r.source_system_id===source.id&&r.external_key===key&&r.source_hash===source_hash&&r.parent_record_id===(parent?.id||null)&&r.source_position===position&&r.source_document_revision_id===(doc?rev(doc.id):null)&&r.source_locator===(c.source_locator||null));if(old)return {id:old.id,duplicate:true};
  const w=run(source.id),r=await add('source_record',{source_system_id:source.id,source_document_revision_id:doc?rev(doc.id):null,external_key:key,parent_record_id:parent?.id||null,source_position:position,source_locator:c.source_locator||null,raw_payload:null,raw_text:c.raw_text,source_hash,import_run_id:w.id},a);await inventory(r,c.raw_text.slice(0,160),c.source_path||null);return r;
 }
 const r=get('source_record',c.id),a=reg(r.id).archive_id;let inv=t.legacy_inventory?.find(i=>i.source_record_id===r.id);
 if(c.expected_revision_id!==(inv?rev(inv.id):rev(r.id)))fail('stale','Інвентар змінено. Оновіть сторінку.');if(!inv)inv=await inventory(r,r.raw_text?.slice(0,160)||r.external_key);
 if(c.type==='legacy.physical'){
  if(inv.physical_object_id)fail('conflict','Носій уже зареєстровано.');required(c.registration_note);
  const p=await mediaCommand(s,actor,{type:'media.physical.create',archive_id:a,title:required(c.title),carrier_type_term_id:c.carrier_type_term_id,reference_code:c.reference_code||null,inscriptions:c.inscriptions||null,composition:c.composition||null},ctx);
  if(c.location_id)await mediaCommand(s,actor,{type:'media.move',id:p.id,expected_custody_id:null,to_location_id:c.location_id,reason:c.registration_note},ctx);
  await mediaCommand(s,actor,{type:'media.condition',id:p.id,expected_revision_id:rev(p.id),condition_code:c.condition_code||'unknown',risk_notes:c.risk_notes||null,handling_instructions:c.handling_instructions||null,evidence_note:c.registration_note},ctx);
  t.source_record_link.push({source_record_id:r.id,entity_id:p.id,review_decision_id:null,link_role:'registered_carrier'});inv.physical_object_id=p.id;inv.registration_note=c.registration_note;await revise(inv,'Явно зареєстровано носій за джерелом');return inv;
 }
 if(c.type==='legacy.file'){
  need('media.write',a);if(inv.file_id)fail('conflict','Файл уже зареєстровано.');required(c.registration_note);const w=run(r.id),f=await file(c.filename,c.mime_type,c.content,a,w,c.source_path||inv.source_path),asset=await add('media_asset',{title:c.filename,media_kind:c.mime_type?.startsWith('image/')?'image':c.mime_type?.startsWith('audio/')?'audio':c.mime_type?.startsWith('video/')?'video':'document',description:c.registration_note},a);
  t.media_asset_subject.push({asset_id:asset.id,subject_entity_id:r.id,relation_role:'legacy_source'});await revise(asset,'Пов’язано з джерелом');
  const rep=await add('representation',{asset_id:asset.id,role:'received_original',representation_version:1,technical_metadata:{legacy:true},created_at:s.clock},a);t.representation_file.push({representation_id:rep.id,file_id:f.id,position:1,component_label:c.filename});await revise(rep,'Збережено отриманий файл');
  t.source_record_link.push({source_record_id:r.id,entity_id:asset.id,review_decision_id:null,link_role:'registered_file'});inv.file_id=f.id;inv.media_asset_id=asset.id;inv.source_path=c.source_path||inv.source_path;inv.registration_note=c.registration_note;await revise(inv,'Зареєстровано цифровий оригінал');return inv;
 }
 if(c.type==='legacy.triage'){
  for(const key of ['digitization_priority','description_priority'])if(!['none','normal','urgent'].includes(c[key]))fail('invalid','Оберіть пріоритет.');
  if([c.digitization_priority,c.description_priority].some(x=>x!=='none'))required(c.priority_note);
  if(inv.unresolved_note&&!c.unresolved_note?.trim())required(c.resolution_note);
  inv.digitization_priority=c.digitization_priority;inv.description_priority=c.description_priority;inv.priority_note=c.priority_note?.trim()||null;inv.unresolved_note=c.unresolved_note?.trim()||null;inv.resolution_note=c.resolution_note?.trim()||null;
  for(const [key,active,title] of [['digitization',c.digitization_priority!=='none',(c.digitization_priority==='urgent'?'Терміново: ':'')+'Підготувати оцифрування'],['description',c.description_priority!=='none',(c.description_priority==='urgent'?'Терміново: ':'')+'Описати спадковий матеріал'],['reconciliation',!!inv.unresolved_note,'Уточнити спадковий запис']]){
   let task=by('work_item',inv.tasks[key]);if(active){const titleFull=title+' — '+(r.external_key||inv.title).slice(0,100);
    if(!task||['done','cancelled'].includes(task.state)){task=await add('work_item',{workflow_run_id:r.import_run_id,kind:key==='digitization'?'digitization':key==='description'?'archival_review':'reconciliation',title:titleFull,state:'open',assigned_account_id:actor,assigned_role_id:null,due_at:null,resolution:null},a);t.work_item_target.push({work_item_id:task.id,entity_id:key==='digitization'&&inv.physical_object_id?inv.physical_object_id:r.id,revision_id:rev(key==='digitization'&&inv.physical_object_id?inv.physical_object_id:r.id)});t.work_item_event.push({work_item_id:task.id,from_state:null,to_state:'open',actor_account_id:actor,occurred_at:s.clock,reason:inv.unresolved_note||inv.priority_note});inv.tasks[key]=task.id;
    }else if(task.title!==titleFull){task.title=titleFull;await revise(task,'Змінено пріоритет опрацювання');}
   }else if(task&&!['done','cancelled'].includes(task.state)){const before=task.state;task.state=key==='reconciliation'?'done':'cancelled';task.resolution=key==='reconciliation'?inv.resolution_note:'Пріоритет знято під час перегляду інвентарю';await revise(task,task.resolution);t.work_item_event.push({work_item_id:task.id,from_state:before,to_state:task.state,actor_account_id:actor,occurred_at:s.clock,reason:task.resolution});}
  }
  await revise(inv,'Переглянуто пріоритети й невирішені питання');return inv;
 }
 fail('invalid','Невідома дія інвентаризації.');
}
