import { handleEmailAction } from "../auth.js";

const params = new URLSearchParams(location.search);
const mode = params.get("mode");
const oobCode = params.get("oobCode");
const status = document.getElementById("actionStatus");
const form = document.getElementById("newPasswordForm");

async function run() {
    if (!mode || !oobCode) {
        status.textContent = "This link is missing information. Request a new email from the login page.";
        return;
    }
    try {
        const result = await handleEmailAction(mode, oobCode);
        if (result === "code-ok") {
            status.textContent = "Choose a new password for your School Portal account.";
            form.classList.remove("d-none");
            return;
        }
        status.textContent = result;
    } catch (err) {
        status.textContent = err.message || "This link is invalid or has expired.";
    }
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
        const msg = await handleEmailAction(mode, oobCode, document.getElementById("newPassword").value);
        form.classList.add("d-none");
        status.textContent = msg;
    } catch (err) {
        status.textContent = err.message;
    }
});

document.querySelectorAll(".toggle-password-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-target");
        const input = document.getElementById(targetId);
        if (!input) return;
        const icon = btn.querySelector("i");
        if (input.type === "password") {
            input.type = "text";
            if (icon) {
                icon.classList.remove("bi-eye");
                icon.classList.add("bi-eye-slash");
            }
            btn.setAttribute("title", "Hide Password");
        } else {
            input.type = "password";
            if (icon) {
                icon.classList.remove("bi-eye-slash");
                icon.classList.add("bi-eye");
            }
            btn.setAttribute("title", "Show Password");
        }
    });
});

run();

