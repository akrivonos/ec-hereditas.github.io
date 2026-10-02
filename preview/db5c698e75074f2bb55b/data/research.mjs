import {feedbackCommand,feedbackReadable} from './feedback.mjs?v=20261002-feedback3';
import {deliveryCommand,datasetDownload,materialCitationView} from './delivery.mjs?v=20261002-feedback3';
import {analysisCommand,analysisCandidateVisible,assertionEvidence,evidenceView,analysisTerms} from './analysis.mjs?v=20261002-feedback3';
import {annotationView,validateAnnotation,readerTags,noteTypes} from './reader.mjs?v=20261002-feedback3';
import {relationPredicates} from './reconciliation.mjs?v=20261002-feedback3';
import {corpusTarget,corpusTypes,corpusAnchor,corpusKey} from './corpus.mjs?v=20261002-feedback3';
import {discoverySearch,discoverySpec} from './discovery.mjs?v=20261002-feedback3';
import {accessPolicy,projectFields,attributionNames} from './rights.mjs?v=20261002-feedback3';
// Private research objects reference exact archival revisions. Access is checked on every projection.
import {can} from './model.mjs?v=20261002-feedback3';
import {rawHash} from './media.mjs?v=20261002-feedback3';
export const researchTypes=['saved_query','research_corpus','annotation','assertion','citation','bibliographic_export'];
export const sourceTypes=['information_unit','document','physical_object'];
export const researchEnabled=(s,a)=>s.tables.archive.some(x=>can(s,a,'research.write',x.id));
export const owns=(s,a,id)=>researchEnabled(s,a)&&s.tables.entity.some(e=>e.id===id&&e.owner_account_id===a);
export function sourceView(s,a,id,rid=null,use='view'){
 const t=s.tables,e=t.entity.find(x=>x.id===id);
 if(!e||e.retired_at||!sourceTypes.includes(e.entity_type)||!can(s,a,'domain.read',e.archive_id))return null;
 const r=t.entity_revision.find(x=>x.id===(rid||e.current_revision_id)&&x.entity_id===id);
 if(!r)return null;const ds=accessPolicy(s,id,r.id,'research',use);if(!ds)return null;
 // Only the reader projection is returned, never contact fields or arbitrary snapshots.
 const v=r.snapshot,fields=projectFields(s,ds,{title:v.title,summary:v.summary||v.body_text||v.inscriptions||v.incipit||'',reference:v.reference_code||null,attribution:attributionNames(s,ds)});
 if(!fields.title)return null;
 return {id,revision_id:r.id,revision_no:r.revision_no,type:e.entity_type,archive_id:e.archive_id,title:fields.title,text:fields.summary||'',reference:fields.reference||null,attribution:fields.attribution||''};
}
export function searchSources(s,a,query={}){return discoverySearch(s,a,query);}
export const corpusItems=(s,rid)=>s.tables.corpus_item.filter(x=>x.corpus_revision_id===rid).sort((a,b)=>a.position-b.position);
export const researchRelations=(t,type,id)=>type==='assertion'&&t.assertion.find(x=>x.id===id)?.scope==='research'?{...((t.semantic_relation||[]).some(x=>x.assertion_id===id)?{semantic_relation:structuredClone(t.semantic_relation.filter(x=>x.assertion_id===id))}:{}),...(t.assertion.find(x=>x.id===id)?.evidence_profile==='analysis/1'?{evidence_link:structuredClone(t.evidence_link.filter(x=>x.subject_entity_id===id&&x.subject_revision_id===t.entity.find(e=>e.id===id)?.current_revision_id))}:{} )}:type==='research_corpus'?{corpus_item:structuredClone(t.corpus_item.filter(x=>x.corpus_revision_id===t.entity.find(e=>e.id===id)?.current_revision_id))}:{};
export function researchVisible(s,a,row,type){
 s={...s,clock:new Date().toISOString()};
 if(!owns(s,a,row.id))return false;
 if(type==='annotation')return !!annotationView(s,a,row);
 if(type==='citation'&&row.style_code==='research-material/1')return !!materialCitationView(s,a,row);
 if(type==='citation'){const v=sourceView(s,a,row.target_entity_id,row.target_revision_id,'cite');return !!v&&v.title===row.structured_data?.title;}
 if(type==='assertion')return row.scope==='research'&&(!row.annotation_revision_id||!!annotationView(s,a,s.tables.entity_revision.find(x=>x.id===row.annotation_revision_id)?.snapshot||{}))&&(!row.object_revision_id||!!sourceView(s,a,s.tables.semantic_relation.find(x=>x.assertion_id===row.id)?.object_entity_id,row.object_revision_id))&&!!sourceView(s,a,row.subject_entity_id,row.subject_revision_id)&&assertionEvidence(s,row).every(e=>!!evidenceView(s,a,e))&&(!row.analytical_terms?.length||row.analytical_terms.every(id=>analysisTerms(s,a,assertionEvidence(s,row).map(e=>evidenceView(s,a,e)).filter(Boolean)).some(x=>x.id===id)));
 if(type==='candidate'&&row.payload_schema_version==='research-feedback/1')return feedbackReadable(s,row);
 if(type==='candidate'&&row.payload_schema_version==='research-analysis/1')return analysisCandidateVisible(s,a,row);
 if(type==='candidate')return !!sourceView(s,a,row.target_entity_id,row.base_revision_id)&&s.tables.candidate_source.filter(x=>x.candidate_id===row.id).every(x=>{
  const e=s.tables.entity.find(e=>e.id===x.source_entity_id),v=e&&s.tables[e.entity_type].find(v=>v.id===e.id);
  return v&&researchVisible(s,a,v,e.entity_type);
 });
 if(type==='bibliographic_export')return s.tables.export_citation.filter(x=>x.export_id===row.id).every(x=>{
  const r=s.tables.entity_revision.find(r=>r.id===x.citation_revision_id);return r&&researchVisible(s,a,r.snapshot,'citation')&&!!sourceView(s,a,r.snapshot.source_entity_id||r.snapshot.target_entity_id,r.snapshot.source_revision_id||r.snapshot.target_revision_id,'download');
 });
 return true;
}
export function exportDownload(s,a,id){
 const h=s.tables.handover.find(x=>x.id===id&&x.profile==='research-dataset/1');if(h)return datasetDownload(s,a,h);
 const e=s.tables.bibliographic_export.find(x=>x.id===id);
 if(!e||!researchVisible(s,a,e,'bibliographic_export'))return null;
 const f=s.tables.file_object.find(x=>x.id===e.file_id);return {filename:f.original_filename,mime:f.mime_type,content:s.demo.file_contents[f.id]};
}
export function validateResearch(s,require,fk,canonical){
 const t=s.tables;if(!t.research_corpus)return;
 const by=(table,id)=>t[table].find(x=>x.id===id),reg=id=>by('entity',id);
 const exact=(id,rid)=>require(by('entity_revision',rid)?.entity_id===id,'Чужа версія дослідницького джерела');
 for(const type of researchTypes)for(const x of t[type].filter(x=>type!=='assertion'||x.scope==='research')){fk('account',reg(x.id).owner_account_id);require(reg(x.id).archive_id===null,'Приватна дослідницька область');}
 for(const x of t.saved_query){require(x.owner_account_id===reg(x.id).owner_account_id&&!!x.name.trim(),'Власник або назва запиту');require((x.query_schema_version==='1'&&x.index_profile_version==='local-reader-1'||x.query_schema_version==='2'&&x.index_profile_version==='local-discovery-2'),'Профіль пошуку');}
 for(const x of t.research_corpus){require(x.owner_account_id===reg(x.id).owner_account_id&&!!x.title.trim()&&!!x.inclusion_criteria.trim(),'Назва, власник і критерії корпусу');if(x.saved_query_revision_id){const r=by('entity_revision',x.saved_query_revision_id);require(reg(r?.entity_id)?.entity_type==='saved_query'&&reg(r.entity_id).owner_account_id===x.owner_account_id,'Запит іншого власника');}}
 const positions=new Set(),members=new Set();for(const x of t.corpus_item){
  require(reg(by('entity_revision',x.corpus_revision_id)?.entity_id)?.entity_type==='research_corpus','Потрібна версія корпусу');exact(x.target_entity_id,x.target_revision_id);
  const kind=reg(x.target_entity_id)?.entity_type,anchor=corpusAnchor(x);require(corpusTypes.includes(kind),'Тип джерела корпусу');exact(anchor.id,anchor.revision_id);require(sourceTypes.includes(reg(anchor.id)?.entity_type),'Архівне джерело корпусу');
  if(sourceTypes.includes(kind))require(anchor.id===x.target_entity_id&&anchor.revision_id===x.target_revision_id,'Джерело не відповідає елементу корпусу');
  if(x.layer_entity_id||x.layer_revision_id){exact(x.layer_entity_id,x.layer_revision_id);require(kind==='media_segment'&&reg(x.layer_entity_id)?.entity_type==='timed_layer'&&by('entity_revision',x.layer_revision_id).snapshot._relations?.timed_layer_entry?.some(e=>e.segment_revision_id===x.target_revision_id),'Фрагмент не входить до версії шару');}
  const key=x.corpus_revision_id+':'+x.position,member=x.corpus_revision_id+':'+corpusKey(x);require(Number.isInteger(x.position)&&x.position>0&&!positions.has(key),'Порядок корпусу');require(!members.has(member),'Повторений елемент корпусу');positions.add(key);members.add(member);
 }
 for(const r of t.entity_revision.filter(r=>reg(r.entity_id)?.entity_type==='research_corpus'))require(canonical(r.snapshot._relations?.corpus_item)===canonical(t.corpus_item.filter(x=>x.corpus_revision_id===r.id)),'Змінено склад версії корпусу');
 for(const x of t.annotation){validateAnnotation(s,x,require);fk('person',x.author_person_id);if(x.corpus_id)fk('research_corpus',x.corpus_id);}
 for(const x of t.assertion.filter(x=>x.scope==='research')){fk('entity',x.subject_entity_id);require(x.scope==='research'&&['research','relation'].includes(x.assertion_kind)&&x.acceptance_state==='draft'&&!!x.statement_text.trim(),'Дослідницьке твердження');if(x.corpus_id)fk('research_corpus',x.corpus_id);require(t.evidence_link.some(e=>e.subject_entity_id===x.id),'Потрібен доказ твердження');if(x.annotation_revision_id)require(reg(by('entity_revision',x.annotation_revision_id)?.entity_id)?.entity_type==='annotation','Версія нотатки');if(x.assertion_kind==='relation'){const rel=(t.semantic_relation||[]).filter(r=>r.assertion_id===x.id);require(rel.length===1&&x.subject_entity_id!==rel[0].object_entity_id,'Дослідницький зв’язок');exact(x.subject_entity_id,x.subject_revision_id);exact(rel[0].object_entity_id,x.object_revision_id);require(['related_to','variant_of'].includes(by('vocabulary_term',rel[0].relation_type_term_id)?.code),'Тип зв’язку');}}
 for(const r of t.entity_revision.filter(r=>r.snapshot.evidence_profile==='analysis/1'&&reg(r.entity_id)?.entity_type==='assertion')){
  const links=t.evidence_link.filter(x=>x.subject_entity_id===r.entity_id&&x.subject_revision_id===r.id);require(links.length>0&&canonical(links)===canonical(r.snapshot._relations?.evidence_link),'Змінено докази версії твердження');
  for(const l of links){const ev=by('evidence',l.evidence_id);require(!!ev&&['supports','contradicts','review'].includes(l.evidence_role)&&!!ev.locator?.trim()&&!!ev.note?.trim(),'Доказ висновку');exact(ev.source_entity_id,ev.source_revision_id);if(ev.target_entity_id)exact(ev.target_entity_id,ev.target_revision_id);if(ev.annotation_revision_id)require(reg(by('entity_revision',ev.annotation_revision_id)?.entity_id)?.entity_type==='annotation','Нотатка доказу');}
 }
 for(const x of t.candidate.filter(x=>x.payload_schema_version==='research-analysis/1')){require(x.kind==='assertion'&&reg(x.id).archive_id===null&&x.proposed_by===reg(x.id).owner_account_id,'Приватний кандидат аналізу');fk('process_run',x.process_run_id);exact(x.proposed_payload.corpus_id,x.proposed_payload.corpus_revision_id);require(t.candidate_source.some(y=>y.candidate_id===x.id),'Входи аналізу');}
 for(const x of t.candidate_source){fk('candidate',x.candidate_id);exact(x.source_entity_id,x.source_revision_id);}
 for(const x of t.candidate.filter(x=>x.kind==='change_proposal'&&!['museum-proposal-1','research-feedback/1'].includes(x.payload_schema_version))){fk('account',x.proposed_by);require(x.proposed_by===reg(x.id).owner_account_id&&x.payload_schema_version==='research-proposal-1'&&typeof x.proposed_payload.description==='string'&&!!x.proposed_payload.description.trim(),'Пропозиція архіву');require(t.candidate_source.some(y=>y.candidate_id===x.id&&reg(y.source_entity_id)?.entity_type==='assertion'),'Підстава пропозиції');}
 for(const x of t.candidate.filter(x=>x.payload_schema_version==='research-feedback/1')){const p=x.proposed_payload;require(x.kind==='change_proposal'&&reg(x.id).archive_id===null&&x.proposed_by===reg(x.id).owner_account_id&&['description','classification','relation'].includes(p.operation)&&!!p.rationale?.trim(),'Дослідницька пропозиція');exact(p.basis.id,p.basis.revision_id);require(reg(p.basis.id)?.entity_type==='assertion'&&p.basis.evidence.length>0&&t.candidate_source.some(y=>y.candidate_id===x.id&&y.source_revision_id===p.basis.revision_id),'Точна підстава пропозиції');for(const e of p.basis.evidence){exact(e.source.id,e.source.revision_id);fk('evidence',e.id);}if(p.operation==='classification')fk('vocabulary_term',p.term_id);if(p.operation==='relation')exact(p.object_entity_id,p.object_revision_id);if(p.replaces_id)fk('candidate',p.replaces_id);}
 for(const x of t.handover.filter(x=>x.profile==='research-dataset/1')){const v=x.selection;require(Array.isArray(v.positions)&&Array.isArray(v.results)&&v.positions.length+v.results.length>0,'Порожній пакет');if(v.corpus_id){exact(v.corpus_id,v.corpus_revision_id);require(reg(v.corpus_id)?.entity_type==='research_corpus','Основа пакета');}for(const r of v.results){exact(r.id,r.revision_id);require(['annotation','assertion'].includes(reg(r.id)?.entity_type),'Результат пакета');}}
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
 const corpusContext=(id,src)=>{if(!id)return null;own('research_corpus',id);if(!t.corpus_item.some(x=>by('entity_revision',x.corpus_revision_id)?.entity_id===id&&corpusAnchor(x).id===src.id&&corpusAnchor(x).revision_id===src.revision_id&&corpusTarget(s,actor,x)))fail('invalid','Джерело не входить до корпусу.');return id;};
 if(c.type==='research.feedback')return feedbackCommand(s,actor,c,{fail,append,text,own,fresh});
 if(['research.dataset','research.citation.material','research.citations'].includes(c.type))return deliveryCommand(s,actor,c,{fail,append,text,own,hash});
 if(c.type.startsWith('research.analysis.')||c.type==='research.assertion.revise')return analysisCommand(s,actor,c,{fail,append,fresh,own,text,hash,snapshot});
 if(c.type==='research.query')return append('saved_query',{owner_account_id:actor,name:text(c.name),query_spec:discoverySpec(c.spec||c),query_schema_version:'2',index_profile_version:'local-discovery-2',access_context:{account_id:actor},description:null});
 if(['research.corpus.create','research.corpus.revise','research.corpus.freeze'].includes(c.type)){
  const old=c.type==='research.corpus.create'?null:own('research_corpus',c.id);if(old)fresh(old.id);
  if(c.type==='research.corpus.freeze'&&old.frozen_at)fail('invalid','Склад уже зафіксовано.');
  let items;
  if(c.type==='research.corpus.freeze'){items=corpusItems(s,rev(old.id));if(!items.length)fail('invalid','Додайте джерела до корпусу.');items.forEach(x=>{if(!corpusTarget(s,actor,x))fail('forbidden','Елемент корпусу недоступний. Перегляньте склад перед фіксацією.');});old.frozen_at=s.clock;return append('research_corpus',old,items);}
  if(!Array.isArray(c.items)||!c.items.length)fail('invalid','Оберіть хоча б одне джерело.');
  const seen=new Set();items=c.items.map(x=>{
   const key=corpusKey(x);if(seen.has(key))fail('invalid','Цю версію елемента вже додано.');seen.add(key);
   const target=corpusTarget(s,actor,x);if(!target)fail('forbidden','Елемент або його точна версія недоступні.');
   return {target_entity_id:target.id,target_revision_id:target.revision_id,source_entity_id:target.source.id,source_revision_id:target.source.revision_id,...(target.type==='media_segment'&&x.layer_entity_id?{layer_entity_id:x.layer_entity_id,layer_revision_id:x.layer_revision_id}:{}),group_label:x.group_label?.trim()||null,selection_reason:x.selection_reason?.trim()||null,access_snapshot:{account_id:actor,checked_at:s.clock,decision_revisions:accessPolicy(s,target.source.id,target.source.revision_id,'research','view').map(d=>rev(d.id))}};
  });
  let query=null;if(c.saved_query_id){own('saved_query',c.saved_query_id);query=rev(c.saved_query_id);}
  const values={owner_account_id:actor,title:text(c.title),research_question:c.research_question?.trim()||null,saved_query_revision_id:old?.saved_query_revision_id||query,inclusion_criteria:text(c.inclusion_criteria),exclusion_criteria:c.exclusion_criteria?.trim()||null,method_notes:c.method_notes?.trim()||null,selection_context:old?.selection_context||{selected_at:s.clock,account_id:actor,query_spec:c.selection_spec?discoverySpec(c.selection_spec):query?structuredClone(by('entity_revision',query).snapshot.query_spec):null,profile:'corpus-1'},frozen_at:null};
  return append('research_corpus',old?Object.assign(old,values):values,items);
 }
 if(c.type==='research.segment.annotation'){
  const v=corpusTarget(s,actor,c);if(!v||v.type!=='representation'||!v.files.some(f=>/^(audio|video)\//.test(f.mime)))fail('forbidden','Оберіть доступне аудіо або відео.');
  const duration=by('entity_revision',v.revision_id).snapshot.duration_ms;if(!Number.isInteger(c.start_ms)||!Number.isInteger(c.end_ms)||c.start_ms<0||c.end_ms<=c.start_ms||duration==null||c.end_ms>duration)fail('invalid','Вкажіть інтервал у межах тривалості медіа.');
  const segment=await append('media_segment',{representation_id:v.id,representation_revision_id:v.revision_id,start_ms:c.start_ms,end_ms:c.end_ms,channel:null,scope:'research',source_entity_id:v.source.id,source_revision_id:v.source.revision_id});
  return researchCommand(s,actor,{...c,type:'research.annotation',target_entity_id:segment.id,target_revision_id:rev(segment.id),source_entity_id:v.source.id,source_revision_id:v.source.revision_id},{fail,hash,audit,snapshot});
 }
 if(['research.annotation','research.annotation.update'].includes(c.type)){
  const old=c.type.endsWith('.update')?own('annotation',c.id):null;if(old)fresh(old.id);
  const target=old||c,v=corpusTarget(s,actor,target);if(!v||['media_segment','representation'].includes(v.type)&&!v.files.length||old&&!annotationView(s,actor,old))fail('forbidden','Матеріал нотатки недоступний.');
  const corpus=corpusContext(old?.corpus_id||c.corpus_id,v.source),choices=readerTags(s,actor,v.source),tags=c.tags||[];
  if(!Array.isArray(tags)||tags.some(tag=>!choices.some(x=>x.id===tag.id&&x.kind===tag.kind)))fail('invalid','Позначка недоступна.');
  const row={...(old||{}),kind:v.type==='media_segment'?'segment':'research',target_entity_id:v.id,target_revision_id:v.revision_id,source_entity_id:v.source.id,source_revision_id:v.source.revision_id,layer_entity_id:target.layer_entity_id||null,layer_revision_id:target.layer_revision_id||null,text_part_id:old?.text_part_id||c.text_part_id||null,range_start:old?old.range_start:(c.range_start??null),range_end:old?old.range_end:(c.range_end??null),body:text(c.body),note_type:c.note_type||'note',tags:tags.map(x=>({id:x.id,kind:x.kind})),author_person_id:by('account',actor).person_id,corpus_id:corpus,corpus_revision_id:old?.corpus_revision_id||c.corpus_revision_id||null};
  validateAnnotation(s,row,(ok,message)=>{if(!ok)fail('invalid',message);});return append('annotation',old?Object.assign(old,row):row);
 }
 if(c.type==='research.relation'){
  if(!c.target_revision_id||!c.object_revision_id)fail('invalid','Оберіть точні версії обох джерел.');
  const src=source(c.target_entity_id,c.target_revision_id),other=source(c.object_entity_id,c.object_revision_id),predicate=c.predicate;
  if(!['related_to','variant_of'].includes(predicate)||src.id===other.id||src.archive_id!==other.archive_id||predicate==='variant_of'&&[src,other].some(v=>v.type!=='information_unit'||by('entity_revision',v.revision_id).snapshot.unit_kind!=='recorded_work'))fail('invalid','Цей зв’язок не відповідає обраним джерелам.');
  if(t.assertion.some(x=>x.scope==='research'&&owns(s,actor,x.id)&&x.subject_entity_id===src.id&&x.subject_revision_id===src.revision_id&&x.object_revision_id===other.revision_id&&(t.semantic_relation||[]).some(r=>r.assertion_id===x.id&&r.object_entity_id===other.id&&by('vocabulary_term',r.relation_type_term_id)?.code===predicate)))fail('invalid','Такий зв’язок уже збережено.');
  let scheme=t.vocabulary_scheme.find(x=>x.d_code==='D13');if(!scheme){scheme={id:crypto.randomUUID(),d_code:'D13',code:'relation_type',name:'Тип зв’язку',governance_mode:'system',owner_institution_id:null,owner_archive_id:null,readiness:['System'],status:'active'};t.vocabulary_scheme.push(scheme);}
  let term=t.vocabulary_term.find(x=>x.scheme_id===scheme.id&&x.code===predicate);if(term&&term.status!=='active')fail('invalid','Тип зв’язку більше не активний.');if(!term){term={id:crypto.randomUUID(),scheme_id:scheme.id,code:predicate,parent_id:null,definition:relationPredicates[predicate].label,status:'active',source_label:relationPredicates[predicate].label,source_reference:'Керований реєстр D13',replaced_by_id:null};t.vocabulary_term.push(term);t.term_label.push({term_id:term.id,language_tag:'uk',kind:'preferred',label:term.source_label});(t.relation_type_rule??=[]).push({term_id:term.id,is_symmetric:true,is_asymmetric:false,allow_self:false,inverse_term_id:null});for(const side of ['domain','range'])for(const entity_type of relationPredicates[predicate][side])(t.relation_type_endpoint??=[]).push({relation_type_id:term.id,side,entity_type});}
  const id=crypto.randomUUID();(t.semantic_relation??=[]).push({assertion_id:id,relation_type_term_id:term.id,object_entity_id:other.id});
  const row=await append('assertion',{id,subject_entity_id:src.id,subject_revision_id:src.revision_id,object_revision_id:other.revision_id,assertion_kind:'relation',scope:'research',corpus_id:corpusContext(c.corpus_id,src),statement_text:text(c.statement_text),acceptance_state:'draft',author_person_id:by('account',actor).person_id,review_decision_id:null});
  const ev=await append('evidence',{source_entity_id:src.id,source_revision_id:src.revision_id,external_uri:null,locator:c.locator?.trim()||null,quote_text:null,note:text(c.statement_text),captured_at:s.clock});t.evidence_link.push({subject_entity_id:row.id,subject_revision_id:rev(row.id),evidence_id:ev.id,evidence_role:'supports'});return row;
 }
 if(['research.assertion','research.citation'].includes(c.type)){
  const src=source(c.target_entity_id,c.target_revision_id),corpus=corpusContext(c.corpus_id,src),person=by('account',actor).person_id;
  if(c.type==='research.citation'&&!sourceView(s,actor,src.id,src.revision_id,'cite'))fail('forbidden','Цитування не дозволено рішенням про доступ.');
  if(c.type==='research.assertion'){
   const note=c.annotation_id?own('annotation',c.annotation_id):null;if(note&&(rev(note.id)!==c.annotation_revision_id||!annotationView(s,actor,note)||corpusAnchor(note).id!==src.id||corpusAnchor(note).revision_id!==src.revision_id))fail('invalid','Нотатка змінилася або належить іншому джерелу.');
   const row=await append('assertion',{subject_entity_id:src.id,subject_revision_id:src.revision_id,annotation_revision_id:note?rev(note.id):null,assertion_kind:'research',scope:'research',corpus_id:corpus,statement_text:text(c.statement_text),acceptance_state:'draft',author_person_id:person,review_decision_id:null});
   const ev=await append('evidence',{source_entity_id:src.id,source_revision_id:src.revision_id,external_uri:null,locator:c.locator?.trim()||null,quote_text:null,note:text(c.note),captured_at:s.clock});
   t.evidence_link.push({subject_entity_id:row.id,subject_revision_id:rev(row.id),evidence_id:ev.id,evidence_role:'supports'});return row;
  }
  const previous=t.citation.find(x=>owns(s,actor,x.id)&&x.target_entity_id===src.id&&x.target_revision_id===src.revision_id&&researchVisible(s,actor,x,'citation'));if(previous)return previous;
  let identifier=t.identifier.find(x=>x.entity_id===src.id&&x.scheme==='urn'&&x.namespace==='hereditas');
  if(!identifier){identifier={id:crypto.randomUUID(),entity_id:src.id,scheme:'urn',namespace:'hereditas',value:'urn:hereditas:'+src.id,is_primary:false,source_evidence_id:null};t.identifier.push(identifier);}
  const rendered=`${src.title}. Версія ${src.revision_no}. ${identifier.value} (версія: ${src.revision_id}).`;
  return append('citation',{target_entity_id:src.id,target_revision_id:src.revision_id,stable_identifier_id:identifier.id,style_code:'hereditas-versioned-1',language_tag:'uk',rendered_text:rendered,structured_data:{id:identifier.value+'#'+src.revision_id,type:'manuscript',title:src.title,note:'Версія '+src.revision_no},generated_at:s.clock});
 }
 if(c.type==='research.proposal'){
  const a=own('assertion',c.id);fresh(a.id);if(a.assertion_kind==='relation')fail('invalid','Дослідницький зв’язок ще не передається як уточнення опису.');if(!researchVisible(s,actor,a,'assertion'))fail('forbidden','Джерело недоступне.');
  if(t.candidate.some(x=>x.kind==='change_proposal'&&x.proposed_by===actor&&x.state==='pending'&&t.candidate_source.some(y=>y.candidate_id===x.id&&y.source_entity_id===a.id)))fail('invalid','Це твердження вже подано.');
  const src=source(a.subject_entity_id,a.subject_revision_id);
  const row=await append('candidate',{kind:'change_proposal',target_entity_id:src.id,base_revision_id:src.revision_id,proposed_payload:{description:text(c.description)},payload_schema_version:'research-proposal-1',proposed_entity_id:null,process_run_id:null,proposed_by:actor,confidence:null,state:'pending'});
  t.candidate_source.push({candidate_id:row.id,source_entity_id:a.id,source_revision_id:rev(a.id),source_role:'research_assertion'});return row;
 }
 if(c.type==='research.export'){
  if(!['text','csl_json'].includes(c.format)||!Array.isArray(c.citation_ids)||!c.citation_ids.length||new Set(c.citation_ids).size!==c.citation_ids.length)fail('invalid','Оберіть цитування та формат.');
  const rows=c.citation_ids.map(id=>{const x=own('citation',id);if(!researchVisible(s,actor,x,'citation')||!sourceView(s,actor,x.source_entity_id||x.target_entity_id,x.source_revision_id||x.target_revision_id,'download'))fail('forbidden','Цитування недоступне.');return x;});
  const content=c.format==='text'?rows.map(x=>x.rendered_text).join('\n\n'):JSON.stringify(rows.map(x=>x.structured_data),null,2),mime=c.format==='text'?'text/plain':'application/json';
  const file=await append('file_object',{sha256:await rawHash(content),byte_size:new TextEncoder().encode(content).length,mime_type:mime,pronom_id:null,original_filename:'bibliography.'+(c.format==='text'?'txt':'json'),received_at:s.clock,technical_metadata:{}});s.demo.file_contents[file.id]=content;
  const row=await append('bibliographic_export',{requested_by:actor,context_entity_id:null,context_revision_id:null,format:c.format,file_id:file.id,generated_at:s.clock,export_profile_version:'1'});
  rows.forEach((x,i)=>t.export_citation.push({export_id:row.id,citation_revision_id:rev(x.id),position:i+1}));return row;
 }
 fail('invalid','Невідома дослідницька дія.');
}
