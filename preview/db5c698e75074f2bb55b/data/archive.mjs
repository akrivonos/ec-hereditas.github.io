// Human review and publication workbench; no transport or implicit access grants.
import {can} from './model.mjs?v=20261001-wf13';
import {publicView,publicResources} from './public.mjs?v=20261001-wf13';
export const archiveTypes=['verification_record'];
export const descriptionFields={information_unit:{title:'Назва',summary:'Опис'},document:{title:'Назва',body_text:'Текст документа'},physical_object:{title:'Назва',inscriptions:'Написи'}};
export const reviewStates={pending:'Очікує перевірки',deferred:'Відкладено',accepted:'Прийнято',corrected:'Прийнято з виправленням',rejected:'Відхилено',superseded:'Замінено'};
const reg=(s,id)=>s.tables.entity.find(x=>x.id===id),rev=(s,id)=>reg(s,id)?.current_revision_id;
export function archiveCandidate(s,actor,id){
 const t=s.tables,c=t.candidate.find(x=>x.id===id),target=c&&reg(s,c.target_entity_id);
 if(!c||!target||!can(s,actor,'review.write',target.archive_id))return null;
 const basis=t.entity_revision.find(x=>x.id===c.base_revision_id)?.snapshot;
 const source=target.entity_type==='publication_record'?reg(s,basis?.source_entity_id):target;
 const sourceRevision=target.entity_type==='publication_record'?basis?.source_revision_id:c.base_revision_id;
 const current=source&&t[source.entity_type]?.find(x=>x.id===source.id);
 const sources=t.candidate_source.filter(x=>x.candidate_id===c.id).map(x=>{
  const r=t.entity_revision.find(r=>r.id===x.source_revision_id),e=reg(s,x.source_entity_id);
  // Submitted research evidence is shared through the proposal, not the entire private corpus.
  return {id:x.source_entity_id,title:r?.snapshot.title||r?.snapshot.statement_text||'Підстава пропозиції',text:r?.snapshot.note||r?.snapshot.body_text||r?.snapshot.summary||r?.snapshot.quote_text||'',available:!e?.archive_id||can(s,actor,'domain.read',e.archive_id)};
 });
 return {...structuredClone(c),revision_id:rev(s,c.id),archive_id:target.archive_id,source_id:source?.id,source_revision_id:sourceRevision,source_type:source?.entity_type,current:structuredClone(current),basis:structuredClone(basis),sources,
  stale:rev(s,c.target_entity_id)!==c.base_revision_id||rev(s,source?.id)!==sourceRevision,
  editable:!!descriptionFields[source?.entity_type]&&['description','change_proposal'].includes(c.kind),
  decisions:structuredClone(t.review_decision.filter(x=>x.target_entity_id===c.id))};
}
export function archivePublications(s,actor){return s.tables.publication_record.filter(p=>can(s,actor,'publication.write',reg(s,p.id)?.archive_id));}
export function publicationCheck(s,actor,id){
 const p=archivePublications(s,actor).find(x=>x.id===id);if(!p)return null;
 const t=s.tables,issues=[],source=reg(s,p.source_entity_id);
 if(source?.retired_at||rev(s,p.source_entity_id)!==p.source_revision_id)issues.push('Архівний опис змінився. Потрібні нова перевірка й нове рішення про доступ.');
 const verified=(t.verification_record||[]).some(x=>x.target_entity_id===p.source_entity_id&&x.target_revision_id===p.source_revision_id&&x.result==='confirmed');
 if(!verified)issues.push('Підтвердьте перевірку поточної версії архівного опису.');
 const preview=structuredClone(s),row=preview.tables.publication_record.find(x=>x.id===id);row.state='published';
 const view=publicView(preview,id);
 if(!view)issues.push('Немає чинної узгодженої підстави для публічного показу цієї версії.');
 if(t.work_item_target.some(x=>x.entity_id===p.source_entity_id&&t.work_item.some(w=>w.id===x.work_item_id&&['rights_review','archival_review'].includes(w.kind)&&!['done','cancelled'].includes(w.state))))issues.push('Є незавершені питання перевірки опису або прав.');
 return {publication:structuredClone(p),revision_id:rev(s,p.id),source_title:t.entity_revision.find(x=>x.id===p.source_revision_id)?.snapshot.title||p.safe_payload.title,issues,view,resources:view?publicResources(preview,id):[],verified};
}
export function validateArchive(s,require,fk){
 const t=s.tables;
 for(const v of t.verification_record||[]){fk('entity',v.target_entity_id);require(t.entity_revision.some(r=>r.id===v.target_revision_id&&r.entity_id===v.target_entity_id),'Версія верифікації');fk('account',v.verified_by);require(!!v.method?.trim()&&!!v.checked_aspect?.trim()&&['confirmed','unresolved','rejected'].includes(v.result),'Верифікація');if(v.review_decision_id)fk('review_decision',v.review_decision_id);require(t.evidence_link.some(e=>e.subject_entity_id===v.id),'Підстава верифікації');}
 for(const c of t.candidate.filter(x=>x.payload_schema_version==='archival-description-1'))require(c.kind==='description'&&!!descriptionFields[reg(s,c.target_entity_id)?.entity_type]?.[c.proposed_payload.field]&&!!c.proposed_payload.value?.trim()&&t.candidate_source.some(x=>x.candidate_id===c.id),'Пропозиція опису');
 for(const a of t.review_application){fk('review_decision',a.review_decision_id);require(t.entity_revision.some(r=>r.id===a.result_revision_id&&r.entity_id===a.result_entity_id),'Результат застосування рішення');}
}
export async function archiveCommand(s,actor,c,ctx){
 const {need,fail,hash,snapshot,revise,audit}=ctx,t=s.tables,by=(k,id)=>t[k]?.find(x=>x.id===id),e=id=>reg(s,id),r=id=>rev(s,id),text=v=>{if(typeof v!=='string'||!v.trim())fail('invalid','Заповніть обов’язкове поле.');return v.trim();};
 const fresh=(id,expected)=>{if(r(id)!==expected)fail('stale','Запис змінено. Оновіть сторінку та повторіть звірку.');};
 const add=async(kind,values,archive)=>{const row={id:crypto.randomUUID(),...values},rid=crypto.randomUUID();(t[kind]??=[]).push(row);t.entity.push({id:row.id,entity_type:kind,owner_installation_id:s.demo.ids.installation,archive_id:archive,owner_account_id:actor,current_revision_id:rid,retired_at:null});const snap=snapshot(t,kind,row);t.entity_revision.push({id:rid,entity_id:row.id,revision_no:1,previous_revision_id:null,snapshot:snap,snapshot_hash:await hash(snap),recorded_at:s.clock,actor_account_id:actor,process_run_id:null,change_reason:c.reason||'Людська перевірка'});audit(c.type,row.id,null,rid,c.reason);return row;};
 const verification=async(id,rid,reason,decision=null,outcome='confirmed')=>{
  const evidence=await add('evidence',{source_entity_id:id,source_revision_id:rid,external_uri:null,locator:c.locator?.trim()||null,quote_text:c.quote?.trim()||null,note:text(c.evidence_note||(outcome!=='confirmed'?c.reason:null)),captured_at:s.clock},e(id).archive_id);
  const v=await add('verification_record',{target_entity_id:id,target_revision_id:rid,verified_by:actor,verified_at:s.clock,method:text(c.method||(outcome!=='confirmed'?'Людська звірка пропозиції':null)),checked_aspect:reason,result:outcome,review_decision_id:decision},e(id).archive_id);
  t.evidence_link.push({subject_entity_id:v.id,subject_revision_id:r(v.id),evidence_id:evidence.id,evidence_role:'review'});if(decision)t.evidence_link.push({subject_entity_id:decision,subject_revision_id:r(decision),evidence_id:evidence.id,evidence_role:'review_basis'});return v;
 };
 const hidePublications=async ids=>{for(const p of t.publication_record.filter(p=>ids.includes(p.id)&&p.state==='published')){p.state='unpublished';p.unpublished_at=s.clock;await revise(p,c.reason||'Потрібна повторна перевірка');}};
 if(c.type==='archive.propose'){
  const target=e(c.id);if(!target||!descriptionFields[target.entity_type]?.[c.field])fail('invalid','Оберіть поле архівного опису.');need('review.write',target.archive_id);fresh(c.id,c.expected_revision_id);text(c.value);text(c.reason);
  const evidence=await add('evidence',{source_entity_id:c.id,source_revision_id:r(c.id),external_uri:null,locator:c.locator?.trim()||null,quote_text:null,note:text(c.evidence_note),captured_at:s.clock},target.archive_id);
  const row=await add('candidate',{kind:'description',target_entity_id:c.id,base_revision_id:r(c.id),proposed_payload:{field:c.field,value:c.value,description:c.reason},payload_schema_version:'archival-description-1',proposed_entity_id:null,process_run_id:null,proposed_by:actor,confidence:null,state:'pending'},target.archive_id);
  t.candidate_source.push({candidate_id:row.id,source_entity_id:evidence.id,source_revision_id:r(evidence.id),source_role:'review'});return row;
 }
 if(c.type==='archive.review'){
  const view=archiveCandidate(s,actor,c.id);if(!view)fail('forbidden','Пропозиція недоступна.');const candidate=by('candidate',c.id);fresh(candidate.id,c.expected_revision_id);
  if(!view.editable)fail('invalid','Цей тип пропозиції розглядається у відповідному робочому процесі.');
  if(!['pending','deferred'].includes(candidate.state))fail('invalid','Рішення вже ухвалено.');
  if(!['accept','correct','reject','defer'].includes(c.decision))fail('invalid','Оберіть рішення.');text(c.reason);
  let result=null;
  if(['accept','correct'].includes(c.decision)){
   if(view.stale)fail('stale','Основа пропозиції змінилася. Потрібна повторна звірка.');
   need('catalog.write',view.archive_id);if(c.confirm!==true)fail('invalid','Підтвердьте перевірку джерела.');
   const field=candidate.kind==='description'?candidate.proposed_payload.field:c.field;
   if(!descriptionFields[view.source_type]?.[field])fail('invalid','Оберіть поле опису.');
   const value=candidate.kind==='description'&&c.decision==='accept'?candidate.proposed_payload.value:text(c.value);
   if(value===view.current[field])fail('invalid','Нове значення збігається з поточним.');
   if(candidate.kind==='description'&&c.decision==='correct'&&value===candidate.proposed_payload.value)fail('invalid','Для виправлення зазначте змінене значення.');
   const row=by(view.source_type,view.source_id);row[field]=text(value);await revise(row,c.reason);
   // Preserve the session aggregate contract when a unit is revised.
   if(view.source_type==='information_unit')await revise(by('collecting_session',row.session_id),'Уточнено опис інформаційної одиниці');
   result=row;
  }
  const previous=t.review_decision.filter(x=>x.target_entity_id===candidate.id).at(-1);
  const decision=await add('review_decision',{target_entity_id:candidate.id,target_revision_id:r(candidate.id),decision:c.decision,reviewer_account_id:actor,decided_at:s.clock,reason:c.reason,supersedes_decision_id:previous?.id||null},view.archive_id);
  if(result){
   await verification(result.id,r(result.id),c.reason,decision.id);
   t.review_application.push({review_decision_id:decision.id,result_entity_id:result.id,result_revision_id:r(result.id),applied_at:s.clock});
   for(const d of t.access_decision.filter(x=>x.target_entity_id===result.id&&x.state==='effective')){d.state='needs_review';await revise(d,'Опис змінено після звірки');}
   await hidePublications(t.publication_record.filter(p=>p.source_entity_id===result.id).map(p=>p.id));
  }
  if(!result)await verification(candidate.id,r(candidate.id),c.reason,decision.id,c.decision==='reject'?'rejected':'unresolved');
  candidate.state={accept:'accepted',correct:'corrected',reject:'rejected',defer:'deferred'}[c.decision];await revise(candidate,c.reason);
  const linked=t.work_item.filter(w=>t.work_item_target.some(x=>x.work_item_id===w.id&&x.entity_id===candidate.id)&&['archival_review','museum_correction_request'].includes(w.kind)&&!['done','cancelled'].includes(w.state));
  if(c.decision==='defer'&&!linked.length){const w=await add('work_item',{workflow_run_id:null,kind:'archival_review',title:'Повторна звірка: '+(view.current?.title||'матеріал'),state:'open',assigned_account_id:actor,assigned_role_id:null,due_at:null,resolution:null},view.archive_id);t.work_item_target.push({work_item_id:w.id,entity_id:candidate.id,revision_id:r(candidate.id)});t.work_item_event.push({work_item_id:w.id,from_state:null,to_state:'open',actor_account_id:actor,occurred_at:s.clock,reason:c.reason});}
  if(c.decision!=='defer')for(const w of linked){const from=w.state;w.state='done';w.resolution=c.reason;await revise(w,c.reason);t.work_item_event.push({work_item_id:w.id,from_state:from,to_state:'done',actor_account_id:actor,occurred_at:s.clock,reason:c.reason});if(w.workflow_run_id){const run=by('workflow_run',w.workflow_run_id);run.state='completed';run.finished_at=s.clock;}}
  return {id:candidate.id,result_id:result?.id,decision_id:decision.id};
 }
 if(c.type==='archive.verify'){
  const source=e(c.id);if(!source||!descriptionFields[source.entity_type])fail('invalid','Матеріал недоступний для цієї перевірки.');need('review.write',source.archive_id);fresh(c.id,c.expected_revision_id);if(c.confirm!==true)fail('invalid','Підтвердьте перевірку.');return verification(c.id,r(c.id),text(c.reason));
 }
 if(c.type==='archive.access.revoke'){
  const d=by('access_decision',c.id);if(!d)fail('forbidden','Рішення недоступне.');need('access.manage',e(d.id).archive_id);fresh(d.id,c.expected_revision_id);text(c.reason);if(!['effective','needs_review'].includes(d.state))fail('invalid','Рішення вже не чинне.');d.state='revoked';await revise(d,c.reason);await hidePublications(t.publication_basis.filter(x=>x.decision_id===d.id).map(x=>x.publication_id));return d;
 }
 if(['archive.publication.prepare','archive.publication.refresh'].includes(c.type)){
  const source=e(c.source_id),decision=by('access_decision',c.decision_id);
  if(!source||!descriptionFields[source.entity_type])fail('invalid','Оберіть архівний матеріал.');need('publication.write',source.archive_id);fresh(source.id,c.expected_source_revision_id);
  if(!decision||e(decision.id).archive_id!==source.archive_id)fail('invalid','Оберіть рішення цього архіву.');fresh(decision.id,c.expected_decision_revision_id);
  const existing=c.type==='archive.publication.refresh'?by('publication_record',c.id):null;
  if(c.type==='archive.publication.refresh'){if(!existing||existing.source_entity_id!==source.id)fail('invalid','Оберіть публікацію цього матеріалу.');fresh(existing.id,c.expected_revision_id);text(c.reason);}
  if(!existing&&t.publication_record.some(p=>p.source_entity_id===source.id&&p.channel_code==='public'))fail('invalid','Для матеріалу вже є публікація. Відкрийте її зі списку.');
  const id=crypto.randomUUID(),payload={kind:'material',title:text(c.title),summary:text(c.summary),attribution:text(c.attribution),terms:text(c.terms),category:c.category?.trim()||'',place:c.place?.trim()||'',period:c.period?.trim()||'',context_ids:[]};
  const row=existing||await add('publication_record',{id,source_entity_id:source.id,source_revision_id:r(source.id),channel_code:'public',stable_slug:'material-'+id,state:'unpublished',published_at:null,unpublished_at:null,safe_payload:payload,projection_profile_version:'public-reader-1',deposit_item_id:null},source.archive_id);
  if(existing){row.source_revision_id=r(source.id);row.safe_payload=payload;row.state='unpublished';row.unpublished_at=s.clock;t.publication_basis=t.publication_basis.filter(b=>b.publication_id!==row.id);t.publication_resource=t.publication_resource.filter(b=>b.publication_id!==row.id);}
  for(const id of c.resource_ids||[]){const grant=t.access_decision_resource.find(x=>x.decision_id===decision.id&&x.resource_entity_id===id&&x.effect==='allow');if(!grant||e(id)?.retired_at||r(id)!==grant.resource_revision_id)fail('invalid','Оберіть дозволену поточну версію ресурсу.');t.publication_resource.push({publication_id:row.id,resource_entity_id:id,resource_revision_id:grant.resource_revision_id,purpose_code:'public',use_code:'view'});}
  t.publication_basis.push({publication_id:row.id,decision_id:decision.id,decision_revision_id:r(decision.id)});await revise(row,c.reason||'Підготовлено публічний опис');
  const preview=structuredClone(s);preview.tables.publication_record.find(p=>p.id===row.id).state='published';if(!publicView(preview,row.id))fail('invalid','Рішення не дозволяє публічний показ цієї версії.');
  return row;
 }
 if(c.type.startsWith('archive.publication.')){
  const p=by('publication_record',c.id);if(!p)fail('forbidden','Публікація недоступна.');need('publication.write',e(p.id).archive_id);fresh(p.id,c.expected_revision_id);text(c.reason);
  if(c.type==='archive.publication.withdraw'){if(p.state!=='published')fail('invalid','Матеріал не опубліковано.');await hidePublications([p.id]);return p;}
  if(c.type==='archive.publication.publish'){
   if(p.state==='published')fail('invalid','Матеріал уже опубліковано.');const check=publicationCheck(s,actor,p.id);if(check.issues.length)fail('invalid',check.issues.join(' '));if(c.confirm!==true)fail('invalid','Підтвердьте перегляд публічного вигляду.');
   if(c.expected_source_revision_id!==r(p.source_entity_id))fail('stale','Джерело змінилося.');
   p.state='published';p.published_at=s.clock;p.unpublished_at=null;await revise(p,c.reason);return p;
  }
 }
 fail('invalid','Невідома дія архівіста.');
}
