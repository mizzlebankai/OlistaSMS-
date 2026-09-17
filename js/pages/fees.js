import { requireSession } from "../auth.js";
import { mountShell } from "../app-shell.js";
import { addRow, patchRow, listenAll, boardingLabel } from "../store.js";
import { escapeHtml } from "../provision-auth.js";
import { deleteAdminRecord } from "../admin-delete.js";

const { profile, role } = await requireSession({ roles: ["admin", "student"] });
mountShell(profile, { title: "Fees & billing", active: "fees.html" });

let students = [];
let fees = [];
let selectedFeeForInvoice = null;

if (role === "student") {
    document.getElementById("feeFormCard")?.classList.add("d-none");
}

function recalculateTotal() {
    let total = 0;

    // 1. Tuition (required)
    const tuitionVal = parseFloat(document.getElementById("feeTuition")?.value) || 0;
    total += tuitionVal;

    // 2. Books
    if (document.getElementById("checkBooks")?.checked) {
        total += parseFloat(document.getElementById("feeBooks")?.value) || 0;
    }

    // 3. Feeding
    if (document.getElementById("checkFeeding")?.checked) {
        total += parseFloat(document.getElementById("feeFeeding")?.value) || 0;
    }

    // 4. Bus
    if (document.getElementById("checkBus")?.checked) {
        total += parseFloat(document.getElementById("feeBus")?.value) || 0;
    }

    // 5. Hostel
    if (document.getElementById("checkHostel")?.checked) {
        total += parseFloat(document.getElementById("feeHostel")?.value) || 0;
    }

    // 6. Extra
    if (document.getElementById("checkExtra")?.checked) {
        total += parseFloat(document.getElementById("feeExtra")?.value) || 0;
    }

    const feeDueInput = document.getElementById("feeDue");
    if (feeDueInput) feeDueInput.value = total.toFixed(2);

    const badge = document.getElementById("totalDueBadge");
    if (badge) badge.textContent = `Total Due: GHS ${total.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function syncStudentBoardingDefaults() {
    const studentId = document.getElementById("feeStudent")?.value;
    const student = students.find((s) => s.id === studentId);
    const hint = document.getElementById("studentBoardingHint");
    const checkHostel = document.getElementById("checkHostel");
    const checkBus = document.getElementById("checkBus");

    if (!student) {
        if (hint) hint.textContent = "";
        return;
    }

    const isBoarding = student.boardingStatus === "boarding";
    if (hint) {
        hint.innerHTML = isBoarding
            ? `<span class="badge badge-boarding">Boarding Student</span> <span class="text-muted">Hostel included, bus opted out by default.</span>`
            : `<span class="badge badge-day">Day Student</span> <span class="text-muted">Hostel opted out by default.</span>`;
    }

    if (checkHostel) checkHostel.checked = isBoarding;
    if (checkBus) checkBus.checked = !isBoarding;

    recalculateTotal();
}

// Setup input and checkbox listeners for real-time recalculation
document.querySelectorAll(".fee-checkbox, .fee-amount").forEach((el) => {
    el.addEventListener("input", recalculateTotal);
    el.addEventListener("change", recalculateTotal);
});

document.getElementById("feeStudent")?.addEventListener("change", syncStudentBoardingDefaults);

listenAll("students", (rows) => {
    students = rows;
    const sel = document.getElementById("feeStudent");
    if (sel) {
        sel.innerHTML = `<option value="" disabled selected>-- Select a student --</option>` +
            rows.map((s) => `<option value="${s.id}">${escapeHtml(s.fullName)} (${escapeHtml(s.studentCode || "")})</option>`).join("");
    }
    paint();
});

listenAll("fees", (rows) => {
    fees = rows;
    paint();
});

function getFeeBreakdownItems(f) {
    if (f.feeBreakdown && Array.isArray(f.feeBreakdown.items)) {
        return f.feeBreakdown.items;
    }
    // Fallback for legacy single-amount records
    return [{ label: "Academic Term Fee", amount: f.amountDue, optedIn: true }];
}

function paint() {
    const visible = role === "student" ? fees.filter((f) => f.studentId === profile.studentId) : fees;

    // Update summary stats
    const totalDueSum = visible.reduce((acc, f) => acc + (Number(f.amountDue) || 0), 0);
    const totalPaidSum = visible.reduce((acc, f) => acc + (Number(f.amountPaid) || 0), 0);
    const outstandingSum = Math.max(0, totalDueSum - totalPaidSum);
    const statsEl = document.getElementById("feeStats");
    if (statsEl) {
        statsEl.innerHTML = `Total Billed: <strong>GHS ${totalDueSum.toFixed(2)}</strong> | Collected: <strong class="text-success">GHS ${totalPaidSum.toFixed(2)}</strong> | Outstanding: <strong class="text-danger">GHS ${outstandingSum.toFixed(2)}</strong>`;
    }

    document.getElementById("feeBody").innerHTML = visible.map((f) => {
        const student = students.find((s) => s.id === f.studentId);
        const studentName = student?.fullName || f.studentId;
        const due = Number(f.amountDue) || 0;
        const paid = Number(f.amountPaid) || 0;
        const balance = Math.max(0, due - paid);

        let statusBadge = "";
        if (paid >= due && due > 0) {
            statusBadge = `<span class="badge bg-success">Paid in Full</span>`;
        } else if (paid > 0) {
            statusBadge = `<span class="badge bg-warning text-dark">Partially Paid</span>`;
        } else {
            statusBadge = `<span class="badge bg-danger">Unpaid</span>`;
        }

        const items = getFeeBreakdownItems(f);
        const includedLabels = items.filter((it) => it.optedIn).map((it) =>
            `<span class="badge bg-light text-dark border me-1">${escapeHtml(it.label)}</span>`
        ).join("");

        return `
            <tr>
                <td>
                    <strong>${escapeHtml(studentName)}</strong>
                    <div class="small text-muted font-monospace">${escapeHtml(student?.studentCode || "")}</div>
                </td>
                <td>
                    <div>${escapeHtml(f.term || "Term 1")}</div>
                    <div class="small text-muted">${escapeHtml(f.yearBatch || "2026/2027")}</div>
                </td>
                <td class="fw-bold">GHS ${due.toFixed(2)}</td>
                <td class="text-success">GHS ${paid.toFixed(2)}</td>
                <td class="fw-bold ${balance > 0 ? "text-danger" : "text-muted"}">GHS ${balance.toFixed(2)}</td>
                <td>${includedLabels || `<span class="text-muted small">Standard Tuition</span>`}</td>
                <td>${statusBadge}</td>
                <td class="text-end text-nowrap">
                    <button class="btn btn-sm btn-outline-dark rounded-0 breakdown-btn me-1" data-id="${f.id}">
                        <i class="bi bi-receipt"></i> Invoice
                    </button>
                    ${role === "admin" && balance > 0 ? `
                        <button class="btn btn-sm btn-crimson rounded-0 pay-btn" data-id="${f.id}">
                            <i class="bi bi-cash"></i> Pay
                        </button>
                    ` : ""}
                    ${role === "admin" ? `<button class="btn btn-sm btn-outline-danger rounded-0 delete-record-btn ms-1" data-id="${f.id}"><i class="bi bi-trash"></i></button>` : ""}
                </td>
            </tr>
        `;
    }).join("") || `<tr><td colspan="8" class="text-muted text-center py-4">No fee records found.</td></tr>`;
}

document.getElementById("feeBody").addEventListener("click", async (e) => {
    const btn = e.target.closest(".delete-record-btn");
    if (!btn || role !== "admin") return;
    const fee = fees.find((f) => f.id === btn.dataset.id);
    await deleteAdminRecord({ button: btn, collection: "fees", id: fee?.id, label: `fee invoice for ${students.find((s) => s.id === fee?.studentId)?.fullName || "this student"}` });
});

// Form submit: Issue new itemized fee bill
document.getElementById("feeForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const studentId = document.getElementById("feeStudent").value;
    if (!studentId) {
        alert("Please select a student.");
        return;
    }

    const saveBtn = document.getElementById("saveFeeBtn");
    const feeAlert = document.getElementById("feeAlert");
    saveBtn.disabled = true;
    saveBtn.textContent = "Issuing bill...";

    try {
        const student = students.find((s) => s.id === studentId);
        const term = document.getElementById("feeTerm").value.trim();
        const yearBatch = document.getElementById("feeYearBatch").value.trim() || "2026/2027";
        const dueDate = document.getElementById("feeDueDate").value;
        const initialPaid = parseFloat(document.getElementById("feePaid").value) || 0;
        const paymentMethod = document.getElementById("feePaymentMethod").value;

        // Collect itemized fee breakdown
        const items = [
            {
                key: "tuition",
                label: "Academic Tuition",
                amount: parseFloat(document.getElementById("feeTuition").value) || 0,
                optedIn: true
            },
            {
                key: "books",
                label: "Books & Stationery",
                amount: parseFloat(document.getElementById("feeBooks").value) || 0,
                optedIn: document.getElementById("checkBooks").checked
            },
            {
                key: "feeding",
                label: "Feeding Fee (Meals)",
                amount: parseFloat(document.getElementById("feeFeeding").value) || 0,
                optedIn: document.getElementById("checkFeeding").checked
            },
            {
                key: "bus",
                label: "School Bus / Transportation",
                amount: parseFloat(document.getElementById("feeBus").value) || 0,
                optedIn: document.getElementById("checkBus").checked
            },
            {
                key: "hostel",
                label: "Hostel / Boarding Accommodation",
                amount: parseFloat(document.getElementById("feeHostel").value) || 0,
                optedIn: document.getElementById("checkHostel").checked
            },
            {
                key: "extra",
                label: document.getElementById("feeExtraLabel").value.trim() || "Extra / Activities",
                amount: parseFloat(document.getElementById("feeExtra").value) || 0,
                optedIn: document.getElementById("checkExtra").checked
            }
        ];

        const totalDue = items.filter((it) => it.optedIn).reduce((sum, it) => sum + it.amount, 0);
        let status = "unpaid";
        if (initialPaid >= totalDue && totalDue > 0) {
            status = "paid";
        } else if (initialPaid > 0) {
            status = "partial";
        }

        await addRow("fees", {
            studentId,
            studentName: student?.fullName || "",
            studentCode: student?.studentCode || "",
            classId: student?.classId || "",
            term,
            yearBatch,
            amountDue: totalDue,
            amountPaid: initialPaid,
            dueDate: dueDate || "",
            status,
            feeBreakdown: {
                items,
                issuedAt: new Date().toISOString(),
                paymentMethod,
                initialPayment: initialPaid
            }
        });

        if (feeAlert) {
            feeAlert.className = "alert alert-success rounded-0";
            feeAlert.textContent = `Fee bill for ${student?.fullName || "Student"} issued successfully (Total: GHS ${totalDue.toFixed(2)}).`;
            feeAlert.classList.remove("d-none");
            setTimeout(() => feeAlert.classList.add("d-none"), 5000);
        }

        document.getElementById("feePaid").value = 0;
    } catch (err) {
        if (feeAlert) {
            feeAlert.className = "alert alert-danger rounded-0";
            feeAlert.textContent = err.message || "Failed to issue fee bill.";
            feeAlert.classList.remove("d-none");
        }
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="bi bi-receipt me-1"></i> Save &amp; Issue Bill`;
    }
});

