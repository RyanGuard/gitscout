import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return Response.json({ error: "CSV file required" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCSV(text);

    if (rows.length === 0) {
      return Response.json(
        { error: "No valid connections found in CSV" },
        { status: 400 }
      );
    }

    // Delete previous imports for this user (replace, don't accumulate)
    await prisma.linkedinImport.deleteMany({
      where: { userId: session.user.id },
    });

    // Insert all connections
    await prisma.linkedinImport.createMany({
      data: rows.map((row) => ({
        userId: session.user.id,
        connectionName: row.name,
        connectionTitle: row.title || null,
        connectionCompany: row.company || null,
        connectionLinkedinUrl: row.linkedinUrl || null,
      })),
    });

    return Response.json({ count: rows.length });
  } catch (error) {
    console.error("[connections] LinkedIn import error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    );
  }
}

interface LinkedinRow {
  name: string;
  title: string | null;
  company: string | null;
  linkedinUrl: string | null;
}

function parseCSV(text: string): LinkedinRow[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Parse header to find column indices
  const header = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());

  const firstNameIdx = header.findIndex(
    (h) => h === "first name" || h === "firstname"
  );
  const lastNameIdx = header.findIndex(
    (h) => h === "last name" || h === "lastname"
  );
  const companyIdx = header.findIndex(
    (h) => h === "company" || h === "organization"
  );
  const positionIdx = header.findIndex(
    (h) => h === "position" || h === "title" || h === "job title"
  );
  const urlIdx = header.findIndex(
    (h) => h === "url" || h === "profile url" || h === "linkedin url"
  );

  // If no first name column, try a single "name" column
  const nameIdx = header.findIndex((h) => h === "name" || h === "full name");

  const rows: LinkedinRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length < 2) continue;

    let name = "";
    if (firstNameIdx >= 0) {
      const first = cols[firstNameIdx]?.trim() || "";
      const last = lastNameIdx >= 0 ? cols[lastNameIdx]?.trim() || "" : "";
      name = `${first} ${last}`.trim();
    } else if (nameIdx >= 0) {
      name = cols[nameIdx]?.trim() || "";
    }

    if (!name) continue;

    rows.push({
      name,
      title: positionIdx >= 0 ? cols[positionIdx]?.trim() || null : null,
      company: companyIdx >= 0 ? cols[companyIdx]?.trim() || null : null,
      linkedinUrl: urlIdx >= 0 ? cols[urlIdx]?.trim() || null : null,
    });
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
