/* Integração opcional da impressão manual no painel. Carregar após pdv-print.js.
   Ativar com PedeComandaPDVUI.attach({business,data,itemsOf,tableName}).
   Não ativa impressão automática nem altera pedidos. */
(function(global){
"use strict";
function attach(ctx){
  if(!global.PedeComandaPDV)throw new Error("Carregue pdv-print.js primeiro.");
  if(!ctx||!ctx.business||!ctx.data||typeof ctx.itemsOf!=="function")throw new Error("Contexto da loja indisponível.");
  function width(){return Number(localStorage.getItem("pc_pdv_width_"+ctx.business.id))===58?58:80;}
  function setWidth(mm){localStorage.setItem("pc_pdv_width_"+ctx.business.id,String(Number(mm)===58?58:80));}
  function orderPayload(order){
    if(!order||order.business_id!==ctx.business.id)throw new Error("Pedido não pertence à loja atual.");
    return {
      storeName:ctx.business.name,
      number:order.order_no,
      date:new Date(order.created_at).toLocaleString("pt-BR"),
      table:order.table_id&&typeof ctx.tableName==="function"?ctx.tableName(order.table_id):undefined,
      customer:order.customer_name,
      type:order.channel,
      notes:order.notes,
      total:order.total,
      items:ctx.itemsOf(order.id).map(i=>({
        quantity:i.quantity,name:i.product_name,
        total:i.total??(Number(i.unit_price??i.price??0)*Number(i.quantity??1)),
        additions:i.addons,notes:i.notes
      }))
    };
  }
  function printOrder(id){
    const order=ctx.data.orders.find(o=>String(o.id)===String(id));
    if(!order)throw new Error("Pedido não encontrado.");
    return global.PedeComandaPDV.print(orderPayload(order),{width:width()});
  }
  return {width,setWidth,printOrder,orderPayload};
}
global.PedeComandaPDVUI={attach};
})(window);