// View breakdown modal handling
document.getElementById("feeBody").addEventListener("click", (e) => {
    const breakdownBtn = e.target.closest(".breakdown-btn");
    const payBtn = e.target.closest(".pay-btn");

    if (breakdownBtn) {
        const fee = fees.find((f) => f.id === breakdownBtn.dataset.id);
        if (!fee) return;
        selectedFeeForInvoice = fee;
        renderInvoiceModal(fee);
        const modalEl = document.getElementById("feeBreakdownModal");
        if (modalEl && window.bootstrap?.Modal) {
            window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
        }
    }

    if (payBtn) {
        const fee = fees.find((f) => f.id === payBtn.dataset.id);
        if (!fee) return;
        const student = students.find((s) => s.id === fee.studentId);
        const due = Number(fee.amountDue) || 0;
        const paid = Number(fee.amountPaid) || 0;
        const balance = Math.max(0, due - paid);

        document.getElementById("payFeeId").value = fee.id;
        document.getElementById("payStudentName").textContent = student?.fullName || fee.studentName || "Student";
        document.getElementById("payTerm").textContent = `${fee.term} (${fee.yearBatch || "2026/2027"})`;
        document.getElementById("payBalance").textContent = `GHS ${balance.toFixed(2)}`;
        document.getElementById("payAmount").value = balance.toFixed(2);
        document.getElementById("payAmount").max = balance;
        document.getElementById("paymentAlert").classList.add("d-none");

        const payModalEl = document.getElementById("paymentModal");
        if (payModalEl && window.bootstrap?.Modal) {
            window.bootstrap.Modal.getOrCreateInstance(payModalEl).show();
        }
    }
});

