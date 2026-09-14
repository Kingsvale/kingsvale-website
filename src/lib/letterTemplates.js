export const starterLetterTemplates = [
  ["/templates/kingsvale-initial-letter-template.docx", "Initial letter template"],
  ["/templates/kingsvale-follow-up-letter-template.docx", "Follow-up letter template"]
];

export function isStarterLetterTemplate(url) {
  return starterLetterTemplates.some(([path]) => path === url);
}
