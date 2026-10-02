import {prepareSessionFeedback} from '../data/session-feedback-demo.mjs?v=20261002-feedback2';
import {prepareDelivery} from '../data/delivery-demo.mjs?v=20261002-feedback2';
import {prepareAnalysis} from '../data/analysis-demo.mjs?v=20261002-feedback2';
import {prepareReader} from '../data/reader-demo.mjs?v=20261002-feedback2';
import {prepareDiscovery} from '../data/discovery-demo.mjs?v=20261002-feedback2';
import {prepareSingleUser} from '../data/single-user.mjs?v=20261002-feedback2';
import {createStore,can,grants,scopes,tasks,taskView,grantKey,activeAccount,ModelError} from "../data/model.mjs?v=20261002-feedback2";
import {fieldPages} from './field.mjs?v=20261002-feedback2';
import {mediaPages} from './media.mjs?v=20261002-feedback2';
import {researchPages} from './research.mjs?v=20261002-feedback2';
import {publicPages} from './public.mjs?v=20261002-feedback2';
import {archivePages} from './archive.mjs?v=20261002-feedback2';
import {workbenchPages} from './workbench.mjs?v=20261002-feedback2';
import {museumPages} from './museum.mjs?v=20261002-feedback2';
import {museumStamp} from '../data/museum.mjs?v=20261002-feedback2';
import {publicAccessStamp} from '../data/public.mjs?v=20261002-feedback2';
import {bindHelp} from './help.mjs?v=20261002-feedback2';

const root=new URL("../",import.meta.url);
const pageId=document.body.dataset.page;
const storageKey="hereditas.master.m1.state.v1";
const actorKey="hereditas.master.m1.actor";
const scopeKey="hereditas.master.m1.scope";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const url=(file,query={})=>{const u=new URL(file,root);for(const [k,v]of Object.entries(query))if(v)u.searchParams.set(k,v);return u.href;};
const pg=(n,q={})=>url("pages/pg-"+String(n).padStart(2,"0")+".html",q);
const stateLabels={open:"Відкрите",assigned:"Призначене",in_progress:"У роботі",blocked:"Заблоковане",done:"Завершене",cancelled:"Скасоване",active:"Активний",disabled:"Вимкнений",expired:"Строк минув",interactive:"Інтерактивний",planned:"Заплановано"};
const badge=(s,label=stateLabels[s]||s)=>'<span class="badge '+esc(s)+'">'+esc(label)+'</span>';
const button=(text,href,secondary=false)=>'<a class="button'+(secondary?' secondary':'')+'" href="'+esc(href)+'">'+esc(text)+'</a>';
const date=value=>value?new Intl.DateTimeFormat("uk-UA",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(value)):"Не визначено";
let manifest,base,rawFixture,store,actor,scope="",notice="",noticeType="info",catalogQuery="",catalogPhase="",catalogStatus="";
const app=document.getElementById("app");
async function getJSON(path){const response=await fetch(url(path));if(!response.ok)throw new Error("Не вдалося завантажити "+path);return response.json();}
function s(){return store.get();}
const actorLabel=id=>base.demo.actors.find(a=>a.account_id===id)?.label||"Не призначено";
const roleLabel=(state,id)=>state.tables.access_role.find(r=>r.id===id)?.label||"Роль недоступна";
function flash(text,type="info"){notice=text;noticeType=type;}
function identity(){
  return {name:"Користувач",context:"Адміністратор",initials:"К"};
}
function currentScope(){
  const allowed=scopes(s(),actor);
  if(scope&&!allowed.some(a=>a.id===scope))scope="";
  return scope;
}

