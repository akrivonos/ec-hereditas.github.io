// Private research objects reference exact archival revisions. Access is checked on every projection.
import {can} from './model.mjs?v=20260930-wf04';
import {rawHash} from './media.mjs?v=20260930-wf04';
export const researchTypes=['saved_query','research_corpus','annotation','assertion','citation','bibliographic_export'];
export const sourceTypes=['information_unit','document','physical_object'];
export const researchEnabled=(s,a)=>s.tables.archive.some(x=>can(s,a,'research.write',x.id));
export const owns=(s,a,id)=>researchEnabled(s,a)&&s.tables.entity.some(e=>e.id===id&&e.owner_account_id===a);
export function sourceView(s,a,id,rid=null){
 const t=s.tables,e=t.entity.find(x=>x.id===id);
 if(!e||e.retired_at||!sourceTypes.includes(e.entity_type)||!can(s,a,'domain.read',e.archive_id))return null;
 const r=t.entity_revision.find(x=>x.id===(rid||e.current_revision_id)&&x.entity_id===id);
 if(!r)return null;
 // Only the reader projection is returned, never contact fields or arbitrary snapshots.
 const v=r.snapshot;return {id,revision_id:r.id,revision_no:r.revision_no,type:e.entity_type,archive_id:e.archive_id,title:v.title,
  text:v.summary||v.body_text||v.inscriptions||v.incipit||'',reference:v.reference_code||null};
}
export function searchSources(s,a,{q='',kind='',archive_id=null}={}){
 return s.tables.entity.filter(e=>sourceTypes.includes(e.entity_type)).map(e=>sourceView(s,a,e.id)).filter(Boolean)
  .filter(x=>(!archive_id||x.archive_id===archive_id)&&(!kind||x.type===kind)&&[x.title,x.text,x.reference].join(' ').toLocaleLowerCase('uk').includes(q.trim().toLocaleLowerCase('uk')));
}
export const corpusItems=(s,rid)=>s.tables.corpus_item.filter(x=>x.corpus_revision_id===rid).sort((a,b)=>a.position-b.position);
export const researchRelations=(t,type,id)=>type==='research_corpus'?{corpus_item:structuredClone(t.corpus_item.filter(x=>x.corpus_revision_id===t.entity.find(e=>e.id===id)?.current_revision_id))}:{};
export function researchVisible(s,a,row,type){
 if(!owns(s,a,row.id))return false;
 if(type==='annotation'||type==='citation')return !!sourceView(s,a,row.target_entity_id,row.target_revision_id);
 if(type==='assertion')return !!sourceView(s,a,row.subject_entity_id)&&s.tables.evidence_link.filter(x=>x.subject_entity_id===row.id).every(x=>{
  const e=s.tables.evidence.find(e=>e.id===x.evidence_id);return e&&!!sourceView(s,a,e.source_entity_id,e.source_revision_id);
 });
 if(type==='candidate')return !!sourceView(s,a,row.target_entity_id,row.base_revision_id)&&s.tables.candidate_source.filter(x=>x.candidate_id===row.id).every(x=>{
  const e=s.tables.entity.find(e=>e.id===x.source_entity_id),v=e&&s.tables[e.entity_type].find(v=>v.id===e.id);
  return v&&researchVisible(s,a,v,e.entity_type);
 });
 if(type==='bibliographic_export')return s.tables.export_citation.filter(x=>x.export_id===row.id).every(x=>{
  const r=s.tables.entity_revision.find(r=>r.id===x.citation_revision_id);return r&&researchVisible(s,a,r.snapshot,'citation');
 });
 return true;
}
export function exportDownload(s,a,id){
 const e=s.tables.bibliographic_export.find(x=>x.id===id);
 if(!e||!researchVisible(s,a,e,'bibliographic_export'))return null;
 const f=s.tables.file_object.find(x=>x.id===e.file_id);return {filename:f.original_filename,mime:f.mime_type,content:s.demo.file_contents[f.id]};
}
export function validateResearch(s,require,fk,canonical){
 const t=s.tables;if(!t.research_corpus)return;
 const by=(table,id)=>t[table].find(x=>x.id===id),reg=id=>by('entity',id);
 const exact=(id,rid)=>require(by('entity_revision',rid)?.entity_id===id,'Чужа версія дослідницького джерела');
 for(const type of researchTypes)for(const x of t[type]){fk('account',reg(x.id).owner_account_id);require(reg(x.id).archive_id===null,'Приватна дослідницька область');}
 for(const x of t.saved_query){require(x.owner_account_id===reg(x.id).owner_account_id&&!!x.name.trim(),'Власник або назва запиту');require(x.query_schema_version==='1'&&x.index_profile_version==='local-reader-1','Профіль пошуку');}
 for(const x of t.research_corpus){require(x.owner_account_id===reg(x.id).owner_account_id&&!!x.title.trim()&&!!x.inclusion_criteria.trim(),'Назва, власник і критерії корпусу');if(x.saved_query_revision_id){const r=by('entity_revision',x.saved_query_revision_id);require(reg(r?.entity_id)?.entity_type==='saved_query'&&reg(r.entity_id).owner_account_id===x.owner_account_id,'Запит іншого власника');}}
 const positions=new Set();for(const x of t.corpus_item){require(reg(by('entity_revision',x.corpus_revision_id)?.entity_id)?.entity_type==='research_corpus','Потрібна версія корпусу');exact(x.target_entity_id,x.target_revision_id);require(sourceTypes.includes(reg(x.target_entity_id)?.entity_type),'Тип джерела корпусу');const key=x.corpus_revision_id+':'+x.position;require(Number.isInteger(x.position)&&x.position>0&&!positions.has(key),'Порядок корпусу');positions.add(key);}
 for(const r of t.entity_revision.filter(r=>reg(r.entity_id)?.entity_type==='research_corpus'))require(canonical(r.snapshot._relations?.corpus_item)===canonical(t.corpus_item.filter(x=>x.corpus_revision_id===r.id)),'Змінено склад версії корпусу');
 for(const x of t.annotation){exact(x.target_entity_id,x.target_revision_id);fk('person',x.author_person_id);require(x.kind==='research'&&!!x.body.trim()&&x.range_start===null&&x.range_end===null&&x.text_part_id===null,'Дослідницька анотація');if(x.corpus_id)fk('research_corpus',x.corpus_id);}
 for(const x of t.assertion){fk('entity',x.subject_entity_id);require(x.scope==='research'&&x.assertion_kind==='research'&&x.acceptance_state==='draft'&&!!x.statement_text.trim(),'Дослідницьке твердження');if(x.corpus_id)fk('research_corpus',x.corpus_id);require(t.evidence_link.some(e=>e.subject_entity_id===x.id),'Потрібен доказ твердження');}
 for(const x of t.candidate_source){fk('candidate',x.candidate_id);exact(x.source_entity_id,x.source_revision_id);}
 for(const x of t.candidate.filter(x=>x.kind==='change_proposal'&&x.payload_schema_version!=='museum-proposal-1')){fk('account',x.proposed_by);require(x.proposed_by===reg(x.id).owner_account_id&&x.payload_schema_version==='research-proposal-1'&&typeof x.proposed_payload.description==='string'&&!!x.proposed_payload.description.trim(),'Пропозиція архіву');require(t.candidate_source.some(y=>y.candidate_id===x.id&&reg(y.source_entity_id)?.entity_type==='assertion'),'Підстава пропозиції');}
 for(const x of t.citation){exact(x.target_entity_id,x.target_revision_id);require(by('identifier',x.stable_identifier_id)?.entity_id===x.target_entity_id,'Ідентифікатор цитування');}
 const exports=new Set();for(const x of t.export_citation){fk('bibliographic_export',x.export_id);require(reg(by('entity_revision',x.citation_revision_id)?.entity_id)?.entity_type==='citation','Версія цитування');const key=x.export_id+':'+x.position;require(Number.isInteger(x.position)&&x.position>0&&!exports.has(key),'Порядок бібліографії');exports.add(key);}
 for(const x of t.bibliographic_export){fk('file_object',x.file_id);require(x.requested_by===reg(x.id).owner_account_id&&['text','csl_json'].includes(x.format),'Формат або власник експорту');require(t.export_citation.some(y=>y.export_id===x.id),'Порожній експорт');}
}
export async function researchCommand(s,actor,c,{fail,hash,audit,snapshot}){
 const t=s.tables,by=(table,id)=>t[table].find(x=>x.id===id),reg=id=>by('entity',id),rev=id=>reg(id)?.current_revision_id;
 if(!researchEnabled(s,actor))fail('forbidden','Дослідницька робота недоступна.');
 const text=v=>{if(typeof v!=='string'||!v.trim())fail('invalid','Заповніть обов’язкове поле.');return v.trim();};
 const own=(type,id)=>{const row=by(type,id);if(!row||!owns(s,actor,id))fail('forbidden','Запис недоступний.');return row;};
 const source=(id,rid)=>{const row=sourceView(s,actor,id,rid);if(!row)fail('forbidden','Джерело недоступне.');return row;};
 const fresh=id=>{if(c.expected_revision_id!==rev(id))fail('stale','Запис змінено. Оновіть сторінку перед збереженням.');};
 const append=async(type,row,items=null)=>{
  let e=reg(row.id),before=e?.current_revision_id||null;const rid=crypto.randomUUID();
  if(!e){row={id:crypto.randomUUID(),...row};t[type].push(row);e={id:row.id,entity_type:type,owner_installation_id:s.demo.ids.installation,archive_id:null,owner_account_id:actor,current_revision_id:rid,retired_at:null};t.entity.push(e);}else e.current_revision_id=rid;
  if(items)items.forEach((x,i)=>t.corpus_item.push({...x,corpus_revision_id:rid,position:i+1}));
  const snap=snapshot(t,type,row);t.entity_revision.push({id:rid,entity_id:row.id,revision_no:before?by('entity_revision',before).revision_no+1:1,previous_revision_id:before,snapshot:snap,snapshot_hash:await hash(snap),recorded_at:s.clock,actor_account_id:actor,process_run_id:null,change_reason:before?'Оновлено дослідницький запис':'Створено дослідницький запис'});
  audit(c.type,row.id,before,rid);return row;
 };
 const corpusContext=(id,src)=>{if(!id)return null;own('research_corpus',id);if(!t.corpus_item.some(x=>by('entity_revision',x.corpus_revision_id)?.entity_id===id&&x.target_entity_id===src.id&&x.target_revision_id===src.revision_id))fail('invalid','Джерело не входить до корпусу.');return id;};
 if(c.type==='research.query')return append('saved_query',{owner_account_id:actor,name:text(c.name),query_spec:{q:c.q?.trim()||'',kind:sourceTypes.includes(c.kind)?c.kind:'',archive_id:c.archive_id||null},query_schema_version:'1',index_profile_version:'local-reader-1',access_context:{account_id:actor},description:null});
 if(['research.corpus.create','research.corpus.revise','research.corpus.freeze'].includes(c.type)){
  const old=c.type==='research.corpus.create'?null:own('research_corpus',c.id);if(old)fresh(old.id);
  if(c.type==='research.corpus.freeze'&&old.frozen_at)fail('invalid','Склад уже зафіксовано.');
  let items;
  if(c.type==='research.corpus.freeze'){items=corpusItems(s,rev(old.id));if(!items.length)fail('invalid','Додайте джерела до корпусу.');items.forEach(x=>source(x.target_entity_id,x.target_revision_id));old.frozen_at=s.clock;return append('research_corpus',old,items);}
  if(!Array.isArray(c.items)||!c.items.length)fail('invalid','Оберіть хоча б одне джерело.');
  const seen=new Set();items=c.items.map(x=>{if(seen.has(x.target_entity_id))fail('invalid','Джерело вже додано.');seen.add(x.target_entity_id);const src=source(x.target_entity_id,x.target_revision_id);return {target_entity_id:src.id,target_revision_id:src.revision_id,group_label:x.group_label?.trim()||null,selection_reason:text(x.selection_reason),access_snapshot:{account_id:actor,checked_at:s.clock}};});
  let query=null;if(c.saved_query_id){own('saved_query',c.saved_query_id);query=rev(c.saved_query_id);}
  const values={owner_account_id:actor,title:text(c.title),research_question:c.research_question?.trim()||null,saved_query_revision_id:old?.saved_query_revision_id||query,inclusion_criteria:text(c.inclusion_criteria),exclusion_criteria:c.exclusion_criteria?.trim()||null,method_notes:c.method_notes?.trim()||null,frozen_at:null};
  return append('research_corpus',old?Object.assign(old,values):values,items);
 }
 if(['research.annotation','research.assertion','research.citation'].includes(c.type)){
  const src=source(c.target_entity_id,c.target_revision_id),corpus=corpusContext(c.corpus_id,src),person=by('account',actor).person_id;
  if(c.type==='research.annotation')return append('annotation',{kind:'research',target_entity_id:src.id,target_revision_id:src.revision_id,text_part_id:null,range_start:null,range_end:null,body:text(c.body),author_person_id:person,corpus_id:corpus});
  if(c.type==='research.assertion'){
   const row=await append('assertion',{subject_entity_id:src.id,assertion_kind:'research',scope:'research',corpus_id:corpus,statement_text:text(c.statement_text),acceptance_state:'draft',author_person_id:person,review_decision_id:null});
   const ev=await append('evidence',{source_entity_id:src.id,source_revision_id:src.revision_id,external_uri:null,locator:c.locator?.trim()||null,quote_text:null,note:text(c.note),captured_at:s.clock});
   t.evidence_link.push({subject_entity_id:row.id,subject_revision_id:rev(row.id),evidence_id:ev.id,evidence_role:'supports'});return row;
  }
  let identifier=t.identifier.find(x=>x.entity_id===src.id&&x.scheme==='urn'&&x.namespace==='hereditas');
  if(!identifier){identifier={id:crypto.randomUUID(),entity_id:src.id,scheme:'urn',namespace:'hereditas',value:'urn:hereditas:'+src.id,is_primary:false,source_evidence_id:null};t.identifier.push(identifier);}
  const rendered=`${src.title}. Версія ${src.revision_no}. ${identifier.value} (версія: ${src.revision_id}).`;
  return append('citation',{target_entity_id:src.id,target_revision_id:src.revision_id,stable_identifier_id:identifier.id,style_code:'hereditas-versioned-1',language_tag:'uk',rendered_text:rendered,structured_data:{id:identifier.value+'#'+src.revision_id,type:'manuscript',title:src.title,note:'Версія '+src.revision_no},generated_at:s.clock});
 }
 if(c.type==='research.proposal'){
  const a=own('assertion',c.id);fresh(a.id);if(!researchVisible(s,actor,a,'assertion'))fail('forbidden','Джерело недоступне.');
  if(t.candidate.some(x=>x.kind==='change_proposal'&&x.proposed_by===actor&&x.state==='pending'&&t.candidate_source.some(y=>y.candidate_id===x.id&&y.source_entity_id===a.id)))fail('invalid','Це твердження вже подано.');
  const ev=by('evidence',t.evidence_link.find(x=>x.subject_entity_id===a.id).evidence_id),src=source(a.subject_entity_id,ev.source_revision_id);
  const row=await append('candidate',{kind:'change_proposal',target_entity_id:src.id,base_revision_id:src.revision_id,proposed_payload:{description:text(c.description)},payload_schema_version:'research-proposal-1',proposed_entity_id:null,process_run_id:null,proposed_by:actor,confidence:null,state:'pending'});
  t.candidate_source.push({candidate_id:row.id,source_entity_id:a.id,source_revision_id:rev(a.id),source_role:'research_assertion'});return row;
 }
 if(c.type==='research.export'){
  if(!['text','csl_json'].includes(c.format)||!Array.isArray(c.citation_ids)||!c.citation_ids.length||new Set(c.citation_ids).size!==c.citation_ids.length)fail('invalid','Оберіть цитування та формат.');
  const rows=c.citation_ids.map(id=>{const x=own('citation',id);if(!researchVisible(s,actor,x,'citation'))fail('forbidden','Цитування недоступне.');return x;});
  const content=c.format==='text'?rows.map(x=>x.rendered_text).join('\n\n'):JSON.stringify(rows.map(x=>x.structured_data),null,2),mime=c.format==='text'?'text/plain':'application/json';
  const file=await append('file_object',{sha256:await rawHash(content),byte_size:new TextEncoder().encode(content).length,mime_type:mime,pronom_id:null,original_filename:'bibliography.'+(c.format==='text'?'txt':'json'),received_at:s.clock,technical_metadata:{}});s.demo.file_contents[file.id]=content;
  const row=await append('bibliographic_export',{requested_by:actor,context_entity_id:null,context_revision_id:null,format:c.format,file_id:file.id,generated_at:s.clock,export_profile_version:'1'});
  rows.forEach((x,i)=>t.export_citation.push({export_id:row.id,citation_revision_id:rev(x.id),position:i+1}));return row;
 }
 fail('invalid','Невідома дослідницька дія.');
}
