const state = {
  step: 1,
  docente: null,        // { id, nombre_completo, institucion_id, institucion_nombre, bachillerato_tecnico }
  modulo: null,          // { id, nombre, codigo }
  ra: null,              // { id, codigo, descripcion }
  tipo: 'Individual',
  tiempo: 50,
  fecha: '',
  valor: '',
  enunciado: '',
  generado: null,        // respuesta cruda de la IA
  instrumentos: [],
  planificacionId: null,
};

// ---------- Navegación entre pasos ----------
function goToStep(n) {
  state.step = n;
  document.querySelectorAll('.step-view').forEach(el => el.classList.add('is-hidden'));
  document.getElementById(`view-${n}`).classList.remove('is-hidden');

  document.querySelectorAll('.step').forEach(el => {
    const s = parseInt(el.dataset.step, 10);
    el.classList.toggle('active', s === n);
    el.classList.toggle('done', s < n);
  });
}

// ---------- Inicialización ----------
async function init() {
  try {
    const docentes = await Api.docentes();
    const sel = document.getElementById('selDocente');
    sel.innerHTML = '<option value="">Selecciona tu nombre…</option>' +
      docentes.map(d => `<option value="${d.id}">${d.nombre_completo}</option>`).join('');
    sel.dataset.raw = JSON.stringify(docentes);
  } catch (e) {
    alert('No se pudo conectar con la API. Verifica API_BASE en js/config.js.\n' + e.message);
  }

  try {
    state.instrumentos = await Api.instrumentosEvaluacion();
    const sel = document.getElementById('selInstrumento');
    sel.innerHTML = state.instrumentos.map(i => `<option value="${i.id}">${i.nombre}</option>`).join('')
      + '<option value="otro">Otro (especificar)</option>';
  } catch (e) { /* silencioso: no bloquea el flujo */ }

  const hoy = new Date().toISOString().slice(0, 10);
  document.getElementById('dateFecha').value = hoy;

  bindEvents();
  goToStep(1);
}

