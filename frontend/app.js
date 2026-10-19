const $ = s => document.querySelector(s);
const euro = n => new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(Number(n||0));
const date = value => value ? new Date(value).toLocaleDateString('es-ES',{day:'2-digit',month:'short'}) : '—';
const dateLong = value => value ? new Date(value).toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'}) : '—';
const safe = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state = { page:'dashboard', dashboard:null, players:[], contracts:[], training:[], matches:[], stats:[], injuries:[], finance:null, query:'', position:'Todas' };
const titles = {dashboard:'Centro de operaciones',players:'Gestión de plantilla',contracts:'Contratos y salarios',training:'Planificación de entrenamientos',matches:'Calendario de partidos',stats:'Rendimiento deportivo',injuries:'Control de lesiones',finance:'Control financiero'};
let toastTimer, activeForm = null;

async function api(path, options={}) {
  const res = await fetch(path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||'No se pudo completar la operación.');
  return data;
}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
function statusTag(status){
  const cls = status==='Disponible'||status==='Finalizado'||status==='Vigente'?'ok':status==='En recuperación'||status==='Renovación'?'warning':status==='Lesionado'||status==='Recaída'?'danger':'neutral';
  return `<span class="status ${cls}">${safe(status||'Sin estado')}</span>`;
}
function initials(name){return String(name||'').split(' ').slice(0,2).map(x=>x[0]||'').join('').toUpperCase()}
function statCard(label,value,icon,foot='Datos del club'){
 return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot"><span class="trend">●</span>${foot}</div></article>`;
}
function pageIntro(title,desc,actionLabel,action){
 return `<div class="page-intro"><div><h2>${title}</h2><p>${desc}</p></div>${actionLabel?`<button class="primary-button" data-action="${action}">${actionLabel} <span>＋</span></button>`:''}</div>`;
}
function panelHead(title,desc='',action=''){
 return `<div class="panel-head"><div><h3>${title}</h3>${desc?`<p>${desc}</p>`:''}</div>${action?`<button class="text-link" data-page="${action}">Ver todo ↗</button>`:''}</div>`;
}
function matchRow(m){
 const result=m.status==='Finalizado'?`${m.goals_for} — ${m.goals_against}`:'— : —';
 return `<div class="match-row"><div class="match-date"><strong>${date(m.match_date)}</strong>${safe(m.venue)}</div><div><div class="opponent">${safe(m.opponent)}</div><div class="match-sub">${safe(m.competition)} · ${m.venue==='Local'?'Atlético Horizonte':'Fuera'}</div></div><div class="match-score">${result}<small>${statusTag(m.status)}</small></div></div>`;
}
function renderDashboard(){
 const d=state.dashboard;if(!d)return '<div class="loading">Cargando resumen…</div>';
 const upcoming=d.upcomingMatches||[], f=d.finance||{}, p=d.players||{};
 const bars=[['Lun',62,42],['Mar',78,55],['Mié',48,72],['Jue',91,61],['Vie',67,45],['Sáb',100,74],['Dom',58,36]];
 return `
 <div class="page-intro"><div><h2>Resumen de temporada</h2><p>Vista general del estado deportivo y operativo del club.</p></div><span class="status ok">● Sistema operativo</span></div>
 <div class="stats-grid">
 ${statCard('Jugadores en plantilla',p.total??0,'♟',`${p.available??0} disponibles`)}
 ${statCard('Masa salarial anual',euro(d.contracts?.payroll),'€','Contratos vigentes y renovaciones')}
 ${statCard('Enfermería',d.injuries?.total??0,'✚','Jugadores en recuperación')}
 ${statCard('Goles + asistencias',`${d.performance?.goals??0} / ${d.performance?.assists??0}`,'↗','Estadísticas registradas')}
 </div>
 <div class="dashboard-grid">
  <section class="panel">${panelHead('Próximos compromisos','Calendario del primer equipo','matches')}
   <div class="match-list">${upcoming.length?upcoming.map(matchRow).join(''):'<div class="empty">No hay partidos registrados.</div>'}</div>
  </section>
  <section class="panel">${panelHead('Pulso financiero','Ingresos frente a gastos')}
   <div class="finance-content"><span class="stat-top">Balance acumulado</span><div class="finance-total">${euro(f.balance)}</div>
    <div class="finance-legend"><span>Ingresos ${euro(f.income)}</span><span>Gastos ${euro(f.expenses)}</span></div>
    <div class="bar-chart">${bars.map(([label,inc,exp])=>`<div class="bar-group"><div class="bar-pair"><span class="bar" style="height:${inc}%"></span><span class="bar expense" style="height:${exp}%"></span></div><span class="bar-label">${label}</span></div>`).join('')}</div>
    <div class="finance-foot"><span>Resumen ilustrativo semanal</span><button class="text-link" data-page="finance">Ver movimientos ↗</button></div>
   </div>
  </section>
 </div>
 <section class="panel squad-panel">${panelHead('Plantilla del primer equipo','Vista rápida de jugadores','players')}
  ${playerTable(state.players.slice(0,5),false)}
 </section>`;
}
function playerTable(players,actions=true){
 return `<div class="table-wrap"><table><thead><tr><th>JUGADOR</th><th>DORSAL</th><th>POSICIÓN</th><th>EDAD</th><th>CONTRATO HASTA</th><th>ESTADO</th>${actions?'<th></th>':''}</tr></thead><tbody>
 ${players.length?players.map(p=>`<tr><td><div class="player-cell"><span class="player-avatar">${initials(p.full_name)}</span><span><span class="player-name">${safe(p.full_name)}</span><span class="player-sub">${safe(p.nationality)} · ${safe(p.foot)}</span></span></div></td><td><span class="number-pill">${p.shirt_number}</span></td><td><span class="position-pill">${safe(p.position)}</span></td><td>${p.age}</td><td>${date(p.end_date)}</td><td>${statusTag(p.status)}</td>${actions?`<td><button class="text-link" data-edit-player="${p.id}">Editar</button> <button class="text-link" data-delete-player="${p.id}">×</button></td>`:''}</tr>`).join(''):`<tr><td colspan="${actions?7:6}" class="empty">No hay jugadores que coincidan.</td></tr>`}
 </tbody></table></div>`;
}
function renderPlayers(){
 const filtered=state.players.filter(p=>(p.full_name+' '+p.nationality).toLowerCase().includes(state.query.toLowerCase())&&(state.position==='Todas'||p.position===state.position));
 return `${pageIntro('Plantilla del primer equipo','Gestiona dorsales, posiciones, disponibilidad y datos contractuales.','Añadir jugador','player')}
 <div class="search-tools"><input class="search-input" id="player-search" placeholder="⌕  Buscar jugador o nacionalidad…" value="${safe(state.query)}"><select class="filter-select" id="position-filter">${['Todas','Portero','Defensa','Centrocampista','Extremo','Delantero'].map(x=>`<option ${state.position===x?'selected':''}>${x}</option>`).join('')}</select><span class="status neutral">${filtered.length} futbolistas</span></div>
 <section class="table-panel">${playerTable(filtered,true)}<div class="table-footer"><span>Temporada 2026/27 · Datos de demostración</span><span>${filtered.length} registros</span></div></section>`;
}
function renderContracts(){
 const rows=state.contracts;
 return `${pageIntro('Contratos y salarios','Controla vigencias, masa salarial y primas de firma.','Nuevo contrato','contract')}
 <div class="stats-grid">${statCard('Contratos registrados',rows.length,'▤','Vigentes y finalizados')}${statCard('Masa salarial anual',euro(rows.filter(x=>x.status==='Vigente'||x.status==='Renovación').reduce((s,x)=>s+Number(x.annual_salary),0)),'€','Salario fijo anual')}${statCard('Primas de firma',euro(rows.reduce((s,x)=>s+Number(x.signing_bonus),0)),'✦','Importe acumulado')}</div>
 <section class="table-panel"><div class="table-wrap"><table><thead><tr><th>JUGADOR</th><th>INICIO</th><th>FIN</th><th>SALARIO ANUAL</th><th>PRIMA</th><th>ESTADO</th></tr></thead><tbody>${rows.map(c=>`<tr><td><div class="player-name">${safe(c.player_name)} <span class="player-sub">#${c.shirt_number}</span></div></td><td>${date(c.start_date)}</td><td>${date(c.end_date)}</td><td><strong>${euro(c.annual_salary)}</strong></td><td>${euro(c.signing_bonus)}</td><td>${statusTag(c.status)}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function renderTraining(){
 const rows=state.training;
 return `${pageIntro('Planificación de entrenamientos','Organiza las sesiones, controla intensidad y registra asistencia.','Programar sesión','training')}
 <div class="cards-grid">${['Técnico','Táctico','Físico','Recuperación','Estrategia'].map((t,i)=>`<div class="info-card"><span class="eyebrow">TIPO DE SESIÓN 0${i+1}</span><h3>${t}</h3><p>${['Control, pase, finalización y técnica individual.','Trabajo de bloque, presión y automatismos.','Fuerza, velocidad y prevención de lesiones.','Movilidad, descarga y readaptación.','Balón parado y preparación del rival.'][i]}</p><span class="status neutral">Planificable</span></div>`).join('')}</div>
 <section class="panel squad-panel">${panelHead('Agenda de sesiones','Últimas sesiones registradas')}
 <div class="table-wrap"><table><thead><tr><th>FECHA</th><th>TIPO</th><th>DURACIÓN</th><th>INTENSIDAD</th><th>ASISTENCIA</th><th>NOTAS</th></tr></thead><tbody>${rows.length?rows.map(t=>`<tr><td>${dateLong(t.session_date)}</td><td><strong>${safe(t.session_type)}</strong></td><td>${t.duration_minutes} min</td><td>${'●'.repeat(t.intensity)}${'○'.repeat(5-t.intensity)}</td><td>${t.attendance} jugadores</td><td>${safe(t.notes||'—')}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">No hay sesiones registradas.</td></tr>'}</tbody></table></div></section>`;
}
function renderMatches(){
 return `${pageIntro('Calendario de partidos','Programa encuentros y registra resultados de las competiciones.','Añadir partido','match')}
 <div class="metric-strip"><div class="metric-mini"><span>Partidos disputados</span><strong>${state.matches.filter(m=>m.status==='Finalizado').length}</strong></div><div class="metric-mini"><span>Próximos encuentros</span><strong>${state.matches.filter(m=>m.status==='Programado').length}</strong></div><div class="metric-mini"><span>Goles a favor</span><strong>${state.matches.filter(m=>m.status==='Finalizado').reduce((s,m)=>s+Number(m.goals_for||0),0)}</strong></div></div>
 <section class="panel">${panelHead('Todos los encuentros','Ordenados por fecha de partido')}<div class="match-list">${[...state.matches].sort((a,b)=>new Date(a.match_date)-new Date(b.match_date)).map(matchRow).join('')||'<div class="empty">No hay partidos.</div>'}</div></section>`;
}
function renderStats(){
 const s=state.stats;const goals=s.reduce((a,p)=>a+p.goals,0),assists=s.reduce((a,p)=>a+p.assists,0),minutes=s.reduce((a,p)=>a+p.minutes,0);
 return `${pageIntro('Rendimiento deportivo','Estadísticas individuales de la temporada 2026/27.','Actualizar estadísticas','stats')}
 <div class="stats-grid">${statCard('Goles',goals,'⚽','Total de la plantilla')}${statCard('Asistencias',assists,'↗','Último pase de gol')}${statCard('Minutos',minutes.toLocaleString('es-ES'),'◷','Minutos acumulados')}${statCard('Tarjetas',s.reduce((a,p)=>a+p.yellow_cards+p.red_cards,0),'▤','Amarillas y rojas')}</div>
 <section class="table-panel"><div class="table-wrap"><table><thead><tr><th>JUGADOR</th><th>PARTIDOS</th><th>MINUTOS</th><th>GOLES</th><th>ASISTENCIAS</th><th>AMARILLAS</th><th>ROJAS</th></tr></thead><tbody>${s.map(p=>`<tr><td><div class="player-cell"><span class="player-avatar">${initials(p.player_name)}</span><span><span class="player-name">${safe(p.player_name)}</span><span class="player-sub">${safe(p.position)}</span></span></div></td><td>${p.appearances}</td><td>${p.minutes}</td><td><strong>${p.goals}</strong></td><td>${p.assists}</td><td>${p.yellow_cards}</td><td>${p.red_cards}</td></tr>`).join('')}</tbody></table></div></section>
 <p style="color:var(--muted);font-size:10px;margin-top:12px">Para registrar o actualizar estadísticas, utiliza «Actualizar estadísticas» y selecciona jugador y temporada.</p>`;
}
function renderInjuries(){
 const rows=state.injuries;
 return `${pageIntro('Control de lesiones','Seguimiento de bajas, fechas estimadas de vuelta y readaptación.','Registrar lesión','injury')}
 <div class="stats-grid">${statCard('Casos registrados',rows.length,'✚','Historial médico deportivo')}${statCard('En recuperación',rows.filter(i=>i.status==='En recuperación').length,'◷','Seguimiento activo')}${statCard('Disponibles',rows.filter(i=>i.status==='Disponible').length,'✓','Casos cerrados')}</div>
 <section class="panel">${panelHead('Parte de enfermería','Estado actual y próxima revisión')}
 ${rows.length?rows.map(i=>`<div class="injury-row"><div><strong>${safe(i.player_name)} <span class="player-sub">#${i.shirt_number}</span></strong><p>${safe(i.injury_type)} · Desde ${date(i.start_date)} · Vuelta estimada: ${date(i.estimated_return)}</p><p>${safe(i.notes||'Sin notas')}</p></div><div>${statusTag(i.status)}<div style="margin-top:8px"><button class="text-link" data-resolve-injury="${i.id}">Marcar disponible</button></div></div></div>`).join(''):'<div class="empty">No hay lesiones registradas.</div>'}
 </section>`;
}
function renderFinance(){
 const f=state.finance||{transactions:[],summary:{}};const s=f.summary||{};
 return `${pageIntro('Control financiero','Registra ingresos y gastos del club y consulta el balance acumulado.','Nuevo movimiento','finance')}
 <div class="stats-grid">${statCard('Ingresos',euro(s.income),'↗','Ingresos registrados')}${statCard('Gastos',euro(s.expenses),'↘','Gastos registrados')}${statCard('Balance',euro(s.balance),'€','Ingresos menos gastos')}${statCard('Movimientos',f.transactions.length,'▤','Transacciones registradas')}</div>
 <section class="table-panel"><div class="panel-head"><div><h3>Libro de movimientos</h3><p>Últimas operaciones registradas</p></div><span class="status neutral">${f.transactions.length} movimientos</span></div><div class="table-wrap"><table><thead><tr><th>FECHA</th><th>TIPO</th><th>CATEGORÍA</th><th>DESCRIPCIÓN</th><th>IMPORTE</th></tr></thead><tbody>${f.transactions.map(t=>`<tr><td>${date(t.transaction_date)}</td><td>${statusTag(t.transaction_type==='Ingreso'?'Disponible':'En recuperación').replace('Disponible','Ingreso').replace('En recuperación','Gasto')}</td><td>${safe(t.category)}</td><td>${safe(t.description)}</td><td><strong style="color:${t.transaction_type==='Ingreso'?'#628c43':'#bd6b60'}">${t.transaction_type==='Ingreso'?'+':'−'}${euro(t.amount)}</strong></td></tr>`).join('')}</tbody></table></div></section>`;
}
const renderers={dashboard:renderDashboard,players:renderPlayers,contracts:renderContracts,training:renderTraining,matches:renderMatches,stats:renderStats,injuries:renderInjuries,finance:renderFinance};
async function loadAll(){
 const results=await Promise.allSettled([
 api('/api/dashboard'),api('/api/players'),api('/api/contracts'),api('/api/training'),api('/api/matches'),api('/api/stats'),api('/api/injuries'),api('/api/finance')
 ]);
 const keys=['dashboard','players','contracts','training','matches','stats','injuries','finance'];
 results.forEach((r,i)=>{if(r.status==='fulfilled')state[keys[i]]=r.value;else console.error(keys[i],r.reason)});
 $('#nav-player-count').textContent=state.players.length;
 $('#nav-injury-count').textContent=state.injuries.filter(x=>x.status==='En recuperación').length;
 renderPage();
}
function renderPage(){
 $('#page-title').textContent=titles[state.page];
 $('#crumb-current').textContent=state.page==='dashboard'?'Resumen':titles[state.page];
 $('#page-content').innerHTML=renderers[state.page]();
}
function goPage(page){
 if(!renderers[page])return;
 state.page=page;state.query='';state.position='Todas';
 document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
 renderPage();window.scrollTo({top:0,behavior:'smooth'});
}
const fields = {
 player:{title:'Añadir jugador',endpoint:'/api/players',fields:[
  ['full_name','Nombre completo','text',true],['shirt_number','Dorsal','number',true],['position','Posición','select',true,['Portero','Defensa','Centrocampista','Extremo','Delantero']],['age','Edad','number',true],['nationality','Nacionalidad','text',false],['foot','Pie dominante','select',false,['Derecho','Zurdo','Ambidiestro']],['status','Estado','select',false,['Disponible','Lesionado','Baja']]]},
 contract:{title:'Nuevo contrato',endpoint:'/api/contracts',fields:[
  ['player_id','Jugador','player',true],['start_date','Fecha de inicio','date',true],['end_date','Fecha de fin','date',true],['annual_salary','Salario anual (€)','number',true],['signing_bonus','Prima de firma (€)','number',false],['status','Estado contractual','select',false,['Vigente','Renovación','Finalizado']]]},
 training:{title:'Programar entrenamiento',endpoint:'/api/training',fields:[
  ['session_date','Fecha y hora','datetime-local',true],['session_type','Tipo de sesión','select',true,['Técnico','Táctico','Físico','Recuperación','Estrategia']],['intensity','Intensidad (1–5)','number',false],['duration_minutes','Duración en minutos','number',false],['attendance','Asistentes','number',false],['notes','Notas','textarea',false]]},
 match:{title:'Añadir partido',endpoint:'/api/matches',fields:[
  ['opponent','Rival','text',true],['competition','Competición','text',true],['match_date','Fecha y hora','datetime-local',true],['venue','Local / visitante','select',true,['Local','Visitante']],['goals_for','Goles a favor (si finalizado)','number',false],['goals_against','Goles en contra','number',false],['status','Estado','select',false,['Programado','Finalizado','Aplazado']],['notes','Notas','textarea',false]]},
 stats:{title:'Actualizar estadísticas',endpoint:'/api/stats',fields:[
  ['player_id','Jugador','player',true],['season','Temporada','text',true],['appearances','Partidos','number',false],['minutes','Minutos','number',false],['goals','Goles','number',false],['assists','Asistencias','number',false],['yellow_cards','Tarjetas amarillas','number',false],['red_cards','Tarjetas rojas','number',false]]},
 injury:{title:'Registrar lesión',endpoint:'/api/injuries',fields:[
  ['player_id','Jugador','player',true],['injury_type','Tipo de lesión','text',true],['start_date','Fecha de inicio','date',true],['estimated_return','Vuelta estimada','date',false],['status','Estado','select',false,['En recuperación','Disponible','Recaída']],['notes','Notas de seguimiento','textarea',false]]},
 finance:{title:'Nuevo movimiento financiero',endpoint:'/api/finance',fields:[
  ['transaction_type','Tipo de movimiento','select',true,['Ingreso','Gasto']],['category','Categoría','select',true,['Patrocinio','Taquilla','Derechos audiovisuales','Traspasos','Salarios','Instalaciones','Viajes','Material deportivo','Otros']],['description','Descripción','text',true],['amount','Importe (€)','number',true],['transaction_date','Fecha','date',false]]}
};
function openForm(kind){
 const config=fields[kind];if(!config)return;
 activeForm=kind;$('#modal-title').textContent=config.title;$('#modal-error').textContent='';
 $('#modal-fields').innerHTML=config.fields.map(([name,label,type,required,options])=>{
  let input='';
  if(type==='select')input=`<select name="${name}" ${required?'required':''}>${(options||[]).map(o=>`<option value="${safe(o)}">${safe(o)}</option>`).join('')}</select>`;
  else if(type==='player')input=`<select name="${name}" required>${state.players.map(p=>`<option value="${p.id}">${safe(p.full_name)} (#${p.shirt_number})</option>`).join('')}</select>`;
  else if(type==='textarea')input=`<textarea name="${name}" ${required?'required':''}></textarea>`;
  else input=`<input name="${name}" type="${type}" ${required?'required':''} ${type==='number'?'min="0"':''} ${name==='age'?'max="50" min="15"':''} ${name==='shirt_number'?'max="99" min="1"':''} ${name==='intensity'?'max="5" min="1"':''} ${name==='duration_minutes'?'max="240" min="10"':''} ${name==='season'?'value="2026/27"':''} ${name==='transaction_date'?'value="'+new Date().toISOString().slice(0,10)+'"':''}>`;
  return `<div class="field ${type==='textarea'?'full':''}"><label for="field-${name}">${label}${required?' *':''}</label>${input}</div>`;
 }).join('');
 $('#record-dialog').showModal();
}
function closeForm(){$('#record-dialog').close();activeForm=null}
$('#navigation').addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(b)goPage(b.dataset.page)});
$('#page-content').addEventListener('click',async e=>{
 const action=e.target.closest('[data-action]');if(action){openForm(action.dataset.action);return}
 const page=e.target.closest('[data-page]');if(page){goPage(page.dataset.page);return}
 const edit=e.target.closest('[data-edit-player]');if(edit){const p=state.players.find(x=>x.id===Number(edit.dataset.editPlayer));if(p)openEditPlayer(p);return}
 const del=e.target.closest('[data-delete-player]');if(del){const p=state.players.find(x=>x.id===Number(del.dataset.deletePlayer));if(!p||!confirm(`¿Eliminar a ${p.full_name}? También se borrarán sus contratos, estadísticas y lesiones.`))return;try{await api(`/api/players/${p.id}`,{method:'DELETE'});toast('Jugador eliminado');await loadAll()}catch(err){toast(err.message)}return}
 const resolve=e.target.closest('[data-resolve-injury]');if(resolve){const injury=state.injuries.find(x=>x.id===Number(resolve.dataset.resolveInjury));if(!injury)return;try{await api(`/api/injuries/${injury.id}`,{method:'PATCH',body:JSON.stringify({status:'Disponible',estimated_return:new Date().toISOString().slice(0,10),notes:injury.notes||''})});toast('Estado actualizado');await loadAll()}catch(err){toast(err.message)}}
});
function openEditPlayer(p){
 activeForm='edit-player';$('#modal-title').textContent=`Editar · ${p.full_name}`;$('#modal-error').textContent='';
 const config=fields.player;
 $('#modal-fields').innerHTML=config.fields.map(([name,label,type,required,options])=>{
  const value=p[name]??'';
  const input=type==='select'?`<select name="${name}" ${required?'required':''}>${options.map(o=>`<option ${o===value?'selected':''}>${safe(o)}</option>`).join('')}</select>`:`<input name="${name}" type="${type}" value="${safe(value)}" ${required?'required':''} ${type==='number'?'min="0"':''}>`;
  return `<div class="field"><label>${label}${required?' *':''}</label>${input}</div>`;
 }).join('');
 $('#record-dialog').showModal();
}
$('#record-form').addEventListener('submit',async e=>{
 e.preventDefault();const form=e.currentTarget;const data=Object.fromEntries(new FormData(form).entries());
 for(const [k,v] of Object.entries(data)){if(v===''&&['goals_for','goals_against','estimated_return','notes','nationality','signing_bonus','attendance','intensity','duration_minutes','season','transaction_date'].includes(k))delete data[k];else if(v!==''&&['shirt_number','age','player_id','annual_salary','signing_bonus','intensity','duration_minutes','attendance','goals_for','goals_against','appearances','minutes','goals','assists','yellow_cards','red_cards','amount'].includes(k))data[k]=Number(v)}
 try{
  if(activeForm==='edit-player'){
   const id=state.players.find(p=>p.full_name===$('#modal-title').textContent.replace('Editar · ','')).id;
   await api(`/api/players/${id}`,{method:'PUT',body:JSON.stringify(data)});
  }else{
   await api(fields[activeForm].endpoint,{method:'POST',body:JSON.stringify(data)});
  }
  closeForm();toast('Registro guardado correctamente');await loadAll();
 }catch(err){$('#modal-error').textContent=err.message}
});
$('#modal-close').addEventListener('click',closeForm);$('#modal-cancel').addEventListener('click',closeForm);
$('#refresh').addEventListener('click',async()=>{await loadAll();toast('Datos actualizados')});
$('#page-content').addEventListener('input',e=>{if(e.target.id==='player-search'){state.query=e.target.value;const cursor=e.target.selectionStart;const view=renderPlayers();$('#page-content').innerHTML=view;const input=$('#player-search');input.focus();input.setSelectionRange(cursor,cursor)}});
$('#page-content').addEventListener('change',e=>{if(e.target.id==='position-filter'){state.position=e.target.value;renderPage()}});
loadAll().catch(err=>{console.error(err);$('#page-content').innerHTML='<div class="empty-results">No se pudo conectar con la API. Comprueba Docker Compose y vuelve a actualizar.</div>'});
