import { logout } from "./auth.js";

const PUBLIC_SITE_URL = "https://olistaredu.netlify.app/";

document.documentElement.classList.add("sms-loading");

const NAV = [
    { href: "dashboard.html", icon: "bi-speedometer2", label: "Dashboard", roles: ["admin", "teacher", "staff", "student"] },
    { href: "admissions.html", icon: "bi-inbox", label: "Admissions", roles: ["admin"] },
    { href: "students.html", icon: "bi-people", label: "Students", roles: ["admin", "teacher"] },
    { href: "teachers.html", icon: "bi-person-badge", label: "Teachers & Staff", roles: ["admin"] },
    { href: "classes.html", icon: "bi-building", label: "Classes", roles: ["admin"] },
    { href: "attendance.html", icon: "bi-calendar-check", label: "Attendance", roles: ["admin", "teacher", "student"] },
    { href: "grades.html", icon: "bi-journal-text", label: "Grades", roles: ["admin", "teacher", "student"] },
    { href: "fees.html", icon: "bi-cash-stack", label: "Fees", roles: ["admin", "student"] },
    { href: "timetable.html", icon: "bi-clock-history", label: "Timetable", roles: ["admin", "teacher", "staff", "student"] },
    { href: "announcements.html", icon: "bi-megaphone", label: "Notices", roles: ["admin", "teacher", "staff", "student"] }
];

export function mountShell(profile, { title = "Portal", active } = {}) {
    const page = active || location.pathname.split("/").pop();
    const links = NAV.filter((item) => item.roles.includes(profile.role))
        .map((item) => `
            <a href="${item.href}" class="${item.href === page ? "active" : ""}">
                <i class="bi ${item.icon}"></i> ${item.label}
            </a>
        `).join("");

    const shell = document.getElementById("sms-shell");
    const content = shell.innerHTML;
    shell.innerHTML = `
        <div class="d-lg-flex sms-shell">
            <aside class="sms-sidebar p-3">
                <div class="d-flex align-items-center gap-2 mb-4 text-white">
                    <img src="assets/logo.png" alt="Olistar" height="40"
                         onerror="this.src='https://placehold.co/80x80/900C3F/ffffff?text=OS'">
                    <div>
                        <div class="fw-bold font-serif">OLISTAR</div>
                        <div class="small text-warning">School Portal</div>
                    </div>
                </div>
                <nav class="sms-desktop-nav d-flex flex-column">${links}</nav>
                <details class="sms-mobile-nav">
                    <summary><i class="bi bi-list me-1"></i> Menu</summary>
                    <nav class="d-flex flex-column">${links}</nav>
                </details>
                <div class="mt-4 pt-3 border-top border-secondary">
                    <a href="${PUBLIC_SITE_URL}" class="d-flex align-items-center gap-2 text-white-50 text-decoration-none small py-1" target="_blank" rel="noopener">
                        <i class="bi bi-box-arrow-up-right"></i> Public Website
                    </a>
                </div>
            </aside>
            <div class="flex-grow-1 d-flex flex-column">
                <header class="sms-topbar px-4 py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div>
                        <div class="text-uppercase small text-muted fw-bold">${profile.role}</div>
                        <h1 class="h4 mb-0 font-serif">${title}</h1>
                    </div>
                    <div class="d-flex align-items-center gap-3">
                        <span class="small text-muted">${profile.name || profile.contactEmail || ""}</span>
                        <button class="btn btn-sm btn-outline-dark rounded-0" id="smsLogout" type="button">Log out</button>
                    </div>
                </header>
                <main class="p-4">${content}</main>
            </div>
        </div>
    `;
    document.getElementById("smsLogout")?.addEventListener("click", () => logout());
    document.documentElement.classList.add("sms-ready");
    document.documentElement.classList.remove("sms-loading");
    document.querySelectorAll(".sms-sidebar a[href]").forEach((link) => {
        link.addEventListener("click", () => {
            document.documentElement.classList.remove("sms-ready");
            document.documentElement.classList.add("sms-loading");
        });
    });
}
