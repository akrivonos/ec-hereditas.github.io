import {can} from '../data/model.mjs?v=20261002-wf15';
import {museumOwned} from '../data/museum.mjs?v=20261002-wf15';
import {publicSearch} from '../data/public.mjs?v=20261002-wf15';
import {museumRequests,requestKinds} from '../data/museum-requests.mjs?v=20261002-wf15';
import {wizard} from './wizard.mjs?v=20261002-wf15';

export function museumRequestUI(ctx,h){
 const {s,actor,scope,pg,esc,dialog,dispatch,flash,render,heading,panel}=ctx,{body,details,input,textarea,select,table,act,btn,show}=h;
 const st=s(),t=st.tables,by=(k,id)=>t[k].find(x=>x.id===id),rev=id=>by('entity',id)?.current_revision_id,p=new URLSearchParams(location.search),archivist=p.get('role')==='R02';
 const url=q=>pg(56,{role:archivist?'R02':'R05-M',tab:'requests',...q}),link=(label,q={})=>`<a href="${url(q)}">${esc(label)}</a>`,go=q=>location.assign(url(q));
 const statuses={assigned:'Передано архівісту',in_progress:'На розгляді',blocked:'Потрібне уточнення',done:'Розгляд завершено',cancelled:'Скасовано'};
 const ownEx=t.museum_exhibition.filter(x=>museumOwned(st,actor,x.id)&&!['closed','archived'].includes(x.state)&&(!scope||by('entity',x.id).archive_id===scope));
 function create(ex=null){
  const options=ownEx,initial=ex||options[0];if(!initial)return;
  const sources=publicSearch(st).filter(x=>by('entity',x.id).archive_id===by('entity',initial.id).archive_id);
  const d=wizard({dialog,esc},{title:'Звернутися до архіву',submit:'Передати архівісту',steps:[
   {title:'Що потрібно',body:select('exhibition_id','Експозиція',options.map(x=>[x.id,x.title]),initial.id)+select('kind','Вид звернення',Object.entries(requestKinds))+`<div data-request-source hidden>${select('publication_id','Публічний матеріал',sources.map(x=>[x.id,x.title])).replace(' required','')}</div>`},
   {title:'Опишіть питання',body:input('title','Тема звернення','',true)+textarea('body','Що потрібно та на якій підставі','',true)+'<p class="muted">Для запиту публікації зазначте відомий шифр або посилання. Не додавайте приватних відомостей про людей.</p>'}
  ],summary:v=>details([['Експозиція',by('museum_exhibition',v.exhibition_id)?.title],['Вид',requestKinds[v.kind]],['Тема',v.title],['Питання',v.body],['Одержувач','Відповідальний працівник архіву']]),onSubmit:async v=>{const row=await dispatch({type:'museum.request.create',...v,publication_revision_id:v.kind==='museum_correction_request'?rev(v.publication_id):null});go({id:row.id});}});
  const update=()=>{const correction=d.querySelector('[name=kind]').value==='museum_correction_request';d.querySelector('[data-request-source]').hidden=!correction;d.querySelector('[name=publication_id]').required=correction;};d.querySelector('[name=kind]').onchange=update;
  d.querySelector('[name=exhibition_id]').onchange=e=>{const archive=by('entity',e.target.value).archive_id;d.querySelector('[name=publication_id]').innerHTML=publicSearch(st).filter(x=>by('entity',x.id).archive_id===archive).map(x=>`<option value="${x.id}">${esc(x.title)}</option>`).join('');};
 }
 function list(){
  const rows=museumRequests(st,actor).filter(x=>(!scope||x.archive_id===scope)&&(!p.get('state')||x.state===p.get('state'))),row=p.get('id')&&rows.find(x=>x.id===p.get('id'));act('request-new',()=>create());
  if(p.get('id')&&!row){show(heading('Звернення','Звернення недоступне','Поверніться до списку.')+link('← До звернень'));return;}
  if(row){
   const respond=(action)=>dialog(action==='block'?'Запросити уточнення':action==='complete'?'Завершити розгляд':'Взяти на розгляд',textarea('reason',action==='block'?'Що потрібно уточнити':'Відповідь заявнику','',true)+(row.candidate_id&&action==='complete'?'<p>Це завершить пропозицію як відхилену. Прийняття з виправленням джерела виконується під час архівної звірки.</p>':''),async fd=>{await dispatch({type:'museum.request.respond',id:row.id,expected_revision_id:row.revision_id,action,reason:fd.get('reason'),decision:row.candidate_id&&action==='complete'?'reject':null});flash('Відповідь збережено.');render();},action==='complete'?(row.candidate_id?'Відхилити з поясненням':'Завершити розгляд'):'Зберегти відповідь');
   act('request-start',()=>respond('start'));act('request-block',()=>respond('block'));act('request-complete',()=>respond('complete'));act('request-clarify',()=>dialog('Додати уточнення',textarea('reason','Уточнення','',true),async fd=>{await dispatch({type:'museum.request.clarify',id:row.id,expected_revision_id:row.revision_id,reason:fd.get('reason')});flash('Уточнення передано архівісту.');render();},'Передати уточнення'));
   const reviewLink=row.candidate_id&&can(st,actor,'review.write',row.archive_id)?`<a class="button" href="${pg(24,{role:'R02',id:row.candidate_id})}">Звірити й виправити опис</a>`:'';
   const controls=row.can_respond&&!['done','cancelled'].includes(row.state)?`${btn('Взяти на розгляд','request-start',row.state!=='in_progress')}${btn('Запросити уточнення','request-block')}${btn(row.candidate_id?'Відхилити пропозицію':'Завершити розгляд','request-complete')}`:!row.can_respond&&row.state==='blocked'?btn('Додати уточнення','request-clarify'):'';
   show(link('← До звернень')+heading(requestKinds[row.kind],row.title,'Відповідь архіву зберігається в історії. Рішення щодо прав або публікації виконуються архівістом окремо.',`<div class="public-actions">${reviewLink}${controls}</div>`)+panel('Звернення',body(details([['Стан',statuses[row.state]],['Експозиція',row.exhibition_title],['Архів',by('archive',row.archive_id)?.name]])+`<p class="source-text">${esc(row.body)}</p>${row.candidate_id?(row.publication?`<a href="${pg(50,{role:'R05',id:row.publication.id})}" target="_blank" rel="noopener">Матеріал: ${esc(row.publication.title)} ↗</a>`:'<p>Публічна версія матеріалу змінилася або недоступна. Перед рішенням потрібна звірка джерела.</p>'):''}`))+panel('Історія розгляду',table(['Стан','Повідомлення'],row.events.map(x=>[esc(statuses[x.to_state]||x.to_state),esc(x.reason)]))));return;
  }
  show((archivist?`<a href="${pg(10,{role:'R02'})}">← Надходження</a>`:`<a href="${pg(56,{role:'R05-M'})}">← Експозиції</a>`)+heading(archivist?'Архівіст':'Музейник',archivist?'Запити музею':'Звернення до архіву','Відкрийте звернення, щоб побачити відповідь або уточнити питання.',!archivist?btn('Створити звернення','request-new',!!ownEx.length,true):'')+`<form class="filters"><input type="hidden" name="role" value="${archivist?'R02':'R05-M'}"><input type="hidden" name="tab" value="requests">${select('state','Стан',[['','Усі стани'],...Object.entries(statuses)],p.get('state')||'').replace(' required','')}<button class="button">Показати</button></form>`+panel('Звернення',table(['Тема','Експозиція','Стан'],rows.map(x=>[link(x.title,{id:x.id}),esc(x.exhibition_title),esc(statuses[x.state])]),'Звернень за цими умовами немає.')));
 }
 return {list,create};
}
