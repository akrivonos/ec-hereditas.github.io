// WF-01 uses the canonical preparation checklist, documents and contextual participation.
export const preparationKinds=[['equipment','Обладнання'],['carrier','Носії'],['consent_template','Бланки згод'],['recording_method','Способи фіксації'],['ethics','Організація та етика'],['reference','Джерела й попередні матеріали'],['other','Інше']];
export const preparationStates=[['planned','Заплановано'],['ready','Готово'],['blocked','Є перешкода'],['not_applicable','Не потрібно']];
export const preparationDefaults=[['equipment','Рекордер, мікрофони, живлення: виконати пробний запис'],['carrier','Перевірити вільне місце та запасні носії'],['consent_template','Підготувати бланк інформованої згоди'],['recording_method','Визначити нотатки, аудіо, відео та фото'],['ethics','Уточнити дозволи, порядок пояснення згоди та умови роботи'],['reference','Опрацювати літературу й попередні польові матеріали']];
export function preparationStatus(s,id){
 const t=s.tables,r=t.field_research.find(x=>x.id===id),items=t.research_preparation_item.filter(x=>x.research_id===id),groups=t.work_group.filter(x=>x.research_id===id&&!t.entity.find(e=>e.id===x.id)?.retired_at),members=t.participation.filter(x=>x.research_id===id),missing=[];
 if(!r)return {ready:false,missing:['Оберіть дослідження'],confirmed:false};
 if(!r.purpose?.trim()||!r.research_questions?.trim())missing.push('Уточніть мету й дослідницькі питання');
 if(!r.preparation_notes?.trim())missing.push('Опишіть територіальні й тематичні межі');
 if(!t.entity_revision.find(x=>x.id===r.programme_revision_id)?.snapshot.body_text?.trim())missing.push('Підготуйте програму');
 if(!t.research_route_stop.some(x=>x.research_id===id))missing.push('Додайте місця до маршруту');
 if(!groups.length||groups.some(g=>!members.some(m=>m.work_group_id===g.id&&m.function_text?.trim())))missing.push('Призначте учасників і функції кожної групи');
 if(members.some(m=>!m.function_text?.trim()))missing.push('Уточніть обов’язки всіх учасників');
 if(!r.backup_plan?.trim())missing.push('Опишіть резервне копіювання');
 for(const [kind,title] of preparationKinds.filter(x=>x[0]!=='other')){
  const rows=items.filter(x=>x.kind===kind);
  if(!rows.length||rows.some(x=>!['ready','not_applicable'].includes(x.state))||(['consent_template','recording_method'].includes(kind)&&!rows.some(x=>x.state==='ready')))missing.push('Завершіть: '+title.toLocaleLowerCase('uk'));
 }
 if(items.some(x=>x.kind==='other'&&!['ready','not_applicable'].includes(x.state)))missing.push('Завершіть додаткові пункти');
 const forms=items.filter(x=>x.kind==='consent_template'&&x.state==='ready');
 if(!forms.some(x=>t.document.some(d=>d.id===x.related_entity_id&&d.kind==='consent_template'&&d.body_text?.trim())))missing.push('Додайте текст підготовленого бланка згоди');
 const current=t.entity.find(x=>x.id===id)?.current_revision_id;
 const confirmation=t.document_context.findLast(x=>x.target_entity_id===id&&x.context_role==='preparation_confirmation'&&x.target_revision_id===current);
 return {ready:missing.length===0,missing,confirmed:missing.length===0&&!!confirmation,confirmation};
}
export async function preparationCommand(s,actor,c,{lookup,fresh,required,newEntity,revise,fail,reg,arch}){
 const t=s.tables,by=(table,id)=>t[table].find(x=>x.id===id),r=lookup(c.id);if(reg(r.id).entity_type!=='field_research')fail('invalid','Оберіть дослідження.');fresh(r.id,c.expected_revision_id);
 const linked=(id,type)=>{const row=lookup(id);if(reg(id).entity_type!==type||arch(id)!==arch(r.id))fail('invalid','Запис іншого типу або архіву.');return row;};
 if(c.type==='field.plan.defaults'){
  for(const [kind,description]of preparationDefaults)if(!t.research_preparation_item.some(x=>x.research_id===r.id&&x.kind===kind))t.research_preparation_item.push({research_id:r.id,kind,description,state:'planned',related_entity_id:null,work_item_id:null});
 }else if(c.type==='field.plan.group'){
  if(c.group_id){const g=linked(c.group_id,'work_group');if(g.research_id!==r.id||reg(g.id).retired_at)fail('invalid','Група недоступна.');
   if(c.remove){if(t.participation.some(x=>x.research_id===r.id&&x.work_group_id===g.id))fail('invalid','Спочатку завершіть участь або перенесіть учасників до іншої групи.');reg(g.id).retired_at=s.clock;}
   else{g.name=required(c.name);g.notes=c.notes?.trim()||null;await revise(g,'Уточнено робочу групу');}}

  else await newEntity('work_group',{research_id:r.id,name:required(c.name),notes:c.notes?.trim()||null},arch(r.id));
 }else if(c.type==='field.plan.member'){
  const g=linked(c.group_id,'work_group');if(g.research_id!==r.id||reg(g.id).retired_at)fail('invalid','Група недоступна.');
  let m=c.member_id?linked(c.member_id,'participation'):null;if(m&&(m.research_id!==r.id||m.session_id))fail('invalid','Участь іншого контексту.');
  if(c.remove){if(!m)fail('invalid','Оберіть учасника.');/* Retain identity/history and historical session links. */m.work_group_id=null;m.function_text='Участь у підготовці завершено';m.role_code='former_member';await revise(m,'Завершено участь у групі');}
  else{
   const p=c.person_id?linked(c.person_id,'person'):await newEntity('person',{preferred_name:required(c.person_name),name_note:null},arch(r.id));
   if(!['leader','collector','recordist','photographer','observer'].includes(c.role_code))fail('invalid','Оберіть функцію учасника.');
   const values={person_id:p.id,research_id:r.id,session_id:null,work_group_id:g.id,role_code:c.role_code,function_text:required(c.function_text),position:m?.position||t.participation.filter(x=>x.research_id===r.id).length+1,local_label:null};
   if(m){Object.assign(m,values);await revise(m,'Уточнено функції учасника');}else await newEntity('participation',values,arch(r.id));
  }
 }else if(c.type==='field.plan.document'){
  if(!['consent_template','reference'].includes(c.kind))fail('invalid','Оберіть бланк або джерело.');
  let d=c.document_id?linked(c.document_id,'document'):null;
  if(d){fresh(d.id,c.document_revision_id);if(!t.document_context.some(x=>x.document_id===d.id&&x.target_entity_id===r.id&&x.context_role==='preparation'))fail('invalid','Документ іншого контексту.');if(d.kind!==(c.kind==='reference'?'other':'consent_template'))fail('invalid','Інший тип документа.');d.title=required(c.title);d.body_text=required(c.body_text);await revise(d,'Оновлено підготовлений документ');}
  else{d=await newEntity('document',{kind:c.kind==='reference'?'other':'consent_template',title:required(c.title),body_text:required(c.body_text),language_tag:'uk',media_asset_id:null,physical_object_id:null},arch(r.id));t.document_context.push({document_id:d.id,target_entity_id:r.id,context_role:'preparation',target_revision_id:null});await revise(d,'Пов’язано з підготовкою дослідження');}
  let item=t.research_preparation_item.find(x=>x.research_id===r.id&&x.related_entity_id===d.id);
  if(item){item.description=d.title;item.state='planned';}else t.research_preparation_item.push({research_id:r.id,kind:c.kind,description:d.title,state:'planned',related_entity_id:d.id,work_item_id:null});
 }else if(c.type==='field.plan.confirm'){
  const status=preparationStatus(s,r.id);if(!status.ready)fail('invalid',status.missing.join('. '));if(status.confirmed)fail('invalid','Підготовку вже підтверджено.');
  const d=await newEntity('document',{kind:'other',title:'Перевірка готовності: '+r.title,body_text:required(c.note),language_tag:'uk',media_asset_id:null,physical_object_id:null},arch(r.id));
  t.document_context.push({document_id:d.id,target_entity_id:r.id,context_role:'preparation_confirmation',target_revision_id:reg(r.id).current_revision_id});await revise(d,'Зафіксовано підтвердження готовності');return {id:d.id};
 }else fail('invalid','Невідома дія підготовки.');
 await revise(r,'Оновлено підготовку дослідження');return {id:r.id};
}
