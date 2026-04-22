const STORAGE_KEY = "attendance-command-center";
const DEFAULT_API_BASE =
  window.ATTENDANCE_CONFIG?.apiBase?.replace(/\/$/, "") || "http://localhost:8000";

const state = {
  apiBase: DEFAULT_API_BASE,
  token: "",
  role: "",
  userId: null,
  me: null,
  activeTab: "overview",
  loading: false,
  loginRole: "admin",
  admin: {
    branches: [],
    semesters: [],
    subjects: [],
    teachers: [],
    students: [],
    studentDetail: null,
    filters: { branch_id: "", semester_id: "" },
    editing: {
      branchId: null,
      semesterId: null,
      subjectId: null,
      teacherId: null,
    },
  },
  teacher: {
    subjects: [],
    selectedSubjectId: "",
    selectedDate: new Date().toISOString().slice(0, 10),
    students: [],
    dates: [],
    records: [],
  },
  student: {
    profile: null,
    summary: [],
    detailSubjectId: "",
    detail: [],
  },
};

const app = document.getElementById("app");
const toastRoot = document.getElementById("toast-root");

function loadSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    Object.assign(state, {
      token: saved.token || "",
      role: saved.role || "",
      userId: saved.userId || null,
      me: saved.me || null,
    });
  } catch (_) {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveSession() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      token: state.token,
      role: state.role,
      userId: state.userId,
      me: state.me,
    }),
  );
}

function clearSession() {
  state.token = "";
  state.role = "";
  state.userId = null;
  state.me = null;
  state.activeTab = "overview";
  localStorage.removeItem(STORAGE_KEY);
}

function toast(message, type = "info") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  toastRoot.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "N/A";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatRoleLabel(role) {
  const labels = {
    admin: "Admin",
    teacher: "Teacher",
    student: "Student",
  };
  return labels[role] || role;
}

function getStatusBadge(status) {
  const normalized = String(status || "").toLowerCase();
  if (["present", "active", "healthy"].includes(normalized)) {
    return `<span class="badge success">${escapeHtml(status)}</span>`;
  }
  if (["absent", "deactivated", "inactive"].includes(normalized)) {
    return `<span class="badge danger">${escapeHtml(status)}</span>`;
  }
  return `<span class="badge info">${escapeHtml(status || "unknown")}</span>`;
}

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = new Headers(options.headers || {});

  if (state.token) {
    headers.set("Authorization", `Bearer ${state.token}`);
  }
  if (!isFormData && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${state.apiBase}${path}`, {
    ...options,
    headers,
    body: isFormData
      ? options.body
      : typeof options.body === "string" || !options.body
        ? options.body
        : JSON.stringify(options.body),
  });

  if (response.status === 204) return null;

  const text = await response.text();
  const data = text ? safeJson(text) : null;

  if (!response.ok) {
    const detail = data?.detail || data?.message || text || `Request failed with ${response.status}`;
    throw new Error(detail);
  }

  return data;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}

function setLoading(flag) {
  state.loading = flag;
  app.querySelectorAll("button").forEach((button) => {
    if (flag) {
      button.setAttribute("disabled", "disabled");
    } else {
      button.removeAttribute("disabled");
    }
  });
}

function setTab(tab) {
  state.activeTab = tab;
  render();
}

async function initialize() {
  loadSession();
  render();
  if (state.token) {
    try {
      await refreshIdentity();
      await loadRoleData();
      render();
    } catch (error) {
      clearSession();
      render();
      toast(error.message || "Session expired. Please sign in again.", "error");
    }
  }
}

async function refreshIdentity() {
  const me = await api("/api/auth/me");
  state.me = me;
  state.role = me.role;
  state.userId = me.id;
  saveSession();
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.username.value.trim();
  const password = form.password.value;
  const selectedRole = state.loginRole;

  if (!username || !password) {
    toast("Please fill in username and password.", "error");
    return;
  }

  try {
    setLoading(true);
    const result = await api("/api/auth/login", {
      method: "POST",
      body: { username, password },
    });
    state.token = result.access_token;
    state.role = result.role;
    state.userId = result.user_id;
    await refreshIdentity();
    await loadRoleData();
    saveSession();
    toast(
      result.role === selectedRole
        ? `Welcome to the ${formatRoleLabel(result.role)} portal.`
        : `Signed in as ${formatRoleLabel(result.role)}. Portal access was matched automatically.`,
      "success",
    );
    render();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setLoading(false);
  }
}

function logout() {
  clearSession();
  render();
  toast("Signed out.", "info");
}

async function loadRoleData() {
  if (state.role === "admin") {
    await loadAdminData();
  }
  if (state.role === "teacher") {
    await loadTeacherData();
  }
  if (state.role === "student") {
    await loadStudentData();
  }
}

async function loadAdminData() {
  const [branches, semesters, subjects, teachers, students] = await Promise.all([
    api("/api/admin/branches"),
    api("/api/admin/semesters"),
    api("/api/admin/subjects"),
    api("/api/admin/teachers"),
    api("/api/admin/students"),
  ]);

  state.admin.branches = branches;
  state.admin.semesters = semesters;
  state.admin.subjects = subjects;
  state.admin.teachers = teachers;
  state.admin.students = students;
}

async function refreshStudents() {
  const params = new URLSearchParams();
  if (state.admin.filters.branch_id) params.set("branch_id", state.admin.filters.branch_id);
  if (state.admin.filters.semester_id) params.set("semester_id", state.admin.filters.semester_id);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  state.admin.students = await api(`/api/admin/students${suffix}`);
}

async function loadTeacherData() {
  state.teacher.subjects = await api("/api/teacher/subjects");
  if (!state.teacher.selectedSubjectId && state.teacher.subjects.length) {
    state.teacher.selectedSubjectId = String(state.teacher.subjects[0].id);
  }
  if (state.teacher.selectedSubjectId) {
    await loadTeacherSubjectData(state.teacher.selectedSubjectId, state.teacher.selectedDate);
  }
}

async function loadTeacherSubjectData(subjectId, date) {
  const [students, dates] = await Promise.all([
    api(`/api/teacher/subjects/${subjectId}/students`),
    api(`/api/teacher/attendance/${subjectId}/dates`),
  ]);

  state.teacher.students = students;
  state.teacher.dates = dates;
  state.teacher.selectedSubjectId = String(subjectId);
  state.teacher.selectedDate = date;

  try {
    state.teacher.records = await api(`/api/teacher/attendance/${subjectId}?date=${date}`);
  } catch (error) {
    state.teacher.records = [];
    if (!/422/.test(error.message)) {
      throw error;
    }
  }
}

async function loadStudentData() {
  const [profile, summary] = await Promise.all([
    api("/api/student/profile"),
    api("/api/student/attendance/summary"),
  ]);
  state.student.profile = profile;
  state.student.summary = summary;
  if (!state.student.detailSubjectId && summary.length) {
    state.student.detailSubjectId = String(summary[0].subject_id);
  }
  if (state.student.detailSubjectId) {
    state.student.detail = await api(`/api/student/attendance/${state.student.detailSubjectId}`);
  }
}

function render() {
  app.innerHTML = state.token ? renderDashboard() : renderLogin();
  bindEvents();
}

function renderLogin() {
  const roleMeta = {
    admin: {
      short: "Academic office access",
      copy: "Use this portal for branches, semesters, subjects, faculty management, and student administration.",
      usernamePlaceholder: "Enter admin username",
      passwordPlaceholder: "Enter admin password",
      cta: "Enter Admin Dashboard",
    },
    teacher: {
      short: "Faculty attendance portal",
      copy: "Use this portal for marking attendance, reviewing class history, and updating attendance records.",
      usernamePlaceholder: "Enter teacher username",
      passwordPlaceholder: "Enter teacher password",
      cta: "Enter Teacher Dashboard",
    },
    student: {
      short: "Student attendance portal",
      copy: "Use this portal for viewing your profile, attendance percentage, and subject-wise attendance history.",
      usernamePlaceholder: "Enter student username",
      passwordPlaceholder: "Enter student password",
      cta: "Enter Student Dashboard",
    },
  };
  const selectedRoleMeta = roleMeta[state.loginRole] || roleMeta.admin;

  return `
    <section class="login-shell">
      <div class="hero">
        <div class="eyebrow">University Attendance Portal</div>
        <h1>Odisha University of Technology and Research</h1>
        <p>
          Built for academic offices, faculty teams, and students, this portal turns your backend
          into a university-facing experience with role-specific access, cleaner workflows, and a
          more institutional visual language.
        </p>
        <div class="hero-grid">
          <div class="hero-card">
            <strong>Academic Office</strong>
            <span>Manage departments, semesters, subjects, faculty allocation, and admissions imports.</span>
          </div>
          <div class="hero-card">
            <strong>Faculty Portal</strong>
            <span>Take attendance, review class sessions, and correct records with confidence.</span>
          </div>
          <div class="hero-card">
            <strong>Student Services</strong>
            <span>Track attendance percentages, profile records, and subject-wise history.</span>
          </div>
        </div>
      </div>

      <section class="panel">
        <h2 class="brand-title">Sign in to your campus portal</h2>
        <p class="brand-copy">
          Use your university login to access attendance services. The server connection is configured internally and is not shown to end users.
        </p>
        <form id="login-form">
          <div class="field-grid">
            <div class="field full">
              <label>Portal Access</label>
              <div class="login-role-grid">
                ${Object.entries(roleMeta)
                  .map(([role, meta]) => `
                    <button
                      type="button"
                      class="login-role-btn ${state.loginRole === role ? "active" : ""}"
                      data-login-role="${role}"
                    >
                      <strong>${formatRoleLabel(role)}</strong>
                      <span>${escapeHtml(meta.short)}</span>
                    </button>
                  `)
                  .join("")}
              </div>
              <p class="role-note">${escapeHtml(selectedRoleMeta.copy)}</p>
            </div>
            <div class="field">
              <label for="username">Username</label>
              <input id="username" name="username" type="text" placeholder="${escapeHtml(selectedRoleMeta.usernamePlaceholder)}">
            </div>
            <div class="field">
              <label for="password">Password</label>
              <input id="password" name="password" type="password" placeholder="${escapeHtml(selectedRoleMeta.passwordPlaceholder)}">
            </div>
          </div>
          <div class="button-row">
            <button type="submit">${escapeHtml(selectedRoleMeta.cta)}</button>
          </div>
        </form>
      </section>
    </section>
  `;
}

function renderDashboard() {
  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-left">
          <div class="seal"><span>U</span></div>
          <div>
            <h1 class="headline">University Attendance Portal</h1>
            <p class="subline">
              Welcome, <strong>${escapeHtml(state.me?.username || "")}</strong>.
              You are signed in with <strong>${escapeHtml(state.role)}</strong> access.
            </p>
          </div>
        </div>
        <div class="button-row">
          <button class="ghost-btn" data-action="refresh-role">Refresh</button>
          <button class="danger-btn" data-action="logout">Logout</button>
        </div>
      </header>

      <nav class="pill-row">
        ${renderTabs()}
      </nav>

      ${state.role === "admin" ? renderAdmin() : ""}
      ${state.role === "teacher" ? renderTeacher() : ""}
      ${state.role === "student" ? renderStudent() : ""}
    </div>
  `;
}

