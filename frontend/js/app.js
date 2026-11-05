const API_BASE = "/api";
const root = document.querySelector("#page-content");
const modalRoot = document.querySelector("#modal-root");
const feedback = document.querySelector("[data-feedback]");
const announcer = document.querySelector("[data-announcer]");

const state = {
  tasks: [],
  view: "dashboard",
  search: "",
  selectedDate: "",
  visibleMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  priorityFilter: "Todas",
  categoryFilter: "Todas",
  compact: false,
  accent: "#ff6b4a",
  modalTask: null,
  modalError: "",
  loading: true,
  apiError: "",
};

const views = {
  dashboard: { title: "Organiza tu día", subtitle: "TU ESPACIO DE TRABAJO" },
  all: { title: "Todas las tareas", subtitle: "TODO LO QUE TIENES EN MARCHA" },
  pending: { title: "Pendientes", subtitle: "LO SIGUIENTE EN TU LISTA" },
  progress: { title: "En progreso", subtitle: "UN PASO MÁS CERCA DE TERMINAR" },
  completed: { title: "Completadas", subtitle: "TODO LO QUE YA LOGRASTE" },
  settings: { title: "Configuración", subtitle: "AJUSTA TU ESPACIO DE TRABAJO" },
};

const viewStatuses = {
  pending: "Pendiente",
  progress: "En progreso",
  completed: "Completada",
};

const periods = [
  { name: "Mañana", start: 5, end: 12, note: "EL DÍA DESPEGA" },
  { name: "Tarde", start: 12, end: 18, note: "SIGUE EL RITMO" },
  { name: "Noche", start: 18, end: 24, note: "CIERRA CON CALMA" },
];

const weekdayLabels = ["L", "M", "X", "J", "V", "S", "D"];

const iconPaths = {
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  arrow: '<path d="M7 17 17 7M7 7h10v10"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  filter: '<path d="M4 7h16M7 12h10m-7 5h4"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  trash: '<path d="M3 6h18m-2 0-.9 14H5.9L5 6m4 0V4h6v2m-5 4v6m4-6v6"/>',
  plus: '<path d="M12 5v14m-7-7h14"/>',
};

