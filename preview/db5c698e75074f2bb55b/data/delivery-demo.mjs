import {createStore} from './model.mjs?v=20261002-feedback2';
import {sourceView,researchEnabled} from './research.mjs?v=20261002-feedback2';
import {readerResources} from './reader.mjs?v=20261002-feedback2';
export async function deliveryDemo(source){
 if(source.demo.delivery_v1)return structuredClone(source);const store=createStore(source),a=source.demo.ids.admin,ids=source.demo.reader_ids,src=sourceView(source,a,ids.unit);
 if(src&&sourceView(source,a,src.id,src.revision_id,'cite')&&researchEnabled(source,a)){
  const resources=readerResources(source,a,src),items=['text','audio','segment'].map(k=>resources.find(x=>x.view.id===ids[k])?.item).filter(Boolean);
  if(items.length===3){const corpus=await store.dispatch(a,{type:'research.corpus.create',title:'Навчальний експорт: текст і медіа',research_question:'Перевірка пакета точних матеріалів',inclusion_criteria:'Ізольовані синтетичні текст, аудіо та фрагмент',items:items.map(i=>({...i,group_label:'Навчальні матеріали',selection_reason:'Перевірка експорту'}))});await store.dispatch(a,{type:'research.citations',items});const s=store.get();s.demo.delivery_v1=1;s.demo.delivery_ids={corpus:corpus.id};return s;}
 }
 const s=store.get();s.demo.delivery_v1=1;return s;
}
export async function prepareDelivery(prepared){const added=!prepared.saved.state.demo.delivery_v1;return {...prepared,base:await deliveryDemo(prepared.base),saved:{generation:prepared.saved.generation+(added?1:0),state:await deliveryDemo(prepared.saved.state)},changed:prepared.changed||added};}