function renderTabs() {
  const tabsByRole = {
    admin: [
      ["overview", "Overview"],
      ["branches", "Branches"],
      ["semesters", "Semesters"],
      ["subjects", "Subjects"],
      ["teachers", "Teachers"],
      ["students", "Students"],
    ],
    teacher: [
      ["overview", "Overview"],
      ["mark", "Mark Attendance"],
      ["history", "Attendance History"],
    ],
    student: [
      ["overview", "Overview"],
      ["profile", "Profile"],
      ["attendance", "Attendance"],
    ],
  };

  return tabsByRole[state.role]
    .map(([key, label]) => `
      <button class="pill ${state.activeTab === key ? "active" : ""}" data-tab="${key}">${label}</button>
    `)
    .join("");
}

function renderAdmin() {
  const branchMap = new Map(state.admin.branches.map((item) => [item.id, item]));
  const semesterMap = new Map(state.admin.semesters.map((item) => [item.id, item]));
  const teacherMap = new Map(state.admin.teachers.map((item) => [item.id, item]));
  const activeSemesters = state.admin.semesters.filter((item) => item.is_active).length;

  const content = {
    overview: `
      <section class="grid stats-grid">
        ${renderStat("Departments", state.admin.branches.length, "Schools and academic units")}
        ${renderStat("Semesters", state.admin.semesters.length, `${activeSemesters} currently active`)}
        ${renderStat("Courses", state.admin.subjects.length, "University course catalog")}
        ${renderStat("Campus Users", state.admin.teachers.length + state.admin.students.length, "Faculty plus students")}
      </section>
      <section class="grid columns-3">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Academic Snapshot</h2>
              <p class="section-copy">A quick institutional overview based on live university data.</p>
            </div>
          </div>
          <div class="summary-grid">
            <div class="subject-card">
              <strong>${state.admin.teachers.length}</strong>
              <span>Teachers registered</span>
            </div>
            <div class="subject-card">
              <strong>${state.admin.students.length}</strong>
              <span>Students onboarded</span>
            </div>
            <div class="subject-card">
              <strong>${state.admin.subjects.filter((s) => s.teacher_id).length}</strong>
              <span>Subjects assigned to teachers</span>
            </div>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Schools and Departments</h2>
              <p class="section-copy">The latest academic units configured in the portal.</p>
            </div>
          </div>
          ${renderSimpleList(state.admin.branches.slice(0, 5).map((item) => `${item.name} (${item.code})`), "No branches yet.")}
        </div>
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Faculty Allocation</h2>
              <p class="section-copy">Shows which courses already have faculty assigned.</p>
            </div>
          </div>
          ${renderSimpleList(
            state.admin.subjects.slice(0, 6).map((subject) => {
              const teacherName = subject.teacher_id ? teacherMap.get(subject.teacher_id)?.name || `Teacher #${subject.teacher_id}` : "Unassigned";
              return `${subject.name} - ${teacherName}`;
            }),
            "No subjects yet.",
          )}
        </div>
      </section>
    `,
    branches: `
      <section class="grid columns-2">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">${state.admin.editing.branchId ? "Edit Branch" : "Create Branch"}</h2>
              <p class="section-copy">Create program units like CSE or ECE and keep their short code consistent.</p>
            </div>
          </div>
          <form id="branch-form">
            <div class="field-grid">
              <div class="field">
                <label for="branchName">Branch Name</label>
                <input id="branchName" name="name" type="text" placeholder="Computer Science" value="${escapeHtml(getEditingItem("branch")?.name || "")}">
              </div>
              <div class="field">
                <label for="branchCode">Branch Code</label>
                <input id="branchCode" name="code" type="text" placeholder="CSE" value="${escapeHtml(getEditingItem("branch")?.code || "")}">
              </div>
            </div>
            <div class="button-row">
              <button type="submit">${state.admin.editing.branchId ? "Update Branch" : "Create Branch"}</button>
              ${state.admin.editing.branchId ? '<button type="button" class="ghost-btn" data-action="cancel-branch-edit">Cancel</button>' : ""}
            </div>
          </form>
        </div>
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">All Branches</h2>
              <p class="section-copy">Every branch available in the system.</p>
            </div>
          </div>
          ${renderBranchesTable()}
        </div>
      </section>
    `,
    semesters: `
      <section class="grid columns-2">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">${state.admin.editing.semesterId ? "Edit Semester" : "Create Semester"}</h2>
              <p class="section-copy">Manage academic year labels and which semester is currently active.</p>
            </div>
          </div>
          <form id="semester-form">
            <div class="field-grid">
              <div class="field">
                <label>Name</label>
                <input name="name" type="text" placeholder="Semester 1" value="${escapeHtml(getEditingItem("semester")?.name || "")}">
              </div>
              <div class="field">
                <label>Number</label>
                <input name="number" type="number" min="1" placeholder="1" value="${escapeHtml(getEditingItem("semester")?.number || "")}">
              </div>
              <div class="field">
                <label>Academic Year</label>
                <input name="academic_year" type="text" placeholder="2026-27" value="${escapeHtml(getEditingItem("semester")?.academic_year || "")}">
              </div>
              <div class="field">
                <label>Active</label>
                <select name="is_active">
                  <option value="true" ${getEditingItem("semester")?.is_active !== false ? "selected" : ""}>Yes</option>
                  <option value="false" ${getEditingItem("semester")?.is_active === false ? "selected" : ""}>No</option>
                </select>
              </div>
            </div>
            <div class="button-row">
              <button type="submit">${state.admin.editing.semesterId ? "Update Semester" : "Create Semester"}</button>
              ${state.admin.editing.semesterId ? '<button type="button" class="ghost-btn" data-action="cancel-semester-edit">Cancel</button>' : ""}
            </div>
          </form>
        </div>
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Semester Catalog</h2>
              <p class="section-copy">Track academic years and activation state.</p>
            </div>
          </div>
          ${renderSemestersTable()}
        </div>
      </section>
    `,
    subjects: `
      <section class="grid columns-2">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">${state.admin.editing.subjectId ? "Edit Subject" : "Create Subject"}</h2>
              <p class="section-copy">Subjects connect a branch, a semester, and optionally a teacher assignment.</p>
            </div>
          </div>
          <form id="subject-form">
            <div class="field-grid">
              <div class="field">
                <label>Name</label>
                <input name="name" type="text" placeholder="Data Structures" value="${escapeHtml(getEditingItem("subject")?.name || "")}">
              </div>
              <div class="field">
                <label>Code</label>
                <input name="code" type="text" placeholder="CS201" value="${escapeHtml(getEditingItem("subject")?.code || "")}">
              </div>
              <div class="field">
                <label>Branch</label>
                <select name="branch_id" ${state.admin.editing.subjectId ? "disabled" : ""}>
                  <option value="">Select branch</option>
                  ${state.admin.branches.map((branch) => `
                    <option value="${branch.id}" ${String(getEditingItem("subject")?.branch_id || "") === String(branch.id) ? "selected" : ""}>${escapeHtml(branch.name)} (${escapeHtml(branch.code)})</option>
                  `).join("")}
                </select>
              </div>
              <div class="field">
                <label>Semester</label>
                <select name="semester_id" ${state.admin.editing.subjectId ? "disabled" : ""}>
                  <option value="">Select semester</option>
                  ${state.admin.semesters.map((semester) => `
                    <option value="${semester.id}" ${String(getEditingItem("subject")?.semester_id || "") === String(semester.id) ? "selected" : ""}>${escapeHtml(semester.name)}</option>
                  `).join("")}
                </select>
              </div>
            </div>
            <div class="button-row">
              <button type="submit">${state.admin.editing.subjectId ? "Update Subject" : "Create Subject"}</button>
              ${state.admin.editing.subjectId ? '<button type="button" class="ghost-btn" data-action="cancel-subject-edit">Cancel</button>' : ""}
            </div>
          </form>
        </div>
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Subjects and Assignment</h2>
              <p class="section-copy">Assign teachers directly from the table without leaving the page.</p>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Branch</th>
                  <th>Semester</th>
                  <th>Teacher</th>
                  <th>Assign</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${state.admin.subjects.map((subject) => `
                  <tr>
                    <td>
                      <strong>${escapeHtml(subject.name)}</strong><br>
                      <span class="muted mono">${escapeHtml(subject.code)}</span>
                    </td>
                    <td>${escapeHtml(branchMap.get(subject.branch_id)?.name || `#${subject.branch_id}`)}</td>
                    <td>${escapeHtml(semesterMap.get(subject.semester_id)?.name || `#${subject.semester_id}`)}</td>
                    <td>${escapeHtml(subject.teacher_id ? teacherMap.get(subject.teacher_id)?.name || `Teacher #${subject.teacher_id}` : "Unassigned")}</td>
                    <td>
                      <div class="split">
                        <select data-assign-subject="${subject.id}">
                          <option value="">Unassigned</option>
                          ${state.admin.teachers.map((teacher) => `
                            <option value="${teacher.id}" ${String(subject.teacher_id || "") === String(teacher.id) ? "selected" : ""}>${escapeHtml(teacher.name)}</option>
                          `).join("")}
                        </select>
                        <button class="tiny-btn secondary-btn" data-action="assign-teacher" data-id="${subject.id}">Save</button>
                      </div>
                    </td>
                    <td>
                      <div class="button-row">
                        <button class="tiny-btn ghost-btn" data-action="edit-subject" data-id="${subject.id}">Edit</button>
                        <button class="tiny-btn danger-btn" data-action="delete-subject" data-id="${subject.id}">Delete</button>
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `,
    teachers: `
      <section class="grid columns-2">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">${state.admin.editing.teacherId ? "Edit Teacher" : "Create Teacher"}</h2>
              <p class="section-copy">Add teacher credentials and profile details from one place.</p>
            </div>
          </div>
          <form id="teacher-form">
            <div class="field-grid">
              <div class="field">
                <label>Name</label>
                <input name="name" type="text" placeholder="Dr. A. Sen" value="${escapeHtml(getEditingItem("teacher")?.name || "")}">
              </div>
              <div class="field">
                <label>Employee ID</label>
                <input name="employee_id" type="text" placeholder="T001" value="${escapeHtml(getEditingItem("teacher")?.employee_id || "")}" ${state.admin.editing.teacherId ? "disabled" : ""}>
              </div>
              <div class="field">
                <label>Email</label>
                <input name="email" type="email" placeholder="teacher@college.edu" value="${escapeHtml(getEditingItem("teacher")?.email || "")}">
              </div>
              <div class="field">
                <label>Phone</label>
                <input name="phone" type="text" placeholder="9876543210" value="${escapeHtml(getEditingItem("teacher")?.phone || "")}">
              </div>
              <div class="field">
                <label>Department</label>
                <input name="department" type="text" placeholder="Computer Science" value="${escapeHtml(getEditingItem("teacher")?.department || "")}">
              </div>
              ${state.admin.editing.teacherId ? "" : `
                <div class="field">
                  <label>Username</label>
                  <input name="username" type="text" placeholder="asen">
                </div>
                <div class="field full">
                  <label>Password</label>
                  <input name="password" type="password" placeholder="Create login password">
                </div>
              `}
            </div>
            <div class="button-row">
              <button type="submit">${state.admin.editing.teacherId ? "Update Teacher" : "Create Teacher"}</button>
              ${state.admin.editing.teacherId ? '<button type="button" class="ghost-btn" data-action="cancel-teacher-edit">Cancel</button>' : ""}
            </div>
          </form>
        </div>
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Faculty Directory</h2>
              <p class="section-copy">Toggle accounts, edit profiles, or remove access.</p>
            </div>
          </div>
          ${renderTeachersTable()}
        </div>
      </section>
    `,
    students: `
      <section class="grid">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Import Students from CSV</h2>
              <p class="section-copy">Upload a Google Form CSV export. Password defaults to each roll number.</p>
            </div>
          </div>
          <form id="student-import-form">
            <div class="field-grid">
              <div class="field file-field">
                <label>CSV File</label>
                <input name="file" type="file" accept=".csv" required>
              </div>
              <div class="field">
                <label>Restrict to Semester</label>
                <select name="active_semester_id">
                  <option value="">Use semester number matching</option>
                  ${state.admin.semesters.map((semester) => `
                    <option value="${semester.id}">${escapeHtml(semester.name)} (${escapeHtml(semester.academic_year)})</option>
                  `).join("")}
                </select>
              </div>
            </div>
            <div class="button-row">
              <button type="submit">Import Students</button>
            </div>
          </form>
        </div>

        <div class="grid columns-2">
          <div class="panel">
            <div class="panel-head">
              <div>
                <h2 class="section-title">Student Directory</h2>
                <p class="section-copy">Filter by branch and semester, then inspect or manage accounts.</p>
              </div>
            </div>
            <div class="toolbar">
              <select id="student-branch-filter">
                <option value="">All branches</option>
                ${state.admin.branches.map((branch) => `
                  <option value="${branch.id}" ${String(state.admin.filters.branch_id) === String(branch.id) ? "selected" : ""}>${escapeHtml(branch.name)}</option>
                `).join("")}
              </select>
              <select id="student-semester-filter">
                <option value="">All semesters</option>
                ${state.admin.semesters.map((semester) => `
                  <option value="${semester.id}" ${String(state.admin.filters.semester_id) === String(semester.id) ? "selected" : ""}>${escapeHtml(semester.name)}</option>
                `).join("")}
              </select>
              <button class="secondary-btn" data-action="apply-student-filters">Apply Filters</button>
            </div>
            ${renderStudentsTable()}
          </div>

          <div class="panel">
            <div class="panel-head">
              <div>
                <h2 class="section-title">Student Detail</h2>
                <p class="section-copy">Select a student to inspect full profile information.</p>
              </div>
            </div>
            ${renderStudentDetail()}
          </div>
        </div>
      </section>
    `,
  };

  return content[state.activeTab] || content.overview;
}

function renderTeacher() {
  const selectedSubject = state.teacher.subjects.find((item) => String(item.id) === String(state.teacher.selectedSubjectId));
  const stats = {
    subjects: state.teacher.subjects.length,
    students: state.teacher.students.length,
    dates: state.teacher.dates.length,
    records: state.teacher.records.length,
  };

  const content = {
    overview: `
      <section class="grid stats-grid">
        ${renderStat("Assigned Subjects", stats.subjects, "Subjects currently assigned to you")}
        ${renderStat("Current Class Size", stats.students, "Students in selected subject")}
        ${renderStat("Marked Dates", stats.dates, "Attendance sessions recorded")}
        ${renderStat("Records On Date", stats.records, "Attendance rows for selected date")}
      </section>
      <section class="grid columns-2">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">My Courses</h2>
              <p class="section-copy">Choose a course to work with. Attendance tools update instantly.</p>
            </div>
          </div>
          ${renderTeacherSubjects()}
        </div>
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Selected Context</h2>
              <p class="section-copy">A quick read on the current subject and date context.</p>
            </div>
          </div>
          <div class="summary-grid">
            <div class="subject-card">
              <strong>${escapeHtml(selectedSubject?.name || "No subject")}</strong>
              <span>${escapeHtml(selectedSubject?.code || "Choose a subject")}</span>
            </div>
            <div class="subject-card">
              <strong>${escapeHtml(selectedSubject?.branch || "N/A")}</strong>
              <span>Branch</span>
            </div>
            <div class="subject-card">
              <strong>${escapeHtml(selectedSubject?.semester || "N/A")}</strong>
              <span>Semester</span>
            </div>
            <div class="subject-card">
              <strong>${escapeHtml(formatDate(state.teacher.selectedDate))}</strong>
              <span>Working date</span>
            </div>
          </div>
        </div>
      </section>
    `,
    mark: `
      <section class="grid columns-2">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Choose Subject and Date</h2>
              <p class="section-copy">Load the class list first, then save all statuses in one request.</p>
            </div>
          </div>
          <form id="teacher-context-form">
            <div class="field-grid">
              <div class="field">
                <label>Subject</label>
                <select name="subject_id">
                  ${state.teacher.subjects.map((subject) => `
                    <option value="${subject.id}" ${String(state.teacher.selectedSubjectId) === String(subject.id) ? "selected" : ""}>${escapeHtml(subject.name)} (${escapeHtml(subject.code)})</option>
                  `).join("")}
                </select>
              </div>
              <div class="field">
                <label>Date</label>
                <input name="date" type="date" value="${escapeHtml(state.teacher.selectedDate)}">
              </div>
            </div>
            <div class="button-row">
              <button type="submit">Load Class</button>
            </div>
          </form>
        </div>
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Bulk Attendance</h2>
              <p class="section-copy">Present and absent statuses are sent to <span class="mono">POST /api/teacher/attendance</span>.</p>
            </div>
          </div>
          ${renderAttendanceForm()}
        </div>
      </section>
    `,
    history: `
      <section class="grid columns-2">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Attendance Dates</h2>
              <p class="section-copy">Load a previous date and edit any individual record inline.</p>
            </div>
          </div>
          <form id="teacher-history-form">
            <div class="field-grid">
              <div class="field">
                <label>Subject</label>
                <select name="subject_id">
                  ${state.teacher.subjects.map((subject) => `
                    <option value="${subject.id}" ${String(state.teacher.selectedSubjectId) === String(subject.id) ? "selected" : ""}>${escapeHtml(subject.name)} (${escapeHtml(subject.code)})</option>
                  `).join("")}
                </select>
              </div>
              <div class="field">
                <label>Recorded Dates</label>
                <select name="date">
                  <option value="${escapeHtml(state.teacher.selectedDate)}">${escapeHtml(formatDate(state.teacher.selectedDate))}</option>
                  ${state.teacher.dates
                    .filter((date) => date !== state.teacher.selectedDate)
                    .map((date) => `<option value="${escapeHtml(date)}">${escapeHtml(formatDate(date))}</option>`)
                    .join("")}
                </select>
              </div>
            </div>
            <div class="button-row">
              <button type="submit">Load Records</button>
            </div>
          </form>
          <p class="panel-note">Use the recorded date selector above to review or edit a previous attendance session.</p>
        </div>
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Editable Records</h2>
              <p class="section-copy">Each update hits <span class="mono">PATCH /api/teacher/attendance/record/:id</span>.</p>
            </div>
          </div>
          ${renderTeacherRecords()}
        </div>
      </section>
    `,
  };

  return content[state.activeTab] || content.overview;
}

function renderStudent() {
  const average =
    state.student.summary.length
      ? (
          state.student.summary.reduce((sum, item) => sum + Number(item.percentage || 0), 0) /
          state.student.summary.length
        ).toFixed(2)
      : "0.00";

  const content = {
    overview: `
      <section class="grid stats-grid">
        ${renderStat("Subjects", state.student.summary.length, "Courses in your current semester")}
        ${renderStat("Average Attendance", `${average}%`, "Across all subjects")}
        ${renderStat("Present Classes", state.student.summary.reduce((sum, item) => sum + item.present, 0), "Total present records")}
        ${renderStat("Absent Classes", state.student.summary.reduce((sum, item) => sum + item.absent, 0), "Total absent records")}
      </section>
      <section class="grid columns-2">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Student Record</h2>
              <p class="section-copy">Pulled directly from your university profile endpoint.</p>
            </div>
          </div>
          ${renderStudentProfile()}
        </div>
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Course Attendance</h2>
              <p class="section-copy">A clean summary of attendance percentages across your courses.</p>
            </div>
          </div>
          ${renderStudentSummaryCards()}
        </div>
      </section>
    `,
    profile: `
      <section class="panel">
        <div class="panel-head">
          <div>
            <h2 class="section-title">University Profile</h2>
            <p class="section-copy">Everything returned by <span class="mono">GET /api/student/profile</span>.</p>
          </div>
        </div>
        ${renderStudentProfile(true)}
      </section>
    `,
    attendance: `
      <section class="grid columns-2">
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Attendance Summary</h2>
              <p class="section-copy">Choose a course to inspect the date-wise attendance breakdown.</p>
            </div>
          </div>
          <div class="field">
            <label>Subject</label>
            <select id="student-detail-subject">
              ${state.student.summary.map((subject) => `
                <option value="${subject.subject_id}" ${String(state.student.detailSubjectId) === String(subject.subject_id) ? "selected" : ""}>${escapeHtml(subject.subject_name)} (${escapeHtml(subject.subject_code)})</option>
              `).join("")}
            </select>
          </div>
          ${renderStudentSummaryTable()}
        </div>
        <div class="panel">
          <div class="panel-head">
            <div>
              <h2 class="section-title">Date-wise Detail</h2>
              <p class="section-copy">Straight from <span class="mono">GET /api/student/attendance/:subject_id</span>.</p>
            </div>
          </div>
          ${renderStudentDetailTable()}
        </div>
      </section>
    `,
  };

  return content[state.activeTab] || content.overview;
}

function renderStat(label, value, hint) {
  return `
    <div class="stat-card">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${escapeHtml(value)}</div>
      <div class="hint">${escapeHtml(hint)}</div>
    </div>
  `;
}

function renderSimpleList(items, emptyText) {
  if (!items.length) return `<div class="empty-state">${escapeHtml(emptyText)}</div>`;
  return `
    <div class="subject-list">
      ${items.map((item) => `<div class="subject-card">${escapeHtml(item)}</div>`).join("")}
    </div>
  `;
}

function renderBranchesTable() {
  if (!state.admin.branches.length) return `<div class="empty-state">No branches created yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Code</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${state.admin.branches.map((branch) => `
            <tr>
              <td>${escapeHtml(branch.name)}</td>
              <td class="mono">${escapeHtml(branch.code)}</td>
              <td>${formatDate(branch.created_at)}</td>
              <td>
                <div class="button-row">
                  <button class="tiny-btn ghost-btn" data-action="edit-branch" data-id="${branch.id}">Edit</button>
                  <button class="tiny-btn danger-btn" data-action="delete-branch" data-id="${branch.id}">Delete</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSemestersTable() {
  if (!state.admin.semesters.length) return `<div class="empty-state">No semesters created yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Number</th>
            <th>Academic Year</th>
            <th>Access</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${state.admin.semesters.map((semester) => `
            <tr>
              <td>${escapeHtml(semester.name)}</td>
              <td>${escapeHtml(semester.number)}</td>
              <td>${escapeHtml(semester.academic_year)}</td>
              <td>${semester.is_active ? '<span class="badge success">Active</span>' : '<span class="badge warning">Inactive</span>'}</td>
              <td>
                <div class="button-row">
                  <button class="tiny-btn ghost-btn" data-action="edit-semester" data-id="${semester.id}">Edit</button>
                  <button class="tiny-btn danger-btn" data-action="delete-semester" data-id="${semester.id}">Delete</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTeachersTable() {
  if (!state.admin.teachers.length) return `<div class="empty-state">No teachers found.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Teacher</th>
            <th>Contact</th>
            <th>Department</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${state.admin.teachers.map((teacher) => `
            <tr>
              <td>
                <strong>${escapeHtml(teacher.name)}</strong><br>
                <span class="muted mono">${escapeHtml(teacher.employee_id)}</span>
              </td>
              <td>
                ${escapeHtml(teacher.email)}<br>
                <span class="muted">${escapeHtml(teacher.phone || "No phone")}</span>
              </td>
              <td>${escapeHtml(teacher.department || "Not set")}</td>
              <td>${teacher.is_active ? '<span class="badge success">Active</span>' : '<span class="badge danger">Inactive</span>'}</td>
              <td>
                <div class="button-row">
                  <button type="button" class="tiny-btn ghost-btn" data-action="edit-teacher" data-id="${teacher.id}">Edit</button>
                  <button type="button" class="tiny-btn secondary-btn" data-action="toggle-teacher" data-id="${teacher.id}">${teacher.is_active ? "Deactivate" : "Activate"}</button>
                  <button type="button" class="tiny-btn danger-btn" data-action="delete-teacher" data-id="${teacher.id}">Delete</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderStudentsTable() {
  if (!state.admin.students.length) return `<div class="empty-state">No students found for the current filters.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Roll No</th>
            <th>Email</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${state.admin.students.map((student) => `
            <tr>
              <td>${escapeHtml(student.name)}</td>
              <td class="mono">${escapeHtml(student.roll_no)}</td>
              <td>${escapeHtml(student.email || "N/A")}</td>
              <td>${student.is_active ? '<span class="badge success">Active</span>' : '<span class="badge danger">Inactive</span>'}</td>
              <td>
                <div class="button-row">
                  <button type="button" class="tiny-btn ghost-btn" data-action="view-student" data-id="${student.id}">View</button>
                  <button type="button" class="tiny-btn secondary-btn" data-action="toggle-student" data-id="${student.id}">${student.is_active ? "Deactivate" : "Activate"}</button>
                  <button type="button" class="tiny-btn danger-btn" data-action="reset-student-password" data-id="${student.id}">Reset Password</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderStudentDetail() {
  const detail = state.admin.studentDetail;
  if (!detail) return `<div class="empty-state">Choose a student from the table to load full details.</div>`;
  return `
    <div class="summary-grid">
      ${detailField("Name", detail.name)}
      ${detailField("Roll No", detail.roll_no)}
      ${detailField("Email", detail.email || "N/A")}
      ${detailField("Phone", detail.phone || "N/A")}
      ${detailField("Gender", detail.gender || "N/A")}
      ${detailField("DOB", detail.date_of_birth || "N/A")}
      ${detailField("Branch", detail.branch || "N/A")}
      ${detailField("Semester", detail.semester || "N/A")}
      ${detailField("Admission Year", detail.admission_year || "N/A")}
      ${detailField("Guardian", detail.guardian_name || "N/A")}
      ${detailField("Guardian Phone", detail.guardian_phone || "N/A")}
      ${detailField("Status", detail.is_active ? "Active" : "Inactive")}
    </div>
    <div class="panel" style="margin-top:16px; padding:18px;">
      <strong>Address</strong>
      <p class="section-copy">${escapeHtml(detail.address || "No address available.")}</p>
    </div>
  `;
}

function detailField(label, value) {
  return `
    <div class="subject-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderTeacherSubjects() {
  if (!state.teacher.subjects.length) return `<div class="empty-state">No subjects assigned to this teacher yet.</div>`;
  return `
    <div class="subject-list">
      ${state.teacher.subjects.map((subject) => `
        <button class="subject-card ${String(subject.id) === String(state.teacher.selectedSubjectId) ? "pill active" : "ghost-btn"}" data-action="select-teacher-subject" data-id="${subject.id}">
          <strong>${escapeHtml(subject.name)}</strong>
          <span>${escapeHtml(subject.code)} - ${escapeHtml(subject.branch || "N/A")} - ${escapeHtml(subject.semester || "N/A")}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderAttendanceForm() {
  if (!state.teacher.selectedSubjectId) {
    return `<div class="empty-state">Choose a subject first.</div>`;
  }
  if (!state.teacher.students.length) {
    return `<div class="empty-state">No students were returned for this subject's branch and semester.</div>`;
  }
  const recordsMap = new Map(state.teacher.records.map((record) => [record.student_id, record.status]));
  return `
    <form id="attendance-form">
      <div class="attendance-grid">
        ${state.teacher.students.map((student) => `
          <div class="attendance-row">
            <div>
              <strong>${escapeHtml(student.name)}</strong><br>
              <span class="muted mono">${escapeHtml(student.roll_no)}</span>
            </div>
            <div>${getStatusBadge(recordsMap.get(student.id) || "pending")}</div>
            <select name="student-${student.id}" data-student-id="${student.id}">
              <option value="present" ${(recordsMap.get(student.id) || "present") === "present" ? "selected" : ""}>Present</option>
              <option value="absent" ${recordsMap.get(student.id) === "absent" ? "selected" : ""}>Absent</option>
            </select>
          </div>
        `).join("")}
      </div>
      <div class="button-row">
        <button type="submit">Save Attendance</button>
      </div>
    </form>
  `;
}

function renderTeacherRecords() {
  if (!state.teacher.records.length) {
    return `<div class="empty-state">No attendance records found for the selected subject and date.</div>`;
  }
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Roll No</th>
            <th>Status</th>
            <th>Update</th>
          </tr>
        </thead>
        <tbody>
          ${state.teacher.records.map((record) => `
            <tr>
              <td>${escapeHtml(record.student_name)}</td>
              <td class="mono">${escapeHtml(record.roll_no)}</td>
              <td>${getStatusBadge(record.status)}</td>
              <td>
                <div class="split">
                  <select data-record-status="${record.id}">
                    <option value="present" ${record.status === "present" ? "selected" : ""}>Present</option>
                    <option value="absent" ${record.status === "absent" ? "selected" : ""}>Absent</option>
                  </select>
                  <button class="tiny-btn secondary-btn" data-action="update-record" data-id="${record.id}">Save</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderStudentProfile(expanded = false) {
  const profile = state.student.profile;
  if (!profile) return `<div class="empty-state">No profile data available.</div>`;
  return `
    <div class="summary-grid">
      ${detailField("Name", profile.name)}
      ${detailField("Roll No", profile.roll_no)}
      ${detailField("Email", profile.email || "N/A")}
      ${detailField("Phone", profile.phone || "N/A")}
      ${detailField("Gender", profile.gender || "N/A")}
      ${detailField("Date of Birth", profile.date_of_birth || "N/A")}
      ${detailField("Branch", profile.branch || "N/A")}
      ${detailField("Semester", profile.semester || "N/A")}
      ${detailField("Admission Year", profile.admission_year || "N/A")}
      ${detailField("Guardian", profile.guardian_name || "N/A")}
      ${detailField("Guardian Phone", profile.guardian_phone || "N/A")}
    </div>
    ${expanded ? `
      <div class="panel" style="margin-top:16px; padding:18px;">
        <strong>Address</strong>
        <p class="section-copy">${escapeHtml(profile.address || "No address available.")}</p>
      </div>
    ` : ""}
  `;
}

function renderStudentSummaryCards() {
  if (!state.student.summary.length) return `<div class="empty-state">No attendance summary found yet.</div>`;
  return `
    <div class="subject-list">
      ${state.student.summary.map((item) => `
        <div class="subject-card">
          <strong>${escapeHtml(item.subject_name)}</strong>
          <span>${escapeHtml(item.subject_code)}</span>
          <p class="section-copy">${item.present} present - ${item.absent} absent - ${item.total_classes} classes</p>
          <div class="progress"><span style="width:${Math.max(0, Math.min(100, item.percentage))}%"></span></div>
          <p class="section-copy">${item.percentage}% attendance</p>
        </div>
      `).join("")}
    </div>
  `;
}

function renderStudentSummaryTable() {
  if (!state.student.summary.length) return `<div class="empty-state">No subjects available.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Subject</th>
            <th>Present</th>
            <th>Absent</th>
            <th>Total</th>
            <th>Percent</th>
          </tr>
        </thead>
        <tbody>
          ${state.student.summary.map((item) => `
            <tr>
              <td>
                <strong>${escapeHtml(item.subject_name)}</strong><br>
                <span class="muted mono">${escapeHtml(item.subject_code)}</span>
              </td>
              <td>${item.present}</td>
              <td>${item.absent}</td>
              <td>${item.total_classes}</td>
              <td>${item.percentage}%</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderStudentDetailTable() {
  if (!state.student.detail.length) return `<div class="empty-state">No detailed attendance has been recorded for this subject yet.</div>`;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${state.student.detail.map((item) => `
            <tr>
              <td>${escapeHtml(item.date)}</td>
              <td>${getStatusBadge(item.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function getEditingItem(kind) {
  if (kind === "branch") return state.admin.branches.find((item) => item.id === state.admin.editing.branchId);
  if (kind === "semester") return state.admin.semesters.find((item) => item.id === state.admin.editing.semesterId);
  if (kind === "subject") return state.admin.subjects.find((item) => item.id === state.admin.editing.subjectId);
  if (kind === "teacher") return state.admin.teachers.find((item) => item.id === state.admin.editing.teacherId);
  return null;
}

function getAdminStudentById(id) {
  return state.admin.students.find((item) => String(item.id) === String(id)) || null;
}

function bindEvents() {
  const loginForm = document.getElementById("login-form");
  if (loginForm) loginForm.addEventListener("submit", handleLogin);

  app.querySelectorAll("[data-login-role]").forEach((button) => {
    button.addEventListener("click", () => {
      state.loginRole = button.dataset.loginRole || "admin";
      render();
    });
  });

  app.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => setTab(button.dataset.tab));
  });

  app.querySelectorAll("[data-action='logout']").forEach((button) => {
    button.addEventListener("click", logout);
  });

  app.querySelectorAll("[data-action='refresh-role']").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        setLoading(true);
        await refreshIdentity();
        await loadRoleData();
        render();
        toast("Dashboard refreshed.", "success");
      } catch (error) {
        toast(error.message, "error");
      } finally {
        setLoading(false);
      }
    });
  });

  bindAdminEvents();
  bindTeacherEvents();
  bindStudentEvents();
}

function bindAdminEvents() {
  const branchForm = document.getElementById("branch-form");
  if (branchForm) {
    branchForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = {
        name: form.name.value.trim(),
        code: form.code.value.trim(),
      };
      await submitAdminForm({
        path: state.admin.editing.branchId ? `/api/admin/branches/${state.admin.editing.branchId}` : "/api/admin/branches",
        method: state.admin.editing.branchId ? "PUT" : "POST",
        payload,
        success: `Branch ${state.admin.editing.branchId ? "updated" : "created"} successfully.`,
        after: async () => {
          state.admin.editing.branchId = null;
          await loadAdminData();
        },
      });
    });
  }

  const semesterForm = document.getElementById("semester-form");
  if (semesterForm) {
    semesterForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = {
        name: form.name.value.trim(),
        number: Number(form.number.value),
        academic_year: form.academic_year.value.trim(),
        is_active: form.is_active.value === "true",
      };
      await submitAdminForm({
        path: state.admin.editing.semesterId ? `/api/admin/semesters/${state.admin.editing.semesterId}` : "/api/admin/semesters",
        method: state.admin.editing.semesterId ? "PUT" : "POST",
        payload,
        success: `Semester ${state.admin.editing.semesterId ? "updated" : "created"} successfully.`,
        after: async () => {
          state.admin.editing.semesterId = null;
          await loadAdminData();
        },
      });
    });
  }

  const subjectForm = document.getElementById("subject-form");
  if (subjectForm) {
    subjectForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const basePayload = {
        name: form.name.value.trim(),
        code: form.code.value.trim(),
      };
      const payload = state.admin.editing.subjectId
        ? basePayload
        : {
            ...basePayload,
            branch_id: Number(form.branch_id.value),
            semester_id: Number(form.semester_id.value),
          };
      await submitAdminForm({
        path: state.admin.editing.subjectId ? `/api/admin/subjects/${state.admin.editing.subjectId}` : "/api/admin/subjects",
        method: state.admin.editing.subjectId ? "PUT" : "POST",
        payload,
        success: `Subject ${state.admin.editing.subjectId ? "updated" : "created"} successfully.`,
        after: async () => {
          state.admin.editing.subjectId = null;
          await loadAdminData();
        },
      });
    });
  }

  const teacherForm = document.getElementById("teacher-form");
  if (teacherForm) {
    teacherForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = {
        name: form.name.value.trim(),
        employee_id: form.employee_id?.value?.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim() || null,
        department: form.department.value.trim() || null,
      };
      if (!state.admin.editing.teacherId) {
        payload.username = form.username.value.trim();
        payload.password = form.password.value;
      }
      await submitAdminForm({
        path: state.admin.editing.teacherId ? `/api/admin/teachers/${state.admin.editing.teacherId}` : "/api/admin/teachers",
        method: state.admin.editing.teacherId ? "PUT" : "POST",
        payload,
        success: `Teacher ${state.admin.editing.teacherId ? "updated" : "created"} successfully.`,
        after: async () => {
          state.admin.editing.teacherId = null;
          await loadAdminData();
        },
      });
    });
  }

  const importForm = document.getElementById("student-import-form");
  if (importForm) {
    importForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const file = form.file.files[0];
      if (!file) {
        toast("Please choose a CSV file first.", "error");
        return;
      }
      const body = new FormData();
      body.append("file", file);
      const semesterId = form.active_semester_id.value;
      const suffix = semesterId ? `?active_semester_id=${semesterId}` : "";
      try {
        setLoading(true);
        const result = await api(`/api/admin/students/import-csv${suffix}`, {
          method: "POST",
          body,
        });
        await refreshStudents();
        render();
        const errorCount = result.errors?.length || 0;
        toast(`Import finished: ${result.created} created, ${result.skipped} skipped, ${errorCount} notes.`, "success");
      } catch (error) {
        toast(error.message, "error");
      } finally {
        setLoading(false);
      }
    });
  }

  const actions = {
    "edit-branch": (id) => { state.admin.editing.branchId = Number(id); render(); },
    "delete-branch": (id) => deleteResource(`/api/admin/branches/${id}`, "Branch deleted.", loadAdminData),
    "cancel-branch-edit": () => { state.admin.editing.branchId = null; render(); },
    "edit-semester": (id) => { state.admin.editing.semesterId = Number(id); render(); },
    "delete-semester": (id) => deleteResource(`/api/admin/semesters/${id}`, "Semester deleted.", loadAdminData),
    "cancel-semester-edit": () => { state.admin.editing.semesterId = null; render(); },
    "edit-subject": (id) => { state.admin.editing.subjectId = Number(id); render(); },
    "delete-subject": (id) => deleteResource(`/api/admin/subjects/${id}`, "Subject deleted.", loadAdminData),
    "cancel-subject-edit": () => { state.admin.editing.subjectId = null; render(); },
    "edit-teacher": (id) => { state.admin.editing.teacherId = Number(id); render(); },
    "delete-teacher": (id) => deleteResource(`/api/admin/teachers/${id}`, "Teacher deleted.", loadAdminData),
    "cancel-teacher-edit": () => { state.admin.editing.teacherId = null; render(); },
    "toggle-teacher": (id) => patchThenReload(`/api/admin/teachers/${id}/toggle-active`, "Teacher status updated.", loadAdminData),
    "view-student": (id) => viewStudent(id),
    "toggle-student": (id) => patchThenReload(`/api/admin/students/${id}/toggle-active`, "Student status updated.", async () => {
      await refreshStudents();
      if (state.admin.studentDetail?.id === Number(id)) {
        state.admin.studentDetail = await api(`/api/admin/students/${id}`);
      }
    }),
    "reset-student-password": async (id) => {
      const student = getAdminStudentById(id);
      const tempPassword = student?.roll_no || "the student's roll number";
      const proceed = window.confirm(`Reset this student's password to ${tempPassword}?`);
      if (!proceed) return;

      await runSafely(async () => {
        const result = await api(`/api/admin/students/${id}/reset-password`, { method: "PATCH" });
        if (state.admin.studentDetail?.id === Number(id)) {
          state.admin.studentDetail = await api(`/api/admin/students/${id}`);
        }
        render();
        toast(result?.message || `Password reset. Temporary password: ${tempPassword}`, "success");
      });
    },
    "apply-student-filters": async () => {
      state.admin.filters.branch_id = document.getElementById("student-branch-filter").value;
      state.admin.filters.semester_id = document.getElementById("student-semester-filter").value;
      await runSafely(async () => {
        await refreshStudents();
        render();
        toast("Student filters applied.", "success");
      });
    },
    "assign-teacher": async (id) => {
      const select = document.querySelector(`[data-assign-subject="${id}"]`);
      const teacherId = select?.value;
      if (!teacherId) {
        toast("The backend only supports assigning a teacher, not clearing the assignment.", "info");
        return;
      }
      await submitAdminForm({
        path: `/api/admin/subjects/${id}/assign-teacher`,
        method: "PATCH",
        payload: { teacher_id: Number(teacherId) },
        success: "Teacher assigned to subject.",
        after: loadAdminData,
      });
    },
  };

  app.querySelectorAll("[data-action]").forEach((element) => {
    const action = element.dataset.action;
    if (actions[action]) {
      element.addEventListener("click", () => actions[action](element.dataset.id || element.dataset.date));
    }
  });
}

