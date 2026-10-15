export function parseAttendingTeam(str: string): { name: string; isPrimary: boolean }[] {
  if (!str) return [];
  return str.split(',').map(part => {
    const trimmed  = part.trim();
    const isPrimary = trimmed.includes('(Primary)');
    const name     = trimmed.replace('(Primary)', '').trim();
    return { name, isPrimary };
  });
}

// Check if ICTMS staff is in a team attending_officer string
export function staffInAttending(attendingOfficer: string, fullName: string): boolean {
  if (!attendingOfficer || !fullName) return false;
  const team = parseAttendingTeam(attendingOfficer);
  return team.some(m =>
    m.name.toLowerCase() === fullName.toLowerCase()
  );
}