const roleKey="hereditas.preview.role";
const objectLabels={O05:"особа",O34:"текстове представлення",O35:"шар часової розмітки",O40:"архівне твердження",O47:"рішення про доступ",O51:"дослідницький корпус",O52:"анотація",O53:"дослідницьке твердження",O54:"пропозиція зміни",O55:"публікація",O56:"приватна добірка",O57:"цитування",O58:"бібліографічний експорт",O62:"пакет депонування",O66:"добірка при експонаті",O67:"точка доступу"};
function human(value){
 return String(value??"")
  .replace(/\bWF-\d{2}\b/g,code=>'«'+(manifest.workflows.find(w=>w.id===code)?.title||"пов’язаний процес").replace(/^WF-\d+\s*[—–-]\s*/,"")+'»')
  .replace(/\bPG-\d{2}\b/g,code=>'«'+(manifest.pages.find(p=>p.id===code)?.title||"пов’язана сторінка")+'»')
  .replace(/\bO\d{2}\b/g,code=>objectLabels[code]||"пов’язаний запис")
  .replace(/\bR\d{2}(?:-M)?\b/g,"").replace(/\s*[·→]\s*$/,"")
  .replace(/\bupdate\/withdraw\b/g,"оновлення або відкликання").replace(/\back\b/g,"підтвердження отримання")
  .replace(/\bscoped grant\b/g,"доступ у визначеній області").replace(/\bchecksum\b/g,"контрольна сума")
  .replace(/\bsnapshot\b/g,"зафіксований стан").replace(/\bscope\b/g,"область доступу")
  .replace(/\s+([,.;])/g,"$1").replace(/\s{2,}/g," ").trim();
}
const workflowTitle=code=>human(manifest.workflows.find(w=>w.id===code)?.title?.replace(/^WF-\d+\s*[—–-]\s*/,"")||"Окреме завдання");
function selectedRole(){
 const requested=new URLSearchParams(location.search).get("role");
 if(!requested&&['PG-48','PG-49','PG-50','PG-51','PG-52','PG-53','PG-54'].includes(pageId))return manifest.roles.find(r=>r.id==='R05');
 const fallback=base.demo.actors.find(a=>a.account_id===actor)?.professional_role;
 return manifest.roles.find(r=>r.id===(requested||sessionStorage.getItem(roleKey)||fallback))||manifest.roles[0];
}
const roleHome=(role=selectedRole())=>url("index.html",{role:role.id});
const flowHome=(workflow="",role=selectedRole())=>url("workflows.html",{role:role.id,workflow});
function pageLink(p,role=selectedRole()){
 return p.file?url(p.file,{role:role.id}):url("page-preview.html",{role:role.id,page:p.id});
}
function pageCards(ids){
 return '<div class="catalog-grid">'+ids.map(id=>manifest.pages.find(p=>p.id===id)).filter(Boolean).map(p=>
 '<article class="card catalog-card"><header>'+badge(p.file?"interactive":"planned",p.file?"Можна відкрити":"Сторінка готується")+'</header><h3>'+esc(p.title)+'</h3><p>'+esc(human(p.actions))+'</p>'+
 (p.file?button("Відкрити сторінку →",pageLink(p),true):'<a href="'+pageLink(p)+'">Що буде на цій сторінці →</a>')+'</article>').join("")+'</div>';
}
function flowCards(role=selectedRole()){
 return '<div class="flow-grid">'+role.workflows.map(code=>manifest.workflows.find(w=>w.id===code)).filter(Boolean).map(w=>
 '<a class="flow-card" href="'+flowHome(w.id,role)+'"><span class="eyebrow">Робочий процес</span><h3>'+esc(workflowTitle(w.id))+'</h3><p>'+esc(human(w.actions))+'</p><span>Переглянути кроки →</span></a>').join("")+'</div>';
}
function roleNav(){
 const role=selectedRole();
 if(role.id==='R05-M')return '<div class="role-switch"><label>Перегляд ролі<select id="role-view" aria-label="Перегляд ролі">'+manifest.roles.map(r=>'<option value="'+r.id+'"'+(r.id===role.id?' selected':'')+'>'+esc(r.title)+'</option>').join('')+'</select></label></div><div class="nav-group"><p class="nav-label">Музейна робота</p><nav aria-label="Робочі сторінки">'+[[56,'Експозиції'],[59,'Точки доступу']].map(([n,title])=>{const active=pageId==='PG-'+n||n===56&&['catalog','workflows','PG-01','PG-57','PG-58'].includes(pageId)||n===59&&pageId==='PG-60';return '<a href="'+pg(n,{role:'R05-M'})+'"'+(active?' aria-current="page"':'')+'>'+title+'</a>';}).join('')+'</nav></div>';
 if(role.id==='R05')return '<div class="role-switch"><label>Перегляд ролі<select id="role-view" aria-label="Перегляд ролі">'+manifest.roles.map(r=>'<option value="'+r.id+'"'+(r.id===role.id?' selected':'')+'>'+esc(r.title)+'</option>').join('')+'</select></label></div><div class="nav-group"><p class="nav-label">Відкривайте та зберігайте</p><nav aria-label="Робочі сторінки">'+[[48,'Головна'],[49,'Каталог'],[53,'Мої добірки'],[55,'Цитування та експорт']].map(([n,title])=>{const active=pageId==='PG-'+n||n===48&&['catalog','workflows','PG-01'].includes(pageId)||n===49&&['PG-50','PG-51','PG-52'].includes(pageId)||n===53&&pageId==='PG-54';return '<a href="'+pg(n,{role:'R05'})+'"'+(active?' aria-current="page"':'')+'>'+title+'</a>';}).join('')+'</nav></div>';
 if(role.id==='R04')return '<div class="role-switch"><label>Перегляд ролі<select id="role-view" aria-label="Перегляд ролі">'+manifest.roles.map(r=>'<option value="'+r.id+'"'+(r.id===role.id?' selected':'')+'>'+esc(r.title)+'</option>').join('')+'</select></label></div><div class="nav-group"><p class="nav-label">Дослідницька робота</p><nav aria-label="Робочі сторінки">'+[[41,'Пошук джерел'],[42,'Збережені пошуки'],[43,'Мої корпуси'],[46,'Мої твердження'],[47,'Мої пропозиції'],[55,'Цитування та експорт']].map(([n,title])=>{const active=pageId==='PG-'+n||n===41&&['catalog','workflows','PG-01'].includes(pageId)||n===43&&pageId==='PG-44'||pageId==='PG-45'&&n===(new URLSearchParams(location.search).has('corpus')?43:41);return '<a href="'+pg(n,{role:'R04'})+'"'+(active?' aria-current="page"':'')+'>'+title+'</a>';}).join('')+'</nav></div>';
 if(role.id==='R01')return '<div class="role-switch"><label>Перегляд ролі<select id="role-view" aria-label="Перегляд ролі">'+manifest.roles.map(r=>'<option value="'+r.id+'"'+(r.id===role.id?' selected':'')+'>'+esc(r.title)+'</option>').join('')+'</select></label></div><div class="nav-group"><p class="nav-label">Польова робота</p><nav aria-label="Робочі сторінки">'+[[4,'Дослідження'],[7,'Сеанси'],[6,'Контакти та зустрічі'],[9,'Польові зошити'],[10,'Передання'],[12,'Тексти'],[15,'Глосарій'],[25,'Згоди']].map(([n,title])=>{const active=pageId==='PG-'+String(n).padStart(2,'0')||n===4&&['catalog','workflows','PG-01','PG-05'].includes(pageId)||n===7&&['PG-08','PG-17','PG-35'].includes(pageId)||n===10&&pageId==='PG-11'||n===12&&['PG-13','PG-14'].includes(pageId);return '<a href="'+pg(n,{role:'R01',...(n===10?{tab:'outgoing'}:{})})+'"'+(active?' aria-current="page"':'')+'>'+title+'</a>';}).join('')+'</nav></div>';
 if(role.id==='R02')return '<div class="role-switch"><label>Перегляд ролі<select id="role-view" aria-label="Перегляд ролі">'+manifest.roles.map(r=>'<option value="'+r.id+'"'+(r.id===role.id?' selected':'')+'>'+esc(r.title)+'</option>').join('')+'</select></label></div><div class="nav-group"><p class="nav-label">Архівна робота</p><nav aria-label="Робочі сторінки">'+[[10,'Надходження'],[17,'Матеріали'],[16,'Структура архіву'],[21,'Спадкові джерела'],[18,'Особи, місця, установи'],[20,'Довідники'],[23,'Перевірка'],[26,'Доступ'],[27,'Публікації'],[56,'Запити музею'],[12,'Тексти'],[25,'Згоди'],[29,'Депонування']].map(([n,title])=>{const active=pageId==='PG-'+String(n).padStart(2,'0')||n===10&&['catalog','workflows','PG-01','PG-11','PG-39'].includes(pageId)||n===12&&['PG-13','PG-14','PG-15'].includes(pageId)||n===29&&pageId==='PG-30'||n===23&&pageId==='PG-24'||n===27&&pageId==='PG-28'||n===21&&pageId==='PG-22'||n===18&&pageId==='PG-19';return '<a href="'+pg(n,{role:'R02'})+'"'+(active?' aria-current="page"':'')+'>'+title+'</a>';}).join('')+'</nav></div>';
 if(role.id==='R03')return '<div class="role-switch"><label>Перегляд ролі<select id="role-view" aria-label="Перегляд ролі">'+manifest.roles.map(r=>'<option value="'+r.id+'"'+(r.id===role.id?' selected':'')+'>'+esc(r.title)+'</option>').join('')+'</select></label></div><div class="nav-group"><p class="nav-label">Оцифрування та збереження</p><nav aria-label="Робочі сторінки">'+[[34,'Оцифрування'],[31,'Фізичні носії'],[37,'Цифрові ресурси'],[39,'Збереження копій'],[33,'Місця зберігання'],[40,'Машинне опрацювання'],[12,'Тексти']].map(([n,title])=>{const active=pageId==='PG-'+n||n===34&&['catalog','workflows','PG-35','PG-36'].includes(pageId)||n===31&&pageId==='PG-32'||n===37&&pageId==='PG-38'||n===12&&['PG-13','PG-14','PG-15'].includes(pageId);return '<a href="'+pg(n,{role:'R03'})+'"'+(active?' aria-current="page"':'')+'>'+title+'</a>';}).join('')+'</nav></div>';
 const entry=role.groups[0].pages.filter(id=>!["PG-03","PG-11","PG-14"].includes(id)).slice(0,5);
 return '<div class="role-switch"><label for="role-view">Перегляд ролі<select id="role-view" aria-label="Перегляд ролі">'+manifest.roles.map(r=>'<option value="'+r.id+'"'+(role.id===r.id?' selected':'')+'>'+esc(r.title)+'</option>').join("")+'</select></label></div>'+
 '<div class="nav-group"><p class="nav-label">Робочі процеси</p><nav aria-label="Робочі процеси"><a href="'+flowHome()+'"'+(pageId==="workflows"?' aria-current="page"':'')+'>Кроки та передання</a><a href="'+roleHome()+'">Сторінки моєї ролі</a></nav></div>'+
 '<div class="nav-group"><p class="nav-label">Робочі сторінки</p><nav aria-label="Робочі сторінки">'+entry.map(id=>{const p=manifest.pages.find(p=>p.id===id);return '<a href="'+pageLink(p)+'"><span>'+esc(p.title)+(p.file?'':'<small class="nav-upcoming">Готується</small>')+'</span></a>';}).join("")+'</nav><a class="all-role-pages" href="'+roleHome()+'">Усі сторінки ролі →</a></div>';
}
function processGroups(){
 const st=s(),visible=tasks(st,actor,currentScope());
 const groups=[...new Set(visible.map(t=>t.workflow_run_id).filter(Boolean))];
 if(!groups.length)return empty("Немає поточних процесів","У вибраній області ще немає доступної роботи.");
 return '<div class="process-runs">'+groups.map(id=>{
  const run=st.tables.workflow_run.find(w=>w.id===id),items=visible.filter(t=>t.workflow_run_id===id);
  const current=items.filter(t=>!["done","cancelled"].includes(t.state));
  const archive=st.tables.archive.find(a=>a.id===run.primary_entity_id);
  return '<section class="panel process-run"><header class="panel-head"><div><span class="eyebrow">'+esc(archive?.name||"Поточна робота")+'</span><h2>'+esc(workflowTitle(run.workflow_code))+'</h2></div><a href="'+flowHome(run.workflow_code)+'">Кроки процесу →</a></header><div class="panel-body"><div class="run-state">'+badge(run.state,({open:"Розпочато",in_progress:"Триває",completed:"Завершено",blocked:"Призупинено",cancelled:"Скасовано"})[run.state])+'<span>'+current.length+' незавершених завдань</span></div><ol class="run-tasks">'+items.map(t=>'<li><div><a href="'+pg(3,{id:t.id,role:selectedRole().id})+'">'+esc(t.title)+'</a><small>'+esc(actorLabel(t.assigned_account_id))+'</small></div>'+badge(t.state)+'</li>').join("")+'</ol></div></section>';
 }).join("")+'</div>';
}
function workflows(){
 const role=selectedRole(),code=new URLSearchParams(location.search).get("workflow");
 if(!code){shell(heading("Робочі процеси",role.title,"Оберіть процес, щоб побачити його кроки, робочі сторінки та очікуваний результат.",button("Сторінки ролі",roleHome(),true))+flowCards(role));return;}
 const w=manifest.workflows.find(w=>w.id===code);
 if(!w){shell(heading("Робочі процеси","Процес не знайдено","Поверніться до переліку процесів.",button("Усі процеси ролі",flowHome(),true)));return;}
 const relatedTasks=tasks(s(),actor,currentScope()).filter(t=>s().tables.workflow_run.find(r=>r.id===t.workflow_run_id)?.workflow_code===code);
 shell(heading(role.title,workflowTitle(code),"Орієнтовна послідовність роботи. До попереднього кроку можна повернутися; доступ перевіряється окремо для кожної дії.",button("← Процеси ролі",flowHome(),true))+
 '<div class="workflow-summary"><section class="card"><h2>Що робимо</h2><p>'+esc(human(w.actions))+'</p></section><section class="card"><h2>Результат і передання</h2><p>'+esc(human(w.outcome))+'</p></section></div>'+
 '<ol class="workflow-steps">'+w.pages.map((id,i)=>{const p=manifest.pages.find(p=>p.id===id);return '<li class="workflow-step"><span class="step-number">'+(i+1)+'</span><div><h2>'+esc(p.title)+'</h2><p>'+esc(human(p.actions))+'</p>'+badge(p.file?"interactive":"planned",p.file?"Можна відкрити":"Сторінка готується")+'<div class="actions">'+(p.file?button("Відкрити сторінку",pageLink(p),true):'<a href="'+pageLink(p)+'">Що буде на цій сторінці →</a>')+'</div></div></li>';}).join("")+'</ol>'+
 panel("Завдання цього процесу",taskTable(relatedTasks),'<a href="'+pg(2,{workflow:code})+'">Відкрити чергу →</a>'));
}
function pagePreview(){
 const id=new URLSearchParams(location.search).get("page"),p=manifest.pages.find(p=>p.id===id);
 if(!p){shell(heading("Робоча сторінка","Сторінку не знайдено","Оберіть сторінку з переліку своєї ролі.",button("До сторінок ролі",roleHome(),true)));return;}
 shell(heading(selectedRole().title,p.title,"Цю робочу сторінку ще готуємо.",button("← До сторінок ролі",roleHome(),true))+
 '<div class="notice">Зараз доступний опис призначення сторінки. Форма роботи з матеріалами ще не реалізована.</div>'+
 panel("Для чого потрібна ця сторінка",'<div class="panel-body"><p>'+esc(human(p.actions))+'</p></div>')+
 (p.file?button("Відкрити робочу сторінку",url(p.file)):'')+
 (p.workflows.length?'<h2>Пов’язані процеси</h2><div class="flow-grid">'+p.workflows.map(code=>'<a class="flow-card" href="'+flowHome(code)+'"><h3>'+esc(workflowTitle(code))+'</h3><span>Переглянути кроки →</span></a>').join("")+'</div>':''));
}