function bindTeacherEvents() {
  const contextForm = document.getElementById("teacher-context-form");
  if (contextForm) {
    contextForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      await runSafely(async () => {
        await loadTeacherSubjectData(form.subject_id.value, form.date.value);
        render();
        toast("Class loaded.", "success");
      });
    });
  }

  const historyForm = document.getElementById("teacher-history-form");
  if (historyForm) {
    historyForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      await runSafely(async () => {
        await loadTeacherSubjectData(form.subject_id.value, form.date.value);
        render();
        toast("Attendance history loaded.", "success");
      });
    });
  }

  const attendanceForm = document.getElementById("attendance-form");
  if (attendanceForm) {
    attendanceForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const entries = Array.from(attendanceForm.querySelectorAll("[data-student-id]")).map((select) => ({
        student_id: Number(select.dataset.studentId),
        status: select.value,
      }));
      await runSafely(async () => {
        await api("/api/teacher/attendance", {
          method: "POST",
          body: {
            subject_id: Number(state.teacher.selectedSubjectId),
            date: state.teacher.selectedDate,
            entries,
          },
        });
        await loadTeacherSubjectData(state.teacher.selectedSubjectId, state.teacher.selectedDate);
        render();
        toast("Attendance saved.", "success");
      });
    });
  }

  const actions = {
    "select-teacher-subject": async (id) => {
      await runSafely(async () => {
        await loadTeacherSubjectData(id, state.teacher.selectedDate);
        render();
      });
    },
    "update-record": async (id) => {
      const select = document.querySelector(`[data-record-status="${id}"]`);
      await runSafely(async () => {
        await api(`/api/teacher/attendance/record/${id}`, {
          method: "PATCH",
          body: { status: select.value },
        });
        await loadTeacherSubjectData(state.teacher.selectedSubjectId, state.teacher.selectedDate);
        render();
        toast("Attendance record updated.", "success");
      });
    },
  };

  app.querySelectorAll("[data-action]").forEach((element) => {
    const action = element.dataset.action;
    if (actions[action]) {
      element.addEventListener("click", () => actions[action](element.dataset.id || element.dataset.date));
    }
  });
}

