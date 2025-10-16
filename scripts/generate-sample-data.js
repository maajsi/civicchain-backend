/**
 * Sample Data Generator for CivicChain Backend
 * 
 * This script generates sample users and issues for testing purposes.
 * Run with: node scripts/generate-sample-data.js
 * 
 * Prerequisites:
 * - Database must be set up and migrations run
 * - .env file must be configured
 */

require('dotenv').config();
const db = require('../src/db');
const { v4: uuidv4 } = require('uuid');
const { Keypair } = require('@solana/web3.js');

// Sample data
const sampleUsers = [
  {
    email: 'alice@citizen.com',
    name: 'Alice Johnson',
    role: 'citizen',
    rep: 150
  },
  {
    email: 'bob@citizen.com',
    name: 'Bob Smith',
    role: 'citizen',
    rep: 200
  },
  {
    email: 'charlie@citizen.com',
    name: 'Charlie Davis',
    role: 'citizen',
    rep: 80
  },
  {
    email: 'admin@gov.com',
    name: 'Government Admin',
    role: 'government',
    rep: 100
  }
];

const sampleIssues = [
  {
    description: 'Large pothole on Main Street causing traffic hazards',
    category: 'pothole',
    lat: 17.385044,
    lng: 78.486671,
    region: 'Hyderabad',
    status: 'open'
  },
  {
    description: 'Overflowing garbage bins near the market area',
    category: 'garbage',
    lat: 17.386044,
    lng: 78.487671,
    region: 'Hyderabad',
    status: 'open'
  },
  {
    description: 'Streetlight not working on Park Road for 3 days',
    category: 'streetlight',
    lat: 17.384044,
    lng: 78.485671,
    region: 'Hyderabad',
    status: 'in_progress'
  },
  {
    description: 'Water leakage from main pipeline, wasting water',
    category: 'water',
    lat: 17.387044,
    lng: 78.488671,
    region: 'Hyderabad',
    status: 'open'
  },
  {
    description: 'Damaged footpath near school entrance',
    category: 'other',
    lat: 17.383044,
    lng: 78.484671,
    region: 'Hyderabad',
    status: 'resolved'
  }
];

async function generateSampleData() {
  console.log('Starting sample data generation...\n');
  
  try {
    // Generate users
    console.log('Creating sample users...');
    const userIds = [];
    
    for (const user of sampleUsers) {
      const user_id = uuidv4();
      const privy_user_id = `privy_${uuidv4()}`;
      const walletKeypair = Keypair.generate();
      const wallet_address = walletKeypair.publicKey.toString();
      
      await db.query(`
        INSERT INTO users (
          user_id, privy_user_id, wallet_address, email, name, role, rep
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [user_id, privy_user_id, wallet_address, user.email, user.name, user.role, user.rep]);
      
      userIds.push({ user_id, role: user.role });
      console.log(`  ✓ Created ${user.role} user: ${user.name} (${user.email})`);
    }
    
    console.log(`\nCreated ${userIds.length} users\n`);
    
    // Generate issues
    console.log('Creating sample issues...');
    const citizenUsers = userIds.filter(u => u.role === 'citizen');
    
    for (let i = 0; i < sampleIssues.length; i++) {
      const issue = sampleIssues[i];
      const reporter = citizenUsers[i % citizenUsers.length];
      const issue_id = uuidv4();
      
      // Get reporter's wallet address
      const userResult = await db.query(
        'SELECT wallet_address FROM users WHERE user_id = $1',
        [reporter.user_id]
      );
      const wallet_address = userResult.rows[0].wallet_address;
      
      // Mock image URL
      const image_url = `/uploads/sample-${issue.category}-${Date.now()}.jpg`;
      
      // Simple priority score calculation
      const categoryUrgency = {
        pothole: 8,
        garbage: 6,
        streetlight: 4,
        water: 9,
        other: 5
      };
      const priority_score = categoryUrgency[issue.category] * 2.5;
      
      await db.query(`
        INSERT INTO issues (
          issue_id, reporter_user_id, wallet_address, image_url, description,
          category, location, region, status, priority_score
        ) VALUES (
          $1, $2, $3, $4, $5, $6, ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography, $9, $10, $11
        )
      `, [
        issue_id, reporter.user_id, wallet_address, image_url, issue.description,
        issue.category, issue.lng, issue.lat, issue.region, issue.status, priority_score
      ]);
      
      console.log(`  ✓ Created ${issue.category} issue: ${issue.description.substring(0, 50)}...`);
      
      // Add some votes to issues
      if (i % 2 === 0) {
        // Add an upvote from another citizen
        const voter = citizenUsers[(i + 1) % citizenUsers.length];
        await db.query(`
          INSERT INTO votes (vote_id, user_id, issue_id, vote_type)
          VALUES ($1, $2, $3, $4)
        `, [uuidv4(), voter.user_id, issue_id, 'upvote']);
        
        await db.query(
          'UPDATE issues SET upvotes = upvotes + 1 WHERE issue_id = $1',
          [issue_id]
        );
        
        console.log(`    → Added upvote to issue`);
      }
      
      // Add verification to resolved issue
      if (issue.status === 'resolved') {
        const verifier = citizenUsers[(i + 2) % citizenUsers.length];
        await db.query(`
          INSERT INTO verifications (verification_id, user_id, issue_id)
          VALUES ($1, $2, $3)
        `, [uuidv4(), verifier.user_id, issue_id]);
        
        console.log(`    → Added verification to resolved issue`);
      }
    }
    
    console.log(`\nCreated ${sampleIssues.length} issues\n`);
    
    // Update user statistics
    console.log('Updating user statistics...');
    await db.query(`
      UPDATE users u
      SET 
        issues_reported = (SELECT COUNT(*) FROM issues WHERE reporter_user_id = u.user_id),
        total_upvotes = (SELECT COALESCE(SUM(upvotes), 0) FROM issues WHERE reporter_user_id = u.user_id),
        verifications_done = (SELECT COUNT(*) FROM verifications WHERE user_id = u.user_id)
    `);
    console.log('  ✓ User statistics updated\n');
    
    // Display summary
    console.log('═══════════════════════════════════════════════════');
    console.log('Sample Data Generation Complete!');
    console.log('═══════════════════════════════════════════════════');
    console.log('\nYou can now test the API with these credentials:\n');
    
    for (const user of sampleUsers) {
      console.log(`${user.role.toUpperCase()}:`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Role: ${user.role}`);
      console.log('');
    }
    
    console.log('To log in, use POST /api/auth/login with the email and name.');
    console.log('The system will create a new user if the email doesn\'t exist,');
    console.log('or return the existing user if it does.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error generating sample data:', error);
    process.exit(1);
  }
}

// Run the script
generateSampleData();
