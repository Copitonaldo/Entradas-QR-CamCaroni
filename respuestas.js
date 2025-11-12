// Importar Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Configuración de Supabase - ACTUALIZADA
const SUPABASE_URL = 'https://zopnkmqythglllxjkgfh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcG5rbXF5dGhnbGxseGprZ2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzcxMjIsImV4cCI6MjA3ODQ1MzEyMn0.zFUNCu5tobvtrHK9rQIsd0GL8thEd4vFuR0YIinVX60';

// Inicializar Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables DOM
const urlParams = new URLSearchParams(window.location.search);
const formId = urlParams.get('id'); // Este es el 'codigo_form' en Supabase
const formTitleElement = document.getElementById('formTitle');
const dashboardCount = document.getElementById('dashboardCount');
const respuestasTable = document.getElementById('respuestasTable');
const respuestasTableBody = document.querySelector('#respuestasTable tbody');
const searchInput = document.getElementById('searchInput');
const paginationDiv = document.getElementById('pagination');
const excelBtn = document.getElementById('excelBtn');
const printBtn = document.getElementById('printBtn');
const noDataMsg = document.getElementById('noDataMsg');

let todasLasRespuestas = [];
let filteredRespuestas = [];
let currentPage = 1;
const PAGE_SIZE = 50;
let currentFormDbId = null;

// --- INICIO: Validación de formId y carga de datos ---
if (!formId || formId.trim() === "") {
  if (formTitleElement) {
    formTitleElement.textContent = 'ID de Formulario no especificado';
  }
  if (noDataMsg) {
    noDataMsg.textContent = 'Error: No se ha proporcionado un ID de formulario en la URL (parámetro `?id=`). No se pueden cargar respuestas.';
    noDataMsg.style.display = 'block';
  }
  if (searchInput) searchInput.style.display = 'none';
  if (respuestasTable) respuestasTable.style.display = 'none';
  if (paginationDiv) paginationDiv.style.display = 'none';
  if (printBtn) printBtn.style.display = 'none';
  if (excelBtn) excelBtn.style.display = 'none';
  if (dashboardCount) dashboardCount.parentElement.style.display = 'none';
  console.error("formId (codigo_form) es nulo, está vacío o solo contiene espacios. No se cargarán respuestas.");
} else {
  if (formTitleElement) {
    formTitleElement.textContent = `Respuestas del Formulario: ${formId}`;
  }
  if (noDataMsg) {
    noDataMsg.textContent = 'Cargando respuestas...';
    noDataMsg.style.display = 'block';
  }
  await cargarRespuestas(); // Llama a la función principal de carga
}

// --- FIN: Validación de formId y carga de datos ---

async function cargarRespuestas() {
  const {  formInfo, error: formInfoError } = await supabase
    .from('formularios')
    .select('id, nombre')
    .eq('codigo_form', formId)
    .single();

  if (formInfoError || !formInfo) {
    console.error("Error cargando información del formulario desde Supabase:", formInfoError);
    if (formTitleElement) formTitleElement.textContent = `Error al encontrar formulario ${formId}`;
    if (noDataMsg) {
        noDataMsg.textContent = `Error: No se pudo encontrar el formulario con código ${formId}.`;
        noDataMsg.style.display = 'block';
    }
    if (respuestasTable) respuestasTable.style.display = 'none';
    if (searchInput) searchInput.style.display = 'none';
    if (printBtn) printBtn.style.display = 'none';
    if (excelBtn) excelBtn.style.display = 'none';
    if (paginationDiv) paginationDiv.innerHTML = '';
    return;
  }

  currentFormDbId = formInfo.id;
  if (formTitleElement) formTitleElement.textContent = `Respuestas del Formulario: ${formInfo.nombre || formId}`;

  const { data, error } = await supabase
    .from('respuestas')
    .select('id, codigo_secuencial, nombre_completo, cedula, edad, fecha_registro, referencia_usada, numero_telefono, correo_electronico') // Añadido número y correo
    .eq('formulario_id', currentFormDbId)
    .order('fecha_registro', { ascending: false });

  if (error) {
    console.error("Error cargando respuestas de Supabase:", error);
    if (noDataMsg) {
        noDataMsg.textContent = "Ocurrió un error al cargar las respuestas.";
        noDataMsg.style.display = 'block';
    }
    if (respuestasTable) respuestasTable.style.display = 'none';
    todasLasRespuestas = [];
  } else {
    todasLasRespuestas = data.map(r => ({
        id_db: r.id,
        codigo: r.codigo_secuencial,
        nombre: r.nombre_completo,
        cedula: r.cedula,
        edad: r.edad,
        referencia_usada: r.referencia_usada || null,
        numero_telefono: r.numero_telefono || null, // Añadido
        correo_electronico: r.correo_electronico || null // Añadido
    }));
  }

  if (todasLasRespuestas.length > 0) {
    if (noDataMsg) noDataMsg.style.display = 'none';
    if (respuestasTable) respuestasTable.style.display = '';
    if (searchInput) searchInput.style.display = '';
    if (printBtn) printBtn.style.display = 'inline-block';
    if (excelBtn) excelBtn.style.display = 'inline-block';
  } else {
    if (noDataMsg && !noDataMsg.textContent.startsWith("Error:")) {
        noDataMsg.textContent = 'No hay respuestas para este formulario.';
        noDataMsg.style.display = 'block';
    }
    if (respuestasTable) respuestasTable.style.display = 'none';
    if (searchInput) searchInput.style.display = 'none';
    if (printBtn) printBtn.style.display = 'none';
    if (excelBtn) excelBtn.style.display = 'none';
    if (paginationDiv) paginationDiv.innerHTML = '';
  }
  filteredRespuestas = [...todasLasRespuestas];
  currentPage = 1;
  renderTableAndPagination();
}

