import { sendResetToContactEmail } from "../provision-auth.js";
import { resolveProfileForLogin } from "../auth.js";
import { isAdminEmail } from "../collections.js";

const form = document.getElementById("resetForm");
const alertBox = document.getElementById("resetAlert");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const identifier = document.getElementById("resetEmail").value.trim().toLowerCase();
    if (!identifier) return;

    try {
        if (isAdminEmail(identifier)) {
            throw new Error("Administrators reset passwords from the Firebase console.");
        }

        const isInstitutional = identifier.endsWith("@students.olistar.edu.gh") ||
                                identifier.endsWith("@student.olistar.edu.gh") ||
                                identifier.endsWith("@staff.olistar.edu.gh");

        let contactEmail = "";
        if (!isInstitutional && identifier.includes("@")) {
            contactEmail = identifier;
        } else {
            const profile = await resolveProfileForLogin(identifier);
            if (!profile || !profile.authEmail) {
                throw new Error("No student or staff account found for that login ID.");
            }
            if (profile.role === "admin") {
                throw new Error("Administrators reset passwords from the Firebase console.");
            }
            contactEmail = profile.authEmail;
        }

        await sendResetToContactEmail(contactEmail);
        window.location.replace("login.html?reset=1");
    } catch (err) {
        alertBox.className = "alert alert-danger rounded-0";
        alertBox.textContent = err.message;
        alertBox.classList.remove("d-none");
    }
});
