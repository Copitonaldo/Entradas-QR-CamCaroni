// Importar Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Configuración de Supabase - ACTUALIZADA
const SUPABASE_URL = 'https://zopnkmqythglllxjkgfh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcG5rbXF5dGhnbGxseGprZ2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NzcxMjIsImV4cCI6MjA3ODQ1MzEyMn0.zFUNCu5tobvtrHK9rQIsd0GL8thEd4vFuR0YIinVX60';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const formPadreNombreElem = document.getElementById('formPadreNombre');
const formPadreCodigoElem = document.getElementById('formPadreCodigo');
const crearReferenciaForm = document.getElementById('crearReferenciaForm');
const codigoReferenciaInput = document.getElementById('codigoReferencia');
const usosReferenciaInput = document.getElementById('usosReferencia');
const referenciasTableBody = document.querySelector('#referenciasTable tbody');
const noReferenciasMsg = document.getElementById('noReferencias');
const errorMensajeElem = document.getElementById('errorMensaje');
const exitoMensajeElem = document.getElementById('exitoMensaje');

let currentFormPadreCodigo = null;
let currentFormPadreDbId = null; // El UUID del formulario padre

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  currentFormPadreCodigo = urlParams.get('id_formulario');

  if (!currentFormPadreCodigo) {
    mostrarError('Error: No se especificó un ID de formulario padre en la URL.');
    if (formPadreNombreElem) formPadreNombreElem.textContent = 'Error';
    if (formPadreCodigoElem) formPadreCodigoElem.textContent = 'N/A';
    crearReferenciaForm.style.display = 'none';
    document.getElementById('referenciasTable').style.display = 'none';
    return;
  }

  if (formPadreCodigoElem) formPadreCodigoElem.textContent = currentFormPadreCodigo;
  await cargarInformacionFormularioPadre();
  if (currentFormPadreDbId) {
    await cargarReferenciasExistentes();
  }
});

async function cargarInformacionFormularioPadre() {
  const {  formData, error } = await supabase
    .from('formularios')
    .select('id, nombre') // 'id' es el UUID que necesitamos
    .eq('codigo_form', currentFormPadreCodigo)
    .single();

  if (error || !formData) {
    console.error('Error cargando información del formulario padre:', error);
    mostrarError(`Error: No se pudo cargar información para el formulario con código ${currentFormPadreCodigo}.`);
    if (formPadreNombreElem) formPadreNombreElem.textContent = 'Desconocido';
    crearReferenciaForm.style.display = 'none';
    return;
  }

  currentFormPadreDbId = formData.id; // Guardamos el UUID
  if (formPadreNombreElem) formPadreNombreElem.textContent = formData.nombre || 'Sin nombre';
}

// --- Crear Referencia ---
crearReferenciaForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  ocultarMensajes();

  if (!currentFormPadreDbId) {
    mostrarError("Error: No se ha identificado el formulario padre. No se puede crear la referencia.");
    return;
  }

  const codigoReferencia = codigoReferenciaInput.value.trim();
  const usosReferencia = parseInt(usosReferenciaInput.value.trim());

  if (!/^\d{4}$/.test(codigoReferencia)) {
    mostrarError('El código de referencia debe ser un número de 4 dígitos.');
    return;
  }

  if (isNaN(usosReferencia) || usosReferencia < 1) {
    mostrarError('La cantidad de usos debe ser un número mayor o igual a 1.');
    return;
  }

  // Verificar si la referencia ya existe para este formulario
  const { data: existingRef, error: checkError } = await supabase
    .from('referencias_usos') // Nombre tentativo de la tabla
    .select('id')
    .eq('formulario_id', currentFormPadreDbId)
    .eq('codigo_referencia', codigoReferencia)
    .maybeSingle();

  if (checkError) {
    console.error("Error verificando referencia existente:", checkError);
    mostrarError(`Error al verificar la referencia: ${checkError.message}`);
    return;
  }

  if (existingRef) {
    mostrarError(`El código de referencia '${codigoReferencia}' ya existe para este formulario.`);
    return;
  }

  // Insertar nueva referencia
  const { error: insertError } = await supabase
    .from('referencias_usos') // Nombre tentativo de la tabla
    .insert([
      {
        formulario_id: currentFormPadreDbId, // UUID del formulario padre
        codigo_referencia: codigoReferencia,
        usos_disponibles: usosReferencia,
        usos_iniciales: usosReferencia // Podría ser útil para mostrar el total original
      }
    ]);

  if (insertError) {
    console.error("Error al crear referencia:", insertError);
    mostrarError(`No se pudo crear la referencia: ${insertError.message}`);
  } else {
    mostrarExito(`Referencia '${codigoReferencia}' creada con ${usosReferencia} usos.`);
    crearReferenciaForm.reset();
    await cargarReferenciasExistentes(); // Recargar la lista
  }
});

