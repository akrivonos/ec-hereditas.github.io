import {owns,sourceView,corpusItems,researchVisible} from './research.mjs?v=20261002-programmes2';
import {corpusTarget,corpusAnchor} from './corpus.mjs?v=20261002-programmes2';
import {discoverySource,termLabel} from './discovery.mjs?v=20261002-programmes2';
import {annotationView} from './reader.mjs?v=20261002-programmes2';
export const evidenceRoles={supports:'Підтверджує',contradicts:'Суперечить',review:'Контекст'};
export function assertionEvidence(s,row,rid=null){
 const current=rid||s.tables.entity.find(x=>x.id===row.id)?.current_revision_id;
 return s.tables.evidence_link.filter(x=>x.subject_entity_id===row.id&&(!x.subject_revision_id||x.subject_revision_id===current)).map(x=>({...s.tables.evidence.find(e=>e.id===x.evidence_id),role:x.evidence_role}));
}
export function evidenceView(s,a,e){
 const src=sourceView({...s,clock:new Date().toISOString()},a,e.source_entity_id,e.source_revision_id);if(!src)return null;
 if(e.annotation_revision_id){const r=s.tables.entity_revision.find(x=>x.id===e.annotation_revision_id);if(!r||!owns(s,a,r.entity_id)||!annotationView(s,a,r.snapshot))return null;}
 if(e.target_entity_id){const v=corpusTarget(s,a,e);if(!v||['representation','media_segment'].includes(v.type)&&!v.files.length)return null;}return src;
}
export function analysisTerms(s,a,sources){
 if(!sources.length||!sources.every(x=>discoverySource(s,a,x.id,x.revision_id)?.contextAllowed))return [];
 const archives=new Set(sources.map(x=>x.archive_id));
 return s.tables.vocabulary_term.filter(x=>x.status==='active'&&s.tables.vocabulary_scheme.some(v=>v.id===x.scheme_id&&v.status==='active'&&['D01','D02','D03','D08','D09'].includes(v.d_code)&&(!v.owner_archive_id||archives.has(v.owner_archive_id)))).map(x=>({id:x.id,label:termLabel(s,x.id),scheme:s.tables.vocabulary_scheme.find(v=>v.id===x.scheme_id).d_code}));
}
export function corpusAnalysis(s,a,id,rid){
 if(!owns(s,a,id)||!s.tables.entity_revision.some(x=>x.id===rid&&x.entity_id===id))return null;
 const items=corpusItems(s,rid),rows=[],seen=new Set();let unavailable=0;
 for(const item of items){const target=corpusTarget(s,a,item);if(!target){unavailable++;continue;}const key=target.source.id+':'+target.source.revision_id;if(seen.has(key)){rows.find(x=>x.id===target.source.id&&x.revision_id===target.source.revision_id).materials.push({label:target.label,text:target.text||target.source.text,item});continue;}seen.add(key);
  const v=discoverySource(s,a,target.source.id,target.source.revision_id),notes=s.tables.annotation.filter(n=>owns(s,a,n.id)&&corpusAnchor(n).id===v.id&&corpusAnchor(n).revision_id===v.revision_id&&annotationView(s,a,n));
  rows.push({...v,group:item.group_label||'',notes:notes.map(n=>({id:n.id,revision_id:s.tables.entity.find(e=>e.id===n.id).current_revision_id,body:n.body,type:n.note_type||'note',tags:annotationView(s,a,n).tags})),excerpt:target.text||v.text,materials:[{label:target.label,text:target.text||v.text,item}],item});
 }
 const count=fn=>{const m=new Map();for(const r of rows){const vals=[...new Set(fn(r))];for(const label of vals.length?vals:['Не зазначено / недоступно'])m.set(label,(m.get(label)||0)+1);}return [...m].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'uk'));};
 return {corpus_id:id,corpus_revision_id:rid,total_items:items.length,unavailable,rows,places:count(r=>r.places.map(x=>x.label)),periods:count(r=>r.date.from||r.date.to?[`${r.date.from||'?'} — ${r.date.to||'?'}`]:r.date.label?[r.date.label]:[]),people:count(r=>r.people.map(x=>x.label)),terms:count(r=>r.terms.map(x=>x.label))};
}
const reportOf=v=>({corpus_id:v.corpus_id,corpus_revision_id:v.corpus_revision_id,total_items:v.total_items,unavailable:v.unavailable,sources:v.rows.map(x=>({id:x.id,revision_id:x.revision_id,title:x.title,places:x.places,people:x.people,terms:x.terms,date:x.date})),places:v.places,periods:v.periods,people:v.people,terms:v.terms});
export function analysisCandidateVisible(s,a,c){
 if(!owns(s,a,c.id))return false;const v=corpusAnalysis(s,a,c.proposed_payload.corpus_id,c.proposed_payload.corpus_revision_id);
 return !!v&&!v.unavailable&&JSON.stringify(reportOf(v))===JSON.stringify(c.proposed_payload.report);
}
export async function analysisCommand(s,a,c,ctx){
 const {fail,append,fresh,own,text,hash,snapshot}=ctx,t=s.tables,by=(k,id)=>t[k]?.find(x=>x.id===id),rev=id=>by('entity',id)?.current_revision_id;
 const checkEvidence=x=>{
  if(!Object.hasOwn(evidenceRoles,x.role)||!x.source_revision_id||!evidenceView(s,a,x))fail('invalid','Доказ або його точна версія недоступні.');
  if(x.annotation_revision_id){const n=by('entity_revision',x.annotation_revision_id)?.snapshot;if(corpusAnchor(n).id!==x.source_entity_id||corpusAnchor(n).revision_id!==x.source_revision_id)fail('invalid','Нотатка належить іншому джерелу.');}
  const quote=x.quote_text?.trim()||null;if(quote){const v=x.target_entity_id?corpusTarget(s,a,x):sourceView(s,a,x.source_entity_id,x.source_revision_id);if(!v?.text?.includes(quote))fail('invalid','Цитату не знайдено в точній версії матеріалу.');}
  return {source_entity_id:x.source_entity_id,source_revision_id:x.source_revision_id,...(x.target_entity_id?{target_entity_id:x.target_entity_id,target_revision_id:x.target_revision_id,layer_entity_id:x.layer_entity_id||null,layer_revision_id:x.layer_revision_id||null}:{}),annotation_revision_id:x.annotation_revision_id||null,external_uri:null,locator:text(x.locator),quote_text:quote,note:text(x.note),captured_at:s.clock,role:x.role};
 };
 const save=async(old,values,inputs)=>{
  if(!Array.isArray(inputs)||!inputs.length)fail('invalid','Додайте хоча б один доказ.');const ev=inputs.map(checkEvidence),seen=new Set();for(const e of ev){const key=[e.source_revision_id,e.target_revision_id,e.annotation_revision_id,e.locator,e.role].join(':');if(seen.has(key))fail('invalid','Такий доказ уже додано.');seen.add(key);}
  const sources=ev.map(e=>sourceView(s,a,e.source_entity_id,e.source_revision_id)),choices=analysisTerms(s,a,sources),terms=values.analytical_terms||[];
  if(!Array.isArray(terms)||new Set(terms).size!==terms.length||terms.some(id=>!choices.some(x=>x.id===id)))fail('invalid','Поняття або жанр недоступні.');
  if(!['open','supported','contested','withdrawn'].includes(values.research_status||'open'))fail('invalid','Оберіть стан висновку.');
  const relation=values.analytical_relation||null;if(relation&&(relation.predicate!=='related_to'||relation.subject_term_id===relation.object_term_id||![relation.subject_term_id,relation.object_term_id].every(id=>terms.includes(id))))fail('invalid','Оберіть два різні доступні поняття для зв’язку.');
  const row=await append('assertion',Object.assign(old||{},values,{evidence_profile:'analysis/1'}));
  for(const x of ev){const {role,...data}=x,e=await append('evidence',data);t.evidence_link.push({subject_entity_id:row.id,subject_revision_id:rev(row.id),evidence_id:e.id,evidence_role:role});}
  const r=by('entity_revision',rev(row.id));r.snapshot=snapshot(t,'assertion',row);r.snapshot_hash=await hash(r.snapshot);return row;
 };
 if(c.type==='research.assertion.revise'){
  const old=own('assertion',c.id);fresh(c.id);if(!researchVisible(s,a,old,'assertion'))fail('forbidden','Твердження недоступне.');
  return save(old,{statement_text:text(c.statement_text),research_status:c.research_status,analytical_terms:c.analytical_terms||[],analytical_relation:c.analytical_relation||null,analysis_note:text(c.analysis_note)},c.evidence);
 }
 if(c.type==='research.analysis.run'){
  const v=corpusAnalysis(s,a,c.id,c.corpus_revision_id);if(!v||v.unavailable||v.rows.length<2)fail('invalid','Для порівняння потрібні щонайменше два доступні джерела.');
  const report=reportOf(v),pid=crypto.randomUUID(),statement=`У добірці ${v.rows.length} різних версій джерел. Розподіл за місцем: ${v.places.map(x=>x.label+' — '+x.count).join('; ')}. Це опис добірки, а не оцінка поширеності традиції.`;
  t.process_run.push({id:pid,operation:'corpus_comparison',producer_kind:'automated',provider:'local',tool_name:'Підрахунок складу корпусу',tool_version:'1',model_name:null,model_version:null,parameters:{method:'distinct-source-revisions',corpus_revision_id:c.corpus_revision_id,report_hash:await hash(report)},started_at:s.clock,finished_at:s.clock,state:'succeeded',initiated_by:a});
  for(const r of v.rows)t.process_input.push({process_run_id:pid,entity_id:r.id,revision_id:r.revision_id,input_role:'source'});
  t.process_input.push({process_run_id:pid,entity_id:c.id,revision_id:c.corpus_revision_id,input_role:'corpus'});
  const row=await append('candidate',{kind:'assertion',target_entity_id:v.rows[0].id,base_revision_id:v.rows[0].revision_id,proposed_payload:{corpus_id:c.id,corpus_revision_id:c.corpus_revision_id,statement_text:statement,report},payload_schema_version:'research-analysis/1',proposed_entity_id:null,process_run_id:pid,proposed_by:a,confidence:null,state:'pending'});
  for(const r of v.rows)t.candidate_source.push({candidate_id:row.id,source_entity_id:r.id,source_revision_id:r.revision_id,source_role:'comparison'});return row;
 }
 if(c.type==='research.analysis.review'){
  const row=own('candidate',c.id);fresh(c.id);if(row.payload_schema_version!=='research-analysis/1'||!analysisCandidateVisible(s,a,row))fail('forbidden','Матеріали порівняння змінилися або недоступні. Повторіть підрахунок.');
  if(!['pending','deferred'].includes(row.state)||!['accept','correct','reject','defer'].includes(c.decision))fail('invalid','Рішення вже ухвалено або не обрано.');text(c.reason);
  let result=null;const before=rev(row.id),previous=t.review_decision.filter(x=>x.target_entity_id===row.id).at(-1),decision=await append('review_decision',{target_entity_id:row.id,target_revision_id:before,decision:c.decision,reviewer_account_id:a,decided_at:s.clock,reason:c.reason,supersedes_decision_id:previous?.id||null});
  if(['accept','correct'].includes(c.decision)){
   if(c.confirm!==true)fail('invalid','Підтвердьте звірку з джерелами.');const statement=c.decision==='accept'?row.proposed_payload.statement_text:text(c.statement_text);if(c.decision==='correct'&&statement===row.proposed_payload.statement_text)fail('invalid','Вкажіть виправлений висновок.');
   result=await save(null,{subject_entity_id:row.target_entity_id,subject_revision_id:row.base_revision_id,assertion_kind:'research',scope:'research',corpus_id:row.proposed_payload.corpus_id,corpus_revision_id:row.proposed_payload.corpus_revision_id,statement_text:statement,acceptance_state:'draft',research_status:'open',analysis_note:c.reason,analytical_terms:[],author_person_id:by('account',a).person_id,review_decision_id:decision.id,analysis_candidate_id:row.id},row.proposed_payload.report.sources.map(x=>({source_entity_id:x.id,source_revision_id:x.revision_id,role:'supports',locator:'Опис і дозволений контекст джерела',note:c.reason})));
   t.review_application.push({review_decision_id:decision.id,result_entity_id:result.id,result_revision_id:rev(result.id),applied_at:s.clock});
  }
  row.state={accept:'accepted',correct:'corrected',reject:'rejected',defer:'deferred'}[c.decision];row.proposed_entity_id=result?.id||null;await append('candidate',row);return row;
 }
 fail('invalid','Невідома дія аналізу.');
}
