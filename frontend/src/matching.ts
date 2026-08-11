import type { Student, Tutor } from "./types";

export type TutorMatch = { tutor: Tutor; sharedHours: string[] };

/** Returns tutors that satisfy the initial matching rules, ordered by remaining capacity. */
export function rankTutorsForStudent(
  student: Student,
  tutors: Tutor[],
): TutorMatch[] {
  const studentPerson = student.person;
  return tutors
    .filter((tutor) => {
      const person = tutor.person;
      if (person.status === "BLACKLISTED" || person.status === "REJECTED")
        return false;
      if (!tutor.approvedToTutor || tutor.activePairingCount >= tutor.capacity)
        return false;
      if (person.mode !== studentPerson.mode) return false;
      if (
        studentPerson.sameGenderPairingRequired &&
        person.gender !== studentPerson.gender
      )
        return false;
      return (
        commonHours(studentPerson.availability, person.availability).length > 0
      );
    })
    .map((tutor) => ({
      tutor,
      sharedHours: commonHours(
        studentPerson.availability,
        tutor.person.availability,
      ),
    }))
    .sort(
      (a, b) =>
        b.tutor.capacity -
        b.tutor.activePairingCount -
        (a.tutor.capacity - a.tutor.activePairingCount),
    );
}

function normaliseHours(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string")
    return value
      .split(",")
      .map((hour) => hour.trim())
      .filter(Boolean);
  if (value && typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .filter(([, selected]) => Boolean(selected))
      .map(([hour]) => hour);
  return [];
}

function commonHours(
  a: Record<string, unknown> = {},
  b: Record<string, unknown> = {},
) {
  return Object.entries(a).flatMap(([day, hours]) => {
    const tutorHours = normaliseHours(b[day]);
    return normaliseHours(hours)
      .filter((hour) => tutorHours.includes(hour))
      .map((hour) => `${day.slice(0, 3)} ${hour}`);
  });
}
