const Api = {
  async _get(path) {
    const res = await fetch(API_BASE + path);
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || 'Error de red');
    return json.data;
  },

  async _post(path, body) {
    const res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error(json.error || 'Error de red');
    return json.data;
  },

  docentes: () => Api._get('/api/docentes.php'),
  modulosPorDocente: (docenteId) => Api._get(`/api/modulos.php?docente_id=${docenteId}`),
  resultadosAprendizaje: (moduloId) => Api._get(`/api/resultados_aprendizaje.php?modulo_id=${moduloId}`),
  instrumentosEvaluacion: () => Api._get('/api/instrumentos_evaluacion.php'),

  generarIA: (payload) => Api._post('/api/generar_ia.php', payload),
  guardarPlanificacion: (payload) => Api._post('/api/guardar_planificacion.php', payload),
  listarPlanificaciones: (docenteId) => Api._get(`/api/listar_planificaciones.php?docente_id=${docenteId}`),

  urlDocx: (id) => `${API_BASE}/api/exportar_docx.php?id=${id}`,
  urlPdf: (id) => `${API_BASE}/api/exportar_pdf.php?id=${id}`,
  urlVer: (id) => `${API_BASE}/api/ver_planificacion.php?id=${id}`,
};
