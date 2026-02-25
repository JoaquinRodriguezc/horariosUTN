'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

type HorarioItem = {
  year: string;
  dictado: string;
  materia: string;
  curso: string;
  plan: string;
  dia: string;
  horaInicio: string;
  horaFin: string;
};

type ScheduleItem = HorarioItem & { isStart: boolean };

type TooltipState = {
  visible: boolean;
  x: number;
  y: number;
  course: HorarioItem | null;
};

const ESPECIALIDADES = [
  { value: '5', label: 'Ingeniería en Sistemas de Información' },
  { value: '8', label: 'Ingeniería Electromecánica' },
  { value: '9', label: 'Ingeniería Electrónica' },
  { value: '27', label: 'Ingeniería Química' },
  { value: '31', label: 'Ingeniería Civil' },
  { value: '612', label: 'Ingeniería en Telecomunicaciones' },
];

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const TIME_SLOTS = [
  { start: '08:00', end: '09:30' },
  { start: '09:30', end: '11:00' },
  { start: '11:00', end: '12:30' },
  { start: '12:30', end: '14:00' },
  { start: '14:00', end: '15:30' },
  { start: '15:30', end: '17:00' },
  { start: '17:00', end: '18:30' },
  { start: '18:30', end: '20:00' },
  { start: '20:00', end: '21:30' },
  { start: '21:30', end: '23:00' },
  { start: '23:00', end: '23:59' },
];

const DICTADO_LABELS: Record<string, string> = {
  '1': '1° Cuatrimestre',
  '2': '2° Cuatrimestre',
  'A': 'Anual',
};

function normalizeDia(dia: string): string {
  const map: Record<string, string> = {
    lunes: 'Lunes',
    martes: 'Martes',
    'miércoles': 'Miércoles',
    miercoles: 'Miércoles',
    jueves: 'Jueves',
    viernes: 'Viernes',
    'sábado': 'Sábado',
    sabado: 'Sábado',
  };
  return map[dia.toLowerCase().trim()] ?? dia;
}

