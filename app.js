// Estado de la aplicación
let allData = [];
let filteredData = [];

// Elementos del DOM
const especialidadSelect = document.getElementById('especialidad');
const filtersDiv = document.getElementById('filters');
const filterYear = document.getElementById('filterYear');
const filterComision = document.getElementById('filterComision');
const filterSearch = document.getElementById('filterSearch');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error');
const resultsDiv = document.getElementById('results');
const noResultsDiv = document.getElementById('noResults');
const carreraTitle = document.getElementById('carreraTitle');
const timetable = document.getElementById('timetable');

// API local (proxy al backend de la UTN)
const API_URL = '/api/horarios';

// Días de la semana
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Franjas horarias (de 8:00 a 23:30, cada 1.5 horas aprox)
const TIME_SLOTS = [
  { start: '08:00', end: '09:30', label: '08:00\n09:30' },
  { start: '09:30', end: '11:00', label: '09:30\n11:00' },
  { start: '11:00', end: '12:30', label: '11:00\n12:30' },
  { start: '12:30', end: '14:00', label: '12:30\n14:00' },
  { start: '14:00', end: '15:30', label: '14:00\n15:30' },
  { start: '15:30', end: '17:00', label: '15:30\n17:00' },
  { start: '17:00', end: '18:30', label: '17:00\n18:30' },
  { start: '18:30', end: '20:00', label: '18:30\n20:00' },
  { start: '20:00', end: '21:30', label: '20:00\n21:30' },
  { start: '21:30', end: '23:00', label: '21:30\n23:00' },
  { start: '23:00', end: '23:59', label: '23:00\n23:59' },
];

// Event listeners
especialidadSelect.addEventListener('change', handleEspecialidadChange);
filterYear.addEventListener('change', applyFilters);
filterComision.addEventListener('change', applyFilters);
filterSearch.addEventListener('input', debounce(applyFilters, 300));

async function handleEspecialidadChange() {
  const especialidadId = especialidadSelect.value;

  if (!especialidadId) {
    hideAll();
    return;
  }

  showLoading();

  try {
    const html = await fetchHorarios(especialidadId);
    allData = parseHorarios(html);

    if (allData.length === 0) {
      showError();
      return;
    }

    populateFilters();
    applyFilters();
    showResults();
  } catch (error) {
    console.error('Error fetching horarios:', error);
    showError();
  }
}