function icon(name, size = 16) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${iconPaths[name] || ""}</svg>`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function taskId(task) {
  return task._id ?? task.id;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12);
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatDueDate(value) {
  const date = parseLocalDate(value);
  if (!date) return "Sin fecha límite";
  return new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function announce(message) {
  announcer.textContent = "";
  requestAnimationFrame(() => {
    announcer.textContent = message;
  });
}

function showFeedback(message, type = "info") {
  feedback.textContent = message;
  feedback.dataset.type = type;
  feedback.hidden = !message;
  if (message) announce(message);
}

function setApiStatus(message, connected = false) {
  const status = document.querySelector("[data-api-status]");
  status.textContent = message;
  status.dataset.connected = String(connected);
}

async function requestApi(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("No se pudo contactar con Express. Comprueba que el servidor esté activo.");
  }

  const contentType = response.headers.get("content-type") || "";
  let result = null;
  if (contentType.includes("application/json")) {
    try {
      result = await response.json();
    } catch {
      throw new Error("La respuesta de la API contiene JSON inválido.");
    }
  }

  if (!response.ok) {
    throw new Error(
      result?.message ||
        `La API respondió con el estado ${response.status}.`,
    );
  }

  if (!contentType.includes("application/json") && response.status !== 204) {
    throw new Error("La respuesta de la API no tiene el formato JSON esperado.");
  }

  return result;
}

async function loadTasks() {
  state.loading = true;
  render();

  try {
    const result = await requestApi("/tasks");
    const serverTasks = Array.isArray(result) ? result : result?.tasks;
    if (!Array.isArray(serverTasks)) {
      throw new Error("La API de tareas debe responder con una lista JSON.");
    }

    state.tasks = serverTasks;
    state.apiError = "";
    setApiStatus("API conectada", true);
    showFeedback("");
    return true;
  } catch (error) {
    state.tasks = [];
    state.apiError = error.message;
    setApiStatus("Tareas no disponibles", false);
    showFeedback(`No se pudieron cargar las tareas. ${error.message}`, "error");
    return false;
  } finally {
    state.loading = false;
    render();
  }
}

async function checkApiHealth() {
  try {
    await requestApi("/health");
    setApiStatus(
      state.apiError ? "Express conectado · tareas no disponibles" : "API conectada",
      !state.apiError,
    );
  } catch {
    setApiStatus("Servidor sin conexión", false);
  }
}

function getTaskCounts() {
  return {
    all: state.tasks.length,
    pending: state.tasks.filter((task) => task.status === "Pendiente").length,
    progress: state.tasks.filter((task) => task.status === "En progreso").length,
    completed: state.tasks.filter((task) => task.status === "Completada").length,
  };
}

function searchMatches(task) {
  const query = state.search.trim().toLocaleLowerCase("es");
  if (!query) return true;
  return `${task.title || ""} ${task.description || ""} ${task.category || ""}`
    .toLocaleLowerCase("es")
    .includes(query);
}

function getVisibleTasks({ includeFilters = false } = {}) {
  return state.tasks.filter((task) => {
    if (!searchMatches(task)) return false;
    const status = viewStatuses[state.view];
    if (status && task.status !== status) return false;
    if (
      includeFilters &&
      state.priorityFilter !== "Todas" &&
      task.priority !== state.priorityFilter
    ) {
      return false;
    }
    if (
      includeFilters &&
      state.categoryFilter !== "Todas" &&
      task.category !== state.categoryFilter
    ) {
      return false;
    }
    return true;
  });
}

function renderNavigation() {
  document.querySelectorAll(".primary-nav-link[data-view]").forEach((button) => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  const counts = getTaskCounts();
  document.querySelectorAll("[data-count]").forEach((counter) => {
    counter.textContent = String(counts[counter.dataset.count] ?? 0);
  });
}

function render() {
  renderNavigation();
  root.setAttribute("aria-busy", String(state.loading));
  root.classList.toggle("is-compact", state.compact);
  document.documentElement.style.setProperty("--accent", state.accent);

  if (state.loading) {
    root.innerHTML = '<p class="loading-message">Preparando tu agenda…</p>';
    return;
  }

  const page = views[state.view];
  if (!page) {
    state.view = "dashboard";
    root.innerHTML = renderDashboard();
    return;
  }

  if (state.view === "dashboard") {
    root.innerHTML = renderDashboard();
  } else if (state.view === "settings") {
    root.innerHTML = renderSettings(page);
  } else {
    root.innerHTML = renderTasksPage(page);
  }
}

function renderDashboard() {
  const today = new Date();
  const todayKey = localDateKey(today);
  const selectedDate = state.selectedDate || todayKey;
  const visibleTasks = state.tasks
    .filter(searchMatches)
    .filter(
      (task) =>
        !state.selectedDate ||
        String(task.dueDate || "").slice(0, 10) === state.selectedDate,
    );
  const counts = getTaskCounts();
  const completion = counts.all
    ? Math.round((counts.completed / counts.all) * 100)
    : 0;
  const monthLabel = new Intl.DateTimeFormat("es", {
    month: "long",
    year: "numeric",
  }).format(state.visibleMonth);

  const groups = periods
    .map((period) => ({
      ...period,
      tasks: visibleTasks.filter((task) => {
        if (!task.scheduledTime) return false;
        const hour = Number(task.scheduledTime.split(":")[0]);
        return hour >= period.start && hour < period.end;
      }).sort((first, second) =>
        String(first.scheduledTime).localeCompare(String(second.scheduledTime)),
      ),
    }))
    .filter((period) => period.tasks.length);

  const unscheduled = visibleTasks.filter((task) => {
    if (!task.scheduledTime) return true;
    const hour = Number(task.scheduledTime.split(":")[0]);
    return hour < 5 || hour >= 24;
  });
  if (unscheduled.length) {
    groups.push({ name: "A tu ritmo", note: "SIN HORARIO", tasks: unscheduled });
  }

  return `
    <div class="editorial-dashboard">
      <header class="day-heading">
        <div class="day-heading-copy">
          <div class="date-eyebrow">
            ${icon("sun", 14)}
            <span>${escapeHtml(formatLongDate(today))}</span>
            <span class="date-eyebrow-divider">/</span>
            <span>Tu espacio personal</span>
          </div>
          <h1>Organiza tu <span>día</span><span class="heading-period">.</span></h1>
          <p>Un plan con intención cambia la forma de vivir tus horas.</p>
        </div>
        <button class="editorial-new-task" type="button" data-action="new-task">
          ${icon("plus", 17)} Nueva tarea <span class="button-arrow">↗</span>
        </button>
        <span class="heading-index" aria-hidden="true">01 — 07</span>
      </header>

      <div class="agenda-layout">
        <section class="agenda-column" aria-label="Agenda del día">
          <div class="agenda-heading">
            <div>
              <span class="section-index">01 / TU AGENDA</span>
              <h2>${state.selectedDate ? escapeHtml(formatLongDate(parseLocalDate(selectedDate))) : "El plan de hoy"}</h2>
            </div>
            ${
              state.selectedDate
                ? `<button class="agenda-reset" type="button" data-action="reset-date">Ver agenda completa ${icon("chevronRight", 14)}</button>`
                : `<span class="agenda-total"><strong>${visibleTasks.length}</strong> tareas</span>`
            }
          </div>

          ${
            groups.length
              ? `<div class="agenda-groups">${groups
                  .map(
                    (group) => `
                      <section class="agenda-period">
                        <div class="period-label">
                          <span>${escapeHtml(group.name)}</span>
                          <span class="period-note">${escapeHtml(group.note)}</span>
                        </div>
                        <div class="agenda-rows">
                          ${group.tasks.map((task) => renderTaskRow(task, { scheduled: true, checkbox: true })).join("")}
                        </div>
                      </section>`,
                  )
                  .join("")}</div>`
              : renderEmptyAgenda()
          }

          <button class="agenda-add-row" type="button" data-action="new-task">
            <span class="add-row-plus">${icon("plus", 16)}</span>
            <span>Añadir una tarea al día</span>
            <span class="add-row-rule"></span>
          </button>
        </section>

        <aside class="day-aside">
          <section class="calendar-module" aria-label="Calendario mensual">
            <div class="aside-section-heading">
              <span class="section-index">02 / CALENDARIO</span>
              <div class="month-controls">
                <button type="button" aria-label="Mes anterior" data-action="previous-month">${icon("chevronLeft", 16)}</button>
                <button type="button" aria-label="Mes siguiente" data-action="next-month">${icon("chevronRight", 16)}</button>
              </div>
            </div>
            <h2 class="calendar-month">${escapeHtml(monthLabel)}</h2>
            <div class="mini-calendar">
              ${weekdayLabels.map((label, index) => `<span class="weekday-label" key="${label}-${index}">${label}</span>`).join("")}
              ${renderCalendarDays(todayKey)}
            </div>
            <div class="calendar-legend"><span class="legend-dot"></span> Entrega o fecha límite</div>
          </section>

          <section class="progress-module">
            <div class="aside-section-heading">
              <span class="section-index">03 / RITMO</span>
              <span class="progress-spark" aria-hidden="true">✳</span>
            </div>
            <div class="progress-big"><span>${completion}</span><small>%</small></div>
            <p class="progress-caption">de tu lista ya está resuelta.</p>
            <div class="progress-track" role="progressbar" aria-label="Progreso de tareas completadas" aria-valuenow="${completion}" aria-valuemin="0" aria-valuemax="100">
              <span style="width: ${completion}%"></span>
            </div>
            <div class="progress-foot">
              <span>${icon("check", 13)} ${counts.completed} terminadas</span>
              <button type="button" data-view="all">de ${counts.all} ${icon("arrow", 13)}</button>
            </div>
          </section>

          <div class="aside-quote">
            ${icon("arrow", 16)}
            <p>“La claridad es una forma de calma.”</p>
            <span>UNA COSA A LA VEZ</span>
          </div>
        </aside>
      </div>
      <div class="dashboard-footnote">
        <span>${icon("check", 12)} Horario flexible</span>
        <span>${icon("clock", 13)} Las fechas límite aparecen en cada tarea</span>
      </div>
    </div>`;
}

function renderEmptyAgenda() {
  const message = state.apiError
    ? "Cuando la API de tareas esté disponible, aquí aparecerá tu agenda. No hay datos de muestra."
    : "No hay tareas para este día. Puedes disfrutarlo o crear un nuevo plan.";
  return `
    <div class="agenda-empty">
      <span class="empty-sketch">${icon("calendar", 23)}</span>
      <strong>${state.apiError ? "Tu agenda espera a la API." : "Un espacio para respirar."}</strong>
      <p>${escapeHtml(message)}</p>
      ${
        state.apiError
          ? `<button type="button" data-action="retry">${icon("arrow", 15)} Reintentar conexión</button>`
          : `<button type="button" data-action="new-task">${icon("plus", 15)} Añadir una tarea</button>`
      }
    </div>`;
}

function renderCalendarDays(todayKey) {
  const month = state.visibleMonth;
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const firstCalendarDate = new Date(
    month.getFullYear(),
    month.getMonth(),
    1 - mondayOffset,
    12,
  );
  const dueDates = new Set(
    state.tasks.map((task) => String(task.dueDate || "").slice(0, 10)),
  );

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCalendarDate);
    date.setDate(firstCalendarDate.getDate() + index);
    const dateKey = localDateKey(date);
    const isCurrentMonth = date.getMonth() === month.getMonth();
    const selected = dateKey === state.selectedDate;
    const classes = [
      "calendar-day",
      !isCurrentMonth && "is-outside",
      dateKey === todayKey && "is-today",
      selected && "is-selected",
      dueDates.has(dateKey) && "has-task",
    ]
      .filter(Boolean)
      .join(" ");
    const dateLabel = new Intl.DateTimeFormat("es", { month: "long" }).format(date);
    return `<button class="${classes}" type="button" data-date="${dateKey}" aria-label="${date.getDate()} de ${escapeHtml(dateLabel)}" aria-pressed="${selected}">${date.getDate()}</button>`;
  }).join("");
}

function renderTaskRow(task, { scheduled = false, checkbox = false } = {}) {
  const id = escapeHtml(taskId(task) ?? "");
  const isComplete = task.status === "Completada";
  const isOverdue =
    Boolean(task.dueDate) &&
    !isComplete &&
    new Date(`${String(task.dueDate).slice(0, 10)}T23:59:59`) < new Date();
  const category = escapeHtml(task.category || "Otros");
  const priority = escapeHtml(task.priority || "Media");
  const status = escapeHtml(task.status || "Pendiente");
  const categoryClass = category.toLocaleLowerCase("es");
  const statusClass = status.toLocaleLowerCase("es").replace(" ", "-");
  const priorityClass = priority.toLocaleLowerCase("es");
  const scheduledTime = /^\d{2}:\d{2}$/.test(task.scheduledTime || "")
    ? task.scheduledTime
    : "";
  const rowClasses = [
    "task-row",
    "task-row-compact",
    scheduled && "has-time",
    checkbox && "has-checkbox",
    isComplete && "is-complete",
  ]
    .filter(Boolean)
    .join(" ");

  return `
    <article class="${rowClasses}" data-task-id="${id}">
      ${scheduled ? `<time class="task-time">${escapeHtml(scheduledTime || "—")}</time>` : ""}
      ${
        checkbox
          ? `<button class="task-checkbox${isComplete ? " is-checked" : ""}" type="button" role="checkbox" aria-checked="${isComplete}" aria-label="${isComplete ? "Marcar pendiente" : "Completar"}: ${escapeHtml(task.title)}" data-action="toggle-task">${isComplete ? icon("check", 12) : ""}</button>`
          : ""
      }
      <div class="task-row-main">
        <div class="task-title-line">
          <h3>${escapeHtml(task.title || "Tarea sin título")}</h3>
          <span class="priority-mark priority-${priorityClass}" title="Prioridad ${priority}">
            <span></span>${priority}
          </span>
        </div>
        ${task.description && !scheduled ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ""}
        <div class="task-row-meta">
          <span class="category-tag category-${categoryClass}">${escapeHtml(category)}</span>
          <span class="meta-divider"></span>
          <span class="task-due${isOverdue ? " is-overdue" : ""}">${icon("calendar", 12)} ${isOverdue ? "Vencida · " : ""}${escapeHtml(formatDueDate(task.dueDate))}</span>
          <span class="meta-divider"></span>
          <span class="task-status status-${statusClass}">${status}</span>
        </div>
      </div>
      <button class="task-edit" type="button" aria-label="Editar ${escapeHtml(task.title)}" data-action="edit-task">${icon("arrow", 16)}</button>
      <button class="task-delete" type="button" aria-label="Eliminar ${escapeHtml(task.title)}" data-action="delete-task">${icon("trash", 15)}</button>
    </article>`;
}

function renderTasksPage(page) {
  const tasks = getVisibleTasks({ includeFilters: true });
  return `
    <div class="page-intro">
      <div><span class="page-kicker">${escapeHtml(page.subtitle)}</span><h1>${escapeHtml(page.title)}</h1></div>
      <span class="today-date">${escapeHtml(formatLongDate(new Date()))}</span>
    </div>
    <section class="tasks-page-panel">
      <div class="tasks-toolbar">
        <div class="tasks-count"><span><strong>${tasks.length}</strong> ${tasks.length === 1 ? "tarea" : "tareas"}</span></div>
        <div class="filter-controls">
          <label class="filter-select">
            ${icon("filter", 15)}
            <span class="sr-only">Filtrar por prioridad</span>
            <select data-filter="priority">
              <option value="Todas" ${state.priorityFilter === "Todas" ? "selected" : ""}>Prioridad</option>
              <option value="Alta" ${state.priorityFilter === "Alta" ? "selected" : ""}>Alta</option>
              <option value="Media" ${state.priorityFilter === "Media" ? "selected" : ""}>Media</option>
              <option value="Baja" ${state.priorityFilter === "Baja" ? "selected" : ""}>Baja</option>
            </select>
          </label>
          <label class="filter-select">
            <span class="sr-only">Filtrar por categoría</span>
            <select data-filter="category">
              <option value="Todas" ${state.categoryFilter === "Todas" ? "selected" : ""}>Categoría</option>
              <option value="Académica" ${state.categoryFilter === "Académica" ? "selected" : ""}>Académica</option>
              <option value="Personal" ${state.categoryFilter === "Personal" ? "selected" : ""}>Personal</option>
              <option value="Trabajo" ${state.categoryFilter === "Trabajo" ? "selected" : ""}>Trabajo</option>
              <option value="Otros" ${state.categoryFilter === "Otros" ? "selected" : ""}>Otros</option>
            </select>
          </label>
        </div>
      </div>
      ${
        tasks.length
          ? `<div class="full-task-list">${tasks.map((task) => renderTaskRow(task, { checkbox: true })).join("")}</div>`
          : renderEmptyTasks()
      }
    </section>`;
}

function renderEmptyTasks() {
  const message = state.apiError
    ? "No se pudieron recibir tareas desde la API."
    : "Prueba otros filtros o crea una tarea para empezar.";
  return `
    <div class="empty-state list-empty">
      ${icon("list", 23)}
      <strong>${state.apiError ? "Sin tareas de la API" : "No hay tareas para mostrar"}</strong>
      <span>${escapeHtml(message)}</span>
      ${
        state.apiError
          ? `<button class="secondary-button" type="button" data-action="retry">${icon("arrow", 15)} Reintentar</button>`
          : `<button class="secondary-button" type="button" data-action="new-task">${icon("plus", 15)} Nueva tarea</button>`
      }
    </div>`;
}

function renderSettings(page) {
  const options = [
    { name: "Coral", value: "#ff6b4a" },
    { name: "Bosque", value: "#264a3e" },
    { name: "Oliva", value: "#a18a54" },
    { name: "Carbón", value: "#42413c" },
  ];
  return `
    <div class="page-intro">
      <div><span class="page-kicker">${escapeHtml(page.subtitle)}</span><h1>${escapeHtml(page.title)}</h1></div>
      <span class="today-date">${escapeHtml(formatLongDate(new Date()))}</span>
    </div>
    <div class="settings-grid">
      <section class="settings-card">
        <div class="settings-card-heading">
          <span class="settings-icon">${icon("sun", 18)}</span>
          <div><h2>Color de acento</h2><p>Un detalle de color para acompañar tu espacio.</p></div>
        </div>
        <div class="accent-options" role="group" aria-label="Color de acento">
          ${options
            .map(
              (option) => `
                <button class="accent-option${state.accent === option.value ? " is-selected" : ""}" type="button" aria-label="${option.name}" aria-pressed="${state.accent === option.value}" style="--swatch:${option.value}" data-accent="${option.value}">
                  ${state.accent === option.value ? icon("check", 15) : ""}
                </button>`,
            )
            .join("")}
          <span class="accent-current">${options.find((option) => option.value === state.accent)?.name || "Coral"}</span>
        </div>
      </section>
      <section class="settings-card">
        <div class="settings-card-heading">
          <span class="settings-icon settings-icon-coral">${icon("list", 18)}</span>
          <div><h2>Densidad de agenda</h2><p>Elige cuánto espacio dejar entre tus tareas.</p></div>
        </div>
        <label class="settings-toggle-row">
          <span><strong>Vista compacta</strong><small>Reduce el espacio vertical entre tareas.</small></span>
          <input class="toggle-input" type="checkbox" data-compact ${state.compact ? "checked" : ""} />
        </label>
      </section>
      <section class="settings-note">
        ${icon("check", 17)}
        <p>Las preferencias son temporales y se restablecen al recargar la página.</p>
      </section>
    </div>`;
}

function renderModal() {
  const task = state.modalTask;
  const values = {
    title: task?.title || "",
    description: task?.description || "",
    category: task?.category || "Académica",
    priority: task?.priority || "Media",
    scheduledTime: task?.scheduledTime || "",
    dueDate: task?.dueDate ? String(task.dueDate).slice(0, 10) : "",
    status: task?.status || "Pendiente",
  };
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-modal-backdrop>
      <section class="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
        <div class="modal-header">
          <span class="modal-icon">${icon("calendar", 19)}</span>
          <button class="icon-button modal-close" type="button" aria-label="Cerrar formulario" data-action="close-modal">${icon("close", 19)}</button>
          <span class="modal-kicker">${task ? "ACTUALIZA TU PLAN" : "HAZ ESPACIO PARA LO IMPORTANTE"}</span>
          <h2 id="task-modal-title">${task ? "Editar tarea" : "Nueva tarea"}</h2>
          <p>Un buen plan empieza con un siguiente paso.</p>
        </div>
        <form class="task-form" data-task-form>
          <label class="form-field">
            <span>Título <span class="required-mark">*</span></span>
            <input name="title" type="text" value="${escapeHtml(values.title)}" placeholder="Ej. Preparar una presentación" minlength="3" maxlength="100" required />
          </label>
          <label class="form-field">
            <span>Descripción</span>
            <textarea name="description" placeholder="Agrega algunos detalles..." rows="3" maxlength="500">${escapeHtml(values.description)}</textarea>
          </label>
          <div class="form-row">
            <label class="form-field">
              <span>Categoría</span>
              <select name="category" required>${optionMarkup(["Académica", "Personal", "Trabajo", "Otros"], values.category)}</select>
            </label>
            <label class="form-field">
              <span>Prioridad</span>
              <select name="priority" required>${optionMarkup(["Baja", "Media", "Alta"], values.priority)}</select>
            </label>
          </div>
          <div class="form-row">
            <label class="form-field"><span>Hora sugerida</span><input name="scheduledTime" type="time" value="${escapeHtml(values.scheduledTime)}" /></label>
            <label class="form-field"><span>Fecha límite</span><input name="dueDate" type="date" value="${escapeHtml(values.dueDate)}" /></label>
          </div>
          <label class="form-field">
            <span>Estado</span>
            <select name="status" required>${optionMarkup(["Pendiente", "En progreso", "Completada"], values.status)}</select>
          </label>
          <div class="modal-error" data-modal-error role="alert">${escapeHtml(state.modalError)}</div>
          <div class="modal-footer">
            <span class="form-hint"><span class="required-mark">*</span> Campo requerido</span>
            <div class="modal-actions">
              <button class="secondary-button" type="button" data-action="close-modal">Cancelar</button>
              <button class="primary-button" type="submit">${icon("check", 16)} ${task ? "Guardar cambios" : "Crear tarea"}</button>
            </div>
          </div>
        </form>
      </section>
    </div>`;
  modalRoot.querySelector('[name="title"]').focus();
  document.body.style.overflow = "hidden";
}

