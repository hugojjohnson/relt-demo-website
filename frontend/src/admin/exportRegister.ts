import type { Student, Tutor } from "../types";

type ExportPerson = Student | Tutor;
const value = (input: unknown) => input === undefined || input === null || input === "" ? "—" : input;
const yesNo = (input: boolean) => input ? "Yes" : "No";
const availability = (person: ExportPerson["person"], day: string) => {
  const slots = person.availability?.[day];
  return Array.isArray(slots) ? slots.join(", ") : value(slots);
};

export async function exportParticipantRegister(students: Student[], tutors: Tutor[]) {
  // Load the spreadsheet writer only when an administrator exports a file.
  const XLSX = await import("xlsx-js-style");
  const columns = [
    "Unique ID", "Full Name", "Email Address", "Phone Number", "Emergency Contact Name", "Emergency Contact Phone", "Emergency Contact Relationship", "Role", "Application Date",
    "Status (code)", "Current Pairings (count)", "Student Number Capacity", "Timezone", "Availability – Monday (AEST)", "Availability – Tuesday (AEST)", "Availability – Wednesday (AEST)", "Availability – Thursday (AEST)", "Availability – Friday (AEST)", "Mode",
    "Gender", "Same-Gender Pairing Required (opt-in)", "English Level (CEFR)", "Qualitative Assessment", "National Background", "Ethnic Background", "Linguistic Background", "Religious Background", "Job / Study Category", "Current Profession or Study", "Intended Profession or Study", "Hobbies and Interests",
    "Refugee / Asylum Seeker Assessment", "Interview Conducted", "Reference Check Conducted", "WWCC Provided", "Approved to Tutor", "Pathway to the Program", "Assessor", "Matcher", "General Comments",
  ];
  const groups = [
    ["(A) BASIC INFORMATION", 9, "F16E27", "F9C7AC"], ["(B) STATUS & ENROLMENT", 3, "27AEF1", "ACE0F9"], ["(C) PAIRING – DELIVERY", 7, "A530FE", "DCB0FE"], ["(D) PAIRING – SUBSTANTIVE", 12, "2748F1", "ACB9F9"], ["(E) VETTING", 8, "F12727", "F9ACAC"], ["(F) GENERAL", 1, "1FA39B", "A9DCD9"],
  ];
  const data = [...tutors, ...students].map((profile) => {
    const person = profile.person;
    const tutor = "capacity" in profile ? profile : undefined;
    const student = "englishLevel" in profile ? profile : undefined;
    return [
      `${tutor ? "T" : "S"}-N-${profile.id.padStart(5, "0")}`, person.fullName, person.user.email, person.phoneNumber, person.emergencyContactName, person.emergencyContactPhone, person.emergencyContactRelationship, tutor ? "Tutor" : "Student", person.applicationDate ? new Date(person.applicationDate) : "",
      person.status, profile.activePairingCount, tutor?.capacity ?? "", person.timezone, availability(person, "MONDAY"), availability(person, "TUESDAY"), availability(person, "WEDNESDAY"), availability(person, "THURSDAY"), availability(person, "FRIDAY"), person.mode.replaceAll("_", " "),
      person.gender, yesNo(person.sameGenderPairingRequired), student?.englishLevel ?? "", person.qualitativeAssessment, person.nationalBackground, person.ethnicBackground, student?.linguisticBackground ?? "", person.religiousBackground, person.jobStudyCategory, person.currentProfession, student?.intendedProfession ?? "", person.hobbiesInterests,
      student?.refugeeAsylumAssessment ?? "", student?.interviewConducted?.replaceAll("_", " ") ?? "", yesNo(person.referenceCheckConducted), tutor ? yesNo(tutor.wwccProvided) : "", tutor ? yesNo(tutor.approvedToTutor) : "", person.pathwayToProgram, person.assessor, person.matcher, person.notes,
    ].map(value);
  });
  const ws = XLSX.utils.aoa_to_sheet([groups.flatMap(([title, count]) => [title, ...Array(Number(count) - 1).fill("")]), columns, ...data]);
  const groupStyle = (colour: string) => ({ fill: { fgColor: { rgb: colour } }, font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" } });
  let col = 0;
  groups.forEach(([title, count, colour, headerColour]) => {
    const groupStart = col;
    const first = XLSX.utils.encode_cell({ r: 0, c: groupStart });
    ws[first].s = groupStyle(String(colour));
    for (let i = 1; i < Number(count); i++) ws[XLSX.utils.encode_cell({ r: 0, c: groupStart + i })].s = groupStyle(String(colour));
    for (let i = 0; i < Number(count); i++) ws[XLSX.utils.encode_cell({ r: 1, c: groupStart + i })].s = { fill: { fgColor: { rgb: String(headerColour) } }, font: { bold: true }, alignment: { wrapText: true, vertical: "center" } };
    ws["!merges"] = [...(ws["!merges"] || []), { s: { r: 0, c: groupStart }, e: { r: 0, c: groupStart + Number(count) - 1 } }];
    col += Number(count);
  });
  ws["!cols"] = columns.map((heading, index) => ({ wch: index === 1 ? 24 : heading.length > 28 ? 25 : 17 }));
  ws["!rows"] = [{ hpt: 24 }, { hpt: 44 }];
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 1, c: 0 }, e: { r: Math.max(2, data.length + 1), c: columns.length - 1 } }) };
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, ws, "Register of Participants");
  const unencryptedFile = XLSX.write(workbook, { bookType: "xlsx", type: "array", cellStyles: true });
  const { default: XlsxPopulate } = await import("xlsx-populate/browser/xlsx-populate");
  const encryptedFile = await (await XlsxPopulate.fromDataAsync(unencryptedFile)).outputAsync({ type: "blob", password: "relt" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(encryptedFile);
  link.download = `relt-register-of-participants-${new Date().toISOString().slice(0, 10)}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
}
