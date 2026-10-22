function csvCell(value) {
  let text = value == null ? "" : String(value);

  // Stop spreadsheet apps from treating a name as a formula.
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

export function customerContactsToCsv(rows) {
  const lines = ["name,email,phone"];

  for (const row of rows) {
    lines.push([csvCell(row.full_name), csvCell(row.email), csvCell(row.phone)].join(","));
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
