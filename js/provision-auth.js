import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail,
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { db, provisionAuth } from "./firebase-config.js";
import { COL } from "./collections.js";

export function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

export function generatePassword(length = 10) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const bytes = new Uint32Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (n) => chars[n % chars.length]).join("");
}

export function slugName(name) {
    return String(name || "user")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "")
        .slice(0, 24) || "user";
}

export function studentCodeFromRef(refCode) {
    const raw = String(refCode || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (raw.length >= 6) return raw.slice(0, 10);
    const n = Math.floor(10000 + Math.random() * 90000);
    return `OLS${n}`;
}

export function institutionalStudentEmail(input, yearBatch = "", suffix = "") {
    let firstName = "";
    let batch = yearBatch;
    let sfx = suffix;

    if (typeof input === "object" && input !== null) {
        firstName = input.firstName || input.fullName || "";
        batch = input.yearBatch || yearBatch;
        sfx = input.suffix || suffix;
    } else {
        firstName = String(input || "");
    }

    const cleanFirst = firstName.trim().split(/\s+/)[0];
    const namePart = slugName(cleanFirst).replace(/[^a-z0-9]/g, "") || "student";
    const yearMatch = String(batch || "").match(/\d{4}/);
    const yearPart = yearMatch ? yearMatch[0] : new Date().getFullYear();
    const suffixPart = sfx ? `.${sfx}` : "";
    return `${namePart}${yearPart}${suffixPart}@students.olistar.edu.gh`;
}

export function institutionalStaffEmail(fullName, extra = "") {
    const base = slugName(fullName);
    const suffix = extra ? `.${extra}` : "";
    return `${base}${suffix}@staff.olistar.edu.gh`;
}

export async function createAuthAccount({ contactEmail, password, displayName }) {
    const cred = await createUserWithEmailAndPassword(provisionAuth, contactEmail.trim(), password);
    if (displayName) {
        await updateProfile(cred.user, { displayName });
    }
    const uid = cred.user.uid;
    await signOut(provisionAuth);
    return uid;
}

export async function writeUserProfile(uid, data) {
    await setDoc(doc(db, COL.users, uid), {
        ...data,
        institutionalEmail: String(data.institutionalEmail || "").toLowerCase(),
        contactEmail: String(data.contactEmail || "").toLowerCase(),
        createdAt: serverTimestamp()
    });
}

export function portalActionUrl() {
    return new URL("auth-action.html", location.href).href;
}

export function portalLoginUrl() {
    return new URL("login.html", location.href).href;
}

export async function sendVerificationToUser(user) {
    const url = portalActionUrl();
    await sendEmailVerification(user, { url, handleCodeInApp: false });
}

export async function sendResetToContactEmail(contactEmail) {
    const url = portalActionUrl();
    await sendPasswordResetEmail(provisionAuth, contactEmail.trim(), { url });
}

export function showCredentialsSlip({
    title = "Account credentials",
    name,
    role,
    studentCode,
    institutionalEmail,
    contactEmail,
    password
}) {
    const existing = document.getElementById("credentialsSlipModal");
    if (existing) existing.remove();

    const html = `
    <div class="modal fade" id="credentialsSlipModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content rounded-0">
          <div class="modal-header bg-dark text-warning rounded-0">
            <h5 class="modal-title font-serif">${escapeHtml(title)}</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p class="small text-muted">Give this slip to the user. The password is shown once and is not stored.</p>
            <table class="table table-sm">
              <tr><th>Name</th><td>${escapeHtml(name)}</td></tr>
              <tr><th>Role</th><td>${escapeHtml(role)}</td></tr>
              ${studentCode ? `<tr><th>Student code</th><td class="font-monospace">${escapeHtml(studentCode)}</td></tr>` : ""}
              <tr><th>Login ID</th><td class="font-monospace">${escapeHtml(institutionalEmail)}</td></tr>
              <tr><th>Temporary password</th><td class="font-monospace fw-bold">${escapeHtml(password)}</td></tr>
              <tr><th>Verification mail goes to</th><td>${escapeHtml(contactEmail)}</td></tr>
            </table>
            <p class="small mb-0">They must verify the contact inbox, then sign in at <span class="font-monospace">${escapeHtml(portalLoginUrl())}</span>.</p>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-dark rounded-0" id="copyCredsBtn">Copy</button>
            <button type="button" class="btn btn-dark rounded-0" data-bs-dismiss="modal">Done</button>
          </div>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML("beforeend", html);
    const text = [
        title, name, role,
        studentCode ? `Code: ${studentCode}` : "",
        `Login ID: ${institutionalEmail}`,
        `Password: ${password}`,
        `Verification: ${contactEmail}`
    ].filter(Boolean).join("\n");
    document.getElementById("copyCredsBtn")?.addEventListener("click", async () => {
        await navigator.clipboard.writeText(text);
        document.getElementById("copyCredsBtn").textContent = "Copied";
    });
    const modal = new bootstrap.Modal(document.getElementById("credentialsSlipModal"));
    modal.show();
    return { institutionalEmail, password, contactEmail };
}
