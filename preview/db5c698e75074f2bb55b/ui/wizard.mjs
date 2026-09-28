// Drafts live only in the dialog. One command is submitted at the final step.
export function wizard({dialog,esc}, {title,steps,summary,submit,onSubmit}) {
 let step=0,busy=false;
 const d=dialog(title,`<p class="wizard-progress" role="status"></p>${steps.map((s,i)=>`<fieldset class="wizard-step" ${i?'hidden disabled':''}><legend>${esc(s.title)}</legend>${s.body}</fieldset>`).join('')}<fieldset class="wizard-step" hidden disabled><legend>Перевірте перед збереженням</legend><div class="wizard-summary"></div></fieldset>`,()=>false,'Далі');
 const form=d.querySelector('form'),fields=[...d.querySelectorAll('.wizard-step')],next=d.querySelector('[type="submit"]');
 const back=document.createElement('button');back.type='button';back.className='button secondary';back.textContent='Назад';next.before(back);
 const values=()=>{const result={};for(const e of d.querySelectorAll('[name]')){if(e.type==='checkbox'){result[e.name]??=[];if(e.checked)result[e.name].push(e.value);}else result[e.name]=e.value;}return result;};
 const update=()=>{
  fields.forEach((f,i)=>{f.hidden=i!==step;f.disabled=i!==step;});
  d.querySelector('.wizard-progress').textContent=`Крок ${step+1} із ${fields.length}`;
  back.hidden=step===0;next.textContent=step===fields.length-1?submit:'Далі';
  d.querySelector('[role="alert"]').textContent='';
  if(step===fields.length-1)d.querySelector('.wizard-summary').innerHTML=summary(values());
  const target=fields[step].querySelector('input,select,textarea')||fields[step].querySelector('legend');target.tabIndex=target.matches('legend')?-1:target.tabIndex;target.focus();
 };
 back.onclick=()=>{if(!busy){step--;update();}};
 d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
 form.onsubmit=async e=>{
  e.preventDefault();if(busy||!form.reportValidity())return;
  if(step<fields.length-1){step++;update();return;}
  busy=true;d.querySelectorAll('button').forEach(b=>b.disabled=true);
  try{await onSubmit(values());d.close();}
  catch(error){d.querySelector('[role="alert"]').textContent=error.message;busy=false;d.querySelectorAll('button').forEach(b=>b.disabled=false);}
 };
 update();return d;
}