function optionMarkup(options, selected) {
  return options
    .map(
      (option) =>
        `<option value="${escapeHtml(option)}" ${selected === option ? "selected" : ""}>${escapeHtml(option)}</option>`,
    )
    .join("");
}

function closeModal() {
  state.modalTask = null;
  state.modalError = "";
  modalRoot.innerHTML = "";
  document.body.style.overflow = "";
}

function openModal(task = null) {
  state.modalTask = task;
  state.modalError = "";
  renderModal();
}

async function saveTask(form) {
  const values = Object.fromEntries(new FormData(form).entries());
  const task = state.modalTask;
  const path = task
    ? `/tasks/${encodeURIComponent(taskId(task))}`
    : "/tasks";

  try {
    values.title = typeof values.title === "string" ? values.title.trim() : "";
    values.description =
      typeof values.description === "string" ? values.description.trim() : "";
    values.scheduledTime =
      typeof values.scheduledTime === "string" ? values.scheduledTime : "";
    values.dueDate = typeof values.dueDate === "string" ? values.dueDate : "";
    validateTaskValues(values);
    await requestApi(path, {
      method: task ? "PUT" : "POST",
      body: JSON.stringify(values),
    });
    closeModal();
    const message = task ? "Tarea actualizada correctamente." : "Tarea creada correctamente.";
    const loaded = await loadTasks();
    showFeedback(
      loaded ? message : `${message} No se pudo actualizar la lista; vuelve a cargarla.`,
      loaded ? "success" : "error",
    );
  } catch (error) {
    state.modalError = error.message;
    const modalError = modalRoot.querySelector("[data-modal-error]");
    if (modalError) modalError.textContent = error.message;
  }
}

