# Solana Smart Contract Specification for CivicChain

This document outlines the smart contract requirements for the CivicChain platform on Solana blockchain.

## Overview

The CivicChain smart contract is designed to provide transparent, immutable audit trails for civic issue management. It records key events on the Solana blockchain while keeping the main application data in PostgreSQL for performance.

## Program Structure

The smart contract should be implemented in Rust using the Anchor framework for ease of development and security.

## Data Accounts

### User Account

Stores on-chain user information.

```rust
#[account]
pub struct UserAccount {
    pub wallet_address: Pubkey,      // User's wallet address
    pub reputation: u32,              // Current reputation score
    pub role: UserRole,               // Citizen or Government
    pub total_issues: u32,            // Total issues reported
    pub total_verifications: u32,     // Total verifications done
    pub created_at: i64,              // Unix timestamp
    pub bump: u8,                     // PDA bump seed
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum UserRole {
    Citizen,
    Government,
}
```

### Issue Account

Stores minimal on-chain issue record.

```rust
#[account]
pub struct IssueAccount {
    pub issue_hash: [u8; 32],        // SHA256 hash of issue data
    pub reporter: Pubkey,             // Reporter's wallet address
    pub status: IssueStatus,          // Current status
    pub category: IssueCategory,      // Issue category
    pub priority: u8,                 // Priority score (0-100)
    pub upvotes: u32,                 // Total upvotes
    pub downvotes: u32,               // Total downvotes
    pub verifications: u32,           // Total verifications
    pub created_at: i64,              // Unix timestamp
    pub updated_at: i64,              // Unix timestamp
    pub bump: u8,                     // PDA bump seed
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum IssueStatus {
    Open,
    InProgress,
    Resolved,
    Closed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum IssueCategory {
    Pothole,
    Garbage,
    Streetlight,
    Water,
    Other,
}
```

## Instructions (Functions)

### 1. Initialize User

Creates a new user account on-chain.

```rust
pub fn initialize_user(
    ctx: Context<InitializeUser>,
    initial_rep: u32,
    role: UserRole,
) -> Result<()>
```

**Parameters:**
- `ctx`: Anchor context with user account
- `initial_rep`: Initial reputation (usually 100)
- `role`: User role (Citizen or Government)

**Accounts:**
- `user_account`: New user PDA account (writable)
- `authority`: User's wallet (signer, payer)
- `system_program`: System program

**Logic:**
1. Initialize user account with provided data
2. Set created_at timestamp
3. Set initial reputation and role

### 2. Create Issue

Records a new issue on-chain.

```rust
pub fn create_issue(
    ctx: Context<CreateIssue>,
    issue_hash: [u8; 32],
    category: IssueCategory,
    priority: u8,
) -> Result<()>
```

**Parameters:**
- `ctx`: Anchor context
- `issue_hash`: SHA256 hash of issue data (image, description, location)
- `category`: Issue category
- `priority`: Calculated priority score

**Accounts:**
- `issue_account`: New issue PDA account (writable)
- `user_account`: Reporter's user account (writable)
- `authority`: Reporter's wallet (signer, payer)
- `system_program`: System program

**Logic:**
1. Create issue account with provided data
2. Set initial status to Open
3. Increment user's total_issues counter
4. Set timestamps

### 3. Update Reputation

Updates a user's reputation score.

```rust
pub fn update_reputation(
    ctx: Context<UpdateReputation>,
    new_rep: u32,
) -> Result<()>
```

**Parameters:**
- `ctx`: Anchor context
- `new_rep`: New reputation value

**Accounts:**
- `user_account`: User account to update (writable)
- `authority`: Authorized signer (could be program authority)

**Logic:**
1. Update user's reputation
2. Emit event for transparency

**Security:**
- Only authorized programs/wallets can call this
- Consider multi-sig for production

### 4. Update Issue Status

Updates issue status (government only).

```rust
pub fn update_issue_status(
    ctx: Context<UpdateIssueStatus>,
    new_status: IssueStatus,
) -> Result<()>
```

**Parameters:**
- `ctx`: Anchor context
- `new_status`: New status value

**Accounts:**
- `issue_account`: Issue account to update (writable)
- `user_account`: Government user account
- `authority`: Government wallet (signer)

**Logic:**
1. Verify user has Government role
2. Update issue status
3. Update timestamp
4. Emit event

**Security:**
- Check user role is Government
- Validate status transitions

### 5. Record Vote

Records an upvote or downvote.

```rust
pub fn record_vote(
    ctx: Context<RecordVote>,
    vote_type: VoteType,
) -> Result<()>

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum VoteType {
    Upvote,
    Downvote,
}
```

**Parameters:**
- `ctx`: Anchor context
- `vote_type`: Upvote or Downvote

**Accounts:**
- `issue_account`: Issue being voted on (writable)
- `reporter_account`: Issue reporter's account (writable)
- `voter_account`: Voter's account
- `authority`: Voter's wallet (signer)

