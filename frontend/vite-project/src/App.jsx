/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  Clock,
  Filter,
  LogOut,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  User
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'support-ai-token';

const EMPTY_DRAFT = {
  title: '',
  description: '',
  customerName: '',
  customerEmail: '',
  customerType: 'Business',
  companyName: '',
  contactMethod: 'Email',
  productArea: '',
  impact: 'Medium',
  sourceChannel: 'Portal',
  priority: 'Medium',
  assignedAgentId: ''
};

function getRecordId(record) {
  return record?._id || record?.id || '';
}

function getCustomer(record) {
  return record?.customerId || record?.customer || {};
}

function getAgent(record) {
  return record?.assignedAgentId || record?.agent || {};
}

function customerName(record) {
  return getCustomer(record)?.name || 'Unknown customer';
}

function customerEmail(record) {
  return getCustomer(record)?.email || record?.contactEmail || 'No email';
}

function agentName(record) {
  return getAgent(record)?.name || 'Unassigned';
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function badgeClasses(type, value) {
  if (type === 'status') {
    if (value === 'Open') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    if (value === 'In Progress') return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200';
    if (value === 'Waiting on Customer') return 'bg-violet-50 text-violet-700 ring-1 ring-violet-200';
    if (value === 'Resolved') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200';
    return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
  }

  if (type === 'priority') {
    if (value === 'Critical') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200';
    if (value === 'High') return 'bg-orange-50 text-orange-700 ring-1 ring-orange-200';
    if (value === 'Medium') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200';
    return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
  }

  return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
}

function Badge({ type, value }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeClasses(type, value)}`}>
      {value}
    </span>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [sessionState, setSessionState] = useState(token ? 'checking' : 'signed-out');
  const [currentUser, setCurrentUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [view, setView] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [authError, setAuthError] = useState('');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const fetchJson = async (path, options = {}, accessToken = token) => {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
      }
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error || 'Request failed');
    }

    return payload;
  };

  const loadWorkspace = async (accessToken) => {
    setLoading(true);
    setPageError('');
    try {
      const [me, ticketsData, agentsData] = await Promise.all([
        fetchJson('/auth/me', {}, accessToken),
        fetchJson('/tickets', {}, accessToken),
        fetchJson('/agents', {}, accessToken)
      ]);

      setCurrentUser(me.user);
      setTickets(Array.isArray(ticketsData) ? ticketsData : []);
      setAgents(agentsData.agents || []);
      setSessionState('signed-in');
    } catch (error) {
      localStorage.removeItem(TOKEN_KEY);
      setToken('');
      setCurrentUser(null);
      setTickets([]);
      setAgents([]);
      setTicketDetail(null);
      setSelectedTicketId('');
      setSessionState('signed-out');
      setAuthError(error.message || 'Login required');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setSessionState('signed-out');
      return;
    }

    loadWorkspace(token);
  }, []);

  const refreshTickets = async () => {
    if (!token) return;
    const data = await fetchJson('/tickets', {}, token);
    setTickets(Array.isArray(data) ? data : []);
  };

  const loadTicketDetail = async (ticketId) => {
    if (!ticketId) return;
    const data = await fetchJson(`/tickets/${ticketId}`, {}, token);
    setTicketDetail(data);
  };

  const openTicket = async (ticketId) => {
    setSelectedTicketId(ticketId);
    setView('detail');
    setPageError('');
    setTicketDetail(null);
    try {
      await loadTicketDetail(ticketId);
    } catch (error) {
      setPageError(error.message || 'Unable to load ticket');
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setAuthError('');
    setLoading(true);
    try {
      const data = await fetchJson('/auth/login', {
        method: 'POST',
        body: JSON.stringify(authForm)
      }, '');

      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setAuthForm({ email: '', password: '' });
      await loadWorkspace(data.token);
    } catch (error) {
      setAuthError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetchJson('/auth/logout', { method: 'POST' }, token);
    } catch (error) {
      setPageError(error.message || 'Logout failed');
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      setToken('');
      setCurrentUser(null);
      setTickets([]);
      setAgents([]);
      setTicketDetail(null);
      setSelectedTicketId('');
      setView('list');
      setSessionState('signed-out');
    }
  };

  const handleCreateTicket = async (event) => {
    event.preventDefault();
    setLoading(true);
    setPageError('');

    try {
      const payload = {
        ...draft,
        assignedAgentId: draft.assignedAgentId || currentUser?.id || ''
      };

      const createdTicket = await fetchJson('/tickets', {
        method: 'POST',
        body: JSON.stringify(payload)
      }, token);

      setDraft(EMPTY_DRAFT);
      await refreshTickets();
      const newTicketId = getRecordId(createdTicket);
      if (newTicketId) {
        await openTicket(newTicketId);
      } else {
        setView('list');
      }
    } catch (error) {
      setPageError(error.message || 'Ticket creation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (nextStatus) => {
    if (!selectedTicketId) return;

    try {
      await fetchJson(`/tickets/${selectedTicketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, changedById: currentUser?.id })
      });
      await refreshTickets();
      await loadTicketDetail(selectedTicketId);
    } catch (error) {
      setPageError(error.message || 'Status update failed');
    }
  };

  const handleAgentChange = async (nextAgentId) => {
    if (!selectedTicketId) return;

    try {
      await fetchJson(`/tickets/${selectedTicketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ assignedAgentId: nextAgentId, changedById: currentUser?.id })
      });
      await refreshTickets();
      await loadTicketDetail(selectedTicketId);
    } catch (error) {
      setPageError(error.message || 'Assignment update failed');
    }
  };

  const handleGenerateInsight = async () => {
    if (!selectedTicketId) return;

    try {
      await fetchJson(`/tickets/${selectedTicketId}/generate-ai`, { method: 'POST' });
      await refreshTickets();
      await loadTicketDetail(selectedTicketId);
    } catch (error) {
      setPageError(error.message || 'AI generation failed');
    }
  };

  const currentTicket = ticketDetail?.ticket || tickets.find((ticket) => getRecordId(ticket) === selectedTicketId) || null;
  const currentComments = ticketDetail?.comments || [];
  const visibleTickets = tickets.filter((ticket) => {
    const searchText = `${ticket.title} ${ticket.description} ${customerName(ticket)} ${customerEmail(ticket)}`.toLowerCase();
    const matchesSearch = !searchQuery || searchText.includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (sessionState === 'checking') {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-16 text-slate-900">
        <div className="mx-auto flex max-w-md items-center justify-center rounded-3xl border border-slate-200 bg-white p-10 shadow-xl shadow-slate-200/60">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-full bg-slate-200" />
            <p className="text-sm text-slate-500">Loading your workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  if (sessionState === 'signed-out') {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-8 text-slate-900">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="relative overflow-hidden rounded-4xl border border-slate-200 bg-slate-950 p-8 text-white shadow-2xl shadow-slate-300/40">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(148,163,184,0.20),transparent_28%),radial-gradient(circle_at_left,rgba(251,191,36,0.12),transparent_25%)]" />
            <div className="relative flex h-full flex-col justify-between gap-8">
              <div>
                <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-300">
                  <Sparkles size={14} /> Support AI
                </div>
                <h1 className="max-w-xl text-4xl font-semibold leading-tight text-white md:text-5xl">
                  One place for tickets, agents, and AI help.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                  Sign in with a real agent account, use JWT to keep the session, create richer tickets, and let Gemini summarize the issue without hardcoded replies.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div className="text-sm text-slate-300">Current flow</div>
                  <div className="mt-2 text-2xl font-semibold">Login + JWT</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div className="text-sm text-slate-300">Ticket intake</div>
                  <div className="mt-2 text-2xl font-semibold">Richer form</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div className="text-sm text-slate-300">AI summary</div>
                  <div className="mt-2 text-2xl font-semibold">Gemini</div>
                </div>
              </div>
            </div>
          </section>

          <section className="flex items-center rounded-4xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
            <div className="w-full max-w-md">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-slate-950">Agent login</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Use your seeded support account. Demo password: Support123!
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    required
                    value={authForm.email}
                    onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="sarah@codesncoffee.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                  <input
                    type="password"
                    required
                    value={authForm.password}
                    onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="Support123!"
                  />
                </div>

                {authError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {authError}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex items-center gap-2 font-medium text-slate-900">
                  <ShieldCheck size={16} /> Demo accounts
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <p>Sarah Connor: sarah@codesncoffee.com</p>
                  <p>John Smith: john@codesncoffee.com</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 flex-col border-r border-slate-800/70 bg-slate-950 text-slate-200 lg:flex">
          <div className="border-b border-white/5 px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                <Sparkles className="text-amber-300" size={20} />
              </div>
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Support AI</div>
                <div className="text-lg font-semibold text-white">Agent Desk</div>
              </div>
            </div>
          </div>

          <div className="flex-1 px-4 py-5">
            <button
              onClick={() => setView('list')}
              className={`mb-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${view === 'list' ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
            >
              <MessageSquare size={18} /> Tickets
            </button>
            <button
              onClick={() => setView('create')}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${view === 'create' ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}
            >
              <Plus size={18} /> New ticket
            </button>
          </div>

          <div className="border-t border-white/5 p-5">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Logged in as</div>
              <div className="mt-2 text-base font-semibold text-white">{currentUser?.name}</div>
              <div className="text-sm text-slate-400">{currentUser?.email}</div>
              <div className="mt-3 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-100">
                {currentUser?.role}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
            >
              <LogOut size={16} /> Logout
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-hidden">
          <header className="border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur xl:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Support dashboard</div>
                <h1 className="mt-1 text-2xl font-semibold text-slate-950">
                  {view === 'list' && 'Ticket queue'}
                  {view === 'detail' && 'Ticket details'}
                  {view === 'create' && 'Create ticket'}
                </h1>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                {view === 'list' ? (
                  <>
                    <div className="relative w-full md:w-80">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search tickets, customers, or companies"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                      />
                    </div>
                    <div className="relative w-full md:w-52">
                      <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                      >
                        <option value="">All statuses</option>
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Waiting on Customer">Waiting on Customer</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                    <button
                      onClick={() => setView('create')}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      <Plus size={16} /> New ticket
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </header>

          <div className="h-[calc(100vh-81px)] overflow-auto px-5 py-6 xl:px-8">
            {pageError ? (
              <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {pageError}
              </div>
            ) : null}

            {view === 'list' ? (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-sm text-slate-500">Open tickets</div>
                    <div className="mt-2 text-3xl font-semibold text-slate-950">
                      {tickets.filter((ticket) => ticket.status === 'Open').length}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-sm text-slate-500">Assigned to you</div>
                    <div className="mt-2 text-3xl font-semibold text-slate-950">
                      {tickets.filter((ticket) => getRecordId(getAgent(ticket)) === currentUser?.id).length}
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-sm text-slate-500">AI-ready</div>
                    <div className="mt-2 text-3xl font-semibold text-slate-950">
                      {tickets.filter((ticket) => !ticket.aiInsights?.isGenerated).length}
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-left">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                      <tr>
                        <th className="px-5 py-4 font-semibold">Ticket</th>
                        <th className="px-5 py-4 font-semibold">Customer</th>
                        <th className="px-5 py-4 font-semibold">Status</th>
                        <th className="px-5 py-4 font-semibold">Priority</th>
                        <th className="px-5 py-4 font-semibold">Agent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleTickets.map((ticket) => {
                        const ticketId = getRecordId(ticket);
                        return (
                          <tr
                            key={ticketId}
                            onClick={() => openTicket(ticketId)}
                            className="cursor-pointer transition hover:bg-slate-50"
                          >
                            <td className="px-5 py-4 align-top">
                              <div className="font-semibold text-slate-950">{ticket.title}</div>
                              <div className="mt-1 max-w-xl truncate text-sm text-slate-500">
                                {ticket.description}
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1">{ticket.customerType || 'Individual'}</span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1">{ticket.productArea || 'General'}</span>
                              </div>
                            </td>
                            <td className="px-5 py-4 align-top text-sm text-slate-700">
                              <div className="font-medium text-slate-950">{customerName(ticket)}</div>
                              <div className="text-slate-500">{customerEmail(ticket)}</div>
                              <div className="mt-2 text-xs text-slate-400">{ticket.companyName || 'No company listed'}</div>
                            </td>
                            <td className="px-5 py-4 align-top">
                              <Badge type="status" value={ticket.status} />
                            </td>
                            <td className="px-5 py-4 align-top">
                              <Badge type="priority" value={ticket.priority || 'Medium'} />
                            </td>
                            <td className="px-5 py-4 align-top text-sm text-slate-700">{agentName(ticket)}</td>
                          </tr>
                        );
                      })}
                      {!visibleTickets.length ? (
                        <tr>
                          <td colSpan="5" className="px-5 py-12 text-center text-sm text-slate-500">
                            No tickets match the current filters.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {view === 'detail' ? (
              currentTicket ? (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                  <section className="space-y-6">
                    <button
                      onClick={() => setView('list')}
                      className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
                    >
                      <ChevronLeft size={16} /> Back to queue
                    </button>

                    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Badge type="status" value={currentTicket.status} />
                            <Badge type="priority" value={currentTicket.priority || 'Medium'} />
                          </div>
                          <h2 className="mt-4 text-3xl font-semibold text-slate-950">{currentTicket.title}</h2>
                          <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">{currentTicket.description}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                          <div className="font-medium text-slate-900">Created</div>
                          <div>{formatDate(currentTicket.createdAt)}</div>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <InfoCard label="Customer" value={customerName(currentTicket)} />
                        <InfoCard label="Email" value={customerEmail(currentTicket)} />
                        <InfoCard label="Company" value={currentTicket.companyName || 'Not set'} />
                        <InfoCard label="Product area" value={currentTicket.productArea || 'General'} />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-950">Activity</h3>
                        <span className="text-sm text-slate-500">{currentComments.length} comments</span>
                      </div>

                      {currentComments.length ? currentComments.map((comment) => (
                        <div
                          key={comment._id || comment.id}
                          className={`rounded-2xl border p-4 ${comment.isInternal ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-950">{comment.authorId?.name || 'Unknown author'}</span>
                              {comment.isInternal ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900">
                                  <Lock size={10} /> Internal note
                                </span>
                              ) : null}
                            </div>
                            <span className="text-xs text-slate-400">{formatDate(comment.createdAt)}</span>
                          </div>
                          <p className="text-sm leading-6 text-slate-700">{comment.message}</p>
                        </div>
                      )) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                          No comments yet.
                        </div>
                      )}

                      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                        <textarea
                          placeholder="Type a reply or internal note..."
                          className="h-28 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                        />
                        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <label className="flex items-center gap-2 text-sm text-slate-600">
                            <input type="checkbox" className="rounded border-slate-300 text-slate-900 focus:ring-slate-500" />
                            Private internal note
                          </label>
                          <button className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                            <Send size={16} /> Send
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  <aside className="space-y-6">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950">
                          <Sparkles size={16} className="text-slate-700" /> Gemini insight
                        </h3>
                        <button
                          onClick={handleGenerateInsight}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          <RefreshCw size={14} /> Refresh
                        </button>
                      </div>

                      {currentTicket.aiInsights?.isGenerated ? (
                        <div className="mt-4 space-y-4 text-sm">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Summary</div>
                            <p className="mt-2 leading-6 text-slate-700">{currentTicket.aiInsights.summary}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl bg-slate-50 p-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Sentiment</div>
                              <div className="mt-1 font-semibold text-slate-950">{currentTicket.aiInsights.sentiment}</div>
                            </div>
                            <div className="rounded-2xl bg-slate-50 p-3">
                              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Priority</div>
                              <div className="mt-1 font-semibold text-slate-950">{currentTicket.aiInsights.suggestedPriority}</div>
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Next action</div>
                            <p className="mt-2 leading-6 text-slate-700">{currentTicket.aiInsights.nextAction}</p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Confidence</div>
                            <div className="mt-1 font-semibold text-slate-950">
                              {typeof currentTicket.aiInsights.confidenceScore === 'number' ? `${currentTicket.aiInsights.confidenceScore}%` : 'Unknown'}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                          <p className="text-sm text-slate-600">No AI insight yet.</p>
                          <button
                            onClick={handleGenerateInsight}
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                          >
                            Generate insight
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <h3 className="text-base font-semibold text-slate-950">Properties</h3>
                      <div className="mt-4 space-y-4">
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Status</label>
                          <select
                            value={currentTicket.status}
                            onChange={(event) => handleStatusChange(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                          >
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Waiting on Customer">Waiting on Customer</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Closed">Closed</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Assigned agent</label>
                          <select
                            value={getRecordId(getAgent(currentTicket))}
                            onChange={(event) => handleAgentChange(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                          >
                            <option value="">Unassigned</option>
                            {agents.map((agent) => (
                              <option key={agent.id} value={agent.id}>{agent.name}</option>
                            ))}
                          </select>
                        </div>

                        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                          <div className="font-semibold text-slate-950">Submission info</div>
                          <div className="mt-2 space-y-1">
                            <p>Customer type: {currentTicket.customerType || 'Individual'}</p>
                            <p>Channel: {currentTicket.sourceChannel || 'Portal'}</p>
                            <p>Contact method: {currentTicket.contactMethod || 'Email'}</p>
                            <p>Impact: {currentTicket.impact || 'Medium'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
                  Select a ticket to view details.
                </div>
              )
            ) : null}

            {view === 'create' ? (
              <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center gap-3 border-b border-slate-100 pb-5">
                  <button
                    onClick={() => setView('list')}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-950">Create a new ticket</h2>
                    <p className="text-sm text-slate-500">Capture who the customer is and what the issue touches before it lands in the queue.</p>
                  </div>
                </div>

                <form onSubmit={handleCreateTicket} className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Ticket title" required>
                      <input
                        required
                        value={draft.title}
                        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                        className="field-input"
                        placeholder="Brief issue summary"
                      />
                    </Field>
                    <Field label="Customer name" required>
                      <input
                        required
                        value={draft.customerName}
                        onChange={(event) => setDraft((current) => ({ ...current, customerName: event.target.value }))}
                        className="field-input"
                        placeholder="Full customer name"
                      />
                    </Field>
                    <Field label="Customer email" required>
                      <input
                        required
                        type="email"
                        value={draft.customerEmail}
                        onChange={(event) => setDraft((current) => ({ ...current, customerEmail: event.target.value }))}
                        className="field-input"
                        placeholder="customer@company.com"
                      />
                    </Field>
                    <Field label="Customer type">
                      <select
                        value={draft.customerType}
                        onChange={(event) => setDraft((current) => ({ ...current, customerType: event.target.value }))}
                        className="field-input"
                      >
                        <option value="Individual">Individual</option>
                        <option value="Business">Business</option>
                        <option value="Enterprise">Enterprise</option>
                      </select>
                    </Field>
                    <Field label="Company name">
                      <input
                        value={draft.companyName}
                        onChange={(event) => setDraft((current) => ({ ...current, companyName: event.target.value }))}
                        className="field-input"
                        placeholder="Customer company"
                      />
                    </Field>
                    <Field label="Contact method">
                      <select
                        value={draft.contactMethod}
                        onChange={(event) => setDraft((current) => ({ ...current, contactMethod: event.target.value }))}
                        className="field-input"
                      >
                        <option value="Email">Email</option>
                        <option value="Phone">Phone</option>
                        <option value="Chat">Chat</option>
                        <option value="Portal">Portal</option>
                      </select>
                    </Field>
                    <Field label="Product area">
                      <input
                        value={draft.productArea}
                        onChange={(event) => setDraft((current) => ({ ...current, productArea: event.target.value }))}
                        className="field-input"
                        placeholder="Billing, onboarding, workspace, etc."
                      />
                    </Field>
                    <Field label="Impact">
                      <select
                        value={draft.impact}
                        onChange={(event) => setDraft((current) => ({ ...current, impact: event.target.value }))}
                        className="field-input"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </Field>
                    <Field label="Source channel">
                      <select
                        value={draft.sourceChannel}
                        onChange={(event) => setDraft((current) => ({ ...current, sourceChannel: event.target.value }))}
                        className="field-input"
                      >
                        <option value="Portal">Portal</option>
                        <option value="Email">Email</option>
                        <option value="Phone">Phone</option>
                        <option value="Chat">Chat</option>
                      </select>
                    </Field>
                    <Field label="Priority">
                      <select
                        value={draft.priority}
                        onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value }))}
                        className="field-input"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </Field>
                    <Field label="Assigned agent">
                      <select
                        value={draft.assignedAgentId}
                        onChange={(event) => setDraft((current) => ({ ...current, assignedAgentId: event.target.value }))}
                        className="field-input"
                      >
                        <option value="">Auto-assign to me</option>
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Detailed description" required>
                    <textarea
                      required
                      value={draft.description}
                      onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                      className="field-input min-h-40 resize-y"
                      placeholder="Describe the issue, what the customer expected, and anything already tried."
                    />
                  </Field>

                  <div className="flex flex-col justify-end gap-3 border-t border-slate-100 pt-4 md:flex-row">
                    <button
                      type="button"
                      onClick={() => setView('list')}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Plus size={16} /> {loading ? 'Creating...' : 'Create ticket'}
                    </button>
                  </div>
                </form>
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function InfoCard({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-950">{value}</div>
    </div>
  );
}

function Field({ label, required = false, children }) {
  return (
    <label className="block space-y-2">
      <span className="block text-sm font-medium text-slate-700">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </span>
      {children}
    </label>
  );
}

export default App;
