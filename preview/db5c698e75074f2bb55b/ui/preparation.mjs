import {preparationKinds,preparationStates,preparationStatus} from '../data/preparation.mjs?v=20260930-wf04';
import {hint} from './help.mjs?v=20260930-wf04';

export function preparationPage(c,r){
 const {st,t,by,rev,label,visible,writable,params,pg,button,panel,heading,esc,body,table,details,input,select,choices,opts,btn,form,action,save,show,edit,tabs,revisionHistory,programmeDialog,sessionWizard,dialog}=c;
 const write=writable(r.id),expected=rev(r.id),command=(type,v={})=>({type,id:r.id,expected_revision_id:expected,...v}),items=t.research_preparation_item.filter(x=>x.research_id===r.id),groups=t.work_group.filter(x=>x.research_id===r.id&&!t.entity.find(e=>e.id===x.id)?.retired_at),status=preparationStatus(st,r.id);
 const sections=[['overview','Огляд'],['route','Маршрут'],['team','Команда'],['documents','Джерела та бланки'],['kit','Комплект']],section=sections.some(x=>x[0]===params.get('section'))?params.get('section'):'overview';
 const url=key=>pg(5,{role:params.get('role')||'R01',id:r.id,section:key});
 const roles=[['leader','Керівник'],['collector','Збирач'],['recordist','Звукозаписувач'],['photographer','Фотограф'],['observer','Спостерігач']];
 action('edit',()=>edit(r,[['title','Назва'],['purpose','Мета','textarea'],['research_questions','Дослідницькі питання','textarea'],['preparation_notes','Територіальні й тематичні межі','textarea'],['date_from','Початок','date'],['date_to','Завершення','date'],['backup_plan','Резервне копіювання','textarea','Вкажіть відповідального, місця копій і частоту перевірки.']]));
 action('programme',()=>programmeDialog(r));
 action('confirm',()=>form('Підтвердити готовність',input('note','Що перевірено і ким','','textarea',true,'Підтвердіть фактичну перевірку обладнання, носіїв, бланків і розподілу обов’язків. Зміни підготовки потребуватимуть нової перевірки.'),fd=>command('field.plan.confirm',{note:fd.get('note')})));
 action('session',()=>sessionWizard(r,true));
 let content='';
 if(section==='overview'){
  const program=by('entity_revision',r.programme_revision_id),confirmation=status.confirmation&&by('document',status.confirmation.document_id);
  content=panel('Готовність до виїзду',body(`<p><strong>${status.confirmed?'Готовність підтверджено':status.ready?'Можна перевірити й підтвердити':'Підготовка триває'}</strong></p>`+(status.missing.length?`<ul>${status.missing.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'')+(confirmation?`<p>${esc(confirmation.body_text)}</p>`:'')+hint('Як визначається готовність','Потрібні мета, межі, програма, маршрут, функції команди, завершений комплект і резервне копіювання. Перевірку виконує відповідальна людина. Чернетки сеансів можна вести окремо.')),btn('Підтвердити готовність','confirm',write&&status.ready&&!status.confirmed)+(status.confirmed?' '+btn('Створити сеанс','session',write):'')+' '+button('Контакти та зустрічі',pg(6,{research:r.id,role:'R01'}),true))+
   panel('Мета та організація',body(details([['Мета',r.purpose],['Питання',r.research_questions],['Межі дослідження',r.preparation_notes],['Період',[r.date_from,r.date_to].filter(Boolean).join(' — ')],['Резервне копіювання',r.backup_plan]])),btn('Редагувати','edit',write))+
   panel('Програма дослідження',body(`<div class="reading-text">${esc(program?.snapshot.body_text||'Програму ще не додано.')}</div>${program?`<small>Версія ${program.revision_no}</small>`:''}`),btn(program?'Оновити програму':'Додати програму','programme',write))+revisionHistory(r.id);
 }else if(section==='team'){
  const groupForm=g=>form(g?'Редагувати групу':'Нова група',input('name','Назва групи',g?.name||'','text',true)+input('notes','Завдання групи',g?.notes||'','textarea'),fd=>command('field.plan.group',{group_id:g?.id,...Object.fromEntries(fd)}));
  const memberForm=(g,m)=>form(m?'Редагувати участь':'Додати учасника',select('person_id','Особа','<option value="">Нова особа</option>'+opts(visible('person'),m?.person_id))+input('person_name','Ім’я нової особи')+select('group_id','Група',opts(groups,g.id,x=>x.name))+select('role_code','Функція',choices(roles,m?.role_code||'collector'))+input('function_text','Конкретні обов’язки',m?.function_text||'','textarea',true),fd=>command('field.plan.member',{member_id:m?.id,...Object.fromEntries(fd)}));
  action('group-add',()=>groupForm(null));
  content=panel('Робочі групи',table(['Група','Завдання','Дії'],groups.map(g=>{action('group-'+g.id,()=>groupForm(g));action('member-add-'+g.id,()=>memberForm(g,null));action('group-remove-'+g.id,()=>form('Завершити роботу групи',body(`<p>${esc(g.name)}</p><p>Спочатку перенесіть учасників або завершіть їхню участь. Попередні сеанси залишаться пов’язаними з групою.</p>`),()=>command('field.plan.group',{group_id:g.id,remove:true})));return [esc(g.name),esc(g.notes||'Не зазначено'),btn('Редагувати','group-'+g.id,write)+' '+btn('Додати учасника','member-add-'+g.id,write)+' '+btn('Завершити роботу','group-remove-'+g.id,write)];})),btn('Нова група','group-add',write));
  const members=t.participation.filter(x=>x.research_id===r.id&&x.work_group_id);
  content+=panel('Учасники й обов’язки',table(['Особа','Група','Функція','Обов’язки','Дії'],members.map(m=>{
   const g=groups.find(x=>x.id===m.work_group_id);action('member-'+m.id,()=>memberForm(g,m));action('member-remove-'+m.id,()=>form('Завершити участь у групі',body(`<p>${esc(label(m.person_id))}</p><p>Попередні сеанси та історія участі збережуться.</p>`),()=>command('field.plan.member',{group_id:g.id,member_id:m.id,remove:true})));
   return [esc(label(m.person_id)),esc(g.name),esc(roles.find(x=>x[0]===m.role_code)?.[1]||m.role_code),esc(m.function_text),btn('Редагувати','member-'+m.id,write)+' '+btn('Завершити участь','member-remove-'+m.id,write)];
  })))+body(hint('Функції учасників','Одна особа може мати кілька функцій. Участь у підготовці не означає присутність у кожному сеансі; її фіксують окремо.'));
 }else if(section==='route'){
  const routes=t.research_route_stop.filter(x=>x.research_id===r.id).sort((a,b)=>a.position-b.position);
  const routeForm=x=>form(x?'Редагувати зупинку':'Додати місце до маршруту',select('place_id','Місце','<option value="">Нове місце</option>'+opts(visible('place'),x?.place_id))+input('place_name','Назва нового місця')+input('planned_at','Час відвідування (UTC)',x?.planned_at?.slice(0,16)||'','datetime-local')+input('notes','Мета зупинки й домовленості',x?.notes||'','textarea'),fd=>command('field.route',{...Object.fromEntries(fd),edit:!!x,position:x?.position}));
  action('route-add',()=>routeForm(null));
  content=panel('Маршрут',table(['Порядок','Місце','Час і мета','Дії'],routes.map((x,i)=>{
   action('route-edit-'+i,()=>routeForm(x));action('route-remove-'+i,()=>form('Прибрати з маршруту',body(`<p>${esc(label(x.place_id))}</p>`),()=>command('field.route',{position:x.position,remove:true})));
   for(const d of [-1,1])action('route-'+i+'-'+d,()=>save(command('field.route',{position:x.position,direction:d})));
   return [String(i+1),esc(label(x.place_id)),esc([x.planned_at?.replace('T',' '),x.notes].filter(Boolean).join(' · ')),btn('Редагувати','route-edit-'+i,write)+' '+btn('Вище','route-'+i+'--1',write&&i>0)+' '+btn('Нижче','route-'+i+'-1',write&&i<routes.length-1)+' '+btn('Прибрати','route-remove-'+i,write)];
  })),btn('Додати місце','route-add',write));
 }else if(section==='documents'){
  const documentForm=(kind,d)=>form(d?'Редагувати документ':kind==='reference'?'Додати джерело':'Підготувати бланк згоди',input('title','Назва',d?.title||'','text',true)+input('body_text',kind==='reference'?'Посилання, відомості та висновки':'Текст бланка',d?.body_text||'','textarea',true,kind==='reference'?'Вкажіть бібліографічний опис, посилання на попередні записи й висновки для програми.':'Це порожній бланк для майбутнього збору згоди. Отриману згоду з доказом фіксують у розділі «Згоди».'),fd=>command('field.plan.document',{kind,document_id:d?.id,document_revision_id:d?rev(d.id):null,...Object.fromEntries(fd)}));
  action('source-add',()=>documentForm('reference',null));action('form-add',()=>documentForm('consent_template',null));
  const docs=t.document.filter(d=>t.document_context.some(x=>x.document_id===d.id&&x.target_entity_id===r.id&&x.context_role==='preparation'));
  content=panel('Джерела та бланки',table(['Документ','Тип','Стан','Дії'],docs.map(d=>{
   const item=items.find(x=>x.related_entity_id===d.id),kind=d.kind==='consent_template'?'consent_template':'reference';
   action('doc-'+d.id,()=>documentForm(kind,d));action('doc-view-'+d.id,()=>dialog(d.title,body(`<div class="reading-text">${esc(d.body_text)}</div>`),null,'Закрити'));
   return [esc(d.title),kind==='reference'?'Джерело':'Бланк згоди',esc(preparationStates.find(x=>x[0]===item?.state)?.[1]||'Не включено в комплект'),btn('Переглянути','doc-view-'+d.id)+' '+btn('Редагувати','doc-'+d.id,write)];
  })),btn('Додати джерело','source-add',write)+' '+btn('Підготувати бланк','form-add',write))+body(hint('Робота з документами','Після підготовки або зміни документа перевірте його в розділі «Комплект». Позначка готовності не надає дозволу на запис чи публікацію.'));
 }else if(section==='kit'){
  const prepForm=(item,i)=>form(item?'Перевірити пункт':'Пункт підготовки',select('kind','Категорія',choices(preparationKinds,item?.kind||'equipment'))+input('description','Що підготувати та результат перевірки',item?.description||'','textarea',true,'Для перешкоди зазначте причину. Для «Не потрібно» поясніть, чому це не стосується поїздки. Для фіксації перелічіть обрані способи.')+select('state','Стан',choices(preparationStates,item?.state||'planned')),fd=>command('field.preparation',{index:i,...Object.fromEntries(fd)}));
  action('prep-add',()=>prepForm(null));action('defaults',()=>save(command('field.plan.defaults')));
  const filter=params.get('kind')||'',rows=items.map((x,i)=>({x,i})).filter(({x})=>!filter||x.kind===filter);
  content=body(`<nav class="record-tabs" aria-label="Категорії комплекту"><a href="${url('kit')}">Усі</a>${preparationKinds.map(([k,v])=>`<a href="${pg(5,{id:r.id,role:'R01',section:'kit',kind:k})}" ${filter===k?'aria-current="page"':''}>${esc(v)}</a>`).join('')}</nav>`)+panel('Комплект і перевірки',table(['Категорія','Пункт','Стан','Дії'],rows.map(({x,i})=>{
   action('prep-'+i,()=>prepForm(x,i));action('prep-remove-'+i,()=>form('Прибрати пункт',body(`<p>${esc(x.description)}</p>`),()=>command('field.preparation',{index:i,remove:true})));
   return [esc(preparationKinds.find(k=>k[0]===x.kind)?.[1]),esc(x.description),esc(preparationStates.find(k=>k[0]===x.state)?.[1]),btn('Перевірити','prep-'+i,write)+' '+btn('Прибрати','prep-remove-'+i,write)];
  })),btn('Додати пункт','prep-add',write)+' '+btn('Доповнити перелік','defaults',write))+body(hint('Типовий перелік','«Доповнити перелік» додає лише відсутні категорії без зміни ваших пунктів. Обладнання й носії перевіряє людина; застосунок зберігає результат.'));
 }
 show(heading('Дослідження',r.title,'',button('← Дослідження',pg(4,{role:params.get('role')||'R01',q:params.get('q')||''}),true))+tabs(r)+`<nav class="record-tabs" aria-label="Підготовка дослідження">${sections.map(([k,v])=>`<a href="${url(k)}" ${section===k?'aria-current="page"':''}>${v}</a>`).join('')}</nav>`+content);
}
