import {createStore} from './model.mjs?v=20261007-places1';
import {sourceView,researchEnabled} from './research.mjs?v=20261007-places1';
export async function analysisDemo(source){
 if(source.demo.analysis_v1)return structuredClone(source);
 const store=createStore(source),actor=source.demo.ids.admin,ids=source.demo.reader_ids,rev=id=>source.tables.entity.find(x=>x.id===id)?.current_revision_id;
 const pool=[ids.unit,ids.document,source.demo.discovery_ids.unit].map(id=>sourceView(source,actor,id)).filter(Boolean);
 if(researchEnabled(source,actor)&&pool.length>=2){
  const corpus=await store.dispatch(actor,{type:'research.corpus.create',title:'Навчальне порівняння джерел',research_question:'Як зіставляти свідчення, контекст і невідомі дані?',inclusion_criteria:'Спеціально створені приклади для перевірки інтерфейсу',method_notes:'Синтетичні матеріали; висновки не є відомостями про реальну традицію.',items:pool.map((x,i)=>({target_entity_id:x.id,target_revision_id:x.revision_id,group_label:i?'Контекст':'Основне свідчення',selection_reason:'Навчальний приклад'}))});
  const assertion=await store.dispatch(actor,{type:'research.assertion',target_entity_id:pool[0].id,target_revision_id:pool[0].revision_id,corpus_id:corpus.id,statement_text:'Навчальна гіпотеза: матеріали описують спільний контекст',locator:'Опис прикладу',note:'Підстава для тренувального порівняння'});
  await store.dispatch(actor,{type:'research.assertion.revise',id:assertion.id,expected_revision_id:store.get().tables.entity.find(x=>x.id===assertion.id).current_revision_id,statement_text:assertion.statement_text,research_status:'contested',analysis_note:'Документ прямо вказує на синтетичне походження. Цього недостатньо для висновку про реальну традицію.',analytical_terms:[],evidence:pool.slice(0,2).map((x,i)=>({source_entity_id:x.id,source_revision_id:x.revision_id,role:i?'contradicts':'supports',locator:'Опис матеріалу',note:i?'Вказує на спеціально створений навчальний контекст.':'Загальна тема підказує гіпотезу для перевірки.'}))});
  const candidate=await store.dispatch(actor,{type:'research.analysis.run',id:corpus.id,corpus_revision_id:store.get().tables.entity.find(x=>x.id===corpus.id).current_revision_id});
  const s=store.get();s.demo.analysis_v1=1;s.demo.analysis_ids={corpus:corpus.id,assertion:assertion.id,candidate:candidate.id};return s;
 }
 const s=store.get();s.demo.analysis_v1=1;return s;
}
export async function prepareAnalysis(prepared){const added=!prepared.saved.state.demo.analysis_v1;return {...prepared,base:await analysisDemo(prepared.base),saved:{generation:prepared.saved.generation+(added?1:0),state:await analysisDemo(prepared.saved.state)},changed:prepared.changed||added};}
