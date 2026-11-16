'use strict';

const branches = ['San Bernardino','Independencia','Encarnación','Hohenau'];
const stages = ['Consulta','Visita agendada','Visita realizada','Presupuesto enviado','Cerrado'];
const steps = ['Consulta','Visita','Visita hecha','Presupuesto','Cerrado'];
const actions = ['Agendar visita','Registrar visita realizada','Registrar envío','Cerrar proyecto'];
const actionTitles = ['Primer contacto','Visita técnica','Preparar presupuesto','Contactar al cliente'];
const key = 'novatec-konstantin-v1';
const example = 'KP-104';
const $ = id => document.getElementById(id);
const dialog = $('case-dialog');
const form = $('new-form');
const branch = $('branch-filter');
const filter = $('stage-filter');
const search = $('search');
const finance = new Intl.NumberFormat('es-PY');
const dateKey = () => new Intl.DateTimeFormat('sv-SE',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Asuncion'}).format(new Date());
const fmt = (day, options = {day:'numeric',month:'short'}) => day ? new Intl.DateTimeFormat('es-PY',{timeZone:'UTC',...options}).format(new Date(day+'T12:00:00Z')) : '';
const price = value => 'G. '+finance.format(value);
const escape = value => String(value).replace(/[&<>"']/g,ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
const normalize = text => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const arrow = '<span class="arrow" aria-hidden="true"></span>';

function offset(n) {
  const day = new Date(dateKey()+'T12:00:00Z');
  day.setUTCDate(day.getUTCDate()+n);
  return day.toISOString().slice(0,10);
}

function seed() {
  return [
    {id:example,client:'Familia Encina',type:'Piscina nueva',branch:branches[0],owner:'Andrea · Asesora',size:'8 × 4 m',state:1,date:offset(1),time:'10:30',amount:0,
      notes:'Piscina para vivienda. En la visita, confirmar nivel del terreno y acceso para equipos. La familia pidió evaluar filtración salina.',
      history:[{text:'Consulta recibida por WhatsApp',date:offset(-2)},{text:'Visita técnica agendada',date:dateKey()}]},
    {id:'KP-105',client:'Casa Yvaga',type:'Renovación',branch:branches[1],owner:'Luis · Asesor',size:'7 × 3 m',state:3,date:offset(0),time:'15:00',amount:18500000,
      notes:'Renovación de revestimiento. Confirmar colores con el cliente.',history:[{text:'Envío de presupuesto registrado',date:offset(-2)}]},
    {id:'KP-106',client:'Posada Lapacho',type:'Piscina nueva',branch:branches[2],owner:'Brenda · Asesora',size:'10 × 5 m',state:0,date:offset(0),time:'11:00',amount:0,
      notes:'Coordinar visita con administración.',history:[{text:'Consulta recibida',date:dateKey()}]},
    {id:'KP-103',client:'Residencia Laurel',type:'Piscina nueva',branch:branches[0],owner:'Andrea · Asesora',size:'6 × 3 m',state:3,date:offset(-1),time:'16:00',amount:43500000,
      notes:'Consultar si desea incluir iluminación.',history:[{text:'Envío de presupuesto registrado',date:offset(-4)}]},
    {id:'KP-102',client:'Quinta Arapoty',type:'Mantenimiento',branch:branches[3],owner:'Daniel · Asesor',size:'5 × 3 m',state:2,date:offset(2),time:'14:00',amount:0,
      notes:'La visita está registrada. Preparar el alcance del servicio.',history:[{text:'Visita técnica realizada',date:offset(-1)}]},
    {id:'KP-101',client:'Familia Tajy',type:'Piscina nueva',branch:branches[2],owner:'Brenda · Asesora',size:'6 × 4 m',state:4,date:'',time:'',amount:39000000,
      notes:'Seguimiento comercial cerrado.',history:[{text:'Proyecto cerrado',date:offset(-3)}]}
  ];
}

function load() {
  try {
    const rows = JSON.parse(localStorage.getItem(key));
    if (Array.isArray(rows) && rows.length && rows.every(row => stages[row.state] && branches.includes(row.branch) && Array.isArray(row.history))) return rows;
  } catch {}
  return seed();
}

let rows = load();
let current = '';
let timeOut;
const get = id => rows.find(row=>row.id===id);
const late = row => row.state < 4 && row.date && row.date < dateKey();
const byBranch = () => rows.filter(row=>!branch.value||row.branch===branch.value);
const are = list => list.map(name=>`<option>${name}</option>`).join('');
branch.innerHTML = '<option value="">Todas las sucursales</option>'+are(branches);
$('new-branch').innerHTML = are(branches);

function persist() {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
    return true;
  } catch {
    return false;
  }
}

function toast(text) {
  $('toast').hidden=false;
  $('toast').textContent=text;
  clearTimeout(timeOut);
  timeOut=setTimeout(()=>{$('toast').hidden=true;},3500);
}

function showView() {
  const hash=location.hash.slice(1);
  const agenda=hash==='agenda';
  $('view-proyectos').hidden=agenda;
  $('view-agenda').hidden=!agenda;
  $('view-title').textContent=agenda?'Agenda por sucursal':'Seguimiento comercial';
  for (const link of document.querySelectorAll('[data-view]')) {
    if (link.dataset.view===(agenda?'agenda':'proyectos')) link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  if (hash!=='main') window.scrollTo(0,0);
}

function pill(row) { return `<span class="pill s${row.state}">${stages[row.state]}</span>`; }

function render() {
  const branchRows=byBranch();
  const stats=[
    ['Visitas agendadas',branchRows.filter(row=>row.state===1).length,'Pendientes de realizar',''],
    ['Presupuestos enviados',branchRows.filter(row=>row.state===3).length,'Con seguimiento abierto',''],
    ['Acciones vencidas',branchRows.filter(late).length,'Para retomar','overdue']
  ];
  $('stats').innerHTML=stats.map(([label,total,caption,style])=>`<div class="stat ${style}"><span>${label}</span><strong>${total}</strong><small>${caption}</small></div>`).join('');
  renderProjects(branchRows);
  renderAgenda(branchRows);
}

function renderProjects(branchRows = byBranch()) {
  const query=normalize(search.value.trim());
  const results=branchRows.filter(row=>(!filter.value||String(row.state)===filter.value)&&normalize([row.id,row.client,row.type,row.owner].join(' ')).includes(query));
  $('count').textContent=results.length+(results.length===1?' proyecto':' proyectos');
  $('projects').innerHTML=results.length?`<div class="table-head" aria-hidden="true"><span>Proyecto</span><span>Responsable</span><span>Etapa</span><span>Próxima acción</span><span></span></div>`+results.map(row=>`
    <button class="row" type="button" data-action="open" data-id="${row.id}">
      <span class="row-client"><strong>${escape(row.client)}</strong><small>${row.id} · ${escape(row.branch)}</small></span><span class="row-owner">${escape(row.owner)}</span>${pill(row)}
      <span class="row-next"><strong>${row.state===4?'Seguimiento cerrado':actionTitles[row.state]}</strong><small class="${late(row)?'late':''}">${row.date?fmt(row.date)+(row.time?' · '+row.time:'')+(late(row)?' · Vencida':''):''}</small></span>${arrow}
    </button>`).join(''):'<p class="empty">No hay proyectos para esta búsqueda.</p>';
}

function renderAgenda(branchRows = byBranch()) {
  const mode=$('agenda-filter').value;
  const upcoming=branchRows.filter(row=>row.date&&row.state<4).filter(row=>{
    if (mode==='late') return late(row);
    if (mode==='visit') return row.state===1;
    if (mode==='contact') return row.state===0||row.state===3;
    return true;
  }).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  $('agenda').innerHTML=upcoming.map(row=>`
    <button class="agenda-row" type="button" data-action="open" data-id="${row.id}">
      <span><strong>${fmt(row.date)}</strong><small class="${late(row)?'late':''}">${row.time||'Sin hora'}${late(row)?' · Vencida':''}</small></span>
      <span><strong>${escape(row.client)}</strong><small>${escape(row.branch)} · ${escape(row.owner)}</small></span>
      <span><strong>${actionTitles[row.state]}</strong><small>${row.id}</small></span>${arrow}</button>`).join('')||'<p class="empty">No hay acciones para este filtro.</p>';
}

function caseForm(row) {
  if (row.state===4) return '<div class="action-card"><h3>Seguimiento cerrado</h3></div>';
  const dateLabel=['Fecha para agendar la visita','Fecha de la visita','Fecha del próximo contacto','Fecha del próximo contacto'][row.state];
  return `<form id="case-form" class="action-card">
    <h3>${actionTitles[row.state]}</h3>
    <p class="helper">${['Elegí fecha y hora para la visita técnica.','Registrá la visita cuando se haya realizado.','Dejá anotado el importe y cuándo volver a contactar al cliente.','Actualizá la fecha de seguimiento o cerrá el proyecto.'][row.state]}</p>
    <div class="form-grid"><label>${dateLabel}<input name="date" type="date" required value="${row.date || offset(1)}"></label>
    <label>Hora<input name="time" type="time" value="${row.time || '10:00'}" required></label>
    <label>Responsable<input name="owner" required maxlength="55" value="${escape(row.owner)}"></label>
    ${row.state>=2?`<label>Importe del presupuesto (G.)<input name="amount" type="number" inputmode="numeric" min="0" max="999999999999" step="1" value="${row.amount||''}"></label>`:''}</div>
    <details class="note-editor"><summary>Editar medidas y observaciones</summary><label>Medidas<input name="size" maxlength="50" value="${escape(row.size)}"></label><label>Observaciones<textarea name="notes" maxlength="350" rows="3">${escape(row.notes)}</textarea></label></details>
    <div class="actions"><button type="submit" class="button secondary" value="save">Guardar cambios</button><button class="button primary" type="submit" value="advance">${actions[row.state]} ${arrow}</button></div>
  </form>`;
}

function showCase(id) {
  const row=get(id);
  if (!row) return;
  current=id;
  $('case-code').textContent=row.id+' · '+row.branch;
  $('case-name').textContent=row.client;
  $('case-detail').textContent=row.type+' · '+row.owner;
  $('case-body').innerHTML=`
    <ol class="steps" aria-label="Etapas">${steps.map((label,i)=>`<li${i===row.state?' aria-current="step"':i<row.state?' class="done"':''}>${label}</li>`).join('')}</ol>
    <dl class="facts"><div><dt>Medidas</dt><dd>${escape(row.size||'Pendientes')}</dd></div><div><dt>Presupuesto</dt><dd>${row.amount?price(row.amount):'Por preparar'}</dd></div></dl>
    ${row.notes?`<p class="notes">${escape(row.notes)}</p>`:''}
    ${caseForm(row)}
    <details class="note-editor attach"><summary>Foto de referencia</summary>
      ${row.photo?`<img class="attached-image" src="${escape(row.photo)}" alt="Referencia del proyecto">`:''}
      <label>Adjuntar imagen de prueba<input type="file" id="photo" accept="image/png,image/jpeg,image/webp"></label></details>
    <details class="note-editor"><summary>Historial del proyecto</summary><ol>${[...row.history].reverse().map(item=>`<li>${fmt(item.date)} · ${escape(item.text)}</li>`).join('')}</ol></details>
    <p class="status" id="case-status" role="status"></p>`;
  if (!dialog.open) dialog.showModal();
}

function update(row, notice) {
  const saved=persist();
  render();
  showCase(row.id);
  $('case-status').textContent=saved?notice:notice+' Disponible durante esta sesión.';
  $('case-status').tabIndex=-1;
  $('case-status').focus();
}

$('case-body').addEventListener('submit',event=>{
  if (event.target.id!=='case-form') return;
  event.preventDefault();
  const row=get(current);
  if (!row || row.state===4) return;
  const data=new FormData(event.target);
  const owner=data.get('owner').trim();
  const amount=Number(data.get('amount')) || 0;
  const advance=event.submitter?.value==='advance';
  if (!owner) { $('case-status').textContent='Ingresá un responsable.'; return; }
  if (advance && row.state===2 && amount<=0) { $('case-status').textContent='Ingresá el importe antes de registrar el envío.'; return; }
  Object.assign(row,{owner,date:data.get('date'),time:data.get('time'),size:data.get('size').trim(),notes:data.get('notes').trim()});
  if (data.has('amount')) row.amount=amount;
  if (advance) {
    const labels=['Visita técnica agendada','Visita técnica realizada','Envío de presupuesto registrado','Proyecto cerrado'];
    row.history.push({text:labels[row.state],date:row.state===1?row.date:dateKey()});
    row.state+=1;
    if (row.state===2) row.date=offset(1);
    if (row.state===4) row.date=row.time='';
  }
  update(row,advance?'Etapa actualizada.':'Cambios guardados.');
});

async function attach(file,row) {
  try {
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>8*1024*1024) throw new Error('Usá una imagen PNG, JPG o WebP de hasta 8 MB.');
    const img=await createImageBitmap(file);
    const scale=Math.min(1,520/Math.max(img.width,img.height));
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(img.width*scale)); c.height=Math.max(1,Math.round(img.height*scale));
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    img.close();
    if (get(row.id)!==row) return;
    row.photo=c.toDataURL('image/webp',.8);
    if (dialog.open&&current===row.id) {
      const saved=persist();
      const details=$('photo').closest('details');
      let preview=details.querySelector('.attached-image');
      if (!preview) {
        preview=document.createElement('img');
        preview.className='attached-image';
        preview.alt='Referencia del proyecto';
        details.querySelector('summary').after(preview);
      }
      preview.src=row.photo;
      $('case-status').textContent=saved?'Foto adjuntada.':'Foto disponible durante esta sesión.';
    } else persist();
  } catch (error) {
    if (dialog.open&&current===row.id) $('case-status').textContent=error instanceof Error&&error.message.startsWith('Usá')?error.message:'No pudimos abrir la imagen.';
  }
}
$('case-body').addEventListener('change',event=>{
  if (event.target.id==='photo'&&event.target.files[0]) attach(event.target.files[0],get(current));
});

form.addEventListener('submit',event=>{
  event.preventDefault();
  const data=Object.fromEntries([...new FormData(form)].map(([name,value])=>[name,value.trim()]));
  for (const field of ['client','owner']) {
    if (data[field]) continue;
    form.elements[field].setCustomValidity('Ingresá un valor.');
    form.elements[field].reportValidity();
    return;
  }
  const next=Math.max(106,...rows.map(row=>Number(row.id.slice(3))))+1;
  const row={...data,id:'KP-'+next,state:0,time:'10:00',amount:0,history:[{text:'Consulta registrada',date:dateKey()}]};
  rows.unshift(row);
  $('new-dialog').close();
  branch.value=row.branch;
  filter.value='';
  search.value='';
  location.hash='#proyectos';
  update(row,'Consulta registrada.');
});

form.addEventListener('input',event=>event.target.setCustomValidity?.(''));
branch.addEventListener('change',render);
search.addEventListener('input',()=>renderProjects());
filter.addEventListener('change',()=>renderProjects());
$('agenda-filter').addEventListener('change',()=>renderAgenda());
window.addEventListener('hashchange',showView);

document.addEventListener('click',event=>{
  const button=event.target.closest('button[data-action]');
  if (!button) return;
  switch(button.dataset.action) {
    case 'open': showCase(button.dataset.id); break;
    case 'example': showCase(example); break;
    case 'close-case': dialog.close(); break;
    case 'close-new': $('new-dialog').close(); break;
    case 'new':
      form.reset();
      form.elements.client.setCustomValidity('');
      form.elements.owner.setCustomValidity('');
      form.elements.branch.value=branch.value || branches[0];
      form.elements.date.value=offset(1);
      $('new-dialog').showModal();
      break;
    case 'reset': $('reset-dialog').showModal(); break;
    case 'close-reset': $('reset-dialog').close(); break;
    case 'confirm-reset':
      rows=seed();
      branch.value=filter.value=search.value=$('agenda-filter').value='';
      $('reset-dialog').close();
      render();
      toast(persist()?'Demo reiniciada.':'Demo reiniciada durante esta sesión.');
      break;
  }
});

persist();
showView();
render();
