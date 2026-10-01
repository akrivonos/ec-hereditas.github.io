import {fileBytes} from './binary.mjs?v=20261001-wf13';

const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a<b?-1:a>b?1:0)):x);
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
const jsonHash=v=>digest(new TextEncoder().encode(canonical(v)));
export const transferFiles=(s,h)=>s.tables.handover_item.filter(i=>i.handover_id===h.id).flatMap(i=>s.tables.file_object.filter(f=>f.id===i.entity_id));
export function transferContext(s,items){
 const t=s.tables,by=(type,id)=>t[type]?.find(x=>x.id===id),sessions=items.filter(i=>by('entity',i.entity_id)?.entity_type==='collecting_session'),participants=[];
 for(const i of sessions)for(const member of t.entity_revision_member.filter(m=>m.aggregate_revision_id===i.revision_id&&m.relation_role==='participation')){
  const p=by('entity_revision',member.member_revision_id)?.snapshot;if(p)participants.push({session_id:i.entity_id,person_id:p.person_id,role_code:p.role_code,display_name:by('person',p.person_id)?.preferred_name||'Учасник'});
 }
 return {participants,researches:[...new Set(sessions.map(i=>by('entity_revision',i.revision_id)?.snapshot.research_id).filter(Boolean))].map(id=>({id,title:by('field_research',id)?.title||'Не зазначено',revision_id:by('entity',id)?.current_revision_id||null}))};
}
export function transferProblems(s,h){
 const p=h.preflight;if(!p)return [];
 const issues=[],files=transferFiles(s,h),items=s.tables.handover_item.filter(i=>i.handover_id===h.id);
 if(!p.confirmed)issues.push('Підтвердьте звірку файлів і польових нотаток.');
 if(items.some(i=>s.tables.entity.find(e=>e.id===i.entity_id)?.current_revision_id!==i.revision_id))issues.push('Матеріали змінено: оновіть склад пакета та повторіть звірку.');
 const sessions=new Set(items.filter(i=>s.tables.entity.find(e=>e.id===i.entity_id)?.entity_type==='collecting_session').map(i=>i.entity_id));
 const captures=new Set(s.tables.capture_event.filter(c=>sessions.has(c.session_id)).map(c=>c.id));
 if(s.tables.capture_output.some(o=>captures.has(o.capture_event_id)&&!files.some(f=>f.id===o.file_id)))issues.push('У сеансі є файли поза пакетом. Підготуйте новий пакет із повним складом.');
 if(p.expected_files!==files.length)issues.push('Кількість файлів не відповідає очікуваній.');
 if(p.issues.some(i=>!i.resolution))issues.push('Є невирішені проблеми.');
 if(files.length&&new Set(p.backups.filter(b=>b.digest===p.export_digest).map(b=>b.failure_domain.trim().toLocaleLowerCase())).size<p.required_copies)issues.push('Перевірте потрібну кількість копій у незалежних місцях.');
 return issues;
}
export async function transferBundle(s,h){
 const t=s.tables,items=t.handover_item.filter(i=>i.handover_id===h.id).sort((a,b)=>a.position-b.position);
 const payload={handover_id:h.id,manifest_checksum:h.manifest_checksum,notes:h.notes,items:items.map(i=>({entity_id:i.entity_id,revision_id:i.revision_id,position:i.position,item_checksum:i.item_checksum,type:t.entity.find(e=>e.id===i.entity_id).entity_type,revision:structuredClone(t.entity_revision.find(r=>r.id===i.revision_id))})),files:transferFiles(s,h).map(f=>({id:f.id,filename:f.original_filename,mime_type:f.mime_type,sha256:f.sha256,byte_size:f.byte_size,content:structuredClone(s.demo.file_contents[f.id]),origins:structuredClone(t.file_ingest_occurrence.filter(x=>x.file_id===f.id)),captures:structuredClone(t.capture_event.filter(x=>t.capture_output.some(o=>o.file_id===f.id&&o.capture_event_id===x.id)))})),issues:structuredClone(h.preflight?.issues||[])};
 if(h.package_context)payload.context=structuredClone(h.package_context);
 const bundle={format:'hereditas-field-transfer',version:1,payload,digest:await jsonHash(payload)};
 if(new TextEncoder().encode(JSON.stringify(bundle)).length>32*1024*1024)throw Error('Пакет перевищує 32 МБ. Підготуйте менший комплект.');
 await verifyTransferBundle(bundle);return bundle;
}
// Validates bytes and pinned snapshots without importing a remote graph into the archive.
export async function verifyTransferBundle(bundle){
 const bad=()=>{throw Error('Пакет пошкоджений або має непідтримуваний формат.');};
 if(bundle?.format!=='hereditas-field-transfer'||bundle.version!==1||!bundle.payload||bundle.digest!==await jsonHash(bundle.payload))bad();
 const p=bundle.payload;if(!Array.isArray(p.items)||!p.items.length||!Array.isArray(p.files)||!Array.isArray(p.issues)||p.items.length>2000||p.files.length>500)bad();
 if(p.context&&(!Array.isArray(p.context.participants)||!Array.isArray(p.context.researches)||p.context.participants.some(x=>!x||typeof x.session_id!=='string'||typeof x.person_id!=='string'||typeof x.role_code!=='string')))bad();
 if(p.issues.some(x=>!x||typeof x.note!=='string')||p.items.some(i=>!i||!['collecting_session','information_unit','file_object','physical_object','document','timed_layer','textual_representation','consent_record'].includes(i.type)||i.revision?.snapshot?.id!==i.entity_id))bad();
 for(const f of p.files)if(!f||!Array.isArray(f.origins)||!Array.isArray(f.captures)||f.origins.some(x=>!x||x.source_path!=null&&typeof x.source_path!=='string')||f.captures.some(x=>!x||x.session_id!=null&&typeof x.session_id!=='string'))bad();
 if(new Set(p.items.map(i=>i.entity_id)).size!==p.items.length||new Set(p.files.map(f=>f.id)).size!==p.files.length)bad();
 const manifest=p.items.map(({entity_id,revision_id,position,item_checksum})=>({entity_id,revision_id,position,item_checksum}));
 if(p.manifest_checksum!==await jsonHash(manifest))bad();
 for(const [index,i] of p.items.entries())if(i.position!==index+1||i.revision?.id!==i.revision_id||i.revision.entity_id!==i.entity_id||i.revision.snapshot_hash!==await jsonHash(i.revision.snapshot))bad();
 if(p.items.filter(i=>i.type==='file_object').length!==p.files.length)bad();
 for(const f of p.files){const i=p.items.find(i=>i.entity_id===f.id&&i.type==='file_object'),r=i?.revision.snapshot,bytes=fileBytes(f.content);if(!r||bytes.length!==f.byte_size||await digest(bytes)!==f.sha256||i.item_checksum!==f.sha256||r.sha256!==f.sha256||r.byte_size!==f.byte_size||r.original_filename!==f.filename||r.mime_type!==f.mime_type)bad();}
 return {files:p.files.length,items:p.items.length,digest:bundle.digest};
}

