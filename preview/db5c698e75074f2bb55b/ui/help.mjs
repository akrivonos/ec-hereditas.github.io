const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let counter=0;
export function hint(title,text){const id='hint-'+(++counter);return `<span class="hint-wrap"><button type="button" class="hint-button" aria-label="Підказка: ${escape(title)}" aria-expanded="false" aria-controls="${id}">?</button><span id="${id}" class="hint-text" hidden>${escape(text)}</span></span>`;}
export function bindHelp(container){
 container.querySelectorAll('.hint-button').forEach(button=>{
  const popup=container.querySelector('#'+button.getAttribute('aria-controls'));
  const close=()=>{popup.hidden=true;button.setAttribute('aria-expanded','false');};
  button.onclick=()=>{const open=popup.hidden;container.querySelectorAll('.hint-button[aria-expanded="true"]').forEach(b=>b.click());popup.hidden=!open;button.setAttribute('aria-expanded',String(open));};
  button.onkeydown=e=>{if(e.key==='Escape'&&!popup.hidden){close();e.preventDefault();e.stopPropagation();}};
  button.onblur=close;
 });
}