function bindStudentEvents() {
  const select = document.getElementById("student-detail-subject");
  if (select) {
    select.addEventListener("change", async () => {
      state.student.detailSubjectId = select.value;
      await runSafely(async () => {
        state.student.detail = await api(`/api/student/attendance/${state.student.detailSubjectId}`);
        render();
      });
    });
  }
}

async function submitAdminForm({ path, method, payload, success, after }) {
  await runSafely(async () => {
    await api(path, { method, body: payload });
    if (after) await after();
    render();
    toast(success, "success");
  });
}

async function deleteResource(path, success, after) {
  const proceed = window.confirm("This will remove the item from your backend. Continue?");
  if (!proceed) return;
  await runSafely(async () => {
    await api(path, { method: "DELETE" });
    if (after) await after();
    render();
    toast(success, "success");
  });
}

async function patchThenReload(path, success, after) {
  await runSafely(async () => {
    await api(path, { method: "PATCH" });
    if (after) await after();
    render();
    toast(success, "success");
  });
}

async function viewStudent(id) {
  await runSafely(async () => {
    state.admin.studentDetail = await api(`/api/admin/students/${id}`);
    render();
  });
}

async function runSafely(work) {
  try {
    setLoading(true);
    await work();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    setLoading(false);
  }
}

initialize();