// --- Cargar Referencias Existentes ---
async function cargarReferenciasExistentes() {
  if (!currentFormPadreDbId) return;

  const { data, error } = await supabase
    .from('referencias_usos') // Nombre tentativo de la tabla
    .select('id, codigo_referencia, usos_disponibles, usos_iniciales')
    .eq('formulario_id', currentFormPadreDbId) // Filtrar por el UUID del formulario padre
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error cargando referencias existentes:", error);
    mostrarError(`Error al cargar las referencias: ${error.message}`);
    referenciasTableBody.innerHTML = '<tr><td colspan="3">Error al cargar datos.</td></tr>';
    noReferenciasMsg.style.display = 'none';
    return;
  }

  referenciasTableBody.innerHTML = ''; // Limpiar tabla

  if (data && data.length > 0) {
    noReferenciasMsg.style.display = 'none';
    data.forEach(ref => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${ref.codigo_referencia}</td>
        <td>${ref.usos_disponibles} (de ${ref.usos_iniciales || ref.usos_disponibles})</td>
        <td>
          <button onclick="borrarReferencia('${ref.id}', '${ref.codigo_referencia}')">Borrar</button>
        </td>
      `;
      referenciasTableBody.appendChild(tr);
    });
  } else {
    noReferenciasMsg.style.display = 'block';
  }
}

// --- Borrar Referencia ---
window.borrarReferencia = async function(idReferencia, codigoRef) {
  if (!confirm(`¿Seguro que quieres borrar la referencia "${codigoRef}"? Esta acción no se puede deshacer.`)) {
    return;
  }
  ocultarMensajes();

  const { error } = await supabase
    .from('referencias_usos') // Nombre tentativo de la tabla
    .delete()
    .eq('id', idReferencia);

  if (error) {
    console.error("Error al borrar referencia:", error);
    mostrarError(`No se pudo borrar la referencia: ${error.message}`);
  } else {
    mostrarExito(`Referencia "${codigoRef}" borrada correctamente.`);
    await cargarReferenciasExistentes(); // Recargar la lista
  }
}

// --- Funciones de utilidad para mensajes ---
function mostrarError(mensaje) {
  if (errorMensajeElem) {
    errorMensajeElem.textContent = mensaje;
    errorMensajeElem.style.display = 'block';
  }
}

function mostrarExito(mensaje) {
  if (exitoMensajeElem) {
    exitoMensajeElem.textContent = mensaje;
    exitoMensajeElem.style.display = 'block';
  }
}

function ocultarMensajes() {
  if (errorMensajeElem) errorMensajeElem.style.display = 'none';
  if (exitoMensajeElem) exitoMensajeElem.style.display = 'none';
}

/*
  PASO IMPORTANTE: CREACIÓN DE LA TABLA EN SUPABASE
  -------------------------------------------------
  Antes de que este código funcione completamente, necesitas crear la tabla 'referencias_usos' en tu base de datos Supabase.
  Puedes hacerlo desde el Editor SQL en el dashboard de Supabase:
  CREATE TABLE public.referencias_usos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    formulario_id UUID NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE, -- Enlace al UUID del formulario
    codigo_referencia TEXT NOT NULL CHECK (codigo_referencia ~ '^\\d{4}$'), -- Valida 4 dígitos
    usos_disponibles INTEGER NOT NULL CHECK (usos_disponibles >= 0),
    usos_iniciales INTEGER NOT NULL CHECK (usos_iniciales > 0), -- Opcional: para saber cuántos usos tenía originalmente
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    CONSTRAINT uq_formulario_codigo_referencia UNIQUE (formulario_id, codigo_referencia) -- Cada código de referencia debe ser único por formulario
  );

  -- Opcional: Trigger para actualizar 'updated_at' automáticamente
  CREATE OR REPLACE FUNCTION trigger_set_timestamp()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER set_referencias_usos_updated_at
  BEFORE UPDATE ON public.referencias_usos
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_timestamp();

  -- Habilitar Row Level Security (RLS) si no lo has hecho ya para esta tabla,
  -- y definir políticas para SELECT, INSERT, UPDATE, DELETE según sea necesario.
  -- Por ahora, para desarrollo rápido, puedes dejarlo desactivado o usar políticas permisivas,
  -- pero para producción es crucial configurarlo adecuadamente.
  -- Ejemplo de política permisiva (NO USAR EN PRODUCCIÓN SIN REVISAR):
  -- ALTER TABLE public.referencias_usos ENABLE ROW LEVEL SECURITY;
  -- CREATE POLICY "Allow all for anon" ON public.referencias_usos FOR ALL TO anon USING (true) WITH CHECK (true);
  -- CREATE POLICY "Allow all for authenticated" ON public.referencias_usos FOR ALL TO authenticated USING (true) WITH CHECK (true);

  Asegúrate de que la columna 'id' en tu tabla 'formularios' es la clave primaria y de tipo UUID,
  y que 'codigo_form' es el identificador que usas en la URL.
  El script JS asume que 'formularios.id' es el UUID que se usará como FK en 'referencias_usos.formulario_id'.
*/

console.log("referencia.js cargado con nueva base de datos.");