function validateTaskValues(values) {
  if (typeof values.title !== "string" || values.title.length < 3 || values.title.length > 100) {
    throw new Error("El título debe tener entre 3 y 100 caracteres.");
  }
  if (typeof values.description !== "string" || values.description.length > 500) {
    throw new Error("La descripción no puede superar los 500 caracteres.");
  }
  if (!["Académica", "Personal", "Trabajo", "Otros"].includes(values.category)) {
    throw new Error("Selecciona una categoría válida.");
  }
  if (!["Baja", "Media", "Alta"].includes(values.priority)) {
    throw new Error("Selecciona una prioridad válida.");
  }
  if (!["Pendiente", "En progreso", "Completada"].includes(values.status)) {
    throw new Error("Selecciona un estado válido.");
  }
  if (
    typeof values.scheduledTime !== "string" ||
    (values.scheduledTime !== "" &&
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(values.scheduledTime))
  ) {
    throw new Error("La hora sugerida debe tener el formato HH:mm.");
  }
  if (values.dueDate) {
    const date = parseLocalDate(values.dueDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(values.dueDate) || !date || localDateKey(date) !== values.dueDate) {
      throw new Error("La fecha límite no es válida.");
    }
  }
}

async function toggleTask(task) {
  const nextStatus =
    task.status === "Completada" ? "Pendiente" : "Completada";
  await mutateTask(task, { status: nextStatus }, "No se pudo actualizar la tarea.");
}

