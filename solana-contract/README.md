# CivicChain Solana Smart Contract

## Overview

This directory contains the Solana smart contract for CivicChain, built using the Anchor framework. The contract manages on-chain records of users, issues, votes, verifications, and reputation updates.

## Prerequisites

- Rust 1.70+
- Solana CLI 1.16+
- Anchor CLI 0.29+
- Node.js 16+

## Installation

### 1. Install Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

### 2. Install Solana CLI
```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"
```

### 3. Install Anchor
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.29.0
avm use 0.29.0
```

## Configuration

### 1. Generate a Wallet (if needed)
```bash
solana-keygen new --outfile ~/.config/solana/id.json
```

### 2. Configure Solana CLI for Devnet
```bash
solana config set --url devnet
```

### 3. Airdrop SOL for Testing
```bash
solana airdrop 2
```

Check your balance:
```bash
solana balance
```

## Building the Contract

From the `solana-contract` directory:

```bash
anchor build
```

This will:
- Compile the Rust program
- Generate the IDL (Interface Definition Language) file
- Create the deployable `.so` file

## Deploying to Devnet

### 1. Deploy the Program
```bash
anchor deploy
```

This will output a Program ID. Copy this ID.

### 2. Update Program ID

Update the program ID in two places:

**`Anchor.toml`:**
```toml
[programs.devnet]
civicchain = "YOUR_PROGRAM_ID_HERE"
```

**`lib.rs`:**
```rust
declare_id!("YOUR_PROGRAM_ID_HERE");
```

### 3. Rebuild and Redeploy
```bash
anchor build
anchor deploy
```

### 4. Update Backend Configuration

Add the program ID to your backend `.env` file:
```env
SOLANA_PROGRAM_ID=YOUR_PROGRAM_ID_HERE
```

## Contract Functions

### 1. Initialize User
Creates a new user account on-chain.

```rust
pub fn initialize_user(
    ctx: Context<InitializeUser>,
    initial_rep: u32,
    role: UserRole,
) -> Result<()>
```

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

### 3. Record Vote
Records an upvote or downvote.

```rust
pub fn record_vote(
    ctx: Context<RecordVote>,
    vote_type: VoteType,
) -> Result<()>
```

### 4. Record Verification
Records a citizen verification of a resolved issue.

```rust
pub fn record_verification(
    ctx: Context<RecordVerification>,
) -> Result<()>
```

### 5. Update Issue Status
Updates issue status (government only).

```rust
pub fn update_issue_status(
    ctx: Context<UpdateIssueStatus>,
    new_status: IssueStatus,
) -> Result<()>
```

### 6. Update Reputation
Updates user reputation.

```rust
pub fn update_reputation(
    ctx: Context<UpdateReputation>,
    new_rep: u32,
) -> Result<()>
```

## Testing

Run the test suite:

```bash
anchor test
```

## Program Accounts

### UserAccount
- `wallet_address: Pubkey` - User's wallet address
- `reputation: u32` - Current reputation score
- `role: UserRole` - Citizen or Government
- `total_issues: u32` - Total issues reported
- `total_verifications: u32` - Total verifications done
- `created_at: i64` - Unix timestamp
- `bump: u8` - PDA bump seed

### IssueAccount
- `issue_hash: [u8; 32]` - SHA256 hash of issue data
- `reporter: Pubkey` - Reporter's wallet
- `status: IssueStatus` - Current status
- `category: IssueCategory` - Issue category
- `priority: u8` - Priority score (0-100)
- `upvotes: u32` - Total upvotes
- `downvotes: u32` - Total downvotes
- `verifications: u32` - Total verifications
- `created_at: i64` - Creation timestamp
- `updated_at: i64` - Last update timestamp
- `bump: u8` - PDA bump seed

## PDAs (Program Derived Addresses)

The contract uses PDAs for deterministic account generation:

- **User Account**: `seeds = [b"user", user_wallet.as_ref()]`
- **Issue Account**: `seeds = [b"issue", issue_hash.as_ref()]`

## Integration with Backend

After deployment, the backend will automatically interact with the smart contract using the Anchor TypeScript client.

The backend `solanaService.js` contains functions that will call these contract instructions:
- `createUserOnChain()` - Calls `initialize_user`
- `createIssueOnChain()` - Calls `create_issue`
- `recordVoteOnChain()` - Calls `record_vote`
- `recordVerificationOnChain()` - Calls `record_verification`
- `updateIssueStatusOnChain()` - Calls `update_issue_status`
- `updateReputationOnChain()` - Calls `update_reputation`

## Monitoring

### View Program Logs
```bash
solana logs YOUR_PROGRAM_ID
```

### Check Program Account
```bash
solana program show YOUR_PROGRAM_ID
```

### Get Account Info
```bash
solana account ACCOUNT_ADDRESS
```

## Upgrading the Program

To upgrade after changes:

```bash
anchor build
anchor upgrade target/deploy/civicchain.so --program-id YOUR_PROGRAM_ID
```

## Cost Estimation

Approximate costs on Solana devnet (free with airdrops):

- Program deployment: ~2-5 SOL (one-time)
- User account creation: ~0.002 SOL
- Issue creation: ~0.003 SOL
- Vote recording: ~0.0001 SOL
- Verification: ~0.0001 SOL

On mainnet, these costs are similar but with real SOL.

## Security Considerations

1. **PDA Security**: All accounts use PDAs for deterministic generation
2. **Access Control**: Government-only functions check user role
3. **Integer Overflow**: All arithmetic uses checked operations
4. **Validation**: Status transitions and operations are validated
5. **Signer Verification**: All sensitive operations require proper signers

## Troubleshooting

### "Program not deployed"
```bash
anchor deploy
```

### "Insufficient funds"
```bash
solana airdrop 2
```

### "Program ID mismatch"
Ensure the program ID in `lib.rs` and `Anchor.toml` match the deployed program ID.

### Stack size errors (SPL Token 2022)
If you encounter stack size errors like:
```
Error: Function _ZN14spl_token_20229extension... Stack offset of 4264 exceeded max offset of 4096
```

**Solution**: This is caused by `anchor-spl` dependency pulling in `spl-token-2022`. Since our contract doesn't use SPL tokens, we've removed this dependency. If you need to add it back, ensure you're using a version without this issue or use the older `spl-token` crate instead.

The current `Cargo.toml` only includes `anchor-lang = "0.29.0"` which is sufficient for our contract.

### Build errors
```bash
anchor clean
anchor build
```

## Resources

- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Solana Program Library](https://github.com/solana-labs/solana-program-library)

## License

ISC License - Same as main project
