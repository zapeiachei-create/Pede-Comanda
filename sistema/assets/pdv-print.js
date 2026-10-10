/* Pede Comanda - impressão PDV via navegador. Não executa impressão silenciosa. */
(function(global){
  "use strict";
  function escapeHTML(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function money(v){return Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});}
  function render(order,options={}){
    const width=options.width===58?58:80;
    const items=Array.isArray(order.items)?order.items:[];
    const lines=items.map(item=>{
      const additions=Array.isArray(item.additions)?item.additions:[];
      return '<section><strong>'+escapeHTML(item.quantity??1)+'x '+escapeHTML(item.name??item.nome??'Item')+'</strong><span>'+money(item.total??item.price??0)+'</span></section>'+
      additions.map(a=>'<div class="detail">+ '+escapeHTML(typeof a==="string"?a:(a.name??a.nome??"Adicional"))+'</div>').join('')+
      (item.notes||item.observacao?'<div class="detail">Obs: '+escapeHTML(item.notes??item.observacao)+'</div>':'');
    }).join('');
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Pedido PDV</title><style>'+
    '@page{size:'+width+'mm auto;margin:2mm}*{box-sizing:border-box}body{font:12px monospace;margin:0;width:'+(width-4)+'mm;color:#000}h2{text-align:center;font-size:15px;margin:5px 0}section{display:flex;justify-content:space-between;gap:6px;padding:4px 0;border-bottom:1px dashed #888}section strong{flex:1}.detail{padding-left:10px;font-size:11px}footer{border-top:1px dashed #000;margin-top:8px;padding-top:5px}p{margin:3px 0}@media screen{body{margin:15px auto}}</style></head><body>'+
    '<h2>'+escapeHTML(order.storeName??"Pede Comanda")+'</h2>'+
    '<p>Pedido: '+escapeHTML(order.number??order.id??"-")+'</p>'+
    '<p>Data: '+escapeHTML(order.date??new Date().toLocaleString("pt-BR"))+'</p>'+
    (order.table?'<p>Mesa: '+escapeHTML(order.table)+'</p>':'')+
    (order.customer?'<p>Cliente: '+escapeHTML(order.customer)+'</p>':'')+
    (order.type?'<p>Tipo: '+escapeHTML(order.type)+'</p>':'')+
    (order.address?'<p>Entrega: '+escapeHTML(order.address)+'</p>':'')+
    '<hr>'+lines+'<footer>'+
    (order.deliveryFee!=null?'<p>Entrega: '+money(order.deliveryFee)+'</p>':'')+
    (order.total!=null?'<strong>TOTAL: '+money(order.total)+'</strong>':'')+
    (order.notes?'<p>Observações: '+escapeHTML(order.notes)+'</p>':'')+
    '</footer></body></html>';
  }
  function print(order,options={}){
    const popup=global.open("","_blank","width=460,height=720");
    if(!popup)throw new Error("Permita janelas pop-up para imprimir o pedido.");
    popup.document.open();popup.document.write(render(order,options));popup.document.close();
    popup.focus();
    popup.addEventListener("load",()=>popup.print(),{once:true});
    return popup;
  }
  global.PedeComandaPDV={render,print};
})(window);