async function mutateTask(task, values, failurePrefix) {
  try {
    const taskValues = {
      title: task.title,
      description: task.description || "",
      category: task.category,
      priority: task.priority,
      scheduledTime: task.scheduledTime || "",
      dueDate: task.dueDate ? String(task.dueDate).slice(0, 10) : "",
      status: task.status,
      ...values,
    };
    await requestApi(`/tasks/${encodeURIComponent(taskId(task))}`, {
      method: "PUT",
      body: JSON.stringify(taskValues),
    });
    const loaded = await loadTasks();
    const message = "Tarea actualizada correctamente.";
    showFeedback(
      loaded ? message : `${message} No se pudo actualizar la lista; vuelve a cargarla.`,
      loaded ? "success" : "error",
    );
  } catch (error) {
    showFeedback(`${failurePrefix} ${error.message}`, "error");
  }
}

async function deleteTask(task) {
  const confirmed = window.confirm(`¿Eliminar “${task.title}”?`);
  if (!confirmed) return;

  try {
    await requestApi(`/tasks/${encodeURIComponent(taskId(task))}`, {
      method: "DELETE",
    });
    const loaded = await loadTasks();
    const message = "Tarea eliminada correctamente.";
    showFeedback(
      loaded ? message : `${message} No se pudo actualizar la lista; vuelve a cargarla.`,
      loaded ? "success" : "error",
    );
  } catch (error) {
    showFeedback(`No se pudo eliminar la tarea. ${error.message}`, "error");
  }
}

