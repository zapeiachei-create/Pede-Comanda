(function(){
"use strict";
function opts(){try{return JSON.parse(localStorage.getItem("pc_pdv_"+business.id)||"{}")}catch(e){return {}}}
window.pdvPrintStaff=function(id){
try{
const o=(staffSession&&staffSession.orders||[]).find(x=>String(x.id)===String(id));
if(!o)return toast("Pedido não encontrado.");
const store=staffSession.business_name||staffSession.name||business?.name||"Pede Comanda";
const payload={storeName:store,number:o.order_no,date:new Date(o.created_at).toLocaleString("pt-BR"),table:o.table_name,customer:o.customer_name,type:o.channel,notes:o.notes,total:o.total,items:(o.items||[]).map(i=>({quantity:i.qty||i.quantity||1,name:i.name||i.product_name,total:i.total??Number(i.unit_price||i.price||0)*Number(i.qty||i.quantity||1),additions:i.addons,notes:i.notes}))};
let width=80;try{width=JSON.parse(localStorage.getItem("pc_pdv_"+(staffSession.business_id||business?.id))||"{}").width===58?58:80}catch(e){}
window.PedeComandaPDV.print(payload,{width});
}catch(e){toast(e.message)}
};
window.pdvPrintOrder=function(id){
try{
const o=data.orders.find(x=>String(x.id)===String(id));
if(!o)return toast("Pedido não encontrado.");
const payload={storeName:business.name,number:o.order_no,date:new Date(o.created_at).toLocaleString("pt-BR"),table:o.table_id?tableName(o.table_id):null,customer:o.customer_name,type:o.channel,notes:o.notes,total:o.total,items:itemsOf(o.id).map(i=>({quantity:i.quantity,name:i.product_name,total:i.total??Number(i.unit_price??i.price??0)*Number(i.quantity||1),additions:i.addons,notes:i.notes}))};
window.PedeComandaPDV.print(payload,{width:opts().width===58?58:80});
}catch(e){toast(e.message)}
};
window.pdvSave=function(){
const el=document.getElementById("pdvWidth");
localStorage.setItem("pc_pdv_"+business.id,JSON.stringify({width:Number(el.value)===58?58:80}));
toast("Preferência salva neste dispositivo.");
};
window.pdvTest=function(){
try{window.PedeComandaPDV.print({storeName:business.name,number:"TESTE",items:[{quantity:1,name:"Cupom de teste",total:0}],total:0},{width:Number(document.getElementById("pdvWidth").value)===58?58:80})}catch(e){toast(e.message)}
};
window.pdvSettingsPanel=function(){
const w=opts().width===58?58:80;
return '<div class="card" style="margin-top:14px"><h2>🖨 Impressora PDV</h2><p class="muted small">Impressão manual pelo navegador. Impressoras Bluetooth, USB e de rede precisam estar configuradas no aparelho. Para testar sem impressora, escolha Salvar PDF.</p><div class="field"><label>Tamanho do papel</label><select id="pdvWidth"><option value="80" '+(w===80?"selected":"")+'>80 mm</option><option value="58" '+(w===58?"selected":"")+'>58 mm</option></select></div><div class="inline"><button class="btn btn-primary" onclick="pdvSave()">Salvar</button><button class="btn btn-soft" onclick="pdvTest()">Teste / Salvar PDF</button></div><p class="muted small">Preferência salva somente neste aparelho. Impressão automática não disponível.</p></div>';
};
})();