function renderInvoiceModal(fee) {
    const student = students.find((s) => s.id === fee.studentId);
    const items = getFeeBreakdownItems(fee);
    const due = Number(fee.amountDue) || 0;
    const paid = Number(fee.amountPaid) || 0;
    const balance = Math.max(0, due - paid);

    const rowsHtml = items.map((it) => `
        <tr>
            <td>
                <strong>${escapeHtml(it.label)}</strong>
            </td>
            <td class="text-center">
                ${it.optedIn 
                    ? `<span class="badge bg-success">Included</span>` 
                    : `<span class="badge bg-light text-muted border">Opted Out</span>`
                }
            </td>
            <td class="text-end fw-semibold">
                ${it.optedIn ? `GHS ${Number(it.amount || 0).toFixed(2)}` : `<span class="text-muted">---</span>`}
            </td>
        </tr>
    `).join("");

    document.getElementById("breakdownModalBody").innerHTML = `
        <div class="text-center pb-3 border-bottom mb-3">
            <h4 class="font-serif fw-bold mb-1 sms-brand">OLISTAR SCHOOL</h4>
            <div class="small text-muted">Sunyani Abesim · Ghana · Official Fee Invoice</div>
        </div>
        <div class="row g-2 small mb-3">
            <div class="col-6"><strong>Student:</strong> ${escapeHtml(student?.fullName || fee.studentName || "N/A")}</div>
            <div class="col-6"><strong>Student Code:</strong> <span class="font-monospace">${escapeHtml(student?.studentCode || "N/A")}</span></div>
            <div class="col-6"><strong>Term:</strong> ${escapeHtml(fee.term || "Term 1")} (${escapeHtml(fee.yearBatch || "2026/2027")})</div>
            <div class="col-6"><strong>Boarding Status:</strong> ${escapeHtml(boardingLabel(student?.boardingStatus || "day"))}</div>
            <div class="col-6"><strong>Due Date:</strong> ${escapeHtml(fee.dueDate || "Upon Receipt")}</div>
            <div class="col-6"><strong>Bill ID:</strong> <span class="font-monospace small text-muted">${escapeHtml(fee.id)}</span></div>
        </div>
        <table class="table table-sm align-middle mb-3">
            <thead class="table-light">
                <tr>
                    <th>Fee Component</th>
                    <th class="text-center">Status</th>
                    <th class="text-end">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${rowsHtml}
            </tbody>
            <tfoot class="border-top-2">
                <tr>
                    <th colspan="2" class="text-end">Total Amount Due:</th>
                    <th class="text-end fs-6 text-crimson">GHS ${due.toFixed(2)}</th>
                </tr>
                <tr>
                    <th colspan="2" class="text-end text-success">Total Amount Paid:</th>
                    <th class="text-end text-success">GHS ${paid.toFixed(2)}</th>
                </tr>
                <tr class="table-light">
                    <th colspan="2" class="text-end">Outstanding Balance:</th>
                    <th class="text-end ${balance > 0 ? "text-danger fw-bold" : "text-muted"}">GHS ${balance.toFixed(2)}</th>
                </tr>
            </tfoot>
        </table>
    `;
}

