export const contactStates=[['planned','Заплановано'],['contacted','Зв’язалися'],['confirmed','Домовлено'],['declined','Відмова'],['unreachable','Не вдалося зв’язатися']];
export const contactExpired=(s,row)=>!!row.retention_until&&row.retention_until<s.clock.slice(0,10);
export function contactSession(s,id){
 const objects=s.tables.workflow_object||[];
 const run=s.tables.workflow_run.findLast(w=>w.workflow_code==='WF-03'&&objects.some(x=>x.workflow_run_id===w.id&&x.entity_id===id&&x.role==='input'));
 return run?s.tables.collecting_session.find(x=>x.id===run.primary_entity_id):null;
}
export function validateContacts(s,require,fk){
 const t=s.tables,by=(table,id)=>t[table].find(x=>x.id===id),archive=id=>by('entity',id)?.archive_id;
 for(const x of t.potential_respondent){
  require(contactStates.some(([k])=>k===x.state),'Стан контакту');
  if(x.place_id){fk('place',x.place_id);require(archive(x.id)===archive(x.place_id),'Місце іншого архіву');}
  if(x.work_group_id)require(by('work_group',x.work_group_id)?.research_id===x.research_id,'Група іншого дослідження');
 }
 for(const x of t.respondent_referral){
  require(!(x.referrer_person_id&&x.referrer_respondent_id),'Оберіть одне джерело рекомендації');
  if(x.referrer_person_id){fk('person',x.referrer_person_id);require(archive(x.respondent_id)===archive(x.referrer_person_id),'Особа іншого архіву');}
  if(x.referrer_respondent_id){fk('potential_respondent',x.referrer_respondent_id);require(by('potential_respondent',x.respondent_id).research_id===by('potential_respondent',x.referrer_respondent_id).research_id,'Рекомендація іншого дослідження');}
 }
 const visit=(id,path)=>{require(!path.has(id),'Цикл рекомендацій');const next=new Set(path).add(id);for(const r of t.respondent_referral.filter(x=>x.respondent_id===id&&x.referrer_respondent_id))visit(r.referrer_respondent_id,next);};
 for(const x of t.potential_respondent)visit(x.id,new Set());
 for(const x of t.workflow_object||[]){fk('workflow_run',x.workflow_run_id);fk('entity',x.entity_id);if(x.revision_id)require(by('entity_revision',x.revision_id)?.entity_id===x.entity_id,'Версія іншого об’єкта процесу');}
}
export async function contactCommand(s,actor,c,{need,fail,lookup,fresh,required,newEntity,revise,reg,arch,fieldCommand}){
 const t=s.tables,by=(table,id)=>t[table].find(x=>x.id===id),r=by('field_research',c.research_id);
 need('contacts.write',c.research_id);if(!r)fail('forbidden','Дослідження недоступне.');
 let row=c.id?lookup(c.id,'contacts.write'):null;
 if(row){if(reg(row.id).entity_type!=='potential_respondent'||row.research_id!==r.id)fail('forbidden','Контакт недоступний.');fresh(row.id,c.expected_revision_id);}
 else if(c.type!=='field.contact')fail('invalid','Оберіть контакт.');
 const link=(id,type)=>{need('domain.read',arch(r.id));if(reg(id)?.entity_type!==type||arch(id)!==arch(r.id))fail('invalid','Оберіть запис цього архіву.');return by(type,id);};
 if(c.type==='field.contact'){
  if(!row)row=await newEntity('potential_respondent',{research_id:r.id,work_group_id:null,place_id:null,display_hint:required(c.display_hint),potential_topics:null,planned_meeting_at:null,state:'planned',confirmed_person_id:null,retention_until:null},arch(r.id));
  for(const key of ['display_hint','potential_topics','state','retention_until','work_group_id','place_id','confirmed_person_id'])if(c[key]!==undefined)row[key]=typeof c[key]==='string'?c[key].trim()||null:c[key];
  required(row.display_hint);
  if(row.place_id)link(row.place_id,'place');
  if(row.confirmed_person_id)link(row.confirmed_person_id,'person');
  if(row.work_group_id){const g=link(row.work_group_id,'work_group');if(g.research_id!==r.id||reg(g.id).retired_at)fail('invalid','Оберіть чинну групу цього дослідження.');}
  if(c.planned_meeting_at!==undefined){
   const value=c.planned_meeting_at?.trim();if(value&&!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)?$/.test(value))fail('invalid','Некоректний час зустрічі.');
   const normalized=value?new Date(value+(/[zZ]|[+-]\d\d:\d\d$/.test(value)?'':'Z')):null;
   if(value&&(!Number.isFinite(Date.parse(value.slice(0,10)))||new Date(value.slice(0,10)).toISOString().slice(0,10)!==value.slice(0,10)))fail('invalid','Некоректна дата зустрічі.');
   if(normalized&&!Number.isFinite(normalized.getTime()))fail('invalid','Некоректний час зустрічі.');row.planned_meeting_at=normalized?.toISOString()||null;
  }
  if(row.retention_until&&(!/^\d{4}-\d\d-\d\d$/.test(row.retention_until)||!Number.isFinite(Date.parse(row.retention_until))||new Date(row.retention_until).toISOString().slice(0,10)!==row.retention_until))fail('invalid','Некоректний строк зберігання.');
  // Communication details and working notes are deliberately excluded from immutable revisions/audit.
  for(const [key,kind]of [['contact_value','contact'],['working_note','working_note']])if(c[key]!==undefined){
   t.respondent_contact=t.respondent_contact.filter(x=>x.respondent_id!==row.id||!(x.contact_kind===kind||kind==='contact'&&x.contact_kind==='note'));
   if(c[key]?.trim())t.respondent_contact.push({respondent_id:row.id,contact_kind:kind,contact_value:c[key].trim(),retention_until:row.retention_until});
  }
  for(const x of t.respondent_contact.filter(x=>x.respondent_id===row.id))x.retention_until=row.retention_until;
  if(['declined','unreachable'].includes(row.state))row.planned_meeting_at=null;
 }else if(c.type==='field.contact.referral'){
  if(contactExpired(s,row))fail('invalid','Спочатку перегляньте строк зберігання контакту.');
  const rows=t.respondent_referral.filter(x=>x.respondent_id===row.id),old=c.index===undefined?null:rows[c.index];
  if(c.index!==undefined&&!old)fail('stale','Рекомендацію змінено.');
  if(c.remove){t.respondent_referral=t.respondent_referral.filter(x=>x!==old);}
  else{
   const x={respondent_id:row.id,referrer_person_id:c.referrer_person_id||null,referrer_respondent_id:c.referrer_respondent_id||null,referrer_note:c.referrer_note?.trim()||null};
   if(x.referrer_person_id)link(x.referrer_person_id,'person');
   if(x.referrer_respondent_id){const source=by('potential_respondent',x.referrer_respondent_id);if(!source||source.research_id!==r.id||contactExpired(s,source))fail('invalid','Оберіть чинний контакт цього дослідження.');}
   if(!x.referrer_person_id&&!x.referrer_respondent_id&&!x.referrer_note)fail('invalid','Зазначте, хто порадив респондента.');
   if(rows.some(v=>v!==old&&v.referrer_person_id===x.referrer_person_id&&v.referrer_respondent_id===x.referrer_respondent_id&&v.referrer_note===x.referrer_note))fail('invalid','Така рекомендація вже є.');
   if(old)Object.assign(old,x);else t.respondent_referral.push(x);
  }
 }else if(c.type==='field.contact.clear'){
  t.respondent_contact=t.respondent_contact.filter(x=>x.respondent_id!==row.id);
  t.respondent_referral=t.respondent_referral.filter(x=>x.respondent_id!==row.id);
 }else if(c.type==='field.contact.session'){
  need('field.write',arch(r.id));fresh(r.id,c.research_revision_id);
  if(!['contacted','confirmed'].includes(row.state)||contactExpired(s,row))fail('invalid','Спочатку підтвердьте контакт і перегляньте строк зберігання.');
  if(contactSession(s,row.id))fail('invalid','Сеанс для цього контакту вже створено. Відкрийте його зі списку.');
  if(c.identity_confirmed!==true)fail('invalid','Підтвердьте особу учасника перед створенням сеансу.');
  if(c.date_from&&(!/^\d{4}-\d\d-\d\d$/.test(c.date_from)||!Number.isFinite(Date.parse(c.date_from))||new Date(c.date_from).toISOString().slice(0,10)!==c.date_from))fail('invalid','Некоректна дата сеансу.');
  const person=c.person_id?link(c.person_id,'person'):await newEntity('person',{preferred_name:required(c.person_name),name_note:null},arch(r.id));
  const session=await fieldCommand({type:'field.session.create',research_id:r.id,expected_revision_id:c.research_revision_id,title:required(c.title),work_group_id:row.work_group_id,person_id:person.id,role_code:'performer',date_from:c.date_from||null,date_to:c.date_from||null,date_precision:c.date_from?'exact':'unknown',location_description:c.location_description||null});
  if(row.place_id&&c.place_confirmed===true){await newEntity('geographic_context',{subject_entity_id:session.id,place_id:row.place_id,role_code:'recording_place',source_label:by('place',row.place_id).name,region_term_id:null,dialect_term_id:null,dialect_label_raw:null,evidence_id:null},arch(r.id));await revise(session,'Підтверджено місце сеансу');}
  row.confirmed_person_id=person.id;await revise(row,'Особу пов’язано з розпочатим сеансом');
  const run={id:crypto.randomUUID(),workflow_code:'WF-03',primary_entity_id:session.id,started_by:actor,started_at:s.clock,finished_at:null,state:'in_progress',notes:null};t.workflow_run.push(run);t.workflow_object??=[];
  for(const [id,role]of [[row.id,'input'],[r.id,'context'],[session.id,'output']])t.workflow_object.push({workflow_run_id:run.id,entity_id:id,revision_id:reg(id).current_revision_id,role});
  return {id:session.id};
 }else fail('invalid','Невідома дія контакту.');
 await revise(row,c.type==='field.contact.clear'?'Очищено способи зв’язку, нотатки та рекомендації':'Оновлено робочий контакт');return {id:row.id};
}
