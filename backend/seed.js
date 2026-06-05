// backend/seed.js
// Run this script once to populate your database with fake data to test the UI.

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, Ticket, Comment } = require('./models');

async function seedDatabase() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI is not defined. Add it to backend/.env before running the seed script.');
  }

  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to DB. Clearing old data...');

    await User.deleteMany({});
    await Ticket.deleteMany({});
    await Comment.deleteMany({});

    const passwordHash = await bcrypt.hash('Support123!', 10);

    // 1. Create Users
    const agent1 = await User.create({ name: 'Sarah Connor', email: 'sarah@codesncoffee.com', role: 'agent', passwordHash });
    await User.create({ name: 'John Smith', email: 'john@codesncoffee.com', role: 'agent', passwordHash });

    const customer1 = await User.create({ name: 'Alice Walker', email: 'alice@company.com', role: 'customer' });
    const customer2 = await User.create({ name: 'Bob Builder', email: 'bob@construction.com', role: 'customer' });

    // 2. Create Tickets
    const ticket1 = await Ticket.create({
      title: 'Cannot access billing invoices',
      description: 'I upgraded my plan yesterday but now when I click on the billing tab it just spins forever and gives me a 500 error. I need to download my invoice for accounting urgently! Fix this now.',
      customerType: 'Business',
      companyName: 'Acme Finance',
      contactEmail: 'alice@company.com',
      contactMethod: 'Email',
      productArea: 'Billing',
      impact: 'High',
      sourceChannel: 'Portal',
      status: 'Open',
      priority: 'High',
      customerId: customer1._id,
      assignedAgentId: agent1._id,
      createdById: agent1._id,
      aiInsights: {
        summary: 'Customer unable to access billing tab after plan upgrade. Encountering 500 errors. Needs invoice for accounting.',
        sentiment: 'Frustrated',
        suggestedPriority: 'High',
        nextAction: 'Check server logs for 500 errors on billing route for user ID. Verify plan upgrade state.',
        isGenerated: true,
        lastUpdated: new Date()
      }
    });

    await Ticket.create({
      title: 'How do I add a new team member?',
      description: 'Hello, I am trying to invite my colleague to the workspace but I cannot find the invite button. Could you point me in the right direction?',
      customerType: 'Business',
      companyName: 'BuildRight Co.',
      contactEmail: 'bob@construction.com',
      contactMethod: 'Chat',
      productArea: 'Workspace Access',
      impact: 'Low',
      sourceChannel: 'Portal',
      status: 'In Progress',
      priority: 'Low',
      customerId: customer2._id,
      assignedAgentId: null,
      createdById: agent1._id,
      aiInsights: {
        summary: 'Customer asking for instructions on how to invite a team member to their workspace.',
        sentiment: 'Neutral',
        suggestedPriority: 'Low',
        nextAction: 'Send link to workspace documentation regarding user invitations.',
        isGenerated: true,
        lastUpdated: new Date()
      }
    });

    // 3. Create Comments
    await Comment.create({
      ticketId: ticket1._id,
      authorId: customer1._id,
      message: 'Any update on this? Accounting is waiting.',
      isInternal: false
    });

    await Comment.create({
      ticketId: ticket1._id,
      authorId: agent1._id,
      message: 'I checked the logs, it seems the stripe webhook failed during her upgrade. I will manually trigger it.',
      isInternal: true
    });

    console.log('Database seeded successfully!');
  } finally {
    await mongoose.connection.close();
  }
}

seedDatabase().catch((error) => {
  console.error('Seeding failed:', error.message);
  process.exitCode = 1;
});