function formatCedula(cedula) {
  if (typeof cedula !== 'string') cedula = String(cedula || '');
  return cedula.replace(/\D/g, '').replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2.$3');
}

function escapeHtml(text) {
    if (text === null || typeof text === 'undefined') return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function renderTableAndPagination() {
  if (!respuestasTableBody) return;

  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const dataToShow = filteredRespuestas.slice(start, end);

  respuestasTableBody.innerHTML = '';

  if (dataToShow.length === 0 && (formId && formId.trim() !== "")) {
      if (noDataMsg && !noDataMsg.textContent.startsWith("Error:")) {
        noDataMsg.textContent = 'No hay resultados para la búsqueda o filtro actual.';
        noDataMsg.style.display = 'block';
      }
  } else if (dataToShow.length > 0) {
      if (noDataMsg) noDataMsg.style.display = 'none';
      if (respuestasTable) respuestasTable.style.display = '';
  }

  dataToShow.forEach((r, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.codigo)}</td>
      <td>${escapeHtml(r.nombre)}</td>
      <td>${escapeHtml(formatCedula(r.cedula))}</td>
      <td>${escapeHtml(r.edad)}</td>
      <td>${escapeHtml(r.numero_telefono || '-')}</td> <!-- Nueva columna -->
      <td>${escapeHtml(r.correo_electronico || '-')}</td> <!-- Nueva columna -->
      <td>${escapeHtml(r.referencia_usada || '-')}</td>
      <td>
        <button class="action-btn edit-btn" data-id="${r.id_db || index}" disabled>Editar</button>
        <button class="action-btn delete-btn" data-id="${r.id_db || index}" disabled>Borrar</button>
      </td>
    `;
    respuestasTableBody.appendChild(tr);
  });

  if (dashboardCount) dashboardCount.textContent = filteredRespuestas.length;

  if (paginationDiv) {
    paginationDiv.innerHTML = '';
    const totalPages = Math.ceil(filteredRespuestas.length / PAGE_SIZE);
    if (totalPages > 1) {
      for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === currentPage) btn.disabled = true;
        btn.onclick = () => {
          currentPage = i;
          renderTableAndPagination();
        };
        paginationDiv.appendChild(btn);
      }
    }
  }
}

if (searchInput) {
  searchInput.addEventListener('input', () => {
    const term = searchInput.value.toLowerCase();
    filteredRespuestas = todasLasRespuestas.filter(r =>
      (r.nombre && r.nombre.toLowerCase().includes(term)) ||
      (r.cedula && formatCedula(r.cedula).toLowerCase().includes(term)) ||
      (r.edad && r.edad.toString().includes(term)) ||
      (r.codigo && r.codigo.toLowerCase().includes(term)) ||
      (r.referencia_usada && r.referencia_usada.toLowerCase().includes(term)) ||
      (r.numero_telefono && r.numero_telefono.toLowerCase().includes(term)) || // Búsqueda por número
      (r.correo_electronico && r.correo_electronico.toLowerCase().includes(term)) // Búsqueda por correo
    );
    currentPage = 1;
    renderTableAndPagination();
  });
}

if (printBtn) {
  printBtn.onclick = function () {
    if (!formId || filteredRespuestas.length === 0) return;
    const dataToPrint = filteredRespuestas;

    let html = `<html><head><title>Imprimir Respuestas - ${formTitleElement.textContent.replace('Respuestas del Formulario: ','')}</title><style>
      body { font-family: Arial; margin: 20px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #333; padding: 8px; text-align: center; }
      th { background: #007bff; color: white; }
    </style></head><body><h2>${formTitleElement.textContent}</h2><table><thead><tr><th>Código</th><th>Nombre</th><th>Cédula</th><th>Edad</th><th>Número</th><th>Correo</th><th>Referencia</th></tr></thead><tbody>`;
    dataToPrint.forEach(r => {
      html += `<tr><td>${escapeHtml(r.codigo)}</td><td>${escapeHtml(r.nombre)}</td><td>${escapeHtml(formatCedula(r.cedula))}</td><td>${escapeHtml(r.edad)}</td><td>${escapeHtml(r.numero_telefono || '-')}</td><td>${escapeHtml(r.correo_electronico || '-')}</td><td>${escapeHtml(r.referencia_usada || '-')}</td></tr>`;
    });
    html += '</tbody></table></body></html>';

    const win = window.open('', '', 'width=900,height=700');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };
}

if (excelBtn) {
  excelBtn.onclick = function () {
    if (!formId || filteredRespuestas.length === 0) return;
    if (!window.XLSX) {
      console.error("La librería XLSX no está cargada.");
      alert("Error: La funcionalidad de exportar a Excel no está disponible.");
      return;
    }
    const dataToExport = filteredRespuestas.map(r => ({
      'Código': r.codigo,
      'Nombre': r.nombre,
      'Cédula': formatCedula(r.cedula),
      'Edad': r.edad,
      'Número': r.numero_telefono || '', // Añadir número a Excel
      'Correo': r.correo_electronico || '', // Añadir correo a Excel
      'Referencia': r.referencia_usada || '' // Añadir referencia a Excel
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Respuestas');
    XLSX.writeFile(wb, `Respuestas_${formId}.xlsx`);
  };
}

console.log("respuestas.js cargado con lógica de referencias, número y correo.");
