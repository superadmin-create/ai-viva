export const subjects = [
  "Data Structures",
  "DBMS",
  "Operating Systems",
  "Computer Networks",
] as const;

export type Subject = (typeof subjects)[number];