async function fetchHorarios(especialidadId) {
  const response = await fetch(`${API_URL}?especialidad=${especialidadId}`, {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  return response.text();
}

function parseHorarios(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = doc.querySelectorAll('table#horario tr');

  const data = [];
  let currentMateria = null;
  let currentCurso = null;
  let currentYear = null;
  let currentDictado = null;

  rows.forEach((row, index) => {
    if (index === 0) return;

    const cells = row.querySelectorAll('td');
    if (cells.length < 8) return;

    const yearText = cells[0].textContent.trim();
    const dictadoText = cells[1].textContent.trim();
    const materiaText = cells[2].textContent.trim();
    const cursoText = cells[3].textContent.trim();
    const planText = cells[4].textContent.trim();
    const diaText = cells[5].textContent.trim();
    const horaInicioText = cells[6].textContent.trim();
    const horaFinText = cells[7].textContent.trim();

    if (yearText) {
      currentYear = yearText;
      currentDictado = dictadoText;
      currentMateria = materiaText;
      currentCurso = cursoText;
    }

    data.push({
      year: currentYear,
      dictado: currentDictado,
      materia: currentMateria,
      curso: currentCurso,
      plan: planText,
      dia: normalizeDia(diaText),
      horaInicio: horaInicioText,
      horaFin: horaFinText,
    });
  });

  return data;
}

function normalizeDia(dia) {
  const diaLower = dia.toLowerCase().trim();
  const mapping = {
    'lunes': 'Lunes',
    'martes': 'Martes',
    'miércoles': 'Miércoles',
    'miercoles': 'Miércoles',
    'jueves': 'Jueves',
    'viernes': 'Viernes',
    'sábado': 'Sábado',
    'sabado': 'Sábado',
  };
  return mapping[diaLower] || dia;
}

function populateFilters() {
  const years = [...new Set(allData.map(d => d.year))].sort();
  filterYear.innerHTML = '<option value="">Todos</option>';
  years.forEach(year => {
    filterYear.innerHTML += `<option value="${year}">${year}° Año</option>`;
  });

  const comisiones = [...new Set(allData.map(d => d.curso))].sort();
  filterComision.innerHTML = '<option value="">Todas</option>';
  comisiones.forEach(c => {
    filterComision.innerHTML += `<option value="${c}">${c}</option>`;
  });
}

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function applyFilters() {
  const yearFilter = filterYear.value;
  const comisionFilter = filterComision.value;
  const searchFilter = normalize(filterSearch.value.trim());

  filteredData = allData.filter(item => {
    if (yearFilter && item.year !== yearFilter) return false;
    if (comisionFilter && item.curso !== comisionFilter) return false;
    if (searchFilter && !normalize(item.materia).includes(searchFilter)) return false;
    return true;
  });

  renderTimetable();
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function getTimeSlotIndex(time) {
  const minutes = timeToMinutes(time);
  for (let i = 0; i < TIME_SLOTS.length; i++) {
    const slotStart = timeToMinutes(TIME_SLOTS[i].start);
    const slotEnd = timeToMinutes(TIME_SLOTS[i].end);
    if (minutes >= slotStart && minutes < slotEnd) {
      return i;
    }
  }
  return -1;
}

function renderTimetable() {
  timetable.innerHTML = '';

  if (filteredData.length === 0) {
    resultsDiv.classList.add('hidden');
    noResultsDiv.classList.remove('hidden');
    return;
  }

  noResultsDiv.classList.add('hidden');
  resultsDiv.classList.remove('hidden');

  // Header row
  const cornerHeader = document.createElement('div');
  cornerHeader.className = 'timetable-header corner';
  cornerHeader.textContent = 'Hora';
  timetable.appendChild(cornerHeader);

  DAYS.forEach(day => {
    const header = document.createElement('div');
    header.className = 'timetable-header';
    header.textContent = day;
    timetable.appendChild(header);
  });

  // Organizar datos por día y slot de tiempo
  const schedule = {};
  DAYS.forEach(day => {
    schedule[day] = {};
    TIME_SLOTS.forEach((_, index) => {
      schedule[day][index] = [];
    });
  });

  // Agrupar cursos por materia+curso para identificar clases únicas
  filteredData.forEach(item => {
    const daySchedule = schedule[item.dia];
    if (!daySchedule) return;

    const startSlot = getTimeSlotIndex(item.horaInicio);
    const endSlot = getTimeSlotIndex(item.horaFin);

    if (startSlot === -1) return;

    // Agregar a todos los slots que ocupa
    for (let i = startSlot; i <= endSlot && i < TIME_SLOTS.length; i++) {
      const existing = daySchedule[i].find(
        c => c.materia === item.materia && c.curso === item.curso
      );
      if (!existing) {
        daySchedule[i].push({
          ...item,
          isStart: i === startSlot,
        });
      }
    }
  });

  // Renderizar filas de tiempo
  TIME_SLOTS.forEach((slot, slotIndex) => {
    // Time label
    const timeCell = document.createElement('div');
    timeCell.className = 'time-slot';
    timeCell.innerHTML = slot.label.replace('\n', '<br>');
    timetable.appendChild(timeCell);

    // Day cells
    DAYS.forEach(day => {
      const cell = document.createElement('div');
      cell.className = 'timetable-cell';

      const courses = schedule[day][slotIndex].filter(c => c.isStart);
      courses.forEach(course => {
        const block = createCourseBlock(course);
        cell.appendChild(block);
      });

      timetable.appendChild(cell);
    });
  });

  // Update title
  const selectedOption = especialidadSelect.options[especialidadSelect.selectedIndex];
  carreraTitle.textContent = selectedOption.text;
}

function createCourseBlock(course) {
  const block = document.createElement('div');
  block.className = `course-block year-${course.year}`;

  const shortName = shortenMateria(course.materia);

  block.innerHTML = `
    <div class="course-name">${shortName}</div>
    <div class="course-info">
      <span class="course-code">${course.curso}</span>
      <span class="course-time">${course.horaInicio}-${course.horaFin}</span>
    </div>
  `;

  // Tooltip
  block.addEventListener('mouseenter', (e) => showTooltip(e, course));
  block.addEventListener('mouseleave', hideTooltip);
  block.addEventListener('mousemove', moveTooltip);

  return block;
}

function shortenMateria(materia) {
  // Acortar nombres muy largos
  if (materia.length > 35) {
    const words = materia.split(' ');
    if (words.length > 3) {
      return words.slice(0, 3).join(' ') + '...';
    }
  }
  return materia;
}

// Tooltip
let tooltipEl = null;

function showTooltip(e, course) {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'tooltip';
    document.body.appendChild(tooltipEl);
  }

  const dictadoText = {
    '1': '1° Cuatrimestre',
    '2': '2° Cuatrimestre',
    'A': 'Anual',
  }[course.dictado] || course.dictado;

  tooltipEl.innerHTML = `
    <div class="tooltip-title">${course.materia}</div>
    <div class="tooltip-detail">
      <strong>Curso:</strong> ${course.curso}<br>
      <strong>Año:</strong> ${course.year}° | <strong>Dictado:</strong> ${dictadoText}<br>
      <strong>Horario:</strong> ${course.horaInicio} - ${course.horaFin}<br>
      <strong>Plan:</strong> ${course.plan}
    </div>
  `;

  tooltipEl.style.display = 'block';
  moveTooltip(e);
}

function moveTooltip(e) {
  if (!tooltipEl) return;

  const x = e.clientX + 15;
  const y = e.clientY + 15;

  // Keep tooltip in viewport
  const rect = tooltipEl.getBoundingClientRect();
  const maxX = window.innerWidth - rect.width - 20;
  const maxY = window.innerHeight - rect.height - 20;

  tooltipEl.style.left = Math.min(x, maxX) + 'px';
  tooltipEl.style.top = Math.min(y, maxY) + 'px';
}

function hideTooltip() {
  if (tooltipEl) {
    tooltipEl.style.display = 'none';
  }
}

// UI helpers
function hideAll() {
  loadingDiv.classList.add('hidden');
  errorDiv.classList.add('hidden');
  resultsDiv.classList.add('hidden');
  filtersDiv.classList.add('hidden');
  noResultsDiv.classList.add('hidden');
}

function showLoading() {
  hideAll();
  loadingDiv.classList.remove('hidden');
}

function showError() {
  hideAll();
  errorDiv.classList.remove('hidden');
}

function showResults() {
  hideAll();
  filtersDiv.classList.remove('hidden');
  resultsDiv.classList.remove('hidden');
}

function retryLoad() {
  handleEspecialidadChange();
}

// Utility: debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

window.retryLoad = retryLoad;

async function exportAs(format) {
  const el = document.getElementById('results');
  const container = document.querySelector('.timetable-container');
  const btns = document.querySelectorAll('.export-btn');

  btns.forEach(b => b.disabled = true);

  // Expandir el contenedor para capturar todo el timetable sin scroll
  const prevOverflow = container.style.overflow;
  container.style.overflow = 'visible';

  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      scrollX: 0,
      scrollY: -window.scrollY,
      backgroundColor: '#ffffff',
    });

    const carrera = document.getElementById('carreraTitle').textContent || 'horarios';
    const filename = carrera.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

    if (format === 'jpeg') {
      const link = document.createElement('a');
      link.download = `${filename}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } else {
      const { jsPDF } = window.jspdf;
      const imgW = canvas.width / 2;
      const imgH = canvas.height / 2;
      const pdf = new jsPDF({
        orientation: imgW > imgH ? 'landscape' : 'portrait',
        unit: 'px',
        format: [imgW, imgH],
      });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, imgW, imgH);
      pdf.save(`${filename}.pdf`);
    }
  } finally {
    container.style.overflow = prevOverflow;
    btns.forEach(b => b.disabled = false);
  }
}

window.exportAs = exportAs;