function bindEvents() {
  // --- Paso 1 ---
  document.getElementById('selDocente').addEventListener('change', async (e) => {
    const docentes = JSON.parse(e.target.dataset.raw || '[]');
    const d = docentes.find(x => String(x.id) === e.target.value);
    state.docente = d || null;

    document.getElementById('txtInstitucion').value = d ? d.institucion_nombre : '';
    document.getElementById('txtBachillerato').value = d ? d.bachillerato_tecnico : '';

    const selModulo = document.getElementById('selModulo');
    const selRA = document.getElementById('selRA');
    selModulo.innerHTML = '<option value="">Cargando…</option>';
    selRA.innerHTML = '<option value="">Selecciona un módulo primero…</option>';
    state.modulo = null; state.ra = null;

    if (!d) { selModulo.innerHTML = '<option value="">Selecciona un docente primero…</option>'; return; }

    try {
      const modulos = await Api.modulosPorDocente(d.id);
      selModulo.innerHTML = '<option value="">Selecciona un módulo…</option>' +
        modulos.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('');
      selModulo.dataset.raw = JSON.stringify(modulos);
    } catch (e) {
      selModulo.innerHTML = '<option value="">Error al cargar módulos</option>';
    }
  });

  document.getElementById('selModulo').addEventListener('change', async (e) => {
    const modulos = JSON.parse(e.target.dataset.raw || '[]');
    const m = modulos.find(x => String(x.id) === e.target.value);
    state.modulo = m || null;

    const selRA = document.getElementById('selRA');
    selRA.innerHTML = '<option value="">Cargando…</option>';
    state.ra = null;
    if (!m) { selRA.innerHTML = '<option value="">Selecciona un módulo primero…</option>'; return; }

    try {
      const ras = await Api.resultadosAprendizaje(m.id);
      if (ras.length === 0) {
        selRA.innerHTML = '<option value="">Este módulo no tiene RA cargados</option>';
        return;
      }
      selRA.innerHTML = '<option value="">Selecciona un RA…</option>' +
        ras.map(r => `<option value="${r.id}">${r.codigo} — ${r.descripcion.slice(0, 60)}${r.descripcion.length > 60 ? '…' : ''}</option>`).join('');
      selRA.dataset.raw = JSON.stringify(ras);
    } catch (e) {
      selRA.innerHTML = '<option value="">Error al cargar RA</option>';
    }
  });

  document.getElementById('selRA').addEventListener('change', (e) => {
    const ras = JSON.parse(e.target.dataset.raw || '[]');
    state.ra = ras.find(x => String(x.id) === e.target.value) || null;
  });

  document.getElementById('btnPaso1Next').addEventListener('click', () => {
    if (!state.docente) return alert('Selecciona un docente.');
    if (!state.modulo) return alert('Selecciona un módulo formativo.');
    if (!state.ra) return alert('Selecciona un Resultado de Aprendizaje (RA).');
    goToStep(2);
  });

  // --- Paso 2 ---
  document.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.tipo = btn.dataset.tipo;
    });
  });

  document.getElementById('btnPaso2Back').addEventListener('click', () => goToStep(1));

  document.getElementById('btnPaso2Next').addEventListener('click', () => {
    state.tiempo = parseInt(document.getElementById('numTiempo').value, 10) || 50;
    state.fecha = document.getElementById('dateFecha').value;
    state.valor = document.getElementById('txtValor').value.trim();
    state.enunciado = document.getElementById('txtEnunciado').value.trim();

    if (!state.fecha) return alert('Selecciona la fecha de realización.');
    if (state.enunciado.length < 5) return alert('Escribe el enunciado/título de la actividad.');

    goToStep(3);
    generarConIA();
  });

  // --- Paso 3 ---
  document.getElementById('btnReintentar').addEventListener('click', generarConIA);

  // --- Paso 4 ---
  document.getElementById('selInstrumento').addEventListener('change', (e) => {
    document.getElementById('fieldInstrumentoOtro').classList.toggle('is-hidden', e.target.value !== 'otro');
  });

  document.getElementById('btnPaso4Back').addEventListener('click', () => goToStep(2));
  document.getElementById('btnPaso4Next').addEventListener('click', () => goToStep(5));

  // --- Paso 5 ---
  document.getElementById('btnGuardar').addEventListener('click', guardarPlanificacion);
  document.getElementById('btnNueva').addEventListener('click', () => location.reload());

  // --- Historial ---
  document.getElementById('btnHistorial').addEventListener('click', abrirHistorial);
  document.getElementById('btnCerrarHistorial').addEventListener('click', () => {
    document.getElementById('modalHistorial').classList.add('is-hidden');
  });
}

// ---------- Paso 3: generación IA ----------
async function generarConIA() {
  document.getElementById('loadingBlock').classList.remove('is-hidden');
  document.getElementById('errorBlock').classList.add('is-hidden');

  try {
    const data = await Api.generarIA({
      modulo_id: state.modulo.id,
      ra_id: state.ra.id,
      tipo: state.tipo,
      tiempo_estimado_min: state.tiempo,
      enunciado_actividad: state.enunciado,
    });

    state.generado = data;
    rellenarPaso4(data.generado);
    goToStep(4);
  } catch (e) {
    document.getElementById('loadingBlock').classList.add('is-hidden');
    document.getElementById('errorBlock').classList.remove('is-hidden');
    document.getElementById('errorMsg').textContent = 'No se pudo generar la planificación: ' + e.message;
  }
}

function rellenarPaso4(g) {
  document.getElementById('edEstrategia').value = g.estrategia || '';
  document.getElementById('edIntencion').value = g.intencion_educativa || '';
  document.getElementById('edInicio').value = g.momento_inicio || '';
  document.getElementById('edDesarrollo').value = g.momento_desarrollo || '';
  document.getElementById('edCierre').value = g.momento_cierre || '';
  document.getElementById('edDiversidad').value = g.atencion_diversidad || '';
  document.getElementById('edRecursos').value = g.recursos || '';
  document.getElementById('edConceptuales').value = g.contenidos_conceptuales || '';
  document.getElementById('edProcedimentales').value = g.contenidos_procedimentales || '';
  document.getElementById('edActitudinales').value = g.contenidos_actitudinales || '';
}

