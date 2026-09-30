import {sessionCommand,validateSession} from './session.mjs?v=20260930-wf04';
import {contactCommand,validateContacts} from './contacts.mjs?v=20260930-wf04';
import {preparationCommand,preparationKinds,preparationStatus} from './preparation.mjs?v=20260930-wf04';
// Domain operations for the fieldwork and archive prototype. No backend persistence.
import {mediaRelations} from './media.mjs?v=20260930-wf04';
import {researchRelations} from './research.mjs?v=20260930-wf04';
import {publicRelations} from './public.mjs?v=20260930-wf04';
import {museumRelations} from './museum.mjs?v=20260930-wf04';
import {workbenchRelations} from './workbench.mjs?v=20260930-wf04';
export const fieldTypes=['field_research','work_group','participation','collecting_session','geographic_context','potential_respondent','document','information_unit','archive_node','place','institution','timed_layer'];
const fields={
 field_research:['title','purpose','research_questions','date_from','date_to','preparation_notes','backup_plan'],
 collecting_session:['title','date_from','date_to','date_label','date_precision','recording_context','location_environment','location_description','context_notes','processing_notes'],
 document:['title','body_text','language_tag'],
 information_unit:['title','incipit','summary','performance_mode','dialect_label_raw'],
 person:['preferred_name','name_note'],place:['name','latitude','longitude','coordinate_note'],institution:['name','short_name','institution_type','website_uri'],
 archive_node:['title','reference_code'],potential_respondent:['display_hint','potential_topics','planned_meeting_at','state','retention_until','confirmed_person_id'],work_group:['name','notes']
};
export function relations(t,type,id){
 const keys={field_research:[['research_route_stop','research_id'],['research_preparation_item','research_id']],collecting_session:[['session_event','session_id']],document:[['document_context','document_id']],information_unit:[['unit_participant','unit_id']],person:[['person_name','person_id']],place:[['place_name','place_id']]};
 return {...Object.fromEntries((keys[type]||[]).map(([table,key])=>[table,structuredClone((t[table]||[]).filter(x=>x[key]===id))])),...(type==='timed_layer'?{timed_layer_entry:structuredClone((t.timed_layer_entry||[]).filter(x=>x.layer_revision_id===t.entity.find(e=>e.id===id)?.current_revision_id))}:{}),...mediaRelations(t,type,id),...researchRelations(t,type,id),...publicRelations(t,type,id),...museumRelations(t,type,id),...workbenchRelations(t,type,id)};
}
export function snapshot(t,type,row){const rel=relations(t,type,row.id);return {...structuredClone(row),...(Object.keys(rel).length?{_relations:rel}:{})};}
export function addMembers(t,type,id,revision){
 if(type==='field_research'){
  const ids=[...t.work_group.filter(x=>x.research_id===id).map(x=>x.id),...t.participation.filter(x=>x.research_id===id).map(x=>x.id),...t.research_preparation_item.filter(x=>x.research_id===id&&x.related_entity_id).map(x=>x.related_entity_id)];
  for(const member of new Set(ids))t.entity_revision_member.push({aggregate_revision_id:revision,member_entity_id:member,member_revision_id:t.entity.find(x=>x.id===member).current_revision_id,relation_role:'preparation',position:null});
  return;
 }
 if(type!=='collecting_session')return;
 for(const [table,key] of [['participation','session_id'],['information_unit','session_id'],['geographic_context','subject_entity_id']])
  for(const row of t[table].filter(x=>x[key]===id))t.entity_revision_member.push({aggregate_revision_id:revision,member_entity_id:row.id,member_revision_id:t.entity.find(e=>e.id===row.id).current_revision_id,relation_role:table,position:row.position??null});
}
export function upgrade(saved,base){
 if(saved.version===base.version)return saved;
 if(![1,2,3,4,5,6,7,8].includes(saved.version)||base.version<=saved.version||base.version>9)throw new Error('Непідтримана версія збережених даних.');
 const out=structuredClone(saved),oldRoles=new Set(out.tables.access_role.map(x=>x.id)),oldEntities=new Set(out.tables.entity.map(x=>x.id));
 const oldIds=new Set(Object.values(out.tables).flatMap(rows=>rows.map(x=>x.id).filter(Boolean)));
 for(const [table,rows] of Object.entries(base.tables)){
  if(!(table in out.tables)){out.tables[table]=structuredClone(rows);continue;}
  const additions=rows.filter(x=>table==='entity'? !oldEntities.has(x.id):table==='entity_revision'? !oldEntities.has(x.entity_id):table==='entity_revision_member'? !saved.tables.entity_revision.some(r=>r.id===x.aggregate_revision_id):['role_assignment','role_permission'].includes(table)? !oldRoles.has(x.role_id):x.id?!out.tables[table].some(y=>y.id===x.id):Object.entries(x).some(([key,id])=>key.endsWith('_id')&&id&&!oldIds.has(id)));
  out.tables[table].push(...structuredClone(additions));
 }
 out.demo={...structuredClone(base.demo),external_configuration:{...base.demo.external_configuration,...saved.demo.external_configuration},file_contents:{...base.demo.file_contents,...saved.demo.file_contents}};out.version=base.version;return out;
}
export function validateField(s,require,fk,canonical){
 const t=s.tables;if(!t.field_research)return;
 const by=(table,id)=>t[table].find(x=>x.id===id),archive=id=>by('entity',id)?.archive_id;
 const same=(a,b)=>require(archive(a)===archive(b),'Зв’язок з іншим архівом');
 const term=(id,code)=>{fk('vocabulary_term',id);require(by('vocabulary_scheme',by('vocabulary_term',id).scheme_id)?.d_code===code,'Термін з іншої схеми');};
 const ordered=(rows,key)=>{const seen=new Set();for(const x of rows){require(Number.isInteger(x.position)&&x.position>0,'Некоректний порядок');const k=x[key]+':'+x.position;require(!seen.has(k),'Повторений порядковий номер');seen.add(k);}};
 const programme=id=>{if(!id)return;fk('entity_revision',id);require(by('entity_revision',id).snapshot.kind==='research_programme','Потрібна версія програми');};
 for(const r of t.field_research){fk('archive',r.archive_id);require(r.archive_id===archive(r.id),'Архів дослідження');require(!!r.title?.trim(),'Потрібна назва');programme(r.programme_revision_id);if(r.date_from&&r.date_to)require(r.date_from<=r.date_to,'Кінець передує початку');}
 for(const g of t.work_group){fk('field_research',g.research_id);same(g.id,g.research_id);}
 for(const x of t.collecting_session){
  if(x.research_id){fk('field_research',x.research_id);same(x.id,x.research_id);}
  if(x.work_group_id)require(by('work_group',x.work_group_id)?.research_id===x.research_id,'Група іншого дослідження');
  programme(x.programme_revision_id);require(['exact','month','year','range','approximate','unknown'].includes(x.date_precision),'Точність дати');
  if(x.date_precision==='exact')require(!!x.date_from&&x.date_from===x.date_to,'Для точної дати вкажіть один день');
  if(x.date_from&&x.date_to)require(x.date_from<=x.date_to,'Кінець передує початку');
 }
 for(const x of t.participation){fk('person',x.person_id);require(!!x.session_id!==!!x.research_id,'Участь має один контекст');const id=x.session_id||x.research_id;fk(x.session_id?'collecting_session':'field_research',id);same(x.id,id);same(x.id,x.person_id);if(x.work_group_id)require(by('work_group',x.work_group_id)?.research_id===(x.research_id||by('collecting_session',x.session_id)?.research_id),'Група участі іншого дослідження');}
 for(const x of t.information_unit){fk('collecting_session',x.session_id);same(x.id,x.session_id);require(['recorded_work','fei'].includes(x.unit_kind),'Тип інформаційної одиниці');}
 ordered(t.information_unit,'session_id');ordered(t.research_route_stop,'research_id');ordered(t.session_event,'session_id');
 for(const x of t.research_route_stop){fk('field_research',x.research_id);fk('place',x.place_id);same(x.research_id,x.place_id);}
 for(const x of t.research_preparation_item){fk('field_research',x.research_id);require(['planned','ready','blocked','not_applicable'].includes(x.state),'Стан підготовки');require(preparationKinds.some(k=>k[0]===x.kind),'Тип підготовки');require(!!x.description?.trim(),'Опис підготовки');if(x.related_entity_id){fk('entity',x.related_entity_id);same(x.research_id,x.related_entity_id);}}
 for(const x of t.session_event){fk('collecting_session',x.session_id);if(x.participation_id)require(by('participation',x.participation_id)?.session_id===x.session_id,'Учасник іншого сеансу');}
 for(const x of t.geographic_context){fk('entity',x.subject_entity_id);fk('place',x.place_id);same(x.id,x.subject_entity_id);same(x.id,x.place_id);}
 for(const x of t.unit_participant){fk('information_unit',x.unit_id);fk('person',x.person_id);if(x.session_participation_id){const p=by('participation',x.session_participation_id);require(p?.session_id===by('information_unit',x.unit_id).session_id&&p.person_id===x.person_id,'Виконавець не відповідає участі в сеансі');}}
 for(const x of t.document_context){fk('document',x.document_id);fk('entity',x.target_entity_id);same(x.document_id,x.target_entity_id);if(x.target_revision_id)require(by('entity_revision',x.target_revision_id)?.entity_id===x.target_entity_id,'Чужа версія контексту');}
 for(const x of t.potential_respondent){fk('field_research',x.research_id);same(x.id,x.research_id);if(x.confirmed_person_id){fk('person',x.confirmed_person_id);same(x.id,x.confirmed_person_id);}}
 for(const table of ['respondent_contact','respondent_referral'])for(const x of t[table])fk('potential_respondent',x.respondent_id);
 validateContacts(s,require,fk);validateSession(s,require,fk);
 for(const x of t.place){if(x.place_type_term_id)term(x.place_type_term_id,'D15');require(x.latitude===null||Number.isFinite(x.latitude)&&Math.abs(x.latitude)<=90,'Широта');require(x.longitude===null||Number.isFinite(x.longitude)&&Math.abs(x.longitude)<=180,'Довгота');}
 for(const x of t.vocabulary_term){fk('vocabulary_scheme',x.scheme_id);if(x.parent_id)require(by('vocabulary_term',x.parent_id)?.scheme_id===x.scheme_id,'Батьківський термін іншої схеми');}
 for(const x of t.term_label)fk('vocabulary_term',x.term_id);
 for(const x of t.archive_node){term(x.node_type_term_id,'D14');require(t.archive_vocabulary_binding.some(b=>b.archive_id===x.archive_id&&b.scheme_id===by('vocabulary_term',x.node_type_term_id).scheme_id),'Тип вузла іншого архіву');if(x.parent_id)require(by('archive_node',x.parent_id)?.archive_id===x.archive_id,'Батьківський вузол іншого архіву');}
 for(const table of ['archive_node','vocabulary_term'])for(const x of t[table]){const seen=new Set([x.id]);let p=x.parent_id;while(p){require(!seen.has(p),'Цикл дерева');seen.add(p);p=by(table,p)?.parent_id;}}
 for(const x of t.archival_placement){fk('archive_node',x.archive_node_id);fk('entity',x.entity_id);same(x.archive_node_id,x.entity_id);}
 for(const e of t.entity){
  const row=by(e.entity_type,e.id),r=by('entity_revision',e.current_revision_id);
  if(r.snapshot._relations)require(canonical(r.snapshot._relations)===canonical(relations(t,e.entity_type,e.id)),'Склад поточної версії не збігається');
  if(e.entity_type==='collecting_session'){
   const actual=t.entity_revision_member.filter(m=>m.aggregate_revision_id===r.id);
   const expected=[];addMembers({...t,entity_revision_member:expected},e.entity_type,row.id,r.id);
   require(canonical(actual)===canonical(expected),'Версії складових сеансу не збігаються');
  }
 }
}
export async function fieldCommand(s,actor,c,{need,can,fail,revise,audit,hash}){
 const t=s.tables,by=(table,id)=>t[table].find(x=>x.id===id),reg=id=>by('entity',id),arch=id=>reg(id)?.archive_id;
 const lookup=(id,permission='field.write')=>{const e=reg(id);if(!e)fail('forbidden','Запис недоступний.');need(permission,e.entity_type==='potential_respondent'?by('potential_respondent',id).research_id:e.archive_id);return by(e.entity_type,id);};
 const fresh=(id,expected)=>{if(reg(id)?.current_revision_id!==expected)fail('stale','Запис змінено. Оновіть сторінку перед збереженням.');};
 const required=v=>{if(!v?.trim())fail('invalid','Заповніть назву.');return v.trim();};
 const newEntity=async(type,row,archive)=>{
  const id=crypto.randomUUID(),rid=crypto.randomUUID();row={id,...row};t[type].push(row);
  t.entity.push({id,entity_type:type,owner_installation_id:s.demo.ids.installation,archive_id:archive,owner_account_id:null,current_revision_id:rid,retired_at:null});
  const snap=snapshot(t,type,row);t.entity_revision.push({id:rid,entity_id:id,revision_no:1,previous_revision_id:null,snapshot:snap,snapshot_hash:await hash(snap),recorded_at:s.clock,actor_account_id:actor,process_run_id:null,change_reason:'Створено запис'});
  addMembers(t,type,id,rid);audit('record.create',id,null,rid,'Створено запис');return row;
 };
 const sessionFresh=id=>{lookup(id);fresh(id,c.session_revision_id);};
 const expectedTypes={'field.programme':['id','field_research'],'field.preparation':['id','field_research'],'field.route':['id','field_research'],'field.session.create':['research_id','field_research'],'field.notebook':['research_id','field_research']};
 if(expectedTypes[c.type]){const [key,kind]=expectedTypes[c.type];if(reg(c[key])?.entity_type!==kind)fail('invalid','Оберіть відповідний запис.');}
 if(c.type.startsWith('field.session.')&&c.type!=='field.session.create')return sessionCommand(s,actor,c,{lookup,fresh,required,newEntity,revise,fail,reg,arch,need,hash});
 if(c.type.startsWith('field.plan.'))return preparationCommand(s,actor,c,{lookup,fresh,required,newEntity,revise,fail,reg,arch});
 if(c.type==='field.save'){
  const e=reg(c.id),kind=e?.entity_type;
  if(!fields[kind])fail('invalid','Цей запис не підтримує редагування.');
  const permission=kind==='potential_respondent'?'contacts.write':['person','place','institution','archive_node'].includes(kind)?'catalog.write':'field.write';
  const row=lookup(c.id,permission);fresh(c.id,c.expected_revision_id);
  if(kind==='potential_respondent')fail('invalid','Редагуйте робочий контакт через список контактів.');
  if(kind==='document'&&row.kind==='session_form')fail('invalid','Сформуйте новий бланк із картки сеансу.');
  if(kind==='document'&&(row.kind==='research_programme'||t.document_context.some(x=>x.document_id===row.id&&['preparation','preparation_confirmation'].includes(x.context_role))))fail('invalid','Оновлюйте програму через дослідження.');
  if(kind==='information_unit')sessionFresh(row.session_id);
  for(const [key,value]of Object.entries(c.values||{})){if(!fields[kind].includes(key))fail('invalid','Поле не доступне для зміни.');row[key]=typeof value==='string'?value.trim()||null:value;}
  if('title'in row)required(row.title);if('name'in row)required(row.name);if(kind==='person')required(row.preferred_name);
  await revise(row,'Оновлено запис');
  if(kind==='work_group')await revise(lookup(row.research_id),'Уточнено робочу групу');
  if(kind==='information_unit')await revise(by('collecting_session',row.session_id),'Уточнено запис сеансу');
  return {id:row.id};
 }
 if(c.type==='field.research.create'){
  need('field.write',c.archive_id);
  const programme=c.programme?.trim()?await newEntity('document',{kind:'research_programme',title:'Програма: '+required(c.title),body_text:c.programme.trim(),language_tag:'uk',media_asset_id:null,physical_object_id:null},c.archive_id):null;
  const research=await newEntity('field_research',{archive_id:c.archive_id,title:required(c.title),purpose:c.purpose||null,research_questions:null,date_from:c.date_from||null,date_to:c.date_to||null,programme_revision_id:programme?reg(programme.id).current_revision_id:null,preparation_notes:null,backup_plan:c.backup_plan||null},c.archive_id);
  const role=t.access_role.find(x=>x.code==='contact-editor');if(role)t.role_assignment.push({account_id:actor,role_id:role.id,scope_entity_id:research.id,scope_kind:'research',installation_id:s.demo.ids.installation,valid_until:null});
  return research;
 }
 if(c.type==='field.programme'){
  const r=lookup(c.id);fresh(c.id,c.expected_revision_id);let doc=r.programme_revision_id?by('document',by('entity_revision',r.programme_revision_id).entity_id):null;
  if(doc){lookup(doc.id);fresh(doc.id,c.document_revision_id);doc.body_text=required(c.body_text);await revise(doc,'Оновлено програму дослідження');}
  else doc=await newEntity('document',{kind:'research_programme',title:'Програма: '+r.title,body_text:required(c.body_text),language_tag:'uk',media_asset_id:null,physical_object_id:null},arch(r.id));
  r.programme_revision_id=reg(doc.id).current_revision_id;await revise(r,'Обрано програму дослідження');return {id:r.id};
 }
 if(c.type==='field.preparation'||c.type==='field.route'){
  const r=lookup(c.id);fresh(c.id,c.expected_revision_id);
  if(c.type==='field.preparation'){
   const items=t.research_preparation_item.filter(x=>x.research_id===r.id);
   if(c.index!==undefined){const item=items[c.index];if(!item)fail('stale','Пункт не знайдено.');
    if(c.remove)t.research_preparation_item=t.research_preparation_item.filter(x=>x!==item);
    else{if(c.description!==undefined)item.description=required(c.description);if(c.state!==undefined)item.state=c.state;if(c.kind!==undefined)item.kind=c.kind;}
   }else t.research_preparation_item.push({research_id:r.id,kind:c.kind||'other',description:required(c.description),state:c.state||'planned',related_entity_id:null,work_item_id:null});
  }else{
   const stops=t.research_route_stop.filter(x=>x.research_id===r.id).sort((a,b)=>a.position-b.position);
   const place=async()=>{const p=c.place_id?lookup(c.place_id):await newEntity('place',{name:required(c.place_name),place_type_term_id:null,latitude:null,longitude:null,coordinate_note:null},arch(r.id));if(reg(p.id).entity_type!=='place'||arch(p.id)!==arch(r.id))fail('invalid','Оберіть місце цього архіву.');return p.id;};
   if(c.edit||c.remove){const stop=stops.find(x=>x.position===c.position);if(!stop)fail('stale','Місце не знайдено.');if(c.remove){t.research_route_stop=t.research_route_stop.filter(x=>x!==stop);stops.filter(x=>x!==stop).forEach((x,i)=>x.position=i+1);}else{stop.place_id=await place();stop.planned_at=c.planned_at||null;stop.notes=c.notes?.trim()||null;}}
   else if(c.place_id||c.place_name)t.research_route_stop.push({research_id:r.id,place_id:await place(),position:stops.length+1,planned_at:c.planned_at||null,notes:c.notes?.trim()||null});
   else {const i=stops.findIndex(x=>x.position===c.position),j=i+c.direction;if(![-1,1].includes(c.direction)||i<0||j<0||j>=stops.length)fail('invalid','Переміщення недоступне.');[stops[i].position,stops[j].position]=[stops[j].position,stops[i].position];}
   if(c.planned_at&&!Number.isFinite(Date.parse(c.planned_at)))fail('invalid','Некоректний час зупинки.');
  }
  await revise(r,'Оновлено підготовку дослідження');return {};
 }
 if(c.type==='field.session.create'){
  const r=lookup(c.research_id);if(c.expected_revision_id)fresh(r.id,c.expected_revision_id);
  if(c.work_group_id&&reg(c.work_group_id)?.retired_at)fail('invalid','Група завершила роботу.');
  if(c.require_prepared&&!preparationStatus(s,r.id).confirmed)fail('invalid','Спочатку підтвердьте готовність дослідження.');
  const session=await newEntity('collecting_session',{research_id:r.id,work_group_id:c.work_group_id||null,programme_revision_id:r.programme_revision_id,title:required(c.title),date_from:c.date_from||null,date_to:c.date_to||null,date_label:c.date_label||null,date_precision:c.date_precision||'unknown',started_at:null,ended_at:null,recording_context:null,location_environment:'unknown',location_description:c.location_description||null,context_notes:c.context_notes||null,processing_notes:null},arch(r.id));
  if(c.person_id){
   const person=lookup(c.person_id);if(reg(person.id).entity_type!=='person')fail('invalid','Оберіть особу.');
   if(!['performer','collector','observer'].includes(c.role_code))fail('invalid','Оберіть функцію.');
   await newEntity('participation',{person_id:person.id,research_id:null,session_id:session.id,work_group_id:session.work_group_id,role_code:c.role_code,function_text:null,position:1,local_label:null},arch(r.id));
   await revise(session,'Зафіксовано першого учасника');
  }
  return session;
 }
 if(c.type==='field.unit.create'||c.type==='field.participant'||c.type==='field.event'||c.type==='field.reorder'){
  const r=lookup(c.id);if(reg(r.id).entity_type!=='collecting_session')fail('invalid','Оберіть сеанс.');fresh(r.id,c.expected_revision_id);let result={};
  if(c.type==='field.unit.create')result=await newEntity('information_unit',{session_id:r.id,position:t.information_unit.filter(x=>x.session_id===r.id).length+1,unit_kind:c.unit_kind,title:required(c.title),incipit:null,summary:c.summary?.trim()||null,performance_mode:null,dialect_term_id:null,dialect_label_raw:null},arch(r.id));
  if(c.type==='field.participant'){
   const person=lookup(c.person_id);if(reg(person.id).entity_type!=='person')fail('invalid','Оберіть особу.');
   if(!['performer','collector','observer'].includes(c.role_code))fail('invalid','Оберіть функцію.');
   result=await newEntity('participation',{person_id:person.id,research_id:null,session_id:r.id,work_group_id:r.work_group_id,role_code:c.role_code,function_text:null,position:t.participation.filter(x=>x.session_id===r.id).length+1,local_label:null},arch(r.id));
  }
  if(c.type==='field.event')t.session_event.push({session_id:r.id,occurred_at:null,position:t.session_event.filter(x=>x.session_id===r.id).length+1,kind:'other',participation_id:null,note:required(c.note)});
  if(c.type==='field.reorder'){
   const units=t.information_unit.filter(x=>x.session_id===r.id).sort((a,b)=>a.position-b.position),i=units.findIndex(x=>x.id===c.unit_id),j=i+c.direction;
   if(![-1,1].includes(c.direction)||i<0||j<0||j>=units.length)fail('invalid','Переміщення недоступне.');
   [units[i].position,units[j].position]=[units[j].position,units[i].position];await revise(units[i],'Змінено порядок записів');await revise(units[j],'Змінено порядок записів');
  }
  await revise(r,'Оновлено склад сеансу');return result;
 }
 if(c.type==='field.notebook'){
  const r=lookup(c.research_id);let doc;
  if(c.id){doc=lookup(c.id);fresh(c.id,c.expected_revision_id);if(doc.kind!=='field_notebook')fail('invalid','Оберіть польовий зошит.');doc.title=required(c.title);doc.body_text=c.body_text;}
  else doc=await newEntity('document',{kind:'field_notebook',title:required(c.title),body_text:c.body_text,language_tag:'uk',media_asset_id:null,physical_object_id:null},arch(r.id));
  const sessions=[...new Set(c.session_ids||[])];for(const id of sessions){lookup(id);if(by('collecting_session',id)?.research_id!==r.id)fail('invalid','Сеанс іншого дослідження.');}
  const groupLinks=t.document_context.filter(x=>x.document_id===doc.id&&x.context_role==='work_group');
  t.document_context=t.document_context.filter(x=>x.document_id!==doc.id);t.document_context.push(...groupLinks);
  for(const [id,role]of [[r.id,'research'],...sessions.map(id=>[id,'session'])])t.document_context.push({document_id:doc.id,target_entity_id:id,context_role:role,target_revision_id:null});
  await revise(doc,'Оновлено польовий зошит');return {id:doc.id};
 }
 if(c.type==='field.contact'||c.type.startsWith('field.contact.'))return contactCommand(s,actor,c,{need,fail,lookup,fresh,required,newEntity,revise,reg,arch,fieldCommand:next=>fieldCommand(s,actor,next,{need,can,fail,revise,audit,hash})});
 if(c.type==='field.authority.create'){
  need('catalog.write',c.archive_id);const name=required(c.name),rows={person:{preferred_name:name,name_note:null},place:{name,place_type_term_id:null,latitude:null,longitude:null,coordinate_note:null},institution:{name,short_name:null,institution_type:null,website_uri:null}};
  if(!rows[c.kind])fail('invalid','Оберіть тип запису.');return newEntity(c.kind,rows[c.kind],c.archive_id);
 }
 if(c.type==='field.node.create'||c.type==='field.placement'){
  if(c.type==='field.node.create'){need('catalog.write',c.archive_id);const term=by('vocabulary_term',c.node_type_term_id);if(term?.status!=='active')fail('invalid','Оберіть чинний тип вузла.');return newEntity('archive_node',{archive_id:c.archive_id,parent_id:c.parent_id||null,node_type_term_id:term.id,reference_code:c.reference_code||null,title:required(c.title),position:t.archive_node.filter(x=>x.archive_id===c.archive_id&&x.parent_id===(c.parent_id||null)).length+1},c.archive_id);}
  lookup(c.id,'catalog.write');lookup(c.node_id,'catalog.write');
  if(c.expected_placement_hash&&await hash(t.archival_placement.filter(x=>x.entity_id===c.id&&x.placement_role==='primary'))!==c.expected_placement_hash)fail('stale','Розміщення змінилося. Оновіть сторінку.');
  t.archival_placement=t.archival_placement.filter(x=>!(x.entity_id===c.id&&x.placement_role==='primary'));t.archival_placement.push({archive_node_id:c.node_id,entity_id:c.id,placement_role:'primary',source_evidence_id:null});audit('placement.save',c.id,null,null,'Змінено місце в архіві');return {};
 }
 if(c.type==='field.term'){
  const scheme=by('vocabulary_scheme',c.scheme_id);need('vocabulary.write',c.archive_id);
  if(!scheme||scheme.governance_mode==='system')fail('forbidden','Системний довідник доступний лише для читання.');
  if(scheme.owner_archive_id&&scheme.owner_archive_id!==c.archive_id)fail('forbidden','Довідник іншого архіву.');
  let term=c.id?by('vocabulary_term',c.id):null;
  if(term&&term.scheme_id!==scheme.id)fail('invalid','Термін іншого схеми.');
  if(!term){term={id:crypto.randomUUID(),scheme_id:scheme.id,code:crypto.randomUUID(),parent_id:c.parent_id||null,definition:null,status:'active',source_label:null,source_reference:null,replaced_by_id:null};t.vocabulary_term.push(term);}
  term.definition=c.definition||null;term.parent_id=c.parent_id||null;term.status=c.status||'active';if(!['active','deprecated'].includes(term.status))fail('invalid','Стан терміна');
  t.term_label=t.term_label.filter(x=>!(x.term_id===term.id&&x.language_tag==='uk'&&x.kind==='preferred'));t.term_label.push({term_id:term.id,language_tag:'uk',kind:'preferred',label:required(c.label)});audit('vocabulary.save',null,null,null,'Оновлено термін');return {id:term.id};
 }
 fail('invalid','Невідома дія.');
}
