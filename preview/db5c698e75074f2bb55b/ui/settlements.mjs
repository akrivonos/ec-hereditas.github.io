import {placeStates,stateLevels,placeLabel,placeMatches} from '../data/settlements.mjs?v=20261007-places1';
import {hint} from './help.mjs?v=20261007-places1';
export function settlementPage(ctx){
 const {st,t,params,by,entity,rev,label,allowed,visible,writable,archive,action,show,heading,panel,body,table,details,btn,button,pg,esc,input,select,choices,dialog,form,dispatch,render,denied,revisionHistory}=ctx;
 const role=params.get('role')||'R02',url=(id)=>pg(id?19:18,{kind:'place',role,id}),write=row=>writable(row?.id||archive,'catalog.write');
 const sourceFields=row=>input('source_reference','Джерело',row?.source_reference||'','textarea',true)+input('source_locator','Сторінка / уточнення',row?.source_locator||'');
 const dateFields=row=>input('year_from','Від року',row?.year_from??'','number')+input('year_to','До року',row?.year_to??'','number')+input('period_note','Період словами',row?.period_note||'','text',false,'Якщо точні роки невідомі, залиште їх порожніми.');
 const levelFields=x=>`<div class="place-level">${input('level_type','Тип одиниці',x?.level_type||'')}${input('level_name','Назва одиниці',x?.name||'')}<button type="button" class="button secondary small" data-remove-level>Прибрати рівень</button></div>`;
 const stateForm=(row,current,old=null)=>{
  const currentState=placeStates(t,row?.id).find(x=>x.is_current),levels=old?stateLevels(t,old.id):current&&currentState?stateLevels(t,currentState.id):[],initial=old||(!current?{}:placeStates(t,row?.id).find(x=>x.is_current))||{};
  const d=dialog(!row?'Новий населений пункт':old?'Редагувати опис':current?'Змінити актуальну належність':'Додати історичну належність',
   input('name','Назва поселення',old?.name||row?.name||'','text',true)+input('settlement_type','Тип поселення',initial.settlement_type||'село','text',true)+
   '<div class="place-levels">'+levels.filter(x=>x.level_type!=='країна').map(levelFields).join('')+'</div><button type="button" class="button secondary" data-add-level>Додати адміністративний рівень</button>'+input('country','Країна',levels.at(-1)?.name||'','text',true)+dateFields(old)+sourceFields(old),async fd=>{
    const types=fd.getAll('level_type'),names=fd.getAll('level_name');const result=await dispatch({type:row?'field.place.state':'field.place.create',id:row?.id,archive_id:archive,expected_revision_id:row?rev(row.id):undefined,state_id:old?.id,is_current:current,...Object.fromEntries(fd),levels:types.map((level_type,i)=>({level_type,name:names[i]}))});location.href=url(result.id);
   });
  d.querySelector('[data-add-level]').onclick=()=>d.querySelector('.place-levels').insertAdjacentHTML('beforeend',levelFields());
  d.addEventListener('click',e=>{if(e.target.closest('[data-remove-level]'))e.target.closest('.place-level').remove();});
  if(current){d.querySelector('[name="year_to"]').closest('.field-control').remove();}
 };
 const command=(row,type,fd)=>({type,id:row.id,expected_revision_id:rev(row.id),...Object.fromEntries(fd)});
 if(!params.has('id')){
  const q=params.get('q')||'',status=params.get('status')||'',rows=visible('place').filter(x=>!x.administrative_node&&placeMatches(t,x,q)&&(!status||(x.existence_status||'unknown')===status));
  action('new-place',()=>stateForm(null,true));
  const typeNav=`<nav class="record-tabs" aria-label="Тип запису">${button('Особи',pg(18,{kind:'person',role}),true)}<a href="${url()}" aria-current="page">Населені пункти</a>${button('Установи',pg(18,{kind:'institution',role}),true)}</nav>`;
  show(heading('Довідник місць','Населені пункти','',btn('Новий населений пункт','new-place',write())+`<span class="note-help">${hint('Довідник поселень','Шукайте за актуальною або попередньою назвою. Кожне поселення зберігає історію та посилання на джерела. Зміни залишаються в цьому браузері.')}</span>`)+typeNav+
   `<form class="filters"><input type="hidden" name="kind" value="place"><input type="hidden" name="role" value="${esc(role)}">${input('q','Назва або код',q)}${select('status','Стан',choices([['','Усі'],['existing','Існує'],['disappeared','Не існує'],['unknown','Не встановлено']],status))}<button class="button">Знайти</button></form>`+
   panel('Поселення',table(['Населений пункт','Стан','Історія'],rows.map(row=>{
    const matches=(t.place_name||[]).filter(x=>x.place_id===row.id&&x.name!==row.name&&(!q||x.name.toLocaleLowerCase('uk').includes(q.toLocaleLowerCase('uk'))));
    return [`<div><a href="${url(row.id)}">${esc(placeLabel(t,row))}</a>${matches.length?'<p class="muted">Попередні назви: '+matches.map(x=>esc(x.name)).join(', ')+'</p>':''}</div>`,esc(({existing:'Існує',disappeared:'Не існує',unknown:'Не встановлено'})[row.existence_status||'unknown']),String(placeStates(t,row.id).filter(x=>!x.is_current).length)];
   }))));return;
 }
 const row=visible('place').find(x=>x.id===params.get('id')&&!x.administrative_node);if(!row){denied();return;}
 const states=placeStates(t,row.id),current=states.find(x=>x.is_current),status=row.existence_status||'unknown';
 action('current',()=>stateForm(row,true));action('history',()=>stateForm(row,false));for(const state of states)action('state-'+state.id,()=>stateForm(row,state.is_current,state));
 action('coords',()=>form('Географічні координати',input('coordinate_pair','Координати через кому','','text',false,'Наприклад: 49.54816187, 25.82645744. Або заповніть два поля нижче.')+input('latitude','Широта',row.latitude??'','number')+input('longitude','Довгота',row.longitude??'','number')+input('coordinate_note','Джерело та точність координат',row.coordinate_note||'','textarea'),fd=>command(row,'field.place.coordinates',fd)));
 action('status',()=>form('Стан поселення',select('existence_status','Стан',choices([['existing','Існує'],['disappeared','Не існує'],['unknown','Не встановлено']],status))+input('disappearance_year','Рік зникнення',row.disappearance_year??'','number')+input('source_reference','Джерело',row.status_source||'','textarea',true),fd=>command(row,'field.place.status',fd)));
 action('identifier',()=>form('Додати код класифікатора',select('system','Класифікатор',choices([['KATOTTG','КАТОТТГ'],['KOATUU','КОАТУУ'],['other','Інший']]))+input('value','Код','','text',true)+input('year_from','Від року','','number')+input('year_to','До року','','number')+input('source_reference','Джерело та версія','','textarea',true),fd=>command(row,'field.place.identifier',fd)));
 const concepts=(t.regionalization_concept||[]).filter(x=>x.archive_id===entity(row.id).archive_id);
 action('concept',()=>form('Нова концепція районування',input('concept_name','Назва концепції','','text',true)+input('concept_author','Автор концепції','','text',true)+input('classification_type','Тип районування','','text',true)+input('source_work','Бібліографічний опис','','textarea',true)+input('region_names','Райони концепції (кожен з нового рядка)','','textarea',true)+input('region_name','Район цього поселення','','text',true)+input('source_locator','Сторінка / карта / покажчик'),fd=>command(row,'field.place.region',fd)));
 action('region',()=>{
  const options=id=>(t.regionalization_region||[]).filter(x=>x.concept_id===id).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');
  const d=form('Додати районування',select('concept_id','Концепція',concepts.map(x=>`<option value="${x.id}">${esc(x.name+' — '+x.author)}</option>`).join(''))+select('region_id','Район / регіон',options(concepts[0]?.id))+input('source_locator','Сторінка / карта / покажчик'),fd=>command(row,'field.place.region',fd));
  d.querySelector('[name="concept_id"]').onchange=e=>{d.querySelector('[name="region_id"]').innerHTML=options(e.target.value);};
 });
 const compactDetails=rows=>'<div class="settlement-details">'+details(rows.filter(([,value])=>value!==null&&value!==undefined&&value!==''))+'</div>';
 const period=state=>state.year_from!==null||state.year_to!==null?[state.year_from===null?'Початок невідомий':state.year_from,state.year_to===null?(state.is_current?(status==='disappeared'?(row.disappearance_year||'до зникнення'):'дотепер'):'завершення невідоме'):state.year_to].join(' — '):state.period_note||'Роки не встановлено';
 const chain=state=>stateLevels(t,state.id).map(x=>x.level_type==='країна'?x.name:x.level_type+' '+x.name).join(', ');
 const describe=state=>body(compactDetails([['Назва',state.settlement_type+' '+state.name],['Адміністративна належність',chain(state)],['Період',period(state)],['Уточнення періоду',state.period_note],['Джерело',state.source_reference],['Сторінка / уточнення',state.source_locator]]));

 const historical=states.filter(x=>!x.is_current),regions=(t.place_region||[]).filter(x=>x.place_id===row.id&&x.region_id),identifiers=(t.place_identifier||[]).filter(x=>x.place_id===row.id),related=[...new Set(t.geographic_context.filter(x=>x.place_id===row.id).map(x=>x.subject_entity_id).concat(t.research_route_stop.filter(x=>x.place_id===row.id).map(x=>x.research_id)))].filter(id=>allowed(id));
 show('<div class="settlement-card">'+heading('Населений пункт',row.name,'',button('← Населені пункти',url(),true))+
  panel('Відомості',body(compactDetails([['Стан',({existing:'Існує',disappeared:'Не існує',unknown:'Не встановлено'})[status]],['Рік зникнення',status==='disappeared'?(row.disappearance_year||'Не встановлено'):null],['Джерело стану',row.status_source],['Координати',row.latitude===null?'Не встановлено':row.latitude+', '+row.longitude],['Джерело координат',row.coordinate_note]])),'<div class="actions">'+btn('Координати','coords',write(row))+' '+btn('Стан поселення','status',write(row))+(row.latitude!==null?' '+button('На мапі','https://www.openstreetmap.org/?mlat='+row.latitude+'&mlon='+row.longitude+'#map=13/'+row.latitude+'/'+row.longitude,true):'')+'</div>')+
  panel(status==='disappeared'?'Остання відома належність':'Актуальна належність',current?describe(current):body('<p>Адміністративну належність ще не додано.</p>'),'<div class="actions">'+btn(current?'Змінити належність':'Додати належність','current',write(row))+(current?' '+btn('Уточнити опис','state-'+current.id,write(row)):'')+'</div>')+
  panel('Історична належність',historical.length?table(['Назва й період','Адміністративна належність','Джерело',''],historical.map(x=>[`<div><strong>${esc(x.settlement_type+' '+x.name)}</strong><p>${esc(period(x))}</p>${x.period_note?'<p>'+esc(x.period_note)+'</p>':''}</div>`,esc(chain(x)),`<div>${esc(x.source_reference)}${x.source_locator?'<p>'+esc(x.source_locator)+'</p>':''}</div>`,btn('Редагувати історичний опис','state-'+x.id,write(row))])):body('<p>Історичних описів ще немає.</p>'),btn('Додати історичну належність','history',write(row)))+
  panel('Районування',table(['Район / регіон','Тип','Концепція та джерело'],regions.map(x=>[esc(x.region_name),esc(x.classification_type),`<div>${esc(x.concept_author+' · '+x.concept_name)}<p>${esc(x.source_work)}</p><p>${esc(x.source_label||'')}</p></div>`])),'<div class="actions">'+btn('Додати районування','region',write(row)&&concepts.length>0)+' '+btn('Нова концепція','concept',write(row))+'</div>')+
  panel('Коди класифікаторів',table(['Класифікатор','Код','Джерело'],identifiers.map(x=>[esc(x.system),esc(x.value),esc(x.source_reference)])),btn('Додати код','identifier',write(row)))+
  panel('Пов’язані матеріали',body(related.map(id=>{const page=({field_research:5,collecting_session:8,information_unit:17,person:19,media_asset:38})[entity(id)?.entity_type];return page?`<p>${button(label(id),pg(page,{id,role}),true)}</p>`:'';}).join('')||'<p>Пов’язаних матеріалів ще немає.</p>'))+revisionHistory(row.id)+'</div>');
}
