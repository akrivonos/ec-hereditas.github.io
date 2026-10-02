import {createStore,can} from './model.mjs?v=20261002-programmes';
import {programmeRefs} from './programmes.mjs?v=20261002-programmes';
export async function programmesDemo(source){
 if(source.demo.programmes_v1)return structuredClone(source);const store=createStore(source),actor=source.demo.ids.admin,ids=source.demo.session_feedback_ids,r=source.tables.field_research.find(r=>r.id===ids?.research),archive=source.tables.entity.find(e=>e.id===r?.id)?.archive_id,rev=id=>store.get().tables.entity.find(e=>e.id===id).current_revision_id;
 if(r&&!programmeRefs(r).length&&can(source,actor,'field.write',archive)){
  for(const [title,kind,body_text] of [['Загальна програма експедиції','general','1. Походження респондента та історія поселення.\n2. Календарні й родинні звичаї.\n3. Пісенна традиція, ремесла та місцеві оповіді.'],['Весільні звичаї','thematic','1. Як готувалися до весілля?\n2. Хто брав участь у кожному етапі?\n3. Які пісні виконували та хто їх пам’ятає?'],['Народна музика','thematic','1. Які інструменти використовували?\n2. Хто навчав музикантів?\n3. Який репертуар звучав на святах?']])await store.dispatch(actor,{type:'field.programme.item',id:r.id,expected_revision_id:rev(r.id),title,programme_kind:kind,body_text});
  const session=source.tables.collecting_session.find(s=>s.id===ids.session);if(session&&!programmeRefs(session).length)await store.dispatch(actor,{type:'field.session.programmes',id:session.id,expected_revision_id:rev(session.id),research_revision_id:rev(r.id)});
 }
 const result=store.get();result.demo.programmes_v1=1;return result;
}
export async function prepareProgrammesDemo(p){const changed=!p.saved.state.demo.programmes_v1;return {...p,base:await programmesDemo(p.base),saved:{generation:p.saved.generation+(changed?1:0),state:await programmesDemo(p.saved.state)},changed:p.changed||changed};}