export async function transferCommand(s,actor,c,ctx){
 const {need,fail,hash,audit,task,revise}=ctx,t=s.tables,h=t.handover.find(x=>x.id===c.id),run=h&&t.workflow_run.find(x=>x.id===h.from_workflow_run_id),entity=run&&t.entity.find(x=>x.id===run.primary_entity_id);
 if(!h)fail('forbidden','Пакет недоступний.');need('intake.send',entity.archive_id||entity.id);
 const items=t.handover_item.filter(i=>i.handover_id===h.id);
 for(const i of items){const e=t.entity.find(x=>x.id===i.entity_id);need('domain.read',e.archive_id);if(e.entity_type==='consent_record')need('consent.read',e.archive_id);}
 if(await hash({handover:h,items})!==c.expected_hash)fail('stale','Пакет змінився. Оновіть сторінку.');
 if(!h.preflight)h.preflight={confirmed:false,expected_files:transferFiles(s,h).length,required_copies:2,issues:[],backups:[],export_digest:null};
 const p=h.preflight,editing=['prepared','returned'].includes(h.state);
 if(c.type!=='media.transfer.export'&&!editing)fail('blocked','Звірка відправника вже завершена.');
 if(c.type==='media.transfer.begin'){
  p.confirmed=false;
 }else if(c.type==='media.transfer.confirm'){
  if(!Number.isInteger(c.expected_files)||c.expected_files<0||!Number.isInteger(c.required_copies)||c.required_copies<1||c.required_copies>10||c.notes_confirmed!==true)fail('invalid','Уточніть кількість файлів, політику копій і підтвердьте нотатки.');
  p.expected_files=c.expected_files;p.required_copies=c.required_copies;p.confirmed=true;
 }else if(c.type==='media.transfer.issue'){
  if(!['missing','unknown','corrupt','doubtful'].includes(c.kind)||!c.note?.trim())fail('invalid','Вкажіть тип проблеми та пояснення.');
  const work=await task('Звірка польового пакета: '+c.note.trim(),entity.id,h.from_workflow_run_id);
  p.issues.push({id:crypto.randomUUID(),kind:c.kind,note:c.note.trim(),task_id:work.id,resolution:null});p.confirmed=false;p.export_digest=null;
 }else if(c.type==='media.transfer.resolve'){
  const issue=p.issues.find(x=>x.id===c.issue_id);if(!issue||issue.resolution||!c.reason?.trim())fail('invalid','Вкажіть результат усунення проблеми.');
  issue.resolution=c.reason.trim();const work=t.work_item.find(x=>x.id===issue.task_id),before=work.state;work.state='done';work.resolution=issue.resolution;await revise(work,issue.resolution);
  t.work_item_event.push({work_item_id:work.id,from_state:before,to_state:'done',actor_account_id:actor,occurred_at:s.clock,reason:issue.resolution});p.confirmed=false;p.export_digest=null;
 }else if(c.type==='media.transfer.refresh'){
  for(const i of items){i.revision_id=t.entity.find(e=>e.id===i.entity_id).current_revision_id;i.item_state='unresolved';}
  h.package_context=transferContext(s,items);
  h.manifest_checksum=await hash(items.map(({entity_id,revision_id,position,item_checksum})=>({entity_id,revision_id,position,item_checksum})));p.confirmed=false;p.export_digest=null;p.backups=[];
 }else if(c.type==='media.transfer.export'){
  const bundle=await transferBundle(s,h);p.export_digest=bundle.digest;audit('handover.export',entity.id,null,null,'Сформовано файл пакета');return bundle;
 }else if(c.type==='media.transfer.backup'){
  if(!c.failure_domain?.trim()||!c.location?.trim()||c.independent!==true)fail('invalid','Вкажіть місце та підтвердьте незалежність носія.');
  await verifyTransferBundle(c.bundle);const current=await transferBundle(s,h);
  if(current.digest!==c.bundle.digest)fail('invalid','Це інший або застарілий пакет. Завантажте поточну версію.');
  const domain=c.failure_domain.trim().toLocaleLowerCase();if(p.backups.some(b=>b.digest===current.digest&&b.failure_domain===domain))fail('invalid','Це місце вже враховано. Копії на одному носії не є незалежними.');
  p.export_digest=current.digest;p.backups.push({digest:current.digest,location:c.location.trim(),failure_domain:domain,checked_at:s.clock,checked_by:actor,verification:'selected-file-sha256',independence:'user-declared'});
 }else fail('invalid','Невідома дія звірки.');
 audit(c.type,entity.id,null,null,c.reason||c.note||'Оновлено звірку');return h;
}
