require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { Ticket, Comment, User, TicketHistory } = require('./models');

const app = express();
const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI;
const jwtSecret = process.env.JWT_SECRET || 'support-ai-dev-secret';
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

function sanitizeUser(user) {
  if (!user) return null;

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

function getTokenFromHeader(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

function requireAuth(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }
}

function safeJsonParse(text) {
  const trimmedText = text.trim();

  try {
    return JSON.parse(trimmedText);
  } catch (error) {
    const match = trimmedText.match(/\{[\s\S]*\}/);
    if (!match) {
      throw error;
    }
    return JSON.parse(match[0]);
  }
}

async function connectDatabase() {
  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing');
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  await mongoose.connect(mongoUri);
}

connectDatabase().catch((error) => {
  console.error('Database connection failed:', error.message);
  process.exitCode = 1;
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role
      },
      jwtSecret,
      { expiresIn: '8h' }
    );

    return res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load user' });
  }
});

app.get('/api/agents', requireAuth, async (_req, res) => {
  try {
    const agents = await User.find({ role: { $in: ['agent', 'admin'] } })
      .select('name email role createdAt')
      .sort({ name: 1 });

    return res.json({ agents: agents.map(sanitizeUser) });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load agents' });
  }
});

app.get('/api/tickets', requireAuth, async (req, res) => {
  try {
    const { status, priority, agentId, search } = req.query;
    const query = {};

    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (agentId) query.assignedAgentId = agentId;
    if (search) query.$text = { $search: search };

    const tickets = await Ticket.find(query)
      .populate('customerId', 'name email role')
      .populate('assignedAgentId', 'name email role')
      .sort({ createdAt: -1 });

    return res.json(tickets);
  } catch (error) {
    return res.status(500).json({ error: 'Server error fetching tickets' });
  }
});

app.get('/api/tickets/:id', requireAuth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id)
      .populate('customerId', 'name email role')
      .populate('assignedAgentId', 'name email role')
      .populate('createdById', 'name email role');

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const comments = await Comment.find({ ticketId: req.params.id })
      .populate('authorId', 'name role email')
      .sort({ createdAt: 1 });

    return res.json({ ticket, comments });
  } catch (error) {
    return res.status(500).json({ error: 'Ticket not found' });
  }
});

app.post('/api/tickets', requireAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      customerName,
      customerEmail,
      customerType,
      companyName,
      contactMethod,
      productArea,
      impact,
      sourceChannel,
      priority,
      assignedAgentId
    } = req.body;

    if (!title || !description || !customerName || !customerEmail) {
      return res.status(400).json({
        error: 'Title, description, customer name, and customer email are required'
      });
    }

    let customer = await User.findOne({ email: customerEmail.toLowerCase().trim() });
    if (!customer) {
      customer = await User.create({
        name: customerName.trim(),
        email: customerEmail.toLowerCase().trim(),
        role: 'customer'
      });
    }

    const ticket = await Ticket.create({
      title: title.trim(),
      description: description.trim(),
      customerType: customerType || 'Individual',
      companyName: companyName?.trim() || null,
      contactEmail: customerEmail.toLowerCase().trim(),
      contactMethod: contactMethod || 'Email',
      productArea: productArea?.trim() || null,
      impact: impact || 'Medium',
      sourceChannel: sourceChannel || 'Portal',
      priority: priority || 'Medium',
      customerId: customer._id,
      assignedAgentId: assignedAgentId || req.user.id,
      createdById: req.user.id
    });

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('customerId', 'name email role')
      .populate('assignedAgentId', 'name email role');

    return res.status(201).json(populatedTicket);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create ticket' });
  }
});

app.patch('/api/tickets/:id', requireAuth, async (req, res) => {
  try {
    const { status, assignedAgentId, changedById } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const updates = {};
    if (status) updates.status = status;
    if (assignedAgentId) updates.assignedAgentId = assignedAgentId;

    if (status && status !== ticket.status) {
      await TicketHistory.create({
        ticketId: ticket._id,
        changedById: changedById || req.user.id,
        action: 'Status Update',
        oldValue: ticket.status,
        newValue: status
      });
    }

    const updatedTicket = await Ticket.findByIdAndUpdate(req.params.id, updates, { new: true });
    return res.json(updatedTicket);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update ticket' });
  }
});

app.post('/api/tickets/:id/generate-ai', requireAuth, async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const prompt = `
You are a customer support assistant. Read the ticket and return only valid JSON with these keys:
summary, sentiment, suggestedPriority, nextAction, confidenceScore.

Rules:
- summary must be 1 to 2 short sentences.
- sentiment must be one of Positive, Neutral, Frustrated, Angry.
- suggestedPriority must be one of Low, Medium, High, Urgent.
- confidenceScore must be a number from 0 to 100.
- Do not add markdown or extra text.

Ticket details:
Title: ${ticket.title}
Description: ${ticket.description}
Customer type: ${ticket.customerType || 'Unknown'}
Company: ${ticket.companyName || 'Unknown'}
Product area: ${ticket.productArea || 'Unknown'}
Contact method: ${ticket.contactMethod || 'Unknown'}
Impact: ${ticket.impact || 'Unknown'}
Current priority: ${ticket.priority}
Status: ${ticket.status}
`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json' }
    });

    const aiResult = safeJsonParse(result.response.text());
    const finalAiData = {
      summary: aiResult.summary || null,
      sentiment: aiResult.sentiment || null,
      suggestedPriority: aiResult.suggestedPriority || null,
      nextAction: aiResult.nextAction || null,
      confidenceScore: typeof aiResult.confidenceScore === 'number' ? aiResult.confidenceScore : null,
      isGenerated: true,
      lastUpdated: new Date()
    };

    ticket.aiInsights = finalAiData;
    await ticket.save();

    return res.json(finalAiData);
  } catch (error) {
    console.error('AI Generation Error:', error.message);
    return res.status(500).json({ error: 'AI generation failed' });
  }
});

app.use((error, _req, res, _next) => {
  console.error('Unexpected server error:', error);
  res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(port, () => console.log(`Server running on port ${port}`));
