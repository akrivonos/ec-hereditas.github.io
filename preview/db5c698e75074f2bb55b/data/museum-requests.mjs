// Museum handovers use the existing document, candidate and work-item graph.
import {activeAccount,can} from './model.mjs?v=20260930-wf08-final';
import {museumOwned} from './museum.mjs?v=20260930-wf08-final';
import {publicView} from './public.mjs?v=20260930-wf08-final';
export const requestKinds={museum_publication_request:'Запит публікації',museum_correction_request:'Зауваження до опису'};
export function validateMuseumRequests(s,require,fk){
 const t=s.tables,reg=id=>t.entity.find(x=>x.id===id);
 for(const x of t.candidate.filter(x=>x.payload_schema_version==='museum-proposal-1')){
  require(x.kind==='change_proposal'&&x.proposed_by===reg(x.id).owner_account_id&&!!x.proposed_payload.description?.trim(),'Музейна пропозиція');fk('account',x.proposed_by);
  require(reg(x.target_entity_id)?.entity_type==='publication_record'&&t.entity_revision.some(r=>r.id===x.base_revision_id&&r.entity_id===x.target_entity_id),'Публічна основа пропозиції');
  require(t.candidate_source.some(y=>y.candidate_id===x.id&&y.source_entity_id===x.target_entity_id&&y.source_revision_id===x.base_revision_id),'Підстава музейної пропозиції');
 }
 for(const x of t.work_item.filter(x=>requestKinds[x.kind])){fk('account',reg(x.id).owner_account_id);require(t.work_item_target.some(y=>y.work_item_id===x.id&&t.document.some(d=>d.id===y.entity_id&&d.kind===x.kind)),'Текст звернення');if(x.kind==='museum_correction_request')require(t.work_item_target.some(y=>y.work_item_id===x.id&&t.candidate.some(d=>d.id===y.entity_id&&d.payload_schema_version==='museum-proposal-1')),'Пропозиція звернення');}
}
export function museumRequests(s,actor){
 if(!activeAccount(s,actor))return [];
 const t=s.tables,reg=id=>t.entity.find(x=>x.id===id);
 return t.work_item.filter(x=>requestKinds[x.kind]&&(reg(x.id).owner_account_id===actor||can(s,actor,'task.assign',reg(x.id).archive_id))).map(x=>{
  const targets=t.work_item_target.filter(y=>y.work_item_id===x.id),doc=t.document.find(d=>targets.some(y=>y.entity_id===d.id)&&d.kind===x.kind),candidate=t.candidate.find(d=>targets.some(y=>y.entity_id===d.id));
  const source=candidate&&publicView(s,candidate.target_entity_id),publication=source?.revision_id===candidate?.base_revision_id?source:null;
  const exhibition=t.museum_exhibition.find(d=>targets.some(y=>y.entity_id===d.id));
  return {...structuredClone(x),revision_id:reg(x.id).current_revision_id,archive_id:reg(x.id).archive_id,exhibition_id:exhibition?.id,exhibition_title:exhibition?.title,body:doc?.body_text||'',candidate_id:candidate?.id,candidate_state:candidate?.state,publication:publication?{id:publication.id,title:publication.title}:null,can_respond:can(s,actor,'task.assign',reg(x.id).archive_id),events:structuredClone(t.work_item_event.filter(y=>y.work_item_id===x.id))};
 });
}
export async function museumRequestCommand(s,actor,c,ctx){
 const {fail,hash,snapshot,audit,revise}=ctx,t=s.tables,by=(k,id)=>t[k].find(x=>x.id===id),reg=id=>by('entity',id),rev=id=>reg(id)?.current_revision_id;
 const required=v=>{if(typeof v!=='string'||!v.trim())fail('invalid','Заповніть обов’язкове поле.');return v.trim();};
 const add=async(kind,values,archive)=>{const row={id:crypto.randomUUID(),...values},rid=crypto.randomUUID();t[kind].push(row);t.entity.push({id:row.id,entity_type:kind,owner_installation_id:s.demo.ids.installation,archive_id:archive,owner_account_id:actor,current_revision_id:rid,retired_at:null});const snap=snapshot(t,kind,row);t.entity_revision.push({id:rid,entity_id:row.id,revision_no:1,previous_revision_id:null,snapshot:snap,snapshot_hash:await hash(snap),recorded_at:s.clock,actor_account_id:actor,process_run_id:null,change_reason:'Звернення до архіву'});audit(c.type,row.id,null,rid);return row;};
 if(c.type==='museum.request.create'){
  const ex=by('museum_exhibition',c.exhibition_id);if(!ex||!museumOwned(s,actor,ex.id))fail('forbidden','Експозиція недоступна.');
  if(['closed','archived'].includes(ex.state))fail('invalid','Експозицію закрито.');
  if(!requestKinds[c.kind])fail('invalid','Оберіть вид звернення.');
  const archive=reg(ex.id).archive_id,title=required(c.title),body=required(c.body);if(title.length>240||body.length>12000)fail('invalid','Скоротіть назву або текст звернення.');
  if(museumRequests(s,actor).some(x=>x.exhibition_id===ex.id&&x.kind===c.kind&&x.title===title&&x.body===body&&!['done','cancelled'].includes(x.state)))fail('invalid','Таке звернення вже перебуває на розгляді.');
  let pub=null;if(c.kind==='museum_correction_request'){pub=publicView(s,c.publication_id);if(!pub||pub.kind!=='material'||pub.revision_id!==c.publication_revision_id||reg(pub.id).archive_id!==archive)fail('invalid','Оберіть актуальний публічний матеріал цього архіву.');}
  const assignee=t.account.find(x=>x.state==='active'&&x.id!==actor&&can(s,x.id,'task.assign',archive));if(!assignee)fail('invalid','В архіві немає доступного відповідального за звернення.');
  const doc=await add('document',{kind:c.kind,title,body_text:body,language_tag:'uk',media_asset_id:null,physical_object_id:null},archive);
  let candidate=null;if(pub){candidate=await add('candidate',{kind:'change_proposal',target_entity_id:pub.id,base_revision_id:pub.revision_id,proposed_payload:{description:body},payload_schema_version:'museum-proposal-1',proposed_entity_id:null,process_run_id:null,proposed_by:actor,confidence:null,state:'pending'},archive);t.candidate_source.push({candidate_id:candidate.id,source_entity_id:pub.id,source_revision_id:pub.revision_id,source_role:'public_observation'});}
  const run={id:crypto.randomUUID(),workflow_code:pub?'WF-08':'WF-09',primary_entity_id:archive,started_by:actor,started_at:s.clock,finished_at:null,state:'in_progress',notes:null};t.workflow_run.push(run);
  const task=await add('work_item',{workflow_run_id:run.id,kind:c.kind,title,state:'assigned',assigned_account_id:assignee.id,assigned_role_id:null,due_at:null,resolution:null},archive);
  for(const id of [ex.id,doc.id,candidate?.id].filter(Boolean))t.work_item_target.push({work_item_id:task.id,entity_id:id,revision_id:rev(id)});
  t.work_item_event.push({work_item_id:task.id,from_state:null,to_state:'assigned',actor_account_id:actor,occurred_at:s.clock,reason:'Передано на розгляд архіву'});return task;
 }
 if(c.type==='museum.request.clarify'){
  const row=by('work_item',c.id);if(!row||!requestKinds[row.kind]||!museumOwned(s,actor,row.id))fail('forbidden','Звернення недоступне.');
  if(c.expected_revision_id!==rev(row.id))fail('stale','Звернення змінено. Оновіть сторінку.');if(row.state!=='blocked')fail('invalid','Уточнення зараз не очікується.');
  const reason=required(c.reason);row.state='assigned';t.work_item_event.push({work_item_id:row.id,from_state:'blocked',to_state:'assigned',actor_account_id:actor,occurred_at:s.clock,reason:'Уточнення заявника: '+reason});await revise(row,reason);return row;
 }
 if(c.type==='museum.request.respond'){
  const view=museumRequests(s,actor).find(x=>x.id===c.id),row=by('work_item',c.id);if(!view?.can_respond)fail('forbidden','Відповідати може відповідальний працівник архіву.');
  if(c.expected_revision_id!==rev(row.id))fail('stale','Звернення змінено. Оновіть сторінку.');
  if(['done','cancelled'].includes(row.state))fail('invalid','Розгляд уже завершено.');
  const reason=required(c.reason),to={start:'in_progress',block:'blocked',complete:'done'}[c.action];if(!to)fail('invalid','Оберіть дію.');
  if(view.candidate_id&&c.action==='complete'){
   if(c.decision!=='reject')fail('invalid','Пропозиція зміни може бути відхилена з поясненням або лишатися на звірці.');
   const candidate=by('candidate',view.candidate_id);await add('review_decision',{target_entity_id:candidate.id,target_revision_id:rev(candidate.id),decision:'reject',reviewer_account_id:actor,decided_at:s.clock,reason,supersedes_decision_id:null},view.archive_id);candidate.state='rejected';await revise(candidate,reason);
  }
  const from=row.state;row.state=to;if(to==='done'){row.resolution=reason;const run=by('workflow_run',row.workflow_run_id);run.state='completed';run.finished_at=s.clock;}
  t.work_item_event.push({work_item_id:row.id,from_state:from,to_state:to,actor_account_id:actor,occurred_at:s.clock,reason});await revise(row,reason);return row;
 }
 fail('invalid','Невідома дія звернення.');
}