function parseHorarios(html: string): HorarioItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = doc.querySelectorAll('table#horario tr');
  const data: HorarioItem[] = [];
  let currentYear = '';
  let currentDictado = '';
  let currentMateria = '';
  let currentCurso = '';

  rows.forEach((row, index) => {
    if (index === 0) return;
    const cells = row.querySelectorAll('td');
    if (cells.length < 8) return;

    const yearText = cells[0].textContent?.trim() ?? '';
    const dictadoText = cells[1].textContent?.trim() ?? '';
    const materiaText = cells[2].textContent?.trim() ?? '';
    const cursoText = cells[3].textContent?.trim() ?? '';
    const planText = cells[4].textContent?.trim() ?? '';
    const diaText = cells[5].textContent?.trim() ?? '';
    const horaInicioText = cells[6].textContent?.trim() ?? '';
    const horaFinText = cells[7].textContent?.trim() ?? '';

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

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getTimeSlotIndex(time: string): number {
  const minutes = timeToMinutes(time);
  for (let i = 0; i < TIME_SLOTS.length; i++) {
    if (minutes >= timeToMinutes(TIME_SLOTS[i].start) && minutes < timeToMinutes(TIME_SLOTS[i].end)) {
      return i;
    }
  }
  return -1;
}

function shortenMateria(materia: string): string {
  if (materia.length > 35) {
    const words = materia.split(' ');
    if (words.length > 3) return words.slice(0, 3).join(' ') + '...';
  }
  return materia;
}

function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function buildSchedule(data: HorarioItem[]): Record<string, Record<number, ScheduleItem[]>> {
  const grid: Record<string, Record<number, ScheduleItem[]>> = {};
  DAYS.forEach(day => {
    grid[day] = {};
    TIME_SLOTS.forEach((_, i) => { grid[day][i] = []; });
  });

  data.forEach(item => {
    if (!grid[item.dia]) return;
    const startSlot = getTimeSlotIndex(item.horaInicio);
    const endSlot = getTimeSlotIndex(item.horaFin);
    if (startSlot === -1) return;

    for (let i = startSlot; i <= endSlot && i < TIME_SLOTS.length; i++) {
      const exists = grid[item.dia][i].some(
        c => c.materia === item.materia && c.curso === item.curso
      );
      if (!exists) {
        grid[item.dia][i].push({ ...item, isStart: i === startSlot });
      }
    }
  });

  return grid;
}

export default function HorariosApp() {
  const [especialidad, setEspecialidad] = useState('');
  const [allData, setAllData] = useState<HorarioItem[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [filterYear, setFilterYear] = useState('');
  const [filterComision, setFilterComision] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, course: null });
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(filterSearch), 300);
    return () => clearTimeout(t);
  }, [filterSearch]);

  const filteredData = allData.filter(item => {
    if (filterYear && item.year !== filterYear) return false;
    if (filterComision && item.curso !== filterComision) return false;
    if (debouncedSearch && !normalizeText(item.materia).includes(normalizeText(debouncedSearch))) return false;
    return true;
  });

  const schedule = buildSchedule(filteredData);
  const years = [...new Set(allData.map(d => d.year))].sort();
  const comisiones = [...new Set(allData.map(d => d.curso))].sort();
  const selectedLabel = ESPECIALIDADES.find(e => e.value === especialidad)?.label ?? '';

  const fetchHorarios = useCallback(async (id: string) => {
    setStatus('loading');
    try {
      const res = await fetch(`/api/horarios?especialidad=${id}`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const data = parseHorarios(html);
      if (data.length === 0) { setStatus('error'); return; }
      setAllData(data);
      setFilterYear('');
      setFilterComision('');
      setFilterSearch('');
      setDebouncedSearch('');
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }, []);

  const handleEspecialidadChange = (value: string) => {
    setEspecialidad(value);
    setAllData([]);
    if (value) fetchHorarios(value);
    else setStatus('idle');
  };

  const exportAs = async (format: 'jpeg' | 'pdf') => {
    if (!resultsRef.current) return;
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(resultsRef.current, {
      scale: 2,
      useCORS: true,
      scrollX: 0,
      scrollY: -window.scrollY,
      backgroundColor: '#ffffff',
    });
    const filename = selectedLabel.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() || 'horarios';
    if (format === 'jpeg') {
      const link = document.createElement('a');
      link.download = `${filename}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } else {
      const { jsPDF } = await import('jspdf');
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
  };

  return (
    <div className="container">
      <header>
        <h1>Horarios de Cursos</h1>
        <p className="subtitle">Facultad Regional Mendoza - UTN - 2026</p>
      </header>

      <main>
        <div className="controls">
          <div className="select-wrapper">
            <label htmlFor="especialidad">Carrera</label>
            <select
              id="especialidad"
              value={especialidad}
              onChange={e => handleEspecialidadChange(e.target.value)}
            >
              <option value="">Elegí una especialidad...</option>
              {ESPECIALIDADES.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>

          {status === 'success' && (
            <div className="filters">
              <div className="filter-group">
                <label htmlFor="filterYear">Año</label>
                <select id="filterYear" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
                  <option value="">Todos</option>
                  {years.map(y => <option key={y} value={y}>{y}° Año</option>)}
                </select>
              </div>
              <div className="filter-group">
                <label htmlFor="filterComision">Comisión</label>
                <select id="filterComision" value={filterComision} onChange={e => setFilterComision(e.target.value)}>
                  <option value="">Todas</option>
                  {comisiones.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="filter-group">
                <label htmlFor="filterSearch">Buscar</label>
                <input
                  type="text"
                  id="filterSearch"
                  placeholder="Materia..."
                  value={filterSearch}
                  onChange={e => setFilterSearch(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {status === 'loading' && (
          <div className="loading">
            <div className="spinner" />
            <p>Cargando horarios...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="error-message">
            <p>Error al cargar los horarios. Por favor, intentá de nuevo.</p>
            <button onClick={() => especialidad && fetchHorarios(especialidad)}>Reintentar</button>
          </div>
        )}

        {status === 'success' && filteredData.length === 0 && (
          <div className="no-results">
            <p>No se encontraron materias con los filtros seleccionados.</p>
          </div>
        )}

        {status === 'success' && filteredData.length > 0 && (
          <div className="results" ref={resultsRef}>
            <div className="results-header">
              <h2>{selectedLabel}</h2>
              <div className="export-actions">
                <button className="export-btn" onClick={() => exportAs('jpeg')}>↓ JPEG</button>
                <button className="export-btn" onClick={() => exportAs('pdf')}>↓ PDF</button>
              </div>
              <div className="legend">
                {[1, 2, 3, 4, 5].map(n => (
                  <span key={n} className="legend-item">
                    <span className={`dot year-${n}`} />
                    {n}° Año
                  </span>
                ))}
              </div>
            </div>

            <div className="timetable-container">
              <div className="timetable">
                <div className="timetable-header corner">Hora</div>
                {DAYS.map(day => (
                  <div key={day} className="timetable-header">{day}</div>
                ))}

                {TIME_SLOTS.map((slot, slotIndex) => (
                  <React.Fragment key={slotIndex}>
                    <div className="time-slot">
                      {slot.start}<br />{slot.end}
                    </div>
                    {DAYS.map(day => (
                      <div key={day} className="timetable-cell">
                        {schedule[day][slotIndex]
                          .filter(c => c.isStart)
                          .map((course, i) => (
                            <div
                              key={i}
                              className={`course-block year-${course.year}`}
                              onMouseEnter={e => setTooltip({ visible: true, x: e.clientX + 15, y: e.clientY + 15, course })}
                              onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
                              onMouseMove={e => {
                                const x = Math.min(e.clientX + 15, window.innerWidth - 300);
                                const y = Math.min(e.clientY + 15, window.innerHeight - 130);
                                setTooltip(t => ({ ...t, x, y }));
                              }}
                            >
                              <div className="course-name">{shortenMateria(course.materia)}</div>
                              <div className="course-info">
                                <span className="course-code">{course.curso}</span>
                                <span className="course-time">{course.horaInicio}-{course.horaFin}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer>
        <p className="disclaimer">
          Los horarios pueden sufrir modificaciones. Consultá siempre la información oficial.
        </p>
      </footer>

      {tooltip.visible && tooltip.course && (
        <div className="tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <div className="tooltip-title">{tooltip.course.materia}</div>
          <div className="tooltip-detail">
            <strong>Curso:</strong> {tooltip.course.curso}<br />
            <strong>Año:</strong> {tooltip.course.year}° | <strong>Dictado:</strong> {DICTADO_LABELS[tooltip.course.dictado] ?? tooltip.course.dictado}<br />
            <strong>Horario:</strong> {tooltip.course.horaInicio} - {tooltip.course.horaFin}<br />
            <strong>Plan:</strong> {tooltip.course.plan}
          </div>
        </div>
      )}
    </div>
  );
}