function navigate(view) {
  if (!views[view]) return;
  state.view = view;
  state.priorityFilter = "Todas";
  state.categoryFilter = "Todas";
  state.selectedDate = "";
  document.querySelector(".primary-nav").classList.remove("is-open");
  document
    .querySelector(".mobile-nav-toggle")
    .setAttribute("aria-expanded", "false");
  render();
}

function changeMonth(offset) {
  state.visibleMonth = new Date(
    state.visibleMonth.getFullYear(),
    state.visibleMonth.getMonth() + offset,
    1,
  );
  render();
}

function renderAfterSearch(input) {
  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  state.search = input.value;
  render();
  const nextInput = document.querySelector("[data-search]");
  nextInput.focus();
  nextInput.setSelectionRange(selectionStart, selectionEnd);
}

document.addEventListener("click", async (event) => {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    navigate(viewButton.dataset.view);
    return;
  }

  const dateButton = event.target.closest("[data-date]");
  if (dateButton) {
    state.selectedDate = dateButton.dataset.date;
    render();
    return;
  }

  const accentButton = event.target.closest("[data-accent]");
  if (accentButton) {
    state.accent = accentButton.dataset.accent;
    render();
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === "new-task") openModal();
    if (action === "close-modal") closeModal();
    if (action === "retry") loadTasks();
    if (action === "reset-date") {
      state.selectedDate = "";
      render();
    }
    if (action === "previous-month") changeMonth(-1);
    if (action === "next-month") changeMonth(1);
    if (action === "edit-task" || action === "toggle-task" || action === "delete-task") {
      const row = actionButton.closest("[data-task-id]");
      const task = state.tasks.find(
        (item) => String(taskId(item)) === row?.dataset.taskId,
      );
      if (!task) return;
      if (action === "edit-task") openModal(task);
      if (action === "toggle-task") await toggleTask(task);
      if (action === "delete-task") await deleteTask(task);
    }
    return;
  }

  if (event.target.matches("[data-modal-backdrop]")) closeModal();

});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-search]")) {
    renderAfterSearch(event.target);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches('[data-filter="priority"]')) {
    state.priorityFilter = event.target.value;
    render();
  }
  if (event.target.matches('[data-filter="category"]')) {
    state.categoryFilter = event.target.value;
    render();
  }
  if (event.target.matches("[data-compact]")) {
    state.compact = event.target.checked;
    render();
  }
});

document.addEventListener("submit", async (event) => {
  if (event.target.matches("[data-task-form]")) {
    event.preventDefault();
    await saveTask(event.target);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalRoot.firstElementChild) closeModal();
});

document.querySelector(".header-profile").addEventListener("click", () => {
  showFeedback("Perfil personal. La gestión de usuarios se habilitará más adelante.");
});

document.querySelector(".wordmark").addEventListener("click", (event) => {
  event.preventDefault();
  navigate("dashboard");
});

document.querySelector(".mobile-nav-toggle").addEventListener("click", (event) => {
  const nav = document.querySelector(".primary-nav");
  const isOpen = nav.classList.toggle("is-open");
  event.currentTarget.setAttribute("aria-expanded", String(isOpen));
});

checkApiHealth();
loadTasks();
