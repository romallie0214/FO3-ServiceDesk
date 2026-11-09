export interface MonitorTicket {
  id:                   number;
  ticket_number:        string;
  subject:              string;
  status:               string;
  priority:             string;
  created_at:           string;
  category:             string;
  sub_category:         string | null;
  sub_item:             string | null;
  requestor:            string;
  division:             string;
  assigned_to:          string | null;
  sla_priority:         string | null;
  sla_impact:           string | null;
  sla_response_hours:   number | null;
  sla_resolution_hours: number | null;
  sla_escalation_hours: number | null;
  sla_level:            string | null;
  first_response_at:    string | null;
  assigned_at:          string | null;
  escalation_started_at:string | null;
  resolved_at:          string | null;
  hold_started_at:      string | null;
  total_hold_seconds:   number;
  service_area_id?:     number | null;
  service_area_code?:   string | null;
  service_area_name?:   string | null;
}


type SLAStatus = 'breached' | 'escalated' | 'warning' | 'ok' | 'no-sla';

interface SLACalc {
  status:               SLAStatus;
  responseBreached:     boolean;
  escalationBreached:   boolean;
  resolutionBreached:   boolean;
  responseDeadline:     Date | null;
  resolutionDeadline:   Date | null;
  escalationDeadline:   Date | null;
  hoursRemaining:       number;
}


export function calcSLA(ticket: MonitorTicket): SLACalc | null {
  if (ticket.status === 'Cancelled' || !ticket.sla_response_hours) return null;
  const now = new Date();
  const resolvedAt = ticket.resolved_at ? new Date(ticket.resolved_at) : null;
  const created = new Date(ticket.created_at);
  const assignedAt = ticket.assigned_at ? new Date(ticket.assigned_at) : null;
  const escalationStartedAt = ticket.escalation_started_at ? new Date(ticket.escalation_started_at) : null;
  const holdStartedAt = ticket.hold_started_at ? new Date(ticket.hold_started_at) : null;
  const responseStoppedAt = ticket.first_response_at
    ? new Date(ticket.first_response_at)
    : resolvedAt || now;
  const terminalTime = resolvedAt || now;
  // Include both completed holds and the currently running hold, so the
  // resolution SLA clock is paused while a ticket is On-Hold.
  const activeHoldSeconds = ticket.status === 'On-Hold' && holdStartedAt
    ? Math.max(0, (terminalTime.getTime() - holdStartedAt.getTime()) / 1000)
    : 0;
  const pausedResolutionSeconds = Number(ticket.total_hold_seconds || 0) + activeHoldSeconds;

  const responseDeadline = new Date(created.getTime() + ticket.sla_response_hours * 3600000);
  const resolutionDeadline = assignedAt && ticket.sla_resolution_hours
    ? new Date(assignedAt.getTime() + (ticket.sla_resolution_hours * 3600000) + (pausedResolutionSeconds * 1000))
    : null;
  const escalationDeadline = escalationStartedAt && ticket.sla_escalation_hours
    ? new Date(escalationStartedAt.getTime() + ticket.sla_escalation_hours * 3600000)
    : null;
  const responseBreached = responseStoppedAt > responseDeadline;
  const resolutionBreached = Boolean(resolutionDeadline && terminalTime > resolutionDeadline);
  const escalationBreached = Boolean(escalationDeadline && terminalTime > escalationDeadline);
  const activeDeadline = resolutionDeadline || responseDeadline;
  const hoursRemaining = (activeDeadline.getTime() - terminalTime.getTime()) / 3600000;

  let status: SLAStatus = 'ok';
  if (resolutionBreached)  status = 'breached';
  else if (escalationBreached) status = 'escalated';
  else if (hoursRemaining <= 2) status = 'warning';

  return {
    status, responseBreached, escalationBreached,
    resolutionBreached, responseDeadline,
    resolutionDeadline, escalationDeadline,
    hoursRemaining,
  };
}
