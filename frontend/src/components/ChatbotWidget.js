import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader, CheckCircle, FileEdit } from 'lucide-react';
import { toast } from 'react-toastify';
import { chatbotAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './ChatbotWidget.css';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content:
    "Hi! I'm your AI assistant for the Grievance System. I can help you file a complaint, explain how the process works, suggest the right department, or check on an existing complaint (just mention its ID). How can I help?",
};

const ChatbotWidget = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open, draft]);

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const history = newMessages
        .filter((m) => m !== WELCOME_MESSAGE)
        .map((m) => ({ role: m.role, content: m.content }));
      const response = await chatbotAPI.sendMessage(text, history);
      setMessages((prev) => [...prev, { role: 'assistant', content: response.data.reply }]);
    } catch (error) {
      const errMsg = error.response?.data?.error || 'Sorry, I ran into a problem. Please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: errMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleDraftComplaint = async () => {
    if (!isAuthenticated) {
      toast.info('Please log in to submit a complaint through the chatbot.');
      navigate('/login');
      return;
    }
    const conversationText = messages
      .filter((m) => m !== WELCOME_MESSAGE)
      .map((m) => `${m.role === 'user' ? 'Citizen' : 'Assistant'}: ${m.content}`)
      .join('\n');

    if (!conversationText.trim()) {
      toast.info('Tell me about your issue first, then I can prepare the complaint.');
      return;
    }

    setDraftLoading(true);
    try {
      const response = await chatbotAPI.draftComplaint(conversationText);
      setDraft(response.data.draft);
      if (response.data.draft.clarifying_question) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: response.data.draft.clarifying_question },
        ]);
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Could not draft the complaint. Please try again.');
    } finally {
      setDraftLoading(false);
    }
  };

  const confirmDraft = async () => {
    if (!draft) return;
    setDraftLoading(true);
    try {
      const response = await chatbotAPI.submitComplaint(draft);
      toast.success(`Complaint #${response.data.complaint_id} submitted successfully!`);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Your complaint has been filed as #${response.data.complaint_id} with ${response.data.priority} priority. You can track it from your dashboard.`,
        },
      ]);
      setDraft(null);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit complaint.');
    } finally {
      setDraftLoading(false);
    }
  };

  return (
    <div className="chatbot-root">
      <AnimatePresence>
        {open && (
          <motion.div
            className="chatbot-window"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="chatbot-header">
              <div>
                <strong>Grievance Assistant</strong>
                <span className="chatbot-subtitle">AI-powered help</span>
              </div>
              <button className="chatbot-close" onClick={() => setOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="chatbot-messages">
              {messages.map((m, idx) => (
                <div key={idx} className={`chatbot-bubble ${m.role}`}>
                  {m.content}
                </div>
              ))}
              {loading && (
                <div className="chatbot-bubble assistant chatbot-typing">
                  <Loader size={16} className="spin" /> Thinking...
                </div>
              )}

              {draft && (
                <div className="chatbot-draft-card">
                  <h4>
                    <FileEdit size={16} /> Complaint Draft
                  </h4>
                  <p>
                    <strong>Title:</strong> {draft.title}
                  </p>
                  <p>
                    <strong>Category:</strong> {draft.category}
                  </p>
                  <p>
                    <strong>Description:</strong> {draft.description}
                  </p>
                  {draft.location && (
                    <p>
                      <strong>Location:</strong> {draft.location}
                    </p>
                  )}
                  <div className="chatbot-draft-actions">
                    <button className="chatbot-btn-primary" onClick={confirmDraft} disabled={draftLoading}>
                      <CheckCircle size={16} /> Confirm & Submit
                    </button>
                    <button className="chatbot-btn-secondary" onClick={() => setDraft(null)} disabled={draftLoading}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="chatbot-quick-actions">
              <button onClick={handleDraftComplaint} disabled={draftLoading}>
                {draftLoading ? 'Preparing...' : 'File this as a complaint'}
              </button>
            </div>

            <form
              className="chatbot-input-row"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(input);
              }}
            >
              <input
                type="text"
                placeholder="Describe your issue or ask a question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <button type="submit" disabled={loading || !input.trim()}>
                <Send size={18} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        className="chatbot-fab"
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Open AI chatbot"
      >
        {open ? <X size={26} /> : <MessageCircle size={26} />}
      </motion.button>
    </div>
  );
};

export default ChatbotWidget;
