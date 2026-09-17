/**
 * Ghanaian School Academic Grading Engine
 * Standardized according to WAEC / WASSCE (for SHS/TVET) and GES / BECE (for Basic / JHS)
 */

export function isShsOrTvet(academicTier = "", className = "") {
    const tier = String(academicTier || "").toLowerCase();
    const cls = String(className || "").toLowerCase();
    return tier.includes("senior high") ||
           tier.includes("shs") ||
           tier.includes("technical") ||
           tier.includes("tvet") ||
           cls.startsWith("shs") ||
           cls.startsWith("tvet");
}

export function computeGhanaianGrade(academicTier, {
    ca = 0,
    project = 0,
    exam = 0,
    maxCa = null,
    maxProject = null,
    maxExam = null,
    className = ""
} = {}) {
    const isShs = isShsOrTvet(academicTier, className);

    let totalScore = 0;

    if (isShs) {
        // SHS / TVET System:
        // Default: CA (max 30), Project (max 20), Exam (max 50) => Total 100
        const mCa = Number(maxCa) || 30;
        const mProj = Number(maxProject) || 20;
        const mExam = Number(maxExam) || 50;

        const normCa = mCa > 0 ? (Number(ca) / mCa) * 30 : 0;
        const normProj = mProj > 0 ? (Number(project) / mProj) * 20 : 0;
        const normExam = mExam > 0 ? (Number(exam) / mExam) * 50 : 0;

        totalScore = Math.min(100, Math.max(0, Math.round(normCa + normProj + normExam)));

        // WASSCE 9-point scale
        let grade = "F9";
        let remark = "Fail";
        let gradeValue = 9;

        if (totalScore >= 75) {
            grade = "A1"; remark = "Excellent"; gradeValue = 1;
        } else if (totalScore >= 70) {
            grade = "B2"; remark = "Very Good"; gradeValue = 2;
        } else if (totalScore >= 65) {
            grade = "B3"; remark = "Good"; gradeValue = 3;
        } else if (totalScore >= 60) {
            grade = "C4"; remark = "Credit"; gradeValue = 4;
        } else if (totalScore >= 55) {
            grade = "C5"; remark = "Credit"; gradeValue = 5;
        } else if (totalScore >= 50) {
            grade = "C6"; remark = "Credit"; gradeValue = 6;
        } else if (totalScore >= 45) {
            grade = "D7"; remark = "Pass"; gradeValue = 7;
        } else if (totalScore >= 40) {
            grade = "E8"; remark = "Pass"; gradeValue = 8;
        } else {
            grade = "F9"; remark = "Fail"; gradeValue = 9;
        }

        return {
            isShs: true,
            totalScore,
            grade,
            remark,
            gradeValue,
            systemName: "WASSCE (SHS / TVET)",
            breakdown: {
                ca: Number(ca),
                maxCa: mCa,
                project: Number(project),
                maxProject: mProj,
                exam: Number(exam),
                maxExam: mExam
            }
        };
    } else {
        // Early Grade, Primary & JHS System:
        // Default: Continuous Assessment / CA (max 50), End of Term Exam (max 50) => Total 100
        const mCa = Number(maxCa) || 50;
        const mExam = Number(maxExam) || 50;

        const normCa = mCa > 0 ? (Number(ca) / mCa) * 50 : 0;
        const normExam = mExam > 0 ? (Number(exam) / mExam) * 50 : 0;

        totalScore = Math.min(100, Math.max(0, Math.round(normCa + normExam)));

        // GES / BECE Stanine scale (1 to 9)
        let grade = "Grade 9";
        let remark = "Fail";
        let gradeValue = 9;

        if (totalScore >= 80) {
            grade = "Grade 1"; remark = "Distinction (Highest)"; gradeValue = 1;
        } else if (totalScore >= 70) {
            grade = "Grade 2"; remark = "Very Good (Higher)"; gradeValue = 2;
        } else if (totalScore >= 65) {
            grade = "Grade 3"; remark = "Good (High)"; gradeValue = 3;
        } else if (totalScore >= 60) {
            grade = "Grade 4"; remark = "Credit (Above Average)"; gradeValue = 4;
        } else if (totalScore >= 55) {
            grade = "Grade 5"; remark = "Credit (Average)"; gradeValue = 5;
        } else if (totalScore >= 50) {
            grade = "Grade 6"; remark = "Pass (Low)"; gradeValue = 6;
        } else if (totalScore >= 45) {
            grade = "Grade 7"; remark = "Pass (Lower)"; gradeValue = 7;
        } else if (totalScore >= 40) {
            grade = "Grade 8"; remark = "Pass (Lowest)"; gradeValue = 8;
        } else {
            grade = "Grade 9"; remark = "Fail"; gradeValue = 9;
        }

        return {
            isShs: false,
            totalScore,
            grade,
            remark,
            gradeValue,
            systemName: "GES / BECE Basic School",
            breakdown: {
                ca: Number(ca),
                maxCa: mCa,
                exam: Number(exam),
                maxExam: mExam
            }
        };
    }
}

