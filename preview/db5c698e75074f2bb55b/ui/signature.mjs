// A handwritten signature captured with the displayed consent text.
export function bindSignature(root,{person,terms}){
 const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');let down=false,ink=false,signedContext='';const context=()=>JSON.stringify([person(),terms()]);
 const clear=()=>{ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#173e30';ctx.lineWidth=3;ctx.lineCap='round';ink=false;};clear();
 const point=e=>{const r=canvas.getBoundingClientRect();return [(e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height];};
 canvas.onpointerdown=e=>{e.preventDefault();if(!ink)signedContext=context();down=true;canvas.setPointerCapture(e.pointerId);ctx.beginPath();ctx.moveTo(...point(e));};
 canvas.onpointermove=e=>{if(!down)return;e.preventDefault();ctx.lineTo(...point(e));ctx.stroke();ink=true;};
 canvas.onpointerup=canvas.onpointercancel=()=>down=false;
 root.querySelector('[data-signature-clear]').onclick=clear;
 return {read:()=>{if(!ink)throw Error('Поставте підпис у полі.');if(signedContext!==context())throw Error('Умови або особу змінено після підписання. Очистіть поле й підпишіть оновлену згоду.');const lines=['ЗГОДА',person(),new Date().toLocaleString('uk-UA'),'Умови: '+terms()];const wrapped=[];ctx.font='18px sans-serif';for(const line of lines){let row='';for(const word of line.split(/\s+/)){if(ctx.measureText(row+' '+word).width>650){wrapped.push(row);row=word;}else row+=(row?' ':'')+word;}wrapped.push(row);}
 const out=document.createElement('canvas');out.width=700;out.height=wrapped.length*27+canvas.height+80;const c=out.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,out.width,out.height);c.fillStyle='#173e30';c.font='18px sans-serif';wrapped.forEach((v,i)=>c.fillText(v,24,30+i*27));c.drawImage(canvas,0,wrapped.length*27+45);return {filename:'pidpysana-zhoda.png',mime_type:'image/png',content:{encoding:'base64',data:out.toDataURL('image/png').split(',')[1]}};}};
}