**Logic:**
1. Verify voter hasn't already voted (check off-chain or use vote tracking)
2. Increment upvotes or downvotes counter
3. Update reporter's reputation
4. Update issue timestamp
5. Emit event

### 6. Record Verification

Records a citizen verification of a resolved issue.

```rust
pub fn record_verification(
    ctx: Context<RecordVerification>,
) -> Result<()>
```

**Accounts:**
- `issue_account`: Issue being verified (writable)
- `reporter_account`: Issue reporter's account (writable)
- `verifier_account`: Verifier's account (writable)
- `authority`: Verifier's wallet (signer)

**Logic:**
1. Verify issue status is Resolved
2. Verify verifier has Citizen role
3. Increment verification counter
4. Update reputation for both reporter and verifier
5. If verifications >= 3, update status to Closed
6. Emit event

## Events

Emit events for transparency and off-chain indexing.

```rust
#[event]
pub struct UserCreated {
    pub wallet_address: Pubkey,
    pub reputation: u32,
    pub role: UserRole,
    pub timestamp: i64,
}

#[event]
pub struct IssueCreated {
    pub issue_hash: [u8; 32],
    pub reporter: Pubkey,
    pub category: IssueCategory,
    pub priority: u8,
    pub timestamp: i64,
}

#[event]
pub struct IssueStatusUpdated {
    pub issue_hash: [u8; 32],
    pub old_status: IssueStatus,
    pub new_status: IssueStatus,
    pub updated_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct VoteRecorded {
    pub issue_hash: [u8; 32],
    pub voter: Pubkey,
    pub vote_type: VoteType,
    pub timestamp: i64,
}

#[event]
pub struct VerificationRecorded {
    pub issue_hash: [u8; 32],
    pub verifier: Pubkey,
    pub verification_count: u32,
    pub timestamp: i64,
}

#[event]
pub struct ReputationUpdated {
    pub wallet_address: Pubkey,
    pub old_rep: u32,
    pub new_rep: u32,
    pub timestamp: i64,
}
```

## PDA Seeds

Use Program Derived Addresses (PDAs) for deterministic account generation:

```rust
// User account PDA
seeds = [b"user", authority.key().as_ref()]

// Issue account PDA
seeds = [b"issue", issue_hash.as_ref()]
```

## Security Considerations

1. **Access Control**: Verify user roles before allowing status updates
2. **Validation**: Validate all input parameters
3. **Reentrancy**: Not a concern for Solana, but follow best practices
4. **Integer Overflow**: Use checked arithmetic
5. **PDA Security**: Ensure proper seed construction
6. **Signer Verification**: Always verify signers

## Integration with Backend

### Backend → Smart Contract

```javascript
const { Connection, PublicKey, Transaction } = require('@solana/web3.js');
const anchor = require('@project-serum/anchor');

// Initialize issue on-chain
async function createIssueOnChain(issueData) {
  const connection = new Connection(process.env.SOLANA_RPC_URL);
  const program = /* load program */;
  
  const issueHash = createHash('sha256')
    .update(JSON.stringify(issueData))
    .digest();
  
  const tx = await program.methods
    .createIssue(issueHash, category, priority)
    .accounts({
      issueAccount: issueAccountPDA,
      userAccount: userAccountPDA,
      authority: userWallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
    
  return tx;
}
```

### Query On-Chain Data

```javascript
// Fetch user account
const userAccount = await program.account.userAccount.fetch(userAccountPDA);

// Fetch issue account
const issueAccount = await program.account.issueAccount.fetch(issueAccountPDA);
```

## Development Steps

1. **Set up Anchor project**:
```bash
anchor init civicchain_contract
```

2. **Implement data structures** (accounts and enums)

3. **Implement instructions** (functions)

4. **Write tests** using Anchor's testing framework

5. **Deploy to devnet**:
```bash
anchor build
anchor deploy --provider.cluster devnet
```

6. **Integrate with backend** using generated IDL

## Testing

```typescript
describe("CivicChain Contract", () => {
  it("Initializes a user", async () => {
    const tx = await program.methods
      .initializeUser(100, { citizen: {} })
      .accounts({ /* accounts */ })
      .rpc();
    
    const userAccount = await program.account.userAccount.fetch(userPDA);
    assert.equal(userAccount.reputation, 100);
  });

  it("Creates an issue", async () => {
    // Test issue creation
  });

  it("Records a vote", async () => {
    // Test voting
  });

  it("Records verification", async () => {
    // Test verification
  });
});
```

## Deployment

1. Build the program:
```bash
anchor build
```

2. Deploy to devnet:
```bash
anchor deploy --provider.cluster devnet
```

3. Update backend with program ID

4. Test integration

5. Deploy to mainnet when ready:
```bash
anchor deploy --provider.cluster mainnet-beta
```

## Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Solana Program Library](https://github.com/solana-labs/solana-program-library)

---

This specification provides the foundation for implementing the CivicChain smart contract on Solana. The actual implementation should follow Solana and Anchor best practices for security and efficiency.
