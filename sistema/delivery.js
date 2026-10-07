(function(){
  var DELIVERY_VERSION='20261006-2';

  function deliveryLink(){
    return 'https://pedecomanda.com.br/sistema/?loja='+encodeURIComponent(business.slug)+'&delivery=1';
  }
  function deliveryPrettyLink(){
    return 'pedecomanda.com.br/sistema/?loja='+business.slug+'&delivery=1';
  }
  function deliveryFee(){
    return Math.max(0,Number((staffSession&&staffSession.delivery_fee)||(business&&business.delivery_fee)||0));
  }
  function deliveryTotal(){
    return draftTotal()+deliveryFee();
  }
  function deliveryAddressHtml(o){
    if(!o||o.channel!=='delivery')return '';
    var driver=o.driver_name||staffName(o.delivery_driver_id);
    return '<div class="success-note" style="margin-top:9px"><b>🛵 Delivery</b>'+
      '<div class="small" style="margin-top:4px"><b>Endereço:</b> '+esc(o.delivery_address||'Não informado')+'</div>'+
      (o.delivery_reference?'<div class="small"><b>Referência:</b> '+esc(o.delivery_reference)+'</div>':'')+
      '<div class="small"><b>Taxa:</b> '+money(o.delivery_fee||0)+'</div>'+
      (o.delivery_driver_id?'<div class="small"><b>Entregador:</b> '+esc(driver||'Definido')+'</div>':'')+
      '</div>';
  }
  function driverOptions(selected){
    var drivers=(data.staff||[]).filter(function(s){return s.role==='delivery'&&s.active;});
    return drivers.map(function(s){
      return '<option value="'+esc(s.id)+'" '+(selected===s.id?'selected':'')+'>'+esc(s.name)+'</option>';
    }).join('');
  }

  init = async function(){
    var u=new URL(location.href);
    var qr=u.searchParams.get('qr');
    var loja=u.searchParams.get('loja');
    var isDelivery=u.searchParams.get('delivery')==='1';
    if(qr){appMode='qr';return loadQR(qr);}
    if(loja){
      if(isDelivery){appMode='delivery';return window.loadDelivery(loja);}
      appMode='counter';return loadCounter(loja);
    }
    if(staffLoginRequested()){
      if(staffSession&&staffSession.session_token){
        try{appMode='staff';return await loadStaff();}
        catch(e){localStorage.removeItem('pc_staff');staffSession=null;}
      }
      return renderStaffAccess();
    }
    if(staffSession&&staffSession.session_token){
      try{appMode='staff';return await loadStaff();}
      catch(e){localStorage.removeItem('pc_staff');staffSession=null;}
    }
    if(session&&session.refresh_token){
      try{await restoreAuth();return await loadAdmin();}
      catch(e){localStorage.removeItem('pc_auth');session=null;}
    }
    renderAuth();
  };

  var oldStaffAdminView=staffAdminView;
  staffAdminView=function(){
    var form='<div class="card" id="pcStaffNewCard" style="margin-bottom:14px">'+
      '<h3 style="margin-top:0">Cadastrar funcionário ou entregador</h3>'+
      '<p class="muted small">Selecione a função na lista. Para entregadores, escolha <b>Entregador</b>; não precisa digitar nenhum código.</p>'+
      '<form id="pcStaffNewForm" onsubmit="event.preventDefault();saveNewStaff()">'+
      '<div class="grid grid-2">'+
      '<div class="field"><label for="pcStaffName">Nome</label><input id="pcStaffName" type="text" autocomplete="off" maxlength="100" placeholder="Nome do funcionário" required></div>'+
      '<div class="field"><label for="pcStaffRole">Função</label><select id="pcStaffRole" required>'+
      '<option value="delivery">🛵 Entregador</option>'+
      '<option value="waiter">Garçom / Atendente</option>'+
      '<option value="kitchen">Cozinha</option>'+
      '<option value="cashier">Caixa</option>'+
      '<option value="manager">Gerente</option>'+
      '</select></div>'+
      '<div class="field"><label for="pcStaffPin">PIN individual (4 a 6 números)</label><input id="pcStaffPin" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{4,6}" minlength="4" maxlength="6" placeholder="Crie o PIN" required></div>'+
      '</div>'+
      '<div id="pcStaffNewFeedback" class="small" style="margin:8px 0" role="status" aria-live="polite"></div>'+
      '<button id="pcStaffSaveButton" class="btn btn-primary" type="submit">Salvar cadastro</button>'+
      '</form></div>';
    return oldStaffAdminView()
      .replace('garçom, cozinha, caixa e gerente','garçom, cozinha, caixa, gerente e entregador')
      .replace('+ Cadastrar garçom / equipe','+ Cadastrar equipe / entregador')
      .replace('<div class="card">',form+'<div class="card">');
  };
  roleLabel=function(r){
    return ({waiter:'Garçom / Atendente',kitchen:'Cozinha',cashier:'Caixa',manager:'Gerente',delivery:'Entregador'})[r]||r;
  };
  newStaff=function(){
    var input=document.getElementById('pcStaffName');
    if(input){input.scrollIntoView({behavior:'smooth',block:'center'});input.focus();}
    else go('staff');
  };
  window.saveNewStaff=async function(){
    var nameInput=document.getElementById('pcStaffName');
    var roleInput=document.getElementById('pcStaffRole');
    var pinInput=document.getElementById('pcStaffPin');
    var feedback=document.getElementById('pcStaffNewFeedback');
    var button=document.getElementById('pcStaffSaveButton');
    if(!nameInput||!roleInput||!pinInput||!button)return;
    var name=nameInput.value.trim();
    var role=roleInput.value;
    var pin=pinInput.value.trim();
    function report(message,isError){if(feedback){feedback.textContent=message;feedback.style.color=isError?'#b42334':'#1f9d66';}}
    if(!name)return report('Informe o nome do funcionário.',true);
    if(!['waiter','kitchen','cashier','manager','delivery'].includes(role))return report('Selecione uma função válida.',true);
    if(!/^[0-9]{4,6}$/.test(pin))return report('O PIN precisa ter de 4 a 6 números.',true);
    button.disabled=true;button.textContent='Salvando cadastro...';report('Salvando...',false);
    try{
      var id=await rpc('pc_create_staff',{p_business_id:business.id,p_name:name,p_pin:pin,p_role:role});
      await reloadAdminData();
      var confirmed=data.staff.some(function(s){return s.id===id&&s.role===role;});
      if(!confirmed)throw new Error('Não foi possível confirmar o cadastro na lista. Confira a conexão e tente atualizar a página.');
      toast(role==='delivery'?'Entregador cadastrado e confirmado.':'Funcionário cadastrado e confirmado.');
      renderAdmin();
    }catch(e){report('Não foi possível salvar: '+(e&&e.message?e.message:'tente novamente.'),true);}
    finally{if(button.isConnected){button.disabled=false;button.textContent='Salvar cadastro';}}
  };

  var oldTablesAdminView=tablesAdminView;
  tablesAdminView=function(){
    var base=oldTablesAdminView();
    var enabled=business.delivery_enabled!==false;
    if(!enabled){
      return base+'<div class="card" style="margin-top:14px"><h2 style="margin-top:0">🛵 Delivery</h2><p class="muted">O delivery está desativado. Ative em Configurações para gerar o link de entrega.</p><button class="btn btn-primary" onclick="go(\'settings\')">Ativar Delivery</button></div>';
    }
    var link=deliveryLink();
    var qr='https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data='+encodeURIComponent(link);
    return base+'<div class="card" style="margin-top:14px"><div class="page-head"><div><h2 style="margin:0">🛵 Delivery</h2><div class="muted">O cliente faz o pedido para receber em casa. Endereço e WhatsApp são obrigatórios.</div></div><span class="badge b-ready">Ativo</span></div>'+
      '<div class="grid grid-2"><div><div class="field"><label>Link do Delivery</label><input value="'+esc(link)+'" readonly><div class="muted small" style="margin-top:6px"><b>Link para divulgação:</b> '+esc(deliveryPrettyLink())+'</div></div>'+
      '<div class="toolbar"><button class="btn btn-primary btn-sm" onclick="copyText(\''+esc(link)+'\')">Copiar link</button><button class="btn btn-secondary btn-sm" onclick="window.open(\''+esc(link)+'\',\'_blank\')">Abrir</button><button class="btn btn-secondary btn-sm" onclick="shareClientLink(\'Delivery\',\''+esc(link)+'\')">Compartilhar</button></div>'+
      '<p class="muted small">Taxa configurada: <b>'+money(business.delivery_fee||0)+'</b>. O valor é somado automaticamente ao pedido.</p></div>'+
      '<div style="text-align:center"><img src="'+qr+'" alt="QR Delivery" style="width:190px;height:190px;background:#fff;padding:8px;border-radius:12px;border:1px solid var(--line)"><div class="small muted">QR do Delivery</div></div></div></div>';
  };

  var oldSettingsAdminView=settingsAdminView;
  settingsAdminView=function(){
    var base=oldSettingsAdminView();
    var enabled=business.delivery_enabled!==false;
    return base+'<div class="card" style="margin-top:14px"><div class="page-head"><div><h2 style="margin:0">🛵 Delivery</h2><div class="muted">Ative entregas, defina a taxa e cadastre os entregadores em Equipe.</div></div></div>'+
      '<div class="grid grid-2"><div class="field"><label>Delivery</label><select id="setDeliveryEnabled"><option value="true" '+(enabled?'selected':'')+'>Ativado</option><option value="false" '+(!enabled?'selected':'')+'>Desativado</option></select></div>'+
      '<div class="field"><label>Taxa de entrega (R$)</label><input id="setDeliveryFee" type="number" min="0" step="0.01" value="'+Number(business.delivery_fee||0).toFixed(2)+'"><div class="muted small">Use 0 para entrega grátis.</div></div></div>'+
      '<button class="btn btn-primary" onclick="saveDeliverySettings()">Salvar Delivery</button>'+
      '<div class="success-note" style="margin-top:14px">Fluxo: pedido recebido → preparo → pronto → escolher entregador → saiu para entrega → entregue.</div></div>';
  };
  window.saveDeliverySettings=async function(){
    try{
      var enabled=document.getElementById('setDeliveryEnabled').value==='true';
      var fee=Math.max(0,Number(String(document.getElementById('setDeliveryFee').value||'0').replace(',','.'))||0);
      var arr=await rest('pc_businesses','id=eq.'+business.id,{
        method:'PATCH',
        headers:{Prefer:'return=representation'},
        body:JSON.stringify({delivery_enabled:enabled,delivery_fee:fee})
      });
      business=arr[0];
      renderAdmin();
      toast(enabled?'Delivery ativado e salvo.':'Delivery desativado.');
    }catch(e){toast(e.message);}
  };

  orderPlace=function(o){
    if(o.channel==='counter')return 'Senha '+String(o.pickup_no||0).padStart(3,'0')+' • Balcão';
    if(o.channel==='delivery')return 'Delivery • '+(o.delivery_address||'Endereço não informado');
    return tableName(o.table_id);
  };
  orderOrigin=function(o){
    if(o.channel==='counter')return 'Cliente / Link';
    if(o.channel==='delivery')return 'Cliente / Delivery';
    if(o.channel==='qr')return 'Cliente / QR';
    return staffName(o.staff_id);
  };
  ordersTable=function(rows){
    if(!rows.length)return '<div class="empty">Nenhum pedido ainda.</div>';
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Pedido</th><th>Mesa / Retirada / Delivery</th><th>Origem</th><th>Status</th><th>Total</th><th>Hora</th></tr></thead><tbody>'+
      rows.map(function(o){
        return '<tr><td>#'+o.order_no+'</td><td>'+esc(orderPlace(o))+'</td><td>'+esc(orderOrigin(o))+'</td><td>'+badge(o.status)+'</td><td>'+money(o.total)+'</td><td>'+fmtTime(o.created_at)+'</td></tr>';
      }).join('')+'</tbody></table></div>';
  };
  badge=function(s){
    var m={new:['Novo','b-new'],preparing:['Em preparo','b-prep'],ready:['Pronto','b-ready'],out_for_delivery:['Saiu p/ entrega','b-new'],delivered:['Entregue','b-done'],cancelled:['Cancelado','b-cancel']};
    var x=m[s]||[s,'b-done'];
    return '<span class="badge '+x[1]+'">'+x[0]+'</span>';
  };

  kitchenAdminView=function(){
    var statuses=[['new','Novos'],['preparing','Em preparo'],['ready','Prontos'],['out_for_delivery','Em entrega'],['delivered','Entregues']];
    var rows=data.orders.filter(function(o){return o.status===kitchenFilter;});
    return '<div class="page-head"><div><h1>Cozinha</h1><div class="muted">Pedidos de mesa, balcão e delivery em tempo real.</div></div><button class="btn btn-soft" onclick="refreshOrders()">Atualizar</button></div>'+
      '<div class="status-tabs">'+statuses.map(function(x){
        return '<button class="'+(kitchenFilter===x[0]?'active':'')+'" onclick="kitchenFilter=\''+x[0]+'\';renderAdmin()">'+x[1]+' ('+data.orders.filter(function(o){return o.status===x[0];}).length+')</button>';
      }).join('')+'</div>'+
      '<div class="orders-list">'+(rows.map(orderCardAdmin).join('')||'<div class="card empty">Nenhum pedido neste status.</div>')+'</div>';
  };

  orderCardAdmin=function(o){
    var next=null;
    if(o.status==='new')next=['Iniciar preparo','preparing'];
    else if(o.status==='preparing')next=['Marcar pronto','ready'];
    else if(o.status==='ready'&&o.channel!=='delivery')next=['Entregar','delivered'];

    var main=o.channel==='counter'
      ? 'SENHA '+String(o.pickup_no||0).padStart(3,'0')+' • Balcão'
      : o.channel==='delivery'
        ? '#'+o.order_no+' • DELIVERY'
        : '#'+o.order_no+' • '+tableName(o.table_id);

    var drivers=(data.staff||[]).filter(function(s){return s.role==='delivery'&&s.active;});
    var dispatch='';
    if(o.channel==='delivery'&&o.status==='ready'){
      if(drivers.length){
        dispatch='<div class="field" style="margin:10px 0 0"><label>Entregador</label><select id="adminDriver_'+o.id+'"><option value="">Escolha o entregador</option>'+driverOptions(o.delivery_driver_id)+'</select></div>'+
          '<button class="btn btn-ok btn-sm" onclick="adminAssignDriver(\''+o.id+'\')">🛵 Saiu para entrega</button>';
      }else{
        dispatch='<div class="danger-note" style="margin-top:10px">Cadastre pelo menos um entregador em <b>Equipe</b> antes de despachar.</div>';
      }
    }else if(o.channel==='delivery'&&o.status==='out_for_delivery'){
      dispatch='<button class="btn btn-ok btn-sm" onclick="adminStatus(\''+o.id+'\',\'delivered\')">✓ Marcar entregue</button>';
    }

    var customer=['qr','counter','delivery'].includes(o.channel)&&(o.customer_name||o.customer_whatsapp)
      ? '<div class="muted"><b>Cliente:</b> '+esc(o.customer_name||'Não informado')+(o.customer_whatsapp?' • WhatsApp '+esc(o.customer_whatsapp):'')+'</div>'
      : '';

    return '<article class="order-card"><div class="top"><div><b>'+esc(main)+'</b><div class="muted">'+fmtTime(o.created_at)+' • '+esc(orderOrigin(o))+'</div></div>'+badge(o.status)+'</div>'+
      '<ul>'+itemsOf(o.id).map(function(i){return '<li>'+i.quantity+'x '+esc(i.product_name)+itemExtraText(i)+'</li>';}).join('')+'</ul>'+
      customer+deliveryAddressHtml(o)+(o.notes?'<div class="muted" style="margin-top:7px"><b>Obs.:</b> '+esc(o.notes)+'</div>':'')+
      '<div class="inline" style="justify-content:space-between;margin-top:10px"><b>'+money(o.total)+'</b><div class="order-actions">'+
      (next?'<button class="btn btn-primary btn-sm" onclick="adminStatus(\''+o.id+'\',\''+next[1]+'\')">'+next[0]+'</button>':'')+
      dispatch+
      (o.status!=='cancelled'&&o.status!=='delivered'&&o.status!=='out_for_delivery'?'<button class="btn btn-danger btn-sm" onclick="adminStatus(\''+o.id+'\',\'cancelled\')">Cancelar</button>':'')+
      '</div></div></article>';
  };

  window.adminAssignDriver=async function(id){
    var sel=document.getElementById('adminDriver_'+id);
    var driverId=sel&&sel.value;
    if(!driverId)return toast('Escolha o entregador.');
    try{
      await rest('pc_orders','id=eq.'+id+'&business_id=eq.'+business.id,{
        method:'PATCH',
        headers:{Prefer:'return=minimal'},
        body:JSON.stringify({delivery_driver_id:driverId,status:'out_for_delivery',delivery_started_at:new Date().toISOString(),updated_at:new Date().toISOString()})
      });
      await refreshOrders();
      toast('Pedido saiu para entrega.');
    }catch(e){toast(e.message);}
  };
  adminStatus=async function(id,status){
    try{
      var o=(data.orders||[]).find(function(x){return x.id===id;});
      var payload={status:status,updated_at:new Date().toISOString()};
      if(o&&o.channel==='delivery'&&status==='out_for_delivery')payload.delivery_started_at=new Date().toISOString();
      if(o&&o.channel==='delivery'&&status==='delivered')payload.delivery_completed_at=new Date().toISOString();
      await rest('pc_orders','id=eq.'+id+'&business_id=eq.'+business.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(payload)});
      await refreshOrders();
    }catch(e){toast(e.message);}
  };

  loadStaff=async function(){
    clearPoll();appMode='staff';
    try{
      var boot=await rpc('pc_staff_bootstrap',{p_session_token:staffSession.session_token},false);
      staffSession=Object.assign({},staffSession,boot);
      localStorage.setItem('pc_staff',JSON.stringify(staffSession));
      setTheme(boot.theme_color);
      if(!draft.tableId&&boot.service_mode!=='counter')draft.tableId=(boot.tables&&boot.tables[0]&&boot.tables[0].id)||'';
      if(boot.role==='delivery'&&!['ready','out_for_delivery','delivered'].includes(kitchenFilter))kitchenFilter='ready';
      view=(boot.role==='kitchen'||boot.role==='delivery')?'kitchen':'comanda';
      renderStaff();
      poller=setInterval(function(){if(view==='kitchen')loadStaffOrders(false);},3000);
    }catch(e){toast(e.message);logoutStaff();}
  };
  renderStaff=function(){
    if(view==='comanda')applyComandaAppearance(staffSession);else setTheme(staffSession.theme_color);
    var canComanda=staffSession.role!=='kitchen'&&staffSession.role!=='delivery';
    document.getElementById('app').innerHTML='<header class="topbar"><div class="brand">'+staffBrand()+'</div><button class="btn btn-secondary" onclick="logoutStaff()">Sair</button></header>'+
      '<main class="main">'+(view==='kitchen'?staffKitchenView():staffComandaView())+'</main>'+
      '<nav class="mobile-nav">'+(canComanda?'<button class="'+(view==='comanda'?'active':'')+'" onclick="view=\'comanda\';renderStaff()"><div>🧾</div>Comanda</button>':'')+
      '<button class="'+(view==='kitchen'?'active':'')+'" onclick="view=\'kitchen\';loadStaffOrders(true)"><div>👨‍🍳</div>'+(staffSession.role==='delivery'?'Entregas':'Cozinha')+'</button></nav>';
  };
  staffKitchenView=function(){
    if(!staffSession.orders){loadStaffOrders(true);return '<div class="card empty">Carregando pedidos...</div>';}
    var isDriver=staffSession.role==='delivery';
    var pool=(staffSession.orders||[]).filter(function(o){
      if(!isDriver)return true;
      if(o.channel!=='delivery')return false;
      return !o.delivery_driver_id||o.delivery_driver_id===staffSession.staff_id;
    });
    var sts=isDriver
      ? [['ready','Prontos'],['out_for_delivery','Em entrega'],['delivered','Entregues']]
      : [['new','Novos'],['preparing','Em preparo'],['ready','Prontos'],['out_for_delivery','Em entrega'],['delivered','Entregues']];
    var rows=pool.filter(function(o){return o.status===kitchenFilter;});
    return '<div class="page-head"><div><h1>'+(isDriver?'Minhas entregas':'Cozinha')+'</h1><div class="muted">'+(isDriver?'Pedidos disponíveis ou atribuídos a você.':'Pedidos do estabelecimento, incluindo delivery.')+'</div></div><button class="btn btn-soft" onclick="loadStaffOrders(true)">Atualizar</button></div>'+
      '<div class="status-tabs">'+sts.map(function(x){
        return '<button class="'+(kitchenFilter===x[0]?'active':'')+'" onclick="kitchenFilter=\''+x[0]+'\';renderStaff()">'+x[1]+' ('+pool.filter(function(o){return o.status===x[0];}).length+')</button>';
      }).join('')+'</div>'+
      '<div class="orders-list">'+(rows.map(orderCardStaff).join('')||'<div class="card empty">Nenhum pedido neste status.</div>')+'</div>';
  };
  orderCardStaff=function(o){
    var next=null;
    if(o.status==='new')next=['Iniciar preparo','preparing'];
    else if(o.status==='preparing')next=['Marcar pronto','ready'];
    else if(o.status==='ready'&&o.channel!=='delivery')next=['Entregar','delivered'];

    var main=o.channel==='counter'
      ? 'SENHA '+String(o.pickup_no||0).padStart(3,'0')+' • Balcão'
      : o.channel==='delivery'
        ? '#'+o.order_no+' • DELIVERY'
        : '#'+o.order_no+' • '+o.table_name;

    var dispatch='';
    if(o.channel==='delivery'&&o.status==='ready'){
      if(staffSession.role==='delivery'){
        dispatch='<button class="btn btn-ok btn-sm" onclick="staffAssignDriver(\''+o.id+'\',\''+staffSession.staff_id+'\')">🛵 Assumir entrega</button>';
      }else{
        var drivers=staffSession.drivers||[];
        if(drivers.length){
          var opts=drivers.map(function(d){return '<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>';}).join('');
          dispatch='<div class="field" style="margin:10px 0 0"><label>Entregador</label><select id="staffDriver_'+o.id+'"><option value="">Escolha o entregador</option>'+opts+'</select></div>'+
            '<button class="btn btn-ok btn-sm" onclick="staffAssignDriver(\''+o.id+'\')">🛵 Saiu para entrega</button>';
        }else{
          dispatch='<div class="danger-note" style="margin-top:10px">Nenhum entregador ativo cadastrado.</div>';
        }
      }
    }else if(o.channel==='delivery'&&o.status==='out_for_delivery'){
      dispatch='<button class="btn btn-ok btn-sm" onclick="staffStatus(\''+o.id+'\',\'delivered\')">✓ Marcar entregue</button>';
    }

    var customer=['qr','counter','delivery'].includes(o.channel)&&(o.customer_name||o.customer_whatsapp)
      ? '<div class="muted"><b>Cliente:</b> '+esc(o.customer_name||'Não informado')+(o.customer_whatsapp?' • WhatsApp '+esc(o.customer_whatsapp):'')+'</div>'
      : '';
    var dhtml=o.channel==='delivery'
      ? '<div class="success-note" style="margin-top:9px"><b>🛵 Delivery</b><div class="small" style="margin-top:4px"><b>Endereço:</b> '+esc(o.delivery_address||'Não informado')+'</div>'+
        (o.delivery_reference?'<div class="small"><b>Referência:</b> '+esc(o.delivery_reference)+'</div>':'')+
        '<div class="small"><b>Taxa:</b> '+money(o.delivery_fee||0)+'</div>'+
        (o.driver_name?'<div class="small"><b>Entregador:</b> '+esc(o.driver_name)+'</div>':'')+'</div>'
      : '';

    return '<article class="order-card"><div class="top"><div><b>'+esc(main)+'</b><div class="muted">'+fmtTime(o.created_at)+' • '+esc(o.staff_name||'—')+'</div></div>'+badge(o.status)+'</div>'+
      '<ul>'+(o.items||[]).map(function(i){return '<li>'+i.qty+'x '+esc(i.name)+itemExtraText(i)+'</li>';}).join('')+'</ul>'+
      customer+dhtml+(o.notes?'<div class="muted" style="margin-top:7px"><b>Obs.:</b> '+esc(o.notes)+'</div>':'')+
      '<div class="inline" style="justify-content:space-between;margin-top:10px"><b>'+money(o.total)+'</b><div class="order-actions">'+
      (next?'<button class="btn btn-primary btn-sm" onclick="staffStatus(\''+o.id+'\',\''+next[1]+'\')">'+next[0]+'</button>':'')+
      dispatch+'</div></div></article>';
  };
  window.staffAssignDriver=async function(id,fixedDriverId){
    var driverId=fixedDriverId;
    if(!driverId){
      var sel=document.getElementById('staffDriver_'+id);
      driverId=sel&&sel.value;
    }
    if(!driverId)return toast('Escolha o entregador.');
    try{
      var r=await rpc('pc_assign_delivery_driver',{p_session_token:staffSession.session_token,p_order_id:id,p_driver_id:driverId},false);
      toast('Saiu para entrega com '+(r.driver_name||'entregador')+'.');
      await loadStaffOrders(true);
    }catch(e){toast(e.message);}
  };

  rerenderOrigin=function(origin){
    if(origin==='staff')return renderStaff();
    if(origin==='counter')return renderCounter(currentPublicSlug);
    if(origin==='delivery')return window.renderDelivery(currentPublicSlug);
    return renderQR(new URL(location.href).searchParams.get('qr'));
  };

  window.loadDelivery=async function(slug){
    clearPoll();appMode='delivery';currentPublicSlug=String(slug||'').trim();
    try{
      var boot=await rpc('pc_delivery_bootstrap',{p_business_slug:currentPublicSlug},false);
      staffSession=boot;applyComandaAppearance(boot);
      draft={tableId:'',qty:{},addons:{},lines:[],config:{},notes:'',customer:'',whatsapp:'',address:'',reference:''};
      window.renderDelivery(currentPublicSlug);
    }catch(e){
      document.getElementById('app').innerHTML='<div class="onboard"><div class="card"><h2>Delivery indisponível</h2><p>'+esc(e.message)+'</p><button class="btn btn-primary" onclick="location.href=\'/\'">Voltar ao Pede Comanda</button></div></div>';
    }
  };
  function deliveryMenuLine(p){
    if(draftIsCustom(p)){
      var count=(draft.lines||[]).filter(function(l){return l.product_id===p.id;}).reduce(function(s,l){return s+Math.max(1,Number(l.qty||1));},0);
      var subtotal=(draft.lines||[]).filter(function(l){return l.product_id===p.id;}).reduce(function(s,l){return s+draftLineTotal(l);},0);
      return '<div class="menu-row"><div><b>'+esc(p.name)+'</b><div class="muted">A partir de '+money(p.price)+'</div><div class="muted small">'+(count?count+' montado(s) no pedido':'Escolha opção e adicionais')+'</div></div>'+
        '<div><button class="mount-btn" onclick="draftOpenConfig(\''+p.id+'\',\'delivery\')">Escolher opções</button></div><div class="price">'+(count?money(subtotal):'—')+'</div>'+draftConfigBox(p,'delivery')+'</div>';
    }
    var q=draft.qty[p.id]||0;
    return '<div class="menu-row"><div><b>'+esc(p.name)+'</b><div class="muted">'+money(p.price)+'</div></div>'+
      '<div class="qty"><button onclick="deliveryQty(\''+p.id+'\',-1)">−</button><span>'+q+'</span><button onclick="deliveryQty(\''+p.id+'\',1)">+</button></div><div class="price">'+money(Number(p.price)*q)+'</div></div>';
  }
  window.deliveryQty=function(id,d){
    draft.qty[id]=Math.max(0,(draft.qty[id]||0)+d);
    window.renderDelivery(currentPublicSlug);
  };
  window.renderDelivery=function(slug){
    applyComandaAppearance(staffSession);
    var cats=staffSession.categories||[];
    var fee=deliveryFee();
    document.getElementById('app').innerHTML='<header class="topbar"><div class="brand">'+
      (staffSession.logo_url?'<img class="logo-mini" src="'+esc(staffSession.logo_url)+'">':'<div class="brandmark">PC</div>')+
      '<div class="brandtxt"><strong>'+esc(staffSession.business_name)+'</strong><small>Pede Comanda • Delivery</small></div></div></header>'+
      '<main class="main"><div class="comanda-shell customer-comanda">'+comandaCoverHtml(staffSession)+
      '<div class="comanda-head"><div class="store"><div><h2 style="margin:0">🛵 Pedido para Delivery</h2><small>Receba em casa • informe seu endereço</small></div></div></div>'+
      '<div class="comanda-body">'+cats.map(function(c){return '<section class="menu-cat"><h3>'+esc(c.name)+'</h3>'+(c.products||[]).map(deliveryMenuLine).join('')+'</section>';}).join('')+
      draftCart('delivery')+
      '<div class="field"><label>Seu nome *</label><input value="'+esc(draft.customer||'')+'" oninput="draft.customer=this.value" placeholder="Ex.: João"></div>'+
      '<div class="field"><label>WhatsApp *</label><input inputmode="tel" value="'+esc(draft.whatsapp||'')+'" oninput="draft.whatsapp=this.value" placeholder="(21) 99999-9999"><div class="muted small">Usaremos este número caso a loja ou o entregador precise falar com você.</div></div>'+
      '<div class="field"><label>Endereço completo *</label><textarea rows="2" oninput="draft.address=this.value" placeholder="Rua, número, bairro, cidade">'+esc(draft.address||'')+'</textarea></div>'+
      '<div class="field"><label>Ponto de referência (opcional)</label><input value="'+esc(draft.reference||'')+'" oninput="draft.reference=this.value" placeholder="Ex.: portão azul, próximo à praça"></div>'+
      '<div class="field"><label>Observações do pedido</label><textarea rows="3" oninput="draft.notes=this.value" placeholder="Ex.: sem cebola...">'+esc(draft.notes||'')+'</textarea></div>'+
      '<div class="card" style="box-shadow:none;background:#faf7f6;margin-top:10px"><div class="inline" style="justify-content:space-between"><span>Itens</span><b>'+money(draftTotal())+'</b></div>'+
      '<div class="inline" style="justify-content:space-between;margin-top:7px"><span>Taxa de entrega</span><b>'+money(fee)+'</b></div></div>'+
      '<div class="summary"><div><span class="muted">Total com entrega</span><strong>'+money(deliveryTotal())+'</strong></div></div>'+
      '<button class="send" onclick="submitDeliveryOrder(\''+esc(slug)+'\')">Pedir para entregar em casa</button></div></div></main>';
  };
  window.submitDeliveryOrder=async function(slug){
    var items=Object.entries(draft.qty).filter(function(x){return x[1]>0;}).map(function(x){
      return {product_id:x[0],qty:x[1],addons:[],variant_id:null};
    }).concat((draft.lines||[]).map(function(l){
      return {product_id:l.product_id,qty:Math.max(1,Number(l.qty||1)),addons:l.addons||[],variant_id:l.variant_id||null};
    }));
    if(!items.length)return toast('Selecione pelo menos um item.');
    if(!(draft.customer||'').trim())return toast('Informe seu nome.');
    var phone=normalizeCustomerPhone(draft.whatsapp||'');
    if(!phone||phone.length<12)return toast('Informe um WhatsApp válido.');
    if((draft.address||'').trim().length<8)return toast('Informe o endereço completo para entrega.');
    try{
      var r=await rpc('pc_place_delivery_order',{
        p_business_slug:slug,
        p_items:items,
        p_notes:draft.notes||null,
        p_customer_name:draft.customer||null,
        p_customer_whatsapp:phone,
        p_delivery_address:draft.address||null,
        p_delivery_reference:draft.reference||null
      },false);
      draft={tableId:'',qty:{},addons:{},lines:[],config:{},notes:'',customer:'',whatsapp:'',address:'',reference:''};
      document.getElementById('app').innerHTML='<div class="onboard"><div class="card" style="text-align:center"><div style="font-size:52px">🛵</div><h1>Pedido enviado!</h1>'+
        '<p>Pedido <b>#'+r.order_no+'</b> recebido pela cozinha.</p><h2>'+money(r.total)+'</h2>'+
        '<p class="muted">Taxa de entrega: '+money(r.delivery_fee||0)+'. Acompanhe pelo WhatsApp informado caso a loja precise falar com você.</p>'+
        customerPaymentHtml(r.order_no,r.total,null,true)+
        '<div style="display:grid;gap:10px;max-width:320px;margin:0 auto"><button class="btn btn-primary" onclick="renderDelivery(\''+esc(slug)+'\')">Fazer outro pedido</button><button class="btn btn-soft" onclick="location.href=\'/\'">Sair</button></div></div></div>';
    }catch(e){toast(e.message);}
  };

  customerPaymentHtml=function(orderNo,total,pickupNo,isDelivery){
    var key=String((staffSession&&staffSession.customer_pix_key)||'').trim();
    var otherText=isDelivery
      ? 'Na entrega, confirme com o estabelecimento se o pagamento será em cartão ou dinheiro.'
      : 'Pague no caixa ao finalizar o atendimento.';
    if(!key){
      return '<div style="margin:18px 0 14px;padding:14px;border:1px solid var(--line);border-radius:14px;background:#fff"><h3 style="margin:0 0 6px">Pagamento</h3><div class="muted">Pix ainda não configurado por esta loja. '+otherText+'</div></div>';
    }
    var code=storePixPayload(total);
    var qr='https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data='+encodeURIComponent(code);
    return '<div style="margin:18px 0 14px;padding:14px;border:1px solid var(--line);border-radius:14px;background:#fff;text-align:left">'+
      '<h3 style="margin:0 0 4px">💳 Como deseja pagar?</h3><div class="muted small" style="margin-bottom:12px">Você pode pagar agora por Pix ou combinar o pagamento '+(isDelivery?'na entrega':'no caixa')+'.</div>'+
      '<div class="customer-payment-grid" style="display:grid;grid-template-columns:minmax(150px,190px) 1fr;gap:14px;align-items:start">'+
      '<div style="text-align:center"><img src="'+qr+'" alt="QR Code Pix da loja" style="width:180px;height:180px;max-width:100%;background:#fff;padding:7px;border-radius:12px;border:1px solid var(--line)"><div class="small muted" style="margin-top:5px">Pix • '+money(total)+'</div></div>'+
      '<div><b>📲 Pagar com Pix</b><div class="small muted" style="margin:4px 0 8px">Chave: '+esc(key)+'</div>'+
      '<button class="btn btn-secondary btn-block btn-sm" onclick="copyStorePixKey()">Copiar chave Pix</button>'+
      '<button class="btn btn-primary btn-block btn-sm" style="margin-top:7px" onclick="copyStorePix('+Number(total)+')">Copiar Pix Copia e Cola</button>'+
      '<button class="btn btn-soft btn-block btn-sm" style="margin-top:7px" onclick="openCustomerReceipt(\''+orderNo+'\','+Number(total)+','+(pickupNo?Number(pickupNo):'null')+')">Já paguei / enviar comprovante</button>'+
      '<div style="margin-top:12px;padding:10px;border-radius:10px;background:#f7f3f1"><b>💳 Cartão ou dinheiro</b><div class="small muted" style="margin-top:3px">'+esc(otherText)+'</div></div>'+
      '</div></div></div>';
  };

  console.info('Pede Comanda Delivery '+DELIVERY_VERSION+' carregado');
})();