// Print invoice logic
document.getElementById("printInvoiceBtn")?.addEventListener("click", () => {
    if (!selectedFeeForInvoice) return;
    const content = document.getElementById("breakdownModalBody")?.innerHTML;
    const printWin = window.open("", "_blank", "width=800,height=900");
    if (!printWin) {
        alert("Allow pop-ups to print the fee invoice.");
        return;
    }
    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Fee Invoice - ${selectedFeeForInvoice.studentCode || ""}</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { font-family: Georgia, serif; padding: 40px; color: #111; }
                .sms-brand { color: #900C3F; }
                @media print { .no-print { display: none; } }
            </style>
        </head>
        <body onload="window.print()">
            <div class="no-print mb-4"><button onclick="window.print()" class="btn btn-dark">Print Invoice</button></div>
            ${content}
            <div class="mt-5 pt-4 border-top text-center text-muted small">
                Thank you for being part of Olistar School. Good Foundation, Firm Building.
            </div>
        </body>
        </html>
    `);
    printWin.document.close();
});

// Record Payment submit handler
document.getElementById("recordPaymentForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const feeId = document.getElementById("payFeeId").value;
    const addAmount = parseFloat(document.getElementById("payAmount").value) || 0;
    const alertEl = document.getElementById("paymentAlert");
    const submitBtn = document.getElementById("recordPaySubmitBtn");

    if (addAmount <= 0) {
        alert("Please enter a valid payment amount.");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Processing...";

    try {
        const fee = fees.find((f) => f.id === feeId);
        if (!fee) throw new Error("Fee record not found.");

        const currentPaid = Number(fee.amountPaid) || 0;
        const totalDue = Number(fee.amountDue) || 0;
        const newPaid = currentPaid + addAmount;
        let newStatus = "unpaid";
        if (newPaid >= totalDue) {
            newStatus = "paid";
        } else if (newPaid > 0) {
            newStatus = "partial";
        }

        await patchRow("fees", feeId, {
            amountPaid: newPaid,
            status: newStatus,
            lastPaymentAt: new Date().toISOString()
        });

        const payModalEl = document.getElementById("paymentModal");
        if (payModalEl && window.bootstrap?.Modal) {
            window.bootstrap.Modal.getOrCreateInstance(payModalEl).hide();
        }
    } catch (err) {
        if (alertEl) {
            alertEl.className = "alert alert-danger rounded-0";
            alertEl.textContent = err.message || "Failed to record payment.";
            alertEl.classList.remove("d-none");
        }
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Confirm Payment";
    }
});

// Initialize on page load
recalculateTotal();