function demoBar(){
 return '<div class="demo-bar"><strong>Користувач</strong><span>Повний доступ</span>'+(selectedRole().id==='R05-M'?'<button class="button secondary" id="museum-demo">Відкрити готовий приклад</button>':'')+'<a href="'+url("index.html")+'">Усі ролі</a><button class="reset" id="reset-demo">Скинути демо</button></div>';
}
function navItem(id,label,icon){
 return '<a href="'+pg(id)+'"'+(pageId==="PG-"+String(id).padStart(2,"0")?' aria-current="page"':'')+'><span class="icon" aria-hidden="true">'+icon+'</span>'+label+'</a>';
}
function shell(content){
 app.classList.toggle('public-shell',selectedRole().id==='R05');
 const st=s(),id=identity(),available=scopes(st,actor),allowed=currentScope();
 const isAuthed=!!activeAccount(st,actor);
 const nav=roleNav()+'<div class="nav-group"><p class="nav-label">Спільні інструменти</p><nav>'+
 (isAuthed&&!['R01','R02','R03','R04','R05','R05-M'].includes(selectedRole().id)?navItem(1,"Робочий простір","⌂")+navItem(2,"Завдання","☷"):'')+
 navItem(isAuthed?64:63,isAuthed?"Мій обліковий запис":"Увійти","○")+'</nav></div>'+
 (selectedRole().id!=='R05'&&(can(st,actor,"account.manage")||can(st,actor,"settings.manage"))?'<div class="nav-group"><p class="nav-label">Адміністрування</p><nav>'+
 (can(st,actor,"account.manage")?navItem(65,"Користувачі та права","⚿"):'')+
 (can(st,actor,"settings.manage")?navItem(66,"Налаштування","⚙"):'')+'</nav></div>':'');
 const alert=notice?'<div class="notice '+esc(noticeType)+'" role="'+(noticeType==="error"?"alert":"status")+'">'+esc(notice)+'</div>':'';
 if(pageId==="PG-63"){
   app.innerHTML=demoBar()+'<div class="plain-shell"><header class="plain-top"><a class="brand" href="'+url("index.html")+'"><span class="brand-mark" aria-hidden="true">h</span>hereditas</a><span class="muted">Вхід до робочого простору</span></header><main id="main" class="main">'+alert+content+'</main></div>';
 }else{
 app.innerHTML=demoBar()+'<div id="external-update"></div><div class="shell"><aside class="sidebar compact-sidebar"><div><a class="brand" href="'+pg(1)+'"><span class="brand-mark" aria-hidden="true">h</span>hereditas</a><p class="brand-caption">Архів культурної спадщини</p></div><button class="mobile-menu" id="mobile-menu" type="button" aria-expanded="false">Меню</button>'+nav+
 '<div class="sidebar-bottom"><div class="person"><span class="avatar">'+esc(id.initials)+'</span><div><strong>'+esc(id.name)+'</strong><br><small>'+esc(id.context)+'</small></div></div></div></aside>'+
 '<div class="content-column"><header class="topbar"><div class="crumb">Hereditas <span aria-hidden="true"> / </span> '+esc(manifest.pages.find(p=>p.id===pageId)?.title||(pageId==="catalog"?"Робочі простори":pageId==="workflows"?"Робочі процеси":pageId==="page-preview"?"Робоча сторінка":"Спільні компоненти"))+'</div>'+
 '<label for="scope">Область роботи<select id="scope"><option value="">'+(available.length?"Усі доступні архіви":"Немає архівного доступу")+'</option>'+available.map(a=>'<option value="'+a.id+'"'+(allowed===a.id?' selected':'')+'>'+esc(a.name)+'</option>').join("")+'</select></label></header>'+
 '<main id="main" class="main">'+alert+content+'</main></div></div>';
 }
 const crumb=app.querySelector('.crumb');if(crumb)crumb.textContent='Hereditas / '+(app.querySelector('h1')?.textContent||'Робочий простір');
 if(selectedRole().id==='R05')app.querySelector('.topbar label[for="scope"]')?.remove();
 labelFields(app);
 bindHelp(app);
 bindShell();
}
function heading(kicker,title,description,action=""){
 return '<div class="page-heading"><div><p class="eyebrow">'+esc(kicker)+'</p><h1 tabindex="-1">'+esc(title)+'</h1></div>'+action+'</div><details class="page-help"><summary>Як користуватися</summary><div><p>'+esc(human(description))+'</p><p>Оберіть роль у меню ліворуч, щоб побачити її процеси й робочі сторінки. Усі розділи доступні користувачу з правами адміністратора.</p><p>Це приклад роботи з даними. Зміни зберігаються у цьому браузері.</p></div></details>';
}
function panel(title,body,aside="",footer=""){
 return '<section class="panel"><header class="panel-head"><h2>'+esc(title)+'</h2>'+aside+'</header>'+body+(footer?'<footer class="panel-footer">'+footer+'</footer>':'')+'</section>';
}
function empty(title,text){return '<div class="empty"><h2>'+esc(title)+'</h2><p>'+esc(text)+'</p></div>';}
function denied(){
 shell(heading("Обмежений доступ","Ця сторінка недоступна","Потрібен активний акаунт і відповідний дозвіл у цій області.")+
 '<div class="notice warning">Професійна роль сама по собі не надає прав.</div>'+
 button(activeAccount(s(),actor)?"Переглянути мій доступ":"Увійти",pg(activeAccount(s(),actor)?64:63)));
}
function taskTable(rows,{showArchive=false}={}){
 if(!rows.length)return empty("Немає завдань","У цій області або за цими фільтрами немає доступних завдань.");
 const st=s();
 return '<div class="table-wrap"><table><thead><tr><th>Завдання</th><th>Стан</th><th>Виконавець</th><th>Строк</th></tr></thead><tbody>'+
 rows.map(t=>'<tr><td class="task-title"><a href="'+pg(3,{id:t.id})+'">'+esc(t.title)+'</a><span class="sub">'+esc(workflowTitle(st.tables.workflow_run.find(w=>w.id===t.workflow_run_id)?.workflow_code))+
 (showArchive?" · "+esc(st.tables.archive.find(a=>a.id===t.archive_id)?.name):"")+'</span></td><td>'+badge(t.state)+'</td><td>'+esc(actorLabel(t.assigned_account_id))+'</td><td>'+esc(date(t.due_at))+'</td></tr>').join("")+'</tbody></table></div>';
}
function workspace(){
 const st=s(),all=tasks(st,actor,currentScope()),open=all.filter(t=>!["done","cancelled"].includes(t.state)),mine=open.filter(t=>t.assigned_account_id===actor),blocked=open.filter(t=>t.state==="blocked");
 shell(heading("Моя робота",selectedRole().title,"Поточні процеси, їхні кроки та матеріали, що потребують уваги.",button("Сторінки моєї ролі",roleHome()))+
 '<div class="workspace-entry">'+button("Переглянути процеси",flowHome(),true)+'<a href="'+pg(2)+'">Спільна черга завдань →</a></div>'+
 '<h2>Поточна робота за процесами</h2>'+processGroups()+
 '<h2 class="section-space">Увага до завдань</h2><div class="cards">'+[
 ["Незавершені",open.length,"У доступній області"],["Призначено мені",mine.length,"Моя відповідальність"],["Заблоковані",blocked.length,"Потребують вирішення передумов"]
 ].map(([title,count,note])=>'<section class="card metric-card"><div class="top"><span class="metric-label">'+title+'</span></div><div class="metric">'+count+'</div><small>'+note+'</small></section>').join("")+'</div>'+
 '<h2>Усі процеси цієї ролі</h2>'+flowCards());
}
function taskList(){
 const st=s(),params=new URLSearchParams(location.search),q=params.get("q")||"",status=params.get("state")||"",owner=params.get("owner")||"",workflow=params.get("workflow")||"",due=params.get("due")||"",sort=params.get("sort")||"due",page=Math.max(1,Number(params.get("page"))||1);
 const all=tasks(st,actor,currentScope()),workflowCode=t=>st.tables.workflow_run.find(w=>w.id===t.workflow_run_id)?.workflow_code||"";
 const filtered=all.filter(t=>(!q||t.title.toLocaleLowerCase("uk").includes(q.toLocaleLowerCase("uk")))&&(!status||t.state===status)&&
 (!owner||(owner==="me"?t.assigned_account_id===actor:owner==="unassigned"?!t.assigned_account_id:t.assigned_account_id===owner))&&
 (!workflow||workflowCode(t)===workflow)&&
 (!due||(due==="unknown"?!t.due_at:due==="overdue"?t.due_at&&Date.parse(t.due_at)<Date.parse(st.clock)&&!["done","cancelled"].includes(t.state):t.due_at&&Date.parse(t.due_at)>=Date.parse(st.clock))));
 filtered.sort((a,b)=>sort==="title"?a.title.localeCompare(b.title,"uk"):(a.due_at?Date.parse(a.due_at):Infinity)-(b.due_at?Date.parse(b.due_at):Infinity)||a.title.localeCompare(b.title,"uk"));
 const totalPages=Math.max(1,Math.ceil(filtered.length/8)),pageNo=Math.min(page,totalPages);
 const canCreate=scopes(st,actor).some(a=>can(st,actor,"task.create",a.id));
 const option=(value,label,selected)=>'<option value="'+esc(value)+'"'+(value===selected?' selected':'')+'>'+esc(label)+'</option>';
 const query={q,state:status,owner,workflow,due,sort};
 shell(heading("Спільна черга","Завдання та невирішені питання","Відстежуйте роботу, її підстави та залежності. Стан завдання не змінює доступ або публікацію матеріалу.",
 canCreate?'<button class="button" id="new-task">＋ Створити завдання</button>':'')+
 '<form class="filters" id="task-filters"><label class="search">Пошук<input name="q" value="'+esc(q)+'" placeholder="Назва завдання"></label><label>Стан<select name="state"><option value="">Усі стани</option>'+["open","assigned","in_progress","blocked","done","cancelled"].map(v=>option(v,stateLabels[v],status)).join("")+'</select></label>'+
 '<label>Виконавець<select name="owner"><option value="">Усі доступні</option>'+option("me","Призначено мені",owner)+option("unassigned","Не призначено",owner)+[...new Set(all.map(t=>t.assigned_account_id).filter(Boolean))].map(id=>option(id,actorLabel(id),owner)).join("")+'</select></label>'+
 '<label>Процес<select name="workflow"><option value="">Усі процеси</option>'+[...new Set(all.map(workflowCode).filter(Boolean))].map(w=>option(w,workflowTitle(w),workflow)).join("")+'</select></label>'+
 '<label>Строк<select name="due"><option value="">Усі строки</option>'+[["overdue","Прострочені"],["upcoming","Майбутні"],["unknown","Не визначено"]].map(([v,l])=>option(v,l,due)).join("")+'</select></label>'+
 '<label>Порядок<select name="sort">'+option("due","За строком",sort)+option("title","За назвою",sort)+'</select></label><button class="button secondary">Застосувати</button></form>'+
 panel("Доступні завдання",taskTable(filtered.slice((pageNo-1)*8,pageNo*8),{showArchive:true})+
 '<div class="pagination"><span>'+filtered.length+' результатів · Сторінка '+pageNo+' / '+totalPages+'</span><div>'+
 (pageNo>1?'<a href="'+pg(2,{...query,page:pageNo-1})+'">← Попередня</a>':'')+' '+
 (pageNo<totalPages?'<a href="'+pg(2,{...query,page:pageNo+1})+'">Наступна →</a>':'')+'</div></div>'));
 document.getElementById("task-filters").onsubmit=e=>{e.preventDefault();const data=new FormData(e.target);location.href=pg(2,Object.fromEntries(data));};
 document.getElementById("new-task")?.addEventListener("click",createTaskDialog);
}
function createTaskDialog(){
 const st=s(),archives=scopes(st,actor).filter(a=>can(st,actor,"task.create",a.id));
 dialog("Нове завдання",'<label>Назва<input name="title" required maxlength="240"></label><label>Архів<select name="archive_id">'+archives.map(a=>'<option value="'+a.id+'">'+esc(a.name)+'</option>').join("")+'</select></label><label>Строк (необов’язково)<input name="due" type="date"></label><label>Підстава<textarea name="reason" required></textarea></label>',async data=>{
  const result=await store.dispatch(actor,{type:"task.create",title:data.get("title"),archive_id:data.get("archive_id"),reason:data.get("reason"),due_at:data.get("due")?data.get("due")+"T12:00:00.000Z":null});
  location.href=pg(3,{id:result.id});
 },"Створити");
}
function taskDetail(){
 const id=new URLSearchParams(location.search).get("id")||base.demo.ids["task-package"],st=s(),task=taskView(st,actor,id);
 if(!task){denied();return;}
 if(["museum_publication_request","museum_correction_request"].includes(task.kind)){shell(heading("Звернення до архіву",task.title,"",button("Відкрити звернення",pg(56,{role:can(st,actor,"task.assign",task.archive_id)?"R02":"R05-M",tab:"requests",id}))));return;}
 if(task.kind==='rights_review'){const target=st.tables.work_item_target.find(x=>x.work_item_id===id),decisions=st.tables.access_decision.filter(d=>d.target_entity_id===target?.entity_id);shell(heading('Права й етика',task.title,'Зафіксуйте висновок під час поновлення рішення про доступ. Завдання не надає дозволів.',button('← До черги',pg(2),true))+panel('Питання та висновок','<div class="panel-body">'+task.events.map(e=>'<p>'+esc(e.reason)+'</p>').join('')+'<p>'+esc(task.resolution||'Висновок ще не зафіксовано')+'</p></div>')+panel('Рішення для перегляду','<div class="panel-body">'+(decisions.map(d=>'<p>'+button(({public:'Публічний показ',research:'Дослідницька робота',deposit:'Депонування',processing:'Машинне опрацювання'})[d.purpose_code]||'Переглянути рішення',pg(26,{role:'R02',id:d.id}),true)+'</p>').join('')||button('Ухвалити рішення',pg(26,{role:'R02',source:target?.entity_id}),true))+'</div>'));return;}
 if(task.kind==='processing_review'){const target=st.tables.work_item_target.find(x=>x.work_item_id===id),candidate=st.tables.candidate.find(x=>x.id===target?.entity_id);shell(heading('Машинний результат',task.title,'Пропозиція потребує окремого людського рішення.',button('Перевірити пропозицію',pg(40,{role:'R03',id:candidate?.process_run_id,candidate:candidate?.id}))));return;}
 if(task.kind==='preservation_review'){const target=st.tables.work_item_target.find(x=>x.work_item_id===id),copy=st.tables.storage_copy.find(x=>x.id===target?.entity_id);shell(heading('Збереження копій',task.title,'Питання завершується після повторного читання копії та збігу контрольної суми.',button('Перевірити копію',pg(39,{role:'R03',id:copy?.file_id})))+panel('Зауваження','<div class="panel-body">'+task.events.map(x=>'<p>'+esc(x.reason)+'</p>').join('')+'</div>'));return;}
 if(task.kind==='quality_review'){const target=st.tables.work_item_target.find(x=>x.work_item_id===id);shell(heading('Контроль якості',task.title,'Питання завершується після технічного приймання цього або пов’язаного повторного результату.',button('Перевірити результат',pg(36,{role:'R03',id:target?.entity_id})))+panel('Зауваження','<div class="panel-body">'+task.events.map(x=>'<p>'+esc(x.reason)+'</p>').join('')+'</div>'));return;}
 if(task.kind==='capture_preparation_review'){const target=st.tables.work_item_target.find(x=>x.work_item_id===id);shell(heading('Підготовка носія',task.title,'Питання завершується після перевірки й підтвердження готовності.',button('Підготувати носій',pg(34,{role:'R03',id:target?.entity_id})))+panel('Що потрібно усунути','<div class="panel-body">'+task.events.map(x=>'<p>'+esc(x.reason)+'</p>').join('')+'</div>'));return;}
 if(task.kind==='text_review'){const target=st.tables.work_item_target.find(x=>x.work_item_id===id);shell(heading('Перевірка тексту',task.title,'',button('Відкрити текст',pg(14,{role:'R02',id:target?.entity_id}))));return;}
 if(['reconciliation_review','catalog_review'].includes(task.kind)){const target=st.tables.work_item_target.find(x=>x.work_item_id===id);const record=st.tables.catalog_record?.find(x=>x.id===target?.entity_id);shell(heading('Перевірка',task.title,'',button('Розглянути',pg(24,{role:'R02',id:target?.entity_id}))+(record?button('Відкрити матеріал',pg(17,{role:'R02',material:record.subject_entity_id,section:'review'}),true):'')));return;}
 if(task.kind==='archival_review'){const target=st.tables.work_item_target.find(x=>x.work_item_id===id&&st.tables.candidate.some(c=>c.id===x.entity_id));shell(heading('Перевірка',task.title,'',button('Відкрити пропозицію',pg(24,{role:'R02',id:target?.entity_id}))));return;}
 const archive=st.tables.archive.find(a=>a.id===task.archive_id),revision=st.tables.entity_revision.find(r=>r.id===task.revision_id);
 const allowed=can(st,actor,"task.work",task.archive_id)&&(!task.assigned_account_id||task.assigned_account_id===actor||can(st,actor,"task.assign",task.archive_id));
 const actions=[];
 if(allowed){
  if(task.state==="open")actions.push(["take","Взяти завдання"]);
  if(["assigned","blocked"].includes(task.state))actions.push(["start","Почати роботу"]);
  if(["open","assigned","in_progress"].includes(task.state))actions.push(["block","Заблокувати"]);
  if(["assigned","in_progress","blocked"].includes(task.state))actions.push(["return","Повернути в чергу"]);
  if(task.state==="in_progress")actions.push(["complete","Завершити"]);
 }
 shell(heading("Завдання · версія "+revision.revision_no,task.title,"Підстава, виконавець і зміни стану зберігаються разом з історією.",button("← До черги",pg(2),true))+
 (task.unresolved_dependencies.length?'<div class="notice warning"><strong>Роботу заблоковано передумовою.</strong> Спочатку завершіть: '+task.unresolved_dependencies.map(id=>'<a href="'+pg(3,{id})+'">'+esc(tasks(st,actor).find(t=>t.id===id)?.title||"Залежне завдання")+'</a>').join(", ")+'.</div>':'')+
 '<div class="two-col"><div>'+panel("Робота із завданням",'<div class="panel-body">'+badge(task.state)+
 '<dl class="detail-list"><div><dt>Виконавець</dt><dd>'+esc(actorLabel(task.assigned_account_id))+'</dd></div><div><dt>Строк</dt><dd>'+date(task.due_at)+'</dd></div><div><dt>Результат</dt><dd>'+esc(task.resolution||"Ще не зафіксовано")+'</dd></div></dl>'+
 '<div class="actions">'+actions.map(([action,label])=>'<button class="button '+(["block","return"].includes(action)?"secondary":"")+'" data-task-action="'+action+'"'+(task.unresolved_dependencies.length&&["start","complete"].includes(action)?' disabled title="Спочатку завершіть залежне завдання"':'')+'>'+label+'</button>').join("")+
 (can(st,actor,"task.assign",task.archive_id)&&!["done","cancelled"].includes(task.state)?'<button class="button secondary" id="assign-task">Призначити виконавця</button>':'')+
 '</div>'+(!allowed&&!["done","cancelled"].includes(task.state)?'<p class="form-note">Змінювати це завдання може призначений виконавець або координатор.</p>':'')+'</div>')+
 panel("Історія",'<div class="panel-body"><ol class="timeline">'+[...task.events].reverse().map(e=>'<li><strong>'+esc(stateLabels[e.from_state]||"Створено")+' → '+esc(stateLabels[e.to_state])+'</strong><p style="margin:6px 0">'+esc(e.reason)+'</p><small>'+esc(actorLabel(e.actor_account_id))+' · '+date(e.occurred_at)+'</small></li>').join("")+'</ol></div>')+'</div><aside>'+
 panel("Архівний контекст",'<div class="panel-body"><dl class="detail-list"><div><dt>Область</dt><dd>'+esc(archive.name)+'</dd></div><div><dt>Процес</dt><dd>'+esc(workflowTitle(st.tables.workflow_run.find(w=>w.id===task.workflow_run_id)?.workflow_code))+'</dd></div></dl></div>')+
 panel("Цілі та точні версії",'<div class="panel-body">'+task.targets.map(t=>t.restricted?'<p>Ціль недоступна.</p>':'<div class="scope-card"><strong>'+esc(t.label)+'</strong><p>Зафіксована версія '+t.revision_no+'</p>'+button('Відкрити матеріал',t.type==='catalog_record'?pg(17,{role:'R02',material:st.tables.catalog_record.find(r=>r.id===t.entity_id)?.subject_entity_id,section:'review'}):pg(({archive:16,source_record:22,physical_object:32,collecting_session:8,field_research:5,information_unit:17})[t.type]||17,{id:t.entity_id,role:'R02'}),true)+'</div>').join("")+'</div>','', 'Завершення цього завдання не приймає, не публікує й не відкриває його цілі.')+'</aside></div>');
 document.querySelectorAll("[data-task-action]").forEach(b=>b.onclick=()=>dialog(b.textContent,'<label>Підстава / результат<textarea name="reason"'+(["block","return","complete"].includes(b.dataset.taskAction)?' required':'')+'></textarea></label>',async data=>{
   await store.dispatch(actor,{type:"task.transition",id,expected_revision_id:task.revision_id,action:b.dataset.taskAction,reason:data.get("reason")});
   flash("Зміну збережено. Створено нову версію завдання та подію історії.");render();
 },"Підтвердити"));
 document.getElementById("assign-task")?.addEventListener("click",()=>{
  const people=st.tables.account.filter(a=>can(st,a.id,"task.work",task.archive_id));
  dialog("Призначити виконавця",'<label>Обліковий запис<select name="account_id">'+people.map(a=>'<option value="'+a.id+'">'+esc(actorLabel(a.id))+'</option>').join("")+'</select></label><label>Підстава<textarea name="reason" required></textarea></label>',async data=>{
   await store.dispatch(actor,{type:"task.assign",id,expected_revision_id:task.revision_id,account_id:data.get("account_id"),reason:data.get("reason")});flash("Виконавця призначено. Історію збережено.");render();
  },"Призначити");
 });
}
function account(){
 shell(heading('Обліковий запис','Користувач','')+panel('Доступ', '<div class="panel-body"><p>Адміністратор · усі розділи й дії.</p><p>Оберіть роль у меню, щоб перейти до її робочих сторінок.</p>'+button('Усі ролі',url('index.html'),true)+'</div>'));
}
function login(){account();}
function accessAdmin(){
 shell(heading('Адміністрування','Користувачі та права','')+panel('Користувач', '<div class="panel-body"><p>Адміністратор · повний доступ до всіх архівів і розділів.</p><div class="record-tabs">'+manifest.roles.map(role=>button(role.title,roleHome(role),true)).join('')+'</div></div>'));
}

