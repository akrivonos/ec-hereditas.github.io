import {verifyTransferBundle,transferBundle} from './handover.mjs?v=20261007-notes1';
import {rawHash} from './media.mjs?v=20261007-notes1';
export const intakeTypes=['intake_record'];
export const intakeRelations=(t,type,id)=>type==='intake_record'?{intake_item:structuredClone((t.intake_item||[]).filter(i=>i.intake_id===id))}:{};
export const intakePackage=(s,r)=>JSON.parse(s.demo.file_contents[r.package_file_id]);
export function intakeFacts(s,r){
 const b=intakePackage(s,r).payload,sessions=b.items.filter(i=>i.type==='collecting_session'),ids=new Set(sessions.map(i=>i.entity_id)),problems=[];
 for(const i of b.items){const x=i.revision.snapshot;if(i.type==='information_unit'&&!ids.has(x.session_id))problems.push('Запис «'+(x.title||i.entity_id)+'» не має сеансу в пакеті.');}
 for(const f of b.files)if(!f.captures?.some(c=>ids.has(c.session_id)))problems.push('Файл «'+f.filename+'» потребує звірки зв’язку із сеансом.');
 const people=b.context?.participants?.filter(p=>ids.has(p.session_id)&&p.role_code==='performer')||[];
 const consents=b.items.filter(i=>i.type==='consent_record').map(i=>i.revision.snapshot);
 const expected=people.length?[...new Map(people.map(p=>[p.session_id+':'+p.person_id,{key:p.session_id+':'+p.person_id,label:p.display_name||'Учасник сеансу',session_id:p.session_id,person_id:p.person_id}])).values()]:[{key:'participants',label:'Склад учасників та підстави згоди',session_id:null,person_id:null}];
 const consentRows=expected.map(p=>({...p,records:consents.filter(c=>c.person_id===p.person_id&&c.session_id===p.session_id),available:consents.some(c=>c.person_id===p.person_id&&c.session_id===p.session_id&&['active','partially_withdrawn'].includes(c.state))}));
 return {sessions,problems,consentRows,forms:b.items.filter(i=>i.type==='document'&&i.revision.snapshot.kind==='session_form'),notebooks:b.items.filter(i=>i.type==='document'&&i.revision.snapshot.kind==='field_notebook'),openIssues:b.issues.filter(i=>!i.resolution),files:b.files,sourceResearches:[...new Set(sessions.map(i=>i.revision.snapshot.research_id).filter(Boolean))]};
}
export function validateIntake(s,ok,fk,canonical){
 const t=s.tables;
 for(const r of t.intake_record||[]){fk('archive',r.archive_id);fk('field_research',r.research_id);fk('file_object',r.package_file_id);fk('workflow_run',r.workflow_run_id);ok(['reviewing','partial','accepted','returned'].includes(r.state),'Стан надходження');
  const items=(t.intake_item||[]).filter(i=>i.intake_id===r.id);ok(items.length>0&&new Set(items.map(i=>i.position)).size===items.length,'Склад надходження');
  const e=t.entity.find(e=>e.id===r.id),snapshot=t.entity_revision.find(v=>v.id===e?.current_revision_id)?.snapshot;
  ok(canonical(snapshot?._relations?.intake_item)===canonical(items),'Версія складу надходження');
  for(const i of items){ok(['pending','accept','restricted','defer','return'].includes(i.decision),'Рішення щодо матеріалу');if(i.local_entity_id)fk('entity',i.local_entity_id);if(i.task_id)fk('work_item',i.task_id);if(['accept','restricted'].includes(i.decision))ok(!!i.local_entity_id&&!!i.archive_code,'Прийнятий матеріал без обліку');}
 }
 const keys=(t.intake_record||[]).map(r=>r.archive_id+':'+r.source_package_id);ok(new Set(keys).size===keys.length,'Повторне надходження пакета');
 const codes=(t.identifier||[]).filter(i=>i.scheme==='archive_inventory').map(i=>i.namespace+':'+i.value);ok(new Set(codes).size===codes.length,'Повторений архівний шифр');
}
export async function intakeCommand(s,actor,c,ctx){
 const {need,fail,hash,snapshot,revise,audit}=ctx,t=s.tables,by=(type,id)=>t[type]?.find(x=>x.id===id),reg=id=>by('entity',id),rev=id=>reg(id)?.current_revision_id;
 const required=v=>{if(typeof v!=='string'||!v.trim())fail('invalid','Заповніть обов’язкові поля.');return v.trim();};
 const add=async(type,values,a)=>{const row={id:crypto.randomUUID(),...values},rid=crypto.randomUUID();(t[type]??=[]).push(row);t.entity.push({id:row.id,entity_type:type,owner_installation_id:s.demo.ids.installation,archive_id:a,owner_account_id:actor,current_revision_id:rid,retired_at:null});const snap=snapshot(t,type,row);t.entity_revision.push({id:rid,entity_id:row.id,revision_no:1,previous_revision_id:null,snapshot:snap,snapshot_hash:await hash(snap),recorded_at:s.clock,actor_account_id:actor,process_run_id:null,change_reason:'Зареєстровано надходження'});return row;};
 const addFile=async(name,mime,content,a,packageContainer=false)=>add('file_object',{sha256:await rawHash(content),byte_size:typeof content==='string'?new TextEncoder().encode(content).length:Uint8Array.from(atob(content.data),x=>x.charCodeAt(0)).length,mime_type:mime,pronom_id:null,original_filename:name,received_at:s.clock,technical_metadata:{intake:true,intake_package:packageContainer}},a);
 const task=async(r,title,kind,target)=>{const w=await add('work_item',{workflow_run_id:r.workflow_run_id,kind,title,state:'open',assigned_account_id:actor,assigned_role_id:null,due_at:null,resolution:null},r.archive_id);t.work_item_target.push({work_item_id:w.id,entity_id:target,revision_id:rev(target)});t.work_item_event.push({work_item_id:w.id,from_state:null,to_state:'open',actor_account_id:actor,occurred_at:s.clock,reason:title});return w;};
 if(c.type==='intake.import'||c.type==='intake.receive-local'){
  need('intake.receive',c.archive_id);const research=by('field_research',c.research_id);if(!research||reg(research.id)?.archive_id!==c.archive_id)fail('invalid','Оберіть дослідження цього архіву.');
  let bundle=c.bundle,local=null;
  if(c.type==='intake.receive-local'){local=by('handover',c.handover_id);const run=local&&by('workflow_run',local.from_workflow_run_id);if(!local||local.state!=='sent'||reg(run.primary_entity_id)?.archive_id!==c.archive_id)fail('invalid','Оберіть надісланий пакет цього архіву.');bundle=await transferBundle(s,local);}
  const raw=JSON.stringify(bundle);if(raw.length>32*1024*1024)fail('invalid','Пакет перевищує 32 МБ.');await verifyTransferBundle(bundle);
  const sourceId=bundle.payload.handover_id;if(typeof sourceId!=='string'||!/^[0-9a-f-]{36}$/.test(sourceId))fail('invalid','Відсутній ідентифікатор пакета.');
  const previous=t.intake_record?.find(r=>r.archive_id===c.archive_id&&r.source_package_id===sourceId);
  if(previous){if(previous.package_checksum!==bundle.digest)fail('conflict','Пакет із цим номером уже зареєстровано з іншим вмістом.');return {id:previous.id,repeated:true};}
  if(bundle.payload.items.some(i=>i.type==='consent_record'))need('consent.read',c.archive_id);
  const packet=await addFile('Надходження-'+sourceId+'.json','application/json',raw,c.archive_id,true);s.demo.file_contents[packet.id]=raw;
  const run={id:crypto.randomUUID(),workflow_code:'WF-05',primary_entity_id:null,started_by:actor,started_at:s.clock,finished_at:null,state:'in_progress',notes:null};t.workflow_run.push(run);
  const r=await add('intake_record',{archive_id:c.archive_id,research_id:c.research_id,title:required(c.title),sender_label:required(c.sender_label),received_at:s.clock,received_by:actor,source_package_id:sourceId,package_checksum:bundle.digest,package_file_id:packet.id,local_handover_id:local?.id||null,workflow_run_id:run.id,state:'reviewing',checks:null,reviewed_by:null,reviewed_at:null,followup_task_ids:[]},c.archive_id);run.primary_entity_id=r.id;
  for(const i of bundle.payload.items)(t.intake_item??=[]).push({intake_id:r.id,position:i.position,source_entity_id:i.entity_id,source_revision_id:i.revision_id,source_type:i.type,decision:'pending',reason:null,local_entity_id:null,archive_code:null,task_id:null});
  if(local)local.intake_record_id=r.id;
  await revise(r,'Зафіксовано незмінний пакет і його склад');audit('intake.import',r.id,null,rev(r.id),'Пакет перевірено та зареєстровано');return {id:r.id,repeated:false};
 }
 const r=by('intake_record',c.id);if(!r)fail('forbidden','Надходження недоступне.');need('intake.receive',r.archive_id);need('consent.read',r.archive_id);
 if(rev(r.id)!==c.expected_revision_id)fail('stale','Надходження змінено. Оновіть сторінку.');if(!['reviewing','partial','returned'].includes(r.state))fail('blocked','Рішення вже зафіксовано.');
 if(c.type!=='intake.review')fail('invalid','Невідома дія приймання.');
 const bundle=intakePackage(s,r);await verifyTransferBundle(bundle);const facts=intakeFacts(s,r),items=t.intake_item.filter(i=>i.intake_id===r.id),pending=items.filter(i=>!i.local_entity_id),checks=c.checks;
 if(!checks||checks.research_confirmed!==true||checks.links_confirmed!==true||!checks.relationship_note?.trim())fail('invalid','Перевірте належність дослідженню та зв’язки матеріалів.');
 for(const key of ['forms','notes'])if(!['verified','missing','not_applicable'].includes(checks[key])||checks[key]!=='verified'&&!checks[key+'_note']?.trim())fail('invalid','Поясніть комплектність документації.');
 if(checks.forms==='verified'&&!facts.forms.length||checks.notes==='verified'&&!facts.notebooks.length)fail('invalid','Документа немає в пакеті. Позначте відсутність або поясніть, чому він не потрібний.');
 if(!Array.isArray(checks.consents)||checks.consents.length!==facts.consentRows.length||new Set(checks.consents.map(x=>x.key)).size!==facts.consentRows.length)fail('invalid','Перевірте підстави згоди кожного учасника.');
 for(const person of facts.consentRows){const x=checks.consents.find(x=>x.key===person.key);if(!x||!['verified','missing','not_applicable'].includes(x.status)||!x.note?.trim()||x.status==='verified'&&!x.evidence_locator?.trim())fail('invalid','Вкажіть результат звірки згоди та місце підтвердження.');}
 const hasGaps=facts.problems.length>0||facts.openIssues.length>0||['forms','notes'].some(k=>checks[k]==='missing')||checks.consents.some(x=>x.status==='missing');
 const decisions=c.decisions;if(!Array.isArray(decisions)||decisions.length!==pending.length||new Set(decisions.map(d=>d.position)).size!==pending.length)fail('invalid','Укажіть рішення щодо кожного матеріалу.');
 for(const item of pending){const d=decisions.find(x=>x.position===item.position);if(!d||!['accept','restricted','defer','return'].includes(d.decision)||d.decision!=='accept'&&!d.reason?.trim())fail('invalid','Поясніть рішення щодо матеріалу.');if(d.decision==='accept'&&hasGaps)fail('blocked','Є прогалини. Усуньте їх або прийміть матеріал з обмеженням і завданням.');
  if(['accept','restricted'].includes(d.decision)){const code=required(d.archive_code);if((t.identifier||[]).some(i=>i.scheme==='archive_inventory'&&i.namespace===r.archive_id&&i.value===code&&!(r.local_handover_id&&i.entity_id===item.source_entity_id&&rev(item.source_entity_id)===item.source_revision_id)))fail('conflict','Архівний шифр уже використано: '+code);}
 }
 // All writes below occur on the store's private clone; any conflict rolls back the lot.
 for(const item of pending){const d=decisions.find(x=>x.position===item.position),source=bundle.payload.items.find(x=>x.position===item.position),snap=source.revision.snapshot;
  if(item.task_id){const old=by('work_item',item.task_id);if(old&&!['done','cancelled'].includes(old.state)){const before=old.state;old.state='done';old.resolution='Повторний розгляд надходження';await revise(old,old.resolution);t.work_item_event.push({work_item_id:old.id,from_state:before,to_state:'done',actor_account_id:actor,occurred_at:s.clock,reason:old.resolution});}}
  item.decision=d.decision;item.reason=d.reason?.trim()||null;item.task_id=null;
  if(['accept','restricted'].includes(d.decision)){
   let row;
   if(r.local_handover_id&&reg(item.source_entity_id)&&rev(item.source_entity_id)===item.source_revision_id)row=by(reg(item.source_entity_id).entity_type,item.source_entity_id);
   else if(source.type==='file_object'){const f=bundle.payload.files.find(f=>f.id===source.entity_id);row=await addFile(f.filename,f.mime_type,f.content,r.archive_id);s.demo.file_contents[row.id]=structuredClone(f.content);for(const o of f.origins?.length?f.origins:[{}])t.file_ingest_occurrence.push({file_id:row.id,workflow_run_id:r.workflow_run_id,received_filename:o.received_filename||f.filename,source_path:o.source_path||null,received_at:s.clock,capture_event_id:null});}
   else {row=await add('document',{kind:source.type==='consent_record'?'received_consent':'received_description',title:snap.title||snap.preferred_name||'Отриманий опис',body_text:snap.body_text||snap.summary||snap.context_notes||snap.terms||'Оригінальний опис збережено в пакеті надходження.',language_tag:snap.language_tag||'uk',media_asset_id:null,physical_object_id:null},r.archive_id);t.document_context.push({document_id:row.id,target_entity_id:r.id,target_revision_id:null,context_role:'intake_source'});await revise(row,'Пов’язано з незмінним описом джерела');}
   item.local_entity_id=row.id;item.archive_code=d.archive_code.trim();if(!(t.identifier||[]).some(i=>i.entity_id===row.id&&i.scheme==='archive_inventory'&&i.namespace===r.archive_id&&i.value===item.archive_code))(t.identifier??=[]).push({id:crypto.randomUUID(),entity_id:row.id,scheme:'archive_inventory',namespace:r.archive_id,value:item.archive_code,is_primary:!t.identifier?.some(i=>i.entity_id===row.id&&i.scheme==='archive_inventory'&&i.is_primary),source_evidence_id:null});
   if(d.decision==='restricted')item.task_id=(await task(r,'Уточнити підстави використання — '+(snap.title||snap.original_filename||'матеріал')+': '+item.reason,'rights_review',row.id)).id;
  }else item.task_id=(await task(r,'Доопрацювати — '+(snap.title||snap.original_filename||'матеріал')+': '+item.reason,'archival_review',r.id)).id;
 }
 if(hasGaps&&!r.followup_task_ids.length)r.followup_task_ids.push((await task(r,'Перевірити документацію та згоди надходження','rights_review',r.id)).id);
 if(!hasGaps)for(const id of r.followup_task_ids){const w=by('work_item',id);if(w?.state!=='done'){const before=w.state;w.state='done';w.resolution='Комплектність підтверджено при повторному розгляді';await revise(w,w.resolution);t.work_item_event.push({work_item_id:w.id,from_state:before,to_state:'done',actor_account_id:actor,occurred_at:s.clock,reason:w.resolution});}}
 r.checks=structuredClone(checks);r.reviewed_by=actor;r.reviewed_at=s.clock;const accepted=items.filter(i=>i.local_entity_id).length;r.state=accepted===items.length?'accepted':accepted?'partial':'returned';
 const run=by('workflow_run',r.workflow_run_id);run.state=r.state==='accepted'?'completed':'blocked';run.finished_at=r.state==='accepted'?s.clock:null;
 if(r.local_handover_id){const h=by('handover',r.local_handover_id);if(r.state==='accepted'){h.state='accepted';h.accepted_by=actor;h.accepted_at=s.clock;t.handover_item.filter(i=>i.handover_id===h.id).forEach(i=>i.item_state='present');}}
 await revise(r,'Зафіксовано рішення приймання');audit('intake.review',r.id,null,rev(r.id),'Приймання не змінює прав доступу та публікації');return {id:r.id,state:r.state};
}
