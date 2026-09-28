import {can} from '../data/model.mjs?v=20260928-cultural-media';
import {archiveCandidate,archivePublications,publicationCheck,descriptionFields,reviewStates} from '../data/archive.mjs?v=20260928-cultural-media';
import {wizard} from './wizard.mjs?v=20260928-cultural-media';

export function archivePages(ctx){
 const {s,actor,scope,esc,pg,shell,heading,panel,dialog,dispatch,render,flash,denied}=ctx,st=s(),t=st.tables,p=new URLSearchParams(location.search);
 const by=(k,id)=>t[k]?.find(x=>x.id===id),reg=id=>by('entity',id),rev=id=>reg(id)?.current_revision_id;
 const label=id=>{const e=reg(id),x=e&&by(e.entity_type,id);return x?.title||x?.name||'Архівний запис';};
 const actions={},action=(key,fn)=>actions[key]=fn,btn=(title,key,enabled=true)=>`<button type="button" class="button secondary" data-archive-action="${key}" ${enabled?'':'disabled'}>${esc(title)}</button>`;
 const link=(n,title,q={})=>`<a href="${pg(n,{role:'R02',...q})}">${esc(title)}</a>`,go=(n,q={})=>location.assign(pg(n,{role:'R02',...q}));
 const body=html=>`<div class="panel-body">${html}</div>`,input=(name,title,value='',required=true)=>`<label>${esc(title)}<input name="${name}" value="${esc(value)}" ${required?'required':''}></label>`,area=(name,title,value='',required=true)=>`<label>${esc(title)}<textarea name="${name}" rows="4" ${required?'required':''}>${esc(value)}</textarea></label>`,select=(name,title,rows,value='')=>`<label>${esc(title)}<select name="${name}">${rows.map(([id,text])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
 const details=rows=>`<dl class="detail-list">${rows.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v||'Не зазначено')}</dd></div>`).join('')}</dl>`;
 const table=(heads,rows)=>rows.length?`<div class="table-wrap media-table"><table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>`<td data-label="${esc(heads[i])}">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:body('<p>За цими умовами записів немає.</p>');
 const show=html=>{shell(html);document.querySelectorAll('[data-archive-action]').forEach(el=>el.onclick=()=>actions[el.dataset.archiveAction]?.());};
 const done=message=>{flash(message);render();};
 const permitted=(permission,id)=>can(st,actor,permission,reg(id)?.archive_id)&&(!scope||reg(id)?.archive_id===scope);
 const sources=permission=>t.entity.filter(e=>descriptionFields[e.entity_type]&&permitted(permission,e.id)&&!e.retired_at);
 const proof=()=>input('method','Спосіб перевірки','Звірка з джерелом')+input('locator','Де саме перевірено','',false)+area('evidence_note','Що підтверджує рішення')+'<label class="check-label"><input type="checkbox" name="confirm" required>Я перевірив джерело та підставу рішення</label>';
 function propose(){
  const choices=sources('review.write');if(!choices.length)return;
  const d=wizard({dialog,esc},{title:'Запропонувати уточнення',submit:'Передати на перевірку',steps:[
   {title:'Матеріал і поле',body:select('id','Матеріал',choices.map(e=>[e.id,label(e.id)]))+select('field','Поле опису',Object.entries(descriptionFields[choices[0].entity_type]))+area('value','Запропоноване значення')},
   {title:'Підстава',body:area('reason','Що потребує уточнення')+area('evidence_note','Джерело або спостереження')+input('locator','Сторінка, рядок або фрагмент','',false)}
  ],summary:v=>details([['Матеріал',label(v.id)],['Нове значення',v.value],['Підстава',v.reason]]),onSubmit:async v=>{const row=await dispatch({type:'archive.propose',...v,expected_revision_id:rev(v.id)});go(24,{id:row.id});}});
  d.querySelector('[name=id]').onchange=e=>{d.querySelector('[name=field]').innerHTML=Object.entries(descriptionFields[reg(e.target.value).entity_type]).map(([id,title])=>`<option value="${id}">${esc(title)}</option>`).join('');};
 }
 function queue(){
  if(!t.archive.some(a=>can(st,actor,'review.write',a.id)))return denied();
  const state=p.get('state')||'pending',q=(p.get('q')||'').toLocaleLowerCase('uk');
  const rows=t.candidate.map(c=>archiveCandidate(st,actor,c.id)).filter(x=>x&&(!scope||x.archive_id===scope)&&(state==='all'||x.state===state)&&[x.current?.title,x.proposed_payload.description].join(' ').toLocaleLowerCase('uk').includes(q));action('propose',propose);
  show(heading('Архівіст','Черга перевірки','Відкрийте пропозицію, зіставте її з джерелом і зафіксуйте рішення.',btn('Запропонувати уточнення','propose',!!sources('review.write').length))+
   `<form class="filters"><input type="hidden" name="role" value="R02">${input('q','Знайти пропозицію',p.get('q')||'',false)}${select('state','Стан',[['all','Усі стани'],...Object.entries(reviewStates)],state)}<button class="button">Знайти</button></form>`+
   panel('Пропозиції',table(['Матеріал','Що пропонують','Стан'],rows.map(x=>[link(24,x.current?.title||'Відповідність',{id:x.id}),esc(x.proposed_payload.description||x.proposed_payload.reason||'Звірити відповідність'),esc(reviewStates[x.state])+(x.stale?'<span class="sub">Основа змінилася</span>':'')]))));
 }
 function reviewDialog(view,decision){
  const apply=['accept','correct'].includes(decision),description=view.kind==='description',names={accept:'Прийняти',correct:'Прийняти з виправленням',reject:'Відхилити',defer:'Відкласти'};
  const proposed=description?view.proposed_payload.value:'',field=view.proposed_payload.field;
  dialog(names[decision]+' пропозицію',(apply?(!description?select('field','Поле опису',Object.entries(descriptionFields[view.source_type])):'')+((!description||decision==='correct')?area('value','Нове значення',proposed):body(details([['Поле',descriptionFields[view.source_type][field]],['Буде записано',proposed]])))+proof():'')+area('reason',decision==='defer'?'Що потрібно перевірити далі':'Обґрунтування рішення'),async fd=>{await dispatch({type:'archive.review',id:view.id,expected_revision_id:view.revision_id,decision,...Object.fromEntries(fd),confirm:fd.has('confirm')});done(apply?'Опис оновлено. Пов’язана публікація потребує повторної перевірки доступу.':'Рішення збережено.');},names[decision]);
 }
 function candidate(){
  if(!p.get('id'))return queue();const v=archiveCandidate(st,actor,p.get('id'));if(!v||scope&&v.archive_id!==scope)return denied();
  const terminal=!['pending','deferred'].includes(v.state);for(const key of ['accept','correct','reject','defer'])action(key,()=>reviewDialog(v,key));
  const basis=by('entity_revision',v.source_revision_id)?.snapshot,field=v.proposed_payload.field;
  const controls=v.editable&&!terminal?btn('Прийняти','accept',!v.stale&&can(st,actor,'catalog.write',v.archive_id))+btn('Виправити й прийняти','correct',!v.stale&&can(st,actor,'catalog.write',v.archive_id))+btn('Відхилити','reject')+btn('Відкласти','defer'):'';
  show(link(23,'← Черга перевірки')+heading('Перевірка',v.current?.title||'Пропозиція','Рішення не змінює джерельні записи й попередні версії.',`<div class="public-actions">${controls}</div>`)+
   body(details([['Стан',reviewStates[v.state]],['Матеріал',v.current?.title]]))+(v.stale?'<div class="notice warning">Архівний опис або публічна основа змінилися. Відкладіть чи відхиліть пропозицію та створіть нову за поточним описом.</div>':'')+
   (!v.editable?body(v.kind==='text'?link(14,'Відкрити перевірку тексту',{id:v.proposed_entity_id}):link(22,'Відкрити звірку відповідності',{id:by('identity_match',v.id)?.source_record_id||v.target_entity_id})):panel('Порівняння',body(details([['Поле',descriptionFields[v.source_type]?.[field]||'Уточнення опису'],['У версії, на яку спирається пропозиція',field?basis?.[field]:basis?.summary||basis?.body_text||basis?.title],['Поточний опис',field?v.current?.[field]:v.current?.summary||v.current?.body_text],['Пропозиція',v.proposed_payload.value||v.proposed_payload.description]]))))+
   panel('Підстави',body(v.sources.map(x=>x.available?`<article><h3>${esc(x.title)}</h3><p class="source-text">${esc(x.text)}</p></article>`:'<p>Підстава поза доступною областю.</p>').join('')||'<p>Підстави ще не додано.</p>'))+
   panel('Історія рішень',table(['Рішення','Рецензент','Дата','Обґрунтування'],v.decisions.map(x=>[esc(({accept:'Прийнято',correct:'Виправлено',reject:'Відхилено',defer:'Відкладено'})[x.decision]),esc(t.person.find(y=>y.id===by('account',x.reviewer_account_id)?.person_id)?.preferred_name),esc(ctx.date(x.decided_at)),esc(x.reason)]))));
 }
 function verify(source){dialog('Перевірити архівний опис',body(details([['Матеріал',label(source)],['Версія опису',by('entity_revision',rev(source))?.revision_no]])+`<p class="source-text">${esc(by(reg(source).entity_type,source)?.summary||by(reg(source).entity_type,source)?.body_text||by(reg(source).entity_type,source)?.inscriptions||'Окремий текст відсутній')}</p>`)+proof()+area('reason','Що перевірено'),async fd=>{await dispatch({type:'archive.verify',id:source,expected_revision_id:rev(source),...Object.fromEntries(fd),confirm:fd.has('confirm')});done('Перевірку опису зафіксовано.');},'Підтвердити перевірку');}
 function prepare(){
  const choices=sources('publication.write').filter(e=>!t.publication_record.some(p=>p.source_entity_id===e.id)&&t.access_decision.some(d=>d.target_entity_id===e.id&&d.state==='effective'&&d.target_revision_id===e.current_revision_id));if(!choices.length)return;
  const decisions=id=>t.access_decision.filter(d=>d.target_entity_id===id&&d.state==='effective').map(d=>[d.id,d.reason]);
  const d=wizard({dialog,esc},{title:'Підготувати публікацію',submit:'Зберегти для перевірки',steps:[
   {title:'Матеріал і підстава',body:select('source_id','Матеріал',choices.map(e=>[e.id,label(e.id)]))+select('decision_id','Рішення про доступ',decisions(choices[0].id))},
   {title:'Публічний опис',body:input('title','Публічна назва')+area('summary','Публічний опис')+input('attribution','Зазначення джерела')+area('terms','Умови використання')+input('category','Тема','',false)+input('place','Місце','',false)+input('period','Період','',false)}
  ],summary:v=>details([['Назва',v.title],['Опис',v.summary],['Джерело',v.attribution],['Умови',v.terms],['Результат','Матеріал ще не буде опубліковано']]),onSubmit:async v=>{const x=await dispatch({type:'archive.publication.prepare',...v,expected_source_revision_id:rev(v.source_id),expected_decision_revision_id:rev(v.decision_id)});go(28,{id:x.id});}});
  d.querySelector('[name=source_id]').onchange=e=>{d.querySelector('[name=decision_id]').innerHTML=decisions(e.target.value).map(([id,title])=>`<option value="${id}">${esc(title)}</option>`).join('');};
 }
 function publications(){
  if(!t.archive.some(a=>can(st,actor,'publication.write',a.id)))return denied();
  const q=(p.get('q')||'').toLocaleLowerCase('uk'),status=p.get('state')||'',rows=archivePublications(st,actor).filter(x=>(!scope||reg(x.id).archive_id===scope)&&[x.safe_payload.title,label(x.source_entity_id)].join(' ').toLocaleLowerCase('uk').includes(q)).map(x=>publicationCheck(st,actor,x.id)).filter(x=>!status||(status==='ready'?!x.issues.length&&x.publication.state!=='published':status==='blocked'?!!x.issues.length:x.publication.state===status));action('prepare',prepare);
  const canPrepare=sources('publication.write').some(e=>!t.publication_record.some(p=>p.source_entity_id===e.id)&&t.access_decision.some(d=>d.target_entity_id===e.id&&d.state==='effective'&&d.target_revision_id===e.current_revision_id));
  show(heading('Архівіст','Публікації','Перевірка опису, рішення про доступ і публікація — окремі кроки.',btn('Підготувати публікацію','prepare',canPrepare))+
   `<form class="filters"><input type="hidden" name="role" value="R02">${input('q','Знайти матеріал',p.get('q')||'',false)}${select('state','Стан',[['','Усі'],['ready','Готові до публікації'],['blocked','Потребують перевірки'],['published','Опубліковані'],['unpublished','Не опубліковані']],status)}<button class="button">Знайти</button></form>`+
   panel('Матеріали',table(['Матеріал','Публікація','Готовність'],rows.map(x=>[link(28,x.publication.safe_payload.title,{id:x.publication.id}),x.publication.state==='published'?'Опубліковано':'Не опубліковано',x.issues.length?esc(x.issues.join(' ')):'Готово']))));
 }
 function publication(){
  if(!p.get('id'))return publications();const check=publicationCheck(st,actor,p.get('id'));if(!check||scope&&reg(check.publication.id).archive_id!==scope)return denied();const x=check.publication;
  action('verify',()=>verify(x.source_entity_id));action('publish',()=>dialog('Опублікувати матеріал','<p>Матеріал стане доступним у публічному каталозі.</p><label class="check-label"><input type="checkbox" name="confirm" required>Я перевірив публічний вигляд і дозволений склад</label>'+area('reason','Підстава публікації'),async fd=>{await dispatch({type:'archive.publication.publish',id:x.id,expected_revision_id:check.revision_id,expected_source_revision_id:rev(x.source_entity_id),reason:fd.get('reason'),confirm:fd.has('confirm')});done('Матеріал опубліковано.');},'Опублікувати'));
  action('withdraw',()=>dialog('Зняти з публікації',area('reason','Причина зняття'),async fd=>{await dispatch({type:'archive.publication.withdraw',id:x.id,expected_revision_id:check.revision_id,reason:fd.get('reason')});done('Публічний показ припинено. Архівний запис збережено.');},'Зняти з публікації'));
  const view=check.view,controls=btn('Перевірити опис','verify',can(st,actor,'review.write',reg(x.id).archive_id)&&!!descriptionFields[reg(x.source_entity_id)?.entity_type])+ (x.state==='published'?btn('Зняти з публікації','withdraw'):btn('Опублікувати','publish',!check.issues.length));
  const events=t.entity_revision.filter(r=>r.entity_id===x.id);
  show(link(27,'← Публікації')+heading('Публікація',x.safe_payload.title,'Публічний вигляд показує лише дозволені поля та ресурси.',`<div class="public-actions">${controls}</div>`)+
   panel('Готовність',body(details([['Стан',x.state==='published'?'Опубліковано':'Не опубліковано'],['Опис',check.verified?'Перевірено цю версію':'Потрібна перевірка']])+ (check.issues.length?`<ul>${check.issues.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`:'<p>Перевірки пройдено.</p>')+t.publication_basis.filter(b=>b.publication_id===x.id).map(b=>link(26,'Переглянути рішення про доступ',{id:b.decision_id})).join('')))+
   panel('Публічний вигляд',body(view?`<h2>${esc(view.title)}</h2><p class="source-text">${esc(view.summary)}</p>${details([['Джерело',view.attribution],['Умови',view.terms]])}${check.resources.map(r=>`<article class="public-reader source-text">${esc(r.content)}</article>`).join('')||'<p>Файли не включено до публічного показу.</p>'}${x.state==='published'?`<a href="${pg(50,{role:'R05',id:x.id})}" target="_blank" rel="noopener">Відкрити сторінку відвідувача ↗</a>`:''}`:'<p>Показ заблокований рішенням про доступ.</p>'))+
   panel('Історія публікації',table(['Версія','Стан','Підстава'],events.map(r=>[r.revision_no,r.snapshot.state==='published'?'Опубліковано':'Не опубліковано',esc(r.change_reason)]))));
 }
 function access(){
  const rows=t.access_decision.filter(x=>permitted('domain.read',x.id)),x=p.get('id')&&rows.find(x=>x.id===p.get('id'));
  if(p.get('id')&&!x||!t.archive.some(a=>can(st,actor,'domain.read',a.id)))return denied();
  const states={effective:'Чинне',needs_review:'Потрібна перевірка',superseded:'Замінене',revoked:'Відкликане'},uses={view:'Перегляд',cite:'Цитування',museum:'Музейний показ',download:'Завантаження'};
  if(!x){show(heading('Архівіст','Рішення про доступ','Відкрийте рішення, щоб перевірити підставу, строк, поля й способи використання.')+panel('Рішення',table(['Матеріал','Стан','Підстава'],rows.map(d=>[link(26,label(d.target_entity_id),{id:d.id}),esc(states[d.state]),esc(d.reason)]))));return;}
  action('revoke',()=>dialog('Відкликати рішення',`<p>Пов’язані публікації буде знято з показу. Архівні записи й історія збережуться.</p>`+area('reason','Причина відкликання'),async fd=>{await dispatch({type:'archive.access.revoke',id:x.id,expected_revision_id:rev(x.id),reason:fd.get('reason')});done('Рішення відкликано, публічний показ припинено.');},'Відкликати'));
  show(link(26,'← Рішення про доступ')+heading('Доступ',label(x.target_entity_id),'Надання нових прав і робота зі згодами потребують окремої перевірки.',btn('Відкликати рішення','revoke',can(st,actor,'access.manage',reg(x.id).archive_id)&&['effective','needs_review'].includes(x.state)))+
   panel('Рішення',body(details([['Стан',states[x.state]],['Підстава',x.reason],['Умови',x.conditions],['Чинне від',x.valid_from],['Чинне до',x.valid_until||'Без кінцевої дати'],['Ембарго до',x.embargo_until||'Немає']])+t.access_decision_basis.filter(b=>b.decision_id===x.id).map(b=>`<p>${esc(b.basis_note||'Підстава у зафіксованій версії згоди')}</p>`).join('')))+
   panel('Використання',table(['Дія','Рішення'],t.access_decision_use.filter(u=>u.decision_id===x.id).map(u=>[esc(uses[u.use_code]||u.use_code),u.effect==='allow'?'Дозволено':'Не дозволено'])))+
   panel('Поля',table(['Поле','Показ'],t.access_decision_field.filter(f=>f.decision_id===x.id).map(f=>[esc(({title:'Назва',summary:'Опис',kind:'Вид',category:'Тема',place:'Місце',period:'Період',attribution:'Джерело й авторство',terms:'Умови',context_ids:'Пов’язані записи',resource_label:'Назва ресурсу'})[f.field_path]||'Додаткове поле'),esc(f.effect==='allow'?'Показувати':f.effect==='mask'?'Замінити: '+f.replacement_text:'Приховати')]))));
 }
 return {'PG-23':queue,'PG-24':candidate,'PG-26':access,'PG-27':publications,'PG-28':publication};
}