function settings(){
 const st=s(),installation=st.tables.installation[0];
 shell(heading("Адміністрування","Налаштування інсталяції та інтеграцій","Параметри інсталяції, цифрові сховища й конфігурація підключень.")+
 '<div class="settings-grid"><div>'+panel("Інсталяція",'<form class="panel-body" id="settings-form"><label>Назва<input name="name" required value="'+esc(installation.name)+'"></label><label>Базова адреса<input name="base_uri" type="url" required value="'+esc(installation.base_uri)+'"></label><p class="form-note">Код: '+esc(installation.code)+' · Локальна інсталяція</p><div class="form-error" id="settings-error" role="alert"></div><button class="button">Зберегти параметри</button></form>')+
 panel("Інтеграційний профіль",'<div class="panel-body"><p><strong>Навчальний профіль</strong></p><p class="muted">Імпорт, передання матеріалів та обробку ще не підключено.</p><label>Сценарій перевірки<select id="connection-mode"><option value="success">Успішна відповідь</option><option value="failure">Помилка з’єднання</option></select></label><button class="button secondary" id="test-connection">Імітувати перевірку</button><div id="connection-result" role="status" style="margin-top:16px"></div></div>')+'</div><div>'+
 panel("Цифрові сховища",'<div class="panel-body">'+st.tables.digital_storage_location.map(l=>'<div class="scope-card"><strong>'+esc(l.name)+'</strong><p>'+esc(l.failure_domain)+'</p><small>Параметри сховища поки доступні лише для перегляду.</small></div>').join("")+'</div>')+
 panel("Системні та локальні довідники",'<div class="panel-body">'+st.tables.vocabulary_scheme.map(v=>'<p><strong>'+esc(v.name)+'</strong><br><small>'+esc(v.governance_mode==="local"?"Локальне керування":"Системний реєстр")+'</small></p>').join("")+'</div>')+'</div></div>');
 document.getElementById("settings-form").onsubmit=async e=>{
  e.preventDefault();const data=new FormData(e.target);
  try{await store.dispatch(actor,{type:"settings.save",name:data.get("name"),base_uri:data.get("base_uri")});flash("Демонстраційні параметри збережено.");render();}
  catch(error){document.getElementById("settings-error").textContent=error.message;}
 };
 document.getElementById("test-connection").onclick=()=>{
  const failure=document.getElementById("connection-mode").value==="failure";
  const target=document.getElementById("connection-result");target.className="notice"+(failure?" error":"");
  target.textContent=failure?"Демо: з’єднання не вдалося. Перевірте конфігурацію й повторіть сценарій.":"Демо: сервіс доступний. Реальний мережевий запит не виконувався.";
 };
}
function catalog(){
 const requested=new URLSearchParams(location.search).get("role");
 const role=manifest.roles.find(r=>r.id===requested);
 if(!role){
  shell(heading("Hereditas","Робочі простори","Оберіть свою роль: побачите її процеси, послідовність роботи та потрібні сторінки.")+
  '<div class="role-grid">'+manifest.roles.map((r,i)=>'<a class="card role-card" href="'+roleHome(r)+'"><span class="role-symbol" aria-hidden="true">'+["⌁","▤","◉","⌕","❋","▥"][i]+'</span><h2>'+esc(r.title)+'</h2><p>'+r.workflows.length+' робочих процесів · '+r.groups[0].pages.length+' основних сторінок</p><span>Перейти до робочого простору →</span></a>').join("")+'</div>'+
  '<details class="all-pages"><summary>Усі сторінки</summary>'+pageCards(manifest.pages.map(p=>p.id))+'</details>');
  return;
 }
 shell(heading("Робочий простір",role.title,"Почніть із процесу або відкрийте потрібну робочу сторінку.",button("Усі ролі",url("index.html"),true))+
 '<div class="role-tabs"><a href="#processes">Процеси</a><a href="#role-pages">Робочі сторінки</a><a href="#shared-pages">Спільні інструменти</a></div>'+
 '<section id="processes"><h2>Робочі процеси</h2>'+flowCards(role)+'</section>'+
 '<section id="role-pages" class="section-space"><h2>Основні робочі сторінки</h2>'+pageCards(role.groups[0].pages)+'</section>'+
 '<section id="shared-pages" class="section-space"><h2>Спільні інструменти</h2>'+pageCards([...new Set([...role.groups.slice(1).flatMap(g=>g.pages),"PG-64"])])+'</section>');
}
function components(){
 shell(heading("Вигляд і взаємодія","Спільні компоненти","Нова локальна система компонентів. Предметні індикатори залишаються незалежними.")+
 '<div class="two-col"><div>'+panel("Стани завдань",'<div class="panel-body pill-list">'+["open","assigned","in_progress","blocked","done","cancelled"].map(x=>badge(x)).join("")+'</div>')+
 panel("Форма та валідація",'<form class="panel-body" id="lab-form"><label>Назва<input name="title" required></label><p class="form-note">Поле має явний label; помилка не позначається лише кольором.</p><button class="button">Перевірити форму</button><div class="form-error" id="lab-result" role="status"></div></form>')+
 panel("Список",taskTable(tasks(s(),actor).slice(0,2)))+'</div><aside>'+panel("Стани відповіді",'<div class="panel-body"><div class="notice">Зміну збережено.</div><div class="notice warning">Потрібно завершити передумову.</div><div class="notice error">Немає дозволу у вибраній області.</div><button class="button secondary" id="lab-dialog">Відкрити діалог</button></div>')+
 panel("Доступність",'<div class="panel-body"><p>Клавіатурний focus, skip link, native dialog, labels і текстові статуси.</p><p class="muted">Публічний і кіоск-каркаси будуть реалізовані разом із відповідними фазами.</p></div>')+'</aside></div>');
 document.getElementById("lab-form").onsubmit=e=>{e.preventDefault();document.getElementById("lab-result").textContent="Форму перевірено; предметні дані не змінено.";};
 document.getElementById("lab-dialog").onclick=()=>dialog("Приклад діалогу","<p>Escape закриває діалог. Focus повертається до кнопки відкриття.</p>",null,"Закрити");
}
function dialog(title,body,onSubmit,submitLabel="Зберегти"){
 const opener=document.activeElement,d=document.createElement("dialog");
 d.innerHTML='<form id="dialog-form"><header><h2>'+esc(title)+'</h2><button type="button" class="close" aria-label="Закрити діалог">×</button></header>'+body+'<div class="form-error" role="alert"></div><div class="actions"><button class="button" type="submit">'+esc(submitLabel)+'</button><button class="button secondary cancel" type="button">Скасувати</button></div></form>';
 labelFields(d);
 bindHelp(d);
 document.body.append(d);d.setAttribute("aria-label",title);d.showModal();
 const close=()=>d.close();
 d.querySelector(".close").onclick=close;d.querySelector(".cancel").onclick=close;
 d.addEventListener("close",()=>{d.remove();if(opener?.isConnected)opener.focus();else document.querySelector("h1")?.focus();});
 d.querySelector("form").onsubmit=async e=>{
  e.preventDefault();const submit=d.querySelector('[type="submit"]');submit.disabled=true;
  try{if(onSubmit&&await onSubmit(new FormData(e.target))===false){submit.disabled=false;return;}close();}
  catch(error){d.querySelector('[role="alert"]').textContent=error.message;submit.disabled=false;if(error.code==="stale"){flash(error.message,"warning");}}
 };
 return d;
}
function labelFields(container){
 container.querySelectorAll(".table-wrap").forEach(el=>{el.tabIndex=0;el.setAttribute("role","region");el.setAttribute("aria-label","Таблиця; доступне горизонтальне прокручування");});
 container.querySelectorAll("label").forEach((label,index)=>{
  const field=label.querySelector("input,select,textarea");
  if(!field)return;
  const text=Array.from(label.childNodes).filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(" ").trim();
  if(text&&!field.hasAttribute("aria-label"))field.setAttribute("aria-label",text);
  if(!field.id)field.id="field-"+index+"-"+(field.name||"control");
  label.htmlFor=field.id;
 });
}
function bindShell(){
 document.getElementById("museum-demo")?.addEventListener("click",async e=>{
  e.target.disabled=true;
  try{
   actor=base.demo.ids.museum;sessionStorage.setItem(actorKey,actor);scope="";sessionStorage.setItem(scopeKey,"");
   const example=await store.dispatch(actor,{type:'demo.museum.prepare'});
   location.href=pg(57,{role:'R05-M',id:example.exhibition_id});
  }catch(error){flash(error.message,'error');render();}
 });
 document.getElementById("mobile-menu")?.addEventListener("click",e=>{const sidebar=document.querySelector('.sidebar');sidebar.classList.toggle('compact-sidebar');e.target.setAttribute('aria-expanded',String(!sidebar.classList.contains('compact-sidebar')));});
 document.getElementById("role-view")?.addEventListener("change",e=>{
  sessionStorage.setItem(roleKey,e.target.value);
  sessionStorage.setItem(scopeKey,"");
  location.href=roleHome(manifest.roles.find(r=>r.id===e.target.value));
 });
 document.getElementById("scope")?.addEventListener("change",e=>{scope=e.target.value;sessionStorage.setItem(scopeKey,scope);notice="";render();});
 document.getElementById("reset-demo").onclick=()=>dialog("Скинути демонстраційні дані","<p>Створені завдання, зміни станів, призначення прав і параметри буде повернуто до початкового синтетичного набору.</p>",async()=>{const fresh=await prepareDemo(rawFixture,null),old=JSON.parse(localStorage.getItem(storageKey)||"null");localStorage.setItem(storageKey,JSON.stringify({generation:(old?.generation||0)+1,state:fresh.saved.state}));location.href=url("index.html");},"Скинути");
}
function render(){
 const publicCtx={s,actor,scope:currentScope(),esc,pg,button,panel,heading,shell,dialog,render,flash,dispatch:c=>store.dispatch(actor,c),denied,date};
 if(['PG-23','PG-24','PG-26','PG-27','PG-28'].includes(pageId)){archivePages(publicCtx)[pageId]();return;}
 if(['PG-12','PG-13','PG-14','PG-15','PG-25','PG-29','PG-30','PG-40'].includes(pageId)){workbenchPages(publicCtx)[pageId]();return;}
 if(['PG-61','PG-62'].includes(pageId)){museumPages(publicCtx)[pageId]();return;}
 if(selectedRole().id==='R05-M'&&['catalog','workflows','PG-01'].includes(pageId)&&new URLSearchParams(location.search).get('view')!=='processes'&&(pageId!=='catalog'||new URLSearchParams(location.search).has('role'))){museumPages(publicCtx)['PG-56']();return;}
 if(['PG-56','PG-57','PG-58','PG-59','PG-60'].includes(pageId)){museumPages(publicCtx)[pageId]();return;}
 if(selectedRole().id==='R05'&&['catalog','workflows','PG-01'].includes(pageId)&&(pageId!=='catalog'||new URLSearchParams(location.search).has('role'))){publicPages(publicCtx)['PG-48']();return;}
 if(['PG-48','PG-49','PG-50','PG-51','PG-52','PG-53','PG-54'].includes(pageId)||pageId==='PG-55'&&['R05','R05-M'].includes(selectedRole().id)){publicPages(publicCtx)[pageId]();return;}
 if(selectedRole().id==='R04'&&['catalog','workflows','PG-01'].includes(pageId)&&(pageId!=='catalog'||new URLSearchParams(location.search).has('role'))){
  researchPages({s,actor,scope:currentScope(),esc,pg,button,panel,heading,shell,dialog,render,flash,dispatch:c=>store.dispatch(actor,c),denied,date})['PG-41']();return;
 }
 if(selectedRole().id==='R02'&&['catalog','workflows','PG-01'].includes(pageId)&&(pageId!=='catalog'||new URLSearchParams(location.search).has('role'))){
  mediaPages({s,actor,scope:currentScope(),esc,pg,button,panel,heading,shell,dialog,render,flash,dispatch:c=>store.dispatch(actor,c),denied,date})['PG-10']();return;
 }

 if(selectedRole().id==='R01'&&['catalog','workflows','PG-01'].includes(pageId)&&(pageId!=='catalog'||new URLSearchParams(location.search).has('role'))){
  fieldPages({s,actor,scope:currentScope(),esc,pg,button,panel,heading,shell,dialog,render,flash,dispatch:c=>store.dispatch(actor,c),denied,date})['PG-04']();return;
 }

 if(selectedRole().id==='R03'&&['catalog','workflows','PG-01'].includes(pageId)&&(pageId!=='catalog'||new URLSearchParams(location.search).has('role'))){
  mediaPages({s,actor,scope:currentScope(),esc,pg,button,panel,heading,shell,dialog,render,flash,dispatch:c=>store.dispatch(actor,c),denied,date})['PG-34']();return;
 }
 if(pageId==="catalog"){catalog();return;}
 if(pageId==="workflows"){workflows();return;}
 if(pageId==="page-preview"){pagePreview();return;}
 if(pageId==="components"){components();return;}
 if(pageId==="PG-63"){login();return;}
 if(!activeAccount(s(),actor)){denied();return;}
 if(pageId==="PG-65"&&!can(s(),actor,"account.manage")){denied();return;}
 if(pageId==="PG-66"&&!can(s(),actor,"settings.manage")){denied();return;}
 const views={"PG-01":workspace,"PG-02":taskList,"PG-03":taskDetail,"PG-64":account,"PG-65":accessAdmin,"PG-66":settings,
 ...fieldPages({s,actor,scope:currentScope(),esc,pg,button,panel,heading,shell,dialog,render,flash,dispatch:c=>store.dispatch(actor,c),denied,date}),
 ...mediaPages({s,actor,scope:currentScope(),esc,pg,button,panel,heading,shell,dialog,render,flash,dispatch:c=>store.dispatch(actor,c),denied,date}),
 ...researchPages({s,actor,scope:currentScope(),esc,pg,button,panel,heading,shell,dialog,render,flash,dispatch:c=>store.dispatch(actor,c),denied,date})};
 views[pageId]?.();
}
async function prepareDemo(initial,saved){return prepareSessionFeedback(await prepareDelivery(await prepareAnalysis(await prepareReader(await prepareDiscovery(await prepareSingleUser(initial,saved))))));}
async function start(){
 [manifest,rawFixture]=await Promise.all([getJSON("manifest.json"),getJSON("fixtures/base.json")]);
 const existing=localStorage.getItem(storageKey),saved=existing?JSON.parse(existing):null,ready=saved?.state.version===rawFixture.version&&saved.state.demo.single_user===1&&saved.state.demo.session_feedback_v1===1,prepared=ready?{base:saved.state,saved,changed:false}:await prepareDemo(rawFixture,saved);
 base=prepared.base;
 if(prepared.changed){
  if(existing&&!localStorage.getItem(storageKey+'.before-single-user'))localStorage.setItem(storageKey+'.before-single-user',existing);
  localStorage.setItem(storageKey,JSON.stringify(prepared.saved));
 }
 store=createStore(base,{read:()=>{const value=localStorage.getItem(storageKey);return value?JSON.parse(value):null;},write:value=>localStorage.setItem(storageKey,JSON.stringify(value))});
 await store.verify();
 actor=base.demo.default_actor;sessionStorage.setItem(actorKey,actor);
 scope=sessionStorage.getItem(scopeKey)||"";
 const requestedRole=new URLSearchParams(location.search).get("role");
 if(manifest.roles.some(r=>r.id===requestedRole))sessionStorage.setItem(roleKey,requestedRole);
 window.addEventListener("storage",e=>{
  if(e.key!==storageKey)return;
  const incoming=e.newValue?JSON.parse(e.newValue):null;
  if(incoming&&(JSON.stringify(grants(incoming.state,actor))!==JSON.stringify(grants(s(),actor))||JSON.stringify(incoming.state.tables.role_permission)!==JSON.stringify(s().tables.role_permission)||publicAccessStamp(incoming.state)!==publicAccessStamp(s())||['PG-61','PG-62'].includes(pageId)&&museumStamp(incoming.state)!==museumStamp(s()))){
    document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    store.sync();flash("Ваш доступ змінено. Дані й доступні дії оновлено.","warning");render();return;
  }
  // Keep edited form/revision intact. Commands reject stale data; user chooses reload.
  const area=document.getElementById("external-update");
  if(area){area.className="notice warning stale-banner";area.innerHTML='Дані змінено в іншій вкладці. <button class="link-button" id="reload-data">Оновити сторінку</button>';document.getElementById("reload-data").onclick=()=>location.reload();}
 });
 render();
 document.documentElement.dataset.ready="true";
}
start().catch(error=>{
 app.innerHTML='<main id="main" class="main"><h1>Не вдалося відкрити макет</h1><div class="notice error" role="alert">'+esc(error.message)+'</div><p>Запускайте макет через локальний HTTP-сервер. Якщо збережений демостан несумісний, скиньте лише дані цього прототипу.</p><button id="recover-state" class="button">Скинути збережений демостан</button></main>';
 document.getElementById("recover-state").onclick=()=>{localStorage.removeItem(storageKey);location.reload();};
 console.error(error);
});

