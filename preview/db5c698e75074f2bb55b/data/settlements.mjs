const uuid=()=>crypto.randomUUID();
export const settlementTables=['place_administrative_state','place_administrative_level','place_identifier','regionalization_concept','regionalization_region'];
export function placeStates(t,id){return (t.place_administrative_state||[]).filter(x=>x.place_id===id).sort((a,b)=>Number(b.is_current)-Number(a.is_current)||(b.year_from??-9999)-(a.year_from??-9999));}
export function stateLevels(t,id){return (t.place_administrative_level||[]).filter(x=>x.state_id===id).sort((a,b)=>a.position-b.position);}
export function placeLabel(t,row){
 if(!row)return 'Не встановлено';const current=placeStates(t,row.id).find(x=>x.is_current);
 return current?[current.settlement_type+' '+current.name,...stateLevels(t,current.id).map(x=>x.level_type==='країна'?x.name:x.level_type+' '+x.name)].join(', '):row.name;
}
export function placeMatches(t,row,q){const needle=q.trim().toLocaleLowerCase('uk');return !needle||[placeLabel(t,row),...(t.place_name||[]).filter(x=>x.place_id===row.id).map(x=>x.name),...placeStates(t,row.id).flatMap(x=>[x.name,...stateLevels(t,x.id).map(l=>l.name)]),...(t.place_identifier||[]).filter(x=>x.place_id===row.id).map(x=>x.value)].join(' ').toLocaleLowerCase('uk').includes(needle);}
export function settlementRelations(t,type,id){
 if(type!=='place')return {};const result={};
 for(const key of ['place_administrative_state','place_identifier','place_region']){const rows=(t[key]||[]).filter(x=>x.place_id===id);if(rows.length)result[key]=structuredClone(rows);}
 const states=new Set(placeStates(t,id).map(x=>x.id));
 for(const key of ['place_administrative_level','place_relation']){const rows=(t[key]||[]).filter(x=>states.has(x.state_id));if(rows.length)result[key]=structuredClone(rows);}
 return result;
}
export function coordinates(pair,latitude,longitude){
 const empty=v=>v===undefined||v===null||String(v).trim()==='';
 if(!empty(pair)){const parts=String(pair).trim().split(/\s*,\s*/);if(parts.length!==2)throw Error('Вставте широту й довготу через кому.');[latitude,longitude]=parts;}
 if(empty(latitude)&&empty(longitude))return [null,null];
 if(empty(latitude)||empty(longitude))throw Error('Вкажіть обидві координати.');
 const lat=Number(latitude),lon=Number(longitude);
 if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180)throw Error('Широта: від −90 до 90; довгота: від −180 до 180.');
 return [lat,lon];
}
export async function settlementCommand(s,actor,c,{need,fail,fresh,newEntity,revise,arch}){
 const t=s.tables;for(const key of settlementTables)t[key]??=[];t.place_region??=[];t.place_relation??=[];
 const text=(v,label)=>{if(typeof v!=='string'||!v.trim())fail('invalid','Заповніть: '+label);return v.trim();};
 const year=v=>{if(v===''||v===null||v===undefined)return null;const n=Number(v);if(!Number.isInteger(n)||n<1||n>9999)fail('invalid','Рік має бути від 1 до 9999.');return n;};
 const range=(a,b)=>{if(a!==null&&b!==null&&a>b)fail('invalid','Початок періоду пізніший за завершення.');};
 let row=c.id&&t.place.find(x=>x.id===c.id);const archive=row?arch(row.id):c.archive_id;need('catalog.write',archive);
 if(c.id&&!row)fail('forbidden','Місце недоступне.');if(row)fresh(row.id,c.expected_revision_id);
 if(c.type==='field.place.create'){
  if(c.id)fail('invalid','Створення потребує нового запису.');
  row=await newEntity('place',{name:text(c.name,'назва'),place_type_term_id:null,latitude:null,longitude:null,coordinate_note:null,is_settlement:true,existence_status:'existing',disappearance_year:null},archive);
 }else if(!row)fail('invalid','Оберіть населений пункт.');
 if(c.type==='field.place.create'||c.type==='field.place.state'){
  const name=text(c.name,'назва'),type=text(c.settlement_type,'тип поселення'),source=text(c.source_reference,'джерело'),from=year(c.year_from),to=year(c.year_to);range(from,to);
  const current=c.type==='field.place.create'||c.is_current===true,states=placeStates(t,row.id),edit=c.state_id&&states.find(x=>x.id===c.state_id);
  if(c.state_id&&!edit)fail('invalid','Історичний опис іншого місця.');
  if(edit&&edit.is_current!==current)fail('invalid','Змінюйте актуальну належність окремою дією.');
  if(current&&to!==null)fail('invalid','Для актуального опису не вказуйте завершення.');
  const previous=states.find(x=>x.is_current&&x.id!==edit?.id);
  if(current&&previous&&from!==null&&previous.year_from!==null&&from<=previous.year_from)fail('invalid','Нова актуальна належність має починатися після попередньої.');
  if(from!==null&&to!==null&&states.some(x=>x.id!==edit?.id&&x.year_from!==null&&x.year_to!==null&&from<=x.year_to&&to>=x.year_from))fail('invalid','Період перетинається з іншим історичним описом.');
  const country=text(c.country,'країна'),levels=(c.levels||[]).filter(x=>x.name?.trim()||x.level_type?.trim()).map(x=>({level_type:text(x.level_type,'тип адміністративної одиниці'),name:text(x.name,'назва адміністративної одиниці')}));levels.push({level_type:'країна',name:country});
  if(levels.length>8)fail('invalid','Залиште не більше семи адміністративних рівнів перед країною.');
  if(new Set(levels.map(x=>x.level_type+'|'+x.name)).size!==levels.length)fail('invalid','Адміністративний рівень повторено.');
  const state={id:edit?.id||uuid(),place_id:row.id,name,settlement_type:type,is_current:current,year_from:from,year_to:to,period_note:c.period_note?.trim()||null,source_reference:source,source_locator:c.source_locator?.trim()||null};
  if(current)for(const x of states)x.is_current=false;
  if(edit)t.place_administrative_state=t.place_administrative_state.filter(x=>x.id!==edit.id);
  t.place_administrative_state.push(state);t.place_administrative_level=t.place_administrative_level.filter(x=>x.state_id!==state.id);t.place_relation=t.place_relation.filter(x=>x.state_id!==state.id);
  // Administrative nodes are internal stable references. Each state retains the
  // exact editorial name/type, so later descriptions cannot rewrite old chains.
  let parent=null;const nodes=[];
  for(const level of [...levels].reverse()){
   let node=t.place.find(x=>x.administrative_node&&x.name===level.name&&x.administrative_type===level.level_type&&x.administrative_parent_id===parent&&arch(x.id)===archive);
   if(!node)node=await newEntity('place',{name:level.name,place_type_term_id:null,latitude:null,longitude:null,coordinate_note:null,administrative_node:true,administrative_type:level.level_type,administrative_parent_id:parent},archive);
   nodes.unshift(node.id);parent=node.id;
  }
  levels.forEach((level,i)=>{t.place_administrative_level.push({id:uuid(),state_id:state.id,position:i+1,...level,place_id:nodes[i]});t.place_relation.push({child_place_id:i===0?row.id:nodes[i-1],parent_place_id:nodes[i],relation_kind:'administrative',state_id:state.id,year_from:from,year_to:to,evidence_id:null});});
  if(!t.place_name.some(x=>x.place_id===row.id&&x.name===name))t.place_name.push({place_id:row.id,name,language_tag:'uk',date_from:null,date_to:null,evidence_id:null,source_reference:source});
  row.is_settlement=true;row.existence_status??='existing';row.disappearance_year??=null;if(current)row.name=name;
 }else if(c.type==='field.place.coordinates'){
  let values;try{values=coordinates(c.coordinate_pair,c.latitude,c.longitude);}catch(e){fail('invalid',e.message);}
  [row.latitude,row.longitude]=values;row.coordinate_note=c.coordinate_note?.trim()||null;
  if(row.latitude!==null&&!row.coordinate_note)fail('invalid','Зазначте джерело координат.');
 }else if(c.type==='field.place.status'){
  if(!['existing','disappeared','unknown'].includes(c.existence_status))fail('invalid','Оберіть стан поселення.');
  row.existence_status=c.existence_status;row.disappearance_year=c.existence_status==='disappeared'?year(c.disappearance_year):null;
  row.status_source=text(c.source_reference,'джерело відомостей про стан');
 }else if(c.type==='field.place.identifier'){
  const system=text(c.system,'класифікатор'),value=text(c.value,'код'),source=text(c.source_reference,'джерело та версія');
  if(!['KATOTTG','KOATUU','other'].includes(system))fail('invalid','Невідомий класифікатор.');
  if(system==='KATOTTG'&&!/^UA[0-9]{17}$/.test(value)||system==='KOATUU'&&!/^[0-9]{10}$/.test(value))fail('invalid','Перевірте формат коду класифікатора.');
  if(t.place_identifier.some(x=>x.system===system&&x.value===value&&arch(x.place_id)===archive))fail('invalid','Цей код уже прив’язано. Перевірте наявний запис.');
  const from=year(c.year_from),to=year(c.year_to);range(from,to);
  t.place_identifier.push({id:uuid(),place_id:row.id,system,value,year_from:from,year_to:to,source_reference:source});
 }else if(c.type==='field.place.region'){
  let concept=c.concept_id&&t.regionalization_concept.find(x=>x.id===c.concept_id&&x.archive_id===archive);
  if(c.concept_id&&!concept)fail('invalid','Концепція недоступна.');
  if(!concept){
   concept={id:uuid(),archive_id:archive,name:text(c.concept_name,'назва концепції'),author:text(c.concept_author,'автор концепції'),classification_type:text(c.classification_type,'тип районування'),source_work:text(c.source_work,'бібліографічний опис')};
   const names=[...new Set(String(c.region_names||'').split('\n').map(x=>x.trim()).filter(Boolean))];if(!names.length)fail('invalid','Додайте райони концепції.');
   t.regionalization_concept.push(concept);for(const name of names)t.regionalization_region.push({id:uuid(),concept_id:concept.id,name});
  }
  const region=c.region_id?t.regionalization_region.find(x=>x.id===c.region_id&&x.concept_id===concept.id):t.regionalization_region.find(x=>x.concept_id===concept.id&&x.name===c.region_name?.trim());
  if(!region)fail('invalid','Оберіть район цієї концепції.');
  if(t.place_region.some(x=>x.place_id===row.id&&x.region_id===region.id))fail('invalid','Цей район уже додано.');
  t.place_region.push({id:uuid(),place_id:row.id,region_id:region.id,region_term_id:null,concept_id:concept.id,region_name:region.name,concept_name:concept.name,concept_author:concept.author,classification_type:concept.classification_type,source_work:concept.source_work,source_label:c.source_locator?.trim()||null,evidence_id:null});
 }else fail('invalid','Невідома дія з населеним пунктом.');
 await revise(row,'Оновлено відомості про населений пункт');return {id:row.id};
}
export function validateSettlements(s,ok,fk){
 const t=s.tables,by=(table,id)=>(t[table]||[]).find(x=>x.id===id),arch=id=>by('entity',id)?.archive_id;
 for(const row of t.place){
  ok((row.latitude===null)===(row.longitude===null),'Координати мають бути парою');
  if(row.is_settlement)ok(['existing','disappeared','unknown'].includes(row.existence_status),'Стан поселення');
 }
 for(const state of t.place_administrative_state||[]){
  fk('place',state.place_id);ok(!!state.source_reference&&!!state.name&&!!state.settlement_type,'Опис і джерело місця');
  ok(state.year_from===null||state.year_to===null||state.year_from<=state.year_to,'Період місця');
  const levels=stateLevels(t,state.id);ok(levels.length>0&&levels.at(-1).level_type==='країна','Країна в адміністративному описі');
  ok(new Set(levels.map(x=>x.position)).size===levels.length,'Порядок рівнів');
  const seen=new Set([state.place_id]);for(const level of levels){fk('place',level.place_id);ok(arch(state.place_id)===arch(level.place_id),'Адміністративний рівень іншого архіву');ok(!seen.has(level.place_id),'Цикл адміністративної належності');seen.add(level.place_id);}
 }
 for(const row of t.place.filter(x=>x.is_settlement)){const states=placeStates(t,row.id);if(states.length){ok(states.filter(x=>x.is_current).length===1,'Потрібна одна актуальна або остання відома належність');const current=states.find(x=>x.is_current);ok(current.name===row.name,'Назва не відповідає актуальному опису');ok(row.disappearance_year==null||current.year_from===null||row.disappearance_year>=current.year_from,'Рік зникнення раніший за останню відому належність');}}
 for(const row of t.place_identifier||[]){fk('place',row.place_id);ok(!!row.source_reference,'Джерело коду');}
 for(const geo of t.geographic_context){if(geo.administrative_state_id)ok(by('place_administrative_state',geo.administrative_state_id)?.place_id===geo.place_id,'Історична належність іншого місця');}
 for(const region of t.regionalization_region||[])fk('regionalization_concept',region.concept_id);
 for(const assignment of (t.place_region||[]).filter(x=>x.region_id)){fk('place',assignment.place_id);fk('regionalization_region',assignment.region_id);ok(by('regionalization_region',assignment.region_id).concept_id===assignment.concept_id,'Район іншої концепції');ok(by('regionalization_concept',assignment.concept_id).archive_id===arch(assignment.place_id),'Концепція іншого архіву');}
}
