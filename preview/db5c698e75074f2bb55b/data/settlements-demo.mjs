import {createStore} from './model.mjs?v=20261007-places1';
export async function settlementsDemo(source){
 if(source.demo.settlements_v1)return structuredClone(source);
 const store=createStore(source),actor=source.demo.ids.admin,archive_id=source.demo.ids['archive-a'],source_reference='Синтетичний навчальний приклад; не реєстр населених пунктів',revision=id=>store.get().tables.entity.find(e=>e.id===id).current_revision_id;
 const create=(name,country,levels)=>store.dispatch(actor,{type:'field.place.create',archive_id,name,country,settlement_type:'село',year_from:2020,source_reference,levels});
 const one=await create('Новолісся (приклад)','Україна',[{level_type:'громада',name:'Навчальна'},{level_type:'район',name:'Північний'},{level_type:'область',name:'Демонстраційна'}]);
 await store.dispatch(actor,{type:'field.place.state',id:one.id,expected_revision_id:revision(one.id),is_current:false,name:'Старолісся (приклад)',settlement_type:'село',country:'Україна',year_from:1950,year_to:2019,source_reference,levels:[{level_type:'сільська рада',name:'Старолісська'},{level_type:'район',name:'Попередній'}]});
 await store.dispatch(actor,{type:'field.place.region',id:one.id,expected_revision_id:revision(one.id),concept_name:'Навчальна етногеографічна схема',concept_author:'Команда макета',classification_type:'Етногеографічне',source_work:'Синтетичний покажчик для перевірки інтерфейсу',region_names:'Північний приклад\nПівденний приклад',region_name:'Північний приклад',source_locator:'Навчальна карта 1'});
 await store.dispatch(actor,{type:'field.place.region',id:one.id,expected_revision_id:revision(one.id),concept_name:'Навчальна фольклорна схема',concept_author:'Команда макета',classification_type:'Фольклорне',source_work:'Синтетична друга концепція для порівняння',region_names:'Приклад долини',region_name:'Приклад долини'});
 await create('Затишне (приклад)','Україна',[{level_type:'громада',name:'Навчальна'}]);
 await create('Затишне (приклад)','Польща',[{level_type:'ґміна',name:'Прикладова'},{level_type:'повіт',name:'Навчальний'},{level_type:'воєводство',name:'Демонстраційне'}]);
 const gone=await create('Озерне (приклад)','Україна',[{level_type:'район',name:'Навчальний'}]);
 await store.dispatch(actor,{type:'field.place.status',id:gone.id,expected_revision_id:revision(gone.id),existence_status:'disappeared',disappearance_year:2021,source_reference});
 const result=store.get();result.demo.settlements_v1=1;return result;
}
export async function prepareSettlements(p){const changed=!p.saved.state.demo.settlements_v1;return {...p,base:await settlementsDemo(p.base),saved:{generation:p.saved.generation+(changed?1:0),state:await settlementsDemo(p.saved.state)},changed:p.changed||changed};}
