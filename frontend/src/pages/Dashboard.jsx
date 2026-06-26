import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Zap, Shield, Cpu, Activity, FileText, Layers, CheckCircle,
  AlertCircle, ArrowLeft, Send, MessageSquare, Terminal, GitBranch,
  ArrowUpRight, User, PlusCircle, RefreshCw, LogOut, Clock, HelpCircle
} from 'lucide-react';
import api from '../api/axios.jsx';
import { logout } from '../api/authApi.jsx';

function Dashboard() {
  const navigate = useNavigate();
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);

  // Lists & detail states
  const [tickets, setTickets] = useState([]);
  const [ticketFilter, setTicketFilter] = useState('all');
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [assigneeInfo, setAssigneeInfo] = useState(null);

  // UI states
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Chat modes: 'chat' (new query mode) or 'view' (selected ticket mode)
  const [mode, setMode] = useState('chat');

  // New chat query input state
  const [chatTitle, setChatTitle] = useState('');
  const [chatDesc, setChatDesc] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatLogs, setChatLogs] = useState([]);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am your AI Support Assistant. Please describe the technical problem or issue you are experiencing, and I will search our standard operating procedures (SOPs) to resolve it immediately.',
      type: 'text'
    }
  ]);

  // Reply message state
  const [replyMessage, setReplyMessage] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  // Manual Escalation modal state
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [escalationReason, setEscalationReason] = useState('AI automated resolution failed. Requiring human agent assistance.');
  const [escalating, setEscalating] = useState(false);

  const messagesEndRef = useRef(null);

  // Check authentication
  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  // Parse JWT token to read username client side
  useEffect(() => {
    if (token) {
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          setUser({ email: payload.sub });
        }
      } catch (err) {
        console.error('Failed to parse JWT token', err);
      }
    }
  }, [token]);

  // Fetch all tickets created by the user
  const fetchTickets = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get('/tickets');
      setTickets(response.data || []);
      setErrorMessage('');
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to connect to database API.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTickets();
    }
  }, [token]);

  // Fetch details of a selected ticket
  const fetchTicketDetail = async (ticketId, silent = false) => {
    if (!silent) setDetailLoading(true);
    try {
      const response = await api.get(`/ticket/${ticketId}`);
      setTicketDetail(response.data);
      setMode('view');
      setSelectedTicketId(ticketId);

      // Fetch assignee information
      const assigneeRes = await api.get(`/ticket/${ticketId}/assignee`);
      setAssigneeInfo(assigneeRes.data);
    } catch (err) {
      console.error(err);
      alert('Error fetching details for this ticket.');
    } finally {
      if (!silent) setDetailLoading(false);
    }
  };

  // Scroll to bottom of message thread
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [ticketDetail?.messages, chatMessages, chatLoading]);

  // Auto-refresh selected ticket messages and list in background
  useEffect(() => {
    if (selectedTicketId && mode === 'view') {
      const interval = setInterval(() => {
        fetchTicketDetail(selectedTicketId, true);
        fetchTickets(true);
      }, 6000);
      return () => clearInterval(interval);
    }
  }, [selectedTicketId, mode]);

  // Handle Logout
  const handleLogout = () => {
    logout();
    setToken('');
    navigate('/login');
  };

  // Submit a reply comment to the ticket thread
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicketId) return;

    setReplySubmitting(true);
    try {
      const formData = new URLSearchParams();
      formData.append('message', replyMessage);

      await api.post(`/ticket/${selectedTicketId}/message`, formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      setReplyMessage('');
      await fetchTicketDetail(selectedTicketId, true);
    } catch (err) {
      console.error(err);
      alert('Failed to send comment to server.');
    } finally {
      setReplySubmitting(false);
    }
  };

  // Submit new ticket query through chat
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatTitle.trim() || !chatDesc.trim()) return;

    const queryTitle = chatTitle;
    const queryDesc = chatDesc;

    // Transition to loading UI
    setChatLoading(true);
    setChatLogs([
      { step: 'Ingestion', msg: 'Ingesting ticket query stream...' },
      { step: 'Analyze', msg: 'Running Gemini NLP classification...' }
    ]);

    // Append user query to chat view
    setChatMessages(prev => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        title: queryTitle,
        text: queryDesc,
        type: 'query'
      }
    ]);

    // Reset input fields
    setChatTitle('');
    setChatDesc('');

    // Simulate RAG pipeline steps for visual feedback
    setTimeout(() => {
      setChatLogs(prev => [...prev, { step: 'SOP Retrieval', msg: 'Querying Supabase 384d vector space chunks...' }]);
    }, 800);

    setTimeout(() => {
      setChatLogs(prev => [...prev, { step: 'LLM Synthesis', msg: 'Synthesizing Gemini context response...' }]);
    }, 1600);

    try {
      // Send the query to backend API
      const response = await api.post('/insert_ticket', {
        title: queryTitle,
        description: queryDesc
      });
      const data = response.data;
      const createdTicket = data.ticket;

      setTimeout(async () => {
        setChatLoading(false);
        setChatLogs([]);

        // Add AI response to conversation
        if (data.ai_response) {
          setChatMessages(prev => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              sender: 'assistant',
              text: data.ai_response,
              type: 'text'
            }
          ]);
        }

        // If AI could not resolve, display card showing escalation / creation data
        const isResolved = createdTicket.status?.toLowerCase() === 'resolved';

        // Fetch assignee details if it routed to human support
        let resolvedAssignee = null;
        if (!isResolved) {
          try {
            const assigneeRes = await api.get(`/ticket/${createdTicket.id}/assignee`);
            resolvedAssignee = assigneeRes.data;
          } catch (e) {
            console.error('Failed to load assignee details', e);
          }
        }

        if (!isResolved) {
          setChatMessages(prev => [
            ...prev,
            {
              id: `card-${Date.now()}`,
              sender: 'system',
              type: 'escalation_card',
              ticketId: createdTicket.id,
              status: createdTicket.status,
              assignee: resolvedAssignee?.agent_name || 'IT Support Team',
              assigneeEmail: resolvedAssignee?.agent_email || 'support@company.com',
              reason: createdTicket.ai_response || 'Information not found in SOP documents.'
            }
          ]);
        } else {
          setChatMessages(prev => [
            ...prev,
            {
              id: `card-${Date.now()}`,
              sender: 'system',
              type: 'resolved_card',
              ticketId: createdTicket.id,
              status: createdTicket.status
            }
          ]);
        }

        // Refresh sidebar queue list
        await fetchTickets(true);
      }, 2400);

    } catch (err) {
      console.error(err);
      setTimeout(() => {
        setChatLoading(false);
        setChatLogs([]);
        setChatMessages(prev => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            sender: 'system',
            text: 'System Exception: The backend API failed to respond. Please ensure the server is online.',
            type: 'error'
          }
        ]);
      }, 2400);
    }
  };

  // Manual escalation trigger
  const handleEscalateTicket = async () => {
    if (!selectedTicketId) return;
    setEscalating(true);
    try {
      await api.post(`/ticket/${selectedTicketId}/escalate?reason=${encodeURIComponent(escalationReason)}`);
      setShowEscalateModal(false);
      await fetchTicketDetail(selectedTicketId);
      await fetchTickets(true);
    } catch (err) {
      console.error(err);
      alert('Failed to escalate ticket to Jira backlog.');
    } finally {
      setEscalating(false);
    }
  };

  // Mapped status texts for the UI
  const getMappedStatusLabel = (status) => {
    switch (status?.toLowerCase()) {
      case 'resolved':
        return 'Resolved';
      case 'escalated':
        return 'Escalated';
      case 'assigned':
        return 'In Progress';
      default:
        return 'Open';
    }
  };

  // Mapped status badge styles
  const getStatusBadgeStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'resolved':
        return 'border-green-500/30 bg-green-500/10 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.05)]';
      case 'escalated':
        return 'border-purple-500/30 bg-purple-500/10 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.05)]';
      case 'assigned':
        return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400';
      default:
        return 'border-gray-500/30 bg-gray-500/10 text-gray-400';
    }
  };

  // Priority color styling
  const getPriorityBadgeStyle = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'high':
      case 'urgent':
        return 'border-red-500/20 bg-red-500/10 text-red-400';
      case 'medium':
        return 'border-yellow-500/20 bg-yellow-500/10 text-yellow-400';
      default:
        return 'border-blue-500/20 bg-blue-500/10 text-blue-400';
    }
  };

  // Reset to create new ticket mode
  const startNewChat = () => {
    setMode('chat');
    setSelectedTicketId(null);
    setTicketDetail(null);
    setAssigneeInfo(null);
    setChatMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        text: 'Hello! I am your AI Support Assistant. Please describe the technical problem or issue you are experiencing, and I will search our standard operating procedures (SOPs) to resolve it immediately.',
        type: 'text'
      }
    ]);
  };

  return (
    <div className="min-h-screen bg-[#020503] text-gray-300 font-sans flex flex-col relative bg-grid-pattern overflow-hidden h-screen">
      {/* Background glow filters */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-950/15 rounded-full blur-[160px] pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-indigo-950/10 rounded-full blur-[160px] pointer-events-none"></div>

      {/* HEADER SECTION */}
      <header className="w-full bg-[#020503]/90 border-b border-blue-500/10 backdrop-blur-md z-30 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-3 hover:opacity-85 transition-opacity">
              <div className="w-9 h-9 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-blue-400" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight flex items-center">
                AutoFlow<span className="text-blue-400 font-mono font-medium ml-1">Console</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="hidden md:flex items-center gap-2 font-mono text-xs text-gray-400 border border-blue-500/15 px-3 rounded-lg bg-black/45 h-10">
                <User className="w-3.5 h-3.5 text-cyan-400" />
                <span>USER: {user.email}</span>
              </div>
            )}
            <button
              onClick={() => {
                fetchTickets();
                setMode('history');
              }}
              className="flex items-center justify-center gap-2 text-sm font-semibold border border-blue-500/25 bg-blue-500/5 hover:bg-blue-500/10 text-cyan-400 px-4 rounded-lg transition-all cursor-pointer h-10 font-mono"
              title="View Ticket History"
            >
              <FileText className="w-4 h-4" />
              <span>MY TICKETS</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 text-sm font-semibold border border-red-500/25 bg-red-500/5 hover:bg-red-500/10 text-red-400 px-4 rounded-lg transition-all cursor-pointer h-10"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="flex-grow flex w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 overflow-hidden">

        {/* MAIN WORKSPACE (CHAT / TICKET DETAIL CONTAINER) */}
        <div className="flex-grow w-full border border-blue-500/15 rounded-2xl bg-black/80 backdrop-blur-md overflow-hidden flex flex-col justify-between relative">

          {/* TICKET DETAILS HEADER (Only shown in detail view mode) */}
          {mode === 'view' && ticketDetail && (
            <section className="bg-gray-950/60 p-4 border-b border-blue-500/10 flex flex-col gap-3 shrink-0 text-left">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMode('history')}
                    className="p-1.5 border border-blue-500/20 bg-blue-500/5 text-cyan-400 rounded hover:bg-blue-500/10 flex items-center justify-center transition-all cursor-pointer"
                    title="Back to Ticket History"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <span className="font-mono text-[10px] text-cyan-400">TICKET DETAILS // #{ticketDetail.ticket.id}</span>
                    <h2 className="text-white text-base font-bold tracking-tight mt-0.5">{ticketDetail.ticket.title}</h2>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {ticketDetail.ticket.status?.toLowerCase() === 'assigned' && (
                    <button
                      onClick={() => setShowEscalateModal(true)}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(168,85,247,0.25)] cursor-pointer"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Escalate to Jira</span>
                    </button>
                  )}
                  <span className={`px-2 py-0.5 rounded border font-mono text-[10px] uppercase tracking-wider ${getStatusBadgeStyle(ticketDetail.ticket.status)}`}>
                    {getMappedStatusLabel(ticketDetail.ticket.status)}
                  </span>
                </div>
              </div>

              {/* Grid Metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px] font-mono border-t border-blue-500/5 pt-3">
                <div>
                  <span className="text-gray-500 block">DEPARTMENT:</span>
                  <span className="text-white font-bold block mt-0.5">{ticketDetail.ticket.department || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">CATEGORY:</span>
                  <span className="text-white font-bold block mt-0.5">{ticketDetail.ticket.category || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">PRIORITY:</span>
                  <span className={`font-bold block mt-0.5 ${getPriorityBadgeStyle(ticketDetail.ticket.priority)}`}>
                    {ticketDetail.ticket.priority || 'Medium'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">ASSIGNED TO:</span>
                  <span className="text-cyan-400 font-bold block mt-0.5">
                    {assigneeInfo?.agent_name ? assigneeInfo.agent_name : 'AI Agent'}
                  </span>
                </div>
              </div>

              {/* Collapsible details preview */}
              <div className="bg-[#030604]/60 border border-blue-500/10 rounded-lg p-2.5 mt-1 text-xs">
                <span className="text-gray-500 font-mono text-[9px] block mb-1">USER PROBLEM DESCRIPTION:</span>
                <p className="text-gray-300 leading-relaxed font-sans text-[11px]">{ticketDetail.ticket.description}</p>
              </div>
            </section>
          )}

          {/* CHAT DISPLAY SCREEN */}
          <div className="flex-grow overflow-y-auto p-5 space-y-5 scrollbar">

            {/* 1. VIEW MODE: SHOW TICKET CHAT HISTORY */}
            {mode === 'view' && ticketDetail ? (
              <div className="space-y-4">

                {/* AI Draft Response Card */}
                {ticketDetail.ticket.ai_response && (
                  <div className="border border-blue-500/20 bg-blue-500/5 rounded-2xl p-4 overflow-hidden relative text-left">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl"></div>
                    <div className="flex items-center gap-1.5 text-cyan-400 font-bold font-mono text-xs border-b border-blue-500/10 pb-2 mb-2">
                      <Cpu className="w-4 h-4 animate-pulse" />
                      <span>Gemini Auto-Resolution System Reply:</span>
                    </div>
                    <p className="text-white text-xs leading-relaxed font-sans whitespace-pre-wrap">
                      {ticketDetail.ticket.ai_response}
                    </p>
                  </div>
                )}

                {/* Connected Jira Details Area */}
                {ticketDetail.jira_ticket && (
                  <div className="border border-purple-500/25 bg-purple-500/5 rounded-2xl p-4 text-left">
                    <div className="flex items-center gap-1.5 text-purple-400 font-bold font-mono text-xs border-b border-purple-500/10 pb-2 mb-3">
                      <GitBranch className="w-4 h-4" />
                      <span>Connected Jira Cloud Integration:</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 font-mono text-[10px] mb-3">
                      <div className="bg-black/40 border border-purple-500/10 p-2 rounded">
                        <span className="text-gray-500">JIRA KEY</span>
                        <span className="text-white font-bold block mt-0.5 text-xs">{ticketDetail.jira_ticket.jira_issue_key}</span>
                      </div>
                      <div className="bg-black/40 border border-purple-500/10 p-2 rounded">
                        <span className="text-gray-500">JIRA ID</span>
                        <span className="text-white block mt-0.5">{ticketDetail.jira_ticket.jira_issue_id}</span>
                      </div>
                      <div className="bg-black/40 border border-purple-500/10 p-2 rounded">
                        <span className="text-gray-500">STATUS</span>
                        <span className="text-green-400 font-bold block mt-0.5 uppercase">{ticketDetail.jira_ticket.jira_status}</span>
                      </div>
                    </div>
                    {ticketDetail.escalation && (
                      <div className="bg-black/50 border border-purple-500/10 p-3 rounded text-xs font-mono">
                        <span className="text-purple-400 font-bold block mb-1">ESCALATION AUDIT NOTES:</span>
                        <span className="text-gray-300 font-sans leading-relaxed block">{ticketDetail.escalation.reason}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Audit execution log list */}
                {ticketDetail.history && ticketDetail.history.length > 0 && (
                  <div className="text-left font-mono text-[10px]">
                    <span className="text-gray-500 font-bold block mb-1">// System state audit trail:</span>
                    <div className="bg-[#030604] border border-blue-500/10 p-3 rounded-lg space-y-1 text-gray-400 max-h-[120px] overflow-y-auto scrollbar">
                      {ticketDetail.history.map((h, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="text-gray-600">[{new Date(h.created_at).toLocaleTimeString()}]</span>
                          <span className="text-cyan-400 font-semibold">{h.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conversational message logs */}
                <div className="space-y-4 pt-4 border-t border-blue-500/5">
                  <span className="text-xs font-mono text-gray-500 block text-left">// Ticket Comment Log:</span>
                  {ticketDetail.messages.length === 0 ? (
                    <p className="text-gray-600 font-mono text-xs italic">No messages filed on this ticket thread.</p>
                  ) : (
                    ticketDetail.messages.map((m) => {
                      const isSelf = m.sender_id === ticketDetail.ticket.user_id;
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col max-w-[85%] rounded-2xl p-4 border font-mono text-xs text-left ${isSelf
                            ? 'ml-auto bg-blue-950/20 border-blue-500/35 text-white'
                            : 'mr-auto bg-gray-900/60 border-gray-800 text-gray-300'
                            }`}
                        >
                          <span className={`text-[9px] font-bold mb-1.5 ${isSelf ? 'text-cyan-400' : 'text-gray-500'}`}>
                            {isSelf ? 'CLIENT' : 'SUPPORT AGENT / AI'} // {new Date(m.created_at).toLocaleTimeString()}
                          </span>
                          <p className="leading-relaxed font-sans text-xs whitespace-pre-wrap">{m.message}</p>
                        </div>
                      );
                    })
                  )}
                </div>

              </div>
            ) : mode === 'history' ? (

              // 3. HISTORY MODE: SHOW ALL TICKETS LIST
              <div className="space-y-6 text-left">
                <div className="flex items-center justify-between border-b border-blue-500/10 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                      <FileText className="w-5 h-5 text-cyan-400" />
                      <span>Support Ticket Archive</span>
                    </h2>
                    <p className="text-xs text-gray-500 mt-1 font-mono">// View and manage all your submitted cases</p>
                  </div>
                  <button
                    onClick={startNewChat}
                    className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all shadow-[0_0_12px_rgba(59,130,246,0.3)] cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>New Chat / Query</span>
                  </button>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-500 text-xs gap-3">
                    <div className="w-8 h-8 border-3 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin"></div>
                    <span className="font-mono">Loading ticket history...</span>
                  </div>
                ) : tickets.length === 0 ? (
                  <div className="py-16 text-center border border-blue-500/10 rounded-2xl bg-black/40 p-8">
                    <HelpCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400 font-mono text-sm">No tickets found in your archive.</p>
                    <button
                      onClick={startNewChat}
                      className="mt-4 text-xs text-cyan-400 hover:text-cyan-300 font-mono underline cursor-pointer"
                    >
                      Submit a query to create your first ticket
                    </button>
                  </div>
                ) : (() => {
                  const filteredTickets = tickets.filter(t => {
                    if (ticketFilter === 'all') return true;
                    if (ticketFilter === 'assigned') return t.status?.toLowerCase() === 'assigned';
                    if (ticketFilter === 'resolved') return t.status?.toLowerCase() === 'resolved';
                    return true;
                  });

                  return (
                    <>
                      {/* Filter Tabs */}
                      <div className="flex gap-2 border-b border-blue-500/10 pb-3 mt-4">
                        <button
                          onClick={() => setTicketFilter('all')}
                          className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                            ticketFilter === 'all'
                              ? 'bg-blue-500/15 border border-blue-400 text-cyan-400'
                              : 'border border-blue-500/10 hover:border-blue-500/30 text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          All ({tickets.length})
                        </button>
                        <button
                          onClick={() => setTicketFilter('assigned')}
                          className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                            ticketFilter === 'assigned'
                              ? 'bg-cyan-500/15 border border-cyan-400 text-cyan-300'
                              : 'border border-blue-500/10 hover:border-blue-500/30 text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          Assigned ({tickets.filter(t => t.status?.toLowerCase() === 'assigned').length})
                        </button>
                        <button
                          onClick={() => setTicketFilter('resolved')}
                          className={`px-4 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                            ticketFilter === 'resolved'
                              ? 'bg-green-500/15 border border-green-400 text-green-400'
                              : 'border border-blue-500/10 hover:border-blue-500/30 text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          Resolved ({tickets.filter(t => t.status?.toLowerCase() === 'resolved').length})
                        </button>
                      </div>

                      {filteredTickets.length === 0 ? (
                        <div className="py-16 text-center border border-blue-500/10 rounded-2xl bg-black/40 p-8 mt-4">
                          <HelpCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                          <p className="text-gray-400 font-mono text-sm">No {ticketFilter === 'all' ? '' : ticketFilter} tickets found.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto scrollbar pr-1 mt-4">
                          {filteredTickets.map(t => (
                            <div
                              key={t.id}
                              onClick={() => fetchTicketDetail(t.id)}
                              className="p-5 border border-blue-500/10 bg-[#030604]/60 hover:bg-blue-500/5 hover:border-blue-500/25 rounded-2xl transition-all cursor-pointer flex flex-col justify-between relative group text-left"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-3 font-mono text-[10px]">
                                  <span className="text-gray-500">TICKET #{t.id}</span>
                                  <span className={`px-2 py-0.5 rounded border ${getStatusBadgeStyle(t.status)}`}>
                                    {getMappedStatusLabel(t.status)}
                                  </span>
                                </div>
                                <h3 className="text-white font-bold text-sm mb-2 group-hover:text-cyan-400 transition-colors truncate">
                                  {t.title}
                                </h3>
                                <p className="text-gray-400 text-xs line-clamp-2 mb-4 leading-relaxed font-sans">
                                  {t.description}
                                </p>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-gray-500 font-mono border-t border-blue-500/5 pt-3 mt-auto">
                                <span>Dept: <strong className="text-gray-400">{t.department || 'General'}</strong></span>
                                <span>{new Date(t.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ) : (

              // 2. CHAT MODE: NEW CHAT PIPELINE CONVERSATION
              <div className="space-y-5 text-left">
                {chatMessages.map((m) => {
                  if (m.type === 'escalation_card') {
                    return (
                      <div key={m.id} className="border border-red-500/25 bg-red-950/5 rounded-2xl p-5 max-w-[85%] mr-auto font-mono text-xs space-y-4">
                        <div className="flex items-center gap-2 text-red-400 font-bold border-b border-red-500/10 pb-2">
                          <AlertCircle className="w-5 h-5 animate-pulse" />
                          <span className="text-sm">Ticket Escalated to Support Queue</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-gray-500">TICKET STATUS:</span>
                            <span className="text-white font-bold uppercase">{getMappedStatusLabel(m.status)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">TICKET ID:</span>
                            <span className="text-cyan-400 font-bold">#{m.ticketId}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">ASSIGNED USER:</span>
                            <span className="text-white font-bold">{m.assignee} ({m.assigneeEmail})</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">ESCALATION STATUS:</span>
                            <span className="text-yellow-500 font-semibold uppercase">Pending Backlog Assignment</span>
                          </div>
                        </div>
                        {/* <div className="bg-black/40 border border-red-500/10 p-3 rounded font-sans text-gray-300 leading-relaxed text-xs">
                          <span className="text-red-400 font-mono font-bold block text-[10px] mb-1">REASON DETECTED:</span>
                          {m.reason}
                        </div> */}
                        <div className="pt-2">
                          {/* <button
                            onClick={() => fetchTicketDetail(m.ticketId)}
                            className="w-full bg-red-950/20 hover:bg-red-950/40 text-red-400 font-bold py-2 border border-red-500/30 rounded-lg text-center transition-all cursor-pointer"
                          >
                            Open Ticket Workspaces & Chat
                          </button> */}
                        </div>
                      </div>
                    );
                  }

                  if (m.type === 'resolved_card') {
                    return (
                      <div key={m.id} className="border border-green-500/25 bg-green-950/5 rounded-2xl p-5 max-w-[85%] mr-auto font-mono text-xs space-y-3">
                        <div className="flex items-center gap-2 text-green-400 font-bold border-b border-green-500/10 pb-2">
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-sm">Ticket Auto-Resolved by AI</span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-gray-500">TICKET STATUS:</span>
                            <span className="text-green-400 font-bold uppercase">{getMappedStatusLabel(m.status)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">TICKET ID:</span>
                            <span className="text-cyan-400 font-bold">#{m.ticketId}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">RESOLUTION COMPLIANCE:</span>
                            <span className="text-white font-semibold">100% SOP Matched</span>
                          </div>
                        </div>
                        {/* <div className="pt-2">
                          <button
                            onClick={() => fetchTicketDetail(m.ticketId)}
                            className="w-full bg-green-950/20 hover:bg-green-950/40 text-green-400 font-bold py-2 border border-green-500/30 rounded-lg text-center transition-all cursor-pointer"
                          >
                            Open Ticket Workspaces & Chat
                          </button>
                        </div> */}
                      </div>
                    );
                  }

                  if (m.sender === 'user') {
                    return (
                      <div
                        key={m.id}
                        className="ml-auto bg-blue-950/20 border border-blue-500/35 rounded-2xl p-4 max-w-[85%] text-left font-mono text-xs"
                      >
                        <span className="text-[9px] text-cyan-400 font-bold block mb-2">CLIENT // SUBMITTED QUERY</span>
                        <h4 className="text-white font-bold text-sm mb-1.5">{m.title}</h4>
                        <p className="text-gray-300 font-sans leading-relaxed">{m.text}</p>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.id}
                      className="mr-auto bg-gray-900/60 border border-gray-800 rounded-2xl p-4 max-w-[85%] text-left font-mono text-xs"
                    >
                      <span className="text-[9px] text-gray-500 font-bold block mb-1.5">AI ASSISTANT</span>
                      <p className="text-gray-300 font-sans leading-relaxed text-xs whitespace-pre-wrap">{m.text}</p>
                    </div>
                  );
                })}

                {/* Real-time AI processing logs */}
                {chatLoading && (
                  <div className="mr-auto bg-gray-950/80 border border-blue-500/20 rounded-2xl p-5 w-full max-w-md font-mono text-xs space-y-3">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold border-b border-blue-500/10 pb-2 animate-pulse">
                      <Cpu className="w-5 h-5 animate-spin" />
                      <span>AI Ingestion Workflow Running...</span>
                    </div>
                    <div className="space-y-1.5 text-gray-400 text-[10px]">
                      {chatLogs.map((log, idx) => (
                        <div key={idx} className="flex gap-2">
                          <span className="text-gray-600">[{log.step.toUpperCase()}]</span>
                          <span>{log.msg}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

            )}

            <div ref={messagesEndRef} />
          </div>

          {/* LOWER MESSAGE FORM */}
          {mode !== 'history' && (
            <div className="p-4 border-t border-blue-500/10 bg-gray-950/40 shrink-0">

              {mode === 'view' ? (

                // A. REPLY INPUT FOR CHAT HISTORY
                <form onSubmit={handleSendReply} className="flex gap-2 text-left">
                  <input
                    type="text"
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type a follow-up message to this support ticket..."
                    className="flex-grow bg-black border border-blue-500/20 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 transition-colors placeholder:text-gray-600"
                    disabled={replySubmitting}
                    required
                  />
                  <button
                    type="submit"
                    disabled={replySubmitting || !replyMessage.trim()}
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold px-4 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {replySubmitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <Send className="w-4.5 h-4.5" />
                    )}
                  </button>
                </form>

              ) : (

                // B. MULTI-FIELD QUERY INPUT FOR NEW CHATS
                <form onSubmit={handleChatSubmit} className="space-y-3 text-left">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={chatTitle}
                      onChange={(e) => setChatTitle(e.target.value)}
                      placeholder="Ticket title (e.g. Password reset client failing)"
                      className="flex-grow bg-black border border-blue-500/20 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 transition-colors placeholder:text-gray-600"
                      disabled={chatLoading}
                      required
                    />
                    <button
                      type="submit"
                      disabled={chatLoading || !chatTitle.trim() || !chatDesc.trim()}
                      className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold px-5 py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {chatLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          <span>Submit Query</span>
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    value={chatDesc}
                    onChange={(e) => setChatDesc(e.target.value)}
                    placeholder="Describe your issue in detail here. The AI will immediately run classification, vector similarity retrieval against SOP guidelines, and draft a response..."
                    rows={2}
                    className="w-full bg-black border border-blue-500/20 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-cyan-400 transition-colors resize-none placeholder:text-gray-600"
                    disabled={chatLoading}
                    required
                  />
                </form>

              )}

            </div>
          )}

        </div>

      </div>

      {/* MANUAL JIRA ESCALATION MODAL */}
      {showEscalateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-md bg-[#050a06] border border-purple-500/20 rounded-2xl overflow-hidden shadow-2xl relative glow-box-purple text-left">

            <div className="p-5 border-b border-purple-500/15 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-purple-400 animate-pulse" />
                <span>Manual Escalation to Jira</span>
              </h3>
              <button
                onClick={() => { if (!escalating) setShowEscalateModal(false); }}
                className="text-gray-400 hover:text-white transition-colors"
                disabled={escalating}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-purple-950/10 border border-purple-500/10 rounded-lg p-3 text-xs text-purple-300 leading-relaxed font-mono">
                ⚠️ Proceeding will generate an issue on the corporate Jira backlog and log the escalation state in the escalations database table.
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-mono uppercase text-gray-400">Escalation Reason Notes</label>
                <textarea
                  value={escalationReason}
                  onChange={(e) => setEscalationReason(e.target.value)}
                  rows={3}
                  className="bg-black border border-purple-500/20 focus:border-purple-400 rounded-lg p-3 text-xs text-white focus:outline-none transition-colors resize-none"
                  required
                  disabled={escalating}
                />
              </div>
            </div>

            <div className="p-5 border-t border-purple-500/15 bg-gray-950/40 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEscalateModal(false)}
                className="px-4 py-2 border border-gray-800 text-gray-400 rounded-lg text-xs font-semibold hover:text-white hover:border-gray-700 transition-all cursor-pointer"
                disabled={escalating}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEscalateTicket}
                disabled={escalating || !escalationReason.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {escalating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Escalating...</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Escalate Ticket</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

// Close Icon SVG component
function X({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default Dashboard;