// ---------- Paso 5: guardar ----------
async function guardarPlanificacion() {
  const btn = document.getElementById('btnGuardar');
  btn.disabled = true;
  btn.textContent = 'Guardando…';

  const selInstrumento = document.getElementById('selInstrumento');
  const esOtro = selInstrumento.value === 'otro';

  const payload = {
    docente_id: state.docente.id,
    institucion_id: state.docente.institucion_id,
    modulo_id: state.modulo.id,
    ra_id: state.ra.id,
    tipo: state.tipo,
    tiempo_estimado_min: state.tiempo,
    fecha_realizacion: state.fecha,
    valor: state.valor,
    enunciado_actividad: state.enunciado,
    instrumento_evaluacion_id: esOtro ? null : (selInstrumento.value || null),
    instrumento_evaluacion_otro: esOtro ? document.getElementById('txtInstrumentoOtro').value.trim() : null,
    estrategia: document.getElementById('edEstrategia').value,
    intencion_educativa: document.getElementById('edIntencion').value,
    momento_inicio: document.getElementById('edInicio').value,
    momento_desarrollo: document.getElementById('edDesarrollo').value,
    momento_cierre: document.getElementById('edCierre').value,
    atencion_diversidad: document.getElementById('edDiversidad').value,
    recursos: document.getElementById('edRecursos').value,
    contenidos_conceptuales: document.getElementById('edConceptuales').value,
    contenidos_procedimentales: document.getElementById('edProcedimentales').value,
    contenidos_actitudinales: document.getElementById('edActitudinales').value,
    ia_generado: 1,
    ia_respuesta_cruda: state.generado ? state.generado.generado : null,
    ia_modelo: state.generado ? state.generado.modelo : null,
    estado: 'finalizada',
  };

  try {
    const res = await Api.guardarPlanificacion(payload);
    state.planificacionId = res.id;

    document.getElementById('saveBlock').classList.add('is-hidden');
    document.getElementById('exportBlock').classList.remove('is-hidden');
    document.getElementById('linkDocx').href = Api.urlDocx(res.id);
    document.getElementById('linkPdf').href = Api.urlPdf(res.id);
    document.getElementById('linkVer').href = Api.urlVer(res.id);
  } catch (e) {
    alert('No se pudo guardar: ' + e.message);
    btn.disabled = false;
    btn.textContent = 'Guardar planificación';
  }
}

// ---------- Historial ----------
async function abrirHistorial() {
  const modal = document.getElementById('modalHistorial');
  const body = document.getElementById('historialBody');
  modal.classList.remove('is-hidden');
  body.innerHTML = '<p class="hint">Cargando…</p>';

  try {
    const docenteId = state.docente ? state.docente.id : '';
    const lista = await Api.listarPlanificaciones(docenteId);
    if (lista.length === 0) {
      body.innerHTML = '<p class="hint">Aún no hay planificaciones guardadas.</p>';
      return;
    }
    body.innerHTML = lista.map(p => `
      <div class="hist-item">
        <strong>${p.enunciado_actividad}</strong>
        <small>${p.modulo_nombre} · ${p.ra_codigo} · ${p.fecha_realizacion} · ${p.docente_nombre}</small>
        <div style="margin-top:6px;">
          <a class="btn btn-ghost" href="${Api.urlVer(p.id)}" target="_blank">Ver</a>
          <a class="btn btn-ghost" href="${Api.urlDocx(p.id)}" target="_blank">Word</a>
          <a class="btn btn-ghost" href="${Api.urlPdf(p.id)}" target="_blank">PDF</a>
        </div>
      </div>
    `).join('');
  } catch (e) {
    body.innerHTML = '<p class="hint">Error al cargar el historial: ' + e.message + '</p>';
  }
}

document.addEventListener('DOMContentLoaded', init);
