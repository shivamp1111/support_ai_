// backend/models.js
// These are the Mongoose schemas representing your MongoDB structure.
const mongoose = require('mongoose');

// 1. USER SCHEMA (Handles both Agents and Customers)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ['customer', 'agent', 'admin'], default: 'customer' },
  passwordHash: { type: String, default: null },
  createdAt: { type: Date, default: Date.now }
});

// 2. TICKET SCHEMA
const ticketSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  customerType: {
    type: String,
    enum: ['Individual', 'Business', 'Enterprise'],
    default: 'Individual'
  },
  companyName: { type: String, default: null },
  contactEmail: { type: String, default: null },
  contactMethod: {
    type: String,
    enum: ['Email', 'Phone', 'Chat', 'Portal'],
    default: 'Email'
  },
  productArea: { type: String, default: null },
  impact: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  sourceChannel: {
    type: String,
    enum: ['Email', 'Phone', 'Chat', 'Portal'],
    default: 'Portal'
  },
  status: { 
    type: String, 
    enum: ['Open', 'In Progress', 'Waiting on Customer', 'Resolved', 'Closed'],
    default: 'Open'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedAgentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  
  // Embedded AI Insights - Stored to prevent regenerating on every load
  aiInsights: {
    summary: { type: String, default: null },
    sentiment: { type: String, enum: ['Positive', 'Neutral', 'Frustrated', 'Angry'], default: null },
    suggestedPriority: { type: String, default: null },
    nextAction: { type: String, default: null },
    confidenceScore: { type: Number, default: null }, // NEW: Track AI uncertainty
    isGenerated: { type: Boolean, default: false },
    lastUpdated: { type: Date, default: null }
  },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create Indexes for faster filtering on the dashboard
ticketSchema.index({ status: 1 });
ticketSchema.index({ priority: 1 });
ticketSchema.index({ assignedAgentId: 1 });
ticketSchema.index({ title: 'text', description: 'text' }); // For text search

// 3. COMMENT SCHEMA
const commentSchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  isInternal: { type: Boolean, default: false }, // TRUE = Agent note, FALSE = Customer reply
  createdAt: { type: Date, default: Date.now }
});

// 4. AUDIT LOG / TICKET HISTORY SCHEMA (For tracking changes)
const ticketHistorySchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  changedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // e.g., "Status Changed", "Assigned"
  oldValue: { type: String },
  newValue: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = {
  User: mongoose.model('User', userSchema),
  Ticket: mongoose.model('Ticket', ticketSchema),
  Comment: mongoose.model('Comment', commentSchema),
  TicketHistory: mongoose.model('TicketHistory', ticketHistorySchema